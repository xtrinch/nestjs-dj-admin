import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const port = 3112;
const baseUrl = `http://127.0.0.1:${port}`;
const outputDir = new URL('../docs/screenshots/', import.meta.url);

await mkdir(outputDir, { recursive: true });

const server = spawn(
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

try {
  const stderr = [];
  server.stderr.setEncoding('utf8');
  server.stderr.on('data', (chunk) => {
    stderr.push(chunk);
  });

  server.stdout.setEncoding('utf8');
  await waitForProcessReady(server, `ADMIN_E2E_READY ${port}`, stderr);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1024 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  console.log('Logging in');
  await login(page);

  console.log('Capturing users list');
  await page.goto(`${baseUrl}/admin#/users`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'User' }).waitFor({ timeout: 10000 });
  await page.getByRole('cell', { name: 'ada@example.com' }).waitFor({ timeout: 10000 });
  await page.screenshot({
    path: fileURLToPath(new URL('users-list.png', outputDir)),
  });

  console.log('Capturing orders list');
  await page.goto(`${baseUrl}/admin#/orders`);
  await page.getByRole('heading', { name: 'Order' }).waitFor({ timeout: 10000 });
  await page.getByRole('cell', { name: 'ORD-1001' }).waitFor({ timeout: 10000 });
  await page.screenshot({
    path: fileURLToPath(new URL('orders-list.png', outputDir)),
  });

  console.log('Capturing user edit');
  await page.goto(`${baseUrl}/admin#/users/edit/1`);
  await page.getByRole('heading', { name: 'ada@example.com' }).waitFor({ timeout: 10000 });
  await page.screenshot({
    path: fileURLToPath(new URL('user-edit.png', outputDir)),
  });

  console.log('Capturing custom page');
  await page.goto(`${baseUrl}/admin#/pages/grafana-overview`);
  await page.getByRole('heading', { name: 'Grafana Overview' }).waitFor({ timeout: 10000 });
  await page.locator('iframe[title="Grafana Overview"]').waitFor({ timeout: 10000 });
  await page.screenshot({
    path: fileURLToPath(new URL('grafana-overview.png', outputDir)),
  });

  console.log('Capturing queue overview');
  await page.goto(`${baseUrl}/admin#/queues`);
  await page.getByRole('heading', { name: 'Queues overview' }).waitFor({ timeout: 10000 });
  await page.getByRole('link', { name: 'Email' }).waitFor({ timeout: 10000 });
  await page.screenshot({
    path: fileURLToPath(new URL('queues-overview.png', outputDir)),
  });

  console.log('Capturing queue detail');
  await page.goto(`${baseUrl}/admin#/queues/email`);
  await page.getByRole('heading', { name: 'Email' }).waitFor({ timeout: 10000 });
  await page.locator('.queue-table').waitFor({ timeout: 10000 });
  await page.screenshot({
    path: fileURLToPath(new URL('queue-email-detail.png', outputDir)),
  });

  console.log('Capturing order detail with related queue jobs');
  await page.goto(`${baseUrl}/admin#/orders/edit/301`);
  await page.getByRole('heading', { name: 'ORD-1001' }).waitFor({ timeout: 10000 });
  await page.getByRole('heading', { name: 'Related queue jobs' }).waitFor({ timeout: 10000 });
  await page.screenshot({
    path: fileURLToPath(new URL('order-related-queue-jobs.png', outputDir)),
  });

  console.log('Done');
  await browser.close();
} finally {
  if (server.exitCode === null) {
    server.kill('SIGKILL');
    await once(server, 'exit');
  }
}

async function login(page) {
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

  if (response.status !== 201) {
    throw new Error(`Login failed with ${response.status}`);
  }

  const cookie = response.headers.get('set-cookie');
  if (!cookie) {
    throw new Error('Missing session cookie');
  }

  const [cookiePair] = cookie.split(';', 1);
  const separatorIndex = cookiePair.indexOf('=');
  if (separatorIndex === -1) {
    throw new Error('Invalid session cookie');
  }

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
}

async function waitForProcessReady(server, marker, stderr) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Timed out waiting for ${marker}\n${stderr.join('')}`.trim(),
        ),
      );
    }, 30000);

    function onStdout(chunk) {
      if (chunk.includes(marker)) {
        cleanup();
        resolve();
      }
    }

    function onExit(code) {
      cleanup();
      reject(new Error(`Server exited early with code ${code}\n${stderr.join('')}`.trim()));
    }

    function cleanup() {
      clearTimeout(timeout);
      server.stdout.off('data', onStdout);
      server.off('exit', onExit);
    }

    server.stdout.on('data', onStdout);
    server.on('exit', onExit);
  });
}
