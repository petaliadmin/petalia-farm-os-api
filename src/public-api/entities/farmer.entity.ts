import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * A farmer is identified by phone number (E.164), not email. The delegate
 * organisation (usually their cooperative) acts on their behalf; any other
 * organisation needs the farmer's consent to read their data.
 */
@Entity("farmers")
@Index(["phone", "livemode"], { unique: true })
@Index(["organisationId", "livemode", "createdAt"])
export class Farmer {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ default: true })
  livemode: boolean;

  /** Delegate organisation (cooperative, GIE…). */
  @Column({ type: "uuid", nullable: true })
  organisationId: string | null;

  @Column({ length: 20 })
  phone: string;

  @Column({ length: 80 })
  firstName: string;

  @Column({ length: 80 })
  lastName: string;

  @Column({ type: "varchar", length: 8, nullable: true })
  gender: "female" | "male" | null;

  @Column({ type: "int", nullable: true })
  birthYear: number | null;

  /** BCP 47 primary tag: fr, wo, ff (pulaar), en… */
  @Column({ length: 8, default: "fr" })
  preferredLanguage: string;

  @Column({ length: 16, default: "sms" })
  preferredChannel: string;

  @Column({ type: "varchar", length: 120, nullable: true })
  locality: string | null;

  @Column({ type: "varchar", length: 80, nullable: true })
  region: string | null;

  @Column({ length: 2, default: "SN" })
  country: string;

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, string>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  deletedAt: Date | null;
}
