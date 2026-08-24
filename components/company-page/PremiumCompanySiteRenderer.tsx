import React from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ExternalLink,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Music2,
  Phone,
  Youtube,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { FullPageCompanySandbox } from './FullPageCompanySandbox';

export type CompanyPageWidth = 'compact' | 'standard' | 'wide' | 'full';
export type CompanyTemplateKey = 'aurora' | 'atlas' | 'pulse' | 'canvas' | 'noir' | 'essencial' | 'institucional' | 'vitrine' | 'editorial';
export type CompanyEditorMode = 'visual' | 'code';
export type CompanyTypography = 'clean' | 'editorial' | 'technical' | 'human';
export type CompanyHeroLayout = 'split' | 'centered' | 'cover' | 'minimal';
export type CompanyJobsLayout = 'list' | 'grid' | 'compact';
type ModernTemplate = Exclude<CompanyTemplateKey, 'essencial' | 'institucional' | 'vitrine' | 'editorial'>;

export interface CompanyPageSection {
  id: string;
  type: 'identity' | 'about' | 'contact' | 'socials' | 'jobs' | 'legal' | string;
  enabled?: boolean;
  locked?: boolean;
}

export interface CompanyPageConfig {
  version?: number;
  editorMode?: CompanyEditorMode;
  templateKey?: CompanyTemplateKey | string;
  width?: CompanyPageWidth;
  theme?: { primary?: string; background?: string; text?: string; accent?: string };
  branding?: {
    typography?: CompanyTypography;
    logoSize?: 'small' | 'medium' | 'large';
    corners?: 'square' | 'soft' | 'round';
  };
  navigation?: {
    enabled?: boolean;
    sticky?: boolean;
    transparent?: boolean;
    jobsLabel?: string;
  };
  hero?: {
    layout?: CompanyHeroLayout;
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    jobsLabel?: string;
  };
  jobs?: {
    title?: string;
    intro?: string;
    layout?: CompanyJobsLayout;
  };
  footer?: { text?: string };
  cover?: { enabled?: boolean; url?: string; height?: 'small' | 'medium' | 'large'; position?: string; overlay?: number };
  about?: { title?: string; text?: string };
  contacts?: { phone?: string; secondaryPhone?: string; whatsapp?: string; email?: string; website?: string };
  socials?: { instagram?: string; linkedin?: string; facebook?: string; youtube?: string; tiktok?: string };
  legal?: { termsEnabled?: boolean; termsTitle?: string; termsBody?: string; privacyEnabled?: boolean; privacyTitle?: string; privacyBody?: string };
  sections?: CompanyPageSection[];
  codePage?: { html?: string; css?: string; js?: string };
  advanced?: { enabled?: boolean; html?: string; css?: string; js?: string };
}

export interface PublicCompanyLike {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  website?: string;
  address?: string;
  cityState?: string;
  city?: string;
  state?: string;
  phone?: string;
  logoURL?: string;
  socialInstagram?: string;
  socialLinkedin?: string;
  socialFacebook?: string;
  isVerified?: boolean;
  verificationStatus?: string;
}

export interface PublicJobLike {
  id?: string;
  slug?: string;
  title?: string;
  location?: string;
  city?: string;
  state?: string;
  type?: string;
  workModel?: string;
  salary?: string;
}

export const COMPANY_PAGE_TEMPLATES: Array<{
  key: ModernTemplate;
  name: string;
  description: string;
  eyebrow: string;
  bestFor: string;
}> = [
  { key: 'aurora', name: 'Aurora', eyebrow: 'Soft digital', description: 'Fluido e luminoso, com hero assimétrico, formas suaves e vagas em cards editoriais.', bestFor: 'Tecnologia, saúde, educação, serviços e startups' },
  { key: 'atlas', name: 'Atlas', eyebrow: 'Corporate grid', description: 'Institucional de verdade: masthead sóbrio, métricas, divisórias precisas e vagas em formato de listagem.', bestFor: 'Indústria, B2B, logística, consultorias e grandes empresas' },
  { key: 'pulse', name: 'Pulse', eyebrow: 'Campaign', description: 'Impacto de campanha: tipografia gigante, cor dominante, faixas gráficas e oportunidades com presença.', bestFor: 'Varejo, eventos, alimentação, esporte e marcas jovens' },
  { key: 'canvas', name: 'Canvas', eyebrow: 'Magazine', description: 'Composição de revista, serifas, imagem protagonista, índices e muito respiro.', bestFor: 'Moda, arquitetura, gastronomia, hotelaria e marcas autorais' },
  { key: 'noir', name: 'Noir', eyebrow: 'Future dark', description: 'Escuro e imersivo, com grid técnico, luzes atmosféricas e vagas em linguagem quase terminal.', bestFor: 'Tech, games, automotivo, audiovisual e marcas premium' },
];

interface ThemePreset {
  width: CompanyPageWidth;
  theme: Required<NonNullable<CompanyPageConfig['theme']>>;
  branding: Required<NonNullable<CompanyPageConfig['branding']>>;
  hero: Pick<NonNullable<CompanyPageConfig['hero']>, 'layout'>;
  jobs: Pick<NonNullable<CompanyPageConfig['jobs']>, 'layout'>;
  navigation: Pick<NonNullable<CompanyPageConfig['navigation']>, 'sticky' | 'transparent'>;
}

export const COMPANY_PAGE_THEME_PRESETS: Record<ModernTemplate, ThemePreset> = {
  aurora: {
    width: 'wide',
    theme: { primary: '#4f46e5', accent: '#22c1c3', background: '#f7f8fc', text: '#111827' },
    branding: { typography: 'clean', logoSize: 'large', corners: 'round' },
    hero: { layout: 'split' }, jobs: { layout: 'grid' }, navigation: { sticky: true, transparent: false },
  },
  atlas: {
    width: 'wide',
    theme: { primary: '#17392f', accent: '#b18b4b', background: '#f2efe7', text: '#1e2622' },
    branding: { typography: 'clean', logoSize: 'medium', corners: 'square' },
    hero: { layout: 'split' }, jobs: { layout: 'list' }, navigation: { sticky: true, transparent: false },
  },
  pulse: {
    width: 'full',
    theme: { primary: '#151515', accent: '#ff5b35', background: '#f0ff45', text: '#111111' },
    branding: { typography: 'human', logoSize: 'large', corners: 'round' },
    hero: { layout: 'centered' }, jobs: { layout: 'grid' }, navigation: { sticky: false, transparent: true },
  },
  canvas: {
    width: 'wide',
    theme: { primary: '#7f2f26', accent: '#bd9366', background: '#eee9df', text: '#2b2621' },
    branding: { typography: 'editorial', logoSize: 'medium', corners: 'square' },
    hero: { layout: 'minimal' }, jobs: { layout: 'list' }, navigation: { sticky: false, transparent: true },
  },
  noir: {
    width: 'wide',
    theme: { primary: '#8b5cf6', accent: '#22d3ee', background: '#050507', text: '#f5f5f5' },
    branding: { typography: 'technical', logoSize: 'medium', corners: 'soft' },
    hero: { layout: 'cover' }, jobs: { layout: 'compact' }, navigation: { sticky: true, transparent: true },
  },
};

