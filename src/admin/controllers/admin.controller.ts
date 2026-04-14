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
import { AdminService } from '../services/admin.service.js';
import { ADMIN_OPTIONS } from '../admin.constants.js';
import type {
  AdminAuthCredentials,
  AdminDisplaySchema,
  AdminListQuery,
  AdminModuleOptions,
  AdminRequestUser,
} from '../types/admin.types.js';
import { Inject } from '@nestjs/common';

@Controller('admin')
export class AdminController {
  constructor(
    @Inject(ADMIN_OPTIONS) private readonly adminOptions: AdminModuleOptions,
    private readonly adminService: AdminService,
    private readonly adminAuthService: AdminAuthService,
  ) {}

  @Get('_auth/me')
  me(@Req() request: Request) {
    return {
      user: this.adminAuthService.requireUser(request),
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
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.adminAuthService.logout(request, response);
    return { success: true };
  }

  @Get('_meta')
  getResources(@Req() request: Request) {
    const user = this.adminAuthService.requireUser(request);
    return {
      resources: this.adminService
        .getResources()
        .filter((resource) => canReadResource(resource, user)),
      display: resolveDisplay(this.adminOptions),
    };
  }

  @Get('_meta/:resource')
  async getResourceMeta(@Param('resource') resource: string, @Req() request: Request) {
    const user = this.adminAuthService.requireUser(request);
    const schema = this.adminService.getResourceSchema(resource, user);
    const filters = await this.adminService.getFilterOptions(resource, user);

    return {
      resource: schema,
      filterOptions: filters,
      display: resolveDisplay(this.adminOptions),
    };
  }

  @Get('_lookup/:resource')
  lookup(
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
      this.adminAuthService.requireUser(request),
    );
  }

  @Get(':resource')
  list(
    @Param('resource') resource: string,
    @Query() query: Record<string, string | string[]>,
    @Req() request: Request,
  ) {
    return this.adminService.list(
      resource,
      parseListQuery(query),
      this.adminAuthService.requireUser(request),
    );
  }

  @Get(':resource/_delete-summary')
  getDeleteSummary(
    @Param('resource') resource: string,
    @Query('ids') idsParam: string,
    @Req() request: Request,
  ) {
    return this.adminService.getDeleteSummary(
      resource,
      parseIds(idsParam),
      this.adminAuthService.requireUser(request),
    );
  }

  @Post(':resource/_bulk-delete')
  bulkRemove(
    @Param('resource') resource: string,
    @Body('ids') ids: string[],
    @Req() request: Request,
  ) {
    return this.adminService.bulkRemove(
      resource,
      parseIds(ids),
      this.adminAuthService.requireUser(request),
    );
  }

  @Get(':resource/:id')
  detail(@Param('resource') resource: string, @Param('id') id: string, @Req() request: Request) {
    return this.adminService.detail(resource, id, this.adminAuthService.requireUser(request));
  }

  @Post(':resource')
  create(
    @Param('resource') resource: string,
    @Body() payload: Record<string, unknown>,
    @Req() request: Request,
  ) {
    return this.adminService.create(resource, payload, this.adminAuthService.requireUser(request));
  }

  @Patch(':resource/:id')
  update(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() payload: Record<string, unknown>,
    @Req() request: Request,
  ) {
    return this.adminService.update(resource, id, payload, this.adminAuthService.requireUser(request));
  }

  @Post(':resource/:id/password')
  changePassword(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() payload: Record<string, unknown>,
    @Req() request: Request,
  ) {
    return this.adminService.changePassword(resource, id, payload, this.adminAuthService.requireUser(request));
  }

  @Delete(':resource/:id')
  remove(@Param('resource') resource: string, @Param('id') id: string, @Req() request: Request) {
    return this.adminService.remove(resource, id, this.adminAuthService.requireUser(request));
  }

  @Post(':resource/:id/actions/:action')
  runAction(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Param('action') action: string,
    @Req() request: Request,
  ) {
    return this.adminService.runAction(resource, id, action, this.adminAuthService.requireUser(request));
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

function canReadResource(resource: { permissions?: { read?: string[] } }, user: AdminRequestUser) {
  const allowed = resource.permissions?.read;
  return !allowed || allowed.length === 0 || allowed.includes(user.role);
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
