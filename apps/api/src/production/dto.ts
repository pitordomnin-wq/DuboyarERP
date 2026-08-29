import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

const emptyToUndefined = Transform(({ value }: { value: unknown }) =>
  value === '' || value === null ? undefined : value,
);

export class StageInputDto {
  @IsString()
  @MinLength(1)
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;
}

export class StageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  outputProductId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageInputDto)
  inputs!: StageInputDto[];
}

export class UpsertProductionTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  productId!: string;

  @IsString()
  warehouseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StageDto)
  stages!: StageDto[];
}

export class CreateProductionJobDto {
  @IsString()
  dealItemId!: string;
}
