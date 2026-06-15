import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TreatmentEvolutionStatus } from '../../../generated/prisma/enums';

export class UpdateTreatmentEvolutionDto {
  @IsOptional()
  @IsEnum(TreatmentEvolutionStatus)
  status?: TreatmentEvolutionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(6000)
  notes?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999.99)
  weightKg?: number | null;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsDateString()
  nextReviewAt?: string | null;
}
