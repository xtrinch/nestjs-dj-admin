import 'reflect-metadata';
import type { AdminDtoFieldConfig } from '../types/admin.types.js';

export const ADMIN_DTO_FIELD_METADATA = Symbol('ADMIN_DTO_FIELD_METADATA');

export function AdminField(config: AdminDtoFieldConfig): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(ADMIN_DTO_FIELD_METADATA, config, target, propertyKey);
  };
}
