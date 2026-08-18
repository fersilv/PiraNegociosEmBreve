import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('company_slug_aliases')
export class CompanySlugAlias {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  companyId: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'varchar' })
  replacedBySlug: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ default: true })
  rollbackAvailable: boolean;

  @Column({ default: false })
  rollbackUsed: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  rolledBackAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  createdById: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
