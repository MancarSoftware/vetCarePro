import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
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
  @IsString()
  @MaxLength(255)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
