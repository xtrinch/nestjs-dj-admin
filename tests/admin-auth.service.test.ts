import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { ModuleRef } from '@nestjs/core';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AdminAuditService } from '../src/admin/services/admin-audit.service.js';
import { AdminAuthService } from '../src/admin/services/admin-auth.service.js';
import type {
  AdminModuleOptions,
  AdminRequestUser,
  AdminSessionRecord,
  AdminSessionStore,
} from '../src/admin/types/admin.types.js';

describe('AdminAuthService', () => {
  it('uses a custom session store and secure cookies for https requests', async () => {
    const store = new RecordingSessionStore();
    const service = createService({
      path: 'admin',
      auth: {
        authenticate: async () => ({
          id: '1',
          role: 'admin',
          email: 'ada@example.com',
        }),
        sessionStore: store,
        cookie: {
          secure: 'auto',
          sameSite: 'strict',
          path: '/admin',
        },
      },
    });

    const request = createRequest({
      headers: {
        'x-forwarded-proto': 'https',
      },
    });
    const response = createResponse();

    const user = await service.login(
      { email: 'ada@example.com', password: 'secret' },
      request,
      response,
    );

    assert.equal(user.email, 'ada@example.com');
    assert.equal(store.setCalls.length, 1);
    assert.equal(store.setCalls[0].record.user.email, 'ada@example.com');
    assert.equal(response.cookies.length, 1);
    assert.equal(response.cookies[0].name, 'admin_session');
    assert.equal(response.cookies[0].options.secure, true);
    assert.equal(response.cookies[0].options.sameSite, 'strict');
    assert.equal(response.cookies[0].options.path, '/admin');
  });

  it('expires stale sessions from the store and rejects the request', async () => {
    const store = new RecordingSessionStore();
    store.records.set('expired-session', {
      user: {
        id: '1',
        role: 'admin',
        email: 'ada@example.com',
      },
      expiresAt: Date.now() - 1000,
    });

    const service = createService({
      path: 'admin',
      auth: {
        authenticate: async () => null,
        sessionStore: store,
      },
    });

    const request = createRequest({
      headers: {
        cookie: 'admin_session=expired-session',
      },
    });

    await assert.rejects(
      service.requireUser(request),
      (error: unknown) => error instanceof UnauthorizedException,
    );
    assert.deepEqual(store.deleteCalls, ['expired-session']);
  });

  it('supports external auth via resolveUser', async () => {
    const service = createService({
      path: 'admin',
      auth: {
        mode: 'external',
        isSuperuser: (user) => user.role === 'platform-owner',
        resolveUser: (request) => {
          return request.user ?? null;
        },
        loginUrl: '/host-auth/login',
        loginMessage: 'Use the host app',
      },
    });

    const request = createRequest({
      user: {
        id: '1',
        role: 'platform-owner',
        email: 'ada@example.com',
      },
    });

    const user = await service.requireUser(request);
    assert.equal(user.email, 'ada@example.com');
    assert.equal(user.isSuperuser, true);
    assert.deepEqual(service.getAuthConfig(), {
      mode: 'external',
      loginEnabled: false,
      logoutEnabled: false,
      loginUrl: '/host-auth/login',
      loginMessage: 'Use the host app',
      branding: {
        siteHeader: 'DJ Admin',
        siteTitle: 'DJ Admin',
        indexTitle: 'Site administration',
        accentColor: '#f59e0b',
      },
    });
  });

  it('normalizes session-auth users with custom superuser logic', async () => {
    const service = createService({
      path: 'admin',
      auth: {
        isSuperuser: (user) => user.role === 'ops-admin',
        authenticate: async () => ({
          id: '1',
          role: 'ops-admin',
          email: 'ada@example.com',
        }),
      },
    });

    const response = createResponse();
    const request = createRequest({});
    const user = await service.login({ email: 'ada@example.com', password: 'secret' }, request, response);

    assert.equal(user.isSuperuser, true);
    assert.equal(request.user?.isSuperuser, true);
  });

  it('rejects built-in login when auth is external', async () => {
    const service = createService({
      path: 'admin',
      auth: {
        mode: 'external',
        resolveUser: async () => null,
      },
    });

    await assert.rejects(
      service.login(
        { email: 'ada@example.com', password: 'secret' },
        createRequest({}),
        createResponse(),
      ),
      (error: unknown) =>
        error instanceof NotFoundException &&
        error.message === 'Admin login is managed by the host application',
    );
  });
});

function createService(options: AdminModuleOptions): AdminAuthService {
  const auditService = new AdminAuditService(options);
  const moduleRef = {
    resolve: async (token: unknown) => token,
  } as ModuleRef;
  return new AdminAuthService(options, moduleRef, auditService);
}

function createRequest(input: {
  headers?: Record<string, string>;
  secure?: boolean;
  user?: AdminRequestUser;
}): Request {
  return {
    user: input.user,
    secure: input.secure ?? false,
    header(name: string) {
      return input.headers?.[name.toLowerCase()] ?? input.headers?.[name] ?? undefined;
    },
  } as Request;
}

function createResponse(): Response & {
  cookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }>;
} {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  return {
    cookies,
    cookie(name: string, value: string, options: Record<string, unknown>) {
      cookies.push({ name, value, options });
      return this as Response;
    },
    clearCookie() {
      return this as Response;
    },
  } as Response & {
    cookies: Array<{
      name: string;
      value: string;
      options: Record<string, unknown>;
    }>;
  };
}

class RecordingSessionStore implements AdminSessionStore {
  readonly records = new Map<string, AdminSessionRecord>();
  readonly setCalls: Array<{ sessionId: string; record: AdminSessionRecord }> = [];
  readonly deleteCalls: string[] = [];

  get(sessionId: string): AdminSessionRecord | null {
    return this.records.get(sessionId) ?? null;
  }

  set(sessionId: string, record: AdminSessionRecord): void {
    this.records.set(sessionId, record);
    this.setCalls.push({ sessionId, record });
  }

  delete(sessionId: string): void {
    this.records.delete(sessionId);
    this.deleteCalls.push(sessionId);
  }
}