export function applyCompanyThemePreset(config: CompanyPageConfig, key: ModernTemplate): CompanyPageConfig {
  const preset = COMPANY_PAGE_THEME_PRESETS[key];
  return {
    ...config,
    templateKey: key,
    width: preset.width,
    theme: { ...config.theme, ...preset.theme },
    branding: { ...config.branding, ...preset.branding },
    hero: { ...config.hero, ...preset.hero },
    jobs: { ...config.jobs, ...preset.jobs },
    navigation: { ...config.navigation, ...preset.navigation },
  };
}

const DEFAULT_SECTIONS: CompanyPageSection[] = [
  { id: 'identity', type: 'identity', enabled: true, locked: true },
  { id: 'about', type: 'about', enabled: true },
  { id: 'jobs', type: 'jobs', enabled: true, locked: true },
  { id: 'contact', type: 'contact', enabled: true },
  { id: 'socials', type: 'socials', enabled: true },
  { id: 'legal', type: 'legal', enabled: true },
];

function templateKey(value?: string): ModernTemplate {
  if (value === 'atlas' || value === 'pulse' || value === 'canvas' || value === 'noir' || value === 'aurora') return value;
  if (value === 'institucional') return 'atlas';
  if (value === 'vitrine') return 'pulse';
  if (value === 'editorial') return 'canvas';
  return 'aurora';
}

function normalizedUrl(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw;
  return `https://${raw}`;
}

function companyLocation(company: PublicCompanyLike) {
  return company.address || company.cityState || [company.city, company.state].filter(Boolean).join(', ');
}

function isVerified(company: PublicCompanyLike) {
  return Boolean(company.isVerified || company.verificationStatus === 'VERIFIED');
}

function withPageOverrides(company: PublicCompanyLike, config: CompanyPageConfig): PublicCompanyLike {
  return {
    ...company,
    phone: config.contacts?.phone || company.phone,
    website: config.contacts?.website || company.website,
    socialInstagram: config.socials?.instagram || company.socialInstagram,
    socialLinkedin: config.socials?.linkedin || company.socialLinkedin,
    socialFacebook: config.socials?.facebook || company.socialFacebook,
    description: config.about?.text || company.description,
  };
}

function widthClass(width: CompanyPageWidth = 'standard') {
  if (width === 'compact') return 'max-w-4xl';
  if (width === 'wide') return 'max-w-[1380px]';
  if (width === 'full') return 'max-w-none';
  return 'max-w-6xl';
}

function typographyClass(value: CompanyTypography = 'clean') {
  if (value === 'editorial') return 'font-serif';
  if (value === 'technical') return 'font-mono';
  return 'font-sans';
}

function radiusValue(value?: CompanyPageConfig['branding'] extends infer T ? any : never) {
  if (value === 'square') return '0px';
  if (value === 'round') return '34px';
  return '16px';
}

function visualStyle(config: CompanyPageConfig, preset: ThemePreset) {
  const primary = config.theme?.primary || preset.theme.primary;
  const accent = config.theme?.accent || preset.theme.accent;
  const background = config.theme?.background || preset.theme.background;
  const text = config.theme?.text || preset.theme.text;
  return {
    primary, accent, background, text,
    style: {
      '--brand': primary,
      '--accent': accent,
      '--paper': background,
      '--ink': text,
      '--radius': radiusValue(config.branding?.corners || preset.branding.corners),
    } as React.CSSProperties,
  };
}

function sections(config: CompanyPageConfig) {
  return (Array.isArray(config.sections) && config.sections.length ? config.sections : DEFAULT_SECTIONS)
    .filter((section) => section.type !== 'identity' && section.enabled !== false);
}

function hasSection(config: CompanyPageConfig, type: string) {
  return sections(config).some((section) => section.type === type);
}

export function CompanySiteRenderer({ company, jobs, page, preview = false }: { company: PublicCompanyLike; jobs: PublicJobLike[]; page?: CompanyPageConfig | null; preview?: boolean }) {
  const config = page || {};
  if (config.editorMode === 'code') {
    return <FullPageCompanySandbox company={withPageOverrides(company, config)} jobs={jobs} html={config.codePage?.html || ''} css={config.codePage?.css || ''} js={config.codePage?.js || ''} />;
  }
  const key = templateKey(String(config.templateKey || 'aurora'));
  const props = { company: withPageOverrides(company, config), jobs, config, preview };
  if (key === 'atlas') return <AtlasTheme {...props} />;
  if (key === 'pulse') return <PulseTheme {...props} />;
  if (key === 'canvas') return <CanvasTheme {...props} />;
  if (key === 'noir') return <NoirTheme {...props} />;
  return <AuroraTheme {...props} />;
}

type ThemeProps = { company: PublicCompanyLike; jobs: PublicJobLike[]; config: CompanyPageConfig; preview: boolean };

