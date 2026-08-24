import React from 'react';
import {
  CompanySiteRenderer as PremiumCompanySiteRenderer,
  applyCompanyThemePreset,
  type CompanyPageConfig,
  type PublicCompanyLike,
  type PublicJobLike,
} from './PremiumCompanySiteRenderer';

export * from './PremiumCompanySiteRenderer';

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

function normalizedThemeKey(value?: string) {
  if (value === 'atlas' || value === 'pulse' || value === 'canvas' || value === 'noir' || value === 'aurora') return value;
  if (value === 'institucional') return 'atlas';
  if (value === 'vitrine') return 'pulse';
  if (value === 'editorial') return 'canvas';
  return 'aurora';
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
  const visualPage = page?.editorMode === 'code'
    ? page
    : hasLegacyNeutralPalette(page)
      ? applyCompanyThemePreset(page || {}, normalizedThemeKey(String(page?.templateKey || 'aurora')))
      : page;

  return <PremiumCompanySiteRenderer company={company} jobs={jobs} page={visualPage} preview={preview} />;
}
