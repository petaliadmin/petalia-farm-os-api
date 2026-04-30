import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("field_pois")
@Index(["parcelleId"])
export class FieldPoi {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  parcelleId: string;

  @Column()
  nom: string;

  @Column({
    type: "enum",
    enum: ["puits", "forage", "bassin", "canal", "depot", "bati", "autre"],
    nullable: true,
  })
  type: string;

  @Column({ type: "jsonb", nullable: true })
  location: object;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
