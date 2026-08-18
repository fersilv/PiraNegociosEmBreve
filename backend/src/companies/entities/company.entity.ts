import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

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
  ownerId: string; // The user who created the company

  @Column()
  name: string;

  // Public, human-readable company address: https://piranegocios.com.br/{slug}
  @Column({ type: 'varchar', nullable: true, unique: true })
  slug: string | null;

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

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  cityState: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'enum', enum: CompanyStatus, default: CompanyStatus.DRAFT })
  verificationStatus: CompanyStatus;

  @Column({ default: false })
  isVerified: boolean;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
