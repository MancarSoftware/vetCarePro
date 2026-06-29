import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ActivateLanLicenseDto {
  @IsString()
  @MinLength(40)
  @MaxLength(1800)
  licenseKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  technicalCode?: string;
}
