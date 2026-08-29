import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { MailFolder } from '@prisma/client';

export class ComposeMailDto {
  @ValidateIf((_, value) => Boolean(value))
  @IsEmail()
  toAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  toName?: string;

  @IsString()
  @MaxLength(300)
  subject!: string;

  @IsString()
  @MaxLength(20000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  draft?: boolean;
}

export class UpdateMailDto {
  @IsOptional()
  @IsEnum(MailFolder)
  folder?: MailFolder;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  toAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  toName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  body?: string;
}
