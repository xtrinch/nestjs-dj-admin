import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Inject,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ADMIN_OPTIONS } from '../admin.constants.js';
import type {
  AdminAuthCredentials,
  AdminModuleOptions,
  AdminRequestUser,
} from '../types/admin.types.js';

@Injectable()
export class AdminAuthService {
  private readonly sessions = new Map<string, AdminRequestUser>();

  constructor(@Inject(ADMIN_OPTIONS) private readonly options: AdminModuleOptions) {}

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
    this.sessions.set(sessionId, user);
    response.cookie(this.cookieName, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });

    request.user = user;
    return user;
  }

  logout(request: Request, response: Response): void {
    const sessionId = this.readSessionId(request);
    if (sessionId) {
      this.sessions.delete(sessionId);
    }

    response.clearCookie(this.cookieName, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });
  }

  getCurrentUser(request: Request): AdminRequestUser | null {
    if (request.user) {
      return request.user;
    }

    const sessionId = this.readSessionId(request);
    if (!sessionId) {
      return null;
    }

    const user = this.sessions.get(sessionId) ?? null;
    if (user) {
      request.user = user;
    }

    return user;
  }

  requireUser(request: Request): AdminRequestUser {
    const user = this.getCurrentUser(request);
    if (!user) {
      throw new UnauthorizedException('Admin login required');
    }

    return user;
  }

  private get cookieName(): string {
    return this.options.auth?.cookieName ?? 'admin_session';
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
