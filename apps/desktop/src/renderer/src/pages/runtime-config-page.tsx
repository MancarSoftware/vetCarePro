import { BrandLogo } from '@/components/brand/brand-logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  LoaderCircle,
  Monitor,
  Network,
  Server,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

type RuntimeMode = 'local' | 'lan-server' | 'lan-client';

const modeOptions: Array<{
  mode: RuntimeMode;
  title: string;
  subtitle: string;
  description: string;
  icon: typeof Monitor;
}> = [
  {
    mode: 'local',
    title: 'Una sola PC',
    subtitle: 'Version local clasica',
    description: 'La base de datos, API, archivos y backups viven en este equipo.',
    icon: Monitor,
  },
  {
    mode: 'lan-server',
    title: 'Servidor LAN',
    subtitle: 'PC principal de la veterinaria',
    description: 'Esta PC guarda los datos y permite que otros equipos se conecten.',
    icon: Server,
  },
  {
    mode: 'lan-client',
    title: 'Cliente LAN',
    subtitle: 'Recepcion, veterinario o caja',
    description: 'Esta PC se conecta al servidor usando la IP de la red local.',
    icon: Network,
  },
];

function runtimeBridge() {
  return window.vetcare?.runtime;
}

function normalizePort(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 5);
  if (!digits) return '';
  const port = Number(digits);
  if (port > 65535) return '65535';
  return String(port);
}

function apiPreview(mode: RuntimeMode, serverHost: string, apiPort: string) {
  const host = mode === 'lan-client' ? serverHost || '192.168.1.10' : '127.0.0.1';
  return `http://${host}:${apiPort || '4782'}/api`;
}

async function fallbackTestConnection(
  mode: RuntimeMode,
  serverHost: string,
  apiPort: string,
): Promise<VetCareConnectionTestResult> {
  const apiBaseUrl = apiPreview(mode, serverHost, apiPort);
  const healthUrl = `${apiBaseUrl}/health`;
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(healthUrl, {
      signal: AbortSignal.timeout(2500),
    });
    return {
      ok: response.ok,
      status: response.status,
      apiBaseUrl,
      healthUrl,
      message: response.ok
        ? 'Conexion correcta con la API de VetCare Pro.'
        : `La API respondio con estado ${response.status}.`,
      checkedAt,
    };
  } catch (error) {
    return {
      ok: false,
      apiBaseUrl,
      healthUrl,
      message:
        error instanceof Error
          ? `No se pudo conectar con la API: ${error.message}`
          : 'No se pudo conectar con la API.',
      checkedAt,
    };
  }
}

