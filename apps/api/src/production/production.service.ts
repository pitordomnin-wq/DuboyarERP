import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DealItemProductionStatus,
  LayoutMaterialRole,
  LkpMaterialCategory,
  Prisma,
  ProductKind,
  ProductionJobStatus,
  ProductionStageStatus,
  StageInputMode,
  StageQuantityBasis,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { CreateProductionJobDto, ImportTechCardDto, UpsertProductionTypeDto } from './dto';
import { allocateGroupFifo, createReceiptWithLot, createWriteoffFifo, roundQty } from '../warehouse/stock-lots';
import { LkpNormsService } from './lkp-norms.service';
import { writeoffByGroup, writeoffByKeywords } from './material-writeoff';
import {
  LKP_CATEGORY_LABEL,
  computeEffectiveM2,
  computePackageCount,
  computePieceCount,
  defaultQuantityBasis,
  inferReleaseType,
  layoutKeywords,
  layoutRoleForRelease,
  resolveBasisQuantity,
} from './production-norms';

const typeInclude = {
  product: { select: { id: true, name: true, sku: true, unit: true } },
  warehouse: { select: { id: true, name: true } },
  stages: {
    orderBy: { position: 'asc' as const },
    include: {
      inputs: {
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          productGroup: { select: { id: true, name: true, keywords: true } },
        },
      },
      outputs: {
        include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
      },
    },
  },
};

