import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export const JOB_REVIEW_STATUSES = [
  'PENDING_REVIEW',
  'REVIEWED_OK',
  'RECHECK_REQUIRED',
  'DEACTIVATION_REQUIRED',
  'RESOLVED',
] as const;

export type JobReviewStatus = (typeof JOB_REVIEW_STATUSES)[number];

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @Column({ type: 'varchar', nullable: true })
  companyId: string | null;

  @Column()
  title: string;

  @Column({ type: 'varchar', nullable: true, unique: true })
  slug: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  requirements: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  skills: string[];

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

  @Column({ type: 'varchar', nullable: true })
  estimatedSalary: string | null;

  @Column({ type: 'varchar', nullable: true })
  estimatedSalarySource: string | null;

  @Column({ type: 'text', nullable: true })
  estimatedSalarySourceUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  estimatedSalaryRegion: string | null;

  @Column({ type: 'timestamp', nullable: true })
  estimatedSalaryUpdatedAt: Date | null;

  @Column({ nullable: true })
  companyName: string;

  @Column({ type: 'varchar', length: 16, default: 'GENERAL' })
  pcdMode: string;

  @Column({ default: false })
  isExternalListing: boolean;

  @Column({ type: 'varchar', nullable: true })
  sourceName: string | null;

  @Column({ type: 'text', nullable: true })
  sourceUrl: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  externalFingerprint: string | null;

  @Column({ type: 'varchar', nullable: true })
  sourceExternalId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sourcePublishedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastVerifiedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSeenAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  ingestionSourceId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  ingestionSourceName: string | null;

  @Column({ type: 'varchar', length: 24, default: 'APPROVED' })
  moderationStatus: string;

  @Column({ type: 'varchar', length: 32, default: 'PENDING_REVIEW' })
  reviewStatus: JobReviewStatus;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  reviewedBy: string | null;

  @Column({ type: 'text', nullable: true })
  reviewNote: string | null;

  @Column({ default: 0 })
  reportCount: number;

  @Column({ default: false })
  isConfidential: boolean;

  @Column({ default: false })
  isInternal: boolean;

  @Column({ default: false })
  isTalentPool: boolean;

  @Column({ default: false })
  isSponsored: boolean;

  @Column({ default: true })
  acceptsPlatformApplications: boolean;

  @Column({ default: false })
  requiresResumeFile: boolean;

  @Column({ type: 'text', nullable: true })
  externalApplicationInstructions: string | null;

  @Column({ type: 'varchar', length: 254, nullable: true })
  applicationEmail: string | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  applicationWhatsApp: string | null;

  @Column({ type: 'text', nullable: true })
  applicationUrl: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  applicationUrlTitle: string | null;

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

  @Column({ default: false })
  isFlagged: boolean;

  @Column({ type: 'text', nullable: true })
  flagObservation: string | null;

  @Column({ type: 'varchar', nullable: true })
  flagReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  flaggedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  flaggedBy: string | null;
}
