import { Module } from '@nestjs/common';
import { LanLicenseController } from './lan-license.controller';
import { LanLicenseService } from './lan-license.service';

@Module({
  controllers: [LanLicenseController],
  providers: [LanLicenseService],
})
export class LanLicenseModule {}
