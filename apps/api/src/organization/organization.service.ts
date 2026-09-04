import { BadRequestException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { UpdateOrganizationDto } from './dto';
import {
  MAX_AVATAR_BYTES,
  isAllowedAvatarMime,
  logoPath,
  removeLogoFile,
  resolveAvatarMime,
  saveOrgLogo,
} from '../auth/avatar-storage';
import { UserRole } from '@prisma/client';
import {
  clearOrganizationOperations,
  wipeDemoProductFiles,
} from '../demo/parquet-demo';
import { fillDuboyarSeed, restoreDuboyarOrganization } from '../demo/duboyar-seed';

const publicSelect = {
  id: true,
  name: true,
  legalName: true,
  brandAddress: true,
  phone: true,
  email: true,
  logoKey: true,
  inn: true,
  kpp: true,
  ogrn: true,
  legalAddress: true,
  bankName: true,
  bik: true,
  checkingAccount: true,
  correspondentAccount: true,
  updatedAt: true,
} as const;

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async get(user: AuthUser) {
    return this.toPublic(await this.load(user.organizationId));
  }

  async update(user: AuthUser, dto: UpdateOrganizationDto) {
    const item = await this.prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        name: dto.name.trim(),
        legalName: dto.legalName === undefined ? undefined : dto.legalName,
        brandAddress: dto.brandAddress === undefined ? undefined : dto.brandAddress,
        phone: dto.phone === undefined ? undefined : dto.phone,
        email: dto.email === undefined ? undefined : dto.email,
        inn: dto.inn === undefined ? undefined : dto.inn,
        kpp: dto.kpp === undefined ? undefined : dto.kpp,
        ogrn: dto.ogrn === undefined ? undefined : dto.ogrn,
        legalAddress: dto.legalAddress === undefined ? undefined : dto.legalAddress,
        bankName: dto.bankName === undefined ? undefined : dto.bankName,
        bik: dto.bik === undefined ? undefined : dto.bik,
        checkingAccount: dto.checkingAccount === undefined ? undefined : dto.checkingAccount,
        correspondentAccount: dto.correspondentAccount === undefined ? undefined : dto.correspondentAccount,
      },
      select: publicSelect,
    });
    return this.toPublic(item);
  }

  async logoFile(user: AuthUser) {
    const item = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { logoKey: true, logoMime: true },
    });
    if (!item?.logoKey || !item.logoMime) throw new NotFoundException();
    const path = logoPath(item.logoKey);
    if (!existsSync(path)) throw new NotFoundException();
    return new StreamableFile(createReadStream(path), {
      type: item.logoMime,
      disposition: 'inline',
    });
  }

  async setLogo(user: AuthUser, file?: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException({ error: 'files_required' });
    if (file.size > MAX_AVATAR_BYTES) throw new BadRequestException({ error: 'file_too_large' });
    const mime = resolveAvatarMime(file.originalname, file.mimetype);
    if (!isAllowedAvatarMime(mime)) throw new BadRequestException({ error: 'file_type' });
    const current = await this.load(user.organizationId);
    const key = await saveOrgLogo(user.organizationId, mime, file.buffer);
    if (current.logoKey && current.logoKey !== key) await removeLogoFile(current.logoKey);
    const item = await this.prisma.organization.update({
      where: { id: user.organizationId },
      data: { logoKey: key, logoMime: mime },
      select: publicSelect,
    });
    return this.toPublic(item);
  }

  async removeLogo(user: AuthUser) {
    const current = await this.load(user.organizationId);
    if (current.logoKey) await removeLogoFile(current.logoKey);
    const item = await this.prisma.organization.update({
      where: { id: user.organizationId },
      data: { logoKey: null, logoMime: null },
      select: publicSelect,
    });
    return this.toPublic(item);
  }

  async resetDemo(user: AuthUser) {
    const people = await this.prisma.user.findMany({
      where: { organizationId: user.organizationId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    const owner =
      people.find((item) => item.email === 'owner@faverum.local') ??
      people.find((item) => item.role === UserRole.ADMIN) ??
      people[0];
    if (!owner) throw new BadRequestException({ error: 'no_users' });

    await wipeDemoProductFiles(user.organizationId);
    await this.prisma.$transaction(
      async (tx) => {
        await clearOrganizationOperations(tx, user.organizationId);
        await restoreDuboyarOrganization(tx, user.organizationId);
        await fillDuboyarSeed(tx, {
          organizationId: user.organizationId,
          ownerId: owner.id,
        });
      },
      { timeout: 240_000 },
    );

    return this.get(user);
  }

  private async load(id: string) {
    const item = await this.prisma.organization.findUnique({
      where: { id },
      select: publicSelect,
    });
    if (!item) throw new NotFoundException();
    return item;
  }

  private toPublic(item: {
    logoKey: string | null;
    updatedAt: Date;
    id: string;
    name: string;
    legalName: string | null;
    brandAddress: string | null;
    phone: string | null;
    email: string | null;
    inn: string | null;
    kpp: string | null;
    ogrn: string | null;
    legalAddress: string | null;
    bankName: string | null;
    bik: string | null;
    checkingAccount: string | null;
    correspondentAccount: string | null;
  }) {
    const hasLogo = Boolean(item.logoKey);
    return {
      id: item.id,
      name: item.name,
      legalName: item.legalName,
      brandAddress: item.brandAddress,
      phone: item.phone,
      email: item.email,
      hasLogo,
      logoAt: hasLogo ? item.updatedAt.toISOString() : null,
      inn: item.inn,
      kpp: item.kpp,
      ogrn: item.ogrn,
      legalAddress: item.legalAddress,
      bankName: item.bankName,
      bik: item.bik,
      checkingAccount: item.checkingAccount,
      correspondentAccount: item.correspondentAccount,
      updatedAt: item.updatedAt,
    };
  }
}