export function RuntimeConfigPage({
  initialConfig,
  loadError,
  onConfigured,
  onCancel,
}: {
  initialConfig: VetCareRuntimeConfig;
  loadError?: string | null;
  onConfigured: (config: VetCareRuntimeConfig) => void;
  onCancel?: () => void;
}) {
  const [mode, setMode] = useState<RuntimeMode>(initialConfig.mode);
  const [serverHost, setServerHost] = useState(
    initialConfig.serverHost === '127.0.0.1' ? '' : initialConfig.serverHost,
  );
  const [apiPort, setApiPort] = useState(String(initialConfig.apiPort || 4782));
  const [lanAddresses, setLanAddresses] = useState<VetCareLanAddress[]>([]);
  const [result, setResult] = useState<VetCareConnectionTestResult | null>(null);
  const [error, setError] = useState<string | null>(loadError ?? null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [showFirewallHelp, setShowFirewallHelp] = useState(false);
  const [copiedFirewallCommand, setCopiedFirewallCommand] = useState(false);

  const selectedMode = useMemo(
    () => modeOptions.find((option) => option.mode === mode) ?? modeOptions[0],
    [mode],
  );
  const preview = apiPreview(mode, serverHost, apiPort);
  const firewallCommand = `New-NetFirewallRule -DisplayName "VetCare Pro API LAN" -Direction Inbound -Protocol TCP -LocalPort ${
    apiPort || '4782'
  } -Action Allow -Profile Private`;
  const SelectedIcon = selectedMode.icon;

  useEffect(() => {
    if (mode !== 'lan-server') return;

    let mounted = true;
    void (async () => {
      try {
        const addresses = await runtimeBridge()?.getLanAddresses();
        if (mounted) {
          setLanAddresses(addresses ?? []);
        }
      } catch {
        if (mounted) {
          setLanAddresses([]);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [mode]);

  const buildInput = () => ({
    mode,
    serverHost: mode === 'lan-client' ? serverHost.trim() : '127.0.0.1',
    apiPort: apiPort || '4782',
  });
  const handleCopyAddress = async (address: string) => {
    setError(null);
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      window.setTimeout(() => {
        setCopiedAddress((current) => (current === address ? null : current));
      }, 1800);
    } catch {
      setError(
        `No se pudo copiar automaticamente. Copia manualmente esta IP: ${address}`,
      );
    }
  };

  const handleCopyFirewallCommand = async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(firewallCommand);
      setCopiedFirewallCommand(true);
      window.setTimeout(() => {
        setCopiedFirewallCommand(false);
      }, 1800);
    } catch {
      setError(
        'No se pudo copiar el comando. Puedes copiarlo manualmente desde el bloque de firewall.',
      );
    }
  };

  const handleTestConnection = async () => {
    setError(null);
    setResult(null);

    if (mode === 'lan-client' && !serverHost.trim()) {
      setError('Ingresa la IP de la PC servidor antes de probar conexion.');
      return;
    }

    setIsTesting(true);
    try {
      const input = buildInput();
      const connectionResult = runtimeBridge()
        ? await runtimeBridge()!.testConnection(input)
        : await fallbackTestConnection(mode, input.serverHost, String(input.apiPort));
      setResult(connectionResult);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (mode === 'lan-client' && !serverHost.trim()) {
      setError('Ingresa la IP de la PC servidor. Ejemplo: 192.168.1.10');
      return;
    }

    setIsSaving(true);
    try {
      const input = buildInput();
      const saved = runtimeBridge()
        ? await runtimeBridge()!.saveConfig(input)
        : {
            configured: true,
            mode,
            serverHost: input.serverHost,
            apiPort: Number(input.apiPort),
            apiBaseUrl: preview,
            healthUrl: `${preview}/health`,
            updatedAt: new Date().toISOString(),
          };
      onConfigured(saved);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'No fue posible guardar la configuracion LAN.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-slate-950">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-br from-teal-800 via-teal-700 to-cyan-600" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between text-white">
          <BrandLogo inverted iconClassName="size-12" textClassName="text-2xl" />
          <div className="hidden items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur md:flex">
            <ShieldCheck className="size-4" />
            Configuracion inicial segura
          </div>
        </header>

        <main className="my-auto grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="relative overflow-hidden rounded-[2rem] border border-teal-200/20 bg-gradient-to-br from-slate-950 via-teal-950 to-teal-800 p-7 text-white shadow-2xl shadow-teal-950/25">
            <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 left-0 size-80 rounded-full bg-teal-300/10 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-100">
                VetCare Pro LAN
              </p>
              <h1 className="mt-4 text-4xl font-black leading-tight tracking-[-0.05em] text-white drop-shadow-sm">
                Define como trabajara esta computadora.
              </h1>
              <p className="mt-4 max-w-xl text-sm font-medium leading-6 text-cyan-50/90">
                Para una sola PC, todo queda local. Para una clinica con varias
                computadoras, una PC sera servidor y las demas se conectaran a
                su IP dentro de la red.
              </p>

              <div className="mt-8 space-y-3">
                {modeOptions.map((option) => {
                  const Icon = option.icon;
                  const active = option.mode === mode;
                  return (
                    <button
                      key={option.mode}
                      type="button"
                      onClick={() => {
                        setMode(option.mode);
                        setResult(null);
                        setError(null);
                      }}
                      className={cn(
                        'flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition',
                        active
                          ? 'border-white bg-white text-slate-950 shadow-xl shadow-cyan-950/25 ring-2 ring-white/50'
                          : 'border-cyan-100/20 bg-slate-900/55 text-white shadow-lg shadow-slate-950/10 hover:border-cyan-100/40 hover:bg-slate-800/80',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-12 shrink-0 place-items-center rounded-2xl',
                          active
                            ? 'bg-teal-50 text-teal-700'
                            : 'bg-cyan-300/15 text-cyan-100',
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-black">
                          {option.title}
                        </span>
                        <span
                          className={cn(
                            'mt-1 block text-xs font-medium leading-5',
                            active ? 'text-slate-500' : 'text-cyan-50/80',
                          )}
                        >
                          {option.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
          <form
            onSubmit={handleSubmit}
            className="rounded-[2rem] border border-slate-200/80 bg-white p-7 shadow-2xl shadow-slate-900/10"
          >
            <div className="flex items-start gap-4">
              <div className="grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                <SelectedIcon className="size-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">
                  {selectedMode.subtitle}
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
                  {selectedMode.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {selectedMode.description}
                </p>
              </div>
            </div>

            <div className="mt-7 space-y-5">
              {mode === 'lan-client' && (
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    IP de la PC servidor
                  </span>
                  <input
                    autoFocus
                    required
                    value={serverHost}
                    onChange={(event) => {
                      setServerHost(event.target.value);
                      setResult(null);
                    }}
                    placeholder="192.168.1.10"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Esta IP es la de la PC principal de la veterinaria, por ejemplo recepcion/servidor.
                  </p>
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Puerto API
                </span>
                <input
                  inputMode="numeric"
                  value={apiPort}
                  onChange={(event) => {
                    setApiPort(normalizePort(event.target.value));
                    setResult(null);
                  }}
                  placeholder="4782"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                />
              </label>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Conexion que usara esta PC
                </p>
                <p className="mt-2 break-all font-mono text-sm font-bold text-slate-800">
                  {preview}
                </p>
              </div>

              {mode === 'lan-server' && (
                <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-teal-800">
                    <Wifi className="size-4" />
                    IPs detectadas para conectar clientes
                  </div>
                  {lanAddresses.length > 0 ? (
                    <div className="mt-3 grid gap-3">
                      {lanAddresses.map((item) => {
                        const recommended = item.kind === 'recommended';
                        const virtual = item.kind === 'virtual';

                        return (
                          <div
                            key={`${item.name}-${item.address}`}
                            className={cn(
                              'rounded-2xl border p-3 text-sm transition',
                              recommended &&
                                'border-emerald-200 bg-white shadow-sm shadow-emerald-900/5',
                              virtual &&
                                'border-slate-200 bg-slate-50 text-slate-500',
                              item.kind === 'other' &&
                                'border-amber-200 bg-amber-50/70 text-amber-900',
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-black text-slate-800">
                                  {item.name}
                                </p>
                                <p className="mt-1 font-mono text-base font-black text-slate-950">
                                  {item.address}:4782
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    'rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em]',
                                    recommended && 'bg-emerald-100 text-emerald-700',
                                    virtual && 'bg-slate-200 text-slate-600',
                                    item.kind === 'other' && 'bg-amber-100 text-amber-700',
                                  )}
                                >
                                  {item.label}
                                </span>
                                {recommended && (
                                  <button
                                    type="button"
                                    onClick={() => void handleCopyAddress(item.address)}
                                    className="inline-flex h-8 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                                  >
                                    <Copy className="size-3.5" />
                                    {copiedAddress === item.address
                                      ? 'Copiado'
                                      : 'Copiar IP'}
                                  </button>
                                )}
                              </div>
                            </div>
                            <p
                              className={cn(
                                'mt-2 text-xs font-medium leading-5',
                                recommended && 'text-emerald-700',
                                virtual && 'text-slate-500',
                                item.kind === 'other' && 'text-amber-800',
                              )}
                            >
                              {item.hint}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-teal-700">
                      No se detecto una IP LAN todavia. Conecta esta PC al router
                      y revisa con el comando ipconfig.
                    </p>
                  )}

                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-amber-700 shadow-sm">
                          <AlertTriangle className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-amber-900">
                            Firewall de Windows
                          </p>
                          <p className="mt-1 text-xs font-medium leading-5 text-amber-800">
                            Si una PC cliente no conecta, Windows puede estar
                            bloqueando el puerto {apiPort || '4782'} del servidor.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowFirewallHelp((current) => !current)}
                        className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-black text-amber-800 transition hover:bg-amber-100"
                      >
                        {showFirewallHelp
                          ? 'Ocultar instrucciones'
                          : 'Ver instrucciones'}
                      </button>
                    </div>

                    {showFirewallHelp && (
                      <div className="mt-4 space-y-3">
                        <ol className="space-y-2 text-xs font-medium leading-5 text-amber-900">
                          <li>
                            1. En la PC servidor, confirma que la red de Windows
                            este marcada como red privada.
                          </li>
                          <li>
                            2. Abre Seguridad de Windows, Firewall y proteccion
                            de red, y permite VetCare Pro en redes privadas.
                          </li>
                          <li>
                            3. Si todavia no conecta, abre PowerShell como
                            administrador y ejecuta este comando:
                          </li>
                        </ol>

                        <div className="rounded-2xl border border-amber-200 bg-white p-3">
                          <p className="break-all font-mono text-xs font-bold leading-5 text-slate-800">
                            {firewallCommand}
                          </p>
                          <button
                            type="button"
                            onClick={() => void handleCopyFirewallCommand()}
                            className="mt-3 inline-flex h-8 items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-800 transition hover:bg-amber-100"
                          >
                            <Copy className="size-3.5" />
                            {copiedFirewallCommand
                              ? 'Comando copiado'
                              : 'Copiar comando'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {mode === 'local' && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                  Esta opcion mantiene el comportamiento de VetCare Pro 1.0.0:
                  todo funciona en una sola computadora y no requiere configurar red.
                </div>
              )}

              {result && (
                <div
                  className={cn(
                    'flex items-start gap-3 rounded-2xl border p-4 text-sm leading-6',
                    result.ok
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-rose-200 bg-rose-50 text-rose-800',
                  )}
                >
                  {result.ok ? (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                  )}
                  <div>
                    <p className="font-bold">{result.message}</p>
                    <p className="mt-1 break-all text-xs opacity-80">
                      {result.healthUrl}
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
              {mode === 'lan-client' && (
                <Button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || isSaving}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-5 text-slate-700 hover:bg-slate-50"
                >
                  {isTesting && <LoaderCircle className="size-4 animate-spin" />}
                  {isTesting ? 'Probando...' : 'Probar conexion'}
                </Button>
              )}
              {onCancel && (
                <Button
                  type="button"
                  onClick={onCancel}
                  disabled={isSaving || isTesting}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-5 text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </Button>
              )}
              <Button
                type="submit"
                disabled={isSaving || isTesting}
                className="h-12 rounded-2xl bg-teal-600 px-6 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700"
              >
                {isSaving && <LoaderCircle className="size-4 animate-spin" />}
                {isSaving ? 'Guardando...' : 'Guardar y continuar'}
              </Button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