function AuroraTheme({ company, jobs, config, preview }: ThemeProps) {
  const preset = COMPANY_PAGE_THEME_PRESETS.aurora;
  const { style, primary, accent, background, text } = visualStyle(config, preset);
  const shell = widthClass(config.width || preset.width);
  const title = config.hero?.title || company.name || 'Sua empresa';
  const subtitle = config.hero?.subtitle || company.description || '';
  const location = companyLocation(company);
  const cover = Boolean(config.cover?.enabled && config.cover?.url);

  return (
    <div style={{ ...style, background, color: text }} className={`${typographyClass(config.branding?.typography || preset.branding.typography)} min-h-screen overflow-hidden`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] opacity-70" style={{ background: `radial-gradient(circle at 82% 15%, ${accent}44 0, transparent 34%), radial-gradient(circle at 18% 0%, ${primary}2e 0, transparent 38%)` }} />
      {config.navigation?.enabled !== false && (
        <nav className={`${config.navigation?.sticky !== false ? 'sticky top-4 z-50' : 'relative z-20'} mx-auto w-[calc(100%-24px)] ${shell} pt-4`}>
          <div className="flex items-center gap-4 rounded-full border border-white/70 bg-white/80 px-4 py-2.5 shadow-[0_14px_50px_rgba(15,23,42,.08)] backdrop-blur-xl">
            <CompanyLogo company={company} size="small" shape="round" />
            <span className="truncate text-sm font-extrabold tracking-tight">{company.name}</span><VerifiedSeal company={company} />
            <div className="ml-auto hidden gap-6 text-xs font-bold text-slate-500 sm:flex"><a href="#sobre">Sobre</a><a href="#vagas">{config.navigation?.jobsLabel || 'Vagas'}</a><a href="#contato">Contato</a></div>
            <a href="#vagas" className="ml-auto rounded-full px-4 py-2 text-xs font-bold text-white sm:ml-3" style={{ background: primary }}>Ver vagas</a>
          </div>
        </nav>
      )}

      <header id="top" className={`relative z-10 mx-auto grid min-h-[650px] w-full ${shell} items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:py-28`}>
        <div>
          {config.hero?.eyebrow && <p className="text-xs font-black uppercase tracking-[.22em]" style={{ color: primary }}>{config.hero.eyebrow}</p>}
          <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[.92] tracking-[-.055em] sm:text-7xl lg:text-[92px]">{title}</h1>
          {subtitle && <p className="mt-7 max-w-2xl text-lg leading-8 opacity-65">{subtitle}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-4"><a href="#vagas" className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white" style={{ background: primary }}>{config.hero?.jobsLabel || 'Ver oportunidades'}<ArrowRight className="h-4 w-4" /></a>{location && <span className="inline-flex items-center gap-2 text-sm opacity-55"><MapPin className="h-4 w-4" />{location}</span>}</div>
        </div>
        <div className="relative min-h-[420px]">
          <div className="absolute inset-6 rotate-3 rounded-[48px] opacity-45" style={{ background: `linear-gradient(145deg, ${accent}, ${primary})` }} />
          <div className="absolute inset-0 -rotate-2 overflow-hidden rounded-[44px] border border-white/70 bg-white shadow-[0_35px_100px_rgba(31,41,55,.16)]">
            {cover ? <img src={config.cover?.url} alt="" className="h-full w-full object-cover" style={{ objectPosition: config.cover?.position || 'center' }} /> : <div className="flex h-full flex-col justify-between p-8 sm:p-10" style={{ background: `linear-gradient(155deg, white 0%, ${background} 48%, ${accent}22 100%)` }}><CompanyLogo company={company} size="large" shape="soft" /><div><p className="text-xs font-black uppercase tracking-[.2em] opacity-40">Agora na equipe</p><p className="mt-3 text-5xl font-black tracking-[-.06em]">{jobs.length}</p><p className="mt-1 text-sm opacity-55">{jobs.length === 1 ? 'oportunidade aberta' : 'oportunidades abertas'}</p></div></div>}
          </div>
        </div>
      </header>

      <main className={`relative z-10 mx-auto w-full ${shell} px-5 sm:px-8`}>
        {sections(config).map((section) => {
          if (section.type === 'about' && company.description) return <AuroraAbout key={section.id} company={company} config={config} />;
          if (section.type === 'jobs') return <AuroraJobs key={section.id} jobs={jobs} config={config} />;
          if (section.type === 'contact') return <AuroraContact key={section.id} company={company} config={config} />;
          if (section.type === 'socials') return <SocialLinks key={section.id} company={company} config={config} variant="pills" />;
          if (section.type === 'legal') return <LegalSection key={section.id} config={config} />;
          return null;
        })}
      </main>
      <BusinessFooter company={company} config={config} preview={preview} shell={shell} />
    </div>
  );
}

function AuroraAbout({ company, config }: { company: PublicCompanyLike; config: CompanyPageConfig }) {
  return <section id="sobre" className="grid gap-10 border-t border-black/10 py-20 sm:py-28 lg:grid-cols-[.45fr_1.2fr]"><div><Kicker>{config.about?.title || 'Sobre'}</Kicker></div><p className="max-w-4xl text-2xl font-semibold leading-[1.35] tracking-[-.025em] sm:text-4xl">{company.description}</p></section>;
}

function AuroraJobs({ jobs, config }: { jobs: PublicJobLike[]; config: CompanyPageConfig }) {
  return <section id="vagas" className="py-20 sm:py-28"><SectionIntro config={config} /><div className="mt-10 grid gap-4 md:grid-cols-2">{jobs.length ? jobs.map((job) => <Link key={job.id || job.slug || job.title} to={jobHref(job)} className="group min-h-[210px] rounded-[var(--radius)] border border-black/10 bg-white/75 p-6 shadow-[0_14px_45px_rgba(15,23,42,.06)] transition hover:-translate-y-1"><div className="flex items-start justify-between gap-5"><span className="text-xs font-bold uppercase tracking-[.16em] opacity-35">Oportunidade</span><ExternalLink className="h-4 w-4 opacity-30 group-hover:opacity-100" /></div><h3 className="mt-10 text-2xl font-bold tracking-[-.035em]">{job.title || 'Oportunidade'}</h3><JobMeta job={job} /></Link>) : <EmptyJobs />}</div></section>;
}

function AuroraContact({ company, config }: { company: PublicCompanyLike; config: CompanyPageConfig }) {
  const items = contactItems(company, config);
  if (!items.length) return null;
  return <section id="contato" className="my-16 rounded-[var(--radius)] p-7 text-white sm:p-10" style={{ background: `linear-gradient(135deg, var(--brand), var(--accent))` }}><Kicker light>Contato</Kicker><div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <ContactItem key={item.label} item={item} light />)}</div></section>;
}

