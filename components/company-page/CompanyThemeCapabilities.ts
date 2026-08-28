export type CompanyThemeFamily = 'institutional' | 'commerce' | 'classifieds' | 'services' | 'food' | 'fashion' | 'creative';

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

const FAMILY_BY_THEME: Record<string, CompanyThemeFamily> = {
  aurora: 'institutional', atlas: 'institutional', pulse: 'institutional', canvas: 'institutional', noir: 'institutional',
  institucional: 'institutional', 'institucional-pro': 'institutional',
  loja: 'commerce', vitrine: 'commerce', marketplace: 'commerce', catalogo: 'commerce',
  mercado: 'classifieds', gazeta: 'classifieds', mosaico: 'classifieds', radar: 'classifieds', pregao: 'classifieds', 'classificados-pro': 'classifieds',
  pro: 'services', oficio: 'services', care: 'services', studio: 'services', local: 'services', 'servicos-pro': 'services',
  bistro: 'food', brasa: 'food', jardim: 'food', diner: 'food', degustacao: 'food',
  runway: 'fashion', street: 'fashion', boutique: 'fashion', lookbook: 'fashion', atelier: 'fashion',
  festival: 'creative', terra: 'creative', cosmos: 'creative', heritage: 'creative', mono: 'creative', editorial: 'creative',
};

const RECOMMENDED: Record<CompanyThemeFamily, string[]> = {
  institutional: ['identity', 'categories', 'about', 'jobs', 'contact', 'socials', 'legal'],
  commerce: ['identity', 'categories', 'classifieds', 'about', 'contact', 'socials', 'jobs', 'legal'],
  classifieds: ['identity', 'categories', 'classifieds', 'contact', 'about', 'socials', 'jobs', 'legal'],
  services: ['identity', 'categories', 'about', 'contact', 'socials', 'jobs', 'legal'],
  food: ['identity', 'categories', 'about', 'contact', 'socials', 'legal'],
  fashion: ['identity', 'categories', 'about', 'contact', 'socials', 'legal'],
  creative: ['identity', 'about', 'categories', 'contact', 'socials', 'jobs', 'legal'],
};

export function getCompanyThemeCapabilities(themeKey?: string | null): CompanyThemeCapabilities {
  const family = FAMILY_BY_THEME[String(themeKey || 'aurora')] || 'institutional';
  return {
    family,
    features: { ...FULL_FEATURES, commerceLayout: family === 'commerce' || family === 'classifieds' },
    requiredSections: ['identity'],
    recommendedSections: [...RECOMMENDED[family]],
  };
}

export function themeSupports(themeKey: string | undefined | null, feature: CompanyThemeFeature) {
  return getCompanyThemeCapabilities(themeKey).features[feature];
}
