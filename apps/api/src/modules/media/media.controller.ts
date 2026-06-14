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
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PERMISSIONS } from '../auth/authorization.constants';
import { CreateMediaDto } from './dto/create-media.dto';
import { MediaQueryDto } from './dto/media-query.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { MediaService } from './media.service';

@Controller('media')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MEDICAL_READ)
  findAll(@Query() query: MediaQueryDto) {
    return this.mediaService.findAll(query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.MEDICAL_MANAGE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: 15 * 1024 * 1024,
      },
    }),
  )
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateMediaDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.mediaService.create(actor.id, dto, file);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.MEDICAL_MANAGE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) mediaId: string,
    @Body() dto: UpdateMediaDto,
  ) {
    return this.mediaService.update(actor.id, mediaId, dto);
  }

  @Get(':id/content')
  @RequirePermissions(PERMISSIONS.MEDICAL_READ)
  async content(
    @Param('id', ParseUUIDPipe) mediaId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.mediaService.getContent(mediaId);
    response.set({
      'Content-Type': file.mimeType,
      'Content-Length': String(file.sizeBytes),
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(createReadStream(file.absolutePath));
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.MEDICAL_MANAGE)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) mediaId: string,
  ) {
    return this.mediaService.remove(actor.id, mediaId);
  }
}
