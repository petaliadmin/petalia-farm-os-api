import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type NotificationStatus = "queued" | "sent" | "failed";

/** A message pushed to a farmer over SMS, WhatsApp, USSD or voice. */
@Entity("channel_notifications")
@Index(["organisationId", "livemode", "createdAt"])
@Index(["farmerId", "createdAt"])
export class ChannelNotification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ default: true })
  livemode: boolean;

  @Column({ type: "uuid" })
  organisationId: string;

  @Column({ type: "uuid", nullable: true })
  farmerId: string | null;

  @Column({ length: 20 })
  toPhone: string;

  @Column({ length: 16 })
  channel: string;

  @Column({ type: "text" })
  body: string;

  @Column({ length: 8 })
  language: string;

  @Column({ length: 16, default: "queued" })
  status: NotificationStatus;

  @Column({ type: "varchar", length: 255, nullable: true })
  failureReason: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  providerReference: string | null;

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, string>;

  @Column({ type: "timestamptz", nullable: true })
  sentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
