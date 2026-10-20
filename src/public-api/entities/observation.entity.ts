import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export type ObservationSource = "sensor" | "satellite" | "manual" | "drone";
export type ObservationQuality = "raw" | "validated" | "suspect" | "rejected";

/**
 * A single measured value, modelled after OGC SensorThings (Datastream and
 * Observation flattened): what (property + unit), where (parcel, location),
 * when (observedAt) and how (source, device, quality).
 */
@Entity("observations")
@Index(["parcelleId", "property", "observedAt"])
@Index(["organisationId", "livemode", "createdAt"])
// Offline clients and LoRa gateways resend: one value per device/property/instant.
@Index(["deviceId", "property", "observedAt"], {
  unique: true,
  where: '"deviceId" IS NOT NULL',
})
export class Observation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ default: true })
  livemode: boolean;

  @Column({ type: "uuid" })
  organisationId: string;

  @Column({ type: "uuid", nullable: true })
  parcelleId: string | null;

  @Column({ type: "uuid", nullable: true })
  deviceId: string | null;

  @Column({ length: 16 })
  sourceType: ObservationSource;

  @Column({ length: 48 })
  property: string;

  @Column({ type: "double precision" })
  value: number;

  @Column({ length: 16 })
  unit: string;

  @Column({ type: "timestamptz" })
  observedAt: Date;

  @Column({ length: 16, default: "raw" })
  quality: ObservationQuality;

  @Column({ type: "jsonb", nullable: true })
  location: { type: "Point"; coordinates: [number, number] } | null;

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, string>;

  @CreateDateColumn()
  createdAt: Date;
}
