import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const emptyToUndefined = Transform(({ value }: { value: unknown }) =>
  value === '' || value === null ? undefined : value,
);

export class UpsertCounterpartyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(400)
  legalName!: string;

  @IsString()
  @Matches(/^\d{10}$|^\d{12}$/)
  inn!: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @Matches(/^\d{9}$/)
  kpp?: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @Matches(/^\d{13}$|^\d{15}$/)
  ogrn?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  legalAddress!: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MaxLength(500)
  actualAddress?: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bankName?: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @Matches(/^\d{9}$/)
  bik?: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @Matches(/^\d{20}$/)
  checkingAccount?: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @Matches(/^\d{20}$/)
  correspondentAccount?: string;

  @IsEmail()
  email!: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MaxLength(64)
  telegram?: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactName?: string;

  @emptyToUndefined
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
