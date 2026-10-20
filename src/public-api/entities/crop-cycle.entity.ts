import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type Season = "rainy" | "cold_dry" | "hot_dry";
export type CropCycleStatus = "planned" | "active" | "harvested" | "failed";

/** One crop on one parcel for one campaign (hivernage, contre-saison…). */
@Entity("crop_cycles")
@Index(["parcelleId", "campaignYear"])
@Index(["organisationId", "livemode", "createdAt"])
export class CropCycle {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ default: true })
  livemode: boolean;

  @Column({ type: "uuid", nullable: true })
  organisationId: string | null;

  @Column({ type: "uuid" })
  parcelleId: string;

  @Column({ length: 40 })
  crop: string;

  @Column({ type: "varchar", length: 80, nullable: true })
  variety: string | null;

  @Column({ length: 16 })
  season: Season;

  @Column({ type: "int" })
  campaignYear: number;

  @Column({ length: 16, default: "planned" })
  status: CropCycleStatus;

  @Column({ type: "date", nullable: true })
  sownOn: string | null;

  @Column({ type: "date", nullable: true })
  expectedHarvestOn: string | null;

  @Column({ type: "date", nullable: true })
  harvestedOn: string | null;

  @Column({ type: "float", nullable: true })
  yieldKg: number | null;

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, string>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
