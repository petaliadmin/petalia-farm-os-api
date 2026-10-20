import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type ApiJobStatus = "queued" | "running" | "succeeded" | "failed";

/** Long-running work started with 202 Accepted and polled via GET /v1/jobs/{id}. */
@Entity("api_jobs")
@Index(["organisationId", "livemode", "createdAt"])
@Index(["queueJobId"])
export class ApiJob {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ default: true })
  livemode: boolean;

  @Column({ type: "uuid" })
  organisationId: string;

  @Column({ length: 32 })
  type: "ndvi_analysis";

  @Column({ length: 16, default: "queued" })
  status: ApiJobStatus;

  @Column({ type: "uuid", nullable: true })
  parcelleId: string | null;

  /** Bull job id in the queue doing the work. */
  @Column({ type: "varchar", length: 128, nullable: true })
  queueJobId: string | null;

  @Column({ type: "jsonb", nullable: true })
  result: Record<string, unknown> | null;

  @Column({ type: "jsonb", nullable: true })
  error: { code: string; message: string } | null;

  @Column({ type: "timestamptz", nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
