import { createReadStream } from 'fs';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { AccessStatus, Prisma, TaskBoard, TaskStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { isAllowedStatus, nextStatus } from './columns';
import { CreateCommentDto, CreateTaskDto, UpdateTaskDto } from './dto';
import {
  MAX_FILE_BYTES,
  MAX_FILES,
  isAllowedMime,
  isInlineMime,
  removeTaskFile,
  resolveMime,
  saveTaskFile,
  taskFilePath,
  safeFileName,
} from './storage';

const person = { select: { id: true, name: true, avatarKey: true, updatedAt: true } } as const;

function toPerson(user: { id: string; name: string; avatarKey: string | null; updatedAt: Date }) {
  const hasAvatar = Boolean(user.avatarKey);
  return {
    id: user.id,
    name: user.name,
    hasAvatar,
    avatarAt: hasAvatar ? user.updatedAt.toISOString() : null,
  };
}

const listInclude = {
  createdBy: person,
  assignees: {
    include: { user: person },
    orderBy: { createdAt: 'asc' as const },
  },
  _count: { select: { comments: true, files: true } },
};

const detailInclude = {
  ...listInclude,
  files: {
    where: { commentId: null },
    orderBy: { createdAt: 'asc' as const },
  },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      author: person,
      files: { orderBy: { createdAt: 'asc' as const } },
    },
  },
};

