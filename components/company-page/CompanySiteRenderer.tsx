import React from 'react';
import { Link } from 'react-router-dom';
import { CompanySiteRenderer as LegacyCompanySiteRenderer } from './PremiumCompanySiteRenderer';
import type {
  CompanyEditorMode,
  CompanyPageWidth,
  CompanyTypography,
  PublicCompanyLike,
  PublicJobLike,
} from './PremiumCompanySiteRenderer';
import type { CompanyPageConfig, CompanyPageSection } from './CompanyPageExtensions';
import {
  COMPANY_THEME_CATEGORIES,
  EXTRA_COMPANY_PAGE_TEMPLATES,
  EXTRA_THEME_PRESETS,
  applyExtraCompanyThemePreset,
  isExtraCompanyTheme,
} from './ReferenceCompanyThemes';
import type {
  CompanyThemeCatalogItem,
  CompanyThemeCategory,
  ExtraCompanyThemeKey,
} from './ReferenceCompanyThemes';
import { ConfigurableExtraCompanyThemeRenderer } from './ConfigurableReferenceThemes';
import {
  INSTITUTIONAL_V2_PRESETS,
  INSTITUTIONAL_V2_TEMPLATES,
  InstitutionalCompanyThemes,
  applyInstitutionalV2Preset,
  type InstitutionalThemeKey,
} from './InstitutionalCompanyThemes';
import {
  STORE_COMPANY_THEME_PRESET,
  applyStoreCompanyThemePreset,
} from './StoreCompanyTheme';
import {
  CommerceCompanyThemeRenderer,
  isCommerceCompanyTheme,
  type CommerceCompanyThemeKey,
} from './CommerceCompanyThemeRenderer';

export { isCommerceCompanyTheme } from './CommerceCompanyThemeRenderer';

export type {
  CompanyEditorMode,
  CompanyPageConfig,
  CompanyPageSection,
  CompanyPageWidth,
  CompanyTypography,
  PublicCompanyLike,
  PublicJobLike,
  CompanyThemeCatalogItem,
  CompanyThemeCategory,
  ExtraCompanyThemeKey,
  InstitutionalThemeKey,
};

export type CompanyTemplateKey =
  | InstitutionalThemeKey
  | ExtraCompanyThemeKey
  | CommerceCompanyThemeKey
  | 'essencial'
  | 'institucional'
  | 'editorial';

export const COMPANY_PAGE_THEME_CATEGORIES = COMPANY_THEME_CATEGORIES;

const COMMERCE_TEMPLATES: CompanyThemeCatalogItem[] = [
  {
    key: 'loja',
    category: 'classifieds',
    name: 'Loja',
    eyebrow: 'DTC Store',
    description: 'Loja de marca com banner de campanha, categorias visuais, prateleiras e serviços integrados.',
    bestFor: 'Beleza, presentes, tecnologia, varejo e marcas próprias',
  },
  {
    key: 'marketplace',
    category: 'classifieds',
    name: 'Marketplace',
    eyebrow: 'Discovery commerce',
    description: 'Busca dominante, categorias circulares e várias prateleiras para catálogos extensos.',
    bestFor: 'Marketplaces, galerias comerciais e negócios com muitos departamentos',
  },
  {
    key: 'catalogo',
    category: 'classifieds',
    name: 'Catálogo',
    eyebrow: 'Editorial catalog',
    description: 'Catálogo editorial com imagem grande, tipografia sofisticada e grade limpa de produtos.',
    bestFor: 'Indústrias, distribuidores, design, móveis e catálogos B2B',
  },
  {
    key: 'classificados-pro',
    category: 'classifieds',
    name: 'Classificados Pro',
    eyebrow: 'Listing portal',
    description: 'Busca, filtros visuais e anúncios em linhas densas para comparar muita informação rapidamente.',
    bestFor: 'Imóveis, veículos, equipamentos e classificados especializados',
  },
];

const ALL_TEMPLATES: CompanyThemeCatalogItem[] = [
  ...INSTITUTIONAL_V2_TEMPLATES.map((template) => ({ ...template, category: 'institutional' as const })),
  ...COMMERCE_TEMPLATES,
  ...EXTRA_COMPANY_PAGE_TEMPLATES,
];

