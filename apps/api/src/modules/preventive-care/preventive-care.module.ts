import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DewormingsController } from './dewormings.controller';
import { DewormingsService } from './dewormings.service';
import { PreventiveCareController } from './preventive-care.controller';
import { PreventiveCareService } from './preventive-care.service';
import { PreventiveCareSupportService } from './preventive-care-support.service';
import { VaccinesController } from './vaccines.controller';
import { VaccinesService } from './vaccines.service';

@Module({
  imports: [AuthModule],
  controllers: [
    VaccinesController,
    DewormingsController,
    PreventiveCareController,
  ],
  providers: [
    VaccinesService,
    DewormingsService,
    PreventiveCareService,
    PreventiveCareSupportService,
  ],
})
export class PreventiveCareModule {}
