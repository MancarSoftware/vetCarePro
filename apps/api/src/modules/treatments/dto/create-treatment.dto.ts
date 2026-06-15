import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TreatmentStatus } from '../../../generated/prisma/enums';
import { MedicationDto } from '../../medical-records/dto/medication.dto';

export class CreateTreatmentDto {
  @IsUUID()
  petId!: string;

  @IsOptional()
  @IsUUID()
  medicalRecordId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  diagnosis!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(6000)
  instructions!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => MedicationDto)
  medications?: MedicationDto[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  dosage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  frequency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays?: number;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(TreatmentStatus)
  status?: TreatmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  notes?: string;
}
