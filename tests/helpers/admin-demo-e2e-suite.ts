import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { once } from 'node:events';
import type { Readable } from 'node:stream';

type DemoAdminE2EConfig = {
  name: string;
  port: number;
  entrypoint: string;
  setupCommand: [string, ...string[]];
  env?: NodeJS.ProcessEnv;
  expectedPageSlug?: string;
};

export function defineDemoAdminE2ETests(config: DemoAdminE2EConfig): void {
  describe(config.name, { timeout: 120_000 }, () => {
    let server: ChildProcessByStdio<null, Readable, Readable>;
    let serverOutput = '';
    const baseUrl = `http://127.0.0.1:${config.port}`;
    const adminBaseUrl = `${baseUrl}/admin`;

    before(async () => {
      await runCommand(config.setupCommand[0], config.setupCommand.slice(1), config.env);

      server = spawn('node', ['--loader', 'ts-node/esm', config.entrypoint], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ...config.env,
          PORT: String(config.port),
          ADMIN_E2E_ENABLE_RESET: 'true',
          TS_NODE_TRANSPILE_ONLY: 'true',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      server.stdout.setEncoding('utf8');
      server.stderr.setEncoding('utf8');
      server.stdout.on('data', (chunk) => {
        serverOutput += chunk;
      });
      server.stderr.on('data', (chunk) => {
        serverOutput += chunk;
      });

      await waitForHttpReady(`${adminBaseUrl}/_meta`, () => serverOutput);
    });

    after(async () => {
      if (server.exitCode === null) {
        server.kill('SIGKILL');
        await once(server, 'exit');
      }
    });

    beforeEach(async () => {
      const response = await fetch(`${baseUrl}/__test/reset`, { method: 'POST' });
      assert.equal(response.status, 201);
    });

    it('rejects protected API access without login', async () => {
      const response = await fetch(`${adminBaseUrl}/_meta`);
      assert.equal(response.status, 401);

      const body = await response.json();
      assert.equal(body.message, 'Admin login required');
    });

    it('supports admin login and logout with session cookies', async () => {
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

    it('allows editor credentials and rejects viewer credentials at login', async () => {
      const editor = await loginAs(adminBaseUrl, 'grace@example.com', 'editor123');
      assert.equal(editor.response.status, 201);

      const viewer = await loginAs(adminBaseUrl, 'linus@example.com', 'viewer123');
      assert.equal(viewer.response.status, 401);
    });

    it('returns resource metadata for authenticated admins', async () => {
      const { cookie } = await loginAs(adminBaseUrl, 'ada@example.com', 'admin123');

      const meta = await request(adminBaseUrl, '/_meta', { cookie });
      assert.equal(meta.response.status, 200);
      assert.ok(meta.body.resources.some((resource: { resourceName: string }) => resource.resourceName === 'users'));
      assert.ok(meta.body.resources.some((resource: { resourceName: string }) => resource.resourceName === 'orders'));
      if (config.expectedPageSlug) {
        assert.ok(
          meta.body.pages.some(
            (page: { slug: string; kind: string }) =>
              page.slug === config.expectedPageSlug && page.kind === 'embed',
          ),
        );
        assert.ok(
          meta.body.navItems.some(
            (item: { kind: string; pageSlug?: string }) =>
              item.kind === 'page' && item.pageSlug === config.expectedPageSlug,
          ),
        );
        assert.ok(
          meta.body.widgets.some(
            (widget: { kind: string; pageSlug?: string }) =>
              widget.kind === 'page-link' && widget.pageSlug === config.expectedPageSlug,
          ),
        );
      }
      assert.equal(meta.body.auditLog.enabled, true);

      const userMeta = await request(adminBaseUrl, '/_meta/users', { cookie });
      assert.equal(userMeta.response.status, 200);
      assert.ok(userMeta.body.resource.createFields.some((field: { name: string }) => field.name === 'password'));
      assert.ok(userMeta.body.resource.updateFields.every((field: { name: string }) => field.name !== 'password'));
      assert.ok(
        userMeta.body.resource.bulkActions.some(
          (action: { slug: string }) => action.slug === 'deactivate-selected',
        ),
      );

      const productMeta = await request(adminBaseUrl, '/_meta/products', { cookie });
      assert.equal(productMeta.response.status, 200);
      assert.equal(productMeta.body.resource.softDelete.enabled, true);
      assert.ok(
        productMeta.body.resource.createFields.some(
          (field: { name: string; relation?: { kind?: string } }) =>
            field.name === 'categories' && field.relation?.kind === 'many-to-many',
        ),
      );
    });

    it('supports CRUD routes for admin users', async () => {
      const { cookie } = await loginAs(adminBaseUrl, 'ada@example.com', 'admin123');

      const list = await request(adminBaseUrl, '/categories?page=1&pageSize=20', { cookie });
      assert.equal(list.response.status, 200);
      assert.ok(list.body.total >= 5);

      const created = await request(adminBaseUrl, '/categories', {
        method: 'POST',
        cookie,
        body: {
          name: 'Seasonal Specials',
          description: 'Limited run items',
        },
      });
      assert.equal(created.response.status, 201);
      const categoryId = String(created.body.id);

      const detail = await request(adminBaseUrl, `/categories/${categoryId}`, { cookie });
      assert.equal(detail.response.status, 200);
      assert.equal(detail.body.description, 'Limited run items');

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

    it('supports relation lookup, relation-aware search, and many-to-many mutations', async () => {
      const { cookie } = await loginAs(adminBaseUrl, 'ada@example.com', 'admin123');

      const categoriesLookup = await request(adminBaseUrl, '/_lookup/categories?q=ea&page=1&pageSize=20', { cookie });
      assert.equal(categoriesLookup.response.status, 200);
      const beveragesId = findLookupValue(categoriesLookup.body.items, 'Beverages');
      const seafoodId = findLookupValue(categoriesLookup.body.items, 'Seafood');
      assert.ok(beveragesId);
      assert.ok(seafoodId);

      const usersLookup = await request(adminBaseUrl, '/_lookup/users?q=grace&page=1&pageSize=20', { cookie });
      assert.equal(usersLookup.response.status, 200);
      const graceId = findLookupValue(usersLookup.body.items, 'grace@example.com');
      assert.ok(graceId);

      const orders = await request(
        adminBaseUrl,
        `/orders?page=1&pageSize=20&search=${encodeURIComponent('grace@example.com')}`,
        { cookie },
      );
      assert.equal(orders.response.status, 200);
      assert.ok(orders.body.total >= 1);
      assert.ok(
        orders.body.items.some((item: { userId?: string | number }) => String(item.userId ?? '') === graceId),
      );

      const created = await request(adminBaseUrl, '/products', {
        method: 'POST',
        cookie,
        body: {
          sku: 'E2E-REL-001',
          name: 'Relation Test Product',
          unitPrice: 21.5,
          unitsInStock: 12,
          discontinued: false,
          categories: [Number(beveragesId), Number(seafoodId)],
        },
      });
      assert.equal(created.response.status, 201);
      const productId = String(created.body.id);

      const detail = await request(adminBaseUrl, `/products/${productId}`, { cookie });
      assert.equal(detail.response.status, 200);
      assert.deepEqual(
        [...new Set(extractRelationIds(detail.body.categories))].sort(),
        [beveragesId, seafoodId].sort(),
      );

      const updated = await request(adminBaseUrl, `/products/${productId}`, {
        method: 'PATCH',
        cookie,
        body: {
          categories: [Number(seafoodId)],
        },
      });
      assert.equal(updated.response.status, 200);

      const afterUpdate = await request(adminBaseUrl, `/products/${productId}`, { cookie });
      assert.equal(afterUpdate.response.status, 200);
      assert.deepEqual(extractRelationIds(afterUpdate.body.categories), [seafoodId]);
    });

    it('hides soft-deleted records by default and archives products', async () => {
      const { cookie } = await loginAs(adminBaseUrl, 'ada@example.com', 'admin123');

      const chaiList = await request(
        adminBaseUrl,
        `/products?page=1&pageSize=20&search=${encodeURIComponent('Chai')}`,
        { cookie },
      );
      assert.equal(chaiList.response.status, 200);
      assert.ok(chaiList.body.items.some((item: { name: string }) => item.name === 'Chai'));
      const chaiId = String(chaiList.body.items.find((item: { name: string }) => item.name === 'Chai')!.id);

      const deletedList = await request(
        adminBaseUrl,
        '/products?page=1&pageSize=20&filter.__softDeleteState=deleted',
        { cookie },
      );
      assert.equal(deletedList.response.status, 200);
      assert.ok(deletedList.body.items.some((item: { sku: string }) => item.sku === 'NW-012'));

      const archived = await request(adminBaseUrl, `/products/${chaiId}`, {
        method: 'DELETE',
        cookie,
      });
      assert.equal(archived.response.status, 200);
      assert.equal(archived.body.success, true);

      const afterArchive = await request(
        adminBaseUrl,
        `/products?page=1&pageSize=20&search=${encodeURIComponent('Chai')}`,
        { cookie },
      );
      assert.equal(afterArchive.response.status, 200);
      assert.equal(afterArchive.body.total, 0);

      const allProducts = await request(
        adminBaseUrl,
        `/products?page=1&pageSize=20&search=${encodeURIComponent('Chai')}&filter.__softDeleteState=all`,
        { cookie },
      );
      assert.equal(allProducts.response.status, 200);
      assert.ok(allProducts.body.items.some((item: { id: string | number }) => String(item.id) === chaiId));
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
          ids: ['2', '3'],
        },
      });
      assert.equal(action.response.status, 201);
      assert.equal(action.body.success, true);
      assert.equal(action.body.count, 2);

      const second = await request(adminBaseUrl, '/users/2', { cookie });
      const third = await request(adminBaseUrl, '/users/3', { cookie });
      assert.equal(second.response.status, 200);
      assert.equal(third.response.status, 200);
      assert.equal(second.body.active, false);
      assert.equal(third.body.active, false);
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
}

export async function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv | undefined,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed: ${command} ${args.join(' ')}\n${output}`));
    });
  });
}

export async function waitForHttpReady(url: string, getOutput: () => string): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 60_000) {
    try {
      const response = await fetch(url);
      if (response.status === 200 || response.status === 401) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for server readiness at ${url}\n${getOutput()}`);
}

export async function loginAs(baseUrl: string, email: string, password: string) {
  const result = await request(baseUrl, '/_auth/login', {
    method: 'POST',
    body: { email, password },
  });

  return {
    ...result,
    cookie: result.response.headers.get('set-cookie') ?? '',
  };
}

export async function request(
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

function findLookupValue(items: Array<{ value: string; label: string }>, label: string): string | null {
  return items.find((item) => item.label === label)?.value ?? null;
}

function extractRelationIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (item && typeof item === 'object' && 'id' in item) {
        return String((item as { id: string | number }).id);
      }

      return String(item);
    })
    .sort();
}
