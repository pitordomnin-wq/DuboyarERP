import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import type { AuthUser } from '../auth/auth-user';
import { SalesService } from './sales.service';
import { CreateDealDto, CreateDealMessageDto, ListDealsQueryDto, SendDocumentDto, SendSmsDto, UpdateDealStatusDto } from './dto';

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

  @Get(':id/documents/:documentId/file')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async file(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const doc = await this.sales.documentFile(user, id, documentId);
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
