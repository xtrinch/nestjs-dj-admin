type UserPermissionSource = { permissions?: string[] };

export function getUserPermissions(user: UserPermissionSource): string[] {
  const normalizedPermissions = (user.permissions ?? [])
    .map((permission) => permission?.trim())
    .filter((permission): permission is string => Boolean(permission));

  return Array.from(new Set(normalizedPermissions));
}

export function describeUserPermissions(user: UserPermissionSource): string {
  const permissions = getUserPermissions(user);
  return permissions.length > 0 ? permissions.join(', ') : '(none)';
}
