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
import { FlexibleCompanyThemeRenderer } from './FlexibleCompanyThemeRenderer';
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
  | 'institucional-pro'
  | 'servicos-pro'
  | 'essencial'
  | 'institucional'
  | 'editorial';

export const COMPANY_PAGE_THEME_CATEGORIES = COMPANY_THEME_CATEGORIES;

const FLEX_TEMPLATES: CompanyThemeCatalogItem[] = [
  {
    key: 'loja',
    category: 'classifieds',
    name: 'Loja',
    eyebrow: 'DTC Store',
    description: 'Loja de marca com campanha, categorias visuais, prateleiras e serviços integrados.',
    bestFor: 'Beleza, presentes, tecnologia, varejo e marcas próprias',
  },
  {
    key: 'marketplace',
    category: 'classifieds',
    name: 'Marketplace',
    eyebrow: 'Discovery commerce',
    description: 'Busca dominante, categorias circulares e prateleiras para catálogos extensos.',
    bestFor: 'Marketplaces, galerias comerciais e negócios com muitos departamentos',
  },
  {
    key: 'catalogo',
    category: 'classifieds',
    name: 'Catálogo',
    eyebrow: 'Editorial catalog',
    description: 'Catálogo editorial com imagem grande, tipografia sofisticada e grade limpa.',
    bestFor: 'Indústrias, distribuidores, design, móveis e catálogos B2B',
  },
  {
    key: 'classificados-pro',
    category: 'classifieds',
    name: 'Classificados Pro',
    eyebrow: 'Listing portal',
    description: 'Busca, filtros visuais e anúncios densos para comparar muita informação.',
    bestFor: 'Imóveis, veículos, equipamentos e classificados especializados',
  },
  {
    key: 'institucional-pro',
    category: 'institutional',
    name: 'Institucional Pro',
    eyebrow: 'Corporate',
    description: 'Site corporativo independente, com marca forte, conteúdo amplo e blocos reorganizáveis.',
    bestFor: 'Empresas, indústrias, escritórios, tecnologia e negócios B2B',
  },
  {
    key: 'servicos-pro',
    category: 'services',
    name: 'Serviços Pro',
    eyebrow: 'Service conversion',
    description: 'Foco em apresentação, confiança, canais de contato e conversão para atendimento.',
    bestFor: 'Clínicas, oficinas, consultorias, salões, escolas e profissionais',
  },
];

const ALL_TEMPLATES: CompanyThemeCatalogItem[] = [
  ...INSTITUTIONAL_V2_TEMPLATES.map((template) => ({ ...template, category: 'institutional' as const })),
  ...FLEX_TEMPLATES,
  ...EXTRA_COMPANY_PAGE_TEMPLATES,
];

export const COMPANY_PAGE_TEMPLATES = {
  map(
    callback: (
      template: CompanyThemeCatalogItem,
      index: number,
      array: CompanyThemeCatalogItem[],
    ) => React.ReactNode,
  ): React.ReactNode[] {
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

      items.forEach((template) => output.push(
        callback(template, ALL_TEMPLATES.indexOf(template), ALL_TEMPLATES),
      ));
    });

    return output;
  },
};

const FLEX_PRESETS: Record<string, any> = {
  marketplace: {
    width: 'full',
    theme: { primary: '#ffe600', accent: '#3483fa', background: '#f5f5f5', text: '#222222' },
    branding: { typography: 'clean', logoSize: 'medium', corners: 'soft' },
    hero: { layout: 'split' },
    jobs: { layout: 'grid' },
    navigation: { sticky: true, transparent: false },
    storefront: {
      showSearch: true,
      bannerStyle: 'compact',
      categoryStyle: 'circles',
      productsLayout: 'carousel',
      cardsPerRow: 4,
      featuredTitle: 'Destaques para você',
    },
  },
  catalogo: {
    width: 'wide',
    theme: { primary: '#292524', accent: '#a16207', background: '#fafaf9', text: '#1c1917' },
    branding: { typography: 'editorial', logoSize: 'large', corners: 'square' },
    hero: { layout: 'minimal' },
    jobs: { layout: 'grid' },
    navigation: { sticky: true, transparent: false },
    storefront: {
      showSearch: false,
      bannerStyle: 'editorial',
      categoryStyle: 'tiles',
      productsLayout: 'grid',
      cardsPerRow: 4,
      featuredTitle: 'Catálogo',
    },
  },
  'classificados-pro': {
    width: 'full',
    theme: { primary: '#111827', accent: '#f97316', background: '#f3f4f6', text: '#111827' },
    branding: { typography: 'clean', logoSize: 'medium', corners: 'soft' },
    hero: { layout: 'split' },
    jobs: { layout: 'compact' },
    navigation: { sticky: true, transparent: false },
    storefront: {
      showSearch: true,
      bannerStyle: 'compact',
      categoryStyle: 'chips',
      productsLayout: 'list',
      cardsPerRow: 4,
      featuredTitle: 'Anúncios em destaque',
    },
  },
  'institucional-pro': {
    width: 'wide',
    theme: { primary: '#0f172a', accent: '#0f766e', background: '#ffffff', text: '#0f172a' },
    branding: { typography: 'clean', logoSize: 'large', corners: 'soft' },
    hero: { layout: 'split' },
    jobs: { layout: 'list' },
    navigation: { sticky: true, transparent: false },
  },
  'servicos-pro': {
    width: 'wide',
    theme: { primary: '#3f3f46', accent: '#7c3aed', background: '#fafafa', text: '#18181b' },
    branding: { typography: 'human', logoSize: 'medium', corners: 'round' },
    hero: { layout: 'centered' },
    jobs: { layout: 'list' },
    navigation: { sticky: true, transparent: false },
  },
};

