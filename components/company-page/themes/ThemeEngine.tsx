import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Building2,
  ChevronRight,
  ExternalLink,
  Facebook,
  Globe2,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Music2,
  Phone,
  Search,
  Sparkles,
  Youtube,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type {
  CompanyPageConfig,
  CompanyPageSection,
  CompanyPageCategoryLink,
} from '../CompanyPageExtensions';
import type {
  CompanyPageWidth,
  CompanyTypography,
  PublicCompanyLike,
  PublicJobLike,
} from '../PremiumCompanySiteRenderer';
import { CompanyClassifiedsShowcase } from '../CompanyClassifiedsShowcase';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ThemeKey =
  // Normal (10)
  | 'horizon' | 'monument' | 'vitrine' | 'bazar' | 'sabor'
  | 'oficio' | 'atelie' | 'neon' | 'flora' | 'pulse-ev'
  // Premium (5)
  | 'empire' | 'studio-pro' | 'gourmet' | 'runway' | 'portal'
  // Dynamic (5)
  | 'cosmos' | 'festival' | 'matrix' | 'aurora-dyn' | 'cinema';

export type ThemeTier = 'normal' | 'premium' | 'dynamic';
export type ThemeCategory = 'institutional' | 'commerce' | 'food' | 'services' | 'fashion' | 'tech' | 'nature' | 'events' | 'creative' | 'universal';

export interface ThemeCatalogItem {
  key: ThemeKey;
  name: string;
  tier: ThemeTier;
  category: ThemeCategory;
  eyebrow: string;
  description: string;
  bestFor: string;
  palette: ThemePalette;
}

export interface ThemePalette {
  primary: string;
  accent: string;
  background: string;
  text: string;
}

export interface ThemePreset {
  palette: ThemePalette;
  width: CompanyPageWidth;
  typography: CompanyTypography;
  corners: 'square' | 'soft' | 'round';
  logoSize: 'small' | 'medium' | 'large';
  heroLayout: 'split' | 'centered' | 'cover' | 'minimal';
  jobsLayout: 'list' | 'grid' | 'compact';
  navSticky: boolean;
  navTransparent: boolean;
}

export type InternalPageType = 'job-detail' | 'classified-detail' | null;

export interface ThemeContextValue {
  themeKey: ThemeKey;
  company: PublicCompanyLike;
  jobs: PublicJobLike[];
  config: CompanyPageConfig;
  preset: ThemePreset;
  visual: ThemePalette;
  radius: string;
  fontClass: string;
  isDark: boolean;
  preview: boolean;
  // Internal page navigation
  internalPage: InternalPageType;
  internalData: any;
  openInternalPage: (type: InternalPageType, data?: any) => void;
  closeInternalPage: () => void;
}

