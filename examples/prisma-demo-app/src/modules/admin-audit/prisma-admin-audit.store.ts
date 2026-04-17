import type { AdminAuditEntry, AdminAuditResult, AdminAuditStore } from '#src/admin/types/admin.types.js';
import { Prisma, type PrismaClient } from '@prisma/client';

export class PrismaAdminAuditStore implements AdminAuditStore {
  constructor(private readonly prisma: PrismaClient) {}

  async append(entry: AdminAuditEntry, maxEntries: number): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "AdminAuditLog" (
          "id",
          "timestamp",
          "action",
          "actorId",
          "actorRole",
          "actorEmail",
          "summary",
          "resourceName",
          "resourceLabel",
          "objectId",
          "objectLabel",
          "actionLabel",
          "count"
        ) VALUES (
          ${entry.id},
          ${new Date(entry.timestamp)},
          ${entry.action},
          ${entry.actor.id},
          ${entry.actor.permissions[0] ?? ''},
          ${entry.actor.email ?? null},
          ${entry.summary},
          ${entry.resourceName ?? null},
          ${entry.resourceLabel ?? null},
          ${entry.objectId ?? null},
          ${entry.objectLabel ?? null},
          ${entry.actionLabel ?? null},
          ${entry.count ?? null}
        )
      `,
    );

    const overflow = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id"
        FROM "AdminAuditLog"
        ORDER BY "timestamp" DESC, "id" DESC
        OFFSET ${maxEntries}
      `,
    );

    if (overflow.length > 0) {
      await this.prisma.$executeRaw(
        Prisma.sql`
          DELETE FROM "AdminAuditLog"
          WHERE "id" IN (${Prisma.join(overflow.map((item) => item.id))})
        `,
      );
    }
  }

  async list(query: { page: number; pageSize: number }): Promise<AdminAuditResult> {
    const page = Math.max(1, query.page);
    const pageSize = Math.max(1, query.pageSize);
    const offset = (page - 1) * pageSize;
    const [rows, totalRows] = await this.prisma.$transaction([
      this.prisma.$queryRaw<Array<AuditRow>>(
        Prisma.sql`
          SELECT *
          FROM "AdminAuditLog"
          ORDER BY "timestamp" DESC, "id" DESC
          OFFSET ${offset}
          LIMIT ${pageSize}
        `,
      ),
      this.prisma.$queryRaw<Array<{ count: bigint }>>(
        Prisma.sql`SELECT COUNT(*)::bigint AS "count" FROM "AdminAuditLog"`,
      ),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp.toISOString(),
        action: row.action as AdminAuditEntry['action'],
        actor: {
          id: row.actorId,
          permissions: [row.actorRole],
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
      total: Number(totalRows[0]?.count ?? 0n),
    };
  }
}

type AuditRow = {
  id: string;
  timestamp: Date;
  action: string;
  actorId: string;
  actorRole: string;
  actorEmail: string | null;
  summary: string;
  resourceName: string | null;
  resourceLabel: string | null;
  objectId: string | null;
  objectLabel: string | null;
  actionLabel: string | null;
  count: number | null;
};
