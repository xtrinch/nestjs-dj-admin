import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AdminPermissionService } from '../src/admin/services/admin-permission.service.js';
import type { AdminRequestUser, AdminResourceSchema } from '../src/admin/types/admin.types.js';

describe('AdminPermissionService', () => {
  const service = new AdminPermissionService();
  const adminUser: AdminRequestUser = {
    id: '1',
    permissions: [],
    email: 'ada@example.com',
    isSuperuser: true,
  };
  const editorUser: AdminRequestUser = {
    id: '2',
    permissions: ['orders.read', 'orders.write'],
    email: 'grace@example.com',
  };
  const customPermissionUser: AdminRequestUser = {
    id: '3',
    permissions: ['users.read', 'users.write'],
    email: 'pat@example.com',
  };

  it('derives default resource permissions from the resource name', () => {
    const schema = {
      resourceName: 'orders',
      label: 'Orders',
      category: 'Sales',
      list: [],
      sortable: [],
      listDisplayLinks: [],
      search: [],
      filters: [],
      readonly: [],
      actions: [],
      bulkActions: [],
      fields: [],
      createFields: [],
      updateFields: [],
    } satisfies AdminResourceSchema;

    assert.equal(service.canReadResource(adminUser, schema), true);
    assert.equal(service.canReadResource(editorUser, schema), true);
    assert.doesNotThrow(() => service.assertCanWrite(adminUser, schema));
    assert.doesNotThrow(() => service.assertCanWrite(editorUser, schema));
  });

  it('defaults omitted extension permissions to superuser-only', () => {
    assert.equal(
      service.canReadPage(adminUser, {
        slug: 'monitoring',
        label: 'Monitoring',
        category: 'Ops',
        kind: 'embed',
        url: 'https://example.com',
        height: 600,
      }),
      true,
    );
    assert.equal(
      service.canReadPage(editorUser, {
        slug: 'monitoring',
        label: 'Monitoring',
        category: 'Ops',
        kind: 'embed',
        url: 'https://example.com',
        height: 600,
      }),
      false,
    );
  });

  it('matches implicit permissions against the resource name', () => {
    const schema = {
      resourceName: 'users',
      label: 'Users',
      category: 'Sales',
      list: [],
      sortable: [],
      listDisplayLinks: [],
      search: [],
      filters: [],
      readonly: [],
      actions: [],
      bulkActions: [],
      fields: [],
      createFields: [],
      updateFields: [],
    } satisfies AdminResourceSchema;

    assert.equal(service.canReadResource(customPermissionUser, schema), true);
    assert.doesNotThrow(() => service.assertCanWrite(customPermissionUser, schema));
  });
});
