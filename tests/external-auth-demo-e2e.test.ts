import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { once } from 'node:events';
import type { Readable } from 'node:stream';
import { request, waitForHttpReady } from './helpers/admin-demo-e2e-suite.js';

describe('external auth demo', { timeout: 120_000 }, () => {
  let server: ChildProcessByStdio<null, Readable, Readable>;
  let serverOutput = '';
  const port = 3108;
  const baseUrl = `http://127.0.0.1:${port}`;
  const adminBaseUrl = `${baseUrl}/admin`;

  before(async () => {
    server = spawn('node', ['--loader', 'ts-node/esm', 'examples/external-auth-demo-app/src/main.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
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

    await waitForHttpReady(`${adminBaseUrl}/_auth/config`, () => serverOutput);
  });

  after(async () => {
    if (server.exitCode === null) {
      server.kill('SIGKILL');
      await once(server, 'exit');
    }
  });

  it('exposes external auth configuration and reuses host sessions', async () => {
    const authConfig = await request(adminBaseUrl, '/_auth/config');
    assert.equal(authConfig.response.status, 200);
    assert.equal(authConfig.body.mode, 'external');
    assert.equal(authConfig.body.loginEnabled, false);
    assert.equal(authConfig.body.branding.siteHeader, 'Northwind Admin');
    assert.equal(authConfig.body.branding.siteTitle, 'Northwind Admin');
    assert.equal(
      authConfig.body.loginUrl,
      '/host-auth/login?next=http%3A%2F%2Flocalhost%3A5173%2Fadmin%2F',
    );

    const unauthenticated = await fetch(`${adminBaseUrl}/_meta`);
    assert.equal(unauthenticated.status, 401);

    const builtInLogin = await request(adminBaseUrl, '/_auth/login', {
      method: 'POST',
      body: {
        email: 'ada@example.com',
        password: 'admin123',
      },
    });
    assert.equal(builtInLogin.response.status, 404);

    const hostLogin = await request(baseUrl, '/host-auth/login', {
      method: 'POST',
      body: {
        email: 'ada@example.com',
        password: 'admin123',
      },
    });
    assert.equal(hostLogin.response.status, 201);
    const cookie = hostLogin.response.headers.get('set-cookie') ?? '';
    assert.ok(cookie.includes('host_demo_session='));

    const meta = await request(adminBaseUrl, '/_meta', { cookie });
    assert.equal(meta.response.status, 200);
    assert.ok(meta.body.resources.some((resource: { resourceName: string }) => resource.resourceName === 'users'));

    const createdCategory = await request(adminBaseUrl, '/categories', {
      method: 'POST',
      cookie,
      body: {
        name: 'Hidden from editors',
        description: 'Should not appear in the editor audit log',
      },
    });
    assert.equal(createdCategory.response.status, 201);

    const createdOrder = await request(adminBaseUrl, '/orders', {
      method: 'POST',
      cookie,
      body: {
        number: 'ORD-9999',
        orderDate: '2026-04-15T12:00:00.000Z',
        deliveryTime: '13:00',
        fulfillmentAt: '2026-04-15T13:15:00.000Z',
        userId: 2,
        status: 'pending',
        total: 88.5,
        internalNote: 'Visible to editors through audit filtering',
      },
    });
    assert.equal(createdOrder.response.status, 201);

    const me = await request(adminBaseUrl, '/_auth/me', { cookie });
    assert.equal(me.response.status, 200);
    assert.equal(me.body.user.email, 'ada@example.com');

    const logout = await request(adminBaseUrl, '/_auth/logout', {
      method: 'POST',
      cookie,
    });
    assert.equal(logout.response.status, 201);

    const editorLogin = await request(baseUrl, '/host-auth/login', {
      method: 'POST',
      body: {
        email: 'grace@example.com',
        password: 'editor123',
      },
    });
    assert.equal(editorLogin.response.status, 201);
    const editorCookie = editorLogin.response.headers.get('set-cookie') ?? '';
    assert.ok(editorCookie.includes('host_demo_session='));

    const editorMeta = await request(adminBaseUrl, '/_meta', { cookie: editorCookie });
    assert.equal(editorMeta.response.status, 200);
    assert.deepEqual(
      editorMeta.body.resources.map((resource: { resourceName: string }) => resource.resourceName),
      ['orders'],
    );
    assert.equal(editorMeta.body.pages.length, 0);
    assert.equal(editorMeta.body.auditLog.enabled, true);

    const editorCreatedOrder = await request(adminBaseUrl, '/orders', {
      method: 'POST',
      cookie: editorCookie,
      body: {
        number: 'ORD-1004',
        orderDate: '2026-04-16T09:00:00.000Z',
        deliveryTime: '10:00',
        fulfillmentAt: '2026-04-16T10:30:00.000Z',
        userId: 2,
        status: 'pending',
        total: 54.2,
        internalNote: 'Created by Grace',
      },
    });
    assert.equal(editorCreatedOrder.response.status, 201);
    assert.equal(editorCreatedOrder.body.number, 'ORD-1004');

    const editorAudit = await request(adminBaseUrl, '/_audit?page=1&pageSize=20', {
      cookie: editorCookie,
    });
    assert.equal(editorAudit.response.status, 200);
    assert.ok(
      editorAudit.body.items.some(
        (entry: { action: string; actor: { email?: string }; resourceName?: string }) =>
          entry.action === 'login' && entry.actor.email === 'grace@example.com' && !entry.resourceName,
      ),
    );
    assert.ok(
      editorAudit.body.items.some(
        (entry: { action: string; resourceName?: string; objectLabel?: string }) =>
          entry.action === 'create' &&
          entry.resourceName === 'orders' &&
          (entry.objectLabel === 'ORD-9999' || entry.objectLabel === 'ORD-1004'),
      ),
    );
    assert.ok(
      editorAudit.body.items.every(
        (entry: { resourceName?: string; actor: { email?: string } }) =>
          !entry.resourceName ||
          entry.resourceName === 'orders' ||
          entry.actor.email === 'grace@example.com',
      ),
    );

    const blockedLogin = await request(baseUrl, '/host-auth/login', {
      method: 'POST',
      body: {
        email: 'linus@example.com',
        password: 'viewer123',
      },
    });
    assert.equal(blockedLogin.response.status, 201);
    const blockedCookie = blockedLogin.response.headers.get('set-cookie') ?? '';
    assert.ok(blockedCookie.includes('host_demo_session='));

    const blockedMeta = await fetch(`${adminBaseUrl}/_meta`, {
      headers: {
        cookie: blockedCookie,
      },
    });
    assert.equal(blockedMeta.status, 401);
  });
});
