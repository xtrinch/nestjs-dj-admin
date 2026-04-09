import { SetMetadata } from '@nestjs/common';
import { ADMIN_RESOURCE_METADATA } from '../admin.constants.js';
import type { AdminResourceOptions } from '../types/admin.types.js';

export function AdminResource(options: AdminResourceOptions): ClassDecorator {
  return SetMetadata(ADMIN_RESOURCE_METADATA, options);
}
