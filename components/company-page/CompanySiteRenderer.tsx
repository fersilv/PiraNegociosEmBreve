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

import { ThemeDispatcher, THEME_CATALOG, THEME_CATEGORY_LABELS, THEME_TIER_LABELS, THEME_PRESETS, applyThemePreset, resolveThemeKey } from './themes';
import type { ThemeKey, ThemeTier, ThemeCategory, ThemeCatalogItem } from './themes';

export type {
  CompanyEditorMode,
  CompanyPageConfig,
  CompanyPageSection,
  CompanyPageWidth,
  CompanyTypography,
  PublicCompanyLike,
  PublicJobLike,
  ThemeKey as CompanyTemplateKey,
  ThemeCatalogItem as CompanyThemeCatalogItem,
};

// Aliases for backward compatibility in the builder UI
export const COMPANY_PAGE_THEME_CATEGORIES = THEME_CATEGORY_LABELS;
export const COMPANY_PAGE_TEMPLATES = {
  map(callback: (template: ThemeCatalogItem, index: number, array: ThemeCatalogItem[]) => React.ReactNode): React.ReactNode[] {
    const output: React.ReactNode[] = [];
    THEME_CATEGORY_LABELS.forEach((category) => {
      const items = THEME_CATALOG.filter((t) => t.category === category.id);
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
      items.forEach((template) => output.push(callback(template, THEME_CATALOG.indexOf(template), THEME_CATALOG)));
    });
    return output;
  },
};

export const COMPANY_PAGE_THEME_PRESETS = THEME_PRESETS;
export { applyThemePreset as applyCompanyThemePreset };
export { resolveThemeKey as institutionalKey };

// Helper from the old file to detect if it's a commerce theme (vitrine, bazar, portal)
export function isCommerceCompanyTheme(key: string): boolean {
  return key === 'vitrine' || key === 'bazar' || key === 'portal' || key === 'loja' || key === 'marketplace' || key === 'catalogo' || key === 'classificados-pro' || key === 'mercado' || key === 'gazeta' || key === 'mosaico' || key === 'radar' || key === 'pregao';
}

function PlatformFooter() {
  return (
    <div className="pn-platform-footer relative z-[60]">
      <style>{`
        .pn-company-renderer .pn-rendered-theme footer a[href="/"]{display:none!important}
        .pn-platform-footer{display:flex;align-items:center;justify-content:center;gap:9px;min-height:54px;padding:12px 20px;background:#fff;color:#78716c;font:600 11px/1.2 Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:.02em}
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

  // For backward compatibility: if it's the old custom code editor mode
  if (config.editorMode === 'code') {
    return (
      <div className="pn-company-renderer">
        <div className="pn-rendered-theme">
          <LegacyCompanySiteRenderer company={company} jobs={jobs} page={config} preview={preview} />
        </div>
        <PlatformFooter />
      </div>
    );
  }

  // Modern theme dispatcher
  return (
    <div className="pn-company-renderer relative">
      <div className="pn-rendered-theme">
        <ThemeDispatcher company={company} jobs={jobs} config={config} preview={preview} />
      </div>
      <PlatformFooter />
    </div>
  );
}
