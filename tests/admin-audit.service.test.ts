import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AdminAuditService } from '../src/admin/services/admin-audit.service.js';
import type { AdminModuleOptions } from '../src/admin/types/admin.types.js';

describe('AdminAuditService', () => {
  it('filters audit entries to the resources visible to the current user', async () => {
    const service = new AdminAuditService({
      path: '/admin',
      auditLog: {
        enabled: true,
      },
    });

    await service.record({
      action: 'login',
      actor: { id: '1', permissions: [], email: 'ada@example.com' },
      summary: 'ada@example.com logged in',
    });
    await service.record({
      action: 'create',
      actor: { id: '1', permissions: [], email: 'ada@example.com' },
      summary: 'Ada created order ORD-9999',
      resourceName: 'orders',
      resourceLabel: 'Orders',
      objectId: '9999',
      objectLabel: 'ORD-9999',
    });
    await service.record({
      action: 'create',
      actor: { id: '1', permissions: [], email: 'ada@example.com' },
      summary: 'Ada created category Hidden from editors',
      resourceName: 'categories',
      resourceLabel: 'Categories',
      objectId: '501',
      objectLabel: 'Hidden from editors',
    });
    await service.record({
      action: 'login',
      actor: { id: '2', permissions: ['orders.read', 'orders.write'], email: 'grace@example.com' },
      summary: 'grace@example.com logged in',
    });

    const audit = await service.list(
      { page: 1, pageSize: 20 },
      {
        user: {
          id: '2',
          permissions: ['orders.read', 'orders.write'],
          email: 'grace@example.com',
        },
        canReadResource: (resourceName) => resourceName === 'orders',
      },
    );

    assert.equal(audit.total, 2);
    assert.ok(
      audit.items.some(
        (entry) =>
          entry.action === 'login' &&
          entry.actor.email === 'grace@example.com' &&
          entry.resourceName == null,
      ),
    );
    assert.ok(
      audit.items.some(
        (entry) =>
          entry.action === 'create' &&
          entry.resourceName === 'orders' &&
          entry.objectLabel === 'ORD-9999',
      ),
    );
    assert.ok(
      audit.items.every(
        (entry) =>
          entry.resourceName !== 'categories' &&
          !(entry.action === 'login' && entry.actor.email === 'ada@example.com'),
      ),
    );
  });

  it('keeps full auth visibility for admins', async () => {
    const service = new AdminAuditService({
      path: '/admin',
      auditLog: {
        enabled: true,
      },
    } satisfies AdminModuleOptions);

    await service.record({
      action: 'login',
      actor: { id: '1', permissions: [], email: 'ada@example.com' },
      summary: 'ada@example.com logged in',
    });
    await service.record({
      action: 'login',
      actor: { id: '2', permissions: ['orders.read', 'orders.write'], email: 'grace@example.com' },
      summary: 'grace@example.com logged in',
    });

    const audit = await service.list(
      { page: 1, pageSize: 20 },
      {
        user: {
          id: '1',
          permissions: [],
          email: 'ada@example.com',
          isSuperuser: true,
        },
        canReadResource: () => true,
      },
    );

    assert.equal(audit.total, 2);
    assert.ok(audit.items.some((entry) => entry.actor.email === 'ada@example.com'));
    assert.ok(audit.items.some((entry) => entry.actor.email === 'grace@example.com'));
  });
});
