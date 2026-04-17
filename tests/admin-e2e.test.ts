import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { once } from 'node:events';
import type { Readable } from 'node:stream';

describe('Admin backend e2e', () => {
  let server: ChildProcessByStdio<null, Readable, Readable>;
  const port = 3101;
  const baseUrl = `http://127.0.0.1:${port}`;
  const adminBaseUrl = `${baseUrl}/admin`;

  before(async () => {
    server = spawn(
      'node',
      ['--loader', 'ts-node/esm', 'tests/fixtures/admin-e2e-app.ts'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ADMIN_E2E_PORT: String(port),
          TS_NODE_TRANSPILE_ONLY: 'true',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    const stderr: string[] = [];
    server.stderr.setEncoding('utf8');
    server.stderr.on('data', (chunk) => {
      stderr.push(chunk);
    });

    server.stdout.setEncoding('utf8');
    await waitForReady(server.stdout, `ADMIN_E2E_READY ${port}`);
  });

  after(async () => {
    if (server.exitCode === null) {
      server.kill('SIGKILL');
      await once(server, 'exit');
    }
  });

  beforeEach(async () => {
    const response = await fetch(`${baseUrl}/__test/reset`, {
      method: 'POST',
    });
    assert.equal(response.status, 201);
  });

  it('rejects protected API access without login', async () => {
    const response = await fetch(`${adminBaseUrl}/_meta`);
    assert.equal(response.status, 401);

    const body = await response.json();
    assert.equal(body.message, 'Admin login required');
  });

  it('supports login and logout with session cookies', async () => {
    const login = await loginAs(adminBaseUrl, 'ada@example.com', 'admin123');
    assert.equal(login.response.status, 201);
    assert.ok(login.cookie.includes('admin_session='));
    assert.equal(login.body.user.email, 'ada@example.com');

    const me = await request(adminBaseUrl, '/_auth/me', { cookie: login.cookie });
    assert.equal(me.response.status, 200);
    assert.equal(me.body.user.email, 'ada@example.com');

    const logout = await request(adminBaseUrl, '/_auth/logout', {
      method: 'POST',
      cookie: login.cookie,
    });
    assert.equal(logout.response.status, 201);

    const afterLogout = await request(adminBaseUrl, '/_auth/me', { cookie: login.cookie });
    assert.equal(afterLogout.response.status, 401);
  });

  it('returns resource metadata for authenticated admins', async () => {
    const { cookie } = await loginAs(adminBaseUrl, 'ada@example.com', 'admin123');

    const meta = await request(adminBaseUrl, '/_meta', { cookie });
    assert.equal(meta.response.status, 200);
    assert.ok(Array.isArray(meta.body.resources));
    assert.ok(meta.body.resources.some((resource: { resourceName: string }) => resource.resourceName === 'users'));
    assert.ok(Array.isArray(meta.body.pages));
    assert.ok(meta.body.pages.some((page: { slug: string; kind: string }) => page.slug === 'grafana-overview' && page.kind === 'embed'));
    assert.ok(meta.body.navItems.some((item: { key: string; kind: string }) => item.key === 'test-grafana-page:nav' && item.kind === 'page'));
    assert.ok(meta.body.widgets.some((widget: { key: string; kind: string }) => widget.key === 'test-grafana-widget:widget' && widget.kind === 'page-link'));
    assert.equal(meta.body.auditLog.enabled, true);

    const resourceMeta = await request(adminBaseUrl, '/_meta/users', { cookie });
    assert.equal(resourceMeta.response.status, 200);
    assert.equal(resourceMeta.body.resource.resourceName, 'users');
    assert.ok(resourceMeta.body.resource.createFields.some((field: { name: string }) => field.name === 'password'));
    assert.ok(resourceMeta.body.resource.updateFields.every((field: { name: string }) => field.name !== 'password'));
    assert.ok(
      resourceMeta.body.resource.bulkActions.some(
        (action: { slug: string }) => action.slug === 'deactivate-selected',
      ),
    );
  });

  it('enforces permissions for authenticated non-admin users', async () => {
    const { cookie } = await loginAs(adminBaseUrl, 'grace@example.com', 'editor123');

    const detail = await request(adminBaseUrl, '/users/1', { cookie });
    assert.equal(detail.response.status, 403);
    assert.match(String(detail.body.message), /Missing read permission/);

    const create = await request(adminBaseUrl, '/categories', {
      method: 'POST',
      cookie,
      body: {
        name: 'Forbidden category',
        description: 'should not save',
      },
    });
    assert.equal(create.response.status, 403);
    assert.match(String(create.body.message), /Missing write permission/);
  });

  it('supports CRUD routes for admin users', async () => {
    const { cookie } = await loginAs(adminBaseUrl, 'ada@example.com', 'admin123');

    const list = await request(adminBaseUrl, '/categories?page=1&pageSize=10', { cookie });
    assert.equal(list.response.status, 200);
    assert.equal(list.body.total, 2);

    const created = await request(adminBaseUrl, '/categories', {
      method: 'POST',
      cookie,
      body: {
        name: 'Snacks',
        description: 'Shelf stable goods',
      },
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.name, 'Snacks');
    const categoryId = String(created.body.id);

    const detail = await request(adminBaseUrl, `/categories/${categoryId}`, { cookie });
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.description, 'Shelf stable goods');

    const updated = await request(adminBaseUrl, `/categories/${categoryId}`, {
      method: 'PATCH',
      cookie,
      body: {
        description: 'Updated description',
      },
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.description, 'Updated description');

    const removed = await request(adminBaseUrl, `/categories/${categoryId}`, {
      method: 'DELETE',
      cookie,
    });
    assert.equal(removed.response.status, 200);
    assert.equal(removed.body.success, true);

    const afterDelete = await request(adminBaseUrl, `/categories/${categoryId}`, { cookie });
    assert.equal(afterDelete.response.status, 404);
  });

  it('hides soft-deleted records by default and archives opted-in resources', async () => {
    const { cookie } = await loginAs(adminBaseUrl, 'ada@example.com', 'admin123');

    const meta = await request(adminBaseUrl, '/_meta/products', { cookie });
    assert.equal(meta.response.status, 200);
    assert.equal(meta.body.resource.softDelete.enabled, true);
    assert.ok(meta.body.filterOptions.some((option: { field: string }) => option.field === '__softDeleteState'));

    const defaultList = await request(adminBaseUrl, '/products?page=1&pageSize=10', { cookie });
    assert.equal(defaultList.response.status, 200);
    assert.equal(defaultList.body.total, 1);
    assert.equal(defaultList.body.items[0].name, 'Chai');

    const deletedList = await request(adminBaseUrl, '/products?page=1&pageSize=10&filter.__softDeleteState=deleted', {
      cookie,
    });
    assert.equal(deletedList.response.status, 200);
    assert.equal(deletedList.body.total, 1);
    assert.equal(deletedList.body.items[0].name, 'Ikura');

    const archived = await request(adminBaseUrl, '/products/201', {
      method: 'DELETE',
      cookie,
    });
    assert.equal(archived.response.status, 200);
    assert.equal(archived.body.success, true);

    const afterArchive = await request(adminBaseUrl, '/products?page=1&pageSize=10', { cookie });
    assert.equal(afterArchive.response.status, 200);
    assert.equal(afterArchive.body.total, 0);

    const allProducts = await request(adminBaseUrl, '/products?page=1&pageSize=10&filter.__softDeleteState=all', {
      cookie,
    });
    assert.equal(allProducts.response.status, 200);
    assert.equal(allProducts.body.total, 2);
  });

  it('supports custom action routes', async () => {
    const { cookie } = await loginAs(adminBaseUrl, 'ada@example.com', 'admin123');

    const action = await request(adminBaseUrl, '/users/2/actions/deactivate', {
      method: 'POST',
      cookie,
    });
    assert.equal(action.response.status, 201);
    assert.equal(action.body.success, true);
    assert.equal(action.body.entity.active, false);

    const detail = await request(adminBaseUrl, '/users/2', { cookie });
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.active, false);
  });

  it('supports bulk action routes', async () => {
    const { cookie } = await loginAs(adminBaseUrl, 'ada@example.com', 'admin123');

    const action = await request(adminBaseUrl, '/users/_bulk-actions/deactivate-selected', {
      method: 'POST',
      cookie,
      body: {
        ids: ['1', '2'],
      },
    });
    assert.equal(action.response.status, 201);
    assert.equal(action.body.success, true);
    assert.equal(action.body.count, 2);

    const first = await request(adminBaseUrl, '/users/1', { cookie });
    const second = await request(adminBaseUrl, '/users/2', { cookie });
    assert.equal(first.response.status, 200);
    assert.equal(second.response.status, 200);
    assert.equal(first.body.active, false);
    assert.equal(second.body.active, false);
  });

  it('returns validation errors in the expected shape', async () => {
    const { cookie } = await loginAs(adminBaseUrl, 'ada@example.com', 'admin123');

    const invalid = await request(adminBaseUrl, '/users', {
      method: 'POST',
      cookie,
      body: {
        email: 'not-an-email',
        role: 'viewer',
        active: true,
        password: 'abc123',
        passwordConfirm: 'xyz789',
      },
    });
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.body.message, 'Validation failed');
    assert.ok(Array.isArray(invalid.body.errors));
    assert.ok(invalid.body.errors.some((error: { field: string }) => error.field === 'email'));
  });

  it('supports the password change endpoint and keeps hashes server-only', async () => {
    const { cookie } = await loginAs(adminBaseUrl, 'ada@example.com', 'admin123');

    const created = await request(adminBaseUrl, '/users', {
      method: 'POST',
      cookie,
      body: {
        email: 'new-admin@example.com',
        role: 'admin',
        active: true,
        password: 'firstPass123',
        passwordConfirm: 'firstPass123',
      },
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.passwordHash, undefined);
    const userId = String(created.body.id);

    const changed = await request(adminBaseUrl, `/users/${userId}/password`, {
      method: 'POST',
      cookie,
      body: {
        password: 'secondPass123',
        passwordConfirm: 'secondPass123',
      },
    });
    assert.equal(changed.response.status, 201);
    assert.equal(changed.body.passwordHash, undefined);

    const oldLogin = await loginAs(adminBaseUrl, 'new-admin@example.com', 'firstPass123');
    assert.equal(oldLogin.response.status, 401);

    const newLogin = await loginAs(adminBaseUrl, 'new-admin@example.com', 'secondPass123');
    assert.equal(newLogin.response.status, 201);
  });

  it('records audit log entries for auth and admin mutations', async () => {
    const login = await loginAs(adminBaseUrl, 'ada@example.com', 'admin123');
    const { cookie } = login;

    const created = await request(adminBaseUrl, '/categories', {
      method: 'POST',
      cookie,
      body: {
        name: 'Audit Snacks',
        description: 'tracked',
      },
    });
    assert.equal(created.response.status, 201);
    const categoryId = String(created.body.id);

    const removed = await request(adminBaseUrl, `/categories/${categoryId}`, {
      method: 'DELETE',
      cookie,
    });
    assert.equal(removed.response.status, 200);

    const logout = await request(adminBaseUrl, '/_auth/logout', {
      method: 'POST',
      cookie,
    });
    assert.equal(logout.response.status, 201);

    const relogin = await loginAs(adminBaseUrl, 'ada@example.com', 'admin123');
    const audit = await request(adminBaseUrl, '/_audit?page=1&pageSize=20', {
      cookie: relogin.cookie,
    });
    assert.equal(audit.response.status, 200);
    assert.ok(audit.body.total >= 4);
    assert.ok(
      audit.body.items.some(
        (entry: { action: string; summary: string }) =>
          entry.action === 'login' && /ada@example.com logged in/.test(entry.summary),
      ),
    );
    assert.ok(
      audit.body.items.some(
        (entry: { action: string; summary: string; resourceName?: string }) =>
          entry.action === 'create' &&
          entry.resourceName === 'categories' &&
          /Created Category Audit Snacks/.test(entry.summary),
      ),
    );
    assert.ok(
      audit.body.items.some(
        (entry: { action: string; summary: string; resourceName?: string }) =>
          entry.action === 'delete' &&
          entry.resourceName === 'categories' &&
          /Deleted Category Audit Snacks/.test(entry.summary),
      ),
    );
    assert.ok(
      audit.body.items.some(
        (entry: { action: string; summary: string }) =>
          entry.action === 'logout' && /ada@example.com logged out/.test(entry.summary),
      ),
    );
  });
});

async function loginAs(baseUrl: string, email: string, password: string) {
  const result = await request(baseUrl, '/_auth/login', {
    method: 'POST',
    body: { email, password },
  });

  return {
    ...result,
    cookie: result.response.headers.get('set-cookie') ?? '',
  };
}

async function request(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    cookie?: string;
    body?: Record<string, unknown>;
  } = {},
) {
  const headers = new Headers();
  if (options.cookie) {
    headers.set('cookie', options.cookie);
  }

  if (options.body) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  return {
    response,
    body: text ? JSON.parse(text) : null,
  };
}

async function waitForReady(
  stream: NodeJS.ReadableStream,
  marker: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let buffer = '';

    const onData = (chunk: string | Buffer) => {
      buffer += chunk.toString();
      if (buffer.includes(marker)) {
        stream.off('data', onData);
        resolve();
      }
    };

    const onError = (error: Error) => {
      stream.off('data', onData);
      reject(error);
    };

    stream.on('data', onData);
    stream.once('error', onError);
  });
}