export const COMPANY_PAGE_TEMPLATES = {
  map(callback: (template: CompanyThemeCatalogItem, index: number, array: CompanyThemeCatalogItem[]) => React.ReactNode): React.ReactNode[] {
    const output: React.ReactNode[] = [];
    COMPANY_THEME_CATEGORIES.forEach((category) => {
      const items = ALL_TEMPLATES.filter((template) => template.category === category.id);
      if (!items.length) return;
      output.push(
        <div key={`category-${category.id}`} className="px-2 pb-2 pt-5 first:pt-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[.18em] text-stone-900">{category.label}</span>
            <span className="h-px flex-1 bg-stone-200" />
            <span className="text-[9px] font-bold text-stone-400">{items.length} temas</span>
          </div>
          <p className="mt-1 text-[10px] leading-4 text-stone-400">{category.description}</p>
        </div>,
      );
      items.forEach((template) => output.push(callback(template, ALL_TEMPLATES.indexOf(template), ALL_TEMPLATES)));
    });
    return output;
  },
};

const COMMERCE_STOREFRONT_DEFAULTS: Record<string, NonNullable<CompanyPageConfig['storefront']>> = {
  loja: { showSearch: false, bannerStyle: 'full', categoryStyle: 'image-tiles', productsLayout: 'carousel', cardsPerRow: 4, featuredTitle: 'Escolhas da marca', showProducts: true, showServices: true },
  vitrine: { showSearch: false, bannerStyle: 'split', categoryStyle: 'image-tiles', productsLayout: 'grid', cardsPerRow: 4, featuredTitle: 'Vitrine', showProducts: true, showServices: true },
  marketplace: { showSearch: true, bannerStyle: 'compact', categoryStyle: 'circles', productsLayout: 'carousel', cardsPerRow: 4, featuredTitle: 'Destaques para você', showProducts: true, showServices: true },
  catalogo: { showSearch: false, bannerStyle: 'editorial', categoryStyle: 'tiles', productsLayout: 'grid', cardsPerRow: 4, featuredTitle: 'Catálogo', showProducts: true, showServices: true },
  'classificados-pro': { showSearch: true, bannerStyle: 'compact', categoryStyle: 'chips', productsLayout: 'list', cardsPerRow: 4, featuredTitle: 'Anúncios em destaque', showProducts: true, showServices: true },
  mercado: { showSearch: true, bannerStyle: 'split', categoryStyle: 'circles', productsLayout: 'carousel', cardsPerRow: 4, featuredTitle: 'Ofertas da loja', showProducts: true, showServices: true },
  gazeta: { showSearch: false, bannerStyle: 'editorial', categoryStyle: 'chips', productsLayout: 'list', cardsPerRow: 4, featuredTitle: 'Classificados', showProducts: true, showServices: true },
  mosaico: { showSearch: false, bannerStyle: 'full', categoryStyle: 'image-tiles', productsLayout: 'masonry', cardsPerRow: 4, featuredTitle: 'Descobertas', showProducts: true, showServices: true },
  radar: { showSearch: true, bannerStyle: 'split', categoryStyle: 'tiles', productsLayout: 'grid', cardsPerRow: 4, featuredTitle: 'Perto de você', showProducts: true, showServices: true },
  pregao: { showSearch: true, bannerStyle: 'compact', categoryStyle: 'chips', productsLayout: 'list', cardsPerRow: 4, featuredTitle: 'Oportunidades abertas', showProducts: true, showServices: true },
};

const COMMERCE_PRESETS: Record<string, any> = {
  marketplace: {
    width: 'full',
    theme: { primary: '#ffe600', accent: '#3483fa', background: '#f5f5f5', text: '#222222' },
    branding: { typography: 'clean', logoSize: 'medium', corners: 'soft' },
    hero: { layout: 'split' },
    jobs: { layout: 'grid' },
    navigation: { sticky: true, transparent: false },
  },
  catalogo: {
    width: 'wide',
    theme: { primary: '#292524', accent: '#a16207', background: '#fafaf9', text: '#1c1917' },
    branding: { typography: 'editorial', logoSize: 'large', corners: 'square' },
    hero: { layout: 'minimal' },
    jobs: { layout: 'grid' },
    navigation: { sticky: true, transparent: false },
  },
  'classificados-pro': {
    width: 'full',
    theme: { primary: '#111827', accent: '#f97316', background: '#f3f4f6', text: '#111827' },
    branding: { typography: 'clean', logoSize: 'medium', corners: 'soft' },
    hero: { layout: 'split' },
    jobs: { layout: 'compact' },
    navigation: { sticky: true, transparent: false },
  },
};

