import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
@Entity('company_talent_records')
@Index(['companyId', 'candidateId'], { unique: true })
export class CompanyTalentRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() companyId: string;
  @Column() candidateId: string;
  @Column({ type: 'jsonb', default: () => "'[]'" }) folderIds: string[];
  @Column({ default: 'SAVED' }) status: string;
  @Column({ type: 'jsonb', default: () => "'[]'" }) jobIds: string[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
