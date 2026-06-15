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
import { CreateTreatmentEvolutionDto } from './dto/create-treatment-evolution.dto';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { TreatmentsQueryDto } from './dto/treatments-query.dto';
import { UpdateTreatmentEvolutionDto } from './dto/update-treatment-evolution.dto';
import { UpdateTreatmentDto } from './dto/update-treatment.dto';
import { TreatmentsService } from './treatments.service';

@Controller('treatments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TreatmentsController {
  constructor(private readonly treatmentsService: TreatmentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TREATMENTS_READ)
  findAll(@Query() query: TreatmentsQueryDto) {
    return this.treatmentsService.findAll(query);
  }

  @Get('summary')
  @RequirePermissions(PERMISSIONS.TREATMENTS_READ)
  getSummary(@Query('petId') petId?: string) {
    return this.treatmentsService.getSummary(petId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TREATMENTS_READ)
  findOne(@Param('id', ParseUUIDPipe) treatmentId: string) {
    return this.treatmentsService.findOne(treatmentId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TREATMENTS_MANAGE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateTreatmentDto,
  ) {
    return this.treatmentsService.create(actor.id, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TREATMENTS_MANAGE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) treatmentId: string,
    @Body() dto: UpdateTreatmentDto,
  ) {
    return this.treatmentsService.update(actor.id, treatmentId, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.TREATMENTS_MANAGE)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) treatmentId: string,
  ) {
    return this.treatmentsService.remove(actor.id, treatmentId);
  }

  @Post(':id/evolutions')
  @RequirePermissions(PERMISSIONS.TREATMENTS_MANAGE)
  createEvolution(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) treatmentId: string,
    @Body() dto: CreateTreatmentEvolutionDto,
  ) {
    return this.treatmentsService.createEvolution(
      actor.id,
      treatmentId,
      dto,
    );
  }

  @Patch(':id/evolutions/:evolutionId')
  @RequirePermissions(PERMISSIONS.TREATMENTS_MANAGE)
  updateEvolution(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) treatmentId: string,
    @Param('evolutionId', ParseUUIDPipe) evolutionId: string,
    @Body() dto: UpdateTreatmentEvolutionDto,
  ) {
    return this.treatmentsService.updateEvolution(
      actor.id,
      treatmentId,
      evolutionId,
      dto,
    );
  }

  @Delete(':id/evolutions/:evolutionId')
  @RequirePermissions(PERMISSIONS.TREATMENTS_MANAGE)
  removeEvolution(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) treatmentId: string,
    @Param('evolutionId', ParseUUIDPipe) evolutionId: string,
  ) {
    return this.treatmentsService.removeEvolution(
      actor.id,
      treatmentId,
      evolutionId,
    );
  }
}
