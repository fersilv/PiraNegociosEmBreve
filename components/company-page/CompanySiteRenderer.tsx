import React from 'react';
import {
  CompanySiteRenderer as InstitutionalCompanySiteRenderer,
  COMPANY_PAGE_TEMPLATES as INSTITUTIONAL_TEMPLATES,
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
} from './ExpandedCompanyThemes';
import type {
  CompanyThemeCatalogItem,
  CompanyThemeCategory,
  ExtraCompanyThemeKey,
} from './ExpandedCompanyThemes';

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

export const COMPANY_PAGE_TEMPLATES: CompanyThemeCatalogItem[] = [
  ...INSTITUTIONAL_TEMPLATES.map((template) => ({ ...template, category: 'institutional' as const })),
  ...EXTRA_COMPANY_PAGE_TEMPLATES,
];

export const COMPANY_PAGE_THEME_PRESETS = {
  ...EXTRA_THEME_PRESETS,
};

function normalizeHex(value?: string) {
  const color = String(value || '').trim().toLowerCase();
  if (color === '#fff') return '#ffffff';
  return color;
}

function hasLegacyNeutralPalette(page?: CompanyPageConfig | null) {
  if (!page?.theme) return true;
  return normalizeHex(page.theme.primary) === '#111111'
    && normalizeHex(page.theme.accent) === '#555555'
    && normalizeHex(page.theme.background) === '#ffffff'
    && normalizeHex(page.theme.text) === '#171717';
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
    const visualPage = hasLegacyNeutralPalette(config) ? applyExtraCompanyThemePreset(config, key) : config;
    return <ExtraCompanyThemeRenderer themeKey={key} company={company} jobs={jobs} config={visualPage} preview={preview} />;
  }

  const visualPage = config.editorMode === 'code'
    ? config
    : hasLegacyNeutralPalette(config)
      ? applyInstitutionalThemePreset(config, institutionalKey(key))
      : config;

  return <InstitutionalCompanySiteRenderer company={company} jobs={jobs} page={visualPage} preview={preview} />;
}
