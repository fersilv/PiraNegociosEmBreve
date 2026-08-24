import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('company_pages')
export class CompanyPage {
  @PrimaryColumn('uuid')
  companyId: string;

  @Column({ type: 'varchar', length: 80, default: 'essencial' })
  templateKey: string;

  @Column({ type: 'jsonb' })
  draft: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  published: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: 'DRAFT' | 'PUBLISHED';

  @Column({ type: 'integer', default: 1 })
  revision: number;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
