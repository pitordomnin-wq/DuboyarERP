import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { UpdateOrganizationDto } from './dto';

const publicSelect = {
  id: true,
  name: true,
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
    const item = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: publicSelect,
    });
    if (!item) throw new NotFoundException();
    return item;
  }

  async update(user: AuthUser, dto: UpdateOrganizationDto) {
    return this.prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        name: dto.name.trim(),
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
  }
}
