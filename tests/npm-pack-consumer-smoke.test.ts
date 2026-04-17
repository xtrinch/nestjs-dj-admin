import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { loginAs, request, runCommand, waitForHttpReady } from './helpers/admin-demo-e2e-suite.js';

describe('npm pack consumer smoke', { timeout: 180_000 }, () => {
  let server: ChildProcessByStdio<null, Readable, Readable>;
  let serverOutput = '';
  let tempDir = '';
  let npmCacheDir = '';
  const port = 3114;
  const baseUrl = `http://127.0.0.1:${port}`;
  const adminBaseUrl = `${baseUrl}/admin`;

  before(async () => {
    const repoRoot = process.cwd();
    tempDir = await mkdtemp(path.join(repoRoot, '.tmp-npm-pack-smoke-'));
    npmCacheDir = path.join(tempDir, '.npm-cache');

    await runCommand('npm', ['run', 'build:lib'], undefined);
    const tarballInfo = await packTarball(repoRoot, tempDir, npmCacheDir);
    const tarballPath = path.join(tempDir, tarballInfo.filename);
    const packageVersions = await loadConsumerRuntimeVersions(repoRoot);

    await writeFile(path.join(tempDir, 'package.json'), createConsumerPackageJson(tarballPath, packageVersions));
    await writeFile(path.join(tempDir, 'app.mjs'), createConsumerAppSource());

    await runCommandInDir(
      tempDir,
      'npm',
      ['install', '--no-package-lock', '--ignore-scripts'],
      {
        ...process.env,
        npm_config_cache: npmCacheDir,
        npm_config_fund: 'false',
        npm_config_audit: 'false',
      },
    );

    server = spawn('node', ['app.mjs'], {
      cwd: tempDir,
      env: {
        ...process.env,
        PORT: String(port),
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
    if (server?.exitCode === null) {
      server.kill('SIGKILL');
      await once(server, 'exit');
    }

    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('boots from the packed tarball with extension metadata available', async () => {
    const unauthenticated = await fetch(`${adminBaseUrl}/_meta`);
    assert.equal(unauthenticated.status, 401);

    const login = await loginAs(adminBaseUrl, 'ada@example.com', 'admin123');
    assert.equal(login.response.status, 201);
    assert.ok(login.cookie.includes('admin_session='));

    const meta = await request(adminBaseUrl, '/_meta', { cookie: login.cookie });
    assert.equal(meta.response.status, 200);
    assert.ok(meta.body.resources.some((resource: { resourceName: string }) => resource.resourceName === 'users'));
    assert.ok(
      meta.body.pages.some(
        (page: { slug: string; kind: string }) =>
          page.slug === 'consumer-monitoring' && page.kind === 'embed',
      ),
    );
    assert.ok(
      meta.body.navItems.some(
        (item: { kind: string; pageSlug?: string }) =>
          item.kind === 'page' && item.pageSlug === 'consumer-monitoring',
      ),
    );
    assert.ok(
      meta.body.widgets.some(
        (widget: { kind: string; pageSlug?: string }) =>
          widget.kind === 'page-link' && widget.pageSlug === 'consumer-monitoring',
      ),
    );
  });
});

async function packTarball(
  repoRoot: string,
  destination: string,
  npmCacheDir: string,
): Promise<{ filename: string }> {
  const result = await new Promise<string>((resolve, reject) => {
    const child = spawn('npm', ['pack', '--json', '--pack-destination', destination], {
      cwd: repoRoot,
      env: {
        ...process.env,
        npm_config_cache: npmCacheDir,
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
        resolve(output);
        return;
      }

      reject(new Error(`npm pack failed\n${output}`));
    });
  });

  const parsed = JSON.parse(result) as Array<{ filename: string }>;
  if (!parsed[0]?.filename) {
    throw new Error(`npm pack did not return a tarball filename\n${result}`);
  }

  return parsed[0];
}

async function runCommandInDir(
  cwd: string,
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv | undefined,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
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

      reject(new Error(`Command failed in ${cwd}: ${command} ${args.join(' ')}\n${output}`));
    });
  });
}

function createConsumerPackageJson(
  tarballPath: string,
  packageVersions: Record<string, string>,
): string {
  return JSON.stringify(
    {
      name: 'npm-pack-consumer-smoke',
      private: true,
      type: 'module',
      dependencies: {
        'nestjs-dj-admin': `file:${tarballPath}`,
        ...packageVersions,
      },
    },
    null,
    2,
  );
}

async function loadConsumerRuntimeVersions(repoRoot: string): Promise<Record<string, string>> {
  const packageJson = JSON.parse(
    await readFile(path.join(repoRoot, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const source = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  return {
    '@nestjs/common': requireVersion(source, '@nestjs/common'),
    '@nestjs/core': requireVersion(source, '@nestjs/core'),
    '@nestjs/platform-express': requireVersion(source, '@nestjs/platform-express'),
    'class-transformer': requireVersion(source, 'class-transformer'),
    'class-validator': requireVersion(source, 'class-validator'),
    express: requireVersion(source, 'express'),
    'reflect-metadata': requireVersion(source, 'reflect-metadata'),
    rxjs: requireVersion(source, 'rxjs'),
  };
}

function requireVersion(source: Record<string, string>, packageName: string): string {
  const version = source[packageName];
  if (!version) {
    throw new Error(`Missing runtime version for ${packageName} in root package.json`);
  }

  return version;
}

function createConsumerAppSource(): string {
  return `import 'reflect-metadata';
import { Injectable, Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';
import {
  AdminModule,
  AdminResource,
  InMemoryAdminAdapter,
  adminSchemaFromClassValidator,
} from 'nestjs-dj-admin';
import { dashboardLinkWidgetExtension } from 'nestjs-dj-admin/dashboard-link-widget-extension';
import { embedPageExtension } from 'nestjs-dj-admin/embed-page-extension';

const dashboardPreviewUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent('<!doctype html><title>npm-pack-consumer</title><p>consumer monitoring</p>');

class User {}

class CreateUserDto {
  email;
  role;
  active;
}
IsEmail()(CreateUserDto.prototype, 'email');
IsString()(CreateUserDto.prototype, 'role');
IsBoolean()(CreateUserDto.prototype, 'active');
IsOptional()(CreateUserDto.prototype, 'active');

class UpdateUserDto {
  email;
  role;
  active;
}
IsEmail()(UpdateUserDto.prototype, 'email');
IsOptional()(UpdateUserDto.prototype, 'email');
IsString()(UpdateUserDto.prototype, 'role');
IsOptional()(UpdateUserDto.prototype, 'role');
IsBoolean()(UpdateUserDto.prototype, 'active');
IsOptional()(UpdateUserDto.prototype, 'active');

class UserAdmin {}
Injectable()(UserAdmin);
AdminResource({
  model: User,
  resourceName: 'users',
  objectLabel: 'email',
  list: ['id', 'email', 'role', 'active'],
  search: ['email', 'role'],
  permissions: {
    read: ['admin'],
    write: ['admin'],
  },
  schema: adminSchemaFromClassValidator({
    createDto: CreateUserDto,
    updateDto: UpdateUserDto,
  }),
})(UserAdmin);

class AppModule {}
Module({
  imports: [
    AdminModule.forRoot({
      path: '/admin',
      adapter: InMemoryAdminAdapter,
      extensions: [
        embedPageExtension({
          id: 'consumer-monitoring-page',
          page: {
            slug: 'consumer-monitoring',
            label: 'Consumer monitoring',
            category: 'Monitoring',
            title: 'Consumer Monitoring',
            description: 'Loaded from the packed npm tarball.',
            url: dashboardPreviewUrl,
            height: 320,
          },
        }),
        dashboardLinkWidgetExtension({
          id: 'consumer-monitoring-widget',
          title: 'Consumer monitoring',
          description: 'Open the consumer monitoring page.',
          pageSlug: 'consumer-monitoring',
        }),
      ],
      auth: {
        authenticate: async ({ email, password }) => {
          if (email !== 'ada@example.com' || password !== 'admin123') {
            return null;
          }

          return {
            id: '1',
            role: 'admin',
            email,
          };
        },
      },
      auditLog: {
        enabled: true,
      },
    }),
  ],
  providers: [UserAdmin],
})(AppModule);

const app = await NestFactory.create(AppModule, { logger: false });
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidUnknownValues: false,
  }),
);

await app.listen(Number(process.env.PORT ?? 3114), '127.0.0.1');
`;
}