export const COMPANY_PAGE_THEME_PRESETS = {
  ...INSTITUTIONAL_V2_PRESETS,
  loja: STORE_COMPANY_THEME_PRESET,
  ...FLEX_PRESETS,
  ...EXTRA_THEME_PRESETS,
};

function normalizeHex(value?: string) {
  const color = String(value || '').trim().toLowerCase();
  if (color === '#fff') return '#ffffff';
  return color;
}

function paletteMatches(
  theme: CompanyPageConfig['theme'],
  palette: { primary?: string; accent?: string; background?: string; text?: string },
) {
  if (!theme) return false;
  return normalizeHex(theme.primary) === normalizeHex(palette.primary)
    && normalizeHex(theme.accent) === normalizeHex(palette.accent)
    && normalizeHex(theme.background) === normalizeHex(palette.background)
    && normalizeHex(theme.text) === normalizeHex(palette.text);
}

function isUntouchedLegacyConfig(page?: CompanyPageConfig | null) {
  if (!page) return true;

  const neutralPalette = !page.theme || paletteMatches(page.theme, {
    primary: '#111111',
    accent: '#555555',
    background: '#ffffff',
    text: '#171717',
  });

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
  return value === 'aurora'
    || value === 'atlas'
    || value === 'pulse'
    || value === 'canvas'
    || value === 'noir';
}

function institutionalKey(value?: string): InstitutionalThemeKey {
  if (isInstitutionalTheme(value)) return value;
  if (value === 'institucional') return 'atlas';
  if (value === 'editorial') return 'canvas';
  return 'aurora';
}

function isModernFlexibleTheme(key: string) {
  return key === 'institucional-pro' || key === 'servicos-pro';
}

function ensureCommerceSection(
  config: CompanyPageConfig,
  force = false,
): CompanyPageConfig {
  if (!force && Number(config.version || 0) >= 6) return config;

  const sections = Array.isArray(config.sections)
    ? config.sections.map((section) => ({ ...section }))
    : [];

  if (sections.length && !sections.some((section) => section.type === 'classifieds')) {
    const categoriesIndex = sections.findIndex((section) => section.type === 'categories');
    const insertAt = categoriesIndex >= 0 ? categoriesIndex + 1 : Math.min(1, sections.length);
    sections.splice(insertAt, 0, {
      id: 'classifieds',
      type: 'classifieds',
      enabled: true,
    });
  }

  return sections.length ? { ...config, sections } : config;
}

function applyGenericPreset(config: CompanyPageConfig, key: string): CompanyPageConfig {
  const preset = FLEX_PRESETS[key];
  if (!preset) return config;

  return ensureCommerceSection({
    ...config,
    version: Math.max(6, Number(config.version || 0)),
    templateKey: key,
    width: preset.width,
    theme: { ...(config.theme || {}), ...preset.theme },
    branding: { ...(config.branding || {}), ...preset.branding },
    hero: { ...(config.hero || {}), ...preset.hero },
    jobs: { ...(config.jobs || {}), ...preset.jobs },
    navigation: { ...(config.navigation || {}), ...preset.navigation },
    storefront: preset.storefront
      ? { ...(config.storefront || {}), ...preset.storefront }
      : config.storefront,
  } as CompanyPageConfig, true);
}

