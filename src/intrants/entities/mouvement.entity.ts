import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('mouvements')
@Index(['intrantId', 'date'])
@Index(['parcelleId', 'date'])
export class Mouvement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  intrantId: string;

  @Column({ type: 'enum', enum: ['entree', 'sortie'] })
  type: string;

  @Column({ type: 'float' })
  quantite: number;

  @Column({ nullable: true })
  date: Date;

  @Column({ nullable: true })
  parcelleId: string;

  @Column({ nullable: true })
  motif: string;

  @Column()
  operateurId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
