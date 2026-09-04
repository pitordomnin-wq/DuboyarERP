import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import type { AuthUser } from '../auth/auth-user';
import { SalesService } from './sales.service';
import {
  CreateDealDto,
  CreateDealMessageDto,
  CreateUpdDto,
  ListDealsQueryDto,
  SendDocumentDto,
  SendSmsDto,
  ShipDealDto,
  UpdateDealStatusDto,
} from './dto';

@Controller('deals')
@UseGuards(AuthGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListDealsQueryDto) {
    return this.sales.list(user, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateDealDto) {
    return this.sales.create(user, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sales.get(user, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sales.remove(user, id);
  }

  @Patch(':id/status')
  updateStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpdateDealStatusDto) {
    return this.sales.updateStatus(user, id, body);
  }

  @Post(':id/ship')
  ship(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: ShipDealDto) {
    return this.sales.ship(user, id, body);
  }

  @Post(':id/messages')
  addMessage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: CreateDealMessageDto) {
    return this.sales.addMessage(user, id, body);
  }

  @Post(':id/phone/call')
  startCall(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sales.startCall(user, id);
  }

  @Post(':id/phone/sms')
  sendSms(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: SendSmsDto) {
    return this.sales.sendSms(user, id, body);
  }

  @Post(':id/documents/invoice')
  createInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sales.createInvoice(user, id);
  }

  @Post(':id/documents/upd')
  createUpd(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: CreateUpdDto) {
    return this.sales.createUpd(user, id, body);
  }

  @Get(':id/documents/:documentId/file')
  async file(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Query('preview') preview: string | undefined,
    @Res() res: Response,
  ) {
    const doc = await this.sales.documentFile(user, id, documentId, {
      preview: preview === '1' || preview === 'true',
    });
    if (doc.kind === 'file') {
      const encoded = encodeURIComponent(doc.utfName);
      res.setHeader('Content-Type', doc.mimeType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${doc.asciiName}"; filename*=UTF-8''${encoded}`,
      );
      res.sendFile(doc.path);
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(doc.html);
  }

  @Post(':id/documents/:documentId/send')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Body() body: SendDocumentDto,
  ) {
    return this.sales.sendDocument(user, id, documentId, body);
  }

  @Delete(':id/documents/:documentId')
  removeDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.sales.removeDocument(user, id, documentId);
  }
}
