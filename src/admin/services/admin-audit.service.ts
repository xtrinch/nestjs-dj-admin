import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ADMIN_OPTIONS } from '../admin.constants.js';
import type {
  AdminAuditEntry,
  AdminAuditEvent,
  AdminAuditResult,
  AdminAuditStore,
  AdminModuleOptions,
} from '../types/admin.types.js';

@Injectable()
export class AdminAuditService {
  private readonly store: AdminAuditStore;

  constructor(@Inject(ADMIN_OPTIONS) private readonly options: AdminModuleOptions) {
    this.store = options.auditLog?.store ?? new InMemoryAdminAuditStore();
  }

  get enabled(): boolean {
    return this.options.auditLog?.enabled !== false;
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

  async list(query: { page: number; pageSize: number }): Promise<AdminAuditResult> {
    if (!this.enabled) {
      return { items: [], total: 0 };
    }

    return this.store.list(query);
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
