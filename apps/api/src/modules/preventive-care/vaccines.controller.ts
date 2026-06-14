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
import { CreateVaccineDto } from './dto/create-vaccine.dto';
import { PreventiveCareQueryDto } from './dto/preventive-care-query.dto';
import { UpdateVaccineDto } from './dto/update-vaccine.dto';
import { VaccinesService } from './vaccines.service';

@Controller('vaccines')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VaccinesController {
  constructor(private readonly vaccinesService: VaccinesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.VACCINES_READ)
  findAll(@Query() query: PreventiveCareQueryDto) {
    return this.vaccinesService.findAll(query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.VACCINES_MANAGE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateVaccineDto,
  ) {
    return this.vaccinesService.create(actor.id, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.VACCINES_MANAGE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) vaccineId: string,
    @Body() dto: UpdateVaccineDto,
  ) {
    return this.vaccinesService.update(actor.id, vaccineId, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.VACCINES_MANAGE)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) vaccineId: string,
  ) {
    return this.vaccinesService.remove(actor.id, vaccineId);
  }
}
