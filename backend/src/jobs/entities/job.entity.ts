import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string; // References User.id

  @Column()
  companyId: string; // References Company.id

  @Column()
  title: string;

  // Stable canonical URL: https://piranegocios.com.br/vagas/{slug}
  @Column({ type: 'varchar', nullable: true, unique: true })
  slug: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  requirements: string | null;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  type: string;

  @Column({ nullable: true })
  workModel: string;

  @Column({ nullable: true })
  salary: string;

  @Column({ nullable: true })
  companyName: string;

  @Column({ default: false })
  isConfidential: boolean;

  @Column({ default: false })
  isTalentPool: boolean;

  @Column({ default: false })
  isSponsored: boolean;

  @Column({ default: true })
  acceptsPlatformApplications: boolean;

  @Column({ type: 'text', nullable: true })
  externalApplicationInstructions: string | null;

  @Column({ type: 'date', nullable: true })
  deadlineDate: string | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
