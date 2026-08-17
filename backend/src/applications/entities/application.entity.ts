import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ApplicationStatus {
  PENDING = 'PENDING',
  REVIEWING = 'REVIEWING',
  DOCUMENTS_REQUESTED = 'DOCUMENTS_REQUESTED',
  DOCUMENTS_SUBMITTED = 'DOCUMENTS_SUBMITTED',
  HIRED = 'HIRED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

@Entity('applications')
@Index(['candidateId', 'jobId'], { unique: true })
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  candidateId: string; // References User.id

  @Column()
  jobId: string; // References Job.id

  @Column({ type: 'enum', enum: ApplicationStatus, default: ApplicationStatus.PENDING })
  status: ApplicationStatus;

  @Column({ nullable: true })
  resumeUrl: string | null; // URL of the uploaded resume file

  @Column({ type: 'text', nullable: true })
  coverLetter: string;

  @Column({ nullable: true })
  companyId: string;

  @Column({ nullable: true })
  companyName: string;

  @Column({ nullable: true })
  jobTitle: string;

  @Column({ type: 'jsonb', nullable: true })
  observations: unknown[] | null;

  @Column({ type: 'jsonb', nullable: true })
  onboardingDocs: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  customDocs: unknown[] | null;

  @Column({ default: false })
  documentsRequested: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  documentsRequestedAt: Date | null;

  @Column({ default: false })
  submittedForReview: boolean;

  @Column({ nullable: true })
  priority: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