type TaskListRecord = Prisma.TaskGetPayload<{ include: typeof listInclude }>;
type TaskDetailRecord = Prisma.TaskGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  colleagues(user: AuthUser) {
    return this.prisma.user.findMany({
      where: { organizationId: user.organizationId, status: AccessStatus.ACTIVE },
      orderBy: { name: 'asc' },
      select: person.select,
    }).then((people) => people.map(toPerson));
  }

  async list(user: AuthUser, board: TaskBoard) {
    const tasks = await this.prisma.task.findMany({
      where: this.scope(user, board),
      orderBy: [{ status: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
      include: listInclude,
    });
    return tasks.map((task) => this.toList(task, user));
  }

  async get(user: AuthUser, id: string) {
    return this.toDetail(await this.loadDetail(user, id), user);
  }

  async create(user: AuthUser, dto: CreateTaskDto) {
    const last = await this.prisma.task.findFirst({
      where: {
        ...this.scope(user, dto.board),
        status: TaskStatus.NEW,
      },
      orderBy: { position: 'desc' },
    });

    const task = await this.prisma.task.create({
      data: {
        organizationId: user.organizationId,
        board: dto.board,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        status: TaskStatus.NEW,
        position: (last?.position ?? 0) + 1000,
        ownerId: dto.board === TaskBoard.PERSONAL ? user.id : null,
        createdById: user.id,
      },
    });

    await this.replaceAssignees(
      user,
      task.id,
      dto.board === TaskBoard.PERSONAL ? [] : (dto.assigneeIds ?? []),
    );
    return this.toList(await this.loadList(user, task.id), user);
  }

  async update(user: AuthUser, id: string, dto: UpdateTaskDto) {
    const task = await this.loadList(user, id);

    if (dto.status && !isAllowedStatus(task.board, dto.status)) {
      throw new BadRequestException({ error: 'invalid_status' });
    }

    await this.prisma.task.update({
      where: { id: task.id },
      data: {
        title: dto.title?.trim(),
        description: dto.description === undefined ? undefined : dto.description.trim() || null,
        status: dto.status,
        position: dto.position,
      },
    });

    return this.toList(await this.loadList(user, id), user);
  }

  async advance(user: AuthUser, id: string) {
    const task = await this.loadList(user, id);
    const next = nextStatus(task.board, task.status);
    if (!next) {
      return this.toList(task, user);
    }

    const last = await this.prisma.task.findFirst({
      where: {
        ...this.scope(user, task.board),
        status: next,
      },
      orderBy: { position: 'desc' },
    });

    await this.prisma.task.update({
      where: { id: task.id },
      data: {
        status: next,
        position: (last?.position ?? 0) + 1000,
      },
    });

    return this.toList(await this.loadList(user, id), user);
  }

  async addComment(user: AuthUser, id: string, dto: CreateCommentDto, files: Express.Multer.File[] = []) {
    const task = await this.loadList(user, id);
    const body = dto.body?.trim() ?? '';
    if (!body && !files.length) {
      throw new BadRequestException({ error: 'comment_required' });
    }
    this.assertFiles(files, 0);

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId: task.id,
        authorId: user.id,
        body,
      },
    });

    if (files.length) {
      await this.storeFiles(user.organizationId, task.id, comment.id, files);
    }

    return this.get(user, id);
  }

  async addFiles(user: AuthUser, id: string, files: Express.Multer.File[], commentId?: string) {
    const task = await this.loadList(user, id);
    if (!files?.length) throw new BadRequestException({ error: 'files_required' });

    if (commentId) {
      const comment = await this.prisma.taskComment.findFirst({
        where: { id: commentId, taskId: task.id },
      });
      if (!comment) throw new NotFoundException();
      if (comment.authorId !== user.id && !this.isAdmin(user) && task.createdById !== user.id) {
        throw new ForbiddenException({ error: 'cannot_attach' });
      }
    } else {
      if (task.createdById !== user.id) {
        throw new ForbiddenException({ error: 'cannot_attach' });
      }
      if (task._count.comments > 0) {
        throw new BadRequestException({ error: 'files_on_create_only' });
      }
    }

    const existing = await this.prisma.taskFile.count({
      where: commentId ? { commentId } : { taskId: task.id, commentId: null },
    });
    this.assertFiles(files, existing);
    await this.storeFiles(user.organizationId, task.id, commentId ?? null, files);
    return this.get(user, id);
  }

  async file(user: AuthUser, id: string, fileId: string) {
    const task = await this.loadList(user, id);
    const attachment = await this.prisma.taskFile.findFirst({
      where: { id: fileId, taskId: task.id },
    });
    if (!attachment) throw new NotFoundException();
    const inline = isInlineMime(attachment.mimeType);
    const encoded = encodeURIComponent(attachment.name);
    return new StreamableFile(createReadStream(taskFilePath(attachment.storageKey)), {
      type: attachment.mimeType,
      disposition: `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encoded}`,
    });
  }

  async removeFile(user: AuthUser, id: string, fileId: string) {
    const task = await this.loadList(user, id);
    const attachment = await this.prisma.taskFile.findFirst({
      where: { id: fileId, taskId: task.id },
      include: { comment: { select: { authorId: true } } },
    });
    if (!attachment) throw new NotFoundException();
    if (!attachment.commentId) {
      throw new ForbiddenException({ error: 'cannot_delete' });
    }
    const commentAuthor = attachment.comment?.authorId;
    if (
      task.createdById !== user.id &&
      !this.isAdmin(user) &&
      commentAuthor !== user.id
    ) {
      throw new ForbiddenException({ error: 'cannot_delete' });
    }
    await this.prisma.taskFile.delete({ where: { id: attachment.id } });
    await removeTaskFile(attachment.storageKey);
    return this.get(user, id);
  }

  async remove(user: AuthUser, id: string) {
    const task = await this.loadList(user, id);
    if (task.createdById !== user.id && !this.isAdmin(user)) {
      throw new ForbiddenException({ error: 'cannot_delete' });
    }
    const files = await this.prisma.taskFile.findMany({
      where: { taskId: task.id },
      select: { storageKey: true },
    });
    await this.prisma.task.delete({ where: { id: task.id } });
    await Promise.all(files.map((row) => removeTaskFile(row.storageKey)));
  }

  private isAdmin(user: AuthUser) {
    return user.role === UserRole.ADMIN;
  }

  private assertFiles(files: Express.Multer.File[], existing: number) {
    if (existing + files.length > MAX_FILES) {
      throw new BadRequestException({ error: 'too_many_files' });
    }
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) throw new BadRequestException({ error: 'file_too_large' });
      const mime = resolveMime(file.originalname, file.mimetype);
      if (!isAllowedMime(mime)) throw new BadRequestException({ error: 'file_type' });
    }
  }

  private async storeFiles(
    organizationId: string,
    taskId: string,
    commentId: string | null,
    files: Express.Multer.File[],
  ) {
    for (const file of files) {
      const mime = resolveMime(file.originalname, file.mimetype);
      const storageKey = await saveTaskFile(organizationId, file.originalname, file.buffer);
      await this.prisma.taskFile.create({
        data: {
          taskId,
          commentId,
          name: safeFileName(file.originalname),
          mimeType: mime,
          size: file.size,
          storageKey,
        },
      });
    }
  }

  private scope(user: AuthUser, board: TaskBoard) {
    if (board === TaskBoard.PERSONAL) {
      return {
        organizationId: user.organizationId,
        board,
        ownerId: user.id,
      };
    }
    return {
      organizationId: user.organizationId,
      board,
    };
  }

  private async loadList(user: AuthUser, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: listInclude,
    });
    return this.ensureOwned(user, task);
  }

  private async loadDetail(user: AuthUser, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: detailInclude,
    });
    return this.ensureOwned(user, task);
  }

  private ensureOwned<T extends { organizationId: string; board: TaskBoard; ownerId: string | null }>(
    user: AuthUser,
    task: T | null,
  ) {
    if (!task || task.organizationId !== user.organizationId) {
      throw new NotFoundException();
    }
    if (task.board === TaskBoard.PERSONAL && task.ownerId !== user.id) {
      throw new ForbiddenException();
    }
    return task;
  }

  private async replaceAssignees(user: AuthUser, taskId: string, ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length) {
      const people = await this.prisma.user.findMany({
        where: {
          id: { in: unique },
          organizationId: user.organizationId,
          status: AccessStatus.ACTIVE,
        },
        select: { id: true },
      });
      if (people.length !== unique.length) {
        throw new BadRequestException({ error: 'invalid_assignee' });
      }
    }

    await this.prisma.$transaction([
      this.prisma.taskAssignee.deleteMany({ where: { taskId } }),
      ...(unique.length
        ? [
            this.prisma.taskAssignee.createMany({
              data: unique.map((userId) => ({ taskId, userId })),
            }),
          ]
        : []),
    ]);
  }

  private toList(task: TaskListRecord, user: AuthUser) {
    const { assignees, _count, createdBy, ...rest } = task;
    return {
      ...rest,
      createdBy: toPerson(createdBy),
      assignees: assignees.map((row) => toPerson(row.user)),
      commentCount: _count.comments,
      fileCount: _count.files,
      canDelete: rest.createdById === user.id || this.isAdmin(user),
    };
  }

  private toDetail(task: TaskDetailRecord, user: AuthUser) {
    const { files, comments, ...list } = task;
    return {
      ...this.toList(list, user),
      files: files.map((file) => this.toFile(file)),
      comments: comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        author: toPerson(comment.author),
        files: comment.files.map((file) => this.toFile(file)),
      })),
    };
  }

  private toFile(file: {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    commentId: string | null;
    createdAt: Date;
  }) {
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      commentId: file.commentId,
      createdAt: file.createdAt,
    };
  }
}