export function applyCompanyThemePreset(
  config: CompanyPageConfig,
  key: string,
): CompanyPageConfig {
  if (key === 'loja') {
    return ensureCommerceSection({
      ...applyStoreCompanyThemePreset(config),
      version: Math.max(6, Number(config.version || 0)),
      templateKey: 'loja',
    }, true);
  }

  if (FLEX_PRESETS[key]) return applyGenericPreset(config, key);

  if (key === 'vitrine') {
    return {
      ...applyGenericPreset(config, 'marketplace'),
      templateKey: 'vitrine',
    };
  }

  if (isExtraCompanyTheme(key)) {
    const next = {
      ...(applyExtraCompanyThemePreset(config, key) as CompanyPageConfig),
      version: Math.max(6, Number(config.version || 0)),
      templateKey: key,
    };

    return isCommerceCompanyTheme(key)
      ? ensureCommerceSection(next, true)
      : next;
  }

  if (isInstitutionalTheme(key)) {
    return {
      ...applyInstitutionalV2Preset(config, key),
      version: Math.max(6, Number(config.version || 0)),
      templateKey: key,
    };
  }

  return {
    ...config,
    version: Math.max(6, Number(config.version || 0)),
    templateKey: key,
  };
}

function PlatformFooter() {
  return <div className="pn-platform-footer">
    <style>{`
      .pn-company-renderer .pn-rendered-theme footer a[href="/"]{display:none!important}
      .pn-platform-footer{display:flex;align-items:center;justify-content:center;gap:9px;min-height:54px;padding:12px 20px;border-top:1px solid rgba(120,113,108,.18);background:#fff;color:#78716c;font:600 11px/1.2 Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:.02em}
      .pn-platform-footer img{width:22px;height:22px;object-fit:contain}
      .pn-platform-footer a{display:inline-flex;align-items:center;gap:9px;color:inherit;text-decoration:none}
      .pn-platform-footer strong{color:#44403c}
    `}</style>
    <Link to="/" aria-label="PiraNegócios">
      <img src="/brand/symbol-terracotta.png" alt="" />
      <span>Integrado ao <strong>PiraNegócios</strong></span>
    </Link>
  </div>;
}

export function CompanySiteRenderer({
  company,
  jobs,
  page,
  preview = false,
}: {
  company: PublicCompanyLike;
  jobs: PublicJobLike[];
  page?: CompanyPageConfig | null;
  preview?: boolean;
}) {
  const config = page || {};
  const key = String(config.templateKey || 'aurora');
  let rendered: React.ReactNode;

  if (config.editorMode === 'code') {
    rendered = <LegacyCompanySiteRenderer
      company={company}
      jobs={jobs}
      page={config}
      preview={preview}
    />;
  } else if (isCommerceCompanyTheme(key)) {
    let visualPage = config;

    if (isUntouchedLegacyConfig(config)) {
      if (key === 'loja') {
        visualPage = ensureCommerceSection(applyStoreCompanyThemePreset(config));
      } else if (FLEX_PRESETS[key]) {
        visualPage = applyGenericPreset(config, key);
      } else if (key === 'vitrine') {
        visualPage = {
          ...applyGenericPreset(config, 'marketplace'),
          templateKey: 'vitrine',
        };
      } else if (isExtraCompanyTheme(key)) {
        visualPage = ensureCommerceSection(
          applyExtraCompanyThemePreset(config, key) as CompanyPageConfig,
        );
      }
    } else {
      visualPage = ensureCommerceSection(config);
    }

    rendered = <CommerceCompanyThemeRenderer
      themeKey={key}
      company={company}
      jobs={jobs}
      config={visualPage}
      preview={preview}
    />;
  } else if (isModernFlexibleTheme(key)) {
    const visualPage = isUntouchedLegacyConfig(config) && FLEX_PRESETS[key]
      ? applyGenericPreset(config, key)
      : config;

    rendered = <FlexibleCompanyThemeRenderer
      themeKey={key}
      company={company}
      jobs={jobs}
      config={visualPage}
      preview={preview}
    />;
  } else if (isExtraCompanyTheme(key)) {
    const visualPage = isUntouchedLegacyConfig(config)
      ? applyExtraCompanyThemePreset(config, key) as CompanyPageConfig
      : config;

    rendered = <ConfigurableExtraCompanyThemeRenderer
      themeKey={key}
      company={company}
      jobs={jobs}
      config={visualPage}
      preview={preview}
    />;
  } else {
    const resolvedKey = institutionalKey(key);
    const visualPage = isUntouchedLegacyConfig(config)
      ? applyInstitutionalV2Preset(config, resolvedKey)
      : config;

    rendered = <InstitutionalCompanyThemes
      themeKey={resolvedKey}
      company={company}
      jobs={jobs}
      config={visualPage}
      preview={preview}
    />;
  }

  return <div className="pn-company-renderer">
    <div className="pn-rendered-theme">{rendered}</div>
    <PlatformFooter />
  </div>;
}
