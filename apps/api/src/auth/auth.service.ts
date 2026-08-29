import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessStatus, LicenseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { PAGE_KEYS } from '../access/pages';
import {
  isAllowedAvatarMime,
  MAX_AVATAR_BYTES,
  removeAvatarFile,
  resolveAvatarMime,
  saveAvatar,
} from './avatar-storage';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_COOKIE = 'faverum_session';
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_EMAIL = 5;
const RATE_LIMIT_IP = 20;

type RateBucket = { count: number; resetAt: number };

const userInclude = { organization: true, accessRole: true } as const;

@Injectable()
export class AuthService {
  private readonly emailHits = new Map<string, RateBucket>();
  private readonly ipHits = new Map<string, RateBucket>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  cookieName() {
    return SESSION_COOKIE;
  }

  sessionCookieOptions() {
    const days = Number(this.config.get('SESSION_DAYS') ?? 14);
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.config.get('COOKIE_SECURE') === 'true',
      path: '/',
      maxAge: days * 24 * 60 * 60 * 1000,
    };
  }

  async requestOtp(emailRaw: string, ip: string) {
    const email = this.normalizeEmail(emailRaw);
    if (!this.tryRateLimit(email, ip)) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: userInclude,
    });

    // Локальный stub. Источник права — faverum_web_control, не эта БД.
    const canReceive =
      user &&
      user.status === AccessStatus.ACTIVE &&
      user.organization.licenseStatus === LicenseStatus.ACTIVE;

    if (!canReceive || !user) {
      return;
    }

    await this.prisma.otpChallenge.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = this.issueCode(user.email);
    const challenge = await this.prisma.otpChallenge.create({
      data: {
        userId: user.id,
        codeHash: this.hashOtp('pending', code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { codeHash: this.hashOtp(challenge.id, code) },
    });

    if (!this.useFixedDevCode(user.email)) {
      await this.mail.sendLoginCode(user.email, code);
    }
  }

  async verifyOtp(emailRaw: string, code: string, ip: string) {
    const email = this.normalizeEmail(emailRaw);
    const withinLimit = this.tryRateLimit(`verify:${email}`, ip);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: userInclude,
    });

    const challenge = user
      ? await this.prisma.otpChallenge.findFirst({
          where: {
            userId: user.id,
            consumedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    const dummyHash = this.hashOtp('unknown', code);
    const expected = Buffer.from(challenge?.codeHash ?? dummyHash);
    const actual = Buffer.from(
      challenge ? this.hashOtp(challenge.id, code) : dummyHash,
    );

    const hashesMatch =
      expected.length === actual.length && timingSafeEqual(expected, actual);

    const allowed =
      withinLimit &&
      Boolean(user) &&
      user?.status === AccessStatus.ACTIVE &&
      user?.organization.licenseStatus === LicenseStatus.ACTIVE &&
      Boolean(challenge) &&
      hashesMatch;

    if (challenge && !hashesMatch) {
      const attempts = challenge.attempts + 1;
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts,
          consumedAt: attempts >= OTP_MAX_ATTEMPTS ? new Date() : undefined,
        },
      });
    }

    if (!allowed || !user || !challenge) {
      throw new UnauthorizedException({ error: 'invalid_code' });
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    const days = Number(this.config.get('SESSION_DAYS') ?? 14);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      },
    });

    return { token, user: this.publicUser(user) };
  }

  async me(token?: string) {
    const session = await this.findSession(token);
    if (!session) {
      throw new UnauthorizedException();
    }
    return this.publicUser(session.user);
  }

  async logout(token?: string) {
    if (!token) return;
    await this.prisma.session.deleteMany({
      where: { tokenHash: this.hashToken(token) },
    });
  }

  async updateProfile(token: string | undefined, dto: { mailSignature?: string }) {
    const session = await this.findSession(token);
    if (!session) throw new UnauthorizedException();
    const user = await this.prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(dto.mailSignature !== undefined ? { mailSignature: dto.mailSignature } : {}),
      },
      include: userInclude,
    });
    return this.publicUser(user);
  }

  async setAvatar(token: string | undefined, file?: Express.Multer.File) {
    const session = await this.findSession(token);
    if (!session) throw new UnauthorizedException();
    if (!file?.buffer?.length) throw new BadRequestException({ error: 'files_required' });
    if (file.size > MAX_AVATAR_BYTES) throw new BadRequestException({ error: 'file_too_large' });
    const mime = resolveAvatarMime(file.originalname, file.mimetype);
    if (!isAllowedAvatarMime(mime)) throw new BadRequestException({ error: 'file_type' });
    const previous = session.user.avatarKey;
    const key = await saveAvatar(session.user.id, mime, file.buffer);
    if (previous && previous !== key) await removeAvatarFile(previous);
    const user = await this.prisma.user.update({
      where: { id: session.user.id },
      data: { avatarKey: key, avatarMime: mime },
      include: userInclude,
    });
    return this.publicUser(user);
  }

  async removeAvatar(token: string | undefined) {
    const session = await this.findSession(token);
    if (!session) throw new UnauthorizedException();
    if (session.user.avatarKey) await removeAvatarFile(session.user.avatarKey);
    const user = await this.prisma.user.update({
      where: { id: session.user.id },
      data: { avatarKey: null, avatarMime: null },
      include: userInclude,
    });
    return this.publicUser(user);
  }

  private async findSession(token?: string) {
    if (!token) return null;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { user: { include: userInclude } },
    });
    if (!session || session.expiresAt < new Date()) {
      return null;
    }
    if (
      session.user.status !== AccessStatus.ACTIVE ||
      session.user.organization.licenseStatus !== LicenseStatus.ACTIVE
    ) {
      await this.prisma.session.delete({ where: { id: session.id } });
      return null;
    }
    return session;
  }

  private publicUser(user: {
    id: string;
    email: string;
    name: string;
    jobTitle?: string | null;
    role: string;
    roleId: string;
    mailSignature?: string | null;
    avatarKey?: string | null;
    updatedAt?: Date;
    accessRole?: { pages: string[] } | null;
    organization: { id: string; name: string };
  }) {
    const pages =
      user.accessRole?.pages ??
      (user.role === 'ADMIN' ? [...PAGE_KEYS] : PAGE_KEYS.filter((page) => page !== 'admin'));
    const hasAvatar = Boolean(user.avatarKey);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      jobTitle: user.jobTitle ?? null,
      role: user.role,
      roleId: user.roleId,
      pages,
      mailSignature: user.mailSignature ?? null,
      hasAvatar,
      avatarAt: hasAvatar && user.updatedAt ? user.updatedAt.toISOString() : null,
      organizationId: user.organization.id,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
      },
    };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private issueCode(email: string) {
    if (this.useFixedDevCode(email)) {
      return process.env.OTP_DEV_CODE || '111111';
    }
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private useFixedDevCode(email: string) {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    return email.endsWith('@faverum.local');
  }

  private hashOtp(challengeId: string, code: string) {
    const pepper = this.config.get<string>('OTP_PEPPER') ?? 'dev-pepper';
    return createHmac('sha256', pepper).update(`${challengeId}:${code}`).digest('hex');
  }

  private hashToken(token: string) {
    const pepper = this.config.get<string>('OTP_PEPPER') ?? 'dev-pepper';
    return createHmac('sha256', pepper).update(`session:${token}`).digest('hex');
  }

  private tryRateLimit(email: string, ip: string) {
    const emailOk = this.touch(this.emailHits, email, RATE_LIMIT_EMAIL);
    const ipOk = this.touch(this.ipHits, ip, RATE_LIMIT_IP);
    return emailOk && ipOk;
  }

  private touch(store: Map<string, RateBucket>, key: string, max: number) {
    const now = Date.now();
    const current = store.get(key);
    if (!current || current.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
      return true;
    }
    if (current.count >= max) {
      return false;
    }
    current.count += 1;
    return true;
  }
}
