import './types/express-augmentation.js';

export { AdminModule } from './admin/admin.module.js';
export { AdminRegistry } from './admin/admin.registry.js';
export { ADMIN_ADAPTER, ADMIN_OPTIONS, ADMIN_RESOURCE_METADATA } from './admin/admin.constants.js';

export { AdminResource } from './admin/decorators/admin-resource.decorator.js';
export { AdminField, ADMIN_DTO_FIELD_METADATA } from './admin/decorators/admin-field.decorator.js';

export { AdminService } from './admin/services/admin.service.js';
export { AdminAuthService } from './admin/services/admin-auth.service.js';
export { AdminPermissionService } from './admin/services/admin-permission.service.js';
export { DtoIntrospectorService } from './admin/services/dto-introspector.service.js';

export { PrismaAdminAdapter } from './admin/adapters/prisma.adapter.js';
export { TypeOrmAdminAdapter } from './admin/adapters/typeorm.adapter.js';
export { InMemoryAdminAdapter } from './admin/adapters/in-memory.adapter.js';

export type {
  AdminAction,
  AdminAuthCredentials,
  AdminAuthOptions,
  AdminActionContext,
  AdminAdapter,
  AdminDtoFieldConfig,
  AdminFieldRelationOption,
  AdminFieldSchema,
  AdminListQuery,
  AdminListResult,
  AdminModuleOptions,
  AdminPermissions,
  AdminRequestUser,
  AdminResourceOptions,
  AdminResourceSchema,
  PermissionRole,
} from './admin/types/admin.types.js';
