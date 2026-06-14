import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PERMISSIONS } from '../auth/authorization.constants';
import { PreventiveCareSummaryQueryDto } from './dto/preventive-care-summary-query.dto';
import { PreventiveCareService } from './preventive-care.service';

@Controller('preventive-care')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PreventiveCareController {
  constructor(
    private readonly preventiveCareService: PreventiveCareService,
  ) {}

  @Get('summary')
  @RequirePermissions(PERMISSIONS.VACCINES_READ)
  getSummary(@Query() query: PreventiveCareSummaryQueryDto) {
    return this.preventiveCareService.getSummary(query.petId);
  }
}
