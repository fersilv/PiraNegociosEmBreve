import type {
  CompanyPageConfig as BaseCompanyPageConfig,
  CompanyPageSection as BaseCompanyPageSection,
  CompanyPageWidth,
} from './PremiumCompanySiteRenderer';

export type CompanyContentMode = 'section' | 'independent';
export type CompanyCategoryStyle = 'chips' | 'circles' | 'tiles' | 'image-tiles';
export type CompanyProductsLayout = 'carousel' | 'grid' | 'masonry' | 'list';
export type CompanyBannerStyle = 'full' | 'split' | 'compact' | 'editorial';

export interface CompanyPageCategoryLink {
  id: string;
  label: string;
  href: string;
  imageUrl?: string;
}

export interface CompanyPageSection extends BaseCompanyPageSection {
  width?: CompanyPageWidth;
  contentWidth?: CompanyPageWidth;
  contentMode?: CompanyContentMode;
  maxHeight?: number;
}

type BaseHero = NonNullable<BaseCompanyPageConfig['hero']>;

export type CompanyPageConfig = Omit<BaseCompanyPageConfig, 'hero' | 'sections'> & {
  hero?: BaseHero & {
    width?: CompanyPageWidth;
    contentWidth?: CompanyPageWidth;
    contentMode?: CompanyContentMode;
    maxHeight?: number;
  };
  categories?: {
    enabled?: boolean;
    title?: string;
    width?: CompanyPageWidth;
    contentWidth?: CompanyPageWidth;
    contentMode?: CompanyContentMode;
    items?: CompanyPageCategoryLink[];
  };
  storefront?: {
    promoText?: string;
    secondaryPromoText?: string;
    showSearch?: boolean;
    searchPlaceholder?: string;
    bannerStyle?: CompanyBannerStyle;
    categoryStyle?: CompanyCategoryStyle;
    productsLayout?: CompanyProductsLayout;
    cardsPerRow?: 2 | 3 | 4 | 5;
    featuredTitle?: string;
    showProducts?: boolean;
    showServices?: boolean;
  };
  sections?: CompanyPageSection[];
};