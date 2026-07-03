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

export class UpdateAppointmentDto {
  @IsOptional()
  @IsUUID()
  petId?: string;

  @IsOptional()
  @IsUUID()
  veterinarianId?: string | null;

  @IsOptional()
  @IsEnum(AppointmentType)
  type?: AppointmentType;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : Number(value),
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999)
  estimatedPrice?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}