function AtlasTheme({ company, jobs, config, preview }: ThemeProps) {
  const preset = COMPANY_PAGE_THEME_PRESETS.atlas;
  const { style, background, text, primary } = visualStyle(config, preset);
  const shell = widthClass(config.width || preset.width);
  const title = config.hero?.title || company.name || 'Sua empresa';
  const subtitle = config.hero?.subtitle || company.description || '';
  const location = companyLocation(company);

  return <div style={{ ...style, background, color: text }} className={`${typographyClass(config.branding?.typography || preset.branding.typography)} min-h-screen`}>
    {config.navigation?.enabled !== false && <nav className={`${config.navigation?.sticky !== false ? 'sticky top-0 z-50' : ''} border-b border-current/15 bg-[var(--paper)]`}><div className={`mx-auto flex h-20 ${shell} items-center px-5 sm:px-8`}><div className="flex items-center gap-3"><CompanyLogo company={company} size="small" shape="square" /><span className="font-black uppercase tracking-[.08em]">{company.name}</span><VerifiedSeal company={company} /></div><div className="ml-auto hidden items-center gap-8 text-[11px] font-bold uppercase tracking-[.16em] opacity-60 md:flex"><a href="#sobre">Empresa</a><a href="#vagas">Oportunidades</a><a href="#contato">Contato</a></div></div></nav>}

    <header id="top" className={`mx-auto w-full ${shell} px-5 sm:px-8`}>
      <div className="grid min-h-[560px] border-x border-current/15 lg:grid-cols-[1.35fr_.65fr]">
        <div className="flex flex-col justify-end p-7 sm:p-12 lg:p-16"><div className="flex items-center gap-3"><span className="h-px w-12" style={{ background: primary }} /><span className="text-[11px] font-black uppercase tracking-[.22em]" style={{ color: primary }}>{config.hero?.eyebrow || 'Institucional'}</span></div><h1 className="mt-8 max-w-5xl text-5xl font-black uppercase leading-[.92] tracking-[-.045em] sm:text-7xl lg:text-[84px]">{title}</h1></div>
        <div className="flex flex-col justify-between border-t border-current/15 p-7 lg:border-l lg:border-t-0 lg:p-10"><div><p className="text-[11px] font-black uppercase tracking-[.18em] opacity-40">Perfil</p>{subtitle && <p className="mt-5 text-base leading-7 opacity-70">{subtitle}</p>}</div><div className="mt-12 space-y-3 text-sm"><div className="flex justify-between border-t border-current/15 pt-3"><span className="opacity-45">Local</span><span className="text-right font-semibold">{location || 'Não informado'}</span></div><div className="flex justify-between border-t border-current/15 pt-3"><span className="opacity-45">Vagas abertas</span><span className="font-semibold">{jobs.length}</span></div></div></div>
      </div>
      <div className="grid border-x border-b border-current/15 sm:grid-cols-3"><AtlasStat label="Oportunidades" value={String(jobs.length).padStart(2, '0')} /><AtlasStat label="Presença" value={company.state || 'BR'} /><AtlasStat label="Status" value={isVerified(company) ? 'VERIFICADA' : 'ATIVA'} /></div>
    </header>

    <main className={`mx-auto w-full ${shell} px-5 sm:px-8`}>
      {sections(config).map((section) => {
        if (section.type === 'about' && company.description) return <section key={section.id} id="sobre" className="grid border-x border-b border-current/15 lg:grid-cols-[.32fr_1fr]"><div className="p-7 sm:p-10"><Kicker>{config.about?.title || 'A empresa'}</Kicker></div><div className="border-t border-current/15 p-7 sm:p-10 lg:border-l lg:border-t-0"><p className="max-w-4xl text-xl leading-9 sm:text-3xl sm:leading-[1.45]">{company.description}</p></div></section>;
        if (section.type === 'jobs') return <AtlasJobs key={section.id} jobs={jobs} config={config} />;
        if (section.type === 'contact') return <AtlasContact key={section.id} company={company} config={config} />;
        if (section.type === 'socials') return <SocialLinks key={section.id} company={company} config={config} variant="plain" />;
        if (section.type === 'legal') return <LegalSection key={section.id} config={config} />;
        return null;
      })}
    </main>
    <BusinessFooter company={company} config={config} preview={preview} shell={shell} squared />
  </div>;
}

function AtlasStat({ label, value }: { label: string; value: string }) {
  return <div className="border-t border-current/15 p-6 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0"><p className="text-[10px] font-black uppercase tracking-[.18em] opacity-35">{label}</p><p className="mt-3 text-2xl font-black tracking-[-.04em]">{value}</p></div>;
}

function AtlasJobs({ jobs, config }: { jobs: PublicJobLike[]; config: CompanyPageConfig }) {
  return <section id="vagas" className="border-x border-b border-current/15"><div className="grid lg:grid-cols-[.32fr_1fr]"><div className="p-7 sm:p-10"><Kicker>{config.jobs?.title || 'Oportunidades'}</Kicker></div><div className="border-t border-current/15 lg:border-l lg:border-t-0">{jobs.length ? jobs.map((job, index) => <Link key={job.id || job.slug || job.title} to={jobHref(job)} className="group grid gap-4 border-b border-current/15 p-6 last:border-b-0 sm:grid-cols-[64px_1fr_auto] sm:items-center sm:p-8"><span className="text-xs font-black opacity-30">{String(index + 1).padStart(2, '0')}</span><div><h3 className="text-xl font-bold tracking-[-.025em]">{job.title || 'Oportunidade'}</h3><JobMeta job={job} /></div><ArrowRight className="h-5 w-5 opacity-30 transition group-hover:translate-x-1 group-hover:opacity-100" /></Link>) : <div className="p-8"><EmptyJobs /></div>}</div></div></section>;
}

function AtlasContact({ company, config }: { company: PublicCompanyLike; config: CompanyPageConfig }) {
  const items = contactItems(company, config);
  if (!items.length) return null;
  return <section id="contato" className="grid border-x border-b border-current/15 lg:grid-cols-[.32fr_1fr]"><div className="p-7 sm:p-10"><Kicker>Contato</Kicker></div><div className="grid border-t border-current/15 sm:grid-cols-2 lg:border-l lg:border-t-0">{items.map((item) => <div key={item.label} className="border-b border-current/15 p-6 sm:border-l sm:p-8"><ContactItem item={item} /></div>)}</div></section>;
}

