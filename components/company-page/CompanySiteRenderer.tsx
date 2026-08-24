import React from 'react';
import {
  CompanySiteRenderer as InstitutionalCompanySiteRenderer,
  COMPANY_PAGE_TEMPLATES as INSTITUTIONAL_TEMPLATES,
  COMPANY_PAGE_THEME_PRESETS as INSTITUTIONAL_PRESETS,
  applyCompanyThemePreset as applyInstitutionalThemePreset,
} from './PremiumCompanySiteRenderer';
import type {
  CompanyEditorMode,
  CompanyPageConfig,
  CompanyPageSection,
  CompanyPageWidth,
  CompanyTypography,
  PublicCompanyLike,
  PublicJobLike,
} from './PremiumCompanySiteRenderer';
import {
  COMPANY_THEME_CATEGORIES,
  EXTRA_COMPANY_PAGE_TEMPLATES,
  EXTRA_THEME_PRESETS,
  ExtraCompanyThemeRenderer,
  applyExtraCompanyThemePreset,
  isExtraCompanyTheme,
} from './ReferenceCompanyThemes';
import type {
  CompanyThemeCatalogItem,
  CompanyThemeCategory,
  ExtraCompanyThemeKey,
} from './ReferenceCompanyThemes';

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
};

export type CompanyTemplateKey =
  | 'aurora' | 'atlas' | 'pulse' | 'canvas' | 'noir'
  | ExtraCompanyThemeKey
  | 'essencial' | 'institucional' | 'vitrine' | 'editorial';

export const COMPANY_PAGE_THEME_CATEGORIES = COMPANY_THEME_CATEGORIES;

const ALL_TEMPLATES: CompanyThemeCatalogItem[] = [
  ...INSTITUTIONAL_TEMPLATES.map((template) => ({ ...template, category: 'institutional' as const })),
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
  ...INSTITUTIONAL_PRESETS,
  ...EXTRA_THEME_PRESETS,
};

const LEGACY_EXTRA_PALETTES = [
  ['#2563eb', '#f59e0b', '#f5f7fb', '#152033'], ['#8b1e1e', '#c7a96b', '#f3efe5', '#231f1a'],
  ['#6d28d9', '#ec4899', '#fff7ed', '#201a24'], ['#0f766e', '#fb923c', '#eef6f4', '#12322f'],
  ['#f4c430', '#f97316', '#111214', '#f5f5f4'], ['#713f2a', '#b8895b', '#f3eadf', '#35271e'],
  ['#e23d28', '#f59e0b', '#15110f', '#f7efe8'], ['#567d46', '#d99f67', '#f4f1df', '#253126'],
  ['#ef4444', '#22d3ee', '#fff2c7', '#251a1a'], ['#6f5138', '#bda37c', '#f8f5ef', '#29241f'],
  ['#111111', '#ef4444', '#f5f5f2', '#0b0b0b'], ['#111111', '#b8ff2c', '#e7e7e2', '#111111'],
  ['#a85f72', '#d2a679', '#f8f1f1', '#382b30'], ['#25324a', '#b8895b', '#f1efe9', '#1e2430'],
  ['#754c3b', '#c09a7a', '#eee5da', '#332822'], ['#1d4ed8', '#14b8a6', '#f7f9fc', '#152033'],
  ['#dc5a26', '#294c60', '#f1eadf', '#292621'], ['#3c8d87', '#d89aa7', '#f3f8f6', '#243533'],
  ['#6d28d9', '#f43f5e', '#f5f2ff', '#17121e'], ['#cc5843', '#2e7d6e', '#fff8ef', '#362a25'],
  ['#7c3aed', '#ff4d6d', '#fff4a6', '#16121d'], ['#6b7d3e', '#b96843', '#eee3d2', '#30291f'],
  ['#8b5cf6', '#22d3ee', '#05040a', '#f8f7ff'], ['#6f1d1b', '#a67c52', '#efe8d8', '#2b241c'],
  ['#111111', '#777777', '#ffffff', '#111111'],
].map(([primary, accent, background, text]) => ({ primary, accent, background, text }));

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

function hasLegacyNeutralPalette(page?: CompanyPageConfig | null) {
  if (!page?.theme) return true;
  return paletteMatches(page.theme, { primary: '#111111', accent: '#555555', background: '#ffffff', text: '#171717' });
}

function paletteIsKnownPreset(page?: CompanyPageConfig | null) {
  if (!page?.theme) return true;
  return Object.values(COMPANY_PAGE_THEME_PRESETS).some((preset) => paletteMatches(page.theme, preset.theme))
    || LEGACY_EXTRA_PALETTES.some((palette) => paletteMatches(page.theme, palette));
}

function shouldUseSelectedThemePreset(page?: CompanyPageConfig | null) {
  return hasLegacyNeutralPalette(page) || paletteIsKnownPreset(page);
}

function institutionalKey(value?: string) {
  if (value === 'atlas' || value === 'pulse' || value === 'canvas' || value === 'noir' || value === 'aurora') return value;
  if (value === 'institucional') return 'atlas';
  if (value === 'vitrine') return 'pulse';
  if (value === 'editorial') return 'canvas';
  return 'aurora';
}

export function applyCompanyThemePreset(config: CompanyPageConfig, key: string): CompanyPageConfig {
  if (isExtraCompanyTheme(key)) return applyExtraCompanyThemePreset(config, key);
  if (key === 'aurora' || key === 'atlas' || key === 'pulse' || key === 'canvas' || key === 'noir') {
    return applyInstitutionalThemePreset(config, key);
  }
  return config;
}

export function CompanySiteRenderer({ company, jobs, page, preview = false }: { company: PublicCompanyLike; jobs: PublicJobLike[]; page?: CompanyPageConfig | null; preview?: boolean }) {
  const config = page || {};
  const key = String(config.templateKey || 'aurora');

  if (isExtraCompanyTheme(key) && config.editorMode !== 'code') {
    const visualPage = shouldUseSelectedThemePreset(config) ? applyExtraCompanyThemePreset(config, key) : config;
    return <ExtraCompanyThemeRenderer themeKey={key} company={company} jobs={jobs} config={visualPage} preview={preview} />;
  }

  const visualPage = config.editorMode === 'code'
    ? config
    : shouldUseSelectedThemePreset(config)
      ? applyInstitutionalThemePreset(config, institutionalKey(key))
      : config;

  return <InstitutionalCompanySiteRenderer company={company} jobs={jobs} page={visualPage} preview={preview} />;
}
