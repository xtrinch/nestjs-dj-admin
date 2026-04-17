import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type {
  AdminRequestUser,
  AdminResourceSchema,
} from '../types/admin.types.js';
import type {
  AdminNavItemSchema,
  AdminPageSchema,
  AdminWidgetSchema,
} from '../../extension-api/types.js';

@Injectable()
export class AdminPermissionService {
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

  private assertPermission(
    user: AdminRequestUser,
    roles: string[] | undefined,
    permission: 'read' | 'write',
  ): void {
    if (!this.hasPermission(user, roles)) {
      throw new ForbiddenException(`Missing ${permission} permission for role "${user.role}"`);
    }
  }

  private hasPermission(user: AdminRequestUser, roles: string[] | undefined): boolean {
    if (!roles || roles.length === 0) {
      return true;
    }

    return roles.includes(user.role);
  }
}
