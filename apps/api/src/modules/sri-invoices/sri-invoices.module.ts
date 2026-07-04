import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SriInvoicesController } from './sri-invoices.controller';
import { SriInvoicesService } from './sri-invoices.service';

@Module({
  imports: [AuthModule],
  controllers: [SriInvoicesController],
  providers: [SriInvoicesService],
})
export class SriInvoicesModule {}
