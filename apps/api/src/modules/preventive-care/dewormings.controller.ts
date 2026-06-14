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
import { CreateDewormingDto } from './dto/create-deworming.dto';
import { PreventiveCareQueryDto } from './dto/preventive-care-query.dto';
import { UpdateDewormingDto } from './dto/update-deworming.dto';
import { DewormingsService } from './dewormings.service';

@Controller('dewormings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DewormingsController {
  constructor(private readonly dewormingsService: DewormingsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.VACCINES_READ)
  findAll(@Query() query: PreventiveCareQueryDto) {
    return this.dewormingsService.findAll(query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.VACCINES_MANAGE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateDewormingDto,
  ) {
    return this.dewormingsService.create(actor.id, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.VACCINES_MANAGE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) dewormingId: string,
    @Body() dto: UpdateDewormingDto,
  ) {
    return this.dewormingsService.update(actor.id, dewormingId, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.VACCINES_MANAGE)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) dewormingId: string,
  ) {
    return this.dewormingsService.remove(actor.id, dewormingId);
  }
}
