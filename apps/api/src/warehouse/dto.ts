import { Transform, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
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
  @IsString()
  @MaxLength(20)
  unit?: string;
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
