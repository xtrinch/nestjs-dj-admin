import 'reflect-metadata';
import { SetMetadata } from '@nestjs/common';
import type { AdminDtoFieldConfig } from '../types/admin.types.js';

export const ADMIN_DTO_FIELD_METADATA = Symbol('ADMIN_DTO_FIELD_METADATA');

export function AdminField(config: AdminDtoFieldConfig): PropertyDecorator {
  return SetMetadata(ADMIN_DTO_FIELD_METADATA, config);
}
