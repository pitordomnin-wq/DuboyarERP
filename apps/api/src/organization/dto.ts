import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

const emptyToNull = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : value === '' ? null : value,
);

export class UpdateOrganizationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @emptyToNull
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(300)
  legalName?: string | null;

  @emptyToNull
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(500)
  brandAddress?: string | null;

  @emptyToNull
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @emptyToNull
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(120)
  email?: string | null;

  @emptyToNull
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @Matches(/^\d{10}$|^\d{12}$/)
  inn?: string | null;

  @emptyToNull
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @Matches(/^\d{9}$/)
  kpp?: string | null;

  @emptyToNull
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @Matches(/^\d{13}$|^\d{15}$/)
  ogrn?: string | null;

  @emptyToNull
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(500)
  legalAddress?: string | null;

  @emptyToNull
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(200)
  bankName?: string | null;

  @emptyToNull
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @Matches(/^\d{9}$/)
  bik?: string | null;

  @emptyToNull
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @Matches(/^\d{20}$/)
  checkingAccount?: string | null;

  @emptyToNull
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @Matches(/^\d{20}$/)
  correspondentAccount?: string | null;
}
