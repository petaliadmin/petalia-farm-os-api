import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Compte développeur créé librement depuis developers.petalia.sn.
 * Distinct des utilisateurs de la plateforme : il ne donne accès qu'à
 * l'espace développeur et aux clés d'API de sa propre organisation,
 * créée à la vérification du numéro de téléphone.
 */
@Entity("developer_accounts")
@Index(["email"], { unique: true })
export class DeveloperAccount {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 254 })
  email: string;

  @Column({ type: "varchar", select: false })
  passwordHash: string;

  @Column({ type: "varchar", length: 120 })
  name: string;

  @Column({ type: "varchar", length: 120, nullable: true })
  company: string | null;

  /** E.164, reçoit le code de vérification */
  @Column({ type: "varchar", length: 20 })
  phone: string;

  /** Organisation propriétaire des clés ; null tant que le compte n'est pas vérifié */
  @Column({ type: "uuid", nullable: true })
  organisationId: string | null;

  @Column({ type: "timestamptz", nullable: true })
  verifiedAt: Date | null;

  @Column({ type: "varchar", nullable: true, select: false })
  otpHash: string | null;

  @Column({ type: "timestamptz", nullable: true })
  otpExpiresAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  otpSentAt: Date | null;

  @Column({ type: "int", default: 0 })
  otpAttempts: number;

  @Column({ type: "int", default: 0 })
  failedLogins: number;

  @Column({ type: "timestamptz", nullable: true })
  lockedUntil: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