function PulseTheme({ company, jobs, config, preview }: ThemeProps) {
  const preset = COMPANY_PAGE_THEME_PRESETS.pulse;
  const { style, background, text, primary, accent } = visualStyle(config, preset);
  const title = config.hero?.title || company.name || 'Sua empresa';
  const subtitle = config.hero?.subtitle || company.description || '';
  const cover = Boolean(config.cover?.enabled && config.cover?.url);
  const location = companyLocation(company);

  return <div style={{ ...style, background, color: text }} className={`${typographyClass(config.branding?.typography || preset.branding.typography)} min-h-screen overflow-hidden`}>
    {config.navigation?.enabled !== false && <nav className="relative z-30 flex items-center gap-4 px-5 py-5 sm:px-8"><CompanyLogo company={company} size="small" shape="round" /><span className="font-black uppercase tracking-tight">{company.name}</span><VerifiedSeal company={company} /><a href="#vagas" className="ml-auto rounded-full border-2 border-current px-5 py-2 text-xs font-black uppercase tracking-[.12em]">{config.navigation?.jobsLabel || 'Vagas'} ({jobs.length})</a></nav>}
    <header id="top" className="relative min-h-[720px] px-5 pb-16 pt-14 sm:px-8 sm:pt-20">
      <div className="pointer-events-none absolute -right-24 top-8 h-72 w-72 rounded-full border-[48px] border-current opacity-10 sm:h-[430px] sm:w-[430px]" />
      <div className="relative z-10 mx-auto max-w-[1500px]">
        <div className="flex items-center gap-3"><span className="rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[.18em] text-white" style={{ background: accent }}>{config.hero?.eyebrow || 'Estamos crescendo'}</span>{location && <span className="text-xs font-bold uppercase tracking-[.12em] opacity-50">{location}</span>}</div>
        <h1 className="mt-8 max-w-[1300px] text-[18vw] font-black uppercase leading-[.72] tracking-[-.075em] sm:text-[14vw] lg:text-[150px]">{title}</h1>
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_.75fr] lg:items-end"><div>{cover && <div className="h-[320px] overflow-hidden rounded-[var(--radius)] border-4 border-current sm:h-[430px]"><img src={config.cover?.url} alt="" className="h-full w-full object-cover" style={{ objectPosition: config.cover?.position || 'center' }} /></div>}</div><div>{subtitle && <p className="text-xl font-bold leading-8 sm:text-2xl">{subtitle}</p>}<a href="#vagas" className="mt-7 inline-flex items-center gap-3 rounded-full px-7 py-4 text-sm font-black uppercase tracking-[.1em] text-white" style={{ background: primary }}>{config.hero?.jobsLabel || 'Quero trabalhar aqui'}<ArrowRight className="h-4 w-4" /></a></div></div>
      </div>
    </header>
    <div className="rotate-[-1deg] border-y-4 border-current py-3" style={{ background: accent, color: '#fff' }}><div className="whitespace-nowrap text-center text-lg font-black uppercase tracking-[.12em] sm:text-2xl">Oportunidades • Gente • Movimento • Futuro • Oportunidades • Gente • Movimento • Futuro</div></div>

    <main className="mx-auto max-w-[1500px] px-5 sm:px-8">
      {sections(config).map((section) => {
        if (section.type === 'about' && company.description) return <section key={section.id} id="sobre" className="py-24 sm:py-32"><p className="max-w-6xl text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-6xl lg:text-7xl"><span className="mr-4 inline-block text-sm uppercase tracking-[.2em] opacity-40">{config.about?.title || 'Sobre'}</span>{company.description}</p></section>;
        if (section.type === 'jobs') return <PulseJobs key={section.id} jobs={jobs} config={config} primary={primary} accent={accent} />;
        if (section.type === 'contact') return <PulseContact key={section.id} company={company} config={config} primary={primary} />;
        if (section.type === 'socials') return <SocialLinks key={section.id} company={company} config={config} variant="bold" />;
        if (section.type === 'legal') return <LegalSection key={section.id} config={config} />;
        return null;
      })}
    </main>
    <BusinessFooter company={company} config={config} preview={preview} shell="max-w-[1500px]" />
  </div>;
}

