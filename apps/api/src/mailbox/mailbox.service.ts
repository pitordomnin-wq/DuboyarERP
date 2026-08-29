import { createReadStream } from 'fs';
import { BadRequestException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { AccessStatus, MailFolder } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import type { AuthUser } from '../auth/auth-user';
import { ComposeMailDto, UpdateMailDto } from './dto';
import {
  MAX_FILE_BYTES,
  MAX_FILES,
  isAllowedMime,
  isInlineMime,
  mailFilePath,
  removeMailFile,
  resolveMime,
  safeFileName,
  saveMailFile,
} from './storage';

const FOLDERS = Object.values(MailFolder);

const attachmentSelect = { id: true, name: true, mimeType: true, size: true } as const;

const messageSelect = {
  id: true,
  folder: true,
  fromAddress: true,
  fromName: true,
  toAddress: true,
  toName: true,
  subject: true,
  body: true,
  readAt: true,
  createdAt: true,
  attachments: { orderBy: { createdAt: 'asc' as const }, select: attachmentSelect },
};

@Injectable()
export class MailboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async counts(user: AuthUser) {
    const rows = await this.prisma.mailMessage.groupBy({
      by: ['folder'],
      where: { userId: user.id },
      _count: { _all: true },
    });
    const unread = await this.prisma.mailMessage.count({
      where: { userId: user.id, folder: MailFolder.INBOX, readAt: null },
    });
    const byFolder = Object.fromEntries(FOLDERS.map((folder) => [folder, 0])) as Record<MailFolder, number>;
    for (const row of rows) byFolder[row.folder] = row._count._all;
    return { ...byFolder, unread };
  }

  list(user: AuthUser, folder: string) {
    const resolved = FOLDERS.includes(folder as MailFolder) ? (folder as MailFolder) : MailFolder.INBOX;
    return this.prisma.mailMessage.findMany({
      where: { userId: user.id, folder: resolved },
      orderBy: { createdAt: 'desc' },
      select: messageSelect,
    });
  }

  async get(user: AuthUser, id: string) {
    const item = await this.owned(user, id);
    if (!item.readAt && item.folder === MailFolder.INBOX) {
      return this.prisma.mailMessage.update({
        where: { id: item.id },
        data: { readAt: new Date() },
        select: messageSelect,
      });
    }
    return this.toPublic(item);
  }

  async compose(user: AuthUser, dto: ComposeMailDto) {
    const toAddress = (dto.toAddress ?? '').trim().toLowerCase();
    const toName = (dto.toName ?? '').trim() || toAddress;
    const subject = dto.subject.trim() || '(без темы)';
    const body = dto.body.trim();
    if (!dto.draft && !toAddress) throw new BadRequestException({ error: 'to_required' });
    if (!body && !dto.draft) throw new BadRequestException({ error: 'body_required' });

    if (dto.draft) {
      return this.prisma.mailMessage.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          folder: MailFolder.DRAFTS,
          fromAddress: user.email,
          fromName: user.name,
          toAddress,
          toName,
          subject: subject || '(без темы)',
          body,
        },
        select: messageSelect,
      });
    }

    return this.dispatch(user, { toAddress, toName, subject, body });
  }

  async sendDraft(user: AuthUser, id: string) {
    const draft = await this.owned(user, id);
    if (draft.folder !== MailFolder.DRAFTS) {
      throw new BadRequestException({ error: 'not_draft' });
    }
    if (!draft.toAddress) {
      throw new BadRequestException({ error: 'draft_incomplete' });
    }
    if (!draft.body.trim() && draft.attachments.length === 0) {
      throw new BadRequestException({ error: 'draft_incomplete' });
    }
    const sent = await this.dispatch(
      user,
      {
        toAddress: draft.toAddress,
        toName: draft.toName,
        subject: draft.subject,
        body: draft.body,
      },
      draft.id,
    );
    await this.prisma.mailMessage.delete({ where: { id: draft.id } });
    await this.purgeOrphans(draft.attachments.map((item) => item.storageKey));
    return sent;
  }

  async update(user: AuthUser, id: string, dto: UpdateMailDto) {
    const item = await this.owned(user, id);
    if (item.folder === MailFolder.DRAFTS && (dto.toAddress || dto.subject !== undefined || dto.body !== undefined)) {
      return this.prisma.mailMessage.update({
        where: { id: item.id },
        data: {
          toAddress: dto.toAddress?.trim().toLowerCase() ?? item.toAddress,
          toName: dto.toName?.trim() ?? item.toName,
          subject: dto.subject ?? item.subject,
          body: dto.body ?? item.body,
          folder: dto.folder ?? item.folder,
        },
        select: messageSelect,
      });
    }
    if (!dto.folder) return this.toPublic(item);
    return this.prisma.mailMessage.update({
      where: { id: item.id },
      data: { folder: dto.folder },
      select: messageSelect,
    });
  }

  async remove(user: AuthUser, id: string) {
    const item = await this.owned(user, id);
    if (item.folder !== MailFolder.DRAFTS && item.folder !== MailFolder.SPAM) {
      throw new BadRequestException({ error: 'cannot_delete' });
    }
    const keys = item.attachments.map((row) => row.storageKey);
    await this.prisma.mailMessage.delete({ where: { id: item.id } });
    await this.purgeOrphans(keys);
  }

  async addAttachments(user: AuthUser, id: string, files: Express.Multer.File[]) {
    const item = await this.owned(user, id);
    if (item.folder !== MailFolder.DRAFTS) {
      throw new BadRequestException({ error: 'not_draft' });
    }
    if (!files?.length) throw new BadRequestException({ error: 'files_required' });
    if (item.attachments.length + files.length > MAX_FILES) {
      throw new BadRequestException({ error: 'too_many_files' });
    }
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) throw new BadRequestException({ error: 'file_too_large' });
      const mime = resolveMime(file.originalname, file.mimetype);
      if (!isAllowedMime(mime)) throw new BadRequestException({ error: 'file_type' });
    }
    for (const file of files) {
      const mime = resolveMime(file.originalname, file.mimetype);
      const storageKey = await saveMailFile(user.organizationId, file.originalname, file.buffer);
      await this.prisma.mailAttachment.create({
        data: {
          messageId: item.id,
          name: safeFileName(file.originalname),
          mimeType: mime,
          size: file.size,
          storageKey,
        },
      });
    }
    return this.toPublic(await this.owned(user, id));
  }

  async removeAttachment(user: AuthUser, id: string, attachmentId: string) {
    const item = await this.owned(user, id);
    if (item.folder !== MailFolder.DRAFTS) {
      throw new BadRequestException({ error: 'not_draft' });
    }
    const attachment = item.attachments.find((row) => row.id === attachmentId);
    if (!attachment) throw new NotFoundException();
    const full = await this.prisma.mailAttachment.findUnique({ where: { id: attachmentId } });
    await this.prisma.mailAttachment.delete({ where: { id: attachmentId } });
    if (full) await this.purgeOrphans([full.storageKey]);
    return this.toPublic(await this.owned(user, id));
  }

  async file(user: AuthUser, id: string, attachmentId: string) {
    const item = await this.owned(user, id);
    const attachment = await this.prisma.mailAttachment.findFirst({
      where: { id: attachmentId, messageId: item.id },
    });
    if (!attachment) throw new NotFoundException();
    const inline = isInlineMime(attachment.mimeType);
    const encoded = encodeURIComponent(attachment.name);
    return new StreamableFile(createReadStream(mailFilePath(attachment.storageKey)), {
      type: attachment.mimeType,
      disposition: `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encoded}`,
    });
  }

  async addressBook(user: AuthUser) {
    const [employees, counterparties] = await Promise.all([
      this.prisma.user.findMany({
        where: { organizationId: user.organizationId, status: AccessStatus.ACTIVE },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, email: true },
      }),
      this.prisma.counterparty.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, email: true, contactName: true },
      }),
    ]);
    return { employees, counterparties };
  }

  private async dispatch(
    user: AuthUser,
    input: { toAddress: string; toName: string; subject: string; body: string },
    sourceId?: string,
  ) {
    const signature = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { mailSignature: true },
    });
    const text = signature?.mailSignature?.trim()
      ? `${input.body.trim()}\n\n${signature.mailSignature.trim()}`
      : input.body.trim();

    const source = sourceId
      ? await this.prisma.mailAttachment.findMany({ where: { messageId: sourceId } })
      : [];

    await this.mail.sendMessage({
      from: user.email,
      fromName: user.name,
      to: input.toAddress,
      subject: input.subject,
      text,
      attachments: source.map((row) => ({
        filename: row.name,
        path: mailFilePath(row.storageKey),
        contentType: row.mimeType,
      })),
    });

    const sent = await this.prisma.mailMessage.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        folder: MailFolder.SENT,
        fromAddress: user.email,
        fromName: user.name,
        toAddress: input.toAddress,
        toName: input.toName,
        subject: input.subject,
        body: text,
        readAt: new Date(),
        attachments: {
          create: source.map((row) => ({
            name: row.name,
            mimeType: row.mimeType,
            size: row.size,
            storageKey: row.storageKey,
          })),
        },
      },
      select: messageSelect,
    });

    const recipient = await this.prisma.user.findFirst({
      where: {
        organizationId: user.organizationId,
        email: input.toAddress,
        status: AccessStatus.ACTIVE,
        id: { not: user.id },
      },
    });
    if (recipient) {
      await this.prisma.mailMessage.create({
        data: {
          organizationId: user.organizationId,
          userId: recipient.id,
          folder: MailFolder.INBOX,
          fromAddress: user.email,
          fromName: user.name,
          toAddress: recipient.email,
          toName: recipient.name,
          subject: input.subject,
          body: text,
          attachments: {
            create: source.map((row) => ({
              name: row.name,
              mimeType: row.mimeType,
              size: row.size,
              storageKey: row.storageKey,
            })),
          },
        },
      });
    }

    return sent;
  }

  private toPublic<T extends { attachments: { id: string; name: string; mimeType: string; size: number; storageKey?: string }[] }>(
    item: T,
  ) {
    return {
      ...item,
      attachments: item.attachments.map((row) => ({
        id: row.id,
        name: row.name,
        mimeType: row.mimeType,
        size: row.size,
      })),
    };
  }

  private async owned(user: AuthUser, id: string) {
    const item = await this.prisma.mailMessage.findFirst({
      where: { id, userId: user.id },
      select: { ...messageSelect, attachments: { orderBy: { createdAt: 'asc' }, select: { ...attachmentSelect, storageKey: true } } },
    });
    if (!item) throw new NotFoundException();
    return item;
  }

  private async purgeOrphans(keys: string[]) {
    for (const key of [...new Set(keys)]) {
      const used = await this.prisma.mailAttachment.count({ where: { storageKey: key } });
      if (used === 0) await removeMailFile(key);
    }
  }
}
