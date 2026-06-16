import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BackupsModule } from '../backups/backups.module';
import { MediaModule } from '../media/media.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AuthModule, MediaModule, BackupsModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
