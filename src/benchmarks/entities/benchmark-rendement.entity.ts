import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from "typeorm";

@Entity("benchmarks_rendement")
@Index(["culture", "zoneAgroecologique"])
@Unique("uq_benchmark", [
  "culture",
  "zoneAgroecologique",
  "variete",
  "typeCampagne",
])
export class BenchmarkRendement {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: ["riz", "mais", "mil", "arachide", "oignon", "tomate"],
  })
  culture: string;

  @Column({ nullable: true })
  zoneAgroecologique: string;

  @Column({ nullable: true })
  variete: string;

  @Column({
    type: "enum",
    enum: ["hivernage", "contre_saison_froide", "contre_saison_chaude"],
    nullable: true,
  })
  typeCampagne: string;

  @Column({ type: "float" })
  rendementMoyenTHa: number;

  @Column({ type: "float", nullable: true })
  rendementMinTHa: number;

  @Column({ type: "float", nullable: true })
  rendementMaxTHa: number;

  @Column({ type: "int", nullable: true })
  cycleJours: number;

  @Column({ default: "ISRA" })
  source: string;

  @Column({ nullable: true })
  anneeReference: number;

  @Column({ nullable: true, type: "text" })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
