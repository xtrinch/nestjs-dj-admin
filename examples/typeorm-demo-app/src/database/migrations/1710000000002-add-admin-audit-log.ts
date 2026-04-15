import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminAuditLog1710000000002 implements MigrationInterface {
  name = 'AddAdminAuditLog1710000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admin_audit_logs" (
        "id" varchar PRIMARY KEY NOT NULL,
        "timestamp" TIMESTAMPTZ NOT NULL,
        "action" varchar NOT NULL,
        "actorId" varchar NOT NULL,
        "actorRole" varchar NOT NULL,
        "actorEmail" varchar,
        "summary" text NOT NULL,
        "resourceName" varchar,
        "resourceLabel" varchar,
        "objectId" varchar,
        "objectLabel" varchar,
        "actionLabel" varchar,
        "count" integer
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_admin_audit_logs_timestamp_id"
      ON "admin_audit_logs" ("timestamp" DESC, "id" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_admin_audit_logs_timestamp_id"`);
    await queryRunner.query(`DROP TABLE "admin_audit_logs"`);
  }
}
