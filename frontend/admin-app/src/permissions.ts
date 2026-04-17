import type { AdminUser, ResourceSchema } from './types.js';

function getUserPermissions(user: AdminUser): string[] {
  const normalizedPermissions = (user.permissions ?? []).filter(
    (permission): permission is string => Boolean(permission),
  );

  return Array.from(new Set(normalizedPermissions));
}

export function canWriteResource(resource: ResourceSchema, user: AdminUser): boolean {
  if (user.isSuperuser === true) {
    return true;
  }

  const allowedPermissions =
    [`${resource.resourceName}.write`];

  const userPermissions = getUserPermissions(user);
  return allowedPermissions.some((permission) => userPermissions.includes(permission));
}
