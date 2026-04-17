import type { AdminAuthUser } from '../types/admin.types.js';

type UserRoleSource = Pick<AdminAuthUser, 'role' | 'roles'>;

export function getUserRoles(user: UserRoleSource): string[] {
  const normalizedRoles = [user.role, ...(user.roles ?? [])]
    .map((role) => role?.trim())
    .filter((role): role is string => Boolean(role));

  return Array.from(new Set(normalizedRoles));
}

export function getPrimaryUserRole(user: UserRoleSource): string | null {
  return getUserRoles(user)[0] ?? null;
}

export function describeUserRoles(user: UserRoleSource): string {
  const roles = getUserRoles(user);
  return roles.length > 0 ? roles.join(', ') : '(none)';
}
