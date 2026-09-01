import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DealItemProductionStatus, ProductKind, ProductionJobStatus, ProductionStageStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { CreateProductionJobDto, UpsertProductionTypeDto } from './dto';
import { allocateGroupFifo, createReceiptWithLot, createWriteoffFifo, roundQty } from '../warehouse/stock-lots';

const typeInclude = {
  product: { select: { id: true, name: true, sku: true, unit: true } },
  warehouse: { select: { id: true, name: true } },
  stages: {
    orderBy: { position: 'asc' as const },
    include: {
      inputs: {
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          productGroup: { select: { id: true, name: true } },
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
  constructor(private readonly prisma: PrismaService) {}

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
      if (jobs === 0) {
        await tx.productionStage.deleteMany({ where: { typeId: current.id } });
        await tx.productionType.update({
          where: { id: current.id },
          data: {
            name: dto.name.trim(),
            productId: dto.productId,
            warehouseId: dto.warehouseId,
            stages: { create: stages },
          },
        });
      } else {
        await tx.productionType.update({
          where: { id: current.id },
          data: { name: dto.name.trim(), productId: dto.productId, warehouseId: dto.warehouseId },
        });
        for (let i = 0; i < current.stages.length; i++) {
          const stage = current.stages[i];
          const next = stages[i];
          await tx.productionStageInput.deleteMany({ where: { stageId: stage.id } });
          await tx.productionStageOutput.deleteMany({ where: { stageId: stage.id } });
          await tx.productionStage.update({
            where: { id: stage.id },
            data: {
              name: next.name,
              inputs: { create: next.inputs.create },
              outputs: { create: next.outputs.create },
            },
          });
        }
      }
      return tx.productionType.findFirstOrThrow({ where: { id: current.id }, include: typeInclude });
    });
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
      include: { deal: true },
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
          quantity: item.quantity,
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

    const lossFactor = Math.max(0, 1 - (current.lossPercent ?? 0) / 100);
    const isLast = !type.stages.find((stage) => stage.position > current.position);
    const receipts =
      current.outputs.length > 0
        ? current.outputs
        : isLast
          ? [{ productId: type.productId, quantity: 1 }]
          : [];
    const next = type.stages.find((stage) => stage.position > current.position);

    return this.prisma.$transaction(async (tx) => {
      for (const input of current.inputs) {
        const need = roundQty(input.quantity * job.quantity);
        const note = `${job.title} · ${current.name}`;

        if (input.productGroupId) {
          const members = await tx.product.findMany({
            where: { organizationId: user.organizationId, groupId: input.productGroupId },
            select: { id: true },
          });
          if (members.length === 0) {
            throw new BadRequestException({
              error: 'empty_group',
              name: input.productGroup?.name ?? 'группа',
            });
          }
          const plan = await allocateGroupFifo(
            tx,
            job.warehouseId,
            members.map((m) => m.id),
            need,
          );
          if (!plan.ok) {
            throw new BadRequestException({
              error: 'insufficient_stock',
              name: input.productGroup?.name ?? 'группа',
              need: plan.need,
              have: plan.have,
            });
          }
          for (const line of plan.lines) {
            const result = await createWriteoffFifo(tx, {
              warehouseId: job.warehouseId,
              productId: line.productId,
              quantity: line.quantity,
              note,
              createdById: user.id,
              productionJobId: job.id,
            });
            if (!result.ok) {
              throw new BadRequestException({
                error: 'insufficient_stock',
                name: input.productGroup?.name ?? 'группа',
                need: result.need,
                have: result.have,
              });
            }
          }
        } else if (input.productId) {
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

      for (const output of receipts) {
        const qty = roundQty(output.quantity * job.quantity * lossFactor);
        if (qty <= 0) continue;
        await createReceiptWithLot(tx, {
          warehouseId: job.warehouseId,
          productId: output.productId,
          quantity: qty,
          note: `${job.title} · ${current.name}`,
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
      return tx.productionJob.update({
        where: { id: job.id },
        data: next
          ? { stageId: next.id, stageStatus: ProductionStageStatus.TO_START }
          : { status: ProductionJobStatus.DONE, stageStatus: ProductionStageStatus.IN_PROGRESS },
        include: jobInclude,
      });
    });
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
        const hasProduct = Boolean(input.productId);
        const hasGroup = Boolean(input.productGroupId);
        if (hasProduct === hasGroup) {
          throw new BadRequestException({ error: 'input_xor_required' });
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
      lossPercent: stage.lossPercent ?? 0,
      inputs: {
        create: stage.inputs.map((input) => ({
          productId: input.productId ?? null,
          productGroupId: input.productGroupId ?? null,
          quantity: input.quantity,
        })),
      },
      outputs: {
        create: stage.outputs.map((output) => ({
          productId: output.productId,
          quantity: output.quantity,
        })),
      },
    }));
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
