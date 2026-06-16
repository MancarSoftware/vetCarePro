import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaController } from './media.controller';
import { MediaStorageService } from './media-storage.service';
import { MediaService } from './media.service';

@Module({
  imports: [AuthModule],
  controllers: [MediaController],
  providers: [MediaService, MediaStorageService],
  exports: [MediaStorageService],
})
export class MediaModule {}
