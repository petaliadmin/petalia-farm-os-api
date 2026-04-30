import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("agro_rules")
@Index(["updatedAt"])
@Index(["crop", "symptom", "actif"])
export class AgroRule {
  @PrimaryColumn()
  id: string;

  @Column({
    type: "enum",
    enum: ["riz", "mais", "mil", "arachide", "oignon", "tomate", "*"],
  })
  crop: string;

  @Column({ type: "jsonb" })
  stages: string[];

  @Column()
  symptom: string;

  @Column({
    type: "enum",
    enum: ["hivernage", "contre_saison", "*"],
  })
  season: string;

  @Column({ type: "jsonb" })
  regions: string[];

  @Column({ type: "float", default: 0 })
  severityMin: number;

  @Column({ type: "text" })
  diagnosis: string;

  @Column({ type: "jsonb" })
  recommendation: {
    title: string;
    actions: string[];
    costFcfaPerHa: number;
    delayBeforeHarvestDays: number;
    ppeRequired: boolean;
    followupDays: number;
  };

  @Column({ nullable: true })
  validatedBy: string;

  @Column({ default: true })
  actif: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
