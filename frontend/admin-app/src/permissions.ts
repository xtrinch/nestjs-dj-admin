import type { AdminUser, ResourceSchema } from './types.js';

function getUserRoles(user: AdminUser): string[] {
  const normalizedRoles = (user.roles ?? []).filter(
    (role): role is string => Boolean(role),
  );

  return Array.from(new Set(normalizedRoles));
}

export function canWriteResource(resource: ResourceSchema, user: AdminUser): boolean {
  const allowedRoles = resource.permissions?.write;
  if (!allowedRoles || allowedRoles.length === 0) {
    return user.isSuperuser === true;
  }

  const userRoles = getUserRoles(user);
  return allowedRoles.some((role) => userRoles.includes(role));
}
