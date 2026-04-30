import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("intrants")
@Index(["organisationId", "type"])
@Index(["organisationId", "quantiteStock"])
export class Intrant {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  nom: string;

  @Column({
    type: "enum",
    enum: ["Engrais", "Pesticide", "Semence", "Autre"],
  })
  type: string;

  @Column({ nullable: true })
  marque: string;

  @Column({ nullable: true, type: "text" })
  description: string;

  @Column()
  unite: string;

  @Column({ type: "float", default: 0 })
  quantiteStock: number;

  @Column({ type: "float", nullable: true })
  seuilAlerte: number;

  @Column({ type: "float", nullable: true })
  prixUnitaire: number;

  @Column({ nullable: true })
  dateExpiration: Date;

  @Column()
  organisationId: string;

  @Column({ default: false })
  deleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
