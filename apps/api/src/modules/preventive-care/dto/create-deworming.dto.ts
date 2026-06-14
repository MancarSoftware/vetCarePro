import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateDewormingDto {
  @IsUUID()
  petId!: string;

  @IsOptional()
  @IsUUID()
  medicalRecordId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  medication!: string;

  @IsDateString()
  appliedAt!: string;

  @IsOptional()
  @IsDateString()
  nextDueDate?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === '' || value === undefined
      ? undefined
      : Number(value),
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999)
  weightKg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  dosage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
