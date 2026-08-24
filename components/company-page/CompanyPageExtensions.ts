import type {
  CompanyPageConfig as BaseCompanyPageConfig,
  CompanyPageSection as BaseCompanyPageSection,
  CompanyPageWidth,
} from './PremiumCompanySiteRenderer';

export type CompanyContentMode = 'section' | 'independent';

export interface CompanyPageCategoryLink {
  id: string;
  label: string;
  href: string;
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
  sections?: CompanyPageSection[];
};
