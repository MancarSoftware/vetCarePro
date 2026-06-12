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
import { CreateOwnerDto } from './dto/create-owner.dto';
import { OwnersQueryDto } from './dto/owners-query.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';
import { OwnersService } from './owners.service';

@Controller('owners')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.OWNERS_READ)
  findAll(@Query() query: OwnersQueryDto) {
    return this.ownersService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.OWNERS_READ)
  findOne(@Param('id', ParseUUIDPipe) ownerId: string) {
    return this.ownersService.findOne(ownerId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.OWNERS_MANAGE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateOwnerDto,
  ) {
    return this.ownersService.create(actor.id, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.OWNERS_MANAGE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) ownerId: string,
    @Body() dto: UpdateOwnerDto,
  ) {
    return this.ownersService.update(actor.id, ownerId, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.OWNERS_MANAGE)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) ownerId: string,
  ) {
    return this.ownersService.remove(actor.id, ownerId);
  }
}

