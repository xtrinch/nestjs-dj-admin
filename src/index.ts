import './types/express-augmentation.js';

export { AdminModule } from './admin/admin.module.js';
export { AdminRegistry } from './admin/admin.registry.js';
export { ADMIN_ADAPTER, ADMIN_OPTIONS, ADMIN_RESOURCE_METADATA } from './admin/admin.constants.js';

export { AdminResource } from './admin/decorators/admin-resource.decorator.js';
export { AdminField, ADMIN_DTO_FIELD_METADATA } from './admin/decorators/admin-field.decorator.js';

export { AdminService } from './admin/services/admin.service.js';
export { AdminAuthService } from './admin/services/admin-auth.service.js';
export { AdminAuditService } from './admin/services/admin-audit.service.js';
export { AdminPermissionService } from './admin/services/admin-permission.service.js';
export { DtoIntrospectorService } from './admin/services/dto-introspector.service.js';
export { AdminUiService } from './admin/services/admin-ui.service.js';
export { adminSchemaFromClassValidator } from './admin/schema/class-validator-schema.provider.js';
export { adminSchemaFromZod } from './admin/schema/zod-schema.provider.js';
export { embedPageExtension } from './extensions/embed/index.js';
export { dashboardLinkWidgetExtension } from './extensions/dashboard-link-widget/index.js';
export type { EmbedPageExtensionOptions } from './extensions/embed/index.js';
export type { DashboardLinkWidgetExtensionOptions } from './extensions/dashboard-link-widget/index.js';

export { PrismaAdminAdapter } from './admin/adapters/prisma.adapter.js';
export { TypeOrmAdminAdapter } from './admin/adapters/typeorm.adapter.js';
export { InMemoryAdminAdapter } from './admin/adapters/in-memory.adapter.js';
export { MikroOrmAdminAdapter } from './admin/adapters/mikroorm.adapter.js';

export type {
  AdminAction,
  AdminAuditAction,
  AdminAuditActor,
  AdminAuditEntry,
  AdminAuditEvent,
  AdminAuditOptions,
  AdminAuditResult,
  AdminAuditStore,
  AdminAuthCookieOptions,
  AdminAuthCredentials,
  AdminAuthOptions,
  AdminAdapterResource,
  AdminActionContext,
  AdminBulkAction,
  AdminBulkActionContext,
  AdminAdapter,
  AdminDtoFieldConfig,
  AdminExtensionsSchema,
  AdminFieldRelationOption,
  AdminFieldMode,
  AdminFieldSchema,
  AdminListQuery,
  AdminListResult,
  AdminModuleOptions,
  AdminPermissions,
  AdminRequestUser,
  AdminResourceOptions,
  AdminResourceSchema,
  AdminSchemaBuildContext,
  AdminSchemaProvider,
  AdminSessionRecord,
  AdminSessionStore,
  AdminSoftDeleteOptions,
  AdminSoftDeleteSchema,
  AdminWriteTransform,
  AdminWriteTransformContext,
  PermissionRole,
} from './admin/types/admin.types.js';

export type {
  AdminEmbedPageDefinition,
  AdminHrefNavItemDefinition,
  AdminHrefWidgetDefinition,
  AdminNavItemDefinition,
  AdminNavItemSchema,
  AdminPageDefinition,
  AdminPageNavItemDefinition,
  AdminPageSchema,
  AdminPageLinkWidgetDefinition,
  AdminWidgetDefinition,
  AdminWidgetSchema,
  DjAdminExtension,
} from './extension-api/types.js';
