const ADMIN_API_BASE = import.meta.env.DEV ? 'http://localhost:3000/admin' : '/admin';

export function adminUrl(path = ''): string {
  return `${ADMIN_API_BASE}${path}`;
}
