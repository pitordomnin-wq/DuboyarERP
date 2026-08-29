import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { TaskBoard } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import type { AuthUser } from '../auth/auth-user';
import { MulterExceptionFilter } from '../mailbox/multer.filter';
import { CreateCommentDto, CreateTaskDto, UpdateTaskDto } from './dto';
import { MAX_FILE_BYTES, MAX_FILES } from './storage';
import { TasksService } from './tasks.service';

const fileUpload = FilesInterceptor('files', MAX_FILES, {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
});

@Controller('tasks')
@UseGuards(AuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('board') board: string) {
    const resolved = board === 'organization' ? TaskBoard.ORGANIZATION : TaskBoard.PERSONAL;
    return this.tasks.list(user, resolved);
  }

  @Get('colleagues')
  colleagues(@CurrentUser() user: AuthUser) {
    return this.tasks.colleagues(user);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.get(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateTaskDto) {
    return this.tasks.create(user, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpdateTaskDto) {
    return this.tasks.update(user, id, body);
  }

  @Post(':id/advance')
  advance(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.advance(user, id);
  }

  @Post(':id/files')
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(fileUpload)
  addFiles(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.tasks.addFiles(user, id, files ?? []);
  }

  @Get(':id/files/:fileId/file')
  file(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('fileId') fileId: string) {
    return this.tasks.file(user, id, fileId);
  }

  @Delete(':id/files/:fileId')
  removeFile(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('fileId') fileId: string) {
    return this.tasks.removeFile(user, id, fileId);
  }

  @Post(':id/comments')
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(fileUpload)
  addComment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: CreateCommentDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.tasks.addComment(user, id, body, files ?? []);
  }

  @Post(':id/comments/:commentId/files')
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(fileUpload)
  addCommentFiles(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.tasks.addFiles(user, id, files ?? [], commentId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.remove(user, id);
  }
}
