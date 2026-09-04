import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import type { AuthUser } from '../auth/auth-user';
import { WarehouseService } from './warehouse.service';
import {
  CreateProductGroupDto,
  CreateStockItemDto,
  CreateStockMovementDto,
  CreateWarehouseCategoryDto,
  CreateWarehouseDto,
  ReorderWarehouseCategoriesDto,
  UpdateProductGroupDto,
  UpdateStockItemDto,
  UpdateWarehouseCategoryDto,
} from './dto';

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

  @Get('categories')
  listCategories(@CurrentUser() user: AuthUser) {
    return this.warehouse.listCategories(user);
  }

  @Post('categories')
  createCategory(@CurrentUser() user: AuthUser, @Body() body: CreateWarehouseCategoryDto) {
    return this.warehouse.createCategory(user, body);
  }

  @Patch('categories/reorder')
  reorderCategories(@CurrentUser() user: AuthUser, @Body() body: ReorderWarehouseCategoriesDto) {
    return this.warehouse.reorderCategories(user, body);
  }

  @Patch('categories/:categoryId')
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param('categoryId') categoryId: string,
    @Body() body: UpdateWarehouseCategoryDto,
  ) {
    return this.warehouse.updateCategory(user, categoryId, body);
  }

  @Delete('categories/:categoryId')
  @HttpCode(204)
  deleteCategory(@CurrentUser() user: AuthUser, @Param('categoryId') categoryId: string) {
    return this.warehouse.deleteCategory(user, categoryId);
  }

  @Get(':id/stock')
  stock(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('categoryId') categoryId?: string,
    @Query('q') q?: string,
  ) {
    return this.warehouse.stock(user, id, categoryId || undefined, q);
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

  @Delete(':id/stock/:productId')
  @HttpCode(204)
  removeItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('productId') productId: string) {
    return this.warehouse.removeItem(user, id, productId);
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

@Controller('product-groups')
@UseGuards(AuthGuard)
export class ProductGroupsController {
  constructor(private readonly warehouse: WarehouseService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.warehouse.listGroups(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateProductGroupDto) {
    return this.warehouse.createGroup(user, body.name, body.keywords ?? []);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.warehouse.getGroup(user, id);
  }

  @Post(':id/products')
  addProducts(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { productIds: string[] },
  ) {
    return this.warehouse.addProductsToGroup(user, id, body.productIds ?? []);
  }

  @Delete(':id/products/:productId')
  @HttpCode(204)
  async removeProduct(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    await this.warehouse.removeProductFromGroup(user, id, productId);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpdateProductGroupDto) {
    return this.warehouse.updateGroup(user, id, body);
  }
}