// ─── Context ────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function ThemeProvider({
  themeKey,
  company,
  jobs,
  config,
  preset,
  preview = false,
  children,
}: {
  themeKey: ThemeKey;
  company: PublicCompanyLike;
  jobs: PublicJobLike[];
  config: CompanyPageConfig;
  preset: ThemePreset;
  preview?: boolean;
  children: React.ReactNode;
}) {
  const [internalPage, setInternalPage] = useState<InternalPageType>(null);
  const [internalData, setInternalData] = useState<any>(null);

  const visual = resolveVisual(config, preset);
  const radius = resolveRadius(config, preset);
  const fontClass = resolveFontClass(config, preset);
  const isDark = isDarkBackground(visual.background);

  const openInternalPage = useCallback((type: InternalPageType, data?: any) => {
    setInternalPage(type);
    setInternalData(data || null);
  }, []);

  const closeInternalPage = useCallback(() => {
    setInternalPage(null);
    setInternalData(null);
  }, []);

  const value: ThemeContextValue = {
    themeKey, company, jobs, config, preset, visual, radius, fontClass, isDark, preview,
    internalPage, internalData, openInternalPage, closeInternalPage,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── CSS Custom Properties Wrapper ──────────────────────────────────────────

export function ThemeRoot({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { visual, radius, fontClass, themeKey } = useTheme();
  return (
    <div
      className={`${fontClass} min-h-screen overflow-hidden ${className}`}
      data-pn-theme={themeKey}
      style={{
        background: visual.background,
        color: visual.text,
        ['--brand' as any]: visual.primary,
        ['--accent' as any]: visual.accent,
        ['--paper' as any]: visual.background,
        ['--ink' as any]: visual.text,
        ['--radius' as any]: radius,
      }}
    >
      <ThemeGlobalCss />
      {children}
    </div>
  );
}

function ThemeGlobalCss() {
  return <style>{`
    [data-pn-theme] { -webkit-font-smoothing: antialiased; }
    [data-pn-theme] .pn-r { border-radius: var(--radius); }
    [data-pn-theme] .pn-cover-img { object-position: var(--cover-pos, center); filter: brightness(var(--cover-bright, 1)); }
    [data-pn-theme] a { color: inherit; text-decoration: none; }
    [data-pn-theme] .pn-brand-bg { background: var(--brand); color: ${contrastText('var(--brand)')}; }
    [data-pn-theme] .pn-accent-bg { background: var(--accent); }
    @keyframes pnFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
    @keyframes pnGlow { 0%,100%{opacity:.4} 50%{opacity:1} }
    @keyframes pnSlide { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
    @keyframes pnPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
    @keyframes pnBlob1 { 0%,100%{transform:translate(-8%,-8%) scale(1)} 45%{transform:translate(28%,18%) scale(1.25)} 75%{transform:translate(5%,35%) scale(.92)} }
    @keyframes pnBlob2 { 0%,100%{transform:translate(12%,20%) scale(.9)} 40%{transform:translate(-22%,-5%) scale(1.2)} 72%{transform:translate(25%,-22%) scale(1.05)} }
    @keyframes pnMarquee { 0%{transform:translateX(0)} 100%{transform:translateX(-100%)} }
    @keyframes pnFadeIn { 0%{opacity:0;transform:translateY(20px)} 100%{opacity:1;transform:translateY(0)} }
    @keyframes pnGlitch { 0%{clip-path:inset(40% 0 61% 0)} 20%{clip-path:inset(92% 0 1% 0)} 40%{clip-path:inset(43% 0 1% 0)} 60%{clip-path:inset(25% 0 58% 0)} 80%{clip-path:inset(54% 0 7% 0)} 100%{clip-path:inset(58% 0 43% 0)} }
    @keyframes pnScanline { 0%{top:-100%} 100%{top:100%} }
    @keyframes pnShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  `}</style>;
}

// ─── Shared Layout Components ───────────────────────────────────────────────

export function Shell({ width, fallback = 'wide', className = '', children }: {
  width?: CompanyPageWidth;
  fallback?: CompanyPageWidth;
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`mx-auto w-full ${widthClass(width, fallback)} px-5 sm:px-8 ${className}`}>{children}</div>;
}

export function Eyebrow({ children, light = false, className = '' }: {
  children: React.ReactNode;
  light?: boolean;
  className?: string;
}) {
  return <div className={`text-[10px] font-black uppercase tracking-[.24em] ${light ? 'text-white/55' : 'opacity-45'} ${className}`}>{children}</div>;
}

export function SectionDivider({ dark = false }: { dark?: boolean }) {
  return <div className={`h-px ${dark ? 'bg-white/10' : 'bg-current/12'}`} />;
}

// ─── Company Identity Components ────────────────────────────────────────────

export function CompanyLogo({ large = false, className = '' }: { large?: boolean; className?: string }) {
  const { company, config, preset } = useTheme();
  const selected = config.branding?.logoSize || preset.logoSize;
  const size = large
    ? selected === 'small' ? 'h-16 w-16' : selected === 'medium' ? 'h-20 w-20' : 'h-24 w-24'
    : selected === 'small' ? 'h-8 w-8' : selected === 'large' ? 'h-12 w-12' : 'h-10 w-10';
  const corner = config.branding?.corners === 'square' ? 'rounded-none' : config.branding?.corners === 'round' ? 'rounded-full' : 'pn-r';
  if (company.logoURL) return <img src={company.logoURL} alt={`Logo ${company.name || ''}`} className={`${size} ${corner} shrink-0 object-contain ${className}`} />;
  return <span className={`${size} ${corner} inline-flex shrink-0 items-center justify-center border border-current/15 ${className}`}><Building2 className="h-5 w-5 opacity-40" /></span>;
}

export function VerifiedBadge({ inverted = false }: { inverted?: boolean }) {
  const { company } = useTheme();
  if (!(company.isVerified || company.verificationStatus === 'VERIFIED')) return null;
  return (
    <span
      title="Empresa verificada pelo PiraNegócios"
      aria-label="Empresa verificada pelo PiraNegócios"
      className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full"
      style={{
        color: inverted ? '#fff' : '#059669',
        background: inverted ? 'rgba(255,255,255,.12)' : 'rgba(16,185,129,.10)',
      }}
    >
      <BadgeCheck className="h-5 w-5" />
    </span>
  );
}

export function BrandPoster({ className = '' }: { className?: string }) {
  const { company, visual } = useTheme();
  return (
    <div
      className={`flex h-full min-h-[320px] items-center justify-center p-10 ${className}`}
      style={{ background: `radial-gradient(circle at 70% 20%,${visual.accent}88,transparent 26%),linear-gradient(135deg,${visual.primary},${visual.background})` }}
    >
      <div className="text-center">
        <CompanyLogo large />
        <div className="mt-5 text-3xl font-black">{company.name}</div>
      </div>
    </div>
  );
}

// ─── Hero Components ────────────────────────────────────────────────────────

export function heroCopy() {
  const { company, config } = useTheme();
  return {
    eyebrow: config.hero?.eyebrow || '',
    title: config.hero?.title || company.name || 'Sua empresa',
    text: config.hero?.subtitle || config.about?.text || company.description || '',
    button: config.hero?.jobsLabel || 'Ver oportunidades',
  };
}

export function HeroMedia({ className = '', minH = 420 }: { className?: string; minH?: number }) {
  const { company, config, visual } = useTheme();
  if (config.cover?.enabled && config.cover?.url) {
    return (
      <div
        className={`relative overflow-hidden pn-r ${className}`}
        style={{
          minHeight: minH,
          ['--cover-pos' as any]: config.cover.position || 'center',
          ['--cover-bright' as any]: Math.max(.38, 1 - (Number(config.cover.overlay ?? 28) / 100) * .78),
        }}
      >
        <img src={config.cover.url} alt="" className="pn-cover-img absolute inset-0 h-full w-full object-cover" />
      </div>
    );
  }
  return <BrandPoster className={`pn-r ${className}`} />;
}

export function HeroActions({ centered = false, light = false }: { centered?: boolean; light?: boolean }) {
  const { visual } = useTheme();
  const copy = heroCopy();
  return (
    <div className={`mt-8 flex flex-wrap items-center gap-4 ${centered ? 'justify-center' : ''}`}>
      <a
        href="#vagas"
        className="inline-flex items-center gap-2 px-5 py-3 text-sm font-bold pn-r"
        style={{ background: light ? '#fff' : visual.primary, color: light ? '#111' : contrastText(visual.primary) }}
      >
        {copy.button}
        <ArrowRight className="h-4 w-4" />
      </a>
      <LocationPill light={light} />
    </div>
  );
}

function LocationPill({ light = false }: { light?: boolean }) {
  const { company } = useTheme();
  const loc = companyLocation(company);
  if (!loc) return null;
  return <span className={`inline-flex items-center gap-2 text-sm ${light ? 'text-white/55' : 'opacity-50'}`}><MapPin className="h-4 w-4" />{loc}</span>;
}

// ─── Section Components ─────────────────────────────────────────────────────

export function AboutSection({ className = '' }: { className?: string }) {
  const { company, config, isDark } = useTheme();
  const section = config.sections?.find(s => s.type === 'about');
  const text = config.about?.text || company.description;
  if (section?.enabled === false || !text) return null;
  return (
    <section id="sobre" className={`border-t border-current/12 py-16 sm:py-24 ${className}`}>
      <Eyebrow light={isDark}>{config.about?.title || 'Sobre'}</Eyebrow>
      <p className="mt-6 max-w-5xl text-2xl leading-[1.45] tracking-[-.025em] opacity-78 sm:text-3xl">{text}</p>
    </section>
  );
}

export function JobsSection({ className = '' }: { className?: string }) {
  const { jobs, config, isDark, visual, openInternalPage } = useTheme();
  const layout = config.jobs?.layout || 'grid';
  const title = config.jobs?.title || 'Oportunidades';
  const intro = config.jobs?.intro || 'Conheça as oportunidades abertas.';

  return (
    <section id="vagas" className={`border-t border-current/12 py-16 sm:py-24 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow light={isDark}>{title}</Eyebrow>
          <h2 className="mt-4 text-4xl font-black tracking-[-.05em] sm:text-6xl">
            {jobs.length ? `${jobs.length} ${jobs.length === 1 ? 'oportunidade' : 'oportunidades'}` : 'Novas oportunidades em breve'}
          </h2>
        </div>
        <p className="max-w-md text-sm leading-6 opacity-50">{intro}</p>
      </div>
      {!jobs.length ? (
        <div className="mt-10 border-y border-current/12 py-10 text-sm opacity-50">Nenhuma vaga aberta neste momento.</div>
      ) : layout === 'grid' ? (
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {jobs.map((job, i) => (
            <button
              key={job.id || job.slug || i}
              type="button"
              onClick={() => openInternalPage('job-detail', job)}
              className="group min-h-[210px] border border-current/12 p-6 text-left transition hover:-translate-y-1 hover:shadow-lg pn-r"
              style={{ background: `${visual.background}cc` }}
            >
              <div className="flex justify-between text-[10px] uppercase tracking-[.18em] opacity-35">
                <span>{String(i + 1).padStart(2, '0')}</span>
                <ExternalLink className="h-4 w-4" />
              </div>
              <h3 className="mt-12 text-2xl font-black tracking-[-.035em]">{job.title || 'Oportunidade'}</h3>
              <JobMeta job={job} />
            </button>
          ))}
        </div>
      ) : layout === 'compact' ? (
        <div className="mt-10 divide-y divide-current/12">
          {jobs.map((job, i) => (
            <button
              key={job.id || job.slug || i}
              type="button"
              onClick={() => openInternalPage('job-detail', job)}
              className="group grid w-full gap-2 py-4 text-left sm:grid-cols-[48px_1fr_auto] sm:items-center"
            >
              <span className="text-[10px] opacity-30">{String(i + 1).padStart(2, '0')}</span>
              <div><b>{job.title || 'Oportunidade'}</b><JobMeta job={job} /></div>
              <ArrowRight className="h-4 w-4 opacity-35 transition group-hover:translate-x-1" />
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-10 divide-y divide-current/12">
          {jobs.map((job, i) => (
            <button
              key={job.id || job.slug || i}
              type="button"
              onClick={() => openInternalPage('job-detail', job)}
              className="group grid w-full gap-4 py-6 text-left sm:grid-cols-[64px_1fr_auto] sm:items-center"
            >
              <span className="text-xs font-bold opacity-30">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3 className="text-xl font-bold">{job.title || 'Oportunidade'}</h3>
                <JobMeta job={job} />
              </div>
              <ArrowRight className="h-5 w-5 opacity-30 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function ContactSection({ className = '' }: { className?: string }) {
  const { company, config, isDark } = useTheme();
  const section = config.sections?.find(s => s.type === 'contact');
  if (section?.enabled === false) return null;
  const items = contactItems(company, config);
  if (!items.length) return null;
  return (
    <section id="contato" className={`border-t border-current/12 py-16 sm:py-20 ${className}`}>
      <Eyebrow light={isDark}>Contato</Eyebrow>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(item => (
          <a
            key={item.label}
            href={item.href || undefined}
            target={item.href.startsWith('http') ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="border border-current/12 p-5 transition hover:shadow-md pn-r"
          >
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.16em] opacity-40">{item.icon}{item.label}</div>
            <div className="mt-3 break-words font-semibold">{item.value}</div>
          </a>
        ))}
      </div>
    </section>
  );
}

export function SocialSection({ className = '' }: { className?: string }) {
  const { company, config } = useTheme();
  const section = config.sections?.find(s => s.type === 'socials');
  if (section?.enabled === false) return null;
  const items = socialItems(company, config);
  if (!items.length) return null;
  return (
    <section className={`border-t border-current/12 py-10 ${className}`}>
      <div className="flex flex-wrap gap-5">
        {items.map(item => (
          <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm opacity-60 transition hover:opacity-100">
            {item.icon}{item.label}
          </a>
        ))}
      </div>
    </section>
  );
}

export function LegalSection({ className = '' }: { className?: string }) {
  const { config } = useTheme();
  const section = config.sections?.find(s => s.type === 'legal');
  if (section?.enabled === false) return null;
  const entries = [
    config.legal?.termsEnabled && { title: config.legal.termsTitle || 'Termos de uso', body: config.legal.termsBody || '' },
    config.legal?.privacyEnabled && { title: config.legal.privacyTitle || 'Política de privacidade', body: config.legal.privacyBody || '' },
  ].filter(Boolean) as Array<{ title: string; body: string }>;
  if (!entries.length) return null;
  return (
    <section className={`border-t border-current/12 py-12 ${className}`}>
      <div className="grid gap-8 md:grid-cols-2">
        {entries.map(entry => (
          <details key={entry.title} className="border-b border-current/15 pb-5">
            <summary className="cursor-pointer font-bold">{entry.title}</summary>
            {entry.body && <p className="mt-4 whitespace-pre-wrap text-sm leading-7 opacity-60">{entry.body}</p>}
          </details>
        ))}
      </div>
    </section>
  );
}

export function CategoriesSection({ className = '' }: { className?: string }) {
  const { config, visual, isDark } = useTheme();
  if (config.categories?.enabled === false) return null;
  const items = config.categories?.items?.length ? config.categories.items : [
    { id: 'sobre', label: 'Sobre', href: '#sobre' },
    { id: 'vagas', label: 'Vagas', href: '#vagas' },
    { id: 'contato', label: 'Contato', href: '#contato' },
  ];
  return (
    <section className={`py-5 sm:py-7 ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        {config.categories?.title && <span className="mr-2 text-[10px] font-black uppercase tracking-[.2em] opacity-40">{config.categories.title}</span>}
        {items.map((item, index) => {
          const external = /^https?:\/\//i.test(item.href || '');
          return (
              <a
              key={item.id || item.label || index}
              href={item.href || '#'}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              className="inline-flex items-center gap-2 border border-current/12 px-4 py-2 text-xs font-bold transition hover:shadow-sm pn-r"
              style={{ background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.7)', color: isDark ? undefined : '#1f2937' }}
            >
              {item.imageUrl && <img src={item.imageUrl} alt="" className="h-5 w-5 rounded-full object-cover" />}
              {item.label}
              <ArrowRight className="h-3 w-3 opacity-45" />
            </a>
          );
        })}
      </div>
    </section>
  );
}

export function StorefrontSection({ className = '' }: { className?: string }) {
  const { company, isDark, openInternalPage } = useTheme();
  return (
    <section id="vitrine" className={`py-12 sm:py-16 ${className}`}>
      <CompanyClassifiedsShowcase 
        companyId={company.id} 
        companyName={company.name} 
        variant={isDark ? 'store' : 'default'} 
        onItemClick={(item) => openInternalPage('classified-detail', item)}
      />
    </section>
  );
}

export function ThemeFooter({ className = '' }: { className?: string }) {
  const { company, config, preview, isDark } = useTheme();
  return (
    <Shell>
      <footer className={`flex flex-col gap-3 border-t py-7 text-xs sm:flex-row sm:justify-between ${isDark ? 'border-white/10 text-white/40' : 'border-current/12 opacity-55'} ${className}`}>
        <span>{config.footer?.text || `© ${new Date().getFullYear()} ${company.name || 'Empresa'}`}</span>
        <Link to="/" className="underline underline-offset-4">{preview ? 'Prévia privada · ' : ''}PiraNegócios Business</Link>
      </footer>
    </Shell>
  );
}

// ─── Navigation ─────────────────────────────────────────────────────────────

export function ThemeNavigation({ variant = 'default' }: { variant?: 'default' | 'dark' | 'editorial' | 'transparent' }) {
  const { company, config, visual, isDark } = useTheme();
  if (config.navigation?.enabled === false) return null;
  const sticky = config.navigation?.sticky !== false;
  const transparent = Boolean(config.navigation?.transparent);

  const bgStyle = transparent
    ? 'transparent'
    : variant === 'dark' || isDark
      ? 'rgba(3,5,10,.82)'
      : `${visual.background}e8`;

  const borderColor = isDark ? 'rgba(255,255,255,.12)' : 'color-mix(in srgb, currentColor 14%, transparent)';

  return (
    <nav
      className={`${sticky ? 'sticky top-0 z-50' : 'relative z-30'} border-b backdrop-blur-xl`}
      style={{ borderColor, background: bgStyle }}
    >
      <Shell>
        <div className={`flex min-h-16 items-center gap-3 ${variant === 'editorial' ? 'sm:min-h-20' : ''}`}>
          <CompanyLogo />
          <div className="min-w-0">
            <div className={`truncate font-bold ${variant === 'editorial' ? 'font-serif text-lg' : 'text-sm'}`}>{company.name}</div>
          </div>
          <VerifiedBadge inverted={isDark} />
          <div className="ml-auto hidden items-center gap-6 text-[10px] font-bold uppercase tracking-[.16em] opacity-55 md:flex">
            <a href="#sobre">Sobre</a>
            <a href="#vagas">{config.navigation?.jobsLabel || 'Vagas'}</a>
            <a href="#contato">Contato</a>
          </div>
          <a href="#vagas" className="ml-auto inline-flex items-center gap-2 border px-4 py-2 text-xs font-bold md:ml-2 pn-r" style={{ borderColor: visual.primary }}>
            {config.navigation?.jobsLabel || 'Vagas'} <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </Shell>
    </nav>
  );
}

// ─── Section Stream (renders sections in order) ─────────────────────────────

export function SectionStream() {
  const { config } = useTheme();
  const DEFAULT: CompanyPageSection[] = [
    { id: 'categories', type: 'categories', enabled: true },
    { id: 'classifieds', type: 'classifieds', enabled: true },
    { id: 'about', type: 'about', enabled: true },
    { id: 'jobs', type: 'jobs', enabled: true },
    { id: 'contact', type: 'contact', enabled: true },
    { id: 'socials', type: 'socials', enabled: true },
    { id: 'legal', type: 'legal', enabled: true },
  ];
  const sections = (Array.isArray(config.sections) && config.sections.length ? config.sections : DEFAULT)
    .filter(s => s.type !== 'identity' && s.enabled !== false);

  return (
    <Shell>
      {sections.map(section => {
        switch (section.type) {
          case 'categories': return <CategoriesSection key={section.id} />;
          case 'classifieds': return <StorefrontSection key={section.id} />;
          case 'about': return <AboutSection key={section.id} />;
          case 'jobs': return <JobsSection key={section.id} />;
          case 'contact': return <ContactSection key={section.id} />;
          case 'socials': return <SocialSection key={section.id} />;
          case 'legal': return <LegalSection key={section.id} />;
          default: return null;
        }
      })}
    </Shell>
  );
}

// ─── Internal Pages (Job Detail & Classified Detail within theme) ───────────

export function InternalPageOverlay() {
  const { internalPage, internalData, closeInternalPage, visual, isDark, company } = useTheme();
  if (!internalPage) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: visual.background, color: visual.text }}>
      {/* Back nav */}
      <div className="border-b backdrop-blur-xl" style={{ borderColor: isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)', background: isDark ? 'rgba(5,7,12,.92)' : `${visual.background}f2` }}>
        <Shell>
          <div className="flex min-h-14 items-center gap-3">
            <button type="button" onClick={closeInternalPage} className="inline-flex items-center gap-2 text-sm font-bold opacity-70 hover:opacity-100">
              <ArrowLeft className="h-4 w-4" /> Voltar para {company.name}
            </button>
            <div className="ml-auto">
              <CompanyLogo />
            </div>
          </div>
        </Shell>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {internalPage === 'job-detail' && <JobDetailPage job={internalData} />}
        {internalPage === 'classified-detail' && <ClassifiedDetailPage classified={internalData} />}
      </div>
    </div>
  );
}

function JobDetailPage({ job }: { job: PublicJobLike }) {
  const { company, visual, isDark, config } = useTheme();
  if (!job) return null;
  const loc = job.location || [job.city, job.state].filter(Boolean).join(', ') || 'Local a combinar';

  return (
    <Shell className="py-12 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <Eyebrow light={isDark}>Oportunidade</Eyebrow>
        <h1 className="mt-4 text-4xl font-black tracking-[-.04em] sm:text-6xl">{job.title || 'Oportunidade'}</h1>
        <div className="mt-6 flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-current/12 px-4 py-2 text-xs font-bold">
            <MapPin className="h-3.5 w-3.5" />{loc}
          </span>
          {job.type && <span className="inline-flex items-center gap-2 rounded-full border border-current/12 px-4 py-2 text-xs font-bold"><Briefcase className="h-3.5 w-3.5" />{job.type}</span>}
          {job.workModel && <span className="rounded-full border border-current/12 px-4 py-2 text-xs font-bold">{job.workModel}</span>}
          {job.salary && <span className="rounded-full px-4 py-2 text-xs font-black" style={{ background: visual.primary, color: contrastText(visual.primary) }}>{job.salary}</span>}
        </div>

        <div className="mt-12 rounded-2xl border border-current/12 p-8">
          <h2 className="text-lg font-black">Sobre a empresa</h2>
          <div className="mt-4 flex items-center gap-4">
            <CompanyLogo />
            <div>
              <p className="font-bold">{company.name}</p>
              <p className="text-sm opacity-55">{companyLocation(company)}</p>
            </div>
            <VerifiedBadge />
          </div>
          {(config.about?.text || company.description) && <p className="mt-6 text-sm leading-7 opacity-65">{config.about?.text || company.description}</p>}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {job.slug && (
            <Link
              to={`/vagas/${job.slug}`}
              className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-black pn-r"
              style={{ background: visual.primary, color: contrastText(visual.primary) }}
            >
              Candidatar-se <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          <a href="#contato" className="inline-flex items-center gap-2 border border-current/12 px-6 py-3.5 text-sm font-bold pn-r">
            Contatar empresa
          </a>
        </div>
      </div>
    </Shell>
  );
}

function ClassifiedDetailPage({ classified }: { classified: any }) {
  const { company, visual, isDark } = useTheme();
  if (!classified) return null;

  return (
    <Shell className="py-12 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <Eyebrow light={isDark}>Produto / Serviço</Eyebrow>
        <h1 className="mt-4 text-4xl font-black tracking-[-.04em] sm:text-5xl">{classified.title || 'Anúncio'}</h1>
        {classified.price && <p className="mt-4 text-2xl font-black" style={{ color: visual.primary }}>{classified.price}</p>}
        {classified.description && <p className="mt-6 text-lg leading-8 opacity-65">{classified.description}</p>}
        <div className="mt-8 flex items-center gap-4">
          <CompanyLogo />
          <div>
            <p className="font-bold">{company.name}</p>
            <VerifiedBadge />
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ─── Meta Components ────────────────────────────────────────────────────────

export function JobMeta({ job }: { job: PublicJobLike }) {
  const loc = job.location || [job.city, job.state].filter(Boolean).join(', ') || 'Local a combinar';
  return <p className="mt-2 text-sm opacity-45">{loc}{job.workModel ? ` · ${job.workModel}` : ''}{job.salary ? ` · ${job.salary}` : ''}</p>;
}

// ─── Utility Functions ──────────────────────────────────────────────────────

export function resolveVisual(config: CompanyPageConfig, preset: ThemePreset): ThemePalette {
  return {
    primary: config.theme?.primary || preset.palette.primary,
    accent: config.theme?.accent || preset.palette.accent,
    background: config.theme?.background || preset.palette.background,
    text: config.theme?.text || preset.palette.text,
  };
}

export function resolveRadius(config: CompanyPageConfig, preset: ThemePreset): string {
  const corners = config.branding?.corners || preset.corners;
  return corners === 'square' ? '0px' : corners === 'round' ? '36px' : '18px';
}

export function resolveFontClass(config: CompanyPageConfig, preset: ThemePreset): string {
  const t = config.branding?.typography || preset.typography;
  return t === 'editorial' ? 'font-serif' : t === 'technical' ? 'font-mono' : 'font-sans';
}

export function contrastText(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6 || !/^[0-9a-f]{6}$/i.test(clean)) return '#fff';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111' : '#fff';
}

export function isDarkBackground(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length !== 6 || !/^[0-9a-f]{6}$/i.test(clean)) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

export function normalizeUrl(value?: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return /^(https?:|mailto:|tel:)/i.test(raw) ? raw : `https://${raw}`;
}

export function companyLocation(company: PublicCompanyLike): string {
  return company.address || company.cityState || [company.city, company.state].filter(Boolean).join(', ');
}

export function widthClass(width?: CompanyPageWidth, fallback: CompanyPageWidth = 'wide'): string {
  const v = width || fallback;
  if (v === 'compact') return 'max-w-4xl';
  if (v === 'standard') return 'max-w-6xl';
  if (v === 'full') return 'max-w-none';
  return 'max-w-[1420px]';
}

export function coverUrl(config: CompanyPageConfig): string {
  return config.cover?.enabled && config.cover?.url ? config.cover.url : '';
}

function contactItems(company: PublicCompanyLike, config: CompanyPageConfig) {
  const phone = config.contacts?.phone || company.phone || '';
  const second = config.contacts?.secondaryPhone || '';
  const whatsapp = config.contacts?.whatsapp || '';
  const email = config.contacts?.email || '';
  const website = config.contacts?.website || company.website || '';
  const loc = companyLocation(company);
  return [
    phone && { label: 'Telefone', value: phone, href: `tel:${phone.replace(/\D/g, '')}`, icon: <Phone className="h-4 w-4" /> },
    second && { label: 'Telefone 2', value: second, href: `tel:${second.replace(/\D/g, '')}`, icon: <Phone className="h-4 w-4" /> },
    whatsapp && { label: 'WhatsApp', value: whatsapp, href: `https://wa.me/55${whatsapp.replace(/\D/g, '')}`, icon: <Phone className="h-4 w-4" /> },
    email && { label: 'E-mail', value: email, href: `mailto:${email}`, icon: <Mail className="h-4 w-4" /> },
    website && { label: 'Site', value: website, href: normalizeUrl(website), icon: <Globe2 className="h-4 w-4" /> },
    loc && { label: 'Endereço', value: loc, href: '', icon: <MapPin className="h-4 w-4" /> },
  ].filter(Boolean) as Array<{ label: string; value: string; href: string; icon: React.ReactNode }>;
}

function socialItems(company: PublicCompanyLike, config: CompanyPageConfig) {
  return [
    ['Instagram', config.socials?.instagram || company.socialInstagram, <Instagram className="h-4 w-4" />],
    ['LinkedIn', config.socials?.linkedin || company.socialLinkedin, <Linkedin className="h-4 w-4" />],
    ['Facebook', config.socials?.facebook || company.socialFacebook, <Facebook className="h-4 w-4" />],
    ['YouTube', config.socials?.youtube, <Youtube className="h-4 w-4" />],
    ['TikTok', config.socials?.tiktok, <Music2 className="h-4 w-4" />],
  ].filter(entry => Boolean(entry[1])).map(([label, href, icon]) => ({
    label: label as string,
    href: normalizeUrl(href as string),
    icon: icon as React.ReactNode,
  }));
}
