import { Body, Controller, Get, Post } from '@nestjs/common';
import { ActivateLanLicenseDto } from './dto/activate-lan-license.dto';
import { RegisterLanDeviceDto } from './dto/register-lan-device.dto';
import { LanLicenseService } from './lan-license.service';

@Controller('lan-license')
export class LanLicenseController {
  constructor(private readonly lanLicenseService: LanLicenseService) {}

  @Get('status')
  getStatus() {
    return this.lanLicenseService.getStatus();
  }

  @Post('activate')
  activate(@Body() dto: ActivateLanLicenseDto) {
    return this.lanLicenseService.activate(dto);
  }

  @Post('register-device')
  registerDevice(@Body() dto: RegisterLanDeviceDto) {
    return this.lanLicenseService.registerDevice(dto);
  }
}
