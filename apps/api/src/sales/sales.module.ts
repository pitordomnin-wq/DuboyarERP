import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SalesController } from './sales.controller';
import { SalesPipelineAdminController, SalesPipelineController } from './sales-pipeline.controller';
import { SalesPipelineService } from './sales-pipeline.service';
import { SalesService } from './sales.service';

@Module({
  imports: [AuthModule],
  controllers: [SalesController, SalesPipelineController, SalesPipelineAdminController],
  providers: [SalesService, SalesPipelineService],
  exports: [SalesPipelineService],
})
export class SalesModule {}
