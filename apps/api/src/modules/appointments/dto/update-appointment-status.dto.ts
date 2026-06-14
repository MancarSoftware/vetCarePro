import { IsEnum } from 'class-validator';
import { AppointmentStatus } from '../../../generated/prisma/enums';

export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus)
  status!: AppointmentStatus;
}
