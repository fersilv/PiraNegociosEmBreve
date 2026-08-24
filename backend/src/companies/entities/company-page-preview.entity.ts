import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('company_page_previews')
export class CompanyPagePreview {
  @PrimaryColumn('uuid')
  token: string;

  @Column('uuid')
  companyId: string;

  @Column({ type: 'jsonb' })
  snapshot: Record<string, unknown>;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
