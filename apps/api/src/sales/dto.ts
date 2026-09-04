import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { DealChannel, DealStatus } from '@prisma/client';

export class DealItemDto {
  @IsString()
  @MinLength(1)
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;
}

export class CreateDealDto {
  @IsString()
  counterpartyId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DealItemDto)
  items!: DealItemDto[];
}

export class UpdateDealStatusDto {
  @IsEnum(DealStatus)
  status!: DealStatus;
}

export class CreateDealMessageDto {
  @IsEnum(DealChannel)
  channel!: DealChannel;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  body!: string;
}

export class SendDocumentDto {
  @IsEnum(DealChannel)
  channel!: DealChannel;
}

export class SendSmsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body!: string;
}

export class ShipDealDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsDateString()
  shippedAt?: string;
}

export class CreateUpdDto {
  @IsOptional()
  @IsDateString()
  shippedAt?: string;
}

export class ListDealsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  counterpartyId?: string;

  @IsOptional()
  @IsString()
  createdById?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @IsOptional()
  @IsDateString()
  dueTo?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  overdue?: boolean;

  @IsOptional()
  @IsString()
  status?: string;
}

export class DealPipelineColumnDto {
  @IsEnum(DealStatus)
  status!: DealStatus;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(7)
  color!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  position!: number;
}

export class UpdateDealPipelineDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DealPipelineColumnDto)
  columns!: DealPipelineColumnDto[];
}

