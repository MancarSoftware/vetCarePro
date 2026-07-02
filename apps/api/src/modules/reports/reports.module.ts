import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReportsController } from './reports.controller';
import { ReportsExcelService } from './reports-excel.service';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsExcelService],
})
export class ReportsModule {}
