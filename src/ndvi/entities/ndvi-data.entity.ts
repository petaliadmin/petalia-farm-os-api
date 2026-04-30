import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("ndvi_data")
@Index(["parcelleId", "date"])
export class NdviData {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  parcelleId: string;

  @Column()
  date: Date;

  @Column({ type: "float" })
  ndviMoyen: number;

  @Column({ type: "float", nullable: true })
  ndviMin: number;

  @Column({ type: "float", nullable: true })
  ndviMax: number;

  @Column({ type: "int", default: 10 })
  resolution: number;

  @Column({ default: "sentinel-2" })
  source: string;

  @Column({ type: "jsonb", default: [] })
  zones: { lat: number; lng: number; valeur: number }[];

  @Column({ nullable: true })
  tileUrl: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ type: "float", nullable: true })
  cloudCoverage: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
