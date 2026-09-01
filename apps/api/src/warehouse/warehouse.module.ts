import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProductGroupsController, WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';

@Module({
  imports: [AuthModule],
  controllers: [WarehouseController, ProductGroupsController],
  providers: [WarehouseService],
  exports: [WarehouseService],
})
export class WarehouseModule {}
