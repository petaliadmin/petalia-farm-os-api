import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("farms")
@Index(["farmerId"])
@Index(["organisationId", "livemode", "createdAt"])
export class Farm {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ default: true })
  livemode: boolean;

  @Column({ type: "uuid", nullable: true })
  organisationId: string | null;

  @Column({ type: "uuid" })
  farmerId: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: "varchar", length: 120, nullable: true })
  locality: string | null;

  @Column({ type: "varchar", length: 80, nullable: true })
  region: string | null;

  /** GeoJSON Point of the homestead / main access. */
  @Column({ type: "jsonb", nullable: true })
  location: { type: "Point"; coordinates: [number, number] } | null;

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, string>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  deletedAt: Date | null;
}
