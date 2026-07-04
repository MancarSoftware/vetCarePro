import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SriSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['TEST', 'PRODUCTION'])
  environment?: 'TEST' | 'PRODUCTION';

  @IsOptional()
  @IsIn(['NORMAL'])
  emissionType?: 'NORMAL';

  @IsOptional()
  @IsString()
  @Matches(/^\d{3}$/)
  establishmentCode?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{3}$/)
  emissionPoint?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999999999)
  sequential?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  specialTaxpayerNumber?: string;

  @IsOptional()
  @IsBoolean()
  accountingRequired?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(700)
  digitalSignaturePath?: string;

  @IsOptional()
  @IsBoolean()
  digitalSignatureConfigured?: boolean;
}

export class ClinicSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(700)
  logoPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SriSettingsDto)
  sri?: SriSettingsDto;
}

export class SystemPreferencesDto {
  @IsOptional()
  @IsIn(['USD'])
  currency?: 'USD';

  @IsOptional()
  @IsIn(['es-EC'])
  locale?: 'es-EC';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsIn(['dd/MM/yyyy', 'yyyy-MM-dd'])
  dateFormat?: 'dd/MM/yyyy' | 'yyyy-MM-dd';

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(180)
  appointmentSlotMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(180)
  vaccineAlertDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  backupReminderDays?: number;

  @IsOptional()
  @IsBoolean()
  enableAuditLog?: boolean;
}

export class UpdateSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ClinicSettingsDto)
  clinic?: ClinicSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SystemPreferencesDto)
  preferences?: SystemPreferencesDto;
}
