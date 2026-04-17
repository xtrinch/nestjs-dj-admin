import { randomUUID } from 'node:crypto';
import {
  CanActivate,
  Inject,
  Injectable,
  NotFoundException,
  Type,
  UnauthorizedException,
} from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import type { CookieOptions, Request, Response } from 'express';
import { ADMIN_OPTIONS } from '../admin.constants.js';
import { AdminAuditService } from './admin-audit.service.js';
import { getUserRoles } from '../utils/user-roles.js';
import type {
  AdminAuthConfigSchema,
  AdminAuthCredentials,
  AdminBrandingSchema,
  AdminExternalAuthOptions,
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
    private readonly moduleRef: ModuleRef,
    private readonly auditService: AdminAuditService,
  ) {
    this.sessionStore = this.sessionAuthOptions(options)?.sessionStore ?? new InMemoryAdminSessionStore();
  }

  async login(
    credentials: AdminAuthCredentials,
    request: Request,
    response: Response,
  ): Promise<AdminRequestUser> {
    if (this.isExternalAuth()) {
      throw new NotFoundException('Admin login is managed by the host application');
    }

    const authenticate = this.sessionAuthOptions()?.authenticate;
    if (!authenticate) {
      throw new NotFoundException('Admin authentication is not configured');
    }

    const authenticatedUser = await authenticate(credentials, request);
    const user = authenticatedUser ? this.normalizeUser(authenticatedUser) : null;
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
    const externalAuth = this.externalAuthOptions();
    if (externalAuth) {
      await externalAuth.logout?.(request, response);

      if (user) {
        await this.auditService.record({
          action: 'logout',
          actor: user,
          summary: `${user.email ?? user.id} logged out`,
        });
      }
      return;
    }

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
    return request.user ? this.normalizeUser(request.user) : null;
  }

  async getCurrentUserAsync(request: Request): Promise<AdminRequestUser | null> {
    if (request.user) {
      const normalizedUser = this.normalizeUser(request.user);
      request.user = normalizedUser;
      return normalizedUser;
    }

    if (this.isExternalAuth()) {
      await this.runExternalGuards(request);
      const externalAuth = this.externalAuthOptions();
      const resolvedUser = externalAuth ? await externalAuth.resolveUser(request) : null;
      const user = resolvedUser ? this.normalizeUser(resolvedUser) : null;
      if (user) {
        request.user = user;
      }
      return user;
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
      request.user = this.normalizeUser(record.user);
    }

    return request.user ? this.normalizeUser(request.user) : null;
  }

  async requireUser(request: Request): Promise<AdminRequestUser> {
    const user = await this.getCurrentUserAsync(request);
    if (!user) {
      throw new UnauthorizedException('Admin login required');
    }

    return user;
  }

  getAuthConfig(): AdminAuthConfigSchema {
    const externalAuth = this.externalAuthOptions();
    if (externalAuth) {
      return {
        mode: 'external',
        loginEnabled: false,
        logoutEnabled: typeof externalAuth.logout === 'function',
        loginUrl: externalAuth.loginUrl,
        loginMessage: externalAuth.loginMessage,
        branding: this.resolveBranding(),
      };
    }

    return {
      mode: 'session',
      loginEnabled: true,
      logoutEnabled: true,
      branding: this.resolveBranding(),
    };
  }

  private resolveBranding(): AdminBrandingSchema {
    return {
      siteHeader: this.options.branding?.siteHeader ?? 'DJ Admin',
      siteTitle: this.options.branding?.siteTitle ?? 'DJ Admin',
      indexTitle: this.options.branding?.indexTitle ?? 'Site administration',
      accentColor: this.options.branding?.accentColor ?? '#f59e0b',
    };
  }

  private get cookieName(): string {
    return this.sessionAuthOptions()?.cookieName ?? 'admin_session';
  }

  private get rememberMeMaxAgeMs(): number {
    return this.sessionAuthOptions()?.rememberMeMaxAgeMs ?? 1000 * 60 * 60 * 24 * 30;
  }

  private get sessionTtlMs(): number {
    return this.sessionAuthOptions()?.sessionTtlMs ?? 1000 * 60 * 60 * 12;
  }

  private cookieOptions(request: Request): CookieOptions {
    const configured = this.sessionAuthOptions()?.cookie ?? {};
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

  private isExternalAuth(): boolean {
    return this.options.auth?.mode === 'external';
  }

  private sessionAuthOptions(options: AdminModuleOptions = this.options) {
    if (!options.auth || options.auth.mode === 'external') {
      return null;
    }

    return options.auth;
  }

  private externalAuthOptions(): AdminExternalAuthOptions | null {
    if (this.options.auth?.mode !== 'external') {
      return null;
    }

    return this.options.auth;
  }

  private normalizeUser(
    user: { id: string; roles?: string[]; email?: string; isSuperuser?: boolean },
  ): AdminRequestUser {
    const roles = getUserRoles(user);
    if (roles.length === 0) {
      throw new UnauthorizedException('Resolved admin user must include at least one role');
    }

    const normalizedUser: AdminRequestUser = {
      ...user,
      roles,
    };

    return {
      ...normalizedUser,
      isSuperuser: normalizedUser.isSuperuser ?? this.isSuperuser(normalizedUser),
    };
  }

  private isSuperuser(user: AdminRequestUser): boolean {
    return this.options.auth?.isSuperuser?.(user) ?? getUserRoles(user).includes('admin');
  }

  private async runExternalGuards(request: Request): Promise<void> {
    const externalAuth = this.externalAuthOptions();
    if (!externalAuth) {
      return;
    }

    const guardedRequest = request as Request & { __djAdminGuardsSatisfied?: boolean };
    if (guardedRequest.__djAdminGuardsSatisfied) {
      return;
    }

    const guards = externalAuth.guards ?? [];
    if (guards.length === 0) {
      guardedRequest.__djAdminGuardsSatisfied = true;
      return;
    }

    const context = new ExecutionContextHost([request]);
    context.setType('http');

    for (const guardToken of guards) {
      const guard = await this.resolveGuard(guardToken, request);
      const result = await guard.canActivate(context);
      if (!result) {
        throw new UnauthorizedException('Admin login required');
      }
    }

    guardedRequest.__djAdminGuardsSatisfied = true;
  }

  private async resolveGuard(
    guardToken: CanActivate | Type<CanActivate>,
    request: Request,
  ): Promise<CanActivate> {
    if (typeof guardToken !== 'function') {
      return guardToken;
    }

    const contextId = ContextIdFactory.getByRequest(request);
    return this.moduleRef.resolve(guardToken, contextId, {
      strict: false,
    });
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
