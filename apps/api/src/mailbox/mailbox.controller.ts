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
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import type { AuthUser } from '../auth/auth-user';
import { MailboxService } from './mailbox.service';
import { ComposeMailDto, UpdateMailDto } from './dto';
import { MulterExceptionFilter } from './multer.filter';
import { MAX_FILE_BYTES, MAX_FILES } from './storage';

@Controller('mailbox')
@UseGuards(AuthGuard)
export class MailboxController {
  constructor(private readonly mailbox: MailboxService) {}

  @Get('counts')
  counts(@CurrentUser() user: AuthUser) {
    return this.mailbox.counts(user);
  }

  @Get('address-book')
  addressBook(@CurrentUser() user: AuthUser) {
    return this.mailbox.addressBook(user);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('folder') folder?: string) {
    return this.mailbox.list(user, folder ?? 'INBOX');
  }

  @Post()
  compose(@CurrentUser() user: AuthUser, @Body() body: ComposeMailDto) {
    return this.mailbox.compose(user, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mailbox.get(user, id);
  }

  @Post(':id/send')
  sendDraft(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mailbox.sendDraft(user, id);
  }

  @Post(':id/attachments')
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
    }),
  )
  addAttachments(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.mailbox.addAttachments(user, id, files ?? []);
  }

  @Get(':id/attachments/:attachmentId/file')
  file(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.mailbox.file(user, id, attachmentId);
  }

  @Delete(':id/attachments/:attachmentId')
  removeAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.mailbox.removeAttachment(user, id, attachmentId);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpdateMailDto) {
    return this.mailbox.update(user, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mailbox.remove(user, id);
  }
}
