import { adminFetch, readJson } from '../api.js';
import type {
  AdminDeleteSummary,
  AdminDisplayConfig,
  AdminLookupResponse,
  AdminMetaResponse,
  ResourceMetaResponse,
} from '../types.js';

export async function getAdminMeta(): Promise<AdminMetaResponse> {
  const response = await adminFetch('/_meta');
  return readJson<AdminMetaResponse>(response);
}

export async function getResourceMeta(resourceName: string): Promise<ResourceMetaResponse> {
  const response = await adminFetch(`/_meta/${resourceName}`);
  return readJson<ResourceMetaResponse>(response);
}

export async function listResource(
  resourceName: string,
  query: {
    page: number;
    pageSize: number;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    filterField?: string;
    filterValue?: string;
  },
): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });

  if (query.search) {
    params.set('search', query.search);
  }

  if (query.sort) {
    params.set('sort', query.sort);
  }

  if (query.order) {
    params.set('order', query.order);
  }

  if (query.filterField && query.filterValue) {
    params.set(`filter.${query.filterField}`, query.filterValue);
  }

  const response = await adminFetch(`/${resourceName}?${params.toString()}`);
  return readJson<{ items: Array<Record<string, unknown>>; total: number }>(response);
}

export async function getResourceEntity(
  resourceName: string,
  id: string,
): Promise<Record<string, unknown>> {
  const response = await adminFetch(`/${resourceName}/${id}`);
  return readJson<Record<string, unknown>>(response);
}

export async function createResourceEntity(
  resourceName: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await adminFetch(`/${resourceName}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return readJson<Record<string, unknown>>(response);
}

export async function updateResourceEntity(
  resourceName: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await adminFetch(`/${resourceName}/${id}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return readJson<Record<string, unknown>>(response);
}

export async function deleteResourceEntity(resourceName: string, id: string): Promise<void> {
  const response = await adminFetch(`/${resourceName}/${id}`, {
    method: 'DELETE',
  });

  await readJson<{ success: boolean }>(response);
}

export async function getDeleteSummary(
  resourceName: string,
  ids: string[],
): Promise<AdminDeleteSummary> {
  const params = new URLSearchParams({
    ids: ids.join(','),
  });
  const response = await adminFetch(`/${resourceName}/_delete-summary?${params.toString()}`);
  return readJson<AdminDeleteSummary>(response);
}

export async function bulkDeleteResourceEntities(resourceName: string, ids: string[]): Promise<void> {
  const response = await adminFetch(`/${resourceName}/_bulk-delete`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  });

  await readJson<{ success: boolean; count: number }>(response);
}

export async function runResourceAction(
  resourceName: string,
  id: string,
  actionSlug: string,
): Promise<void> {
  const response = await adminFetch(`/${resourceName}/${id}/actions/${actionSlug}`, {
    method: 'POST',
  });

  await readJson<{ success: boolean }>(response);
}

export async function lookupResource(
  resourceName: string,
  query: {
    q?: string;
    ids?: string[];
    page?: number;
    pageSize?: number;
  },
): Promise<AdminLookupResponse> {
  const params = new URLSearchParams();

  if (query.q) {
    params.set('q', query.q);
  }

  if (query.ids && query.ids.length > 0) {
    params.set('ids', query.ids.join(','));
  }

  params.set('page', String(query.page ?? 1));
  params.set('pageSize', String(query.pageSize ?? 20));

  const response = await adminFetch(`/_lookup/${resourceName}?${params.toString()}`);
  return readJson<AdminLookupResponse>(response);
}

export function resolveDisplayConfig(
  value: AdminDisplayConfig | undefined,
  fallback: AdminDisplayConfig,
): AdminDisplayConfig {
  return value ?? fallback;
}
