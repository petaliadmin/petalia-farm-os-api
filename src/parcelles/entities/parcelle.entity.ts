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

@Entity('parcelles')
@Index(['organisationId', 'statut', 'culture'])
@Index(['technicienId', 'statut'])
@Index(['deleted', 'organisationId'])
export class Parcelle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  nom: string;

  @Column()
  producteurNom: string;

  @Column({ nullable: true })
  exploitantNom: string;

  @Column({ nullable: true })
  localite: string;

  @Column({ type: 'jsonb', nullable: true })
  boundary: object;

  @Column({ type: 'jsonb', nullable: true })
  centroid: object;

  @Column({ type: 'float' })
  superficie: number;

  @Column({ nullable: true })
  zone: string;

  @Column({ nullable: true })
  typesSol: string;

  @Column({
    type: 'enum',
    enum: ['riz', 'mais', 'mil', 'arachide', 'oignon', 'tomate', 'autre'],
    nullable: true,
  })
  culture: string;

  @Column({
    type: 'enum',
    enum: ['semis', 'levee', 'vegetative', 'tallage', 'floraison', 'fruiting', 'maturation', 'recolte'],
    nullable: true,
  })
  stade: string;

  @Column({
    type: 'enum',
    enum: ['sain', 'attention', 'urgent', 'recolte'],
    default: 'sain',
  })
  statut: string;

  @Column({
    type: 'enum',
    enum: ['hivernage', 'contre_saison_froide', 'contre_saison_chaude'],
    nullable: true,
  })
  typeCampagne: string;

  @Column({ nullable: true })
  dateSemis: Date;

  @Column({ nullable: true })
  variete: string;

  @Column({ nullable: true })
  densite: string;

  @Column({
    type: 'enum',
    enum: ['riz', 'mais', 'mil', 'arachide', 'oignon', 'tomate'],
    nullable: true,
  })
  culturePrecedente: string;

  @Column({
    type: 'enum',
    enum: ['riz', 'mais', 'mil', 'arachide', 'oignon', 'tomate'],
    nullable: true,
  })
  rotationPrevue: string;

  @Column({ nullable: true })
  typeSol: string;

  @Column({ nullable: true })
  zoneAgroecologique: string;

  @Column({ nullable: true })
  region: string;

  @Column({ nullable: true })
  sourceEau: string;

  @Column({
    type: 'enum',
    enum: ['propriete', 'pret', 'location', 'communautaire'],
    nullable: true,
  })
  modeAccesTerre: string;

  @Column({ nullable: true })
  technicienId: string;

  @Column({ nullable: true })
  organisationId: string;

  @Column({ nullable: true })
  equipeId: string;

  @Column({ type: 'float', default: 0 })
  healthScore: number;

  @Column({ type: 'float', nullable: true })
  rendementPrecedent: number;

  @Column({ nullable: true })
  derniereVisite: Date;

  @Column({ nullable: true })
  prochaineVisite: Date;

  @Column({ default: false })
  deleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  computeCentroid() {
    if (this.boundary) {
      const b = this.boundary as any;
      if (b?.type === 'Polygon' && b.coordinates?.[0]?.length > 0) {
        const ring: [number, number][] = b.coordinates[0];
        const n = ring.length - 1;
        const lng = ring.slice(0, n).reduce((s, c) => s + c[0], 0) / n;
        const lat = ring.slice(0, n).reduce((s, c) => s + c[1], 0) / n;
        this.centroid = { type: 'Point', coordinates: [lng, lat] };
      }
    }
  }
}
