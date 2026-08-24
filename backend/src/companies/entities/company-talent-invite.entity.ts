import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
@Entity('company_talent_invites')
@Index(['candidateId', 'jobId'], { unique: true })
@Index('IDX_company_talent_invites_email_job', ['candidateEmail', 'jobId'], {
  unique: true,
  where: '"candidateEmail" IS NOT NULL',
})
@Index('IDX_company_talent_invites_token_hash', ['tokenHash'], {
  unique: true,
  where: '"tokenHash" IS NOT NULL',
})
export class CompanyTalentInvite {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() companyId: string;
  @Column({ type: 'varchar', nullable: true }) candidateId: string | null;
  @Column({ type: 'varchar', length: 254, nullable: true })
  candidateEmail: string | null;
  @Column({ type: 'varchar', length: 140, nullable: true })
  candidateName: string | null;
  @Column() jobId: string;
  @Column({ default: 'PENDING' }) status: string;
  @Column({ type: 'varchar', nullable: true }) invitedById: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true })
  tokenHash: string | null;
  @Column({ type: 'timestamptz', nullable: true }) expiresAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) viewedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) registeredAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) acceptedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) declinedAt: Date | null;
  @Column({ type: 'varchar', length: 24, default: 'NOT_REQUESTED' })
  emailStatus: string;
  @Column({ type: 'timestamptz', nullable: true }) emailSentAt: Date | null;
  @Column({ type: 'varchar', nullable: true }) emailMessageId: string | null;
  @Column({ type: 'text', nullable: true }) emailError: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
