import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum CompanyAccessRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('company_access_requests')
@Index(['companyId', 'userId'], { unique: true })
export class CompanyAccessRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  companyId: string;

  @Column()
  userId: string;

  @Column()
  requesterName: string;

  @Column()
  requesterEmail: string;

  @Column({ type: 'enum', enum: CompanyAccessRequestStatus, default: CompanyAccessRequestStatus.PENDING })
  status: CompanyAccessRequestStatus;

  @Column({ nullable: true })
  reviewedById: string | null;

  @Column({ type: 'text', nullable: true })
  reviewNote: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
