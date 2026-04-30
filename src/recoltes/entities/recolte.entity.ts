import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

@Entity('recoltes')
@Index(['parcelleId', 'dateRecolte'])
@Index(['organisationId', 'dateRecolte'])
export class Recolte {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  parcelleId: string;

  @Column()
  technicienId: string;

  @Column({ nullable: true })
  organisationId: string;

  @Column()
  dateRecolte: Date;

  @Column({ type: 'float' })
  quantiteRecoltee: number;

  @Column({ type: 'float' })
  superficie: number;

  @Column({ type: 'float', default: 0 })
  pertesPostRecolte: number;

  @Column({ type: 'float', nullable: true })
  prixVente: number;

  @Column({ type: 'float', nullable: true })
  rendement: number;

  @Column({ type: 'float', nullable: true })
  tauxPerte: number;

  @Column({ type: 'float', nullable: true })
  revenuTotal: number;

  @Column({ nullable: true })
  qualite: string;

  @Column({
    type: 'enum',
    enum: ['en_attente', 'validee', 'rejetee'],
    default: 'en_attente',
  })
  statut: string;

  @Column({ nullable: true, type: 'text' })
  observations: string;

  @Column({ nullable: true })
  attestationUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  computeMetrics() {
    if (this.quantiteRecoltee && this.superficie) {
      this.rendement = Math.round((this.quantiteRecoltee / 1000 / this.superficie) * 100) / 100;
    }
    if (this.quantiteRecoltee > 0 && this.pertesPostRecolte != null) {
      this.tauxPerte = Math.round((this.pertesPostRecolte / this.quantiteRecoltee) * 1000) / 10;
    }
    if (this.prixVente && this.quantiteRecoltee != null && this.pertesPostRecolte != null) {
      this.revenuTotal = (this.quantiteRecoltee - this.pertesPostRecolte) * this.prixVente;
    }
  }
}
