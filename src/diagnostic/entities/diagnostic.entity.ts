import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

export type DiagnosticSeverity = "faible" | "modere" | "severe" | "critique";

export interface DiagnosticTreatment {
  produit: string;
  matiereActive?: string;
  dose: string;
  modeApplication?: string;
  prescriptionAgreee?: boolean;
}

@Entity("diagnostics")
@Index(["parcelleId", "createdAt"])
@Index(["organisationId", "createdAt"])
export class Diagnostic {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  parcelleId: string;

  @Column({ nullable: true })
  organisationId: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  culture: string;

  @Column({ nullable: true })
  imageHash: string;

  @Column({ nullable: true, type: "int" })
  imageBytes: number;

  @Column({ nullable: true })
  identification: string;

  @Column({ type: "float", default: 0 })
  confidence: number;

  @Column({
    type: "enum",
    enum: ["faible", "modere", "severe", "critique"],
    nullable: true,
  })
  severite: DiagnosticSeverity;

  @Column({ type: "text", nullable: true })
  symptomes: string;

  @Column({ type: "jsonb", default: [] })
  traitements: DiagnosticTreatment[];

  @Column({ type: "text", nullable: true })
  preventionConseils: string;

  @Column({ type: "jsonb", nullable: true })
  rawResponse: object;

  @Column({ default: "claude-sonnet-4-6" })
  model: string;

  @Column({ type: "int", nullable: true })
  inputTokens: number;

  @Column({ type: "int", nullable: true })
  outputTokens: number;

  @CreateDateColumn()
  createdAt: Date;
}
