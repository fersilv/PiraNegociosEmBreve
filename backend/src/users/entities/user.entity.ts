import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserType {
  ADMIN = 'ADMIN',
  CANDIDATE = 'CANDIDATE',
  COMPANY = 'COMPANY',
}

@Entity('users')
export class User {
  @PrimaryColumn()
  id: string;

  @Column({ type: 'enum', enum: UserType, nullable: true })
  type: UserType;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  displayName: string;

  @Column({ nullable: true })
  photoURL: string;

  @Column({ type: 'varchar', nullable: true })
  companyId: string | null;

  @Column({ default: false })
  isCompanyAdmin: boolean;

  @Column({ nullable: true })
  status: string;

  @Column({ nullable: true })
  fullName: string;

  @Column({ type: 'date', nullable: true })
  birthDate: Date | null;

  @Column({ nullable: true })
  socialName: string;

  @Column({ nullable: true })
  treatment: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: true })
  isOpenToWork: boolean;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ nullable: true })
  resumeURL: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: false })
  acceptedTerms: boolean;

  @Column({ nullable: true })
  linkedinURL: string;

  @Column({ nullable: true })
  companyName: string;

  @Column({ type: 'text', nullable: true })
  companyDescription: string;

  @Column({ nullable: true })
  companyLogo: string;

  @Column({ type: 'jsonb', nullable: true })
  additionalPhones: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  experiences: unknown[] | null;

  @Column({ type: 'jsonb', nullable: true })
  skills: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  courses: unknown[] | null;

  @Column({ type: 'jsonb', nullable: true })
  education: unknown[] | null;

  @Column({ type: 'jsonb', nullable: true })
  aiAnalysis: Record<string, unknown> | null;

  @Column({ default: false })
  hasAiAnalyzed: boolean;

  @Column({ default: false })
  resumeScoreUnlocked: boolean;

  @Column({ type: 'int', default: 0 })
  aiAnalysisCount: number;

  @Column({ type: 'int', nullable: true })
  aiAnalysisLimit: number | null;

  @Column({ type: 'jsonb', nullable: true })
  savedDocs: Record<string, string> | null;

  @Column({ type: 'jsonb', nullable: true })
  languages: { name: string; level: string }[] | null;

  @Column({ type: 'varchar', nullable: true })
  salaryExpectation: string | null;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  state: string | null;

  @Column({ type: 'jsonb', nullable: true })
  jobPreferences: {
    preferredLocations?: { city: string; state: string }[];
    hasDriverLicense?: boolean | null;
    driverLicenseCategories?: string[];
    hasOwnVehicle?: boolean | null;
    ownVehicles?: string[];
    includeExclusivePcdJobs?: boolean;
    pcdDeclaration?: 'NOT_INFORMED' | 'YES' | 'NO';
    pcdDocumentationStatus?:
      | 'NOT_INFORMED'
      | 'HAS_REPORT'
      | 'NO_REPORT'
      | 'IN_PROGRESS';
    pcdDataConsent?: boolean;
  } | null;

  @Column({ type: 'text', nullable: true })
  resumePhotoURL: string | null;

  @Column({ type: 'jsonb', nullable: true })
  resumePreferences: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  fcmToken: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
