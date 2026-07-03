export const DEFAULT_RUNTIME_MODE = 'local';
export const DEFAULT_SERVER_HOST = '127.0.0.1';
export const DEFAULT_API_PORT = 4782;

export const VETCARE_RUNTIME_MODES = [
  'local',
  'lan-server',
  'lan-client',
] as const;

export type VetCareRuntimeMode = (typeof VETCARE_RUNTIME_MODES)[number];

export interface VetCareRuntimeConfig {
  configured: boolean;
  mode: VetCareRuntimeMode;
  serverHost: string;
  apiPort: number;
  apiBaseUrl: string;
  healthUrl: string;
  updatedAt: string;
}

export interface SaveVetCareRuntimeConfigInput {
  configured?: boolean;
  mode?: VetCareRuntimeMode | string;
  serverHost?: string;
  apiPort?: number | string;
  technicalCode?: string;
}

export interface VetCareDeviceIdentity {
  deviceId: string;
  deviceName: string;
}

export interface VetCareConnectionTestResult {
  ok: boolean;
  status?: number;
  apiBaseUrl: string;
  healthUrl: string;
  message: string;
  checkedAt: string;
}

export type VetCareLanAddressKind = 'recommended' | 'virtual' | 'other';

export interface VetCareLanAddress {
  name: string;
  address: string;
  kind: VetCareLanAddressKind;
  label: string;
  hint: string;
}

function isRuntimeMode(value: unknown): value is VetCareRuntimeMode {
  return (
    typeof value === 'string' &&
    VETCARE_RUNTIME_MODES.includes(value as VetCareRuntimeMode)
  );
}

export function normalizeRuntimeMode(value: unknown): VetCareRuntimeMode {
  return isRuntimeMode(value) ? value : DEFAULT_RUNTIME_MODE;
}

export function extractPortFromHost(value: unknown): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const raw = value.trim();
  if (!raw) {
    return undefined;
  }

  try {
    const url = new URL(raw.startsWith('http') ? raw : `http://${raw}`);
    return url.port ? Number(url.port) : undefined;
  } catch {
    const match = raw.match(/:(\d{2,5})(?:\/.*)?$/);
    return match ? Number(match[1]) : undefined;
  }
}

export function normalizeApiPort(value: unknown): number {
  const port = typeof value === 'string' ? Number(value.trim()) : Number(value);
  if (Number.isInteger(port) && port > 0 && port <= 65535) {
    return port;
  }
  return DEFAULT_API_PORT;
}

export function normalizeServerHost(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_SERVER_HOST;
  }

  const raw = value.trim();
  if (!raw) {
    return DEFAULT_SERVER_HOST;
  }

  try {
    const url = new URL(raw.startsWith('http') ? raw : `http://${raw}`);
    return url.hostname || DEFAULT_SERVER_HOST;
  } catch {
    const withoutProtocol = raw.replace(/^https?:\/\//i, '');
    const withoutPath = withoutProtocol.split('/')[0] ?? '';
    const withoutPort = withoutPath.includes(':')
      ? withoutPath.split(':')[0]
      : withoutPath;
    return withoutPort.trim() || DEFAULT_SERVER_HOST;
  }
}

export function runtimeApiHost(
  config: Pick<VetCareRuntimeConfig, 'mode' | 'serverHost'>,
): string {
  return config.mode === 'lan-client' ? config.serverHost : DEFAULT_SERVER_HOST;
}

export function buildApiBaseUrl(
  config: Pick<VetCareRuntimeConfig, 'mode' | 'serverHost' | 'apiPort'>,
): string {
  return `http://${runtimeApiHost(config)}:${config.apiPort}/api`;
}

export function buildHealthUrl(
  config: Pick<VetCareRuntimeConfig, 'mode' | 'serverHost' | 'apiPort'>,
): string {
  return `${buildApiBaseUrl(config)}/health`;
}

export function normalizeRuntimeConfig(
  input: SaveVetCareRuntimeConfigInput = {},
): VetCareRuntimeConfig {
  const mode = normalizeRuntimeMode(input.mode);
  const serverHost = normalizeServerHost(input.serverHost);
  const extractedPort = extractPortFromHost(input.serverHost);
  const apiPort = normalizeApiPort(input.apiPort ?? extractedPort);
  const configured = input.configured === true;
  const base = { mode, serverHost, apiPort };

  return {
    configured,
    ...base,
    apiBaseUrl: buildApiBaseUrl(base),
    healthUrl: buildHealthUrl(base),
    updatedAt: new Date().toISOString(),
  };
}

export function persistedRuntimeConfig(
  config: VetCareRuntimeConfig,
): Pick<
  VetCareRuntimeConfig,
  'configured' | 'mode' | 'serverHost' | 'apiPort' | 'updatedAt'
> {
  return {
    configured: config.configured,
    mode: config.mode,
    serverHost: config.serverHost,
    apiPort: config.apiPort,
    updatedAt: config.updatedAt,
  };
}
