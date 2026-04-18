import { adminFetch, readJson } from '../api.js';
import type {
  AdminAuditResponse,
  AdminDeleteSummary,
  AdminDisplayConfig,
  AdminLookupResponse,
  AdminMetaResponse,
  ExtensionActionResult,
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

export async function getAuditLog(query: {
  page: number;
  pageSize: number;
}): Promise<AdminAuditResponse> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  const response = await adminFetch(`/_audit?${params.toString()}`);
  return readJson<AdminAuditResponse>(response);
}

export async function listResource(
  resourceName: string,
  query: {
    page: number;
    pageSize: number;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    filters?: Record<string, string>;
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

  for (const [field, value] of Object.entries(query.filters ?? {})) {
    if (value) {
      params.set(`filter.${field}`, value);
    }
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

export async function changeResourcePassword(
  resourceName: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await adminFetch(`/${resourceName}/${id}/password`, {
    method: 'POST',
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

export async function runBulkResourceAction(
  resourceName: string,
  actionSlug: string,
  ids: string[],
): Promise<{ success: boolean; count: number }> {
  const response = await adminFetch(`/${resourceName}/_bulk-actions/${actionSlug}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  });

  return readJson<{ success: boolean; count: number }>(response);
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

export async function getExtensionData<T>(
  path: string,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  const response = await adminFetch(`/_extensions${path}${suffix}`);
  return readJson<T>(response);
}

export async function runExtensionAction<T extends ExtensionActionResult = ExtensionActionResult>(
  path: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  const response = await adminFetch(`/_extensions${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload ?? {}),
  });

  return readJson<T>(response);
}

export function resolveDisplayConfig(
  value: AdminDisplayConfig | undefined,
  fallback: AdminDisplayConfig,
): AdminDisplayConfig {
  return value ?? fallback;
}
