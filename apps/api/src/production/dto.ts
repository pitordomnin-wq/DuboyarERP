import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class StageInputDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  productId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  productGroupId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;
}

export class StageOutputDto {
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

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  lossPercent?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageInputDto)
  inputs!: StageInputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageOutputDto)
  outputs!: StageOutputDto[];
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
