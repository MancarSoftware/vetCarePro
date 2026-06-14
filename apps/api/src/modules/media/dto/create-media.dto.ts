import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MediaCategory } from '../../../generated/prisma/enums';

export class CreateMediaDto {
  @IsUUID()
  petId!: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  medicalRecordId?: string;

  @IsEnum(MediaCategory)
  category!: MediaCategory;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  tags?: string;
}
