import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from 'playwright';

const CHROME_PATH = process.env['PLAYWRIGHT_CHROME_PATH'] ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHROME_DEBUG_PORT = 9223;

describe('Admin frontend smoke', () => {
  let server: ChildProcessByStdio<null, Readable, Readable>;
  let chrome: ChildProcessByStdio<null, Readable, Readable>;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  const port = 3106;
  const baseUrl = `http://127.0.0.1:${port}`;

  before(async () => {
    const userDataDir = await mkdtemp(path.join(tmpdir(), 'dj-admin-smoke-chrome-'));
    chrome = spawn(
      CHROME_PATH,
      [
        `--remote-debugging-port=${CHROME_DEBUG_PORT}`,
        `--user-data-dir=${userDataDir}`,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-sandbox',
        'about:blank',
      ],
      {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    await waitForChrome(CHROME_DEBUG_PORT);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${CHROME_DEBUG_PORT}`);

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

    server.stdout.setEncoding('utf8');
    await waitForReady(server.stdout, `ADMIN_E2E_READY ${port}`);
  });

  after(async () => {
    await browser.close();

    if (chrome.exitCode === null) {
      chrome.kill('SIGKILL');
      await once(chrome, 'exit');
    }

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
    await page.goto('about:blank');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  afterEach(async () => {
    await page.close();
  });

  it('covers create/edit save intents, password change, object actions, and audit log UI', async () => {
    await login(page, baseUrl);

    await page.getByRole('link', { name: 'Users' }).click();
    await page.getByRole('link', { name: 'New User' }).click();

    await page.getByLabel('Email').fill('smoke-admin@example.com');
    await page.getByLabel('Password', { exact: true }).fill('firstPass123');
    await page.getByLabel('Password confirmation').fill('firstPass123');
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
    await page.getByRole('cell', { name: 'Created smoke-admin@example.com' }).waitFor();
    await page.getByRole('cell', { name: 'Ran Deactivate on smoke-admin@example.com' }).waitFor();
    await page.getByRole('cell', { name: 'Changed password for smoke-admin@example.com' }).waitFor();
  });

  it('covers soft delete flow and visibility filter from the UI', async () => {
    await login(page, baseUrl);

    await page.getByRole('link', { name: 'Products' }).click();
    await page.getByRole('heading', { name: 'Products' }).waitFor();
    await page.getByRole('cell', { name: 'Chai' }).waitFor();
    await assertRowMissing(page, 'Ikura');

    await filterSelect(page, 'Visibility').selectOption('deleted');
    await page.getByRole('cell', { name: 'Ikura' }).waitFor();
    await assertRowMissing(page, 'Chai');

    await filterSelect(page, 'Visibility').selectOption('active');
    await page.getByRole('cell', { name: 'Chai' }).waitFor();

    await row(page, 'Chai').getByRole('link', { name: 'Archive' }).click();
    await page.getByRole('heading', { name: 'Archive Chai' }).waitFor();
    await page.getByRole('button', { name: 'Archive Chai' }).click();

    await expectToast(page, 'Chai archived.');
    await assertRowMissing(page, 'Chai');

    await filterSelect(page, 'Visibility').selectOption('deleted');
    await page.getByRole('cell', { name: 'Chai' }).waitFor();
    await page.getByRole('cell', { name: 'Ikura' }).waitFor();
  });

  it('covers relation sidebar filters and bulk actions from the UI', async () => {
    await login(page, baseUrl);

    await page.getByRole('link', { name: 'Orders' }).click();
    await page.getByRole('heading', { name: 'Orders' }).waitFor();

    const userFilter = relationFilter(page, 'User');
    await userFilter.getByRole('button').click();
    await userFilter.getByRole('button', { name: 'ada@example.com' }).waitFor();
    await userFilter.getByRole('button', { name: 'grace@example.com' }).waitFor();
    await userFilter.getByRole('textbox').fill('grace');
    await userFilter.getByRole('button', { name: 'grace@example.com' }).click();

    await page.getByRole('cell', { name: 'ORD-1002' }).waitFor();
    await assertRowMissing(page, 'ORD-1001');

    await page.getByRole('link', { name: 'Users' }).click();
    await page.getByRole('heading', { name: 'Users' }).waitFor();
    await row(page, 'ada@example.com').locator('input[type="checkbox"]').check();
    await row(page, 'grace@example.com').locator('input[type="checkbox"]').check();
    await page.getByRole('combobox').first().selectOption({ label: 'Deactivate selected' });
    await page.getByRole('button', { name: 'Go' }).click();

    await expectToast(page, 'Deactivate selected applied to 2 users.');
    await row(page, 'ada@example.com').getByRole('link', { name: 'ada@example.com' }).click();
    await expectUnchecked(page.getByLabel('Active'));
  });
});

async function login(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/admin`);
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByLabel('Password').fill('admin123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'Users' }).waitFor();
}

function filterSelect(page: Page, label: string) {
  return page.locator('.filters-sidebar__filter').filter({ hasText: label }).locator('select');
}

function relationFilter(page: Page, label: string) {
  return page.locator('.filters-sidebar__filter').filter({ hasText: label });
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
  assert.equal(await locator.isChecked(), false);
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

async function waitForReady(stream: NodeJS.ReadableStream, marker: string): Promise<void> {
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

async function waitForChrome(port: number): Promise<void> {
  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until Chrome opens the debugging port.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Chrome debugging port ${port} did not become ready`);
}
