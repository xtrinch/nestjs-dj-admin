import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import express, { type Request, type Response } from 'express';
import { ADMIN_OPTIONS } from '../admin.constants.js';
import type { AdminModuleOptions } from '../types/admin.types.js';

const INDEX_FILE = 'index.html';

@Injectable()
export class AdminUiService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminUiService.name);
  private mounted = false;

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    @Inject(ADMIN_OPTIONS) private readonly options: AdminModuleOptions,
  ) {}

  onApplicationBootstrap(): void {
    if (this.mounted) {
      return;
    }

    const frontendDist = resolveAdminUiDist();
    if (!frontendDist) {
      this.logger.debug('Admin UI assets not found. Skipping static mount.');
      return;
    }

    const mountPath = normalizeMountPath(this.options.path);
    const http = this.httpAdapterHost.httpAdapter.getInstance();
    const canonicalMountPath = mountPath === '/' ? '/' : `${mountPath}/`;
    const exactMountPathPattern = new RegExp(`^${escapeRegex(mountPath)}$`);

    http.use(mountPath, express.static(frontendDist, { index: false }));
    http.get(exactMountPathPattern, (request: Request, response: Response) => {
      if (mountPath !== '/') {
        const queryIndex = request.originalUrl.indexOf('?');
        const query = queryIndex >= 0 ? request.originalUrl.slice(queryIndex) : '';
        response.redirect(308, `${canonicalMountPath}${query}`);
        return;
      }

      response.sendFile(join(frontendDist, INDEX_FILE));
    });
    http.get(canonicalMountPath, (_request: Request, response: Response) => {
      response.sendFile(join(frontendDist, INDEX_FILE));
    });

    this.mounted = true;
  }
}

function normalizeMountPath(path: string): string {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }

  return path.replace(/\/+$/, '') || '/';
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveAdminUiDist(): string | null {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFile);
  const candidates = [
    resolve(currentDir, '..', '..', '..', 'dist', 'admin-ui'),
    resolve(currentDir, '..', '..', '..', '..', 'dist', 'admin-ui'),
  ];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, INDEX_FILE))) {
      return candidate;
    }
  }

  return null;
}
