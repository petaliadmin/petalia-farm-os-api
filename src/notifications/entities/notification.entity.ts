import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("notifications")
@Index(["userId", "lue", "createdAt"])
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column({
    type: "enum",
    enum: ["alerte", "avertissement", "succes", "info"],
  })
  type: string;

  @Column()
  titre: string;

  @Column({ type: "text" })
  message: string;

  @Column({ default: false })
  lue: boolean;

  @Column({ nullable: true })
  lienId: string;

  @Column({ nullable: true })
  lienType: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  get date(): Date {
    return this.createdAt;
  }
}
