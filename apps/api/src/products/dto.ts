import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const emptyToUndefined = Transform(({ value }: { value: unknown }) =>
  value === '' || value === null ? undefined : value,
);

export class ProductAttributeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  value!: string;
}

export class UpsertProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  name!: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeDto)
  attributes?: ProductAttributeDto[];
}

export class SetProductCatalogDto {
  @IsBoolean()
  inCatalog!: boolean;
}

export class CreateAttributeTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeDto)
  items!: ProductAttributeDto[];
}
