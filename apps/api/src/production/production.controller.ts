import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user';
import type { AuthUser } from '../auth/auth-user';
import { ProductionService } from './production.service';
import { LkpNormsService } from './lkp-norms.service';
import {
  CreateProductionJobDto,
  ImportTechCardDto,
  UpsertLkpNormsDto,
  UpsertProductionTypeDto,
} from './dto';

@Controller('production')
@UseGuards(AuthGuard)
export class ProductionController {
  constructor(
    private readonly production: ProductionService,
    private readonly lkpNorms: LkpNormsService,
  ) {}

  @Get('types')
  listTypes(@CurrentUser() user: AuthUser) {
    return this.production.listTypes(user);
  }

  @Post('types')
  @UseGuards(AdminGuard)
  createType(@CurrentUser() user: AuthUser, @Body() body: UpsertProductionTypeDto) {
    return this.production.createType(user, body);
  }

  @Post('types/import')
  @UseGuards(AdminGuard)
  importTechCard(@CurrentUser() user: AuthUser, @Body() body: ImportTechCardDto) {
    return this.production.importTechCard(user, body);
  }

  @Get('types/:id')
  getType(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.production.getType(user, id);
  }

  @Patch('types/:id')
  @UseGuards(AdminGuard)
  updateType(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpsertProductionTypeDto) {
    return this.production.updateType(user, id, body);
  }

  @Delete('types/:id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  removeType(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.production.removeType(user, id);
  }

  @Get('lkp-norms')
  listLkpNorms(@CurrentUser() user: AuthUser) {
    return this.lkpNorms.list(user);
  }

  @Put('lkp-norms')
  @UseGuards(AdminGuard)
  upsertLkpNorms(@CurrentUser() user: AuthUser, @Body() body: UpsertLkpNormsDto) {
    return this.lkpNorms.upsertAll(user, body.items);
  }

  @Get('jobs')
  listJobs(@CurrentUser() user: AuthUser, @Query('typeId') typeId?: string, @Query('dealId') dealId?: string) {
    return this.production.listJobs(user, typeId, dealId);
  }

  @Post('jobs')
  createJob(@CurrentUser() user: AuthUser, @Body() body: CreateProductionJobDto) {
    return this.production.createJob(user, body);
  }

  @Get('jobs/:id')
  getJob(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.production.getJob(user, id);
  }

  @Post('jobs/:id/start')
  startJob(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.production.startJob(user, id);
  }

  @Post('jobs/:id/complete')
  completeJob(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.production.completeJob(user, id);
  }
}
