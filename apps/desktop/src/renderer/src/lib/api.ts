const FALLBACK_API_URL = 'http://127.0.0.1:4782/api';
const STATIC_API_URL = import.meta.env.VITE_API_URL as string | undefined;

function normalizeApiBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

async function resolveApiBaseUrl(): Promise<string> {
  if (STATIC_API_URL) {
    return normalizeApiBaseUrl(STATIC_API_URL);
  }

  try {
    const config = await window.vetcare?.runtime.getConfig();
    if (config?.apiBaseUrl) {
      return normalizeApiBaseUrl(config.apiBaseUrl);
    }
  } catch {
    // The browser preview and early boot can fall back to the local API.
  }

  return FALLBACK_API_URL;
}

interface ApiErrorPayload {
  message?: string | string[];
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken?: string | null;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

async function throwResponseError(response: Response): Promise<never> {
  let payload: ApiErrorPayload | null = null;
  try {
    payload = (await response.json()) as ApiErrorPayload;
  } catch {
    payload = null;
  }
  const message = Array.isArray(payload?.message)
    ? payload.message[0]
    : payload?.message;
  throw new ApiError(
    message || 'El servicio local no pudo completar la solicitud.',
    response.status,
  );
}

async function performRequest(
  path: string,
  options: ApiRequestOptions,
): Promise<Response> {
  const formData = isFormData(options.body);
  let requestBody: BodyInit | undefined;
  if (options.body !== undefined) {
    requestBody = isFormData(options.body)
      ? options.body
      : JSON.stringify(options.body);
  }
  try {
    const apiBaseUrl = await resolveApiBaseUrl();
    return await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body && !formData
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(options.accessToken
          ? { Authorization: `Bearer ${options.accessToken}` }
          : {}),
      },
      body: requestBody,
      signal: options.signal,
    });
  } catch {
    throw new ApiError(
      'No se pudo conectar con el servicio de VetCare Pro.',
    );
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await performRequest(path, options);

  if (!response.ok) {
    return throwResponseError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function apiBlobRequest(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Blob> {
  const response = await performRequest(path, options);
  if (!response.ok) {
    return throwResponseError(response);
  }
  return response.blob();
}

export function getJson<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  return apiRequest<T>(path, { signal });
}
