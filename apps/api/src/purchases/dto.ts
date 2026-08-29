import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

const emptyToUndefined = Transform(({ value }: { value: unknown }) =>
  value === '' || value === null ? undefined : value,
);

export class PurchaseItemDto {
  @IsString()
  @MinLength(1)
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;
}

export class CreatePurchaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsString()
  counterpartyId!: string;

  @IsString()
  warehouseId!: string;

  @IsDateString()
  purchasedAt!: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];
}

export class CreatePurchaseDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MaxLength(80)
  number?: string;

  @emptyToUndefined
  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
