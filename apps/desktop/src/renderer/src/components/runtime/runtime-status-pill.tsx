import { cn } from '@/lib/utils';
import { useRuntimeConfig } from '@/contexts/runtime-config-context';
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  MonitorCog,
  Network,
  RefreshCw,
  Server,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ConnectionState = 'checking' | 'online' | 'offline';

const runtimeModeLabels: Record<VetCareRuntimeMode, string> = {
  local: 'Una sola PC',
  'lan-server': 'Servidor LAN',
  'lan-client': 'Cliente LAN',
};

const runtimeModeDescriptions: Record<VetCareRuntimeMode, string> = {
  local: 'Todo vive en este equipo.',
  'lan-server': 'Esta PC recibe conexiones de otros equipos.',
  'lan-client': 'Esta PC trabaja conectada al servidor.',
};

function runtimeModeIcon(mode: VetCareRuntimeMode) {
  if (mode === 'lan-server') return Server;
  if (mode === 'lan-client') return Network;
  return MonitorCog;
}

function runtimeBridge() {
  return window.vetcare?.runtime;
}

async function fallbackHealthCheck(
  config: VetCareRuntimeConfig,
): Promise<VetCareConnectionTestResult> {
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(config.healthUrl, {
      signal: AbortSignal.timeout(2500),
    });

    return {
      ok: response.ok,
      status: response.status,
      apiBaseUrl: config.apiBaseUrl,
      healthUrl: config.healthUrl,
      message: response.ok
        ? 'Conexion correcta con la API de VetCare Pro.'
        : `La API respondio con estado ${response.status}.`,
      checkedAt,
    };
  } catch (error) {
    return {
      ok: false,
      apiBaseUrl: config.apiBaseUrl,
      healthUrl: config.healthUrl,
      message:
        error instanceof Error
          ? `No se pudo conectar con la API: ${error.message}`
          : 'No se pudo conectar con la API.',
      checkedAt,
    };
  }
}

export function RuntimeStatusPill() {
  const { config, openConfigurator } = useRuntimeConfig();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ConnectionState>('checking');
  const [lastResult, setLastResult] =
    useState<VetCareConnectionTestResult | null>(null);
  const [lanAddresses, setLanAddresses] = useState<VetCareLanAddress[]>([]);

  const ModeIcon = runtimeModeIcon(config.mode);
  const recommendedAddresses = useMemo(
    () => lanAddresses.filter((address) => address.kind === 'recommended'),
    [lanAddresses],
  );

  const endpointLabel =
    config.mode === 'lan-client'
      ? `${config.serverHost}:${config.apiPort}`
      : config.mode === 'lan-server' && recommendedAddresses[0]
        ? `${recommendedAddresses[0].address}:${config.apiPort}`
        : `${config.serverHost}:${config.apiPort}`;

  const refreshStatus = useCallback(async () => {
    setStatus('checking');
    try {
      const result = runtimeBridge()
        ? await runtimeBridge()!.testConnection()
        : await fallbackHealthCheck(config);

      setLastResult(result);
      setStatus(result.ok ? 'online' : 'offline');
    } catch (error) {
      setLastResult({
        ok: false,
        apiBaseUrl: config.apiBaseUrl,
        healthUrl: config.healthUrl,
        message:
          error instanceof Error
            ? error.message
            : 'No se pudo verificar la conexion de VetCare Pro.',
        checkedAt: new Date().toISOString(),
      });
      setStatus('offline');
    }
  }, [config]);

  useEffect(() => {
    void refreshStatus();
    const interval = window.setInterval(() => void refreshStatus(), 30_000);
    return () => window.clearInterval(interval);
  }, [refreshStatus]);

  useEffect(() => {
    if (config.mode !== 'lan-server') {
      setLanAddresses([]);
      return;
    }

    let mounted = true;
    void (async () => {
      try {
        const addresses = await runtimeBridge()?.getLanAddresses();
        if (mounted) setLanAddresses(addresses ?? []);
      } catch {
        if (mounted) setLanAddresses([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [config.mode]);

  const statusLabel =
    status === 'checking'
      ? 'Verificando'
      : status === 'online'
        ? 'Conectado'
        : 'Sin conexion';

  return (
    <div className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          void refreshStatus();
        }}
        className="flex h-10 items-center gap-3 rounded-full border border-slate-200 bg-white px-3 text-left shadow-sm transition hover:border-teal-200 hover:bg-teal-50/40"
        title="Estado de conexion VetCare Pro"
      >
        <span
          className={cn(
            'grid size-7 place-items-center rounded-full',
            status === 'online' && 'bg-emerald-50 text-emerald-700',
            status === 'offline' && 'bg-rose-50 text-rose-700',
            status === 'checking' && 'bg-slate-50 text-slate-500',
          )}
        >
          {status === 'checking' ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : status === 'online' ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <AlertTriangle className="size-4" />
          )}
        </span>
        <span className="hidden xl:block">
          <span className="block text-xs font-black leading-4 text-slate-800">
            {runtimeModeLabels[config.mode]}
          </span>
          <span
            className={cn(
              'block text-[11px] font-bold leading-4',
              status === 'online' && 'text-emerald-600',
              status === 'offline' && 'text-rose-600',
              status === 'checking' && 'text-slate-500',
            )}
          >
            {statusLabel}
          </span>
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                <ModeIcon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-600">
                  Estado LAN
                </p>
                <p className="mt-1 text-sm font-black text-slate-950">
                  {runtimeModeLabels[config.mode]}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {runtimeModeDescriptions[config.mode]}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div
              className={cn(
                'flex items-center gap-3 rounded-2xl border p-3',
                status === 'online' && 'border-emerald-100 bg-emerald-50',
                status === 'offline' && 'border-rose-100 bg-rose-50',
                status === 'checking' && 'border-slate-100 bg-slate-50',
              )}
            >
              {status === 'checking' ? (
                <LoaderCircle className="size-5 animate-spin text-slate-500" />
              ) : status === 'online' ? (
                <CheckCircle2 className="size-5 text-emerald-700" />
              ) : (
                <AlertTriangle className="size-5 text-rose-700" />
              )}
              <div>
                <p className="text-sm font-black text-slate-900">
                  {statusLabel}
                </p>
                <p className="text-xs leading-5 text-slate-500">
                  {lastResult?.message ?? 'Verificando servicio local.'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                Conexion actual
              </p>
              <p className="mt-2 break-all font-mono text-xs font-black text-slate-800">
                {config.apiBaseUrl}
              </p>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Equipo: {endpointLabel}
              </p>
            </div>

            {config.mode === 'lan-server' && (
              <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-3">
                <p className="text-xs font-black text-teal-900">
                  IPs para clientes
                </p>
                {recommendedAddresses.length ? (
                  <div className="mt-2 space-y-2">
                    {recommendedAddresses.map((address) => (
                      <p
                        key={`${address.name}-${address.address}`}
                        className="break-all rounded-xl bg-white px-3 py-2 font-mono text-xs font-black text-slate-900"
                      >
                        {address.address}:{config.apiPort}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs leading-5 text-teal-700">
                    No se detecto una IP fisica recomendada todavia.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void refreshStatus()}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw className="size-4" />
                Actualizar
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openConfigurator();
                }}
                className="h-10 flex-1 rounded-xl bg-teal-600 px-3 text-xs font-black text-white transition hover:bg-teal-700"
              >
                Cambiar LAN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
