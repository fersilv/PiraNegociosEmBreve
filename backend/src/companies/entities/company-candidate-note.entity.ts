import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
@Entity('company_candidate_notes')
export class CompanyCandidateNote {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() recordId: string;
  @Column() authorId: string;
  @Column({ type: 'text' }) body: string;
  @Column({ default: 'NOTE' }) type: string;
  @CreateDateColumn() createdAt: Date;
}
