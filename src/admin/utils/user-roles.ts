type UserRoleSource = { roles?: string[] };

export function getUserRoles(user: UserRoleSource): string[] {
  const normalizedRoles = (user.roles ?? [])
    .map((role) => role?.trim())
    .filter((role): role is string => Boolean(role));

  return Array.from(new Set(normalizedRoles));
}

export function describeUserRoles(user: UserRoleSource): string {
  const roles = getUserRoles(user);
  return roles.length > 0 ? roles.join(', ') : '(none)';
}
