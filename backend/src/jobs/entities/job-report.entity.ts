import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('job_reports')
@Index(['jobId', 'reporterKey'], { unique: true })
export class JobReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  jobId: string;

  // Hash com sal: impede denúncias repetidas sem guardar o IP em texto puro.
  @Column()
  reporterKey: string;

  @Column({ type: 'varchar', length: 40 })
  reason: string;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