export const COMPANY_PAGE_THEME_PRESETS = {
  ...INSTITUTIONAL_V2_PRESETS,
  loja: STORE_COMPANY_THEME_PRESET,
  ...COMMERCE_PRESETS,
  ...EXTRA_THEME_PRESETS,
};

function normalizeHex(value?: string) {
  const color = String(value || '').trim().toLowerCase();
  if (color === '#fff') return '#ffffff';
  return color;
}

function paletteMatches(theme: CompanyPageConfig['theme'], palette: { primary?: string; accent?: string; background?: string; text?: string }) {
  if (!theme) return false;
  return normalizeHex(theme.primary) === normalizeHex(palette.primary)
    && normalizeHex(theme.accent) === normalizeHex(palette.accent)
    && normalizeHex(theme.background) === normalizeHex(palette.background)
    && normalizeHex(theme.text) === normalizeHex(palette.text);
}

function isUntouchedLegacyConfig(page?: CompanyPageConfig | null) {
  if (!page) return true;
  const neutralPalette = !page.theme || paletteMatches(page.theme, { primary: '#111111', accent: '#555555', background: '#ffffff', text: '#171717' });
  if (!neutralPalette) return false;
  return (page.width || 'wide') === 'wide'
    && (page.branding?.typography || 'clean') === 'clean'
    && (page.branding?.logoSize || 'large') === 'large'
    && (page.branding?.corners || 'soft') === 'soft'
    && page.navigation?.enabled !== false
    && page.navigation?.sticky !== false
    && !page.navigation?.transparent
    && (page.navigation?.jobsLabel || 'Vagas') === 'Vagas'
    && (page.hero?.layout || 'split') === 'split'
    && (page.jobs?.layout || 'grid') === 'grid';
}

function isInstitutionalTheme(value?: string): value is InstitutionalThemeKey {
  return value === 'aurora' || value === 'atlas' || value === 'pulse' || value === 'canvas' || value === 'noir';
}

function institutionalKey(value?: string): InstitutionalThemeKey {
  if (isInstitutionalTheme(value)) return value;
  if (value === 'institucional') return 'atlas';
  if (value === 'editorial') return 'canvas';
  return 'aurora';
}

function ensureCommerceSection(config: CompanyPageConfig): CompanyPageConfig {
  const sections = Array.isArray(config.sections) ? config.sections.map((section) => ({ ...section })) : [];
  if (sections.length && !sections.some((section) => section.type === 'classifieds')) {
    const categoriesIndex = sections.findIndex((section) => section.type === 'categories');
    const insertAt = categoriesIndex >= 0 ? categoriesIndex + 1 : Math.min(1, sections.length);
    sections.splice(insertAt, 0, { id: 'classifieds', type: 'classifieds', enabled: true });
  }
  return sections.length ? { ...config, sections } : config;
}

function withStorefrontDefaults(config: CompanyPageConfig, key: string) {
  const defaults = COMMERCE_STOREFRONT_DEFAULTS[key];
  if (!defaults) return config;
  return { ...config, storefront: { ...(config.storefront || {}), ...defaults } } as CompanyPageConfig;
}

function applyCommercePreset(config: CompanyPageConfig, key: string): CompanyPageConfig {
  const preset = COMMERCE_PRESETS[key];
  if (!preset) return withStorefrontDefaults(ensureCommerceSection(config), key);
  return withStorefrontDefaults(
    ensureCommerceSection({
      ...config,
      templateKey: key,
      width: preset.width,
      theme: { ...(config.theme || {}), ...preset.theme },
      branding: { ...(config.branding || {}), ...preset.branding },
      hero: { ...(config.hero || {}), ...preset.hero },
      jobs: { ...(config.jobs || {}), ...preset.jobs },
      navigation: { ...(config.navigation || {}), ...preset.navigation },
    } as CompanyPageConfig),
    key,
  );
}

