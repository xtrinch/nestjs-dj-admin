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
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminService } from '../services/admin.service.js';
import type { AdminListQuery, AdminRequestUser } from '../types/admin.types.js';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('_meta')
  getResources(@Req() request: Request) {
    return {
      resources: this.adminService
        .getResources()
        .filter((resource) => canReadResource(resource, request.user as AdminRequestUser)),
    };
  }

  @Get('_meta/:resource')
  async getResourceMeta(@Param('resource') resource: string, @Req() request: Request) {
    const schema = this.adminService.getResourceSchema(resource, request.user as AdminRequestUser);
    const filters = await this.adminService.getFilterOptions(resource, request.user as AdminRequestUser);

    return {
      resource: schema,
      filterOptions: filters,
    };
  }

  @Get(':resource')
  list(
    @Param('resource') resource: string,
    @Query() query: Record<string, string | string[]>,
    @Req() request: Request,
  ) {
    return this.adminService.list(resource, parseListQuery(query), request.user as AdminRequestUser);
  }

  @Get(':resource/:id')
  detail(@Param('resource') resource: string, @Param('id') id: string, @Req() request: Request) {
    return this.adminService.detail(resource, id, request.user as AdminRequestUser);
  }

  @Post(':resource')
  create(
    @Param('resource') resource: string,
    @Body() payload: Record<string, unknown>,
    @Req() request: Request,
  ) {
    return this.adminService.create(resource, payload, request.user as AdminRequestUser);
  }

  @Patch(':resource/:id')
  update(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() payload: Record<string, unknown>,
    @Req() request: Request,
  ) {
    return this.adminService.update(resource, id, payload, request.user as AdminRequestUser);
  }

  @Delete(':resource/:id')
  remove(@Param('resource') resource: string, @Param('id') id: string, @Req() request: Request) {
    return this.adminService.remove(resource, id, request.user as AdminRequestUser);
  }

  @Post(':resource/:id/actions/:action')
  runAction(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Param('action') action: string,
    @Req() request: Request,
  ) {
    return this.adminService.runAction(resource, id, action, request.user as AdminRequestUser);
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

function canReadResource(resource: { permissions?: { read?: string[] } }, user: AdminRequestUser) {
  const allowed = resource.permissions?.read;
  return !allowed || allowed.length === 0 || allowed.includes(user.role);
}
