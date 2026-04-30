import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("users")
@Index(["organisationId", "role"])
@Index(["equipeId"])
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ unique: true, nullable: true })
  phone: string;

  @Column({ select: false })
  passwordHash: string;

  @Column()
  nom: string;

  @Column()
  prenom: string;

  @Column({
    type: "enum",
    enum: ["directeur", "superviseur", "technicien", "admin", "partenaire"],
    default: "technicien",
  })
  role: string;

  @Column({ nullable: true })
  organisationId: string;

  @Column({ nullable: true })
  equipeId: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ default: true })
  actif: boolean;

  @Column({ nullable: true, select: false })
  otpCode: string;

  @Column({ nullable: true })
  otpExpiry: Date;

  @Column({ default: 0, select: false })
  loginAttempts: number;

  @Column({ nullable: true })
  lockedUntil: Date;

  @Column({ nullable: true, select: false })
  refreshTokenHash: string;

  @Column({ unique: true, nullable: true, select: false })
  apiKeyHash: string;

  @Column({ type: "jsonb", default: [] })
  apiScopes: string[];

  @Column({ nullable: true })
  fcmToken: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
