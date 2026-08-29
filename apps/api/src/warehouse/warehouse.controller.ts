import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ProductKind } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import type { AuthUser } from '../auth/auth-user';
import { WarehouseService } from './warehouse.service';
import { CreateStockItemDto, CreateStockMovementDto, CreateWarehouseDto, UpdateStockItemDto } from './dto';

@Controller('warehouses')
@UseGuards(AuthGuard)
export class WarehouseController {
  constructor(private readonly warehouse: WarehouseService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.warehouse.listWarehouses(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateWarehouseDto) {
    return this.warehouse.createWarehouse(user, body);
  }

  @Get(':id/stock')
  stock(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('kind') kind?: string,
    @Query('q') q?: string,
  ) {
    const allowed = Object.values(ProductKind) as string[];
    return this.warehouse.stock(user, id, kind && allowed.includes(kind) ? (kind as ProductKind) : undefined, q);
  }

  @Get(':id/stock/:productId')
  item(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('productId') productId: string) {
    return this.warehouse.item(user, id, productId);
  }

  @Patch(':id/stock/:productId')
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() body: UpdateStockItemDto,
  ) {
    return this.warehouse.updateItem(user, id, productId, body);
  }

  @Post(':id/items')
  createItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: CreateStockItemDto) {
    return this.warehouse.createItem(user, id, body);
  }

  @Post(':id/movements')
  move(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: CreateStockMovementDto) {
    return this.warehouse.move(user, id, body);
  }
}
