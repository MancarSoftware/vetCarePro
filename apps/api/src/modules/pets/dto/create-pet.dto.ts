import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PetSex, PetStatus } from '../../../generated/prisma/enums';

export class CreatePetDto {
  @IsUUID()
  ownerId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  species!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  breed?: string;

  @IsEnum(PetSex)
  sex!: PetSex;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === '' || value === undefined
      ? undefined
      : Number(value),
  )
  @IsInt()
  @Min(0)
  @Max(600)
  approximateAgeMonths?: number;

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
  @MaxLength(100)
  color?: string;

  @IsOptional()
  @IsEnum(PetStatus)
  status?: PetStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

