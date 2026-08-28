import { THEME_CATALOG, THEME_MIGRATION_MAP, type ThemeKey, type ThemeCategory } from './themes';

export type CompanyThemeFamily = ThemeCategory;

export type CompanyThemeFeature =
  | 'palette'
  | 'typography'
  | 'corners'
  | 'navigation'
  | 'heroLayout'
  | 'heroSizing'
  | 'cover'
  | 'categories'
  | 'sectionSizing'
  | 'jobsLayout'
  | 'sectionOrder'
  | 'sectionRemoval'
  | 'commerceLayout';

export interface CompanyThemeCapabilities {
  family: CompanyThemeFamily;
  features: Record<CompanyThemeFeature, boolean>;
  requiredSections: string[];
  recommendedSections: string[];
}

const FULL_FEATURES: Record<CompanyThemeFeature, boolean> = {
  palette: true,
  typography: true,
  corners: true,
  navigation: true,
  heroLayout: true,
  heroSizing: true,
  cover: true,
  categories: true,
  sectionSizing: true,
  jobsLayout: true,
  sectionOrder: true,
  sectionRemoval: true,
  commerceLayout: false,
};

const RECOMMENDED: Record<CompanyThemeFamily, string[]> = {
  institutional: ['identity', 'categories', 'about', 'jobs', 'contact', 'socials', 'legal'],
  commerce: ['identity', 'categories', 'classifieds', 'about', 'contact', 'socials', 'jobs', 'legal'],
  food: ['identity', 'categories', 'about', 'contact', 'socials', 'legal'],
  services: ['identity', 'categories', 'about', 'contact', 'socials', 'jobs', 'legal'],
  fashion: ['identity', 'categories', 'about', 'contact', 'socials', 'legal'],
  tech: ['identity', 'categories', 'about', 'jobs', 'contact', 'socials', 'legal'],
  nature: ['identity', 'categories', 'about', 'contact', 'socials', 'legal'],
  events: ['identity', 'about', 'categories', 'contact', 'socials', 'jobs', 'legal'],
  creative: ['identity', 'about', 'categories', 'contact', 'socials', 'jobs', 'legal'],
  universal: ['identity', 'categories', 'about', 'jobs', 'contact', 'socials', 'legal'],
};

export function getCompanyThemeCapabilities(rawThemeKey?: string | null): CompanyThemeCapabilities {
  // Resolve legacy themes to new themes
  const key = String(rawThemeKey || 'horizon').toLowerCase();
  const themeKey = (THEME_CATALOG.find(t => t.key === key)?.key || THEME_MIGRATION_MAP[key] || 'horizon') as ThemeKey;
  
  const catalogItem = THEME_CATALOG.find(t => t.key === themeKey);
  const family = catalogItem?.category || 'institutional';
  const commerce = family === 'commerce';

  return {
    family,
    features: {
      ...FULL_FEATURES,
      commerceLayout: commerce,
      // For new themes, all features are enabled (the engine handles variations gracefully)
      // except commerce specific options
    },
    requiredSections: ['identity'],
    recommendedSections: [...(RECOMMENDED[family] || RECOMMENDED.institutional)],
  };
}

export function themeSupports(themeKey: string | undefined | null, feature: CompanyThemeFeature) {
  return getCompanyThemeCapabilities(themeKey).features[feature];
}
