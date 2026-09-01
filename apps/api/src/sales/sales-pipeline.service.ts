import { BadRequestException, Injectable } from '@nestjs/common';
import { DealStatus } from '@prisma/client';
import type { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEAL_STATUSES,
  DEAL_STATUS_LABEL,
  DEFAULT_DEAL_STATUS_COLOR,
  defaultDealPipelineColumns,
  type DealPipelineColumn,
} from './statuses';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

@Injectable()
export class SalesPipelineService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser): Promise<DealPipelineColumn[]> {
    return this.listForOrg(user.organizationId);
  }

  async listForOrg(organizationId: string): Promise<DealPipelineColumn[]> {
    await this.ensureDefaults(organizationId);
    const rows = await this.prisma.dealStatusConfig.findMany({
      where: { organizationId },
      orderBy: { position: 'asc' },
    });
    return rows.map((row) => ({
      status: row.status,
      label: row.label,
      color: row.color,
      position: row.position,
    }));
  }

  async update(user: AuthUser, columns: DealPipelineColumn[]): Promise<DealPipelineColumn[]> {
    if (columns.length !== DEAL_STATUSES.length) {
      throw new BadRequestException({ error: 'invalid_columns_count' });
    }

    const statuses = new Set<DealStatus>();
    for (const column of columns) {
      if (!DEAL_STATUSES.includes(column.status)) {
        throw new BadRequestException({ error: 'invalid_status', status: column.status });
      }
      if (statuses.has(column.status)) {
        throw new BadRequestException({ error: 'duplicate_status', status: column.status });
      }
      statuses.add(column.status);

      const label = column.label.trim();
      if (!label) throw new BadRequestException({ error: 'empty_label', status: column.status });
      if (label.length > 80) throw new BadRequestException({ error: 'label_too_long', status: column.status });
      if (!HEX_COLOR.test(column.color)) {
        throw new BadRequestException({ error: 'invalid_color', status: column.status });
      }
    }

    await this.ensureDefaults(user.organizationId);

    await this.prisma.$transaction(
      columns.map((column, index) =>
        this.prisma.dealStatusConfig.update({
          where: {
            organizationId_status: {
              organizationId: user.organizationId,
              status: column.status,
            },
          },
          data: {
            label: column.label.trim(),
            color: column.color.toLowerCase(),
            position: index,
          },
        }),
      ),
    );

    return this.list(user);
  }

  async ensureDefaults(organizationId: string) {
    const count = await this.prisma.dealStatusConfig.count({ where: { organizationId } });
    if (count >= DEAL_STATUSES.length) return;

    const defaults = defaultDealPipelineColumns();
    await this.prisma.dealStatusConfig.createMany({
      data: defaults.map((column) => ({
        organizationId,
        status: column.status,
        label: column.label,
        color: column.color,
        position: column.position,
      })),
      skipDuplicates: true,
    });
  }

  labelMap(rows: DealPipelineColumn[]): Record<DealStatus, string> {
    const map = { ...DEAL_STATUS_LABEL };
    for (const row of rows) map[row.status] = row.label;
    return map;
  }

  colorMap(rows: DealPipelineColumn[]): Record<DealStatus, string> {
    const map = { ...DEFAULT_DEAL_STATUS_COLOR };
    for (const row of rows) map[row.status] = row.color;
    return map;
  }
}
