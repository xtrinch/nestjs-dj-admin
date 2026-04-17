import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { once } from 'node:events';
import type { Readable } from 'node:stream';
import { loginAs, request, runCommand, waitForHttpReady } from './helpers/admin-demo-e2e-suite.js';

describe('TypeORM built demo smoke', { timeout: 180_000 }, () => {
  let server: ChildProcessByStdio<null, Readable, Readable>;
  let serverOutput = '';
  const port = 3112;
  const baseUrl = `http://127.0.0.1:${port}`;
  const adminBaseUrl = `${baseUrl}/admin`;
  const env = {
    DB_NAME: 'nestjs_dj_admin_demo_built_smoke',
  };

  before(async () => {
    await runCommand('npm', ['run', 'typeorm:setup:example'], env);
    await runCommand('npm', ['run', 'build:typeorm-example'], env);

    server = spawn('node', ['examples/typeorm-demo-app/dist/examples/typeorm-demo-app/src/main.js'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env,
        PORT: String(port),
        ADMIN_E2E_ENABLE_RESET: 'true',
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

  it('boots the built TypeORM demo and serves admin metadata', async () => {
    const unauthenticated = await fetch(`${adminBaseUrl}/_meta`);
    assert.equal(unauthenticated.status, 401);

    const login = await loginAs(adminBaseUrl, 'ada@example.com', 'admin123');
    assert.equal(login.response.status, 201);
    assert.ok(login.cookie.includes('admin_session='));

    const meta = await request(adminBaseUrl, '/_meta', {
      cookie: login.cookie,
    });
    assert.equal(meta.response.status, 200);
    assert.ok(
      meta.body.pages.some(
        (page: { slug: string; kind: string }) =>
          page.slug === 'grafana-overview' && page.kind === 'embed',
      ),
    );
    assert.ok(
      meta.body.navItems.some(
        (item: { kind: string; pageSlug?: string }) =>
          item.kind === 'page' && item.pageSlug === 'grafana-overview',
      ),
    );
    assert.ok(
      meta.body.widgets.some(
        (widget: { kind: string; pageSlug?: string }) =>
          widget.kind === 'page-link' && widget.pageSlug === 'grafana-overview',
      ),
    );
  });
});
