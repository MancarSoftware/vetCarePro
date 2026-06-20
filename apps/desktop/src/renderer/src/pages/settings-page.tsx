import {
  ClinicalField,
  clinicalInputClass,
} from '@/components/clinical/clinical-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { useRuntimeConfig } from '@/contexts/runtime-config-context';
import { cn } from '@/lib/utils';
import type {
  AppSettings,
  ClinicSettings,
  LocalSettingsInfo,
  SystemPreferences,
} from '@/types/clinical';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CheckCircle2,
  Clock3,
  Database,
  Folder,
  Globe2,
  HardDrive,
  LoaderCircle,
  Network,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Stethoscope,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

const emptyClinic: ClinicSettings = {
  name: '',
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

const defaultPreferences: SystemPreferences = {
  currency: 'USD',
  locale: 'es-EC',
  timezone: 'America/Guayaquil',
  dateFormat: 'dd/MM/yyyy',
  appointmentSlotMinutes: 30,
  vaccineAlertDays: 30,
  backupReminderDays: 7,
  enableAuditLog: true,
};

const runtimeModeLabels: Record<VetCareRuntimeMode, string> = {
  local: 'Una sola PC',
  'lan-server': 'Servidor LAN',
  'lan-client': 'Cliente LAN',
};

const runtimeModeHelpers: Record<VetCareRuntimeMode, string> = {
  local: 'Operacion local clasica',
  'lan-server': 'PC principal de la red',
  'lan-client': 'Conectado a servidor',
};

export function SettingsPage() {
  const { request, user } = useAuth();
  const { config, openConfigurator } = useRuntimeConfig();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [clinic, setClinic] = useState<ClinicSettings>(emptyClinic);
  const [preferences, setPreferences] =
    useState<SystemPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const canManage = user?.permissions.includes('settings.manage') ?? false;

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await request<AppSettings>('/settings');
      setSettings(data);
      setClinic(data.clinic);
      setPreferences(data.preferences);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible cargar la configuracion.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateClinic = <Key extends keyof ClinicSettings>(
    field: Key,
    value: ClinicSettings[Key],
  ) => {
    setClinic((current) => ({ ...current, [field]: value }));
  };

  const updatePreference = <Key extends keyof SystemPreferences>(
    field: Key,
    value: SystemPreferences[Key],
  ) => {
    setPreferences((current) => ({ ...current, [field]: value }));
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const updated = await request<AppSettings>('/settings', {
        method: 'PATCH',
        body: { clinic, preferences },
      });
      setSettings(updated);
      setClinic(updated.clinic);
      setPreferences(updated.preferences);
      setSuccess('Configuracion guardada correctamente.');
      setError(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'No fue posible guardar la configuracion.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const local = settings?.local;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">
            Centro de control local
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-slate-950">
            Configuracion
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Datos de la clinica, preferencias operativas y rutas locales del
            sistema.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => void refresh()}
            disabled={isLoading}
            className="h-10 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            {isLoading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Actualizar
          </Button>
          <Button
            onClick={() => void saveSettings()}
            disabled={!canManage || isSaving || isLoading}
            className="h-10 bg-teal-600 px-4 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700"
          >
            {isSaving ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Guardar cambios
          </Button>
        </div>
      </div>

      {error && (
        <StatusBanner tone="error" message={error} onClose={() => setError(null)} />
      )}
      {success && (
        <StatusBanner
          tone="success"
          message={success}
          onClose={() => setSuccess(null)}
        />
      )}

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <SettingsMetric
          icon={Building2}
          label="Clinica"
          value={clinic.name || 'Sin nombre'}
          helper={clinic.city || 'Datos generales'}
          tone="teal"
        />
        <SettingsMetric
          icon={Globe2}
          label="Formato regional"
          value={preferences.locale}
          helper={`${preferences.currency} · ${preferences.dateFormat}`}
          tone="blue"
        />
        <SettingsMetric
          icon={Clock3}
          label="Agenda"
          value={`${preferences.appointmentSlotMinutes} min`}
          helper="Duracion por bloque"
          tone="violet"
        />
        <SettingsMetric
          icon={Network}
          label="Modo de red"
          value={runtimeModeLabels[config.mode]}
          helper={runtimeModeHelpers[config.mode]}
          tone="amber"
        />
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5">
          <SectionHeader
            icon={Stethoscope}
            title="Perfil de la veterinaria"
            description="Informacion que se usara en reportes, pagos y documentos."
          />

          {isLoading ? (
            <SettingsSkeleton rows={8} />
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ClinicalField label="Nombre comercial">
                <input
                  value={clinic.name}
                  onChange={(event) => updateClinic('name', event.target.value)}
                  disabled={!canManage}
                  className={clinicalInputClass}
                  placeholder="VetCare Pro"
                />
              </ClinicalField>
              <ClinicalField label="Razon social" optional>
                <input
                  value={clinic.legalName}
                  onChange={(event) =>
                    updateClinic('legalName', event.target.value)
                  }
                  disabled={!canManage}
                  className={clinicalInputClass}
                  placeholder="Clinica Veterinaria VetCare"
                />
              </ClinicalField>
              <ClinicalField label="RUC / identificacion" optional>
                <input
                  value={clinic.taxId}
                  onChange={(event) => updateClinic('taxId', event.target.value)}
                  disabled={!canManage}
                  className={clinicalInputClass}
                  placeholder="0999999999001"
                />
              </ClinicalField>
              <ClinicalField label="Telefono" optional>
                <input
                  value={clinic.phone}
                  onChange={(event) => updateClinic('phone', event.target.value)}
                  disabled={!canManage}
                  className={clinicalInputClass}
                  placeholder="+593 99 999 9999"
                />
              </ClinicalField>
              <ClinicalField label="Correo" optional>
                <input
                  type="email"
                  value={clinic.email}
                  onChange={(event) => updateClinic('email', event.target.value)}
                  disabled={!canManage}
                  className={clinicalInputClass}
                  placeholder="contacto@vetcarepro.local"
                />
              </ClinicalField>
              <ClinicalField label="Sitio web" optional>
                <input
                  value={clinic.website}
                  onChange={(event) => updateClinic('website', event.target.value)}
                  disabled={!canManage}
                  className={clinicalInputClass}
                  placeholder="https://..."
                />
              </ClinicalField>
              <ClinicalField label="Ciudad" optional>
                <input
                  value={clinic.city}
                  onChange={(event) => updateClinic('city', event.target.value)}
                  disabled={!canManage}
                  className={clinicalInputClass}
                  placeholder="Guayaquil"
                />
              </ClinicalField>
              <ClinicalField label="Pais">
                <input
                  value={clinic.country}
                  onChange={(event) => updateClinic('country', event.target.value)}
                  disabled={!canManage}
                  className={clinicalInputClass}
                  placeholder="Ecuador"
                />
              </ClinicalField>
              <ClinicalField label="Direccion" optional>
                <input
                  value={clinic.address}
                  onChange={(event) => updateClinic('address', event.target.value)}
                  disabled={!canManage}
                  className={clinicalInputClass}
                  placeholder="Av. principal y calle secundaria"
                />
              </ClinicalField>
              <ClinicalField label="Ruta del logo" optional>
                <input
                  value={clinic.logoPath}
                  onChange={(event) => updateClinic('logoPath', event.target.value)}
                  disabled={!canManage}
                  className={clinicalInputClass}
                  placeholder="C:/VetCarePro/uploads/logo.png"
                />
              </ClinicalField>
              <div className="lg:col-span-2">
                <ClinicalField label="Notas internas" optional>
                  <textarea
                    value={clinic.notes}
                    onChange={(event) => updateClinic('notes', event.target.value)}
                    disabled={!canManage}
                    className={`${clinicalInputClass} min-h-24 resize-none py-3`}
                    placeholder="Indicaciones administrativas para el equipo..."
                  />
                </ClinicalField>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <SectionHeader
              icon={Settings2}
              title="Preferencias"
              description="Reglas locales para agenda, alertas y auditoria."
            />
            {isLoading ? (
              <SettingsSkeleton rows={5} />
            ) : (
              <div className="mt-5 space-y-4">
                <ClinicalField label="Zona horaria">
                  <input
                    value={preferences.timezone}
                    onChange={(event) =>
                      updatePreference('timezone', event.target.value)
                    }
                    disabled={!canManage}
                    className={clinicalInputClass}
                  />
                </ClinicalField>
                <div className="grid grid-cols-2 gap-4">
                  <ClinicalField label="Moneda">
                    <select
                      value={preferences.currency}
                      disabled
                      className={clinicalInputClass}
                    >
                      <option value="USD">USD</option>
                    </select>
                  </ClinicalField>
                  <ClinicalField label="Idioma">
                    <select
                      value={preferences.locale}
                      disabled
                      className={clinicalInputClass}
                    >
                      <option value="es-EC">es-EC</option>
                    </select>
                  </ClinicalField>
                </div>
                <ClinicalField label="Formato de fecha">
                  <select
                    value={preferences.dateFormat}
                    onChange={(event) =>
                      updatePreference(
                        'dateFormat',
                        event.target.value as SystemPreferences['dateFormat'],
                      )
                    }
                    disabled={!canManage}
                    className={clinicalInputClass}
                  >
                    <option value="dd/MM/yyyy">dd/MM/yyyy</option>
                    <option value="yyyy-MM-dd">yyyy-MM-dd</option>
                  </select>
                </ClinicalField>
                <div className="grid grid-cols-3 gap-3">
                  <NumberSetting
                    label="Agenda"
                    suffix="min"
                    value={preferences.appointmentSlotMinutes}
                    disabled={!canManage}
                    onChange={(value) =>
                      updatePreference('appointmentSlotMinutes', value)
                    }
                  />
                  <NumberSetting
                    label="Vacunas"
                    suffix="dias"
                    value={preferences.vaccineAlertDays}
                    disabled={!canManage}
                    onChange={(value) => updatePreference('vaccineAlertDays', value)}
                  />
                  <NumberSetting
                    label="Backups"
                    suffix="dias"
                    value={preferences.backupReminderDays}
                    disabled={!canManage}
                    onChange={(value) =>
                      updatePreference('backupReminderDays', value)
                    }
                  />
                </div>
                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <input
                    type="checkbox"
                    checked={preferences.enableAuditLog}
                    onChange={(event) =>
                      updatePreference('enableAuditLog', event.target.checked)
                    }
                    disabled={!canManage}
                    className="mt-1 size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>
                    <span className="block text-sm font-bold text-slate-800">
                      Auditoria activa
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      Registra cambios importantes de usuarios, pacientes,
                      pagos, inventario y configuracion.
                    </span>
                  </span>
                </label>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <SectionHeader
              icon={ShieldCheck}
              title="Ultima modificacion"
              description="Trazabilidad administrativa de esta seccion."
            />
            <div className="mt-5 grid gap-3">
              <InfoTile
                label="Clinica"
                value={formatDate(settings?.metadata.clinicUpdatedAt ?? null)}
              />
              <InfoTile
                label="Preferencias"
                value={formatDate(
                  settings?.metadata.preferencesUpdatedAt ?? null,
                )}
              />
              <InfoTile
                label="Responsable"
                value={
                  settings?.metadata.updatedBy
                    ? `${settings.metadata.updatedBy.firstName} ${settings.metadata.updatedBy.lastName}`
                    : 'Sin cambios guardados'
                }
              />
            </div>
          </Card>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Card className="p-5">
          <SectionHeader
            icon={HardDrive}
            title="Entorno local"
            description={
              config.mode === 'lan-client'
                ? 'Rutas y servicios centrales entregados por la PC Servidor LAN.'
                : 'Rutas y servicios que usa esta instalacion de Windows.'
            }
          />
          {local ? (
            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <PathTile icon={Folder} label="Archivos clinicos" value={local.uploadsPath} />
              <PathTile icon={Folder} label="Backups" value={local.backupsPath} />
              <PathTile
                icon={Settings2}
                label="API local"
                value={`${local.apiHost}:${local.apiPort}`}
              />
              <PathTile
                icon={Database}
                label="PostgreSQL"
                value={`${local.databaseHost}:${local.databasePort}/${local.databaseName}?schema=${local.databaseSchema}`}
              />
              <PathTile
                icon={Database}
                label="Modo de base"
                value={local.databaseMode === 'lan' ? 'LAN / servidor' : 'Local embebido'}
              />
              <PathTile
                icon={Database}
                label="Runtime PostgreSQL"
                value={
                  local.postgresRuntime === 'embedded-local'
                    ? 'Incluido en VetCare Pro'
                    : 'Base externa configurada'
                }
              />
            </div>
          ) : (
            <SettingsSkeleton rows={4} />
          )}
        </Card>

        <Card className="p-5">
          <SectionHeader
            icon={Network}
            title="Estado LAN"
            description="Configuracion de red activa para esta instalacion de VetCare Pro."
          />
          <div className="mt-5 space-y-3">
            <ReadinessLine label={`Modo actual: ${runtimeModeLabels[config.mode]}`} ready />
            <ReadinessLine label="Frontend Electron" ready />
            <ReadinessLine label="Conexion por API" ready />
            <ReadinessLine label="PostgreSQL centralizado en servidor" ready={config.mode !== 'lan-client' ? Boolean(local?.lanReady) : true} />
            <ReadinessLine label="Archivos clinicos centralizados" ready />
          </div>
          <div className="mt-5 rounded-2xl bg-teal-50 p-4 text-sm leading-6 text-teal-800">
            <p className="font-bold">Conexion activa</p>
            <p className="mt-1 break-all font-mono text-xs font-semibold">
              {config.apiBaseUrl}
            </p>
            <p className="mt-2">
              {config.mode === 'lan-client'
                ? 'Esta PC no guarda la base de datos; trabaja contra el servidor configurado.'
                : 'Esta PC puede operar como instalacion local o como servidor para otras computadoras.'}
            </p>
            <Button
              type="button"
              onClick={openConfigurator}
              className="mt-4 h-10 rounded-xl bg-teal-600 px-4 text-white hover:bg-teal-700"
            >
              Cambiar configuracion LAN
            </Button>
          </div>
        </Card>
      </section>
    </>
  );
}

function StatusBanner({
  tone,
  message,
  onClose,
}: {
  tone: 'success' | 'error';
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        'mb-4 flex items-center justify-between rounded-xl border px-4 py-3 text-sm',
        tone === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-rose-200 bg-rose-50 text-rose-700',
      )}
    >
      <span>{message}</span>
      <button type="button" onClick={onClose}>
        <X className="size-4" />
      </button>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-700">
        <Icon className="size-5" />
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function SettingsMetric({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
  tone: 'teal' | 'blue' | 'amber' | 'violet';
}) {
  const tones = {
    teal: 'bg-teal-50 text-teal-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
  };
  return (
    <Card className="flex items-center gap-4 p-4">
      <div
        className={cn(
          'grid size-12 shrink-0 place-items-center rounded-2xl',
          tones[tone],
        )}
      >
        <Icon className="size-6" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>
        <p className="mt-1 truncate text-lg font-bold text-slate-900">{value}</p>
        <p className="truncate text-xs text-slate-500">{helper}</p>
      </div>
    </Card>
  );
}

function NumberSetting({
  label,
  suffix,
  value,
  disabled,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          min={1}
          value={value}
          onChange={(event) => onChange(Math.max(1, Number(event.target.value)))}
          disabled={disabled}
          className={`${clinicalInputClass} pr-12`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] font-semibold text-slate-400">
          {suffix}
        </span>
      </div>
    </label>
  );
}

function PathTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 gap-3 rounded-2xl bg-slate-50 p-4">
      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-slate-500">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>
        <p className="mt-1 break-all text-xs font-semibold leading-5 text-slate-700">
          {value || '-'}
        </p>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function ReadinessLine({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <Badge
        className={
          ready
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-amber-50 text-amber-700'
        }
      >
        {ready ? (
          <CheckCircle2 className="mr-1 size-3.5" />
        ) : (
          <Clock3 className="mr-1 size-3.5" />
        )}
        {ready ? 'Listo' : 'Futuro'}
      </Badge>
    </div>
  );
}

function SettingsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="mt-5 grid gap-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-11 animate-pulse rounded-xl bg-slate-100"
        />
      ))}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return 'Sin cambios guardados';
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