function PulseJobs({ jobs, config, primary, accent }: { jobs: PublicJobLike[]; config: CompanyPageConfig; primary: string; accent: string }) {
  return <section id="vagas" className="py-20 sm:py-28"><div className="flex items-end justify-between gap-6"><div><Kicker>{config.jobs?.title || 'Oportunidades'}</Kicker><h2 className="mt-3 text-5xl font-black uppercase tracking-[-.055em] sm:text-7xl">Vem pro time.</h2></div><span className="hidden text-8xl font-black opacity-10 sm:block">{String(jobs.length).padStart(2, '0')}</span></div><div className="mt-10 grid gap-4 lg:grid-cols-2">{jobs.length ? jobs.map((job, index) => <Link key={job.id || job.slug || job.title} to={jobHref(job)} className="group min-h-[250px] rounded-[var(--radius)] border-4 border-current p-7 transition hover:-rotate-1" style={{ background: index % 3 === 1 ? accent : index % 3 === 2 ? '#fff' : primary, color: index % 3 === 2 ? 'var(--ink)' : '#fff' }}><div className="flex justify-between"><span className="text-xs font-black uppercase tracking-[.16em] opacity-65">#{String(index + 1).padStart(2, '0')}</span><ArrowRight className="h-6 w-6 transition group-hover:translate-x-1" /></div><h3 className="mt-16 text-3xl font-black uppercase leading-none tracking-[-.04em]">{job.title || 'Oportunidade'}</h3><JobMeta job={job} /></Link>) : <EmptyJobs />}</div></section>;
}

function PulseContact({ company, config, primary }: { company: PublicCompanyLike; config: CompanyPageConfig; primary: string }) {
  const items = contactItems(company, config);
  if (!items.length) return null;
  return <section id="contato" className="my-16 rounded-[var(--radius)] p-8 text-white sm:p-12 lg:p-16" style={{ background: primary }}><p className="text-xs font-black uppercase tracking-[.2em] opacity-50">Fale com a gente</p><div className="mt-10 grid gap-9 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <ContactItem key={item.label} item={item} light />)}</div></section>;
}

function CanvasTheme({ company, jobs, config, preview }: ThemeProps) {
  const preset = COMPANY_PAGE_THEME_PRESETS.canvas;
  const { style, background, text, primary } = visualStyle(config, preset);
  const shell = widthClass(config.width || preset.width);
  const title = config.hero?.title || company.name || 'Sua empresa';
  const subtitle = config.hero?.subtitle || company.description || '';
  const cover = Boolean(config.cover?.enabled && config.cover?.url);
  const location = companyLocation(company);

  return <div style={{ ...style, background, color: text }} className={`${typographyClass(config.branding?.typography || preset.branding.typography)} min-h-screen`}>
    {config.navigation?.enabled !== false && <nav className={`mx-auto flex w-full ${shell} items-center border-b border-current/25 px-5 py-5 sm:px-8`}><div className="flex items-center gap-3"><CompanyLogo company={company} size="small" shape="square" /><span className="text-sm font-semibold italic">{company.name}</span><VerifiedSeal company={company} /></div><div className="ml-auto flex gap-5 text-[11px] uppercase tracking-[.18em] opacity-55"><a href="#sobre">Sobre</a><a href="#vagas">Vagas</a></div></nav>}
    <header id="top" className={`mx-auto w-full ${shell} px-5 py-14 sm:px-8 sm:py-20`}>
      <div className="grid gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
        <div className="lg:sticky lg:top-12"><div className="flex items-center justify-between border-b border-current/25 pb-4 text-[10px] uppercase tracking-[.2em] opacity-45"><span>{config.hero?.eyebrow || 'Perfil empresarial'}</span><span>{location}</span></div><h1 className="mt-8 text-6xl font-medium leading-[.9] tracking-[-.06em] sm:text-8xl lg:text-[105px]">{title}</h1>{subtitle && <p className="mt-10 max-w-xl text-lg leading-8 opacity-65">{subtitle}</p>}<a href="#vagas" className="mt-9 inline-flex items-center gap-2 border-b pb-1 text-sm italic" style={{ borderColor: primary, color: primary }}>{config.hero?.jobsLabel || 'Descobrir oportunidades'}<ArrowRight className="h-4 w-4" /></a></div>
        <div>{cover ? <figure><div className="aspect-[4/5] overflow-hidden bg-black/5"><img src={config.cover?.url} alt="" className="h-full w-full object-cover" style={{ objectPosition: config.cover?.position || 'center' }} /></div><figcaption className="mt-3 flex justify-between text-[10px] uppercase tracking-[.16em] opacity-40"><span>{company.name}</span><span>Imagem institucional</span></figcaption></figure> : <div className="aspect-[4/5] overflow-hidden bg-black/[.04] p-8 sm:p-12"><div className="flex h-full flex-col justify-between border border-current/20 p-6 sm:p-10"><CompanyLogo company={company} size="large" shape="square" /><div><span className="text-[10px] uppercase tracking-[.2em] opacity-35">Edição atual</span><p className="mt-4 text-6xl font-medium italic tracking-[-.06em]">{jobs.length}</p><p className="mt-1 text-sm opacity-50">oportunidades em aberto</p></div></div></div>}</div>
      </div>
    </header>

    <main className={`mx-auto w-full ${shell} px-5 sm:px-8`}>
      {sections(config).map((section) => {
        if (section.type === 'about' && company.description) return <section key={section.id} id="sobre" className="grid gap-8 border-t border-current/25 py-20 sm:py-28 lg:grid-cols-[.3fr_1fr]"><p className="text-xs uppercase tracking-[.22em] opacity-45">{config.about?.title || 'Sobre'}</p><p className="max-w-5xl text-3xl leading-[1.35] sm:text-5xl sm:leading-[1.25]">{company.description}</p></section>;
        if (section.type === 'jobs') return <CanvasJobs key={section.id} jobs={jobs} config={config} />;
        if (section.type === 'contact') return <CanvasContact key={section.id} company={company} config={config} />;
        if (section.type === 'socials') return <SocialLinks key={section.id} company={company} config={config} variant="plain" />;
        if (section.type === 'legal') return <LegalSection key={section.id} config={config} />;
        return null;
      })}
    </main>
    <BusinessFooter company={company} config={config} preview={preview} shell={shell} squared />
  </div>;
}

function CanvasJobs({ jobs, config }: { jobs: PublicJobLike[]; config: CompanyPageConfig }) {
  return <section id="vagas" className="border-t border-current/25 py-20 sm:py-28"><div className="grid gap-8 lg:grid-cols-[.3fr_1fr]"><div><p className="text-xs uppercase tracking-[.22em] opacity-45">{config.jobs?.title || 'Oportunidades'}</p><p className="mt-5 text-sm italic opacity-55">{config.jobs?.intro}</p></div><div>{jobs.length ? jobs.map((job, index) => <Link key={job.id || job.slug || job.title} to={jobHref(job)} className="group grid gap-3 border-t border-current/25 py-7 first:border-t-0 sm:grid-cols-[70px_1fr_auto] sm:items-baseline"><span className="text-xs italic opacity-35">{String(index + 1).padStart(2, '0')}</span><div><h3 className="text-2xl tracking-[-.035em] sm:text-3xl">{job.title || 'Oportunidade'}</h3><JobMeta job={job} /></div><span className="text-sm italic opacity-45 group-hover:opacity-100">Ver vaga ↗</span></Link>) : <EmptyJobs />}</div></div></section>;
}

function CanvasContact({ company, config }: { company: PublicCompanyLike; config: CompanyPageConfig }) {
  const items = contactItems(company, config);
  if (!items.length) return null;
  return <section id="contato" className="grid gap-8 border-t border-current/25 py-20 lg:grid-cols-[.3fr_1fr]"><p className="text-xs uppercase tracking-[.22em] opacity-45">Contato</p><div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">{items.map((item) => <ContactItem key={item.label} item={item} />)}</div></section>;
}

function NoirTheme({ company, jobs, config, preview }: ThemeProps) {
  const preset = COMPANY_PAGE_THEME_PRESETS.noir;
  const { style, background, text, primary, accent } = visualStyle(config, preset);
  const shell = widthClass(config.width || preset.width);
  const title = config.hero?.title || company.name || 'Sua empresa';
  const subtitle = config.hero?.subtitle || company.description || '';
  const location = companyLocation(company);
  const cover = Boolean(config.cover?.enabled && config.cover?.url);
  const gridBackground = `linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)`;

  return <div style={{ ...style, background, color: text, backgroundImage: gridBackground, backgroundSize: '48px 48px' }} className={`${typographyClass(config.branding?.typography || preset.branding.typography)} min-h-screen`}>
    <div className="pointer-events-none fixed inset-x-0 top-0 h-[680px] opacity-40" style={{ background: `radial-gradient(circle at 70% 20%, ${primary}66 0, transparent 28%), radial-gradient(circle at 25% 18%, ${accent}44 0, transparent 24%)` }} />
    {config.navigation?.enabled !== false && <nav className={`${config.navigation?.sticky !== false ? 'sticky top-0 z-50' : 'relative z-30'} border-b border-white/10 bg-black/30 backdrop-blur-xl`}><div className={`mx-auto flex h-16 w-full ${shell} items-center px-5 sm:px-8`}><div className="flex items-center gap-3"><CompanyLogo company={company} size="small" shape="soft" /><span className="text-xs font-bold uppercase tracking-[.16em]">{company.name}</span><VerifiedSeal company={company} inverted /></div><div className="ml-auto hidden gap-7 text-[10px] uppercase tracking-[.18em] text-white/45 sm:flex"><a href="#sobre">/about</a><a href="#vagas">/jobs</a><a href="#contato">/contact</a></div></div></nav>}
    <header id="top" className={`relative z-10 mx-auto grid min-h-[680px] w-full ${shell} items-end gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_.72fr] lg:py-24`}>
      <div><div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.2em] text-white/40"><span className="h-2 w-2 rounded-full animate-pulse" style={{ background: accent }} />{config.hero?.eyebrow || 'Company interface'} {location && <span>· {location}</span>}</div><h1 className="mt-7 max-w-5xl text-5xl font-bold leading-[.9] tracking-[-.06em] sm:text-7xl lg:text-[96px]">{title}</h1>{subtitle && <p className="mt-8 max-w-2xl text-base leading-7 text-white/55">{subtitle}</p>}<a href="#vagas" className="mt-8 inline-flex items-center gap-2 border border-white/15 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-[.13em] backdrop-blur" style={{ borderRadius: 'var(--radius)' }}>{config.hero?.jobsLabel || 'Explorar posições'}<ArrowRight className="h-4 w-4" /></a></div>
      <div className="relative"><div className="absolute -inset-5 blur-3xl opacity-25" style={{ background: primary }} />{cover ? <div className="relative aspect-square overflow-hidden border border-white/10" style={{ borderRadius: 'var(--radius)' }}><img src={config.cover?.url} alt="" className="h-full w-full object-cover opacity-75" style={{ objectPosition: config.cover?.position || 'center' }} /><div className="absolute inset-0" style={{ background: `linear-gradient(135deg, transparent 30%, ${primary}66)` }} /></div> : <div className="relative aspect-square border border-white/10 bg-black/30 p-7 backdrop-blur" style={{ borderRadius: 'var(--radius)' }}><div className="flex h-full flex-col justify-between"><div className="flex justify-between text-[10px] uppercase tracking-[.18em] text-white/35"><span>PN/Business</span><span>Live</span></div><div><p className="text-[100px] font-bold leading-none tracking-[-.08em]" style={{ color: accent }}>{jobs.length}</p><p className="text-xs uppercase tracking-[.16em] text-white/40">open positions</p></div></div></div>}</div>
    </header>

    <main className={`relative z-10 mx-auto w-full ${shell} px-5 sm:px-8`}>
      {sections(config).map((section) => {
        if (section.type === 'about' && company.description) return <section key={section.id} id="sobre" className="grid gap-8 border-t border-white/10 py-20 lg:grid-cols-[220px_1fr]"><p className="text-[10px] uppercase tracking-[.2em] text-white/35">01 / {config.about?.title || 'About'}</p><p className="max-w-5xl text-2xl leading-10 text-white/75 sm:text-4xl sm:leading-[1.45]">{company.description}</p></section>;
        if (section.type === 'jobs') return <NoirJobs key={section.id} jobs={jobs} config={config} accent={accent} />;
        if (section.type === 'contact') return <NoirContact key={section.id} company={company} config={config} />;
        if (section.type === 'socials') return <SocialLinks key={section.id} company={company} config={config} variant="dark" />;
        if (section.type === 'legal') return <LegalSection key={section.id} config={config} dark />;
        return null;
      })}
    </main>
    <BusinessFooter company={company} config={config} preview={preview} shell={shell} dark />
  </div>;
}

function NoirJobs({ jobs, config, accent }: { jobs: PublicJobLike[]; config: CompanyPageConfig; accent: string }) {
  return <section id="vagas" className="border-t border-white/10 py-20"><div className="flex items-end justify-between gap-5"><div><p className="text-[10px] uppercase tracking-[.2em] text-white/35">02 / Jobs</p><h2 className="mt-4 text-4xl font-bold tracking-[-.05em] sm:text-6xl">{config.jobs?.title || 'Open positions'}</h2></div><span className="text-xs text-white/30">{jobs.length} ACTIVE</span></div><div className="mt-10 border border-white/10 bg-black/20">{jobs.length ? jobs.map((job, index) => <Link key={job.id || job.slug || job.title} to={jobHref(job)} className="group grid gap-3 border-b border-white/10 p-5 last:border-b-0 sm:grid-cols-[70px_1fr_1fr_auto] sm:items-center"><span className="text-[10px] font-bold" style={{ color: accent }}>JOB_{String(index + 1).padStart(3, '0')}</span><span className="font-bold">{job.title || 'Oportunidade'}</span><span className="text-xs text-white/35">{jobLocation(job)}{job.workModel ? ` · ${job.workModel}` : ''}</span><ArrowRight className="h-4 w-4 text-white/25 transition group-hover:translate-x-1 group-hover:text-white" /></Link>) : <div className="p-6"><EmptyJobs dark /></div>}</div></section>;
}

function NoirContact({ company, config }: { company: PublicCompanyLike; config: CompanyPageConfig }) {
  const items = contactItems(company, config);
  if (!items.length) return null;
  return <section id="contato" className="border-t border-white/10 py-20"><p className="text-[10px] uppercase tracking-[.2em] text-white/35">03 / Contact</p><div className="mt-8 grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <div key={item.label} className="bg-[var(--paper)] p-6"><ContactItem item={item} dark /></div>)}</div></section>;
}

function SectionIntro({ config }: { config: CompanyPageConfig }) {
  return <div className="grid gap-6 lg:grid-cols-[.6fr_1fr] lg:items-end"><div><Kicker>{config.jobs?.title || 'Oportunidades'}</Kicker><h2 className="mt-3 text-4xl font-black tracking-[-.045em] sm:text-6xl">Faça parte da próxima história.</h2></div>{config.jobs?.intro && <p className="max-w-2xl text-base leading-7 opacity-55">{config.jobs.intro}</p>}</div>;
}

function jobHref(job: PublicJobLike) {
  return job.slug ? `/vagas/${encodeURIComponent(job.slug)}` : '/vagas';
}

function jobLocation(job: PublicJobLike) {
  return job.location || [job.city, job.state].filter(Boolean).join(', ') || 'Local a combinar';
}

function JobMeta({ job }: { job: PublicJobLike }) {
  return <p className="mt-3 text-xs opacity-45">{jobLocation(job)}{job.workModel ? ` · ${job.workModel}` : ''}{job.type ? ` · ${job.type}` : ''}{job.salary ? ` · ${job.salary}` : ''}</p>;
}

function EmptyJobs({ dark = false }: { dark?: boolean }) {
  return <div className={`border-y py-10 text-sm ${dark ? 'border-white/10 text-white/40' : 'border-black/10 opacity-50'}`}>Nenhuma vaga aberta neste momento.</div>;
}

type ContactData = { label: string; value: string; href: string; icon: React.ReactNode };

function contactItems(company: PublicCompanyLike, config: CompanyPageConfig): ContactData[] {
  const phone = config.contacts?.phone || company.phone;
  const email = config.contacts?.email;
  const website = config.contacts?.website || company.website;
  const whatsapp = config.contacts?.whatsapp;
  const address = companyLocation(company);
  return [
    phone && { label: 'Telefone', value: phone, href: `tel:${phone.replace(/\D/g, '')}`, icon: <Phone className="h-4 w-4" /> },
    whatsapp && { label: 'WhatsApp', value: whatsapp, href: `https://wa.me/55${whatsapp.replace(/\D/g, '')}`, icon: <Phone className="h-4 w-4" /> },
    email && { label: 'E-mail', value: email, href: `mailto:${email}`, icon: <Mail className="h-4 w-4" /> },
    website && { label: 'Site', value: website, href: normalizedUrl(website), icon: <Globe className="h-4 w-4" /> },
    address && { label: 'Endereço', value: address, href: '', icon: <MapPin className="h-4 w-4" /> },
  ].filter(Boolean) as ContactData[];
}

function ContactItem({ item, light = false, dark = false }: { item: ContactData; light?: boolean; dark?: boolean }) {
  const content = <><div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] ${light ? 'text-white/55' : dark ? 'text-white/35' : 'opacity-40'}`}>{item.icon}{item.label}</div><div className={`mt-2 break-words text-base font-semibold ${light ? 'text-white' : dark ? 'text-white/80' : ''}`}>{item.value}</div></>;
  return item.href ? <a href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="block hover:opacity-70">{content}</a> : <div>{content}</div>;
}

function SocialLinks({ company, config, variant }: { company: PublicCompanyLike; config: CompanyPageConfig; variant: 'pills' | 'plain' | 'bold' | 'dark' }) {
  const items = [
    ['Instagram', config.socials?.instagram || company.socialInstagram, <Instagram className="h-4 w-4" />],
    ['LinkedIn', config.socials?.linkedin || company.socialLinkedin, <Linkedin className="h-4 w-4" />],
    ['Facebook', config.socials?.facebook || company.socialFacebook, <Facebook className="h-4 w-4" />],
    ['YouTube', config.socials?.youtube, <Youtube className="h-4 w-4" />],
    ['TikTok', config.socials?.tiktok, <Music2 className="h-4 w-4" />],
  ].filter((item) => Boolean(item[1])) as Array<[string, string, React.ReactNode]>;
  if (!items.length) return null;
  const classes = variant === 'bold' ? 'border-2 border-current rounded-full px-5 py-3 font-black uppercase tracking-[.08em]' : variant === 'dark' ? 'border border-white/10 bg-white/5 px-4 py-2 text-white/60' : variant === 'pills' ? 'rounded-full border border-black/10 bg-white/60 px-4 py-2' : 'border-b border-current/25 pb-1';
  return <section className="py-10"><div className="flex flex-wrap gap-3">{items.map(([label, href, icon]) => <a key={label} href={normalizedUrl(href)} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 text-sm transition hover:opacity-65 ${classes}`}>{icon}{label}</a>)}</div></section>;
}

