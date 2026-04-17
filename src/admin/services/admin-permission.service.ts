import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type {
  AdminAuditOptions,
  AdminRequestUser,
  AdminResourceSchema,
} from '../types/admin.types.js';
import { describeUserRoles, getUserRoles } from '../utils/user-roles.js';
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

    return this.hasPermission(user, auditLog.permissions?.read ?? ['admin']);
  }

  assertCanReadAuditLog(user: AdminRequestUser, auditLog: AdminAuditOptions | undefined): void {
    if (!this.canReadAuditLog(user, auditLog)) {
      throw new ForbiddenException(`Missing read permission for audit log for roles "${describeUserRoles(user)}"`);
    }
  }

  private assertPermission(
    user: AdminRequestUser,
    roles: string[] | undefined,
    permission: 'read' | 'write',
  ): void {
    if (!this.hasPermission(user, roles)) {
      throw new ForbiddenException(`Missing ${permission} permission for roles "${describeUserRoles(user)}"`);
    }
  }

  private hasPermission(user: AdminRequestUser, roles: string[] | undefined): boolean {
    if (!roles || roles.length === 0) {
      return user.isSuperuser === true;
    }

    const userRoles = getUserRoles(user);
    return roles.some((role) => userRoles.includes(role));
  }
}
