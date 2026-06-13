import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MedicalRecordType } from '../../../generated/prisma/enums';
import { MedicationDto } from './medication.dto';

export class UpdateMedicalRecordDto {
  @IsOptional()
  @IsEnum(MedicalRecordType)
  type?: MedicalRecordType;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  complaint?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  symptoms?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  diagnosis?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  treatmentPlan?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => MedicationDto)
  medications?: MedicationDto[] | null;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  notes?: string | null;

  @IsOptional()
  @IsDateString()
  nextReviewAt?: string | null;
}
