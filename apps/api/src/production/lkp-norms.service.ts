import { Injectable } from '@nestjs/common';
import { LkpMaterialCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { DEFAULT_LKP_NORMS, parseKeywords } from './production-norms';
import { UpsertLkpNormDto } from './dto';

@Injectable()
export class LkpNormsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser) {
    await this.ensureDefaults(user.organizationId);
    return this.prisma.lkpNorm.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { category: 'asc' },
    });
  }

  async upsertAll(user: AuthUser, items: UpsertLkpNormDto[]) {
    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.lkpNorm.upsert({
          where: {
            organizationId_category: {
              organizationId: user.organizationId,
              category: item.category,
            },
          },
          create: {
            organizationId: user.organizationId,
            category: item.category,
            normPerM2Kg: item.normPerM2Kg,
            keywords: item.keywords,
          },
          update: {
            normPerM2Kg: item.normPerM2Kg,
            keywords: item.keywords,
          },
        });
      }
      return tx.lkpNorm.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { category: 'asc' },
      });
    });
  }

  async ensureDefaults(organizationId: string) {
    const count = await this.prisma.lkpNorm.count({ where: { organizationId } });
    if (count > 0) return;
    await this.prisma.lkpNorm.createMany({
      data: DEFAULT_LKP_NORMS.map((item) => ({
        organizationId,
        category: item.category,
        normPerM2Kg: item.normPerM2Kg,
        keywords: item.keywords,
      })),
    });
  }

  async resolveNorm(
    organizationId: string,
    productId: string,
    category: LkpMaterialCategory,
  ): Promise<{ normPerM2Kg: number; keywords: string[] } | null> {
    await this.ensureDefaults(organizationId);
    const [recipe, orgNorm] = await Promise.all([
      this.prisma.productCoatingRecipeLine.findUnique({
        where: { productId_category: { productId, category } },
      }),
      this.prisma.lkpNorm.findUnique({
        where: { organizationId_category: { organizationId, category } },
      }),
    ]);
    if (!recipe?.enabled) return null;
    if (!orgNorm) return null;
    return {
      normPerM2Kg: recipe.normPerM2Kg ?? orgNorm.normPerM2Kg,
      keywords: parseKeywords(orgNorm.keywords),
    };
  }
}
