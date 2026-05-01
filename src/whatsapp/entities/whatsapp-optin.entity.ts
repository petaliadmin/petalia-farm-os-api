import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from "typeorm";

@Entity("whatsapp_optins")
@Unique("uq_optin_user", ["userId"])
@Index(["phoneE164"])
export class WhatsAppOptin {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column()
  phoneE164: string;

  @Column({ default: true })
  optedIn: boolean;

  @Column({
    type: "jsonb",
    default: ["alerte", "avertissement"],
  })
  topics: string[];

  @Column({ default: "fr" })
  language: string;

  @Column({ nullable: true })
  optedInAt: Date;

  @Column({ nullable: true })
  optedOutAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
