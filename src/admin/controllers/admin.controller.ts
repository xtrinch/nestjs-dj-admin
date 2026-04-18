import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminAuthService } from '../services/admin-auth.service.js';
import { AdminAuditService } from '../services/admin-audit.service.js';
import { AdminService } from '../services/admin.service.js';
import { AdminPermissionService } from '../services/admin-permission.service.js';
import { ADMIN_OPTIONS } from '../admin.constants.js';
import type {
  AdminBrandingSchema,
  AdminAuthCredentials,
  AdminDisplaySchema,
  AdminListQuery,
  AdminModuleOptions,
} from '../types/admin.types.js';
import { Inject } from '@nestjs/common';

@Controller('admin')
export class AdminController {
  constructor(
    @Inject(ADMIN_OPTIONS) private readonly adminOptions: AdminModuleOptions,
    private readonly adminService: AdminService,
    private readonly adminAuthService: AdminAuthService,
    private readonly adminAuditService: AdminAuditService,
    private readonly adminPermissionService: AdminPermissionService,
  ) {}

  @Get('_auth/config')
  getAuthConfig() {
    return this.adminAuthService.getAuthConfig();
  }

  @Get('_auth/me')
  async me(@Req() request: Request) {
    return {
      user: await this.adminAuthService.requireUser(request),
    };
  }

  @Post('_auth/login')
  async login(
    @Body() credentials: AdminAuthCredentials,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return {
      user: await this.adminAuthService.login(credentials, request, response),
    };
  }

  @Post('_auth/logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.adminAuthService.logout(request, response);
    return { success: true };
  }

  @Get('_meta')
  async getResources(@Req() request: Request) {
    const user = await this.adminAuthService.requireUser(request);
    const extensions = this.adminService.getExtensionsSchema();
    return {
      resources: this.adminService
        .getResources()
        .filter((resource) => this.adminPermissionService.canReadResource(user, resource)),
      pages: extensions.pages.filter((page) => this.adminPermissionService.canReadPage(user, page)),
      navItems: extensions.navItems.filter((navItem) => this.adminPermissionService.canReadNavItem(user, navItem)),
      widgets: extensions.widgets.filter((widget) => this.adminPermissionService.canReadWidget(user, widget)),
      display: resolveDisplay(this.adminOptions),
      branding: resolveBranding(this.adminOptions),
      auditLog: {
        enabled: this.adminPermissionService.canReadAuditLog(user, this.adminOptions.auditLog),
      },
    };
  }

  @Get('_extensions/:namespace')
  async getExtensionRoot(@Req() request: Request) {
    return this.handleExtensionRequest(request, 'GET');
  }

  @Get('_extensions/:namespace/*path')
  async getExtensionPath(@Req() request: Request) {
    return this.handleExtensionRequest(request, 'GET');
  }

  @Post('_extensions/:namespace')
  async postExtensionRoot(@Req() request: Request) {
    return this.handleExtensionRequest(request, 'POST');
  }

  @Post('_extensions/:namespace/*path')
  async postExtensionPath(@Req() request: Request) {
    return this.handleExtensionRequest(request, 'POST');
  }

  @Get('_audit')
  async getAuditLog(
    @Query('page') pageParam: string | undefined,
    @Query('pageSize') pageSizeParam: string | undefined,
    @Req() request: Request,
  ) {
    const user = await this.adminAuthService.requireUser(request);
    this.adminPermissionService.assertCanReadAuditLog(user, this.adminOptions.auditLog);

    return this.adminAuditService.list(
      {
        page: Number(pageParam ?? 1),
        pageSize: Number(pageSizeParam ?? 50),
      },
      {
        user,
        canReadResource: (resourceName) => {
          const resource = this.adminService
            .getResources()
            .find((candidate) => candidate.resourceName === resourceName);

          return resource ? this.adminPermissionService.canReadResource(user, resource) : false;
        },
      },
    );
  }

  @Get('_meta/:resource')
  async getResourceMeta(@Param('resource') resource: string, @Req() request: Request) {
    const user = await this.adminAuthService.requireUser(request);
    const schema = this.adminService.getResourceSchema(resource, user);
    const filters = await this.adminService.getFilterOptions(resource, user);

    return {
      resource: schema,
      filterOptions: filters,
      display: resolveDisplay(this.adminOptions),
    };
  }

  @Get('_lookup/:resource')
  async lookup(
    @Param('resource') resource: string,
    @Query('q') q: string | undefined,
    @Query('ids') idsParam: string | string[] | undefined,
    @Query('page') pageParam: string | undefined,
    @Query('pageSize') pageSizeParam: string | undefined,
    @Req() request: Request,
  ) {
    return this.adminService.lookup(
      resource,
      {
        q,
        ids: parseIds(idsParam),
        page: Number(pageParam ?? 1),
        pageSize: Number(pageSizeParam ?? 20),
      },
      await this.adminAuthService.requireUser(request),
    );
  }

  @Get(':resource')
  async list(
    @Param('resource') resource: string,
    @Query() query: Record<string, string | string[]>,
    @Req() request: Request,
  ) {
    return this.adminService.list(
      resource,
      parseListQuery(query),
      await this.adminAuthService.requireUser(request),
    );
  }

