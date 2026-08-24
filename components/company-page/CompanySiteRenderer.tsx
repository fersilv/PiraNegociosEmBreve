import React from 'react';
import { CompanySiteRenderer as LegacyCompanySiteRenderer } from './PremiumCompanySiteRenderer';
import type {
  CompanyEditorMode,
  CompanyPageWidth,
  CompanyTypography,
  PublicCompanyLike,
  PublicJobLike,
} from './PremiumCompanySiteRenderer';
import type {
  CompanyPageConfig,
  CompanyPageSection,
} from './CompanyPageExtensions';
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
  | 'essencial' | 'institucional' | 'vitrine' | 'editorial';

export const COMPANY_PAGE_THEME_CATEGORIES = COMPANY_THEME_CATEGORIES;

const ALL_TEMPLATES: CompanyThemeCatalogItem[] = [
  ...INSTITUTIONAL_V2_TEMPLATES.map((template) => ({ ...template, category: 'institutional' as const })),
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

export const COMPANY_PAGE_THEME_PRESETS = {
  ...INSTITUTIONAL_V2_PRESETS,
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
  return value === 'aurora' || value === 'atlas' || value === 'pulse' || value === 'canvas' || value === 'noir';
}

function institutionalKey(value?: string): InstitutionalThemeKey {
  if (isInstitutionalTheme(value)) return value;
  if (value === 'institucional') return 'atlas';
  if (value === 'vitrine') return 'pulse';
  if (value === 'editorial') return 'canvas';
  return 'aurora';
}

export function applyCompanyThemePreset(config: CompanyPageConfig, key: string): CompanyPageConfig {
  if (isExtraCompanyTheme(key)) return applyExtraCompanyThemePreset(config, key) as CompanyPageConfig;
  if (isInstitutionalTheme(key)) return applyInstitutionalV2Preset(config, key);
  return config;
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

  if (config.editorMode === 'code') {
    return <LegacyCompanySiteRenderer company={company} jobs={jobs} page={config} preview={preview} />;
  }

  if (isExtraCompanyTheme(key)) {
    const visualPage = isUntouchedLegacyConfig(config)
      ? applyExtraCompanyThemePreset(config, key) as CompanyPageConfig
      : config;
    return (
      <ConfigurableExtraCompanyThemeRenderer
        themeKey={key}
        company={company}
        jobs={jobs}
        config={visualPage}
        preview={preview}
      />
    );
  }

  const resolvedKey = institutionalKey(key);
  const visualPage = isUntouchedLegacyConfig(config)
    ? applyInstitutionalV2Preset(config, resolvedKey)
    : config;

  return (
    <InstitutionalCompanyThemes
      themeKey={resolvedKey}
      company={company}
      jobs={jobs}
      config={visualPage}
      preview={preview}
    />
  );
}
