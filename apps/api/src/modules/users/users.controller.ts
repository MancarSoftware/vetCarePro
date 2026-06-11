import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PERMISSIONS } from '../auth/authorization.constants';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id/roles')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  updateRoles(@Param('id') userId: string, @Body() dto: UpdateUserRolesDto) {
    return this.usersService.updateRoles(userId, dto);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  updateStatus(@Param('id') userId: string, @Body() dto: UpdateUserStatusDto) {
    return this.usersService.updateStatus(userId, dto);
  }
}

