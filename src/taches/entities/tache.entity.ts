import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('taches')
@Index(['parcelleId', 'statut'])
@Index(['assigneAId', 'statut'])
@Index(['organisationId', 'priorite', 'statut'])
export class Tache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  titre: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column()
  parcelleId: string;

  @Column()
  assigneAId: string;

  @Column()
  creeParId: string;

  @Column({ nullable: true })
  campagneId: string;

  @Column({ nullable: true })
  organisationId: string;

  @Column({
    type: 'enum',
    enum: ['todo', 'en_cours', 'done', 'reporte'],
    default: 'todo',
  })
  statut: string;

  @Column({
    type: 'enum',
    enum: ['basse', 'normale', 'haute', 'urgente'],
    default: 'normale',
  })
  priorite: string;

  @Column({ nullable: true })
  datePlanifiee: Date;

  @Column({ nullable: true })
  dateFin: Date;

  @Column({ nullable: true })
  dateTerminee: Date;

  @Column({ default: false })
  automatique: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
