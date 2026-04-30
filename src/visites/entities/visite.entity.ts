import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("visites")
@Index(["parcelleId", "date"])
@Index(["technicienId", "statut"])
@Index(["organisationId", "date"])
export class Visite {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  parcelleId: string;

  @Column()
  technicienId: string;

  @Column()
  date: Date;

  @Column({
    type: "enum",
    enum: ["planifiee", "en_cours", "completee", "annulee"],
    default: "planifiee",
  })
  statut: string;

  @Column({ nullable: true })
  organisationId: string;

  @Column({ nullable: true })
  campagneId: string;

  @Column({ nullable: true })
  dureeMinutes: number;

  @Column({ nullable: true })
  objectif: string;

  @Column({ nullable: true, type: "text" })
  observations: string;

  @Column({
    type: "enum",
    enum: ["normale", "stress", "maladie", "ravageur", "carence", "autre"],
    nullable: true,
  })
  etatGeneral: string;

  @Column({ type: "jsonb", default: [] })
  observationsDetaillees: string[];

  @Column({ nullable: true, type: "text" })
  recommandations: string;

  @Column({ nullable: true })
  prochainAction: string;

  @Column({ type: "jsonb", nullable: true })
  gpsLocation: object;

  @Column({ type: "jsonb", default: [] })
  photos: string[];

  @Column({ nullable: true })
  rapport: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
