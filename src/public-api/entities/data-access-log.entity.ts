import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/** "Who read my data": one row per farmer-scoped resource touched by a client. */
@Entity("data_access_logs")
@Index(["farmerId", "createdAt"])
export class DataAccessLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ default: true })
  livemode: boolean;

  @Column({ type: "uuid" })
  farmerId: string;

  /** Organisation whose key performed the access. */
  @Column({ type: "uuid" })
  organisationId: string;

  @Column({ type: "uuid", nullable: true })
  apiKeyId: string | null;

  @Column({ length: 8 })
  action: "read" | "write";

  @Column({ length: 32 })
  resourceType: string;

  @Column({ type: "uuid", nullable: true })
  resourceId: string | null;

  /** delegate = farmer's own organisation; consent = third party with a grant. */
  @Column({ length: 16 })
  basis: "delegate" | "consent";

  @Column({ type: "uuid", nullable: true })
  consentId: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  requestId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
