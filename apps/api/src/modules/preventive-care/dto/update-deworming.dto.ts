import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateDewormingDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  medication?: string;

  @IsOptional()
  @IsDateString()
  appliedAt?: string;

  @IsOptional()
  @IsDateString()
  nextDueDate?: string | null;

  @IsOptional()
  @Transform(({ value }) =>
    value === null
      ? null
      : value === '' || value === undefined
      ? undefined
      : Number(value),
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999)
  weightKg?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  dosage?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}
