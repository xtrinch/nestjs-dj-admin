import type { AdminUser, ResourceSchema } from './types.js';

export function canWriteResource(resource: ResourceSchema, user: AdminUser): boolean {
  const allowedRoles = resource.permissions?.write;
  if (!allowedRoles || allowedRoles.length === 0) {
    return user.isSuperuser === true;
  }

  return allowedRoles.includes(user.role);
}
