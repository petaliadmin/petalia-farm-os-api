import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("webhook_endpoints")
@Index(["organisationId", "livemode", "status"])
export class WebhookEndpoint {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ default: true })
  livemode: boolean;

  @Column({ type: "uuid" })
  organisationId: string;

  @Column({ length: 2048 })
  url: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  description: string | null;

  /** Event types, or ["*"] for all. */
  @Column({ type: "jsonb", default: ["*"] })
  enabledEvents: string[];

  /** whsec_… HMAC-SHA256 signing secret, returned once at creation. */
  @Column({ select: false })
  secret: string;

  @Column({ length: 16, default: "enabled" })
  status: "enabled" | "disabled";

  /** Payloads are rendered with the version pinned at creation. */
  @Column({ length: 10 })
  apiVersion: string;

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, string>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  deletedAt: Date | null;
}