function LegalSection({ config, dark = false }: { config: CompanyPageConfig; dark?: boolean }) {
  const items = [
    config.legal?.termsEnabled && config.legal.termsBody ? { title: config.legal.termsTitle || 'Termos de uso', body: config.legal.termsBody } : null,
    config.legal?.privacyEnabled && config.legal.privacyBody ? { title: config.legal.privacyTitle || 'Política de privacidade', body: config.legal.privacyBody } : null,
  ].filter(Boolean) as Array<{ title: string; body: string }>;
  if (!items.length) return null;
  return <section className={`border-t py-10 ${dark ? 'border-white/10' : 'border-current/15'}`}>{items.map((item) => <details key={item.title} className={`border-b py-4 ${dark ? 'border-white/10' : 'border-current/10'}`}><summary className="cursor-pointer text-sm font-semibold">{item.title}</summary><div className="mt-4 whitespace-pre-wrap text-sm leading-7 opacity-60">{item.body}</div></details>)}</section>;
}

function Kicker({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return <p className={`text-[10px] font-black uppercase tracking-[.22em] ${light ? 'text-white/55' : 'opacity-40'}`}>{children}</p>;
}

function CompanyLogo({ company, size = 'medium', shape = 'soft' }: { company: PublicCompanyLike; size?: 'small' | 'medium' | 'large'; shape?: 'square' | 'soft' | 'round' }) {
  const sizeClass = size === 'small' ? 'h-9 w-9' : size === 'large' ? 'h-20 w-20 sm:h-24 sm:w-24' : 'h-14 w-14';
  const radius = shape === 'square' ? 'rounded-none' : shape === 'round' ? 'rounded-full' : 'rounded-xl';
  if (company.logoURL) return <img src={company.logoURL} alt={`Logo ${company.name || ''}`} className={`${sizeClass} ${radius} shrink-0 object-contain`} />;
  return <span className={`${sizeClass} ${radius} flex shrink-0 items-center justify-center border border-current/15`}><Building2 className="h-5 w-5 opacity-45" /></span>;
}

function VerifiedSeal({ company, inverted = false }: { company: PublicCompanyLike; inverted?: boolean }) {
  if (!isVerified(company)) return null;
  return <span title="Empresa verificada pelo PiraNegócios" aria-label="Empresa verificada pelo PiraNegócios" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ color: inverted ? '#fff' : '#0f9f6e', background: inverted ? 'rgba(255,255,255,.10)' : 'rgba(16,185,129,.10)' }}><BadgeCheck className="h-5 w-5" /></span>;
}

function BusinessFooter({ company, config, preview, shell, dark = false, squared = false }: { company: PublicCompanyLike; config: CompanyPageConfig; preview: boolean; shell: string; dark?: boolean; squared?: boolean }) {
  return <footer className={`mx-auto mt-16 w-full ${shell} px-5 pb-8 sm:px-8`}><div className={`flex flex-col gap-3 border-t pt-5 text-xs sm:flex-row sm:items-center sm:justify-between ${dark ? 'border-white/10 text-white/35' : 'border-current/15 opacity-50'} ${squared ? 'uppercase tracking-[.08em]' : ''}`}><span>{config.footer?.text || `© ${new Date().getFullYear()} ${company.name || 'Empresa'}`}</span><span>{preview ? 'Prévia privada · ' : ''}<Link to="/" className="underline decoration-current/30 underline-offset-4 hover:opacity-80">PiraNegócios Business</Link></span></div></footer>;
}
