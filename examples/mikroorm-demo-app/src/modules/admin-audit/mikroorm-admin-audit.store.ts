import type { AdminAuditEntry, AdminAuditResult, AdminAuditStore } from '#src/admin/types/admin.types.js';
import type { MikroORM } from '@mikro-orm/postgresql';
import { AdminAuditLogEntity } from './admin-audit-log.entity.js';

export class MikroOrmAdminAuditStore implements AdminAuditStore {
  constructor(private readonly getOrm: () => Promise<MikroORM>) {}

  async append(entry: AdminAuditEntry, maxEntries: number): Promise<void> {
    const orm = await this.getOrm();
    const em = orm.em.fork({ clear: true });

    em.persist(em.create(AdminAuditLogEntity, {
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
    }));
    await em.flush();

    const overflow = await em.find(AdminAuditLogEntity, {}, {
      orderBy: { timestamp: 'desc', id: 'desc' },
      offset: maxEntries,
    });

    if (overflow.length > 0) {
      em.remove(overflow);
      await em.flush();
    }
  }

  async list(query: { page: number; pageSize: number }): Promise<AdminAuditResult> {
    const orm = await this.getOrm();
    const em = orm.em.fork({ clear: true });
    const page = Math.max(1, query.page);
    const pageSize = Math.max(1, query.pageSize);
    const [rows, total] = await em.findAndCount(AdminAuditLogEntity, {}, {
      orderBy: { timestamp: 'desc', id: 'desc' },
      offset: (page - 1) * pageSize,
      limit: pageSize,
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp.toISOString(),
        action: row.action as AdminAuditEntry['action'],
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
