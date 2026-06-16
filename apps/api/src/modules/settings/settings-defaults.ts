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
  current: Partial<ClinicSettings> | null | undefined,
): ClinicSettings {
  return { ...defaultClinicSettings, ...(current ?? {}) };
}

export function mergeSystemPreferences(
  current: Partial<SystemPreferences> | null | undefined,
): SystemPreferences {
  return { ...defaultSystemPreferences, ...(current ?? {}) };
}
