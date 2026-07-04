export interface ClinicSettings {
  name: string;
  legalName: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  country: string;
  website: string;
  logoPath: string;
  notes: string;
  sri: SriSettings;
}

export interface SriSettings {
  enabled: boolean;
  environment: 'TEST' | 'PRODUCTION';
  emissionType: 'NORMAL';
  establishmentCode: string;
  emissionPoint: string;
  sequential: number;
  specialTaxpayerNumber: string;
  accountingRequired: boolean;
  digitalSignaturePath: string;
  digitalSignatureConfigured: boolean;
}

export interface SystemPreferences {
  currency: 'USD';
  locale: 'es-EC';
  timezone: string;
  dateFormat: 'dd/MM/yyyy' | 'yyyy-MM-dd';
  appointmentSlotMinutes: number;
  vaccineAlertDays: number;
  backupReminderDays: number;
  enableAuditLog: boolean;
}

type PartialClinicSettings = Partial<Omit<ClinicSettings, 'sri'>> & {
  sri?: Partial<SriSettings>;
};

export const CLINIC_SETTINGS_KEY = 'clinic.profile';
export const SYSTEM_PREFERENCES_KEY = 'system.preferences';

export const defaultClinicSettings: ClinicSettings = {
  name: 'Clinica VetCare',
  legalName: '',
  taxId: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  country: 'Ecuador',
  website: '',
  logoPath: '',
  notes: '',
  sri: {
    enabled: false,
    environment: 'TEST',
    emissionType: 'NORMAL',
    establishmentCode: '001',
    emissionPoint: '001',
    sequential: 1,
    specialTaxpayerNumber: '',
    accountingRequired: false,
    digitalSignaturePath: '',
    digitalSignatureConfigured: false,
  },
};

export const defaultSystemPreferences: SystemPreferences = {
  currency: 'USD',
  locale: 'es-EC',
  timezone: 'America/Guayaquil',
  dateFormat: 'dd/MM/yyyy',
  appointmentSlotMinutes: 30,
  vaccineAlertDays: 30,
  backupReminderDays: 7,
  enableAuditLog: true,
};

export function mergeClinicSettings(
  current: PartialClinicSettings | null | undefined,
): ClinicSettings {
  return {
    ...defaultClinicSettings,
    ...(current ?? {}),
    sri: {
      ...defaultClinicSettings.sri,
      ...(current?.sri ?? {}),
    },
  };
}

export function mergeSystemPreferences(
  current: Partial<SystemPreferences> | null | undefined,
): SystemPreferences {
  return { ...defaultSystemPreferences, ...(current ?? {}) };
}
