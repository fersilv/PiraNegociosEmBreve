import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type ClassifiedPublicationChannel = 'CLASSIFIEDS' | 'COMPANY_PAGE';

@Entity('company_classified_profiles')
export class CompanyClassifiedProfile {
  @PrimaryColumn({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  termsVersion: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  termsAcceptedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  termsAcceptedByUserId: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  businessSegments: string[];

  @Column({ default: true })
  canSellProducts: boolean;

  @Column({ default: false })
  canOfferServices: boolean;

  @Column({ type: 'jsonb', default: () => "'[\"CLASSIFIEDS\",\"COMPANY_PAGE\"]'::jsonb" })
  defaultPublicationChannels: ClassifiedPublicationChannel[];

  @Column({ type: 'varchar', length: 80, nullable: true })
  pageSectionLabel: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
