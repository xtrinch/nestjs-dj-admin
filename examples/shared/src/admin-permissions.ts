import { Role } from './modules/user/shared.js';

export const DEMO_PERMISSIONS = {
  audit: {
    read: 'audit.read',
  },
  orders: {
    read: 'orders.read',
    write: 'orders.write',
  },
} as const;

export function permissionsForDemoRole(role: Role | string): string[] {
  switch (role) {
    case Role.EDITOR:
      return [
        DEMO_PERMISSIONS.audit.read,
        DEMO_PERMISSIONS.orders.read,
        DEMO_PERMISSIONS.orders.write,
      ];
    default:
      return [];
  }
}
