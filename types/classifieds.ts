export type ClassifiedListingStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'PAUSED'
  | 'SOLD'
  | 'ARCHIVED'
  | 'PENDING_REVIEW';

export type ClassifiedPriceType = 'FIXED' | 'NEGOTIABLE' | 'CONTACT';
export type ClassifiedCondition = 'NEW' | 'USED' | 'REFURBISHED' | 'NOT_APPLICABLE';

export interface ClassifiedCategory {
  slug: string;
  name: string;
  icon?: string | null;
  parentSlug?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  attributeSchema?: Array<{
    key: string;
    label: string;
    type?: 'text' | 'number' | 'select';
    options?: string[];
  }> | null;
}

export interface ClassifiedListingImage {
  id?: string;
  url: string;
  sortOrder?: number;
  isPrimary?: boolean;
}

export interface ClassifiedSeller {
  id: string;
  type: 'COMPANY' | 'PERSON';
  name: string;
  photoURL?: string | null;
  verified?: boolean;
  memberSince?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface ClassifiedListing {
  id: string;
  slug: string;
  sellerUserId?: string;
  companyId?: string | null;
  categorySlug: string;
  title: string;
  description: string;
  price?: string | number | null;
  priceType: ClassifiedPriceType;
  condition: ClassifiedCondition;
  city: string;
  state: string;
  neighborhood?: string | null;
  zipCode?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  status: ClassifiedListingStatus;
  isFeatured?: boolean;
  sellerVerifiedSnapshot?: boolean;
  viewsCount?: number;
  favoritesCount?: number;
  attributes?: Record<string, string | number | boolean | null> | null;
  contactPhone?: string | null;
  contactWhatsapp?: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  images?: ClassifiedListingImage[];
  isFavorite?: boolean;
  seller?: ClassifiedSeller;
  related?: ClassifiedListing[];
}

export interface ClassifiedSearchResponse {
  items: ClassifiedListing[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
