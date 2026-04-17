import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ADMIN_OPTIONS } from '../admin.constants.js';
import type {
  AdminAuditEntry,
  AdminAuditEvent,
  AdminAuditResult,
  AdminAuditStore,
  AdminModuleOptions,
  AdminRequestUser,
} from '../types/admin.types.js';

@Injectable()
export class AdminAuditService {
  private readonly store: AdminAuditStore;

  constructor(@Inject(ADMIN_OPTIONS) private readonly options: AdminModuleOptions) {
    this.store = options.auditLog?.store ?? new InMemoryAdminAuditStore();
  }

  get enabled(): boolean {
    return this.options.auditLog?.enabled === true;
  }

  async record(event: AdminAuditEvent): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await this.store.append(
      {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        ...event,
      },
      this.options.auditLog?.maxEntries ?? 500,
    );
  }

  async list(
    query: { page: number; pageSize: number },
    options?: {
      user?: AdminRequestUser;
      canReadResource?: (resourceName: string) => boolean;
    },
  ): Promise<AdminAuditResult> {
    if (!this.enabled) {
      return { items: [], total: 0 };
    }

    const allEntries = await this.store.list({
      page: 1,
      pageSize: this.options.auditLog?.maxEntries ?? 500,
    });

    const filteredItems = (allEntries.items ?? []).filter((entry) => this.isVisibleEntry(entry, options));
    const page = Math.max(1, query.page);
    const pageSize = Math.max(1, query.pageSize);
    const start = (page - 1) * pageSize;

    return {
      items: filteredItems.slice(start, start + pageSize),
      total: filteredItems.length,
    };
  }

  private isVisibleEntry(
    entry: AdminAuditEntry,
    options:
      | {
          user?: AdminRequestUser;
          canReadResource?: (resourceName: string) => boolean;
        }
      | undefined,
  ): boolean {
    if (!options?.user) {
      return true;
    }

    if (entry.resourceName) {
      return options.canReadResource?.(entry.resourceName) ?? true;
    }

    if (options.user.isSuperuser === true) {
      return true;
    }

    return (
      entry.actor.id === options.user.id ||
      (entry.actor.email != null && entry.actor.email === options.user.email)
    );
  }
}

class InMemoryAdminAuditStore implements AdminAuditStore {
  private readonly entries: AdminAuditEntry[] = [];

  append(entry: AdminAuditEntry, maxEntries: number): void {
    this.entries.unshift(entry);
    if (this.entries.length > maxEntries) {
      this.entries.length = maxEntries;
    }
  }

  list(query: { page: number; pageSize: number }): AdminAuditResult {
    const page = Math.max(1, query.page);
    const pageSize = Math.max(1, query.pageSize);
    const start = (page - 1) * pageSize;

    return {
      items: this.entries.slice(start, start + pageSize),
      total: this.entries.length,
    };
  }
}
