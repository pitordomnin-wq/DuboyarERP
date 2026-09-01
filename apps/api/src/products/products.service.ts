import { BadRequestException, ConflictException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { ProductKind, Prisma } from '@prisma/client';
import { createReadStream } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { UpsertProductDto, CreateAttributeTemplateDto } from './dto';
import {
  isAllowedImageMime,
  MAX_IMAGE_BYTES,
  resolveResizedImage,
  MAX_IMAGES,
  productImagePath,
  removeProductImageFile,
  resolveImageMime,
  saveProductImage,
} from './storage';
import { categoryIdForKind, ensureDefaultCategories } from '../warehouse/stock-lots';

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const imageSelect = { id: true, mimeType: true, position: true } as const;

const attributeSelect = { id: true, name: true, value: true, position: true } as const;

const productInclude = {
  images: { orderBy: { position: 'asc' as const }, select: imageSelect },
  attributes: { orderBy: { position: 'asc' as const }, select: attributeSelect },
  category: { select: { id: true, name: true, position: true } },
  group: { select: { id: true, name: true } },
};

const templateInclude = {
  items: { orderBy: { position: 'asc' as const }, select: { id: true, name: true, value: true, position: true } },
};

export type ProductListScope = ProductKind | 'all' | 'supply' | 'stock' | 'catalog';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser, query?: string, scope: ProductListScope = 'catalog') {
    const search = query?.trim();
    return this.prisma.product.findMany({
      where: {
        organizationId: user.organizationId,
        ...(scope === 'all'
          ? {}
          : scope === 'supply'
            ? { kind: { not: ProductKind.FINISHED } }
            : scope === 'stock'
              ? { inCatalog: false }
              : scope === 'catalog'
                ? { inCatalog: true }
                : { kind: scope }),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      include: productInclude,
    });
  }

  async get(user: AuthUser, id: string) {
    return this.owned(user, id);
  }

  async create(user: AuthUser, dto: UpsertProductDto) {
    try {
      const kind = dto.kind ?? ProductKind.FINISHED;
      await ensureDefaultCategories(this.prisma, user.organizationId);
      const categoryId =
        dto.categoryId ?? (await categoryIdForKind(this.prisma, user.organizationId, kind));
      if (dto.categoryId) {
        const cat = await this.prisma.warehouseCategory.findFirst({
          where: { id: dto.categoryId, organizationId: user.organizationId },
        });
        if (!cat) throw new BadRequestException({ error: 'category_not_found' });
      }
      const groupId = await this.resolveGroupId(user, dto.groupId, dto.groupName);
      const product = await this.prisma.product.create({
        data: {
          ...this.fields(dto),
          organizationId: user.organizationId,
          kind,
          categoryId,
          groupId: groupId ?? null,
          inCatalog: true,
        },
      });
      await this.replaceAttributes(product.id, dto.attributes);
      return this.owned(user, product.id);
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async update(user: AuthUser, id: string, dto: UpsertProductDto) {
    await this.owned(user, id);
    if (dto.categoryId) {
      const cat = await this.prisma.warehouseCategory.findFirst({
        where: { id: dto.categoryId, organizationId: user.organizationId },
      });
      if (!cat) throw new BadRequestException({ error: 'category_not_found' });
    }
    const groupId = await this.resolveGroupId(user, dto.groupId, dto.groupName);
    try {
      await this.prisma.product.update({
        where: { id },
        data: {
          ...this.fields(dto),
          ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(groupId !== undefined ? { groupId } : {}),
        },
      });
      await this.replaceAttributes(id, dto.attributes);
      return this.owned(user, id);
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async setCatalog(user: AuthUser, id: string, inCatalog: boolean) {
    await this.owned(user, id);
    return this.prisma.product.update({
      where: { id },
      data: { inCatalog },
      include: productInclude,
    });
  }

  async addImages(user: AuthUser, id: string, files: Express.Multer.File[]) {
    const product = await this.owned(user, id);
    if (!files?.length) throw new BadRequestException({ error: 'files_required' });
    if (product.images.length + files.length > MAX_IMAGES) {
      throw new BadRequestException({ error: 'too_many_files' });
    }
    for (const file of files) {
      if (file.size > MAX_IMAGE_BYTES) throw new BadRequestException({ error: 'file_too_large' });
      const mime = resolveImageMime(file.originalname, file.mimetype);
      if (!isAllowedImageMime(mime)) throw new BadRequestException({ error: 'file_type' });
    }
    let position = product.images.reduce((max, image) => Math.max(max, image.position), -1) + 1;
    for (const file of files) {
      const saved = await saveProductImage(user.organizationId, file.originalname, file.buffer);
      await this.prisma.productImage.create({
        data: {
          productId: product.id,
          storageKey: saved.storageKey,
          mimeType: saved.mimeType,
          size: saved.size,
          position,
        },
      });
      position += 1;
    }
    return this.owned(user, id);
  }

  async removeImage(user: AuthUser, id: string, imageId: string) {
    const product = await this.owned(user, id);
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId: product.id },
    });
    if (!image) throw new NotFoundException();
    await this.prisma.productImage.delete({ where: { id: image.id } });
    await removeProductImageFile(image.storageKey);
    return this.owned(user, id);
  }

  async file(user: AuthUser, id: string, imageId: string, width?: number) {
    const product = await this.owned(user, id);
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId: product.id },
    });
    if (!image) throw new NotFoundException();
    const resolved = width
      ? await resolveResizedImage(image.storageKey, width, image.mimeType)
      : { path: productImagePath(image.storageKey), mimeType: image.mimeType };
    return new StreamableFile(createReadStream(resolved.path), {
      type: resolved.mimeType,
      disposition: 'inline',
    });
  }

  async remove(user: AuthUser, id: string) {
    const product = await this.owned(user, id);

    const [typeJobs, inputJobs, purchases] = await Promise.all([
      this.prisma.productionJob.count({ where: { type: { productId: id } } }),
      this.prisma.productionJob.count({
        where: { stage: { inputs: { some: { productId: id } } } },
      }),
      this.prisma.purchaseItem.count({ where: { productId: id } }),
    ]);
    if (typeJobs > 0 || inputJobs > 0) {
      throw new ConflictException({ error: 'in_production' });
    }
    if (purchases > 0) {
      throw new ConflictException({ error: 'in_purchases' });
    }

    const keys = (
      await this.prisma.productImage.findMany({
        where: { productId: id },
        select: { storageKey: true },
      })
    ).map((row) => row.storageKey);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.productionStageInput.deleteMany({ where: { productId: id } });
        await tx.productionType.deleteMany({ where: { productId: id } });
        await tx.stockMovement.deleteMany({ where: { productId: id } });
        await tx.product.delete({ where: { id } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException({ error: 'in_use' });
      }
      throw error;
    }

    await Promise.all(keys.map((key) => removeProductImageFile(key)));
  }

  async listTemplates(user: AuthUser) {
    return this.prisma.productAttributeTemplate.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: 'asc' },
      include: templateInclude,
    });
  }

  async createTemplate(user: AuthUser, dto: CreateAttributeTemplateDto) {
    const items = this.normalizeAttributes(dto.items);
    if (!items.length) throw new BadRequestException({ error: 'items_required' });
    try {
      return await this.prisma.productAttributeTemplate.create({
        data: {
          organizationId: user.organizationId,
          name: dto.name.trim(),
          items: {
            create: items.map((item, position) => ({
              name: item.name,
              value: item.value,
              position,
            })),
          },
        },
        include: templateInclude,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ error: 'template_name_taken' });
      }
      throw error;
    }
  }

  async removeTemplate(user: AuthUser, id: string) {
    const item = await this.prisma.productAttributeTemplate.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!item) throw new NotFoundException();
    await this.prisma.productAttributeTemplate.delete({ where: { id } });
  }

  private async replaceAttributes(productId: string, items?: { name: string; value: string }[]) {
    if (items === undefined) return;
    const rows = this.normalizeAttributes(items);
    await this.prisma.$transaction([
      this.prisma.productAttribute.deleteMany({ where: { productId } }),
      ...(rows.length
        ? [
            this.prisma.productAttribute.createMany({
              data: rows.map((item, position) => ({
                productId,
                name: item.name,
                value: item.value,
                position,
              })),
            }),
          ]
        : []),
    ]);
  }

  private normalizeAttributes(items: { name: string; value: string }[]) {
    return items
      .map((item) => ({ name: item.name.trim(), value: item.value.trim() }))
      .filter((item) => item.name && item.value)
      .slice(0, 20);
  }

  private async owned(user: AuthUser, id: string) {
    const item = await this.prisma.product.findFirst({
      where: { id, organizationId: user.organizationId },
      include: productInclude,
    });
    if (!item) throw new NotFoundException();
    return item;
  }

  private fields(dto: UpsertProductDto) {
    return {
      name: dto.name.trim(),
      sku: emptyToNull(dto.sku),
      unit: dto.unit?.trim() || 'шт',
      price: dto.price,
      description: emptyToNull(dto.description),
    };
  }

  private async resolveGroupId(user: AuthUser, groupId?: string, groupName?: string) {
    if (groupName?.trim()) {
      const name = groupName.trim();
      const existing = await this.prisma.productGroup.findUnique({
        where: { organizationId_name: { organizationId: user.organizationId, name } },
      });
      if (existing) return existing.id;
      const created = await this.prisma.productGroup.create({
        data: { organizationId: user.organizationId, name },
      });
      return created.id;
    }
    if (groupId === undefined) return undefined;
    if (!groupId) return null;
    const group = await this.prisma.productGroup.findFirst({
      where: { id: groupId, organizationId: user.organizationId },
    });
    if (!group) throw new BadRequestException({ error: 'group_not_found' });
    return group.id;
  }

  private rethrowUnique(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({ error: 'sku_taken' });
    }
    throw error;
  }
}
