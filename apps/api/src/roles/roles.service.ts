import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { pagesIncludeAdmin, sanitizePages } from '../access/pages';
import { CreateRoleDto, UpdateRoleDto } from './dto';

const roleInclude = { _count: { select: { users: true } } } as const;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser) {
    return this.prisma.role.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ locked: 'desc' }, { name: 'asc' }],
      include: roleInclude,
    });
  }

  async create(user: AuthUser, dto: CreateRoleDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException({ error: 'name_required' });
    const pages = sanitizePages(dto.pages);
    await this.assertUniqueName(user.organizationId, name);
    return this.prisma.role.create({
      data: {
        organizationId: user.organizationId,
        name,
        pages,
      },
      include: roleInclude,
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateRoleDto) {
    const current = await this.getOwned(user, id);
    const name = dto.name?.trim() ?? current.name;
    if (!name) throw new BadRequestException({ error: 'name_required' });
    if (name !== current.name) {
      await this.assertUniqueName(user.organizationId, name, current.id);
    }
    let pages = dto.pages ? sanitizePages(dto.pages) : current.pages;
    if (current.locked && !pagesIncludeAdmin(pages)) {
      pages = [...pages, 'admin'];
    }
    if (current.id === user.roleId && !pagesIncludeAdmin(pages)) {
      throw new BadRequestException({ error: 'cannot_demote_self' });
    }
    const next = await this.prisma.role.update({
      where: { id: current.id },
      data: { name, pages },
      include: roleInclude,
    });
    await this.syncUsers(next.id, pages);
    return next;
  }

  async remove(user: AuthUser, id: string) {
    const current = await this.getOwned(user, id);
    if (current.locked) {
      throw new BadRequestException({ error: 'locked' });
    }
    if (current._count.users > 0) {
      throw new BadRequestException({ error: 'has_users' });
    }
    await this.prisma.role.delete({ where: { id: current.id } });
  }

  private async syncUsers(roleId: string, pages: string[]) {
    await this.prisma.user.updateMany({
      where: { roleId },
      data: { role: pagesIncludeAdmin(pages) ? UserRole.ADMIN : UserRole.MEMBER },
    });
  }

  private async assertUniqueName(organizationId: string, name: string, excludeId?: string) {
    const existing = await this.prisma.role.findFirst({
      where: { organizationId, name, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (existing) throw new BadRequestException({ error: 'name_taken' });
  }

  private async getOwned(user: AuthUser, id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, organizationId: user.organizationId },
      include: roleInclude,
    });
    if (!role) throw new NotFoundException();
    return role;
  }
}
