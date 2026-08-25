import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ClassifiedListingStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'PAUSED'
  | 'SOLD'
  | 'ARCHIVED'
  | 'PENDING_REVIEW';

export type ClassifiedPriceType = 'FIXED' | 'NEGOTIABLE' | 'CONTACT';
export type ClassifiedCondition = 'NEW' | 'USED' | 'REFURBISHED' | 'NOT_APPLICABLE';

@Entity('classified_listings')
export class ClassifiedListing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 180 })
  slug: string;

  @Index()
  @Column({ type: 'varchar' })
  sellerUserId: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  companyId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 80 })
  categorySlug: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  price: string | null;

  @Column({ type: 'varchar', length: 20, default: 'FIXED' })
  priceType: ClassifiedPriceType;

  @Column({ type: 'varchar', length: 24, default: 'USED' })
  condition: ClassifiedCondition;

  @Column({ type: 'varchar', length: 120 })
  city: string;

  @Column({ type: 'varchar', length: 2 })
  state: string;

  @Column({ type: 'varchar', length: 140, nullable: true })
  neighborhood: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  zipCode: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  @Index()
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' })
  status: ClassifiedListingStatus;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ default: false })
  sellerVerifiedSnapshot: boolean;

  @Column({ type: 'int', default: 0 })
  viewsCount: number;

  @Column({ type: 'int', default: 0 })
  favoritesCount: number;

  @Column({ type: 'jsonb', nullable: true })
  attributes: Record<string, string | number | boolean | null> | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  contactPhone: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  contactWhatsapp: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
