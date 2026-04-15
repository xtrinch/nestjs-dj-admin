import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Inject,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { ADMIN_OPTIONS } from '../admin.constants.js';
import { AdminAuditService } from './admin-audit.service.js';
import type {
  AdminAuthCredentials,
  AdminModuleOptions,
  AdminRequestUser,
  AdminSessionRecord,
  AdminSessionStore,
} from '../types/admin.types.js';

@Injectable()
export class AdminAuthService {
  private readonly sessionStore: AdminSessionStore;

  constructor(
    @Inject(ADMIN_OPTIONS) private readonly options: AdminModuleOptions,
    private readonly auditService: AdminAuditService,
  ) {
    this.sessionStore = options.auth?.sessionStore ?? new InMemoryAdminSessionStore();
  }

  async login(
    credentials: AdminAuthCredentials,
    request: Request,
    response: Response,
  ): Promise<AdminRequestUser> {
    const authenticate = this.options.auth?.authenticate;
    if (!authenticate) {
      throw new NotFoundException('Admin authentication is not configured');
    }

    const user = await authenticate(credentials, request);
    if (!user) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const sessionId = randomUUID();
    await this.sessionStore.set(sessionId, {
      user,
      expiresAt: Date.now() + (credentials.rememberMe ? this.rememberMeMaxAgeMs : this.sessionTtlMs),
    });
    response.cookie(this.cookieName, sessionId, {
      ...this.cookieOptions(request),
      maxAge: credentials.rememberMe ? this.rememberMeMaxAgeMs : undefined,
    });

    request.user = user;
    await this.auditService.record({
      action: 'login',
      actor: user,
      summary: `${user.email ?? user.id} logged in`,
    });
    return user;
  }

  async logout(request: Request, response: Response): Promise<void> {
    const user = await this.getCurrentUserAsync(request);
    const sessionId = this.readSessionId(request);
    if (sessionId) {
      await this.sessionStore.delete(sessionId);
    }

    response.clearCookie(this.cookieName, this.cookieOptions(request));

    if (user) {
      await this.auditService.record({
        action: 'logout',
        actor: user,
        summary: `${user.email ?? user.id} logged out`,
      });
    }
  }

  getCurrentUser(request: Request): AdminRequestUser | null {
    return request.user ?? null;
  }

  async getCurrentUserAsync(request: Request): Promise<AdminRequestUser | null> {
    if (request.user) {
      return request.user;
    }

    const sessionId = this.readSessionId(request);
    if (!sessionId) {
      return null;
    }

    const record = await this.sessionStore.get(sessionId);
    if (!record) {
      return null;
    }

    if (record.expiresAt && record.expiresAt <= Date.now()) {
      await this.sessionStore.delete(sessionId);
      return null;
    }

    if (record.user) {
      request.user = record.user;
    }

    return record.user;
  }

  async requireUser(request: Request): Promise<AdminRequestUser> {
    const user = await this.getCurrentUserAsync(request);
    if (!user) {
      throw new UnauthorizedException('Admin login required');
    }

    return user;
  }

  private get cookieName(): string {
    return this.options.auth?.cookieName ?? 'admin_session';
  }

  private get rememberMeMaxAgeMs(): number {
    return this.options.auth?.rememberMeMaxAgeMs ?? 1000 * 60 * 60 * 24 * 30;
  }

  private get sessionTtlMs(): number {
    return this.options.auth?.sessionTtlMs ?? 1000 * 60 * 60 * 12;
  }

  private cookieOptions(request: Request): CookieOptions {
    const configured = this.options.auth?.cookie ?? {};
    const secureSetting = configured.secure ?? 'auto';

    return {
      httpOnly: configured.httpOnly ?? true,
      sameSite: configured.sameSite ?? 'lax',
      secure: secureSetting === 'auto' ? this.isSecureRequest(request) : secureSetting,
      path: configured.path ?? '/',
      domain: configured.domain,
    };
  }

  private isSecureRequest(request: Request): boolean {
    if (request.secure) {
      return true;
    }

    const forwardedProto = request.header('x-forwarded-proto');
    return typeof forwardedProto === 'string'
      ? forwardedProto.split(',')[0]?.trim().toLowerCase() === 'https'
      : false;
  }

  private readSessionId(request: Request): string | null {
    const cookieHeader = request.header('cookie');
    if (!cookieHeader) {
      return null;
    }

    for (const part of cookieHeader.split(';')) {
      const [name, ...value] = part.trim().split('=');
      if (name === this.cookieName) {
        return decodeURIComponent(value.join('='));
      }
    }

    return null;
  }
}

class InMemoryAdminSessionStore implements AdminSessionStore {
  private readonly sessions = new Map<string, AdminSessionRecord>();

  get(sessionId: string): AdminSessionRecord | null {
    return this.sessions.get(sessionId) ?? null;
  }

  set(sessionId: string, record: AdminSessionRecord): void {
    this.sessions.set(sessionId, record);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
