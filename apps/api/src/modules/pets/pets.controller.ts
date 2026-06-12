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
import { CreatePetDto } from './dto/create-pet.dto';
import { PetsQueryDto } from './dto/pets-query.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { PetsService } from './pets.service';

@Controller('pets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PETS_READ)
  findAll(@Query() query: PetsQueryDto) {
    return this.petsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PETS_READ)
  findOne(@Param('id', ParseUUIDPipe) petId: string) {
    return this.petsService.findOne(petId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PETS_MANAGE)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreatePetDto,
  ) {
    return this.petsService.create(actor.id, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PETS_MANAGE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) petId: string,
    @Body() dto: UpdatePetDto,
  ) {
    return this.petsService.update(actor.id, petId, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PETS_MANAGE)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) petId: string,
  ) {
    return this.petsService.remove(actor.id, petId);
  }
}

