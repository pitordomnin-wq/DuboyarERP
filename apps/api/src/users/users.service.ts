import { createReadStream, existsSync } from 'fs';
import { BadRequestException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { AccessStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { pagesIncludeAdmin } from '../access/pages';
import { CreateUserDto, UpdateUserDto } from './dto';
import { avatarPath } from '../auth/avatar-storage';

const publicSelect = {
  id: true,
  email: true,
  name: true,
  jobTitle: true,
  role: true,
  roleId: true,
  status: true,
  createdAt: true,
  accessRole: { select: { id: true, name: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser) {
    return this.prisma.user.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ name: 'asc' }],
      select: publicSelect,
    });
  }

  async create(user: AuthUser, dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException({ error: 'email_taken' });
    const accessRole = await this.resolveRole(user.organizationId, dto.roleId);
    return this.prisma.user.create({
      data: {
        organizationId: user.organizationId,
        email,
        name: dto.name.trim(),
        jobTitle: dto.jobTitle?.trim() || null,
        roleId: accessRole.id,
        role: pagesIncludeAdmin(accessRole.pages) ? UserRole.ADMIN : UserRole.MEMBER,
      },
      select: publicSelect,
    });
  }

  async update(actor: AuthUser, id: string, dto: UpdateUserDto) {
    const item = await this.prisma.user.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!item) throw new NotFoundException();
    if (item.id === actor.id && dto.status === AccessStatus.BLOCKED) {
      throw new BadRequestException({ error: 'cannot_block_self' });
    }
    const accessRole = dto.roleId
      ? await this.resolveRole(actor.organizationId, dto.roleId)
      : await this.prisma.role.findFirstOrThrow({ where: { id: item.roleId } });
    if (item.id === actor.id && dto.roleId && !pagesIncludeAdmin(accessRole.pages)) {
      throw new BadRequestException({ error: 'cannot_demote_self' });
    }
    return this.prisma.user.update({
      where: { id: item.id },
      data: {
        name: dto.name?.trim() ?? item.name,
        jobTitle: dto.jobTitle !== undefined ? dto.jobTitle.trim() || null : item.jobTitle,
        roleId: accessRole.id,
        role: pagesIncludeAdmin(accessRole.pages) ? UserRole.ADMIN : UserRole.MEMBER,
        status: dto.status ?? item.status,
      },
      select: publicSelect,
    });
  }

  private async resolveRole(organizationId: string, roleId?: string) {
    if (roleId) {
      const role = await this.prisma.role.findFirst({
        where: { id: roleId, organizationId },
      });
      if (!role) throw new BadRequestException({ error: 'role_not_found' });
      return role;
    }
    const member = await this.prisma.role.findFirst({
      where: { organizationId, locked: false },
      orderBy: { name: 'asc' },
    });
    if (member) return member;
    const any = await this.prisma.role.findFirst({ where: { organizationId }, orderBy: { name: 'asc' } });
    if (!any) throw new BadRequestException({ error: 'role_not_found' });
    return any;
  }

  async avatarFile(actor: AuthUser, id: string) {
    const item = await this.prisma.user.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { avatarKey: true, avatarMime: true },
    });
    if (!item?.avatarKey || !item.avatarMime) throw new NotFoundException();
    const path = avatarPath(item.avatarKey);
    if (!existsSync(path)) throw new NotFoundException();
    return new StreamableFile(createReadStream(path), {
      type: item.avatarMime,
      disposition: 'inline',
    });
  }
}
