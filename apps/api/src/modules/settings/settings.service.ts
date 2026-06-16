import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BackupsService } from '../backups/backups.service';
import { MediaStorageService } from '../media/media-storage.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  CLINIC_SETTINGS_KEY,
  ClinicSettings,
  SYSTEM_PREFERENCES_KEY,
  SystemPreferences,
  mergeClinicSettings,
  mergeSystemPreferences,
} from './settings-defaults';

const defaultDatabaseUrl =
  'postgresql://vetcare:vetcare_dev@127.0.0.1:54329/vetcare_pro?schema=public';

const settingInclude = {
  updatedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} satisfies Prisma.SettingInclude;

type SettingWithUser = Prisma.SettingGetPayload<{
  include: typeof settingInclude;
}>;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mediaStorage: MediaStorageService,
    private readonly backupsService: BackupsService,
  ) {}

  async getSettings() {
    const [clinicSetting, preferencesSetting] = await Promise.all([
      this.getSetting(CLINIC_SETTINGS_KEY),
      this.getSetting(SYSTEM_PREFERENCES_KEY),
    ]);
    const clinic = mergeClinicSettings(
      this.jsonObject<ClinicSettings>(clinicSetting?.value),
    );
    const preferences = mergeSystemPreferences(
      this.jsonObject<SystemPreferences>(preferencesSetting?.value),
    );

    return {
      clinic,
      preferences,
      local: this.localInfo(),
      metadata: {
        clinicUpdatedAt: clinicSetting?.updatedAt ?? null,
        preferencesUpdatedAt: preferencesSetting?.updatedAt ?? null,
        updatedBy:
          preferencesSetting?.updatedBy ??
          clinicSetting?.updatedBy ??
          null,
      },
    };
  }

  async updateSettings(actorId: string, dto: UpdateSettingsDto) {
    const current = await this.getSettings();
    const clinic = mergeClinicSettings({
      ...current.clinic,
      ...(dto.clinic ?? {}),
    });
    const preferences = mergeSystemPreferences({
      ...current.preferences,
      ...(dto.preferences ?? {}),
    });

    const [clinicSetting, preferencesSetting] = await this.prisma.$transaction(
      async (transaction) => {
        const updatedClinic = dto.clinic
          ? await transaction.setting.upsert({
              where: { key: CLINIC_SETTINGS_KEY },
              update: {
                value: clinic as unknown as Prisma.InputJsonObject,
                description: 'Datos principales de la veterinaria',
                updatedById: actorId,
              },
              create: {
                key: CLINIC_SETTINGS_KEY,
                value: clinic as unknown as Prisma.InputJsonObject,
                description: 'Datos principales de la veterinaria',
                updatedById: actorId,
              },
              include: settingInclude,
            })
          : await this.getSetting(CLINIC_SETTINGS_KEY, transaction);

        const updatedPreferences = dto.preferences
          ? await transaction.setting.upsert({
              where: { key: SYSTEM_PREFERENCES_KEY },
              update: {
                value: preferences as unknown as Prisma.InputJsonObject,
                description: 'Preferencias operativas locales',
                updatedById: actorId,
              },
              create: {
                key: SYSTEM_PREFERENCES_KEY,
                value: preferences as unknown as Prisma.InputJsonObject,
                description: 'Preferencias operativas locales',
                updatedById: actorId,
              },
              include: settingInclude,
            })
          : await this.getSetting(SYSTEM_PREFERENCES_KEY, transaction);

        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'UPDATE',
            entityType: 'Settings',
            changes: {
              updatedClinic: Boolean(dto.clinic),
              updatedPreferences: Boolean(dto.preferences),
            },
          },
        });

        return [updatedClinic, updatedPreferences];
      },
    );

    return {
      clinic,
      preferences,
      local: this.localInfo(),
      metadata: {
        clinicUpdatedAt: clinicSetting?.updatedAt ?? null,
        preferencesUpdatedAt: preferencesSetting?.updatedAt ?? null,
        updatedBy:
          preferencesSetting?.updatedBy ??
          clinicSetting?.updatedBy ??
          null,
      },
    };
  }

  private getSetting(
    key: string,
    client: Pick<PrismaService, 'setting'> | Prisma.TransactionClient =
      this.prisma,
  ): Promise<SettingWithUser | null> {
    return client.setting.findUnique({
      where: { key },
      include: settingInclude,
    });
  }

  private localInfo() {
    const database = this.databaseInfo();
    return {
      uploadsPath: this.mediaStorage.rootPath,
      backupsPath: this.backupsService.rootPath,
      apiHost: this.config.get<string>('API_HOST', '127.0.0.1'),
      apiPort: Number(this.config.get('API_PORT', 4782)),
      databaseHost: database.host,
      databasePort: database.port,
      databaseName: database.database,
      databaseSchema: database.schema,
      postgresContainer:
        this.config.get<string>('POSTGRES_CONTAINER') ??
        'vetcare-pro-postgres',
      lanReady: false,
    };
  }

  private databaseInfo() {
    const url = new URL(
      this.config.get<string>('DATABASE_URL') ?? defaultDatabaseUrl,
    );
    return {
      host: url.hostname,
      port: url.port || '5432',
      database: url.pathname.replace(/^\//, ''),
      schema: url.searchParams.get('schema') ?? 'public',
    };
  }

  private jsonObject<T>(value: Prisma.JsonValue | undefined): Partial<T> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Partial<T>;
  }
}
