import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export type SubscriptionStatus =
  | "active"
  | "pending_payment"
  | "trial"
  | "past_due"
  | "cancelled"
  | "expired";

@Entity("subscriptions")
@Index(["organisationId", "status"])
@Index(["periodEndsAt"])
export class Subscription {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  organisationId: string;

  @Column()
  planId: string;

  @Column()
  planCode: string;

  @Column({
    type: "enum",
    enum: ["active", "pending_payment", "trial", "past_due", "cancelled", "expired"],
    default: "trial",
  })
  status: SubscriptionStatus;

  @Column({ type: "enum", enum: ["mensuel", "annuel"], default: "mensuel" })
  periodicite: "mensuel" | "annuel";

  @Column()
  periodStartedAt: Date;

  @Column()
  periodEndsAt: Date;

  @Column({ default: false })
  autoRenew: boolean;

  @Column({ nullable: true })
  cancelledAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
