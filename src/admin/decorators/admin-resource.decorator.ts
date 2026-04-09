import { SetMetadata } from '@nestjs/common';
import { ADMIN_RESOURCE_METADATA } from '../admin.constants.js';
import type { AdminEntity, AdminResourceOptions } from '../types/admin.types.js';

export function AdminResource<TModel extends AdminEntity>(
  options: AdminResourceOptions<TModel>,
): ClassDecorator {
  return SetMetadata(ADMIN_RESOURCE_METADATA, options);
}
