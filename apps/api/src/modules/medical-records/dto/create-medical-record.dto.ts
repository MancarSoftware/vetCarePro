import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MedicalRecordType } from '../../../generated/prisma/enums';
import { MedicationDto } from './medication.dto';

export class CreateMedicalRecordDto {
  @IsUUID()
  petId!: string;

  @IsEnum(MedicalRecordType)
  type!: MedicalRecordType;

  @IsDateString()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  complaint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  symptoms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  diagnosis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  treatmentPlan?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => MedicationDto)
  medications?: MedicationDto[];

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  notes?: string;

  @IsOptional()
  @IsDateString()
  nextReviewAt?: string;
}
