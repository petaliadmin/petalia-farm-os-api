import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from "typeorm";

export type SatelliteIndexCode = "evi" | "savi" | "ndwi" | "lai" | "ndvi";

@Entity("satellite_indices")
@Index(["parcelleId", "indexCode", "date"])
@Unique("uq_parcelle_index_date", ["parcelleId", "indexCode", "date"])
export class SatelliteIndex {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  parcelleId: string;

  @Column({
    type: "enum",
    enum: ["evi", "savi", "ndwi", "lai", "ndvi"],
  })
  indexCode: SatelliteIndexCode;

  @Column()
  date: Date;

  @Column({ type: "float" })
  meanValue: number;

  @Column({ type: "float", nullable: true })
  minValue: number;

  @Column({ type: "float", nullable: true })
  maxValue: number;

  @Column({ type: "float", nullable: true })
  stddev: number;

  @Column({ type: "int", default: 10 })
  resolutionMeters: number;

  @Column({ default: "sentinel-2-l2a" })
  source: string;

  @CreateDateColumn()
  createdAt: Date;
}
