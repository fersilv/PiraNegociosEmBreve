import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string; // References User.id

  @Column({ type: 'varchar', nullable: true })
  companyId: string | null; // Null somente em vagas externas criadas pela administração

  @Column()
  title: string;

  // Stable canonical URL: https://piranegocios.com.br/vagas/{slug}
  @Column({ type: 'varchar', nullable: true, unique: true })
  slug: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  requirements: string | null;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  state: string | null;

  @Column({ nullable: true })
  type: string;

  @Column({ nullable: true })
  workModel: string;

  @Column({ type: 'varchar', nullable: true })
  salary: string | null;

  @Column({ nullable: true })
  companyName: string;

  @Column({ default: false })
  isExternalListing: boolean;

  @Column({ type: 'varchar', nullable: true })
  sourceName: string | null;

  @Column({ type: 'text', nullable: true })
  sourceUrl: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  externalFingerprint: string | null;

  @Column({ type: 'varchar', nullable: true })
  ingestionSourceId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  ingestionSourceName: string | null;

  @Column({ type: 'varchar', length: 24, default: 'APPROVED' })
  moderationStatus: string;

  @Column({ default: 0 })
  reportCount: number;

  @Column({ default: false })
  isConfidential: boolean;

  @Column({ default: false })
  isTalentPool: boolean;

  @Column({ default: false })
  isSponsored: boolean;

  @Column({ default: true })
  acceptsPlatformApplications: boolean;

  @Column({ type: 'text', nullable: true })
  externalApplicationInstructions: string | null;

  @Column({ type: 'varchar', length: 254, nullable: true })
  applicationEmail: string | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  applicationWhatsApp: string | null;

  @Column({ type: 'date', nullable: true })
  deadlineDate: string | null;

  @Column({ default: true })
  active: boolean;

  @Column({ default: 0 })
  views: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
