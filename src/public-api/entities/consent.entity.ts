import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type ConsentStatus =
  | "pending"
  | "active"
  | "revoked"
  | "expired"
  | "rejected";

/**
 * Open-banking style grant: the farmer allows one organisation (the grantee)
 * to use a set of scopes on their data, for a stated purpose, until revoked.
 * Confirmed by an SMS code sent to the farmer's phone.
 */
@Entity("consents")
@Index(["farmerId", "granteeOrganisationId", "status"])
@Index(["granteeOrganisationId", "livemode", "createdAt"])
export class Consent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ default: true })
  livemode: boolean;

  @Column({ type: "uuid" })
  farmerId: string;

  @Column({ type: "uuid" })
  granteeOrganisationId: string;

  @Column({ type: "uuid", nullable: true })
  requestedByApiKeyId: string | null;

  @Column({ type: "jsonb", default: [] })
  scopes: string[];

  /** Shown to the farmer in the SMS: why the grantee wants the data. */
  @Column({ type: "text" })
  purpose: string;

  @Column({ length: 16, default: "pending" })
  status: ConsentStatus;

  @Column({ length: 16, default: "sms_otp" })
  method: "sms_otp";

  @Column({ type: "varchar", nullable: true, select: false })
  otpHash: string | null;

  @Column({ type: "timestamptz", nullable: true })
  otpExpiresAt: Date | null;

  @Column({ type: "int", default: 0 })
  otpAttempts: number;

  @Column({ type: "timestamptz", nullable: true })
  grantedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  revokedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
