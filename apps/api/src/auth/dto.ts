import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class RequestOtpDto {
  @IsEmail()
  email!: string;
}

export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mailSignature?: string;
}
