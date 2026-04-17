import type { AdminUser, ResourceSchema } from './types.js';

function getUserPermissions(user: AdminUser): string[] {
  const normalizedPermissions = (user.permissions ?? []).filter(
    (permission): permission is string => Boolean(permission),
  );

  return Array.from(new Set(normalizedPermissions));
}

export function canWriteResource(resource: ResourceSchema, user: AdminUser): boolean {
  const allowedPermissions = resource.permissions?.write;
  if (!allowedPermissions || allowedPermissions.length === 0) {
    return user.isSuperuser === true;
  }

  const userPermissions = getUserPermissions(user);
  return allowedPermissions.some((permission) => userPermissions.includes(permission));
}
