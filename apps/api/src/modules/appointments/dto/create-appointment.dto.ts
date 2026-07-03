import {
  IsNumber,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  AppointmentStatus,
  AppointmentType,
} from '../../../generated/prisma/enums';

export class CreateAppointmentDto {
  @IsUUID()
  petId!: string;

  @IsOptional()
  @IsUUID()
  veterinarianId?: string | null;

  @IsEnum(AppointmentType)
  type!: AppointmentType;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : Number(value),
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999)
  estimatedPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
