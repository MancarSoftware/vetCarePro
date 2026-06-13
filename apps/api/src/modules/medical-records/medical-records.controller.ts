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
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { MedicalRecordsQueryDto } from './dto/medical-records-query.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { MedicalRecordsService } from './medical-records.service';

@Controller('medical-records')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MedicalRecordsController {
  constructor(
    private readonly medicalRecordsService: MedicalRecordsService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MEDICAL_READ)
  findAll(@Query() query: MedicalRecordsQueryDto) {
    return this.medicalRecordsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.MEDICAL_READ)
  findOne(@Param('id', ParseUUIDPipe) recordId: string) {
    return this.medicalRecordsService.findOne(recordId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.MEDICAL_MANAGE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateMedicalRecordDto,
  ) {
    return this.medicalRecordsService.create(actor.id, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.MEDICAL_MANAGE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) recordId: string,
    @Body() dto: UpdateMedicalRecordDto,
  ) {
    return this.medicalRecordsService.update(actor.id, recordId, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.MEDICAL_MANAGE)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) recordId: string,
  ) {
    return this.medicalRecordsService.remove(actor.id, recordId);
  }
}
