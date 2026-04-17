import { adminFetch, readJson } from '../api.js';
import type { AdminAuthConfig, AdminUser } from '../types.js';

export async function getAdminAuthConfig(): Promise<AdminAuthConfig> {
  const response = await adminFetch('/_auth/config');
  return readJson<AdminAuthConfig>(response);
}

export async function getCurrentAdminUser(): Promise<AdminUser | null> {
  const response = await adminFetch('/_auth/me');
  if (response.status === 401) {
    return null;
  }

  const payload = await readJson<{ user: AdminUser }>(response);
  return payload.user;
}

export async function loginAdmin(email: string, password: string): Promise<AdminUser> {
  return loginAdminWithOptions(email, password, false);
}

export async function loginAdminWithOptions(
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<AdminUser> {
  const response = await adminFetch('/_auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email, password, rememberMe }),
  });

  const payload = await readJson<{ user: AdminUser }>(response);
  return payload.user;
}

export async function logoutAdmin(): Promise<void> {
  await adminFetch('/_auth/logout', {
    method: 'POST',
  });
}