export function applyCompanyThemePreset(config: CompanyPageConfig, key: string): CompanyPageConfig {
  if (key === 'loja') return withStorefrontDefaults(ensureCommerceSection(applyStoreCompanyThemePreset(config)), key);
  if (COMMERCE_PRESETS[key]) return applyCommercePreset(config, key);
  if (key === 'vitrine') return { ...applyCommercePreset(config, 'vitrine'), templateKey: 'vitrine' };
  if (isExtraCompanyTheme(key)) {
    const next = applyExtraCompanyThemePreset(config, key) as CompanyPageConfig;
    return isCommerceCompanyTheme(key)
      ? withStorefrontDefaults(ensureCommerceSection(next), key)
      : next;
  }
  if (isInstitutionalTheme(key)) return applyInstitutionalV2Preset(config, key);
  return { ...config, templateKey: key };
}

function PlatformFooter() {
  return (
    <div className="pn-platform-footer">
      <style>{`
        .pn-company-renderer .pn-rendered-theme footer a[href="/"]{display:none!important}
        .pn-company-renderer .pc-section-catalog:not(:has(.pc-catalog-body)):not(:has(.pc-loading)){display:none!important}
        .pn-platform-footer{display:flex;align-items:center;justify-content:center;gap:9px;min-height:54px;padding:12px 20px;border-top:1px solid rgba(120,113,108,.18);background:#fff;color:#78716c;font:600 11px/1.2 Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:.02em}
        .pn-platform-footer img{width:22px;height:22px;object-fit:contain}
        .pn-platform-footer a{display:inline-flex;align-items:center;gap:9px;color:inherit;text-decoration:none}
        .pn-platform-footer strong{color:#44403c}
      `}</style>
      <Link to="/" aria-label="PiraNegócios">
        <img src="/brand/symbol-terracotta.png" alt="" />
        <span>Integrado ao <strong>PiraNegócios</strong></span>
      </Link>
    </div>
  );
}

export function CompanySiteRenderer({ company, jobs, page, preview = false }: { company: PublicCompanyLike; jobs: PublicJobLike[]; page?: CompanyPageConfig | null; preview?: boolean }) {
  const config = page || {};
  const key = String(config.templateKey || 'aurora');
  let rendered: React.ReactNode;

  if (config.editorMode === 'code') {
    rendered = <LegacyCompanySiteRenderer company={company} jobs={jobs} page={config} preview={preview} />;
  } else if (isCommerceCompanyTheme(key)) {
    let visualPage = ensureCommerceSection(config);
    if (isUntouchedLegacyConfig(config)) {
      if (key === 'loja') {
        visualPage = withStorefrontDefaults(ensureCommerceSection(applyStoreCompanyThemePreset(config)), key);
      } else if (COMMERCE_PRESETS[key]) {
        visualPage = applyCommercePreset(config, key);
      } else if (key === 'vitrine') {
        visualPage = applyCommercePreset(config, 'vitrine');
      } else if (isExtraCompanyTheme(key)) {
        visualPage = withStorefrontDefaults(
          ensureCommerceSection(applyExtraCompanyThemePreset(config, key) as CompanyPageConfig),
          key,
        );
      }
    }
    rendered = <CommerceCompanyThemeRenderer themeKey={key} company={company} jobs={jobs} config={visualPage} preview={preview} />;
  } else if (isExtraCompanyTheme(key)) {
    const visualPage = isUntouchedLegacyConfig(config) ? applyExtraCompanyThemePreset(config, key) as CompanyPageConfig : config;
    rendered = <ConfigurableExtraCompanyThemeRenderer themeKey={key} company={company} jobs={jobs} config={visualPage} preview={preview} />;
  } else {
    const resolvedKey = institutionalKey(key);
    const visualPage = isUntouchedLegacyConfig(config) ? applyInstitutionalV2Preset(config, resolvedKey) : config;
    rendered = <InstitutionalCompanyThemes themeKey={resolvedKey} company={company} jobs={jobs} config={visualPage} preview={preview} />;
  }

  return (
    <div className="pn-company-renderer">
      <div className="pn-rendered-theme">{rendered}</div>
      <PlatformFooter />
    </div>
  );
}
