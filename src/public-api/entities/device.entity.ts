import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type DeviceType = "sensor" | "gateway" | "weather_station" | "drone";

@Entity("devices")
@Index(["devEui", "livemode"], {
  unique: true,
  where: '"devEui" IS NOT NULL',
})
@Index(["organisationId", "livemode", "createdAt"])
@Index(["parcelleId"])
export class Device {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ default: true })
  livemode: boolean;

  @Column({ type: "uuid" })
  organisationId: string;

  @Column({ type: "uuid", nullable: true })
  parcelleId: string | null;

  @Column({ length: 24 })
  type: DeviceType;

  /** dragino, ecowitt, dji, other… */
  @Column({ length: 40 })
  manufacturer: string;

  @Column({ type: "varchar", length: 60, nullable: true })
  model: string | null;

  @Column({ type: "varchar", length: 80, nullable: true })
  serialNumber: string | null;

  /** LoRaWAN DevEUI (16 hex chars), used by ChirpStack/TTN connectors. */
  @Column({ type: "varchar", length: 16, nullable: true })
  devEui: string | null;

  @Column({ length: 120 })
  name: string;

  @Column({ length: 16, default: "active" })
  status: "active" | "inactive";

  @Column({ type: "timestamptz", nullable: true })
  lastSeenAt: Date | null;

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
