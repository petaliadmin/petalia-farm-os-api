import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export type ApiKeyScope =
  | "parcelles:read"
  | "ndvi:read"
  | "satellite:read"
  | "market:read"
  | "rapports:read";

export const ALL_SCOPES: ApiKeyScope[] = [
  "parcelles:read",
  "ndvi:read",
  "satellite:read",
  "market:read",
  "rapports:read",
];

@Entity("api_keys")
@Index(["organisationId", "active"])
@Index(["prefix"])
export class ApiKey {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  organisationId: string;

  @Column()
  partenaireNom: string;

  /**
   * First 8 chars of the raw key (e.g. "pk_AbCd"). Indexed lookup by prefix
   * narrows the bcrypt verify to typically 1-2 candidates.
   */
  @Column({ length: 16 })
  prefix: string;

  @Column({ select: false })
  keyHash: string;

  @Column({ type: "jsonb", default: [] })
  scopes: ApiKeyScope[];

  @Column({ type: "int", default: 1000 })
  quotaPerHour: number;

  @Column({ type: "int", default: 50000 })
  quotaPerMonth: number;

  @Column({ default: true })
  active: boolean;

  @Column({ nullable: true })
  expiresAt: Date;

  @Column({ nullable: true })
  lastUsedAt: Date;

  @Column({ nullable: true })
  revokedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
