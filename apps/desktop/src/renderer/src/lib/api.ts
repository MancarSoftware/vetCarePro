const API_URL =
  import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4782/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function getJson<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch {
    throw new ApiError(
      'No se pudo conectar con el servicio local de VetCare Pro.',
    );
  }

  if (!response.ok) {
    throw new ApiError(
      'El servicio local no pudo completar la solicitud.',
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

