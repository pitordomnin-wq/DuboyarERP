import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user';
import type { AuthUser } from '../auth/auth-user';
import { UpdateDealPipelineDto } from './dto';
import { SalesPipelineService } from './sales-pipeline.service';

@Controller('sales/pipeline')
@UseGuards(AuthGuard)
export class SalesPipelineController {
  constructor(private readonly pipeline: SalesPipelineService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.pipeline.list(user);
  }
}

@Controller('admin/sales/pipeline')
@UseGuards(AuthGuard, AdminGuard)
export class SalesPipelineAdminController {
  constructor(private readonly pipeline: SalesPipelineService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.pipeline.list(user);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() body: UpdateDealPipelineDto) {
    return this.pipeline.update(user, body.columns);
  }
}
