import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/** Stored outcome of a POST sent with an Idempotency-Key (kept 24 h). */
@Entity("idempotency_keys")
@Index(["apiKeyId", "key"], { unique: true })
@Index(["expiresAt"])
export class IdempotencyRecord {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  apiKeyId: string;

  @Column({ length: 255 })
  key: string;

  /** sha256(method + path + body): the same key must replay the same request. */
  @Column({ length: 64 })
  fingerprint: string;

  @Column({ length: 16 })
  status: "in_progress" | "completed";

  @Column({ type: "int", nullable: true })
  responseStatus: number | null;

  @Column({ type: "jsonb", nullable: true })
  responseBody: unknown;

  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
