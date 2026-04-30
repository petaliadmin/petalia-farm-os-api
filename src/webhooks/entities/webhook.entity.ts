import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("webhooks")
@Index(["organisationId"])
export class Webhook {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  nom: string;

  @Column()
  url: string;

  @Column({
    type: "enum",
    enum: [
      "recolte.created",
      "recolte.validated",
      "visite.completed",
      "parcelle.created",
      "ndvi.alerte",
      "campagne.terminee",
    ],
  })
  evenement: string;

  @Column({ default: true })
  actif: boolean;

  @Column()
  organisationId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
