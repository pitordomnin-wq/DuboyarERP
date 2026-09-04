import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  LayoutMaterialRole,
  LkpMaterialCategory,
  ProductionReleaseType,
  StageInputMode,
  StageQuantityBasis,
} from '@prisma/client';

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
  @Min(0)
  quantity!: number;

  @IsOptional()
  @IsEnum(StageInputMode)
  inputMode?: StageInputMode;

  @IsOptional()
  @IsEnum(StageQuantityBasis)
  quantityBasis?: StageQuantityBasis;

  @IsOptional()
  @IsEnum(LkpMaterialCategory)
  lkpCategory?: LkpMaterialCategory;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  keyword?: string;

  @IsOptional()
  @IsEnum(LayoutMaterialRole)
  layoutRole?: LayoutMaterialRole;
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

  @IsOptional()
  @IsEnum(ProductionReleaseType)
  defaultReleaseType?: ProductionReleaseType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  piecesPerM2?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  m2PerPackageDeck?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  m2PerPackageHerringbone?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StageDto)
  stages!: StageDto[];
}

export class CreateProductionJobDto {
  @IsString()
  dealItemId!: string;

  @IsOptional()
  @IsEnum(ProductionReleaseType)
  releaseType?: ProductionReleaseType;
}

export class CompleteJobWriteoffDto {
  @IsString()
  @MinLength(1)
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantity!: number;
}

export class CompleteJobDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompleteJobWriteoffDto)
  writeoffs?: CompleteJobWriteoffDto[];
}

export class UpsertLkpNormDto {
  @IsEnum(LkpMaterialCategory)
  category!: LkpMaterialCategory;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  normPerM2Kg!: number;

  @IsArray()
  @IsString({ each: true })
  keywords!: string[];
}

export class UpsertLkpNormsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertLkpNormDto)
  items!: UpsertLkpNormDto[];
}

export class ProductCoatingRecipeLineDto {
  @IsEnum(LkpMaterialCategory)
  category!: LkpMaterialCategory;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  normPerM2Kg?: number;
}

export class ImportTechCardRowDto {
  @IsString()
  materialName!: string;

  @Type(() => Number)
  @IsNumber()
  stage!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  normDeckM2?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  normHerringboneM2?: number;

  @IsOptional()
  @IsString()
  productGroupName?: string;
}

export class ImportTechCardDto {
  @IsString()
  productId!: string;

  @IsString()
  warehouseId!: string;

  @IsOptional()
  @IsEnum(ProductionReleaseType)
  defaultReleaseType?: ProductionReleaseType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTechCardRowDto)
  rows!: ImportTechCardRowDto[];
}
