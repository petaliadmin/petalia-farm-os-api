import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('expert_requests')
@Index(['createdAt'])
export class ExpertRequest {
  @PrimaryColumn()
  id: string;

  @Column()
  parcelId: string;

  @Column({ type: 'jsonb', default: [] })
  photoPaths: string[];

  @Column({ type: 'text' })
  context: string;

  @Column({ nullable: true })
  remoteId: string;

  @Column({
    type: 'enum',
    enum: ['queued', 'sent', 'received', 'answered'],
    default: 'queued',
  })
  status: string;

  @Column({ nullable: true, type: 'text' })
  answer: string;

  @Column({ nullable: true })
  answeredAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
