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
export class CompanyTalentInvite {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() companyId: string;
  @Column() candidateId: string;
  @Column() jobId: string;
  @Column({ default: 'PENDING' }) status: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
