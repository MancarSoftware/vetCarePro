import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TreatmentStatus } from '../../../generated/prisma/enums';
import { MedicationDto } from '../../medical-records/dto/medication.dto';

export class UpdateTreatmentDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  diagnosis?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(6000)
  instructions?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => MedicationDto)
  medications?: MedicationDto[] | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  dosage?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  frequency?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays?: number | null;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsEnum(TreatmentStatus)
  status?: TreatmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  notes?: string | null;
}
