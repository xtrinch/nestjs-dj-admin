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
    assert.equal(authConfig.body.loginUrl, '/host-auth/login?next=/admin');

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

    const me = await request(adminBaseUrl, '/_auth/me', { cookie });
    assert.equal(me.response.status, 200);
    assert.equal(me.body.user.email, 'ada@example.com');

    const logout = await request(adminBaseUrl, '/_auth/logout', {
      method: 'POST',
      cookie,
    });
    assert.equal(logout.response.status, 201);
  });
});
