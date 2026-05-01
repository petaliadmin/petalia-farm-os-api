import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export type PlanCode = "free" | "pro" | "enterprise";

@Entity("plans")
@Index(["code"], { unique: true })
export class Plan {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "enum", enum: ["free", "pro", "enterprise"] })
  code: PlanCode;

  @Column()
  nom: string;

  @Column({ type: "int", default: 0 })
  prixMensuelFcfa: number;

  @Column({ type: "int", default: 0 })
  prixAnnuelFcfa: number;

  /**
   * Soft limits enforced by PlanLimitGuard. Null = illimité.
   */
  @Column({ type: "int", nullable: true })
  maxParcelles: number;

  @Column({ type: "int", nullable: true })
  maxUtilisateurs: number;

  @Column({ type: "int", nullable: true })
  maxDiagnosticsParMois: number;

  @Column({ type: "int", nullable: true })
  maxAppelsApiParMois: number;

  @Column({ default: false })
  ndviInclus: boolean;

  @Column({ default: false })
  whatsappInclus: boolean;

  @Column({ default: false })
  exportSigInclus: boolean;

  @Column({ default: false })
  diagnosticIaInclus: boolean;

  @Column({ default: true })
  actif: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
