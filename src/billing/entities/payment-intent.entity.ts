import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export type PaymentProviderName = "manual" | "wave" | "orange_money" | "stripe";

export type PaymentIntentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "expired";

@Entity("payment_intents")
@Index(["organisationId", "status"])
@Index(["providerRef"])
export class PaymentIntent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  organisationId: string;

  @Column()
  subscriptionId: string;

  @Column({ type: "int" })
  montantFcfa: number;

  @Column({
    type: "enum",
    enum: ["manual", "wave", "orange_money", "stripe"],
    default: "manual",
  })
  provider: PaymentProviderName;

  @Column({
    type: "enum",
    enum: ["pending", "processing", "succeeded", "failed", "expired"],
    default: "pending",
  })
  status: PaymentIntentStatus;

  @Column({ nullable: true })
  providerRef: string;

  @Column({ type: "jsonb", nullable: true })
  providerPayload: object;

  @Column({ nullable: true })
  paidAt: Date;

  @Column({ type: "text", nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
