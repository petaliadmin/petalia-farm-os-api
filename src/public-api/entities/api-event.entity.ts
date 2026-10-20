import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/** Immutable record of something that happened; delivered through webhooks. */
@Entity("api_events")
@Index(["organisationId", "livemode", "createdAt"])
export class ApiEvent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ default: true })
  livemode: boolean;

  @Column({ type: "uuid" })
  organisationId: string;

  @Column({ length: 48 })
  type: string;

  /** Public representation of the object at the time of the event. */
  @Column({ type: "jsonb" })
  data: Record<string, unknown>;

  @Column({ length: 10 })
  apiVersion: string;

  @CreateDateColumn()
  createdAt: Date;
}
