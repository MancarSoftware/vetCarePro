import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AuthModule } from './modules/auth/auth.module';
import { BackupsModule } from './modules/backups/backups.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FinanceModule } from './modules/finance/finance.module';
import { GlobalSearchModule } from './modules/global-search/global-search.module';
import { HealthModule } from './modules/health/health.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MedicalRecordsModule } from './modules/medical-records/medical-records.module';
import { MediaModule } from './modules/media/media.module';
import { OwnersModule } from './modules/owners/owners.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PetsModule } from './modules/pets/pets.module';
import { PreventiveCareModule } from './modules/preventive-care/preventive-care.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RolesModule } from './modules/roles/roles.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TreatmentsModule } from './modules/treatments/treatments.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    PrismaModule,
    SecurityModule,
    HealthModule,
    BackupsModule,
    InventoryModule,
    AuthModule,
    UsersModule,
    RolesModule,
    OwnersModule,
    PaymentsModule,
    PetsModule,
    AppointmentsModule,
    MedicalRecordsModule,
    MediaModule,
    PreventiveCareModule,
    TreatmentsModule,
    FinanceModule,
    ReportsModule,
    SettingsModule,
    DashboardModule,
    GlobalSearchModule,
  ],
})
export class AppModule {}
