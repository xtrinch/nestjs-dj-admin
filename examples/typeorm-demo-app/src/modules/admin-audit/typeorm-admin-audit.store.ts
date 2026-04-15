import type { AdminAuditEntry, AdminAuditResult, AdminAuditStore } from '#src/admin/types/admin.types.js';
import type { DataSource } from 'typeorm';
import { AdminAuditLogEntity } from './admin-audit-log.entity.js';

export class TypeOrmAdminAuditStore implements AdminAuditStore {
  constructor(private readonly getDataSource: () => Promise<DataSource>) {}

  async append(entry: AdminAuditEntry, maxEntries: number): Promise<void> {
    const dataSource = await this.getDataSource();
    const repository = dataSource.getRepository(AdminAuditLogEntity);

    await repository.save({
      id: entry.id,
      timestamp: new Date(entry.timestamp),
      action: entry.action,
      actorId: entry.actor.id,
      actorRole: entry.actor.role,
      actorEmail: entry.actor.email ?? null,
      summary: entry.summary,
      resourceName: entry.resourceName ?? null,
      resourceLabel: entry.resourceLabel ?? null,
      objectId: entry.objectId ?? null,
      objectLabel: entry.objectLabel ?? null,
      actionLabel: entry.actionLabel ?? null,
      count: entry.count ?? null,
    });

    const overflow = await repository.find({
      select: { id: true },
      order: { timestamp: 'DESC', id: 'DESC' },
      skip: maxEntries,
    });

    if (overflow.length > 0) {
      await repository.delete(overflow.map((item) => item.id));
    }
  }

  async list(query: { page: number; pageSize: number }): Promise<AdminAuditResult> {
    const dataSource = await this.getDataSource();
    const repository = dataSource.getRepository(AdminAuditLogEntity);
    const page = Math.max(1, query.page);
    const pageSize = Math.max(1, query.pageSize);
    const [rows, total] = await repository.findAndCount({
      order: { timestamp: 'DESC', id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp.toISOString(),
        action: entryAction(row.action),
        actor: {
          id: row.actorId,
          role: row.actorRole,
          email: row.actorEmail ?? undefined,
        },
        summary: row.summary,
        resourceName: row.resourceName ?? undefined,
        resourceLabel: row.resourceLabel ?? undefined,
        objectId: row.objectId ?? undefined,
        objectLabel: row.objectLabel ?? undefined,
        actionLabel: row.actionLabel ?? undefined,
        count: row.count ?? undefined,
      })),
      total,
    };
  }
}

function entryAction(value: string): AdminAuditEntry['action'] {
  return value as AdminAuditEntry['action'];
}
