import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CompanyStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum CompanyCategory {
  EMPLOYER = 'EMPLOYER',
  SERVICE_PROVIDER = 'SERVICE_PROVIDER',
  RETAILER = 'RETAILER',
  OTHER = 'OTHER',
}

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  // Nome comercial exibido no PiraNegócios. Pode divergir da razão social.
  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true, unique: true })
  slug: string | null;

  @Column({ default: false })
  slugIsCustom: boolean;

  @Column({ type: 'varchar', nullable: true })
  pendingSlug: string | null;

  @Column({ type: 'varchar', length: 16, default: 'NONE' })
  slugChangeStatus: string;

  @Column({ type: 'timestamptz', nullable: true })
  slugChangeRequestedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  slugChangeRequestedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  slugChangeReviewedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  slugChangeReviewedById: string | null;

  @Column({ type: 'text', nullable: true })
  slugChangeReviewNote: string | null;

  @Column({ type: 'enum', enum: CompanyCategory, default: CompanyCategory.EMPLOYER })
  category: CompanyCategory;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 'CNPJ' })
  documentType: string;

  @Column({ nullable: true })
  cnpj: string;

  @Column({ nullable: true })
  cpf: string;

  @Column({ default: false })
  hasCnpj: boolean;

  @Column({ type: 'varchar', length: 240, nullable: true })
  legalName: string | null;

  @Column({ type: 'varchar', length: 240, nullable: true })
  registryTradeName: string | null;

  @Column({ type: 'text', nullable: true })
  legalAddress: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  legalCity: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  legalState: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  legalZipCode: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  cnpjSituation: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  cnpjDataSource: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  cnpjDataCheckedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cnpjDataUpdatedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  cnpjSnapshot: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  cnpjChangeAlert: Record<string, unknown> | null;

  @Column({ default: true })
  commercialAddressSameAsLegal: boolean;

  @Column({ nullable: true })
  website: string;

  // Endereço comercial. Quando commercialAddressSameAsLegal=true, é sincronizado da consulta do CNPJ.
  @Column({ nullable: true })
  address: string;

  @Column({ type: 'varchar', nullable: true })
  cityState: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  state: string | null;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'enum', enum: CompanyStatus, default: CompanyStatus.DRAFT })
  verificationStatus: CompanyStatus;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ type: 'varchar', length: 24, default: 'NOT_STARTED' })
  complianceStatus: string;

  @Column({ type: 'timestamptz', nullable: true })
  complianceGraceDeadline: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  complianceSuspendedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  complianceSuspensionReason: string | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ nullable: true })
  socialInstagram: string;

  @Column({ nullable: true })
  socialLinkedin: string;

  @Column({ nullable: true })
  socialFacebook: string;

  @Column({ nullable: true })
  logoURL: string;

  @Column({ nullable: true })
  documentURL: string;

  @Column({ type: 'jsonb', nullable: true })
  hiringConfig: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
