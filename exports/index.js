import { existsSync } from 'node:fs';

const rootModule = existsSync(new URL('../dist/index.js', import.meta.url))
  ? await import('../dist/index.js')
  : await import('../src/index.ts');

export const AdminModule = rootModule.AdminModule;
export const AdminRegistry = rootModule.AdminRegistry;
export const ADMIN_ADAPTER = rootModule.ADMIN_ADAPTER;
export const ADMIN_OPTIONS = rootModule.ADMIN_OPTIONS;
export const ADMIN_RESOURCE_METADATA = rootModule.ADMIN_RESOURCE_METADATA;
export const AdminResource = rootModule.AdminResource;
export const AdminField = rootModule.AdminField;
export const ADMIN_DTO_FIELD_METADATA = rootModule.ADMIN_DTO_FIELD_METADATA;
export const AdminService = rootModule.AdminService;
export const AdminAuthService = rootModule.AdminAuthService;
export const AdminAuditService = rootModule.AdminAuditService;
export const AdminPermissionService = rootModule.AdminPermissionService;
export const DtoIntrospectorService = rootModule.DtoIntrospectorService;
export const AdminUiService = rootModule.AdminUiService;
export const adminSchemaFromClassValidator = rootModule.adminSchemaFromClassValidator;
export const adminSchemaFromZod = rootModule.adminSchemaFromZod;
export const embedPageExtension = rootModule.embedPageExtension;
export const dashboardLinkWidgetExtension = rootModule.dashboardLinkWidgetExtension;
export const PrismaAdminAdapter = rootModule.PrismaAdminAdapter;
export const TypeOrmAdminAdapter = rootModule.TypeOrmAdminAdapter;
export const InMemoryAdminAdapter = rootModule.InMemoryAdminAdapter;
export const MikroOrmAdminAdapter = rootModule.MikroOrmAdminAdapter;
