// ── Barrel exports for the new theme system ─────────────────────────────────

// Engine & shared
export {
  ThemeProvider,
  ThemeRoot,
  ThemeNavigation,
  SectionStream,
  ThemeFooter,
  InternalPageOverlay,
  useTheme,
  Shell,
  Eyebrow,
  CompanyLogo,
  VerifiedBadge,
  HeroActions,
  HeroMedia,
  BrandPoster,
  AboutSection,
  JobsSection,
  ContactSection,
  SocialSection,
  LegalSection,
  CategoriesSection,
  SectionDivider,
  JobMeta,
  heroCopy,
  resolveVisual,
  resolveRadius,
  resolveFontClass,
  contrastText,
  isDarkBackground,
  normalizeUrl,
  companyLocation,
  widthClass,
  coverUrl,
} from './ThemeEngine';
export type {
  ThemeKey,
  ThemeTier,
  ThemeCategory,
  ThemeCatalogItem,
  ThemePalette,
  ThemePreset,
  ThemeContextValue,
  InternalPageType,
} from './ThemeEngine';

// Registry
export {
  THEME_CATALOG,
  THEME_CATEGORY_LABELS,
  THEME_TIER_LABELS,
  THEME_PRESETS,
  THEME_MIGRATION_MAP,
  resolveThemeKey,
  getThemePreset,
  getThemeCatalogItem,
  isCommerceTheme,
  applyThemePreset,
} from './ThemeRegistry';

// Normal themes (10)
export {
  HorizonTheme,
  MonumentTheme,
  VitrineTheme,
  BazarTheme,
  SaborTheme,
  OficioTheme,
  AtelieTheme,
  NeonTheme,
  FloraTheme,
  PulseEvTheme,
} from './NormalThemes';

// Premium themes (5)
export {
  EmpireTheme,
  StudioProTheme,
  GourmetTheme,
  RunwayTheme,
  PortalTheme,
} from './premium/PremiumThemes';

// Dynamic themes (5)
export {
  CosmosTheme,
  FestivalTheme,
  MatrixTheme,
  AuroraDynTheme,
  CinemaTheme,
} from './dynamic/DynamicThemes';

// ── Theme Dispatcher ────────────────────────────────────────────────────────

import React from 'react';
import type { CompanyPageConfig } from '../CompanyPageExtensions';
import type { PublicCompanyLike, PublicJobLike } from '../PremiumCompanySiteRenderer';
import type { ThemeKey } from './ThemeEngine';
import { resolveThemeKey } from './ThemeRegistry';
import { HorizonTheme, MonumentTheme, VitrineTheme, BazarTheme, SaborTheme, OficioTheme, AtelieTheme, NeonTheme, FloraTheme, PulseEvTheme } from './NormalThemes';
import { EmpireTheme, StudioProTheme, GourmetTheme, RunwayTheme, PortalTheme } from './premium/PremiumThemes';
import { CosmosTheme, FestivalTheme, MatrixTheme, AuroraDynTheme, CinemaTheme } from './dynamic/DynamicThemes';

interface DispatcherProps {
  company: PublicCompanyLike;
  jobs: PublicJobLike[];
  config: CompanyPageConfig;
  preview?: boolean;
}

const THEME_COMPONENTS: Record<ThemeKey, React.FC<DispatcherProps>> = {
  // Normal
  horizon: HorizonTheme,
  monument: MonumentTheme,
  vitrine: VitrineTheme,
  bazar: BazarTheme,
  sabor: SaborTheme,
  oficio: OficioTheme,
  atelie: AtelieTheme,
  neon: NeonTheme,
  flora: FloraTheme,
  'pulse-ev': PulseEvTheme,
  // Premium
  empire: EmpireTheme,
  'studio-pro': StudioProTheme,
  gourmet: GourmetTheme,
  runway: RunwayTheme,
  portal: PortalTheme,
  // Dynamic
  cosmos: CosmosTheme,
  festival: FestivalTheme,
  matrix: MatrixTheme,
  'aurora-dyn': AuroraDynTheme,
  cinema: CinemaTheme,
};

export function ThemeDispatcher({ company, jobs, config, preview }: DispatcherProps) {
  const key = resolveThemeKey(config.templateKey);
  const Component = THEME_COMPONENTS[key] || HorizonTheme;
  return <Component company={company} jobs={jobs} config={config} preview={preview || false} />;
}
