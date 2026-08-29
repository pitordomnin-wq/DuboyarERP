import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { UpsertCounterpartyDto } from './dto';

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

@Injectable()
export class CounterpartiesService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser, query?: string) {
    const search = query?.trim();
    return this.prisma.counterparty.findMany({
      where: {
        organizationId: user.organizationId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { legalName: { contains: search, mode: 'insensitive' } },
                { inn: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async get(user: AuthUser, id: string) {
    const item = await this.prisma.counterparty.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!item) throw new NotFoundException();
    return item;
  }

  async create(user: AuthUser, dto: UpsertCounterpartyDto) {
    try {
      return await this.prisma.counterparty.create({
        data: this.toData(user.organizationId, dto),
      });
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async update(user: AuthUser, id: string, dto: UpsertCounterpartyDto) {
    await this.get(user, id);
    try {
      return await this.prisma.counterparty.update({
        where: { id },
        data: this.toData(user.organizationId, dto),
      });
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async remove(user: AuthUser, id: string) {
    await this.get(user, id);
    await this.prisma.counterparty.delete({ where: { id } });
  }

  private toData(organizationId: string, dto: UpsertCounterpartyDto) {
    return {
      organizationId,
      name: dto.name.trim(),
      legalName: dto.legalName.trim(),
      inn: dto.inn.trim(),
      kpp: emptyToNull(dto.kpp),
      ogrn: emptyToNull(dto.ogrn),
      legalAddress: dto.legalAddress.trim(),
      actualAddress: emptyToNull(dto.actualAddress),
      bankName: emptyToNull(dto.bankName),
      bik: emptyToNull(dto.bik),
      checkingAccount: emptyToNull(dto.checkingAccount),
      correspondentAccount: emptyToNull(dto.correspondentAccount),
      email: dto.email.trim().toLowerCase(),
      phone: emptyToNull(dto.phone),
      telegram: emptyToNull(dto.telegram?.replace(/^@/, '')),
      contactName: emptyToNull(dto.contactName),
      notes: emptyToNull(dto.notes),
    };
  }

  private rethrowUnique(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({ error: 'inn_taken' });
    }
    throw error;
  }
}