  @Get(':resource/_delete-summary')
  async getDeleteSummary(
    @Param('resource') resource: string,
    @Query('ids') idsParam: string,
    @Req() request: Request,
  ) {
    return this.adminService.getDeleteSummary(
      resource,
      parseIds(idsParam),
      await this.adminAuthService.requireUser(request),
    );
  }

  @Post(':resource/_bulk-delete')
  async bulkRemove(
    @Param('resource') resource: string,
    @Body('ids') ids: string[],
    @Req() request: Request,
  ) {
    return this.adminService.bulkRemove(
      resource,
      parseIds(ids),
      await this.adminAuthService.requireUser(request),
    );
  }

  @Post(':resource/_bulk-actions/:action')
  async runBulkAction(
    @Param('resource') resource: string,
    @Param('action') action: string,
    @Body('ids') ids: string[],
    @Req() request: Request,
  ) {
    return this.adminService.runBulkAction(
      resource,
      parseIds(ids),
      action,
      await this.adminAuthService.requireUser(request),
    );
  }

  @Get(':resource/:id')
  async detail(@Param('resource') resource: string, @Param('id') id: string, @Req() request: Request) {
    return this.adminService.detail(resource, id, await this.adminAuthService.requireUser(request));
  }

  @Post(':resource')
  async create(
    @Param('resource') resource: string,
    @Body() payload: Record<string, unknown>,
    @Req() request: Request,
  ) {
    return this.adminService.create(resource, payload, await this.adminAuthService.requireUser(request));
  }

  @Patch(':resource/:id')
  async update(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() payload: Record<string, unknown>,
    @Req() request: Request,
  ) {
    return this.adminService.update(resource, id, payload, await this.adminAuthService.requireUser(request));
  }

  @Post(':resource/:id/password')
  async changePassword(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() payload: Record<string, unknown>,
    @Req() request: Request,
  ) {
    return this.adminService.changePassword(resource, id, payload, await this.adminAuthService.requireUser(request));
  }

  @Delete(':resource/:id')
  async remove(@Param('resource') resource: string, @Param('id') id: string, @Req() request: Request) {
    return this.adminService.remove(resource, id, await this.adminAuthService.requireUser(request));
  }

  @Post(':resource/:id/actions/:action')
  async runAction(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Param('action') action: string,
    @Req() request: Request,
  ) {
    return this.adminService.runAction(resource, id, action, await this.adminAuthService.requireUser(request));
  }

  private async handleExtensionRequest(
    request: Request,
    method: 'GET' | 'POST',
  ) {
    const user = await this.adminAuthService.requireUser(request);
    return this.adminService.runExtensionEndpoint(
      method,
      extractExtensionPath(this.adminOptions.path, request),
      {
        body: (request.body ?? {}) as Record<string, unknown>,
        query: normalizeExtensionQuery(request.query as Record<string, string | string[] | undefined>),
        request,
        user,
      },
    );
  }
}

function parseListQuery(query: Record<string, string | string[]>): AdminListQuery {
  const filters = Object.fromEntries(
    Object.entries(query).filter(([key]) => key.startsWith('filter.')),
  );

  return {
    page: Number(query.page ?? 1),
    pageSize: Number(query.pageSize ?? 10),
    search: asString(query.search),
    sort: asString(query.sort),
    order: asString(query.order) === 'desc' ? 'desc' : 'asc',
    filters: Object.fromEntries(
      Object.entries(filters).map(([key, value]) => [key.replace('filter.', ''), value]),
    ),
  };
}

function asString(value: string | string[] | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return Array.isArray(value) ? value[0] : value;
}

function parseIds(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  const ids = Array.isArray(value) ? value : value.split(',');
  return ids.map((item) => String(item).trim()).filter(Boolean);
}

function extractExtensionPath(adminPath: string, request: Request): string {
  const pathWithoutAdminPrefix = request.path.startsWith(adminPath)
    ? request.path.slice(adminPath.length)
    : request.path;
  const extensionPrefix = '/_extensions';

  if (!pathWithoutAdminPrefix.startsWith(extensionPrefix)) {
    return '/';
  }

  const next = pathWithoutAdminPrefix.slice(extensionPrefix.length);
  return next.length > 0 ? next : '/';
}

function normalizeExtensionQuery(
  query: Record<string, string | string[] | undefined>,
): Record<string, string | string[]> {
  const next: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      next[key] = value;
    }
  }

  return next;
}

function resolveDisplay(options: AdminModuleOptions): AdminDisplaySchema {
  return {
    locale: options.display?.locale ?? 'en-US',
    dateFormat: options.display?.dateFormat ?? {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    },
    dateTimeFormat: options.display?.dateTimeFormat ?? {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    },
  };
}

function resolveBranding(options: AdminModuleOptions): AdminBrandingSchema {
  return {
    siteHeader: options.branding?.siteHeader ?? 'DJ Admin',
    siteTitle: options.branding?.siteTitle ?? 'DJ Admin',
    indexTitle: options.branding?.indexTitle ?? 'Site administration',
    accentColor: options.branding?.accentColor ?? '#f59e0b',
  };
}
