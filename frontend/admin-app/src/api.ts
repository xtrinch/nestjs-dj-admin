const ADMIN_API_BASE = import.meta.env.DEV ? 'http://localhost:3000/admin' : '/admin';

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
    const message = response.status === 401 ? 'Unauthorized' : `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return (await response.json()) as T;
}
