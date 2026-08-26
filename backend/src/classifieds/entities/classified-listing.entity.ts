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

export type ClassifiedPriceType = 'FIXED' | 'NEGOTIABLE' | 'STARTING_AT' | 'CONTACT';
export type ClassifiedCondition = 'NEW' | 'USED' | 'REFURBISHED' | 'NOT_APPLICABLE';
export type ClassifiedListingType = 'PRODUCT' | 'SERVICE';
export type ClassifiedPublicationChannel = 'CLASSIFIEDS' | 'COMPANY_PAGE';
export type ClassifiedCatalogPricingStrategy = 'BASE' | 'SUM' | 'HIGHEST_SELECTION' | 'LOWEST_SELECTION' | 'AVERAGE_SELECTION';

export type ClassifiedCatalogOption = {
  id: string;
  label: string;
  priceDelta?: number;
  price?: number;
  active?: boolean;
  sku?: string;
  imageUrl?: string;
};

export type ClassifiedCatalogOptionGroup = {
  id: string;
  name: string;
  kind: 'VARIANT' | 'MODIFIER';
  selectionType: 'SINGLE' | 'MULTIPLE';
  minSelections?: number;
  maxSelections?: number;
  pricingStrategy?: ClassifiedCatalogPricingStrategy;
  options: ClassifiedCatalogOption[];
};

export type ClassifiedCatalogConfig = {
  optionGroups?: ClassifiedCatalogOptionGroup[];
  pricingStrategy?: ClassifiedCatalogPricingStrategy;
};

export type ClassifiedCommerceConfig = {
  promotion?: {
    price: number;
    startsAt?: string | null;
    endsAt?: string | null;
    endAction?: 'REVERT' | 'PAUSE';
  } | null;
  paymentPricing?: {
    pix?: {
      enabled?: boolean;
      discountType?: 'PERCENT' | 'FIXED';
      discountValue?: number;
    } | null;
    card?: {
      enabled?: boolean;
      price?: number | null;
      maxInstallments?: number;
      interestFreeInstallments?: number;
    } | null;
  } | null;
  onlineCheckout?: {
    enabled?: boolean;
    fulfillmentModes?: Array<'PICKUP' | 'DELIVERY'>;
    stockQuantity?: number | null;
    lowStockThreshold?: number | null;
    orderWhatsappE164?: string | null;
  } | null;
};

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

  @Column({ type: 'varchar', length: 20, default: 'PRODUCT' })
  listingType: ClassifiedListingType;

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

  @Column({ type: 'jsonb', default: () => "'[\"CLASSIFIEDS\"]'::jsonb" })
  publicationChannels: ClassifiedPublicationChannel[];

  @Column({ type: 'jsonb', nullable: true })
  catalogConfig: ClassifiedCatalogConfig | null;

  @Column({ type: 'jsonb', nullable: true })
  commerceConfig: ClassifiedCommerceConfig | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  contactPhone: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  contactWhatsapp: string | null;

  @Column({ type: 'text', nullable: true })
  moderationReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  duplicateOfListingId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  moderationReviewedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
