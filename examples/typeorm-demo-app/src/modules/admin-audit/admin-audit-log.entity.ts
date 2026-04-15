import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'admin_audit_logs' })
export class AdminAuditLogEntity {
  @PrimaryColumn('varchar')
  id!: string;

  @Column({ type: 'timestamptz' })
  timestamp!: Date;

  @Column({ type: 'varchar' })
  action!: string;

  @Column({ type: 'varchar' })
  actorId!: string;

  @Column({ type: 'varchar' })
  actorRole!: string;

  @Column({ type: 'varchar', nullable: true })
  actorEmail!: string | null;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ type: 'varchar', nullable: true })
  resourceName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  resourceLabel!: string | null;

  @Column({ type: 'varchar', nullable: true })
  objectId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  objectLabel!: string | null;

  @Column({ type: 'varchar', nullable: true })
  actionLabel!: string | null;

  @Column({ type: 'integer', nullable: true })
  count!: number | null;
}
