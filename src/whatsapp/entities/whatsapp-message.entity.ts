import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export type WhatsAppDirection = "outbound" | "inbound";
export type WhatsAppStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "received";

@Entity("whatsapp_messages")
@Index(["userId", "createdAt"])
@Index(["waMessageId"])
export class WhatsAppMessage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: true })
  userId: string;

  @Column()
  toPhoneE164: string;

  @Column({
    type: "enum",
    enum: ["outbound", "inbound"],
    default: "outbound",
  })
  direction: WhatsAppDirection;

  @Column({
    type: "enum",
    enum: ["queued", "sent", "delivered", "read", "failed", "received"],
    default: "queued",
  })
  status: WhatsAppStatus;

  @Column({ nullable: true })
  templateName: string;

  @Column({ default: "fr" })
  language: string;

  @Column({ type: "text", nullable: true })
  bodyText: string;

  @Column({ type: "jsonb", nullable: true })
  variables: object;

  @Column({ nullable: true })
  waMessageId: string;

  @Column({ nullable: true })
  notificationId: string;

  @Column({ type: "text", nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