const jobInclude = {
  type: { select: { id: true, name: true, productId: true } },
  stage: { select: { id: true, name: true, position: true } },
  deal: { select: { id: true, title: true } },
  dealItem: { select: { id: true, name: true, productionStatus: true, unit: true } },
  warehouse: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
};

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lkpNorms: LkpNormsService,
  ) {}

  listTypes(user: AuthUser) {
    return this.prisma.productionType.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: 'asc' },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        warehouse: { select: { id: true, name: true } },
        stages: { orderBy: { position: 'asc' }, select: { id: true, name: true, position: true, lossPercent: true } },
        _count: { select: { jobs: true } },
      },
    });
  }

  async getType(user: AuthUser, id: string) {
    return this.getOwnedType(user, id);
  }

  async createType(user: AuthUser, dto: UpsertProductionTypeDto) {
    await this.assertWarehouse(user, dto.warehouseId);
    await this.assertFinishedProduct(user, dto.productId);
    const stages = await this.prepareStages(user.organizationId, dto.stages);
    return this.prisma.productionType.create({
      data: {
        organizationId: user.organizationId,
        name: dto.name.trim(),
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        defaultReleaseType: dto.defaultReleaseType ?? null,
        piecesPerM2: dto.piecesPerM2,
        m2PerPackageDeck: dto.m2PerPackageDeck,
        m2PerPackageHerringbone: dto.m2PerPackageHerringbone,
        stages: { create: stages },
      },
      include: typeInclude,
    });
  }

  async updateType(user: AuthUser, id: string, dto: UpsertProductionTypeDto) {
    const current = await this.getOwnedType(user, id);
    await this.assertWarehouse(user, dto.warehouseId);
    await this.assertFinishedProduct(user, dto.productId);
    const jobs = await this.prisma.productionJob.count({ where: { typeId: current.id } });
    const stages = await this.prepareStages(user.organizationId, dto.stages);

    if (jobs > 0 && dto.stages.length !== current.stages.length) {
      throw new BadRequestException({ error: 'stages_locked' });
    }

    return this.prisma.$transaction(async (tx) => {
      const typeData = {
        name: dto.name.trim(),
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        defaultReleaseType: dto.defaultReleaseType ?? null,
        piecesPerM2: dto.piecesPerM2,
        m2PerPackageDeck: dto.m2PerPackageDeck,
        m2PerPackageHerringbone: dto.m2PerPackageHerringbone,
      };
      if (jobs === 0) {
        await tx.productionStage.deleteMany({ where: { typeId: current.id } });
        await tx.productionType.update({
          where: { id: current.id },
          data: { ...typeData, stages: { create: stages } },
        });
      } else {
        await tx.productionType.update({ where: { id: current.id }, data: typeData });
        for (let i = 0; i < current.stages.length; i++) {
          const stage = current.stages[i];
          const next = stages[i];
          await tx.productionStageInput.deleteMany({ where: { stageId: stage.id } });
          await tx.productionStageOutput.deleteMany({ where: { stageId: stage.id } });
          await tx.productionStage.update({
            where: { id: stage.id },
            data: {
              name: next.name,
              lossPercent: next.lossPercent,
              inputs: { create: next.inputs.create },
              outputs: { create: next.outputs.create },
            },
          });
        }
      }
      return tx.productionType.findFirstOrThrow({ where: { id: current.id }, include: typeInclude });
    });
  }

  async importTechCard(user: AuthUser, dto: ImportTechCardDto) {
    await this.assertWarehouse(user, dto.warehouseId);
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, organizationId: user.organizationId, kind: ProductKind.FINISHED },
    });
    if (!product) throw new BadRequestException({ error: 'product_not_found' });

    const stage1Rows = dto.rows.filter((row) => row.stage === 1);
    const stage3Rows = dto.rows.filter((row) => row.stage === 3);
    const stage4Rows = dto.rows.filter((row) => row.stage === 4);

    const stage1Inputs = await Promise.all(
      stage1Rows.map(async (row) => {
        const norm = row.normDeckM2 ?? row.normHerringboneM2 ?? 0;
        if (row.productGroupName) {
          const group = await this.ensureGroup(user.organizationId, row.productGroupName, [row.materialName]);
          return {
            inputMode: 'GROUP' as StageInputMode,
            productGroupId: group.id,
            quantity: norm,
            quantityBasis: 'M2' as StageQuantityBasis,
          };
        }
        const lower = row.materialName.toLowerCase();
        if (lower.includes('шпон') && lower.includes('дуб')) {
          return {
            inputMode: 'KEYWORD' as StageInputMode,
            layoutRole: 'VENEER_OAK' as LayoutMaterialRole,
            keyword: 'шпон дуб',
            quantity: row.normDeckM2 ?? row.normHerringboneM2 ?? 1.125,
            quantityBasis: 'M2' as StageQuantityBasis,
          };
        }
        if (lower.includes('шпон') && lower.includes('690')) {
          return {
            inputMode: 'KEYWORD' as StageInputMode,
            layoutRole: 'VENEER_HERRINGBONE' as LayoutMaterialRole,
            keyword: 'шпон 690',
            quantity: row.normHerringboneM2 ?? norm,
            quantityBasis: 'M2' as StageQuantityBasis,
          };
        }
        if (lower.includes('шпон')) {
          return {
            inputMode: 'KEYWORD' as StageInputMode,
            layoutRole: 'VENEER_DECK' as LayoutMaterialRole,
            keyword: 'шпон 1400',
            quantity: row.normDeckM2 ?? norm,
            quantityBasis: 'M2' as StageQuantityBasis,
          };
        }
        const group = await this.ensureGroup(user.organizationId, this.groupNameFromMaterial(row.materialName), [
          this.keywordFromMaterial(row.materialName),
        ]);
        return {
          inputMode: 'GROUP' as StageInputMode,
          productGroupId: group.id,
          quantity: norm,
          quantityBasis: 'M2' as StageQuantityBasis,
        };
      }),
    );

    const stage4Inputs = stage4Rows.map((row) => {
      const lower = row.materialName.toLowerCase();
      if (lower.includes('короб') && lower.includes('т23')) {
        return {
          inputMode: 'KEYWORD' as StageInputMode,
          layoutRole: 'BOX_HERRINGBONE' as LayoutMaterialRole,
          quantity: 1,
          quantityBasis: 'PACKAGE' as StageQuantityBasis,
        };
      }
      if (lower.includes('короб') && lower.includes('т24')) {
        return {
          inputMode: 'KEYWORD' as StageInputMode,
          layoutRole: 'BOX_DECK' as LayoutMaterialRole,
          quantity: 1,
          quantityBasis: 'PACKAGE' as StageQuantityBasis,
        };
      }
      return {
        inputMode: 'KEYWORD' as StageInputMode,
        layoutRole: 'PACK_UNIVERSAL' as LayoutMaterialRole,
        quantity: 1,
        quantityBasis: 'PACKAGE' as StageQuantityBasis,
      };
    });

  void stage3Rows;

    const stages = [
      {
        name: 'Склейка слоев',
        lossPercent: 0,
        inputs: stage1Inputs,
        outputs: [],
      },
      {
        name: 'Профилирование',
        lossPercent: 20,
        inputs: [],
        outputs: [],
      },
      {
        name: 'Покраска',
        lossPercent: 0,
        inputs: [{ inputMode: 'LKP_RECIPE' as StageInputMode, quantity: 0, quantityBasis: 'M2_ORIGINAL' as StageQuantityBasis }],
        outputs: [],
      },
      {
        name: 'Упаковка',
        lossPercent: 0,
        inputs: stage4Inputs,
        outputs: [{ productId: product.id, quantity: 1 }],
      },
    ];

    const existing = await this.prisma.productionType.findFirst({
      where: { organizationId: user.organizationId, productId: product.id },
    });
    const payload: UpsertProductionTypeDto = {
      name: product.name,
      productId: product.id,
      warehouseId: dto.warehouseId,
      defaultReleaseType: dto.defaultReleaseType ?? inferReleaseType(product.name),
      stages: stages.map((stage) => ({
        name: stage.name,
        lossPercent: stage.lossPercent,
        inputs: stage.inputs.map((input) => ({
          quantity: input.quantity,
          inputMode: input.inputMode,
          quantityBasis: input.quantityBasis,
          productGroupId: 'productGroupId' in input ? input.productGroupId : undefined,
          keyword: 'keyword' in input ? input.keyword : undefined,
          layoutRole: 'layoutRole' in input ? input.layoutRole : undefined,
        })),
        outputs: stage.outputs,
      })),
    };

    if (existing) return this.updateType(user, existing.id, payload);
    return this.createType(user, payload);
  }

  async removeType(user: AuthUser, id: string) {
    const current = await this.getOwnedType(user, id);
    const jobs = await this.prisma.productionJob.count({ where: { typeId: current.id } });
    if (jobs > 0) {
      throw new BadRequestException({ error: 'has_jobs' });
    }
    await this.prisma.productionType.delete({ where: { id: current.id } });
  }

  async listJobs(user: AuthUser, typeId?: string, dealId?: string) {
    if (typeId) await this.getOwnedType(user, typeId);
    if (dealId) {
      const deal = await this.prisma.deal.findFirst({
        where: { id: dealId, organizationId: user.organizationId },
      });
      if (!deal) throw new NotFoundException();
    }
    return this.prisma.productionJob.findMany({
      where: {
        organizationId: user.organizationId,
        ...(typeId ? { typeId } : {}),
        ...(dealId ? { dealId } : {}),
      },
      orderBy: [{ status: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
      include: jobInclude,
    });
  }

  async getJob(user: AuthUser, id: string) {
    return this.getOwnedJob(user, id);
  }

  async createJob(user: AuthUser, dto: CreateProductionJobDto) {
    const item = await this.prisma.dealItem.findFirst({
      where: { id: dto.dealItemId, deal: { organizationId: user.organizationId } },
      include: { deal: true, product: { select: { id: true, name: true } } },
    });
    if (!item) throw new BadRequestException({ error: 'deal_item_not_found' });
    if (!item.productId) throw new BadRequestException({ error: 'product_required' });
    if (item.productionStatus !== DealItemProductionStatus.NONE) {
      throw new BadRequestException({ error: 'already_sent' });
    }

    const type = await this.prisma.productionType.findFirst({
      where: { organizationId: user.organizationId, productId: item.productId },
      include: typeInclude,
    });
    if (!type || type.stages.length === 0) {
      throw new BadRequestException({ error: 'type_not_configured' });
    }
    const first = type.stages[0];
    const last = await this.prisma.productionJob.findFirst({
      where: { typeId: type.id, stageId: first.id },
      orderBy: { position: 'desc' },
    });

    const releaseType =
      dto.releaseType ??
      type.defaultReleaseType ??
      inferReleaseType(item.product?.name ?? item.name);
    const quantityM2 = item.unit.trim().toLowerCase() === 'м²' || item.unit.trim().toLowerCase() === 'м2'
      ? item.quantity
      : item.quantity;

    const job = await this.prisma.$transaction(async (tx) => {
      await tx.dealItem.update({
        where: { id: item.id },
        data: { productionStatus: DealItemProductionStatus.IN_PRODUCTION },
      });
      const created = await tx.productionJob.create({
        data: {
          organizationId: user.organizationId,
          typeId: type.id,
          stageId: first.id,
          warehouseId: type.warehouseId,
          dealId: item.dealId,
          dealItemId: item.id,
          title: `${item.deal.title} · ${item.name}`,
          quantity: quantityM2,
          quantityM2,
          releaseType,
          stageStatus: ProductionStageStatus.TO_START,
          position: (last?.position ?? 0) + 1000,
          createdById: user.id,
        },
        include: jobInclude,
      });
      await tx.dealEvent.create({
        data: { dealId: item.dealId, text: `${user.name} передал в производство: ${item.name}` },
      });
      return created;
    });
    return job;
  }

  async startJob(user: AuthUser, id: string) {
    const job = await this.getOwnedJob(user, id);
    if (job.status === ProductionJobStatus.DONE) {
      throw new BadRequestException({ error: 'already_done' });
    }
    if (job.stageStatus !== ProductionStageStatus.TO_START) {
      throw new BadRequestException({ error: 'already_started' });
    }
    return this.prisma.productionJob.update({
      where: { id: job.id },
      data: { stageStatus: ProductionStageStatus.IN_PROGRESS },
      include: jobInclude,
    });
  }

  async completeJob(user: AuthUser, id: string) {
    const job = await this.getOwnedJob(user, id);
    if (job.status === ProductionJobStatus.DONE) {
      throw new BadRequestException({ error: 'already_done' });
    }
    if (job.stageStatus !== ProductionStageStatus.IN_PROGRESS) {
      throw new BadRequestException({ error: 'not_started' });
    }
    const type = await this.getOwnedType(user, job.typeId);
    const current = type.stages.find((stage) => stage.id === job.stageId);
    if (!current) throw new BadRequestException({ error: 'stage_missing' });

    const profilingStage = type.stages.find((stage) => stage.position === 1);
    const profilingLoss = profilingStage?.lossPercent ?? 20;
    const typeQty = {
      piecesPerM2: type.piecesPerM2,
      m2PerPackageDeck: type.m2PerPackageDeck,
      m2PerPackageHerringbone: type.m2PerPackageHerringbone,
    };
    const jobQty = {
      quantityM2: job.quantityM2,
      pieceCount: job.pieceCount,
      packageCount: job.packageCount,
    };

    const lossFactor = Math.max(0, 1 - (current.lossPercent ?? 0) / 100);
    const isLast = !type.stages.find((stage) => stage.position > current.position);
    const receipts =
      current.outputs.length > 0
        ? current.outputs
        : isLast
          ? [{ productId: type.productId, quantity: 1 }]
          : [];
    const next = type.stages.find((stage) => stage.position > current.position);

    const pieceCount = computePieceCount(job.quantityM2, profilingLoss, type.piecesPerM2);
    const packageCount = computePackageCount(
      job.quantityM2,
      profilingLoss,
      job.releaseType,
      type.m2PerPackageDeck,
      type.m2PerPackageHerringbone,
    );

    return this.prisma.$transaction(async (tx) => {
      const note = `${job.title} · ${current.name}`;

      for (const input of current.inputs) {
        const basis = input.quantityBasis ?? defaultQuantityBasis(current.position, input.inputMode);
        const basisQty = resolveBasisQuantity(basis, jobQty, profilingLoss, typeQty, job.releaseType);
        const need = roundQty(input.quantity * basisQty);

        if (input.inputMode === 'LKP_RECIPE') {
          await this.writeoffLkpRecipe(tx, user, job, type.productId, note, profilingLoss);
          continue;
        }

        if (input.inputMode === 'KEYWORD' || input.layoutRole) {
          const role = input.layoutRole;
          if (role && !layoutRoleForRelease(role, job.releaseType)) continue;
          const keywords = input.keyword
            ? input.keyword.split(/[,;]+/).map((part) => part.trim().toLowerCase()).filter(Boolean)
            : role
              ? layoutKeywords(role)
              : [];
          await writeoffByKeywords(tx, {
            organizationId: user.organizationId,
            warehouseId: job.warehouseId,
            keywords,
            quantity: need,
            note,
            createdById: user.id,
            productionJobId: job.id,
            label: role ?? input.keyword ?? 'материал',
          });
          continue;
        }

        if (input.productGroupId) {
          await writeoffByGroup(tx, {
            organizationId: user.organizationId,
            warehouseId: job.warehouseId,
            groupId: input.productGroupId,
            groupName: input.productGroup?.name ?? 'группа',
            groupKeywords: input.productGroup?.keywords ?? [],
            quantity: need,
            note,
            createdById: user.id,
            productionJobId: job.id,
          });
          continue;
        }

        if (input.productId) {
          const result = await createWriteoffFifo(tx, {
            warehouseId: job.warehouseId,
            productId: input.productId,
            quantity: need,
            note,
            createdById: user.id,
            productionJobId: job.id,
          });
          if (!result.ok) {
            throw new BadRequestException({
              error: 'insufficient_stock',
              name: input.product?.name ?? input.productId,
              need: result.need,
              have: result.have,
            });
          }
        }
      }

      const outputBasis =
        current.position >= 3 ? 'PACKAGE' : current.position >= 2 ? 'PIECE' : 'M2';
      const outputBasisQty = resolveBasisQuantity(outputBasis, jobQty, profilingLoss, typeQty, job.releaseType);

      for (const output of receipts) {
        const qty = roundQty(output.quantity * outputBasisQty * lossFactor);
        if (qty <= 0) continue;
        await createReceiptWithLot(tx, {
          warehouseId: job.warehouseId,
          productId: output.productId,
          quantity: qty,
          note,
          createdById: user.id,
          productionJobId: job.id,
        });
      }

      if (!next && job.dealItemId) {
        await tx.dealItem.update({
          where: { id: job.dealItemId },
          data: { productionStatus: DealItemProductionStatus.IN_WAREHOUSE },
        });
      }
      if (!next && job.dealId) {
        await tx.dealEvent.create({
          data: {
            dealId: job.dealId,
            text: `${user.name} завершил производство: ${job.dealItem?.name ?? job.title}. Продукция на складе`,
          },
        });
      }

      const jobPatch: {
        stageId?: string;
        stageStatus: ProductionStageStatus;
        status?: ProductionJobStatus;
        pieceCount?: number;
        packageCount?: number;
        quantity?: number;
      } = next
        ? { stageId: next.id, stageStatus: ProductionStageStatus.TO_START }
        : { status: ProductionJobStatus.DONE, stageStatus: ProductionStageStatus.IN_PROGRESS };

      if (current.position === 1) {
        jobPatch.pieceCount = pieceCount;
        jobPatch.quantity = pieceCount;
      }
      if (!next) {
        jobPatch.packageCount = packageCount;
        jobPatch.quantity = packageCount;
      }

      return tx.productionJob.update({
        where: { id: job.id },
        data: jobPatch,
        include: jobInclude,
      });
    });
  }

  private async writeoffLkpRecipe(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    job: { id: string; warehouseId: string; title: string; quantityM2: number },
    productId: string,
    note: string,
    profilingLossPercent: number,
  ) {
    const lkpM2 = computeEffectiveM2(job.quantityM2, profilingLossPercent);
    const categories: LkpMaterialCategory[] = ['PRIMER', 'LACQUER_OIL', 'PASTE', 'DYE', 'PIGMENT'];
    for (const category of categories) {
      const resolved = await this.lkpNorms.resolveNorm(user.organizationId, productId, category);
      if (!resolved) continue;
      const need = roundQty(resolved.normPerM2Kg * lkpM2);
      if (need <= 0) continue;
      await writeoffByKeywords(tx, {
        organizationId: user.organizationId,
        warehouseId: job.warehouseId,
        keywords: resolved.keywords,
        quantity: need,
        note,
        createdById: user.id,
        productionJobId: job.id,
        label: LKP_CATEGORY_LABEL[category],
      });
    }
  }

  private async prepareStages(organizationId: string, stages: UpsertProductionTypeDto['stages']) {
    const productIds = [
      ...new Set(
        stages.flatMap((stage) => [
          ...stage.inputs.map((input) => input.productId).filter((id): id is string => Boolean(id)),
          ...stage.outputs.map((output) => output.productId),
        ]),
      ),
    ];
    const groupIds = [
      ...new Set(
        stages.flatMap((stage) =>
          stage.inputs.map((input) => input.productGroupId).filter((id): id is string => Boolean(id)),
        ),
      ),
    ];

    for (const stage of stages) {
      for (const input of stage.inputs) {
        const mode = input.inputMode ?? (input.productGroupId ? 'GROUP' : 'PRODUCT');
        if (mode === 'PRODUCT' && !input.productId) {
          throw new BadRequestException({ error: 'input_product_required' });
        }
        if (mode === 'GROUP' && !input.productGroupId) {
          throw new BadRequestException({ error: 'input_group_required' });
        }
        if (mode === 'KEYWORD' && !input.keyword && !input.layoutRole) {
          throw new BadRequestException({ error: 'input_keyword_required' });
        }
      }
    }

    if (productIds.length) {
      const products = await this.prisma.product.findMany({
        where: { organizationId, id: { in: productIds } },
        select: { id: true },
      });
      if (products.length !== productIds.length) {
        throw new BadRequestException({ error: 'product_not_found' });
      }
    }
    if (groupIds.length) {
      const groups = await this.prisma.productGroup.findMany({
        where: { organizationId, id: { in: groupIds } },
        select: { id: true },
      });
      if (groups.length !== groupIds.length) {
        throw new BadRequestException({ error: 'group_not_found' });
      }
    }

    return stages.map((stage, index) => ({
      name: stage.name.trim(),
      position: index,
      lossPercent: stage.lossPercent ?? (index === 1 ? 20 : 0),
      inputs: {
        create: stage.inputs.map((input) => {
          const mode = input.inputMode ?? (input.productGroupId ? 'GROUP' : input.productId ? 'PRODUCT' : 'PRODUCT');
          return {
            productId: mode === 'PRODUCT' ? (input.productId ?? null) : null,
            productGroupId: mode === 'GROUP' ? (input.productGroupId ?? null) : null,
            quantity: input.quantity,
            inputMode: mode,
            quantityBasis: input.quantityBasis ?? defaultQuantityBasis(index, mode),
            lkpCategory: input.lkpCategory ?? null,
            keyword: input.keyword ?? null,
            layoutRole: input.layoutRole ?? null,
          };
        }),
      },
      outputs: {
        create: stage.outputs.map((output) => ({
          productId: output.productId,
          quantity: output.quantity,
        })),
      },
    }));
  }

  private async ensureGroup(organizationId: string, name: string, keywords: string[]) {
    const existing = await this.prisma.productGroup.findUnique({
      where: { organizationId_name: { organizationId, name } },
    });
    if (existing) return existing;
    return this.prisma.productGroup.create({
      data: { organizationId, name, keywords },
    });
  }

  private groupNameFromMaterial(materialName: string): string {
    const lower = materialName.toLowerCase();
    if (lower.includes('клей') || lower.includes('смола')) return 'Клеи';
    if (lower.includes('хдф') || lower.includes('hdf')) return 'ХДФ';
    return materialName.slice(0, 40);
  }

  private keywordFromMaterial(materialName: string): string {
    const lower = materialName.toLowerCase();
    if (lower.includes('клей') || lower.includes('смола')) return 'клей';
    if (lower.includes('хдф') || lower.includes('hdf')) return 'хдф';
    return lower.split(' ')[0] ?? lower;
  }

  private async assertWarehouse(user: AuthUser, warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, organizationId: user.organizationId },
    });
    if (!warehouse) throw new BadRequestException({ error: 'warehouse_not_found' });
  }

  private async assertFinishedProduct(user: AuthUser, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: user.organizationId, kind: ProductKind.FINISHED },
    });
    if (!product) throw new BadRequestException({ error: 'product_not_found' });
  }

  private async getOwnedType(user: AuthUser, id: string) {
    const item = await this.prisma.productionType.findFirst({
      where: { id, organizationId: user.organizationId },
      include: typeInclude,
    });
    if (!item) throw new NotFoundException();
    return item;
  }

  private async getOwnedJob(user: AuthUser, id: string) {
    const item = await this.prisma.productionJob.findFirst({
      where: { id, organizationId: user.organizationId },
      include: jobInclude,
    });
    if (!item) throw new NotFoundException();
    return item;
  }
}
