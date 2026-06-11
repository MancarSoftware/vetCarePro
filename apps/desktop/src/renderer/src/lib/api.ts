const API_URL =
  import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4782/api';

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

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.accessToken
          ? { Authorization: `Bearer ${options.accessToken}` }
          : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch {
    throw new ApiError(
      'No se pudo conectar con el servicio local de VetCare Pro.',
    );
  }

  if (!response.ok) {
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

  return response.json() as Promise<T>;
}

export function getJson<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  return apiRequest<T>(path, { signal });
}
