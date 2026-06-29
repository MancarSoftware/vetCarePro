import { createHmac, timingSafeEqual } from 'node:crypto';

export const LICENSE_PREFIX = 'VCP-LAN-';
export const DEFAULT_LICENSE_SECRET =
  'vetcare-pro-lan-license-signing-key-v1-change-before-public-release';

export interface LanLicensePayload {
  product: 'VetCare Pro';
  edition: 'LAN';
  licenseId: string;
  clinicName: string;
  clientLimit: number;
  issuedAt: string;
  expiresAt?: string | null;
}

export interface VerifiedLanLicense {
  key: string;
  payload: LanLicensePayload;
  signature: string;
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalStringify(nested)}`)
    .join(',')}}`;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload: LanLicensePayload, secret: string): string {
  return createHmac('sha256', secret)
    .update(canonicalStringify(payload))
    .digest('base64url');
}

function assertPayload(value: unknown): asserts value is LanLicensePayload {
  if (!value || typeof value !== 'object') {
    throw new Error('La licencia LAN no contiene datos validos.');
  }

  const payload = value as Partial<LanLicensePayload>;
  if (
    payload.product !== 'VetCare Pro' ||
    payload.edition !== 'LAN' ||
    typeof payload.licenseId !== 'string' ||
    typeof payload.clinicName !== 'string' ||
    typeof payload.clientLimit !== 'number' ||
    !Number.isInteger(payload.clientLimit) ||
    payload.clientLimit < 1 ||
    typeof payload.issuedAt !== 'string'
  ) {
    throw new Error('La licencia LAN no corresponde a VetCare Pro.');
  }
}

export function createLanLicenseKey(
  payload: LanLicensePayload,
  secret: string,
): string {
  const signature = signPayload(payload, secret);
  return `${LICENSE_PREFIX}${base64UrlEncode(canonicalStringify(payload))}.${signature}`;
}

export function verifyLanLicenseKey(
  licenseKey: string,
  secret: string,
): VerifiedLanLicense {
  const normalized = licenseKey.trim();
  if (!normalized.startsWith(LICENSE_PREFIX)) {
    throw new Error('La licencia LAN no tiene el formato esperado.');
  }

  const body = normalized.slice(LICENSE_PREFIX.length);
  const [payloadPart, signature] = body.split('.');
  if (!payloadPart || !signature) {
    throw new Error('La licencia LAN esta incompleta.');
  }

  const payload = JSON.parse(base64UrlDecode(payloadPart)) as unknown;
  assertPayload(payload);

  const expected = signPayload(payload, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new Error('La firma de la licencia LAN no es valida.');
  }

  return {
    key: normalized,
    payload,
    signature,
  };
}
