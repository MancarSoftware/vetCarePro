import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PERMISSIONS } from '../auth/authorization.constants';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.REPORTS_READ)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  getSummary(@Query() query: ReportsQueryDto) {
    return this.reportsService.getSummary(query);
  }

  @Get('export.csv')
  async exportCsv(
    @Query() query: ReportsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const filename = this.reportsService.exportFilename(query);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    return this.reportsService.exportCsv(query);
  }

  @Get('export.xlsx')
  async exportXlsx(
    @Query() query: ReportsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { buffer, filename } = await this.reportsService.exportXlsx(query);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    return buffer;
  }
}
