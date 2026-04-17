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
  AdminNavItemSchema,
  AdminPageSchema,
  AdminWidgetSchema,
} from '../../extension-api/types.js';

@Injectable()
export class AdminPermissionService {
  canReadResource(user: AdminRequestUser, schema: AdminResourceSchema): boolean {
    return this.hasPermission(user, schema.permissions?.read);
  }

  assertCanRead(user: AdminRequestUser, schema: AdminResourceSchema): void {
    this.assertPermission(user, schema.permissions?.read, 'read');
  }

  assertCanWrite(user: AdminRequestUser, schema: AdminResourceSchema): void {
    this.assertPermission(user, schema.permissions?.write, 'write');
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
    if (!permissions || permissions.length === 0) {
      return user.isSuperuser === true;
    }

    const userPermissions = getUserPermissions(user);
    return permissions.some((permission) => userPermissions.includes(permission));
  }
}
