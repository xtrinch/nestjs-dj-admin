import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AdminPermissionService } from '../src/admin/services/admin-permission.service.js';
import type { AdminRequestUser, AdminResourceSchema } from '../src/admin/types/admin.types.js';

describe('AdminPermissionService', () => {
  const service = new AdminPermissionService();
  const adminUser: AdminRequestUser = {
    id: '1',
    role: 'platform-owner',
    email: 'ada@example.com',
    isSuperuser: true,
  };
  const editorUser: AdminRequestUser = { id: '2', role: 'editor', email: 'grace@example.com' };

  it('defaults omitted resource permissions to admin-only', () => {
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
    assert.equal(service.canReadResource(editorUser, schema), false);
    assert.doesNotThrow(() => service.assertCanWrite(adminUser, schema));
    assert.throws(() => service.assertCanWrite(editorUser, schema));
  });

  it('defaults omitted extension permissions to admin-only', () => {
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
});
