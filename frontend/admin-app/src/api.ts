const ADMIN_API_BASE = import.meta.env.DEV ? 'http://localhost:3000/admin' : '/admin';

type ErrorPayload = {
  message?: string;
  errors?: Array<{ field: string; constraints?: Record<string, string> }>;
};

export class AdminApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors?: Array<{ field: string; constraints?: Record<string, string> }>,
  ) {
    super(message);
  }
}

export function adminUrl(path = ''): string {
  return `${ADMIN_API_BASE}${path}`;
}

export function adminFetch(path = '', init: RequestInit = {}): Promise<Response> {
  return fetch(adminUrl(path), {
    credentials: 'include',
    ...init,
    headers: {
      ...(init.headers ?? {}),
    },
  });
}

export async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let payload: ErrorPayload | null;

    try {
      payload = (await response.json()) as ErrorPayload;
    } catch {
      payload = null;
    }

    throw new AdminApiError(
      payload?.message ??
        (response.status === 401 ? 'Unauthorized' : `Request failed with ${response.status}`),
      response.status,
      payload?.errors,
    );
  }

  return (await response.json()) as T;
}
