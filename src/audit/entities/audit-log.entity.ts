import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

export type AuditSeverity = "info" | "warning" | "critical";

/**
 * Immutable audit trail. Bank/insurance compliance requires we can answer:
 *   "who did what, when, from where, and what changed?"
 *
 * Rules:
 *   - INSERT only — never UPDATE or DELETE entries
 *   - Hot path indexes: (organisationId, createdAt), (userId, createdAt), (resource, resourceId)
 *   - PII (passwords, tokens) MUST be redacted before persisting
 */
@Entity({ name: "audit_logs" })
@Index("idx_audit_org_created", ["organisationId", "createdAt"])
@Index("idx_audit_user_created", ["userId", "createdAt"])
@Index("idx_audit_resource", ["resource", "resourceId"])
@Index("idx_audit_action", ["action"])
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", nullable: true })
  userId: string | null;

  @Column({ type: "uuid", nullable: true })
  organisationId: string | null;

  @Column({ type: "varchar", length: 128 })
  action: string;

  @Column({ type: "varchar", length: 128, nullable: true })
  resource: string | null;

  @Column({ type: "varchar", length: 128, nullable: true })
  resourceId: string | null;

  @Column({ type: "varchar", length: 16, default: "info" })
  severity: AuditSeverity;

  @Column({ type: "varchar", length: 8, nullable: true })
  method: string | null;

  @Column({ type: "varchar", length: 512, nullable: true })
  path: string | null;

  @Column({ type: "smallint", nullable: true })
  statusCode: number | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  ip: string | null;

  @Column({ type: "varchar", length: 512, nullable: true })
  userAgent: string | null;

  @Column({ type: "jsonb", nullable: true })
  changes: Record<string, unknown> | null;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: "text", nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
