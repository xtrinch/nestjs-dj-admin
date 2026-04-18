import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { once } from 'node:events';
import type { Readable } from 'node:stream';
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from 'playwright';

describe('Admin frontend smoke', { timeout: 90_000 }, () => {
  let server: ChildProcessByStdio<null, Readable, Readable>;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  const port = 3106;
  const baseUrl = `http://127.0.0.1:${port}`;

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
    await waitForProcessReady(server, `ADMIN_E2E_READY ${port}`, stderr);
    browser = await chromium.launch({ headless: true });
  });

  after(async () => {
    await browser.close();

    if (server.exitCode === null) {
      server.kill('SIGKILL');
      await once(server, 'exit');
    }
  });

  beforeEach(async () => {
    const response = await fetch(`${baseUrl}/__test/reset`, { method: 'POST' });
    assert.equal(response.status, 201);

    context = browser.contexts()[0] ?? await browser.newContext();
    await context.clearCookies();
    page = await context.newPage();
  });

  afterEach(async () => {
    await page.close();
  });

  it('covers create/edit save intents, password change, object actions, and audit log UI', { timeout: 45_000 }, async () => {
    await login(page, baseUrl);

    await sidebarLink(page, 'User').click();
    await page.getByRole('link', { name: 'New User' }).click();

    await page.getByLabel('Email').fill('smoke-admin@example.com');
    await page.locator('input[type="password"]').first().fill('firstPass123');
    await page.locator('input[type="password"]').nth(1).fill('firstPass123');
    await page.getByLabel('Role').selectOption('admin');
    await ensureChecked(page.getByLabel('Active'));
    await page.getByRole('button', { name: 'Save and continue editing' }).click();

    await expectToast(page, 'User created.');
    await page.getByRole('heading', { name: 'smoke-admin@example.com' }).waitFor();
    await page.getByRole('link', { name: 'Change password' }).waitFor();

    await page.getByRole('button', { name: 'Deactivate' }).click();
    await expectToast(page, 'User deactivate.');
    await expectUnchecked(page.getByLabel('Active'));

    await page.getByRole('link', { name: 'Change password' }).click();
    await page.getByRole('heading', { name: 'smoke-admin@example.com' }).waitFor();
    await page.getByLabel('New password').fill('secondPass123');
    await page.getByLabel('Confirm password').fill('secondPass123');
    await page.getByRole('button', { name: 'Change password' }).click();

    await expectToast(page, 'User password updated.');
    await page.getByRole('heading', { name: 'smoke-admin@example.com' }).waitFor();

    await page.getByRole('link', { name: 'Audit Log' }).click();
    await page.getByRole('heading', { name: 'Audit Log' }).waitFor();
    await page.getByRole('cell', { name: 'Created User smoke-admin@example.com' }).waitFor();
    await page.getByRole('cell', { name: 'Ran Deactivate on smoke-admin@example.com' }).waitFor();
    await page.getByRole('cell', { name: 'Changed password for User smoke-admin@example.com' }).waitFor();
  });

  it('covers soft delete flow and visibility filter from the UI', { timeout: 45_000 }, async () => {
    await login(page, baseUrl);

    await sidebarLink(page, 'Product').click();
    await page.getByRole('heading', { name: 'Product' }).waitFor();
    await page.getByRole('cell', { name: 'Chai' }).waitFor();
    await assertRowMissing(page, 'Ikura');

    await filterSelect(page, 'Visibility').selectOption('deleted');
    await page.getByRole('cell', { name: 'Ikura' }).waitFor();
    await assertRowMissing(page, 'Chai');

    await filterSelect(page, 'Visibility').selectOption('active');
    await page.getByRole('cell', { name: 'Chai' }).waitFor();

    await row(page, 'Chai').getByRole('link').first().click();
    await page.getByRole('heading', { name: 'Chai' }).waitFor();
    await page.getByRole('link', { name: 'Archive this Product' }).click();
    await page.getByRole('heading', { name: 'Archive Chai' }).waitFor();
    await page.getByRole('button', { name: 'Archive Chai' }).click();

    await expectToast(page, 'Chai archived.');
    await assertRowMissing(page, 'Chai');

    await filterSelect(page, 'Visibility').selectOption('deleted');
    await page.getByRole('cell', { name: 'Chai' }).waitFor();
    await page.getByRole('cell', { name: 'Ikura' }).waitFor();
  });

  it('covers relation sidebar filters and bulk actions from the UI', { timeout: 45_000 }, async () => {
    await login(page, baseUrl);

    await sidebarLink(page, 'Order').click();
    await page.getByRole('heading', { name: 'Order' }).waitFor();

    const userFilter = relationFilter(page, 'User');
    await userFilter.locator('.relation-picker__trigger').click();
    await userFilter.locator('.relation-picker__dropdown input[type="search"]').waitFor();
    await userFilter.locator('.relation-option--button', { hasText: 'ada@example.com' }).waitFor();
    await userFilter.locator('.relation-option--button', { hasText: 'grace@example.com' }).waitFor();
    await userFilter.locator('.relation-picker__dropdown input[type="search"]').fill('grace');
    await userFilter.locator('.relation-option--button', { hasText: 'grace@example.com' }).click();

    await page.getByRole('cell', { name: 'ORD-1002' }).waitFor();
    await assertRowMissing(page, 'ORD-1001');

    await sidebarLink(page, 'User').click();
    await page.getByRole('heading', { name: 'User' }).waitFor();
    await row(page, 'ada@example.com').locator('input[type="checkbox"]').check();
    await row(page, 'grace@example.com').locator('input[type="checkbox"]').check();
    await page.getByRole('combobox').first().selectOption({ label: 'Deactivate selected' });
    await page.getByRole('button', { name: 'Go' }).click();

    await expectToast(page, 'Deactivate selected applied to 2 users.');
    await row(page, 'ada@example.com').getByRole('link').first().click();
    await expectUnchecked(checkboxField(page, 'Active'));
  });

  it('renders extension-provided embed pages in the sidebar', { timeout: 45_000 }, async () => {
    await login(page, baseUrl);

    await sidebarLink(page, 'Grafana overview').click();
    await page.getByRole('heading', { name: 'Grafana Overview' }).waitFor();
    await page.locator('iframe[title="Grafana Overview"]').waitFor();
  });

  it('renders queue extension pages and supports queue/job actions', { timeout: 45_000 }, async () => {
    await login(page, baseUrl);

    await page.goto(`${baseUrl}/admin#/queues`);
    await page.getByRole('heading', { name: 'Queues overview' }).waitFor();
    await page.getByRole('link', { name: 'Open queue' }).first().click();

    await page.getByRole('heading', { name: 'Email' }).waitFor();
    await page.getByRole('button', { name: 'Retry failed jobs' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Retry failed jobs', exact: true }).click();
    await expectToast(page, 'Email retry failed complete');

    await page.getByRole('button', { name: 'Failed', exact: true }).click();
    await page.getByRole('cell', { name: 'No failed jobs found.' }).waitFor();

    await page.getByRole('button', { name: 'Waiting', exact: true }).click();
    await page.getByRole('link', { name: 'send-welcome-email' }).click();
    await page.getByRole('heading', { name: 'send-welcome-email' }).waitFor();
    await page.getByRole('button', { name: 'Remove job' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove job', exact: true }).click();
    await expectToast(page, 'Job email-1001 remove complete.');
    await page.getByRole('heading', { name: 'Email' }).waitFor();
  });
});

async function login(page: Page, baseUrl: string) {
  const response = await fetch(`${baseUrl}/admin/_auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: 'ada@example.com',
      password: 'admin123',
      rememberMe: false,
    }),
  });

  assert.equal(response.status, 201);
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie);

  const [cookiePair] = cookie.split(';', 1);
  const separatorIndex = cookiePair.indexOf('=');
  assert.notEqual(separatorIndex, -1);

  await page.context().addCookies([
    {
      name: cookiePair.slice(0, separatorIndex),
      value: cookiePair.slice(separatorIndex + 1),
      domain: '127.0.0.1',
      path: '/admin',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  await page.goto(`${baseUrl}/admin#/users`);
  await sidebarLink(page, 'User').waitFor();
}

function filterSelect(page: Page, label: string) {
  return page.locator('.filters-sidebar__filter').filter({ hasText: label }).locator('select');
}

function relationFilter(page: Page, label: string) {
  return page.locator('.filters-sidebar__filter').filter({ hasText: label });
}

function sidebarLink(page: Page, label: string) {
  return page.getByRole('complementary').getByRole('link', { name: label });
}

function checkboxField(page: Page, label: string) {
  return page.locator('.field--checkbox').filter({ hasText: label }).locator('input[type="checkbox"]');
}

function row(page: Page, text: string) {
  return page.locator('tbody tr').filter({ hasText: text }).first();
}

async function assertRowMissing(page: Page, text: string) {
  await assertVisibleCount(row(page, text), 0);
}

async function assertVisibleCount(locator: Locator, count: number) {
  await poll(async () => {
    assert.equal(await locator.count(), count);
  });
}

async function expectToast(page: Page, text: string) {
  await page.locator('.toast').filter({ hasText: text }).waitFor();
}

async function ensureChecked(locator: Locator) {
  if (!(await locator.isChecked())) {
    await locator.check();
  }
}

async function expectUnchecked(locator: Locator) {
  await locator.waitFor();
  await poll(async () => {
    assert.equal(await locator.isChecked(), false);
  });
}

async function poll(assertion: () => Promise<void>, timeoutMs = 5000, intervalMs = 100): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw lastError;
}

async function waitForProcessReady(
  process: ChildProcessByStdio<null, Readable, Readable>,
  marker: string,
  stderr: string[],
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let buffer = '';
    let settled = false;

    const onData = (chunk: string | Buffer) => {
      buffer += chunk.toString();
      if (buffer.includes(marker)) {
        settled = true;
        process.stdout.off('data', onData);
        process.stdout.off('error', onError);
        process.off('exit', onExit);
        resolve();
      }
    };

    const onError = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      process.stdout.off('data', onData);
      process.off('exit', onExit);
      reject(error);
    };

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (settled) {
        return;
      }

      settled = true;
      process.stdout.off('data', onData);
      process.stdout.off('error', onError);
      reject(
        new Error(
          `Fixture app exited before becoming ready (code=${code ?? 'null'}, signal=${signal ?? 'null'}): ${stderr.join('')}`.trim(),
        ),
      );
    };

    process.stdout.on('data', onData);
    process.stdout.once('error', onError);
    process.once('exit', onExit);
  });
}
