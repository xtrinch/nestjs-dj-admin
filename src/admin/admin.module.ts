import { DynamicModule, Module } from '@nestjs/common';
import { DiscoveryModule, MetadataScanner } from '@nestjs/core';
import { AdminRegistry } from './admin.registry.js';
import { ADMIN_ADAPTER, ADMIN_OPTIONS } from './admin.constants.js';
import { AdminController } from './controllers/admin.controller.js';
import { AdminAuthService } from './services/admin-auth.service.js';
import { AdminAuditService } from './services/admin-audit.service.js';
import { DtoIntrospectorService } from './services/dto-introspector.service.js';
import { AdminPermissionService } from './services/admin-permission.service.js';
import { AdminService } from './services/admin.service.js';
import { AdminUiService } from './services/admin-ui.service.js';
import type { AdminModuleOptions } from './types/admin.types.js';

@Module({
  imports: [DiscoveryModule],
  controllers: [AdminController],
  providers: [
    MetadataScanner,
    AdminRegistry,
    AdminAuthService,
    AdminAuditService,
    DtoIntrospectorService,
    AdminPermissionService,
    AdminService,
    AdminUiService,
  ],
  exports: [AdminRegistry, AdminService, AdminAuthService, AdminAuditService],
})
export class AdminModule {
  static forRoot(options: AdminModuleOptions): DynamicModule {
    return {
      module: AdminModule,
      providers: [
        {
          provide: ADMIN_OPTIONS,
          useValue: options,
        },
        ...(options.adapter
          ? [
              typeof options.adapter === 'function'
                ? {
                    provide: ADMIN_ADAPTER,
                    useClass: options.adapter,
                  }
                : {
                    ...options.adapter,
                    provide: ADMIN_ADAPTER,
                  },
            ]
          : []),
      ],
      exports: [ADMIN_OPTIONS],
    };
  }
}
