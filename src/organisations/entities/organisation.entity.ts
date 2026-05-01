import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("organisations")
@Index(["pays", "type"])
export class Organisation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  nom: string;

  @Column({ nullable: true })
  sigle: string;

  @Column({
    type: "enum",
    enum: ["cooperative", "GIE", "ONG", "institution", "agro_dealer", "autre"],
    default: "cooperative",
  })
  type: string;

  @Column({ default: "SN" })
  pays: string;

  @Column({ nullable: true })
  region: string;

  @Column({ nullable: true })
  adresse: string;

  @Column({ nullable: true })
  telephone: string;

  @Column({ nullable: true, unique: true })
  email: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ nullable: true })
  siteWeb: string;

  @Column({
    type: "enum",
    enum: ["free", "basic", "pro", "enterprise"],
    default: "free",
  })
  subscriptionPlan: string;

  @Column({ nullable: true })
  subscriptionExpiry: Date;

  @Column({ type: "jsonb", default: {} })
  apiCredentials: Record<string, string>;

  @Column({ default: true })
  actif: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
