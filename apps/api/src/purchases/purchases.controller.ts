import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import type { AuthUser } from '../auth/auth-user';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDocumentDto, CreatePurchaseDto } from './dto';

@Controller('purchases')
@UseGuards(AuthGuard)
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    return this.purchases.list(user, q);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreatePurchaseDto) {
    return this.purchases.create(user, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.purchases.get(user, id);
  }

  @Post(':id/post')
  post(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.purchases.post(user, id);
  }

  @Post(':id/documents')
  addDocument(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: CreatePurchaseDocumentDto) {
    return this.purchases.addDocument(user, id, body);
  }

  @Get(':id/documents/:documentId/file')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async file(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const html = await this.purchases.documentFile(user, id, documentId);
    res.send(html);
  }

  @Delete(':id/documents/:documentId')
  @HttpCode(204)
  removeDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.purchases.removeDocument(user, id, documentId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.purchases.remove(user, id);
  }
}
