import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { useRuntimeConfig } from '@/contexts/runtime-config-context';
import { cn } from '@/lib/utils';
import type {
  BackupRecord,
  BackupStatus,
  BackupSummary,
  PaginatedResponse,
} from '@/types/clinical';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  FileArchive,
  FileText,
  Folder,
  HardDrive,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

const emptySummary: BackupSummary = {
  backupPath: '',
  uploadsPath: '',
  totalBackups: 0,
  completed: 0,
  failed: 0,
  pending: 0,
  totalSizeBytes: 0,
  lastCompleted: null,
};

const statusPresentation: Record<
  BackupStatus,
  { label: string; className: string; icon: LucideIcon }
> = {
  COMPLETED: {
    label: 'Completado',
    className: 'bg-emerald-50 text-emerald-700',
    icon: CheckCircle2,
  },
  PENDING: {
    label: 'En proceso',
    className: 'bg-blue-50 text-blue-700',
    icon: Clock3,
  },
  FAILED: {
    label: 'Fallido',
    className: 'bg-rose-50 text-rose-700',
    icon: XCircle,
  },
};

export function BackupsPage() {
  const { request, requestBlob, user } = useAuth();
  const { config } = useRuntimeConfig();
  const [summary, setSummary] = useState(emptySummary);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [deletingBackup, setDeletingBackup] =
    useState<BackupRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = user?.permissions.includes('backups.manage') ?? false;
  const isLanClient = config.mode === 'lan-client';
  const canOperateBackups = canManage && !isLanClient;

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        page: '1',
        pageSize: '50',
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      const [summaryData, listData] = await Promise.all([
        request<BackupSummary>('/backups/summary'),
        request<PaginatedResponse<BackupRecord>>(
          `/backups?${query.toString()}`,
        ),
      ]);
      setSummary(summaryData);
      setBackups(listData.items);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible cargar los backups.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [request, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 180);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const createBackup = async () => {
    if (!canOperateBackups) {
      setError(
        isLanClient
          ? 'Los backups LAN se crean desde la PC Servidor LAN.'
          : 'No tienes permisos para crear backups.',
      );
      return;
    }

    setIsCreating(true);
    try {
      await request<BackupRecord>('/backups', { method: 'POST' });
      await refresh();
      setError(null);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'No fue posible crear el backup.',
      );
      await refresh();
    } finally {
      setIsCreating(false);
    }
  };

  const downloadBackupFile = async (
    backup: BackupRecord,
    kind: 'database' | 'files',
  ) => {
    if (!canOperateBackups) {
      setError(
        isLanClient
          ? 'Descarga los backups directamente desde la PC Servidor LAN.'
          : 'No tienes permisos para descargar backups.',
      );
      return;
    }

    const key = `${backup.id}-${kind}`;
    setIsDownloading(key);
    try {
      const blob = await requestBlob(`/backups/${backup.id}/${kind}`);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download =
        kind === 'database'
          ? fileName(backup.databasePath, 'vetcare_backup.sql')
          : fileName(backup.filesPath, 'vetcare_uploads.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setError(null);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'No fue posible descargar el archivo.',
      );
    } finally {
      setIsDownloading(null);
    }
  };

  const removeBackup = async () => {
    if (!deletingBackup) return;
    if (!canOperateBackups) {
      setDeletingBackup(null);
      setError(
        isLanClient
          ? 'Los backups solo se eliminan desde la PC Servidor LAN.'
          : 'No tienes permisos para eliminar backups.',
      );
      return;
    }

    try {
      await request(`/backups/${deletingBackup.id}`, { method: 'DELETE' });
      setDeletingBackup(null);
      await refresh();
    } catch (deleteError) {
      setDeletingBackup(null);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'No fue posible eliminar el backup.',
      );
    }
  };

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">
            Proteccion local
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-slate-950">
            Backups
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Respaldos manuales de PostgreSQL y archivos clinicos locales.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => void createBackup()}
            disabled={isCreating || !canOperateBackups}
            className={cn(
              'h-10 px-4 shadow-lg shadow-teal-600/20',
              canOperateBackups
                ? 'bg-teal-600 text-white hover:bg-teal-700'
                : 'border border-slate-200 bg-white text-slate-400',
            )}
            title={
              isLanClient
                ? 'Los backups se crean desde la PC Servidor LAN.'
                : 'Crear backup'
            }
          >
            {isCreating ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Archive className="size-4" />
            )}
            Crear backup
          </Button>
        )}
      </div>

      {isLanClient && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-black">Backups controlados por el servidor</p>
            <p className="mt-0.5 text-xs font-semibold leading-5">
              Esta PC esta en modo Cliente LAN. Los respaldos reales se crean,
              descargan y eliminan desde la PC Servidor LAN para proteger la
              base de datos y los archivos clinicos centrales.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X className="size-4" />
          </button>
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <BackupMetric
          icon={ShieldCheck}
          label="Backups completos"
          value={summary.completed.toString()}
          tone="teal"
        />
        <BackupMetric
          icon={HardDrive}
          label="Espacio usado"
          value={formatBytes(summary.totalSizeBytes)}
          tone="blue"
        />
        <BackupMetric
          icon={Clock3}
          label="En proceso"
          value={summary.pending.toString()}
          tone="violet"
        />
        <BackupMetric
          icon={XCircle}
          label="Fallidos"
          value={summary.failed.toString()}
          tone="rose"
        />
        <BackupMetric
          icon={Database}
          label="Total registros"
          value={summary.totalBackups.toString()}
          tone="amber"
        />
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-700">
              <Folder className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                Rutas locales protegidas
              </p>
              <p className="text-xs text-slate-400">
                {isLanClient
                  ? 'Estas carpetas pertenecen a la PC Servidor LAN.'
                  : 'Estas carpetas se usan en esta computadora.'}
              </p>
            </div>
          </div>
          <PathLine label="Backups" value={summary.backupPath || '-'} />
          <PathLine label="Archivos clinicos" value={summary.uploadsPath || '-'} />
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                Ultimo backup correcto
              </p>
              <p className="text-xs text-slate-400">
                Punto de recuperacion mas reciente.
              </p>
            </div>
          </div>
          {summary.lastCompleted ? (
            <div className="mt-5 grid grid-cols-3 gap-3">
              <InfoTile
                label="Fecha"
                value={format(
                  new Date(summary.lastCompleted.completedAt ?? summary.lastCompleted.createdAt),
                  'dd/MM/yyyy HH:mm',
                )}
              />
              <InfoTile
                label="Tamano"
                value={formatBytes(summary.lastCompleted.sizeBytes ?? 0)}
              />
              <InfoTile
                label="Creado por"
                value={
                  summary.lastCompleted.createdBy
                    ? `${summary.lastCompleted.createdBy.firstName} ${summary.lastCompleted.createdBy.lastName}`
                    : 'Sistema'
                }
              />
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Todavia no existe un backup completado.
            </p>
          )}
        </Card>
      </section>

      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <p className="text-sm font-bold text-slate-800">
              Historial de backups
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {isLanClient
                ? 'Historial central consultado desde el servidor.'
                : 'Base de datos SQL y archivos ZIP disponibles para descarga.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
            >
              <option value="">Todos los estados</option>
              <option value="COMPLETED">Completados</option>
              <option value="PENDING">En proceso</option>
              <option value="FAILED">Fallidos</option>
            </select>
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
          </div>
        </div>

        {isLoading ? (
          <BackupLoading />
        ) : backups.length ? (
          <div className="divide-y divide-slate-100">
            {backups.map((backup) => (
              <BackupRow
                key={backup.id}
                backup={backup}
                canOperateBackups={canOperateBackups}
                downloadingKey={isDownloading}
                onDownload={downloadBackupFile}
                onDelete={setDeletingBackup}
              />
            ))}
          </div>
        ) : (
          <div className="grid min-h-[360px] place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-teal-50 text-teal-600">
                <Archive className="size-8" />
              </div>
              <h2 className="mt-5 text-lg font-bold text-slate-900">
                No hay backups registrados
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {isLanClient
                  ? 'Cuando el servidor genere backups, apareceran aqui.'
                  : 'Crea el primer respaldo local para proteger la informacion.'}
              </p>
            </div>
          </div>
        )}
      </Card>

      {deletingBackup && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-6 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6">
            <div className="grid size-11 place-items-center rounded-xl bg-rose-50 text-rose-600">
              <Trash2 className="size-5" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">
              Eliminar backup
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Se eliminara el registro y los archivos locales asociados a este
              backup. Esta accion no afecta los datos actuales del sistema.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                onClick={() => setDeletingBackup(null)}
                className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => void removeBackup()}
                className="bg-rose-600 text-white hover:bg-rose-700"
              >
                Eliminar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function BackupRow({
  backup,
  canOperateBackups,
  downloadingKey,
  onDownload,
  onDelete,
}: {
  backup: BackupRecord;
  canOperateBackups: boolean;
  downloadingKey: string | null;
  onDownload: (backup: BackupRecord, kind: 'database' | 'files') => void;
  onDelete: (backup: BackupRecord) => void;
}) {
  const status = statusPresentation[backup.status];
  const StatusIcon = status.icon;
  const completed = backup.status === 'COMPLETED';

  return (
    <div className="grid grid-cols-[1.3fr_0.8fr_0.6fr_1fr_auto] items-center gap-4 px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-700">
          <Database className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-800">
              Backup {backup.id.slice(0, 8)}
            </p>
            <Badge className={status.className}>
              <StatusIcon className="mr-1 size-3.5" />
              {status.label}
            </Badge>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Creado {format(new Date(backup.createdAt), 'dd/MM/yyyy HH:mm')}
          </p>
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-slate-700">
          {backup.createdBy
            ? `${backup.createdBy.firstName} ${backup.createdBy.lastName}`
            : 'Sistema'}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-400">Responsable</p>
      </div>
      <div>
        <p className="text-xs font-bold text-slate-700">
          {formatBytes(backup.sizeBytes ?? 0)}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-400">Tamano</p>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-600">
          {backup.completedAt
            ? formatDistanceToNow(new Date(backup.completedAt), {
                addSuffix: true,
                locale: es,
              })
            : 'Pendiente'}
        </p>
        {backup.errorMessage && (
          <p className="mt-1 line-clamp-1 text-[11px] text-rose-500">
            {backup.errorMessage}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <BackupAction
          icon={FileText}
          label="SQL"
          disabled={!completed || !canOperateBackups}
          loading={downloadingKey === `${backup.id}-database`}
          onClick={() => onDownload(backup, 'database')}
        />
        <BackupAction
          icon={FileArchive}
          label="ZIP"
          disabled={!completed || !canOperateBackups}
          loading={downloadingKey === `${backup.id}-files`}
          onClick={() => onDownload(backup, 'files')}
        />
        <button
          type="button"
          onClick={() => onDelete(backup)}
          disabled={!canOperateBackups}
          className="grid h-9 min-w-9 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
          title={
            canOperateBackups
              ? 'Eliminar backup'
              : 'Disponible solo en Servidor LAN'
          }
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

function BackupAction({
  icon: Icon,
  label,
  disabled,
  loading,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {loading ? (
        <LoaderCircle className="size-3.5 animate-spin" />
      ) : (
        <Icon className="size-3.5" />
      )}
      {label}
    </button>
  );
}

function BackupMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: 'teal' | 'blue' | 'amber' | 'rose' | 'violet';
}) {
  const tones = {
    teal: 'bg-teal-50 text-teal-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    violet: 'bg-violet-50 text-violet-700',
  };
  return (
    <Card className="flex items-center gap-4 p-4">
      <div
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-xl',
          tones[tone],
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xl font-bold text-slate-900">{value}</p>
        <p className="truncate text-xs text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

function PathLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-4 rounded-2xl bg-slate-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-all text-xs font-semibold text-slate-600">
        {value}
      </p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 truncate text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function BackupLoading() {
  return (
    <div className="space-y-px">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-[84px] animate-pulse border-t border-slate-100 bg-slate-50/60"
        />
      ))}
    </div>
  );
}

function formatBytes(value: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function fileName(path: string | null, fallback: string) {
  if (!path) return fallback;
  return path.split(/[\\/]/).pop() || fallback;
}
