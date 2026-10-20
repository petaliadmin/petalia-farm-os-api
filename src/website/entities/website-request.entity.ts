import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export const WEBSITE_REQUEST_TYPES = ["contact", "demo", "order"] as const;
export type WebsiteRequestType = (typeof WEBSITE_REQUEST_TYPES)[number];

export const WEBSITE_REQUEST_STATUSES = [
  "new",
  "in_progress",
  "done",
  "spam",
] as const;
export type WebsiteRequestStatus = (typeof WEBSITE_REQUEST_STATUSES)[number];

/** Ligne d'une demande de commande, telle qu'envoyée par la boutique du site. */
export interface WebsiteOrderLine {
  productId: string;
  name: string;
  quantity: number;
  /** Prix unitaire affiché sur le site (FCFA) — indicatif, à confirmer par l'équipe */
  unitPriceFcfa: number;
}

/**
 * Demandes reçues du site vitrine petalia.sn : contact, démo, commande boutique.
 * Une seule table, typée par `type` ; les champs propres à chaque formulaire
 * vont dans `details` (démo) ou `lines` (commande).
 */
@Entity("website_requests")
@Index(["type", "status", "createdAt"])
@Check(`"type" IN ('contact', 'demo', 'order')`)
@Check(`"status" IN ('new', 'in_progress', 'done', 'spam')`)
export class WebsiteRequest {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 16 })
  type: WebsiteRequestType;

  @Column({ type: "varchar", length: 16, default: "new" })
  status: WebsiteRequestStatus;

  @Column({ type: "varchar", length: 120 })
  name: string;

  @Column({ type: "varchar", length: 20 })
  phone: string;

  @Column({ type: "varchar", length: 254, nullable: true })
  email: string | null;

  @Column({ type: "text", nullable: true })
  message: string | null;

  /** Champs propres au formulaire (taille d'exploitation, culture, disponibilités…) */
  @Column({ type: "jsonb", default: {} })
  details: Record<string, string>;

  @Column({ type: "jsonb", nullable: true })
  lines: WebsiteOrderLine[] | null;

  /** Total indicatif d'une commande, recalculé côté serveur à partir des lignes */
  @Column({ type: "integer", nullable: true })
  totalFcfa: number | null;

  /** Note interne de l'équipe commerciale */
  @Column({ type: "text", nullable: true })
  notes: string | null;

  /** Page d'origine (ex. /boutique) pour le suivi commercial */
  @Column({ type: "varchar", length: 255, nullable: true })
  sourcePage: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
