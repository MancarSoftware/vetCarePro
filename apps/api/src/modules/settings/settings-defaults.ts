export interface ClinicSettings {
  name: string;
  legalName: string;
  taxIdType: 'RUC' | 'CEDULA';
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
  taxIdType: 'RUC',
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
  const source = current ?? {};
  const sri = source.sri ?? {};

  return {
    name: source.name ?? defaultClinicSettings.name,
    legalName: source.legalName ?? defaultClinicSettings.legalName,
    taxIdType: source.taxIdType ?? defaultClinicSettings.taxIdType,
    taxId: source.taxId ?? defaultClinicSettings.taxId,
    phone: source.phone ?? defaultClinicSettings.phone,
    email: source.email ?? defaultClinicSettings.email,
    address: source.address ?? defaultClinicSettings.address,
    city: source.city ?? defaultClinicSettings.city,
    country: source.country ?? defaultClinicSettings.country,
    website: source.website ?? defaultClinicSettings.website,
    logoPath: source.logoPath ?? defaultClinicSettings.logoPath,
    notes: source.notes ?? defaultClinicSettings.notes,
    sri: {
      enabled: sri.enabled ?? defaultClinicSettings.sri.enabled,
      environment: sri.environment ?? defaultClinicSettings.sri.environment,
      emissionType: sri.emissionType ?? defaultClinicSettings.sri.emissionType,
      establishmentCode:
        sri.establishmentCode ?? defaultClinicSettings.sri.establishmentCode,
      emissionPoint: sri.emissionPoint ?? defaultClinicSettings.sri.emissionPoint,
      sequential: sri.sequential ?? defaultClinicSettings.sri.sequential,
      specialTaxpayerNumber:
        sri.specialTaxpayerNumber ??
        defaultClinicSettings.sri.specialTaxpayerNumber,
      accountingRequired:
        sri.accountingRequired ?? defaultClinicSettings.sri.accountingRequired,
      digitalSignaturePath:
        sri.digitalSignaturePath ??
        defaultClinicSettings.sri.digitalSignaturePath,
      digitalSignatureConfigured:
        sri.digitalSignatureConfigured ??
        defaultClinicSettings.sri.digitalSignatureConfigured,
    },
  };
}

export function mergeSystemPreferences(
  current: Partial<SystemPreferences> | null | undefined,
): SystemPreferences {
  return { ...defaultSystemPreferences, ...(current ?? {}) };
}
