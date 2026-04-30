import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('campagnes')
@Index(['organisationId', 'statut'])
export class Campagne {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nom: string;

  @Column({
    type: 'enum',
    enum: ['hivernage', 'contre_saison_froide', 'contre_saison_chaude'],
  })
  type: string;

  @Column()
  dateDebut: Date;

  @Column({ nullable: true })
  dateFin: Date;

  @Column({
    type: 'enum',
    enum: ['en_preparation', 'en_cours', 'terminee'],
    default: 'en_preparation',
  })
  statut: string;

  @Column({ type: 'float', nullable: true })
  progressionPct: number;

  @Column({ type: 'float', nullable: true })
  objectifRendement: number;

  @Column({ nullable: true, type: 'text' })
  observationsCloture: string;

  @Column({ type: 'float', nullable: true })
  rendementFinal: number;

  // Stored as jsonb array of UUID strings
  @Column({ type: 'jsonb', default: [] })
  parcelleIds: string[];

  @Column()
  organisationId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
