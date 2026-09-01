import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProductKind, StockMovementType } from '@prisma/client';

const emptyToUndefined = Transform(({ value }: { value: unknown }) =>
  value === '' || value === null ? undefined : value,
);

export class CreateWarehouseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}

export class CreateWarehouseCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

export class UpdateWarehouseCategoryDto {
  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  position?: number;
}

export class ReorderWarehouseCategoriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids!: string[];
}

export class CreateStockItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  sku!: string;

  @IsEnum(ProductKind)
  kind!: ProductKind;

  @IsString()
  @MinLength(1)
  categoryId!: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  groupId?: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MaxLength(80)
  groupName?: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
}

export class UpdateStockItemDto {
  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  name?: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  sku?: string;

  @emptyToUndefined
  @IsOptional()
  @IsEnum(ProductKind)
  kind?: ProductKind;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  categoryId?: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  groupId?: string | null;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MaxLength(80)
  groupName?: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
}

export class CreateStockMovementDto {
  @IsString()
  productId!: string;

  @IsEnum(StockMovementType)
  type!: StockMovementType;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateProductGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];
}

export class UpdateProductGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];
}
