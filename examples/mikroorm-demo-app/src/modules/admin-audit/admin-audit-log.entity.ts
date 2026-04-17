import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'admin_audit_logs' })
export class AdminAuditLogEntity {
  @PrimaryKey()
  id!: string;

  @Property()
  timestamp!: Date;

  @Property()
  action!: string;

  @Property()
  actorId!: string;

  @Property()
  actorRole!: string;

  @Property({ nullable: true })
  actorEmail!: string | null;

  @Property({ columnType: 'text' })
  summary!: string;

  @Property({ nullable: true })
  resourceName!: string | null;

  @Property({ nullable: true })
  resourceLabel!: string | null;

  @Property({ nullable: true })
  objectId!: string | null;

  @Property({ nullable: true })
  objectLabel!: string | null;

  @Property({ nullable: true })
  actionLabel!: string | null;

  @Property({ nullable: true })
  count!: number | null;
}
