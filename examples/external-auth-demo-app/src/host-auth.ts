import { randomUUID } from 'node:crypto';
import {
  Body,
  CanActivate,
  Controller,
  Get,
  Injectable,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AdminAuthUser } from '#src/admin/types/admin.types.js';
import { DEMO_IN_MEMORY_ADMIN_STORE } from '#examples-shared/in-memory-demo-store.js';
import { verifyPassword } from '../../in-memory-demo-app/src/auth/password.js';

const HOST_SESSION_COOKIE = 'host_demo_session';
const hostSessions = new Map<string, AdminAuthUser>();

@Injectable()
export class HostSessionGuard implements CanActivate {
  canActivate(context: Parameters<CanActivate['canActivate']>[0]): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = resolveHostSessionUser(request);
    if (!user) {
      return false;
    }

    request.user = user;
    return true;
  }
}

@Injectable()
export class AdminAccessGuard implements CanActivate {
  canActivate(context: Parameters<CanActivate['canActivate']>[0]): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    return !request.user?.roles?.includes('viewer');
  }
}

@Controller('host-auth')
export class HostAuthController {
  @Get('login')
  showLoginPage(@Query('next') next = '/admin', @Res() response: Response) {
    response.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>External Auth Demo</title>
    <style>
      body {
        font-family: ui-sans-serif, system-ui, sans-serif;
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0f172a;
        color: #e2e8f0;
      }
      main {
        width: min(560px, calc(100vw - 32px));
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.24);
        border-radius: 18px;
        padding: 28px;
      }
      a {
        color: #f59e0b;
      }
      .actions {
        display: grid;
        gap: 12px;
        margin-top: 20px;
      }
      .button {
        display: inline-block;
        padding: 10px 14px;
        border-radius: 999px;
        background: #f59e0b;
        color: #111827;
        text-decoration: none;
        font-weight: 600;
      }
      code {
        color: #fbbf24;
      }
    </style>
  </head>
  <body>
    <main>
      <p>External host auth demo</p>
      <h1>Sign in through the host app</h1>
      <p>
        The admin itself is configured in <code>external</code> auth mode. These links create a host app
        session cookie, then redirect back into the admin.
      </p>
      <div class="actions">
        <a class="button" href="/host-auth/login/ada?next=${encodeURIComponent(next)}">Sign in as Ada Admin</a>
        <a class="button" href="/host-auth/login/grace?next=${encodeURIComponent(next)}">Sign in as Grace Editor</a>
        <a class="button" href="/host-auth/login/linus?next=${encodeURIComponent(next)}">Sign in as Linus Viewer (blocked from admin)</a>
      </div>
    </main>
  </body>
</html>`);
  }

  @Get('login/:userKey')
  signInAsDemoUser(
    @Param('userKey') userKey: string,
    @Query('next') next = '/admin',
    @Res() response: Response,
  ) {
    const user = createDemoUserSession(userKey);
    if (!user) {
      response.status(404).send('Unknown demo user');
      return;
    }

    const sessionId = issueHostSession(user);
    response.cookie(HOST_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    response.redirect(next);
  }

  @Post('login')
  login(
    @Body() credentials: { email?: string; password?: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = authenticateDemoUser(credentials.email ?? '', credentials.password ?? '');
    if (!user) {
      response.status(401);
      return {
        message: 'Invalid host app credentials',
      };
    }

    const sessionId = issueHostSession(user);
    response.cookie(HOST_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

    return { user };
  }

  @Post('logout')
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    clearHostSession(request, response);
    return { success: true };
  }
}

export function clearHostSession(request: Request, response: Response): void {
  const sessionId = readCookie(request, HOST_SESSION_COOKIE);
  if (sessionId) {
    hostSessions.delete(sessionId);
  }

  response.clearCookie(HOST_SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}

function issueHostSession(user: AdminAuthUser): string {
  const sessionId = randomUUID();
  hostSessions.set(sessionId, user);
  return sessionId;
}

function createDemoUserSession(userKey: string): AdminAuthUser | null {
  const email =
    userKey === 'ada'
      ? 'ada@example.com'
      : userKey === 'grace'
        ? 'grace@example.com'
        : userKey === 'linus'
          ? 'linus@example.com'
        : null;

  if (!email) {
    return null;
  }

  const record = DEMO_IN_MEMORY_ADMIN_STORE.users.find(
    (candidate) => String(candidate.email ?? '') === email,
  );
  if (!record) {
    return null;
  }

  return {
    id: String(record.id),
    roles: [String(record.role)],
    email: String(record.email),
  };
}

function authenticateDemoUser(email: string, password: string): AdminAuthUser | null {
  const record = DEMO_IN_MEMORY_ADMIN_STORE.users.find(
    (candidate) => String(candidate.email ?? '') === email,
  );
  if (!record) {
    return null;
  }

  if (!verifyPassword(password, String(record.passwordHash ?? ''))) {
    return null;
  }

  return {
    id: String(record.id),
    roles: [String(record.role)],
    email: String(record.email),
  };
}

function resolveHostSessionUser(request: Request): AdminAuthUser | null {
  const sessionId = readCookie(request, HOST_SESSION_COOKIE);
  if (!sessionId) {
    return null;
  }

  return hostSessions.get(sessionId) ?? null;
}

function readCookie(request: Request, cookieName: string): string | null {
  const cookieHeader = request.header('cookie');
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === cookieName) {
      return decodeURIComponent(value.join('='));
    }
  }

  return null;
}
