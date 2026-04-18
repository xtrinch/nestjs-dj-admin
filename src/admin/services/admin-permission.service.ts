import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type {
  AdminAuditOptions,
  AdminRequestUser,
  AdminResourceSchema,
} from '../types/admin.types.js';
import { describeUserPermissions, getUserPermissions } from '../utils/user-permissions.js';
import type {
  AdminExtensionActionPermissions,
  AdminNavItemSchema,
  AdminExtensionPostEndpointDefinition,
  AdminPageSchema,
  AdminWidgetSchema,
} from '../../extension-api/types.js';

@Injectable()
export class AdminPermissionService {
  canReadResource(user: AdminRequestUser, schema: AdminResourceSchema): boolean {
    return this.hasPermission(user, this.getResourcePermissions(schema, 'read'));
  }

  assertCanRead(user: AdminRequestUser, schema: AdminResourceSchema): void {
    this.assertPermission(user, this.getResourcePermissions(schema, 'read'), 'read');
  }

  assertCanWrite(user: AdminRequestUser, schema: AdminResourceSchema): void {
    this.assertPermission(user, this.getResourcePermissions(schema, 'write'), 'write');
  }

  canReadPage(user: AdminRequestUser, page: AdminPageSchema): boolean {
    return this.hasPermission(user, page.permissions?.read);
  }

  canReadNavItem(user: AdminRequestUser, navItem: AdminNavItemSchema): boolean {
    return this.hasPermission(user, navItem.permissions?.read);
  }

  canReadWidget(user: AdminRequestUser, widget: AdminWidgetSchema): boolean {
    return this.hasPermission(user, widget.permissions?.read);
  }

  canReadExtensionEndpoint(
    user: AdminRequestUser,
    endpoint: { permissions?: { read?: string[] } },
  ): boolean {
    return this.hasPermission(user, endpoint.permissions?.read);
  }

  assertCanExecuteExtensionAction(
    user: AdminRequestUser,
    action:
      | AdminExtensionActionPermissions
      | AdminExtensionPostEndpointDefinition
      | { permissions?: AdminExtensionActionPermissions },
  ): void {
    const permissions = resolveExtensionActionPermissions(action);
    if (!this.hasPermission(user, permissions)) {
      throw new ForbiddenException(`Missing action permission for permissions "${describeUserPermissions(user)}"`);
    }
  }

  canReadAuditLog(user: AdminRequestUser, auditLog: AdminAuditOptions | undefined): boolean {
    if (auditLog?.enabled !== true) {
      return false;
    }

    return this.hasPermission(user, auditLog.permissions?.read);
  }

  assertCanReadAuditLog(user: AdminRequestUser, auditLog: AdminAuditOptions | undefined): void {
    if (!this.canReadAuditLog(user, auditLog)) {
      throw new ForbiddenException(`Missing read permission for audit log for permissions "${describeUserPermissions(user)}"`);
    }
  }

  private assertPermission(
    user: AdminRequestUser,
    permissions: string[] | undefined,
    permission: 'read' | 'write',
  ): void {
    if (!this.hasPermission(user, permissions)) {
      throw new ForbiddenException(`Missing ${permission} permission for permissions "${describeUserPermissions(user)}"`);
    }
  }

  private hasPermission(user: AdminRequestUser, permissions: string[] | undefined): boolean {
    if (user.isSuperuser === true) {
      return true;
    }

    if (!permissions || permissions.length === 0) {
      return false;
    }

    const userPermissions = getUserPermissions(user);
    return permissions.some((permission) => userPermissions.includes(permission));
  }

  private getResourcePermissions(
    schema: AdminResourceSchema,
    permission: 'read' | 'write',
  ): string[] {
    return [`${schema.resourceName}.${permission}`];
  }
}

function resolveExtensionActionPermissions(
  action:
    | AdminExtensionActionPermissions
    | AdminExtensionPostEndpointDefinition
    | { permissions?: AdminExtensionActionPermissions },
): string[] | undefined {
  if ('permissions' in action) {
    return action.permissions?.execute;
  }

  return (action as AdminExtensionActionPermissions).execute;
}
