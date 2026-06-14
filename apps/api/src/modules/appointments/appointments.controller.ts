import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PERMISSIONS } from '../auth/authorization.constants';
import { AppointmentsService } from './appointments.service';
import { AppointmentsQueryDto } from './dto/appointments-query.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Controller('appointments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.APPOINTMENTS_READ)
  findAll(@Query() query: AppointmentsQueryDto) {
    return this.appointmentsService.findAll(query);
  }

  @Get('veterinarians')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS_READ)
  findVeterinarians() {
    return this.appointmentsService.findVeterinarians();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS_READ)
  findOne(@Param('id', ParseUUIDPipe) appointmentId: string) {
    return this.appointmentsService.findOne(appointmentId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.APPOINTMENTS_MANAGE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(actor.id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS_MANAGE)
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) appointmentId: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return this.appointmentsService.updateStatus(
      actor.id,
      appointmentId,
      dto,
    );
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS_MANAGE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) appointmentId: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(actor.id, appointmentId, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS_MANAGE)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) appointmentId: string,
  ) {
    return this.appointmentsService.remove(actor.id, appointmentId);
  }
}
