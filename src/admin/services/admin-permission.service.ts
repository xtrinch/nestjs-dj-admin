import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AdminRequestUser, AdminResourceSchema } from '../types/admin.types.js';

@Injectable()
export class AdminPermissionService {
  assertCanRead(user: AdminRequestUser, schema: AdminResourceSchema): void {
    this.assertPermission(user, schema.permissions?.read, 'read');
  }

  assertCanWrite(user: AdminRequestUser, schema: AdminResourceSchema): void {
    this.assertPermission(user, schema.permissions?.write, 'write');
  }

  private assertPermission(
    user: AdminRequestUser,
    roles: string[] | undefined,
    permission: 'read' | 'write',
  ): void {
    if (!roles || roles.length === 0) {
      return;
    }

    if (!roles.includes(user.role)) {
      throw new ForbiddenException(`Missing ${permission} permission for role "${user.role}"`);
    }
  }
}
