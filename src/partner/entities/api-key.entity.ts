import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

import {
  PUBLIC_SCOPES,
  PublicScope,
} from "../../public-api/public-api.constants";

/** Legacy /partner scopes. */
export type LegacyApiKeyScope =
  | "parcelles:read"
  | "ndvi:read"
  | "satellite:read"
  | "market:read"
  | "rapports:read";

export type ApiKeyScope = LegacyApiKeyScope | PublicScope;

export const LEGACY_SCOPES: LegacyApiKeyScope[] = [
  "parcelles:read",
  "ndvi:read",
  "satellite:read",
  "market:read",
  "rapports:read",
];

export const ALL_SCOPES: ApiKeyScope[] = [...LEGACY_SCOPES, ...PUBLIC_SCOPES];

export type ApiKeyMode = "live" | "test";
export type ApiKeyKind = "secret" | "publishable";

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
   * Leading chars of the raw key: 16 for "sk_live_AbCd1234", 11 for legacy
   * "pk_AbCd1234". Indexed lookup by prefix narrows the bcrypt verify to
   * typically 1-2 candidates.
   */
  @Column({ length: 16 })
  prefix: string;

  @Column({ select: false })
  keyHash: string;

  @Column({ type: "jsonb", default: [] })
  scopes: ApiKeyScope[];

  /** test keys only reach sandbox data (livemode = false). */
  @Column({ type: "varchar", length: 8, default: "live" })
  mode: ApiKeyMode;

  /** publishable (pk_) keys only reach open data; legacy pk_ keys are secret. */
  @Column({ type: "varchar", length: 16, default: "secret" })
  kind: ApiKeyKind;

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
