import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PERMISSIONS } from '../auth/authorization.constants';
import { BackupsService, type BackupFileKind } from './backups.service';
import { BackupsQueryDto } from './dto/backups-query.dto';

@Controller('backups')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.BACKUPS_MANAGE)
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Get()
  findAll(@Query() query: BackupsQueryDto) {
    return this.backupsService.findAll(query);
  }

  @Get('summary')
  getSummary() {
    return this.backupsService.getSummary();
  }

  @Post()
  create(@CurrentUser() actor: AuthenticatedUser) {
    return this.backupsService.create(actor.id);
  }

  @Get(':id/database')
  async databaseFile(
    @Param('id', ParseUUIDPipe) backupId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.streamFile(backupId, 'database', response);
  }

  @Get(':id/files')
  async filesArchive(
    @Param('id', ParseUUIDPipe) backupId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.streamFile(backupId, 'files', response);
  }

  @Delete(':id')
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) backupId: string,
  ) {
    return this.backupsService.remove(actor.id, backupId);
  }

  private async streamFile(
    backupId: string,
    kind: BackupFileKind,
    response: Response,
  ) {
    const file = await this.backupsService.getFile(backupId, kind);
    response.set({
      'Content-Type': file.mimeType,
      'Content-Length': String(file.sizeBytes),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(file.stream);
  }
}
