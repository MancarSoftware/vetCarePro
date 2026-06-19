import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  const buildService = () => {
    const transaction = {
      setting: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    const prisma = {
      setting: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(transaction)),
    };

    const config = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          API_HOST: '127.0.0.1',
          API_PORT: 4782,
          DATABASE_URL:
            'postgresql://vetcare:secret@127.0.0.1:54329/vetcare_pro?schema=public',
          POSTGRES_RUNTIME: 'embedded-local',
        };
        return values[key] ?? fallback;
      }),
    };

    const service = new SettingsService(
      prisma as never,
      config as never,
      { rootPath: 'C:/VetCarePro/uploads' } as never,
      { rootPath: 'C:/VetCarePro/backups' } as never,
    );

    return { service, prisma, transaction };
  };

  it('returns default clinic, preferences and local runtime paths', async () => {
    const { service, prisma } = buildService();
    prisma.setting.findUnique.mockResolvedValue(null);

    const settings = await service.getSettings();

    expect(settings.clinic.name).toBe('Clinica VetCare');
    expect(settings.preferences.timezone).toBe('America/Guayaquil');
    expect(settings.local.uploadsPath).toBe('C:/VetCarePro/uploads');
    expect(settings.local.backupsPath).toBe('C:/VetCarePro/backups');
    expect(settings.local.databaseName).toBe('vetcare_pro');
    expect(settings.local.databaseMode).toBe('local');
    expect(settings.local.postgresRuntime).toBe('embedded-local');
    expect(settings.local.lanReady).toBe(false);
    expect(settings.metadata.updatedBy).toBeNull();
  });

  it('persists clinic and preferences changes with an audit log', async () => {
    const { service, prisma, transaction } = buildService();
    prisma.setting.findUnique.mockResolvedValue(null);

    transaction.setting.upsert
      .mockResolvedValueOnce({
        key: 'clinic.profile',
        value: {},
        updatedAt: new Date('2026-06-16T10:00:00.000Z'),
        updatedBy: {
          id: 'admin-1',
          firstName: 'Admin',
          lastName: 'VetCare',
        },
      })
      .mockResolvedValueOnce({
        key: 'system.preferences',
        value: {},
        updatedAt: new Date('2026-06-16T10:01:00.000Z'),
        updatedBy: {
          id: 'admin-1',
          firstName: 'Admin',
          lastName: 'VetCare',
        },
      });

    const settings = await service.updateSettings('admin-1', {
      clinic: {
        name: 'VetCare Centro',
        phone: '+593999999999',
      },
      preferences: {
        appointmentSlotMinutes: 45,
        vaccineAlertDays: 20,
      },
    });

    expect(transaction.setting.upsert).toHaveBeenCalledTimes(2);
    expect(transaction.setting.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { key: 'clinic.profile' },
        update: expect.objectContaining({
          value: expect.objectContaining({
            name: 'VetCare Centro',
            phone: '+593999999999',
            country: 'Ecuador',
          }),
          updatedById: 'admin-1',
        }),
      }),
    );
    expect(transaction.setting.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { key: 'system.preferences' },
        update: expect.objectContaining({
          value: expect.objectContaining({
            appointmentSlotMinutes: 45,
            vaccineAlertDays: 20,
            enableAuditLog: true,
          }),
          updatedById: 'admin-1',
        }),
      }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'UPDATE',
        entityType: 'Settings',
        changes: {
          updatedClinic: true,
          updatedPreferences: true,
        },
      },
    });
    expect(settings.clinic.name).toBe('VetCare Centro');
    expect(settings.preferences.appointmentSlotMinutes).toBe(45);
    expect(settings.metadata.updatedBy?.id).toBe('admin-1');
  });
});
