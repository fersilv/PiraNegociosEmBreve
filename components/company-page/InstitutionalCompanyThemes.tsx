import React from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  ExternalLink,
  Facebook,
  Globe2,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Music2,
  Phone,
  Sparkles,
  Youtube,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type {
  CompanyPageConfig,
  CompanyPageSection,
} from './CompanyPageExtensions';
import type {
  CompanyPageWidth,
  CompanyTypography,
  PublicCompanyLike,
  PublicJobLike,
} from './PremiumCompanySiteRenderer';

export type InstitutionalThemeKey = 'aurora' | 'atlas' | 'pulse' | 'canvas' | 'noir';

export const INSTITUTIONAL_V2_TEMPLATES = [
  {
    key: 'aurora' as const,
    name: 'Aurora',
    eyebrow: 'Living color',
    description: 'Capa viva com auroras em movimento, categorias navegáveis e composição editorial em duas colunas.',
    bestFor: 'Tecnologia, serviços, saúde, educação e empresas contemporâneas',
  },
  {
    key: 'atlas' as const,
    name: 'Atlas',
    eyebrow: 'Orbital minimal',
    description: 'Institucional cinematográfico, escuro, silencioso e orientado por grandes imagens e seções de impacto.',
    bestFor: 'Indústria, infraestrutura, engenharia, logística e empresas premium',
  },
  {
    key: 'pulse' as const,
    name: 'Pulse',
    eyebrow: 'Gaming HUD',
    description: 'Interface gamer com neon, HUD, recortes técnicos e oportunidades em linguagem de missão.',
    bestFor: 'Games, tecnologia, eventos, varejo jovem e entretenimento',
  },
  {
    key: 'canvas' as const,
    name: 'Canvas',
    eyebrow: 'Arcane intelligence',
    description: 'Magia, IA e tecnologia em uma composição cósmica com brilho, geometria e narrativa visual.',
    bestFor: 'IA, inovação, pesquisa, audiovisual, criatividade e tecnologia',
  },
  {
    key: 'noir' as const,
    name: 'Noir',
    eyebrow: 'Warm brand',
    description: 'Marca acolhedora com creme, tons quentes, formas orgânicas e módulos amigáveis inspirados em varejo de experiência.',
    bestFor: 'Franquias, alimentação, varejo, serviços locais e marcas afetivas',
  },
];

export type InstitutionalThemePreset = {
  width: CompanyPageWidth;
  theme: { primary: string; accent: string; background: string; text: string };
  branding: { typography: CompanyTypography; logoSize: 'small' | 'medium' | 'large'; corners: 'square' | 'soft' | 'round' };
  hero: { layout: 'split' | 'centered' | 'cover' | 'minimal'; width: CompanyPageWidth; contentWidth: CompanyPageWidth; contentMode: 'section' | 'independent'; maxHeight: number };
  jobs: { layout: 'list' | 'grid' | 'compact' };
  navigation: { sticky: boolean; transparent: boolean };
};

export const INSTITUTIONAL_V2_PRESETS: Record<InstitutionalThemeKey, InstitutionalThemePreset> = {
  aurora: {
    width: 'wide',
    theme: { primary: '#4f46e5', accent: '#22d3ee', background: '#f7f8fc', text: '#111827' },
    branding: { typography: 'clean', logoSize: 'medium', corners: 'round' },
    hero: { layout: 'cover', width: 'wide', contentWidth: 'standard', contentMode: 'independent', maxHeight: 760 },
    jobs: { layout: 'list' },
    navigation: { sticky: true, transparent: true },
  },
  atlas: {
    width: 'full',
    theme: { primary: '#ffffff', accent: '#78bfff', background: '#05070a', text: '#f5f7fa' },
    branding: { typography: 'clean', logoSize: 'medium', corners: 'square' },
    hero: { layout: 'cover', width: 'full', contentWidth: 'wide', contentMode: 'independent', maxHeight: 860 },
    jobs: { layout: 'list' },
    navigation: { sticky: true, transparent: true },
  },
  pulse: {
    width: 'wide',
    theme: { primary: '#00e5ff', accent: '#ff2bd6', background: '#050916', text: '#f7fbff' },
    branding: { typography: 'technical', logoSize: 'medium', corners: 'square' },
    hero: { layout: 'split', width: 'wide', contentWidth: 'wide', contentMode: 'section', maxHeight: 760 },
    jobs: { layout: 'list' },
    navigation: { sticky: true, transparent: true },
  },
  canvas: {
    width: 'wide',
    theme: { primary: '#8b5cf6', accent: '#67e8f9', background: '#070b20', text: '#f5f4ff' },
    branding: { typography: 'editorial', logoSize: 'medium', corners: 'soft' },
    hero: { layout: 'split', width: 'wide', contentWidth: 'wide', contentMode: 'section', maxHeight: 780 },
    jobs: { layout: 'list' },
    navigation: { sticky: true, transparent: true },
  },
  noir: {
    width: 'wide',
    theme: { primary: '#6b351d', accent: '#e8a14a', background: '#fff7e9', text: '#351b10' },
    branding: { typography: 'human', logoSize: 'medium', corners: 'round' },
    hero: { layout: 'split', width: 'wide', contentWidth: 'wide', contentMode: 'section', maxHeight: 700 },
    jobs: { layout: 'list' },
    navigation: { sticky: true, transparent: false },
  },
};

export function applyInstitutionalV2Preset(config: CompanyPageConfig, key: InstitutionalThemeKey): CompanyPageConfig {
  const preset = INSTITUTIONAL_V2_PRESETS[key];
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

type Props = {
  themeKey: InstitutionalThemeKey;
  company: PublicCompanyLike;
  jobs: PublicJobLike[];
  config: CompanyPageConfig;
  preview?: boolean;
};

type Visual = { primary: string; accent: string; background: string; text: string };

type ThemeFlavor = {
  key: InstitutionalThemeKey;
  visual: Visual;
  preset: InstitutionalThemePreset;
};

const DEFAULT_SECTIONS: CompanyPageSection[] = [
  { id: 'identity', type: 'identity', enabled: true, locked: true },
  { id: 'categories', type: 'categories', enabled: true },
  { id: 'about', type: 'about', enabled: true },
  { id: 'jobs', type: 'jobs', enabled: true, locked: true },
  { id: 'contact', type: 'contact', enabled: true },
  { id: 'socials', type: 'socials', enabled: true },
  { id: 'legal', type: 'legal', enabled: true },
];

const DEFAULT_CATEGORIES = [
  { id: 'sobre', label: 'Sobre', href: '#sobre' },
  { id: 'vagas', label: 'Vagas', href: '#vagas' },
  { id: 'contato', label: 'Contato', href: '#contato' },
];

export function InstitutionalCompanyThemes({ themeKey, company, jobs, config, preview = false }: Props) {
  const preset = INSTITUTIONAL_V2_PRESETS[themeKey];
  const visual = {
    primary: config.theme?.primary || preset.theme.primary,
    accent: config.theme?.accent || preset.theme.accent,
    background: config.theme?.background || preset.theme.background,
    text: config.theme?.text || preset.theme.text,
  };
  const flavor = { key: themeKey, visual, preset } satisfies ThemeFlavor;
  const typography = config.branding?.typography || preset.branding.typography;
  const font = typography === 'editorial' ? 'font-serif' : typography === 'technical' ? 'font-mono' : 'font-sans';
  const radius = config.branding?.corners === 'square' ? '0px' : config.branding?.corners === 'round' ? '34px' : '16px';

  return (
    <div
      className={`${font} min-h-screen overflow-hidden`}
      data-institutional-theme={themeKey}
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
      <ThemeCss />
      <Navigation company={company} config={config} flavor={flavor} />
      <Hero company={company} jobs={jobs} config={config} flavor={flavor} />
      <SectionStream company={company} jobs={jobs} config={config} flavor={flavor} />
      <Footer company={company} config={config} flavor={flavor} preview={preview} />
    </div>
  );
}

function ThemeCss() {
  return <style>{`
    @keyframes pnAuroraOne { 0%,100%{transform:translate3d(-8%,-8%,0) scale(1)} 45%{transform:translate3d(28%,18%,0) scale(1.25)} 75%{transform:translate3d(5%,35%,0) scale(.92)} }
    @keyframes pnAuroraTwo { 0%,100%{transform:translate3d(12%,20%,0) scale(.9)} 40%{transform:translate3d(-22%,-5%,0) scale(1.2)} 72%{transform:translate3d(25%,-22%,0) scale(1.05)} }
    @keyframes pnPulseGlow { 0%,100%{opacity:.35} 50%{opacity:.9} }
    @keyframes pnCanvasFloat { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-18px) rotate(7deg)} }
    [data-institutional-theme] .pn-card { border-radius:var(--radius); }
    [data-institutional-theme] .pn-cover { object-position:var(--cover-position,center); filter:brightness(var(--cover-brightness,1)); }
  `}</style>;
}

function widthClass(width: CompanyPageWidth | undefined, fallback: CompanyPageWidth = 'wide') {
  const value = width || fallback;
  if (value === 'compact') return 'max-w-4xl';
  if (value === 'standard') return 'max-w-6xl';
  if (value === 'full') return 'max-w-none';
  return 'max-w-[1420px]';
}

function Shell({ width, fallback = 'wide', className = '', children }: { width?: CompanyPageWidth; fallback?: CompanyPageWidth; className?: string; children: React.ReactNode }) {
  return <div className={`mx-auto w-full ${widthClass(width, fallback)} px-5 sm:px-8 ${className}`}>{children}</div>;
}

function Navigation({ company, config, flavor }: { company: PublicCompanyLike; config: CompanyPageConfig; flavor: ThemeFlavor }) {
  if (config.navigation?.enabled === false) return null;
  const sticky = config.navigation?.sticky !== false;
  const transparent = Boolean(config.navigation?.transparent);
  const dark = flavor.key === 'atlas' || flavor.key === 'pulse' || flavor.key === 'canvas';
  const warm = flavor.key === 'noir';
  const bg = transparent ? 'transparent' : dark ? 'rgba(4,7,13,.88)' : warm ? 'rgba(255,247,233,.92)' : 'rgba(255,255,255,.84)';
  return (
    <nav className={`${sticky ? 'sticky top-0 z-50' : 'relative z-40'} border-b backdrop-blur-xl`} style={{ background: bg, borderColor: dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)' }}>
      <Shell width={config.hero?.width || config.width} fallback={flavor.preset.width}>
        <div className="flex min-h-16 items-center gap-3 sm:min-h-20">
          <CompanyLogo company={company} config={config} />
          <div className="min-w-0"><b className="block truncate text-sm tracking-tight">{company.name}</b></div>
          <VerifiedSeal company={company} dark={dark} />
          <div className="ml-auto hidden items-center gap-6 text-[10px] font-bold uppercase tracking-[.16em] opacity-65 md:flex">
            <a href="#sobre">Sobre</a>
            <a href="#vagas">{config.navigation?.jobsLabel || 'Vagas'}</a>
            <a href="#contato">Contato</a>
          </div>
          <a href="#vagas" className="ml-auto inline-flex items-center gap-2 border px-4 py-2 text-xs font-bold md:ml-3 pn-card" style={{ borderColor: flavor.visual.primary, background: flavor.key === 'pulse' ? `${flavor.visual.primary}14` : undefined }}>
            {config.navigation?.jobsLabel || 'Vagas'} <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </Shell>
    </nav>
  );
}

function heroHeight(config: CompanyPageConfig, preset: InstitutionalThemePreset) {
  const explicit = Number(config.hero?.maxHeight || 0);
  if (explicit >= 360) return Math.min(1100, explicit);
  if (config.cover?.height === 'small') return 520;
  if (config.cover?.height === 'large') return 900;
  return preset.hero.maxHeight;
}

function heroMediaStyles(config: CompanyPageConfig) {
  const overlay = Math.max(0, Math.min(75, Number(config.cover?.overlay ?? 28)));
  return {
    ['--cover-position' as any]: config.cover?.position || 'center',
    ['--cover-brightness' as any]: Math.max(.38, 1 - overlay / 110),
  } as React.CSSProperties;
}

function Hero({ company, jobs, config, flavor }: { company: PublicCompanyLike; jobs: PublicJobLike[]; config: CompanyPageConfig; flavor: ThemeFlavor }) {
  if (flavor.key === 'atlas') return <AtlasHero company={company} jobs={jobs} config={config} flavor={flavor} />;
  if (flavor.key === 'pulse') return <PulseHero company={company} jobs={jobs} config={config} flavor={flavor} />;
  if (flavor.key === 'canvas') return <CanvasHero company={company} jobs={jobs} config={config} flavor={flavor} />;
  if (flavor.key === 'noir') return <NoirHero company={company} jobs={jobs} config={config} flavor={flavor} />;
  return <AuroraHero company={company} jobs={jobs} config={config} flavor={flavor} />;
}

function heroCopy(company: PublicCompanyLike, config: CompanyPageConfig) {
  return {
    eyebrow: config.hero?.eyebrow || '',
    title: config.hero?.title || company.name || 'Sua empresa',
    subtitle: config.hero?.subtitle || config.about?.text || company.description || '',
    button: config.hero?.jobsLabel || 'Ver oportunidades',
  };
}

function HeroInner({ config, flavor, children }: { config: CompanyPageConfig; flavor: ThemeFlavor; children: React.ReactNode }) {
  const own = config.hero?.contentMode === 'independent';
  return <Shell width={own ? config.hero?.contentWidth : config.hero?.width} fallback={own ? flavor.preset.hero.contentWidth : flavor.preset.hero.width}>{children}</Shell>;
}

function AuroraHero({ company, config, flavor }: { company: PublicCompanyLike; jobs: PublicJobLike[]; config: CompanyPageConfig; flavor: ThemeFlavor }) {
  const copy = heroCopy(company, config);
  const height = heroHeight(config, flavor.preset);
  const hasCover = Boolean(config.cover?.enabled && config.cover?.url);
  return (
    <Shell width={config.hero?.width} fallback={flavor.preset.hero.width} className="pt-4 sm:pt-6">
      <section className="relative overflow-hidden border border-white/15 bg-[#071635] pn-card" style={{ minHeight: height, ...heroMediaStyles(config) }}>
        {hasCover && <img src={config.cover?.url} alt="" className="pn-cover absolute inset-0 h-full w-full object-cover opacity-70" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#06112b] via-transparent to-[#06112b]/15" />
        <div className="absolute -left-[10%] -top-[18%] h-[75%] w-[70%] rounded-full blur-[80px]" style={{ background: flavor.visual.primary, opacity: .48, animation: 'pnAuroraOne 13s ease-in-out infinite' }} />
        <div className="absolute -bottom-[20%] right-[-8%] h-[75%] w-[65%] rounded-full blur-[90px]" style={{ background: flavor.visual.accent, opacity: .45, animation: 'pnAuroraTwo 16s ease-in-out infinite' }} />
        <div className="absolute left-[35%] top-[12%] h-[55%] w-[40%] rounded-full bg-fuchsia-400/30 blur-[90px]" style={{ animation: 'pnAuroraTwo 19s ease-in-out infinite reverse' }} />
        <div className="relative z-10 flex h-full items-end" style={{ minHeight: height }}>
          <div className="w-full pb-10 pt-28 text-white sm:pb-14">
            <HeroInner config={config} flavor={flavor}>
              <div className={config.hero?.layout === 'centered' ? 'mx-auto max-w-4xl text-center' : 'max-w-4xl'}>
                {copy.eyebrow && <Eyebrow light>{copy.eyebrow}</Eyebrow>}
                <h1 className="mt-4 text-5xl font-semibold leading-[.9] tracking-[-.055em] sm:text-7xl lg:text-[92px]">{copy.title}</h1>
                {copy.subtitle && <p className="mt-5 max-w-2xl text-lg leading-8 text-white/70">{copy.subtitle}</p>}
                <HeroActions copy={copy} light centered={config.hero?.layout === 'centered'} />
              </div>
            </HeroInner>
          </div>
        </div>
      </section>
    </Shell>
  );
}

function AtlasHero({ company, config, flavor }: { company: PublicCompanyLike; jobs: PublicJobLike[]; config: CompanyPageConfig; flavor: ThemeFlavor }) {
  const copy = heroCopy(company, config);
  const height = heroHeight(config, flavor.preset);
  const hasCover = Boolean(config.cover?.enabled && config.cover?.url);
  return <section className="relative overflow-hidden bg-black text-white" style={{ minHeight: height, ...heroMediaStyles(config) }}>
    {hasCover ? <img src={config.cover?.url} alt="" className="pn-cover absolute inset-0 h-full w-full object-cover opacity-72" /> : <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 60% 88%,rgba(93,174,255,.45),transparent 18%),radial-gradient(ellipse at 58% 110%,#17324e 0 20%,#070a0f 40%,#000 72%)' }} />}
    <div className="absolute inset-x-[-15%] bottom-[8%] h-[42%] rounded-[50%] border-t border-white/20 opacity-80" />
    <div className="absolute inset-x-[-8%] bottom-[13%] h-[52%] rounded-[50%] border-t border-white/10" />
    <div className="absolute inset-0 bg-gradient-to-r from-black via-black/35 to-transparent" />
    <HeroInner config={config} flavor={flavor}>
      <div className={`relative z-10 flex min-h-[inherit] items-end pb-16 pt-36 ${config.hero?.layout === 'centered' ? 'justify-center text-center' : ''}`} style={{ minHeight: height }}>
        <div className="max-w-5xl">
          {copy.eyebrow && <Eyebrow light>{copy.eyebrow}</Eyebrow>}
          <h1 className="mt-5 text-5xl font-medium leading-[.9] tracking-[-.06em] sm:text-7xl lg:text-[96px]">{copy.title}</h1>
          {copy.subtitle && <p className="mt-6 max-w-2xl text-lg leading-8 text-white/65">{copy.subtitle}</p>}
          <HeroActions copy={copy} light centered={config.hero?.layout === 'centered'} />
        </div>
      </div>
    </HeroInner>
  </section>;
}

function PulseHero({ company, jobs, config, flavor }: { company: PublicCompanyLike; jobs: PublicJobLike[]; config: CompanyPageConfig; flavor: ThemeFlavor }) {
  const copy = heroCopy(company, config);
  const height = heroHeight(config, flavor.preset);
  const hasCover = Boolean(config.cover?.enabled && config.cover?.url);
  const centered = config.hero?.layout === 'centered';
  return <Shell width={config.hero?.width} fallback={flavor.preset.hero.width} className="pt-4">
    <section className="relative overflow-hidden border border-cyan-400/40 bg-[#030713] text-white" style={{ minHeight: height, ...heroMediaStyles(config), clipPath: 'polygon(0 0,97% 0,100% 5%,100% 100%,3% 100%,0 95%)' }}>
      <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(rgba(0,229,255,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(255,43,214,.12) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 78% 30%,${flavor.visual.accent}55,transparent 24%),radial-gradient(circle at 25% 65%,${flavor.visual.primary}44,transparent 30%)`, animation: 'pnPulseGlow 5s ease-in-out infinite' }} />
      {hasCover && <img src={config.cover?.url} alt="" className="pn-cover absolute inset-0 h-full w-full object-cover opacity-45 mix-blend-screen" />}
      <HeroInner config={config} flavor={flavor}>
        <div className={`relative z-10 grid items-center gap-10 py-20 ${centered ? '' : 'lg:grid-cols-[1fr_.85fr]'}`} style={{ minHeight: height }}>
          <div className={centered ? 'mx-auto max-w-5xl text-center' : ''}>
            <div className="text-[10px] font-black uppercase tracking-[.25em] text-cyan-300">// {copy.eyebrow || 'SYSTEM READY'}</div>
            <h1 className="mt-5 text-6xl font-black uppercase leading-[.78] tracking-[-.07em] sm:text-8xl" style={{ textShadow: `0 0 28px ${flavor.visual.primary}55` }}>{copy.title}</h1>
            {copy.subtitle && <p className="mt-7 max-w-2xl text-lg leading-8 text-white/65">{copy.subtitle}</p>}
            <HeroActions copy={copy} light centered={centered} />
          </div>
          {!centered && config.hero?.layout !== 'minimal' && <div className="relative min-h-[360px] border border-fuchsia-400/40 bg-white/[.03] p-4" style={{ clipPath: 'polygon(8% 0,100% 0,100% 90%,92% 100%,0 100%,0 10%)' }}>
            {hasCover ? <img src={config.cover?.url} alt="" className="pn-cover h-full min-h-[330px] w-full object-cover opacity-85" /> : <div className="flex min-h-[330px] flex-col justify-between p-6"><Sparkles className="h-16 w-16 text-cyan-300" /><div><div className="text-[10px] uppercase tracking-[.2em] text-fuchsia-300">OPEN MISSIONS</div><div className="mt-3 text-7xl font-black">{String(jobs.length).padStart(2, '0')}</div></div></div>}
          </div>}
        </div>
      </HeroInner>
    </section>
  </Shell>;
}

function CanvasHero({ company, jobs, config, flavor }: { company: PublicCompanyLike; jobs: PublicJobLike[]; config: CompanyPageConfig; flavor: ThemeFlavor }) {
  const copy = heroCopy(company, config);
  const height = heroHeight(config, flavor.preset);
  const hasCover = Boolean(config.cover?.enabled && config.cover?.url);
  const centered = config.hero?.layout === 'centered';
  return <Shell width={config.hero?.width} fallback={flavor.preset.hero.width} className="pt-4 sm:pt-6">
    <section className="relative overflow-hidden border border-violet-300/20 bg-[#080d2b] text-white pn-card" style={{ minHeight: height, ...heroMediaStyles(config) }}>
      <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(circle at 15% 25%,rgba(255,255,255,.7) 0 1px,transparent 1.5px),radial-gradient(circle at 70% 35%,rgba(103,232,249,.55) 0 1px,transparent 1.5px),radial-gradient(circle at 45% 78%,rgba(196,181,253,.5) 0 1px,transparent 1.5px)', backgroundSize: '130px 130px,180px 180px,210px 210px' }} />
      <div className="absolute right-[8%] top-[10%] h-[420px] w-[420px] rounded-full border border-cyan-200/25" style={{ boxShadow: `0 0 100px ${flavor.visual.primary}44`, animation: 'pnCanvasFloat 8s ease-in-out infinite' }}><div className="absolute inset-[18%] rotate-45 border border-violet-300/35" /><div className="absolute inset-[34%] rounded-full border border-cyan-200/50" /><div className="absolute inset-[46%] rounded-full" style={{ background: flavor.visual.accent, boxShadow: `0 0 70px ${flavor.visual.accent}` }} /></div>
      {hasCover && <img src={config.cover?.url} alt="" className="pn-cover absolute inset-0 h-full w-full object-cover opacity-28 mix-blend-screen" />}
      <HeroInner config={config} flavor={flavor}>
        <div className={`relative z-10 flex items-center py-20 ${centered ? 'justify-center text-center' : ''}`} style={{ minHeight: height }}>
          <div className="max-w-5xl">
            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[.25em] text-cyan-200"><Sparkles className="h-4 w-4" />{copy.eyebrow || 'INTELLIGENCE / POSSIBILITY'}</div>
            <h1 className="mt-7 font-serif text-6xl leading-[.88] tracking-[-.055em] sm:text-8xl">{copy.title}</h1>
            {copy.subtitle && <p className="mt-7 max-w-2xl text-lg leading-8 text-white/65">{copy.subtitle}</p>}
            <HeroActions copy={copy} light centered={centered} />
            <div className="mt-10 text-[10px] uppercase tracking-[.22em] text-white/35">{jobs.length} sinais de oportunidade detectados</div>
          </div>
        </div>
      </HeroInner>
    </section>
  </Shell>;
}

function NoirHero({ company, config, flavor }: { company: PublicCompanyLike; jobs: PublicJobLike[]; config: CompanyPageConfig; flavor: ThemeFlavor }) {
  const copy = heroCopy(company, config);
  const height = heroHeight(config, flavor.preset);
  const hasCover = Boolean(config.cover?.enabled && config.cover?.url);
  const centered = config.hero?.layout === 'centered';
  return <Shell width={config.hero?.width} fallback={flavor.preset.hero.width} className="pt-4 sm:pt-6">
    <section className="relative overflow-hidden bg-[#3c1d10] text-[#fff6e8] pn-card" style={{ minHeight: height, ...heroMediaStyles(config) }}>
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 84% 15%,${flavor.visual.accent}55,transparent 28%),linear-gradient(135deg,#2b130a,#5a2b16)` }} />
      <div className={`relative z-10 grid items-center ${centered ? '' : 'lg:grid-cols-[.9fr_1.1fr]'}`} style={{ minHeight: height }}>
        <HeroInner config={config} flavor={flavor}>
          <div className={centered ? 'mx-auto max-w-4xl py-20 text-center' : 'py-20 lg:pr-8'}>
            <span className="inline-flex rounded-full border border-[#f3c280]/40 px-4 py-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#f3c280]">{copy.eyebrow || 'Bem-vindo'}</span>
            <h1 className="mt-5 text-6xl font-black leading-[.82] tracking-[-.065em] sm:text-8xl">{copy.title}</h1>
            {copy.subtitle && <p className="mt-7 max-w-xl text-lg leading-8 text-[#ffe9cf]/72">{copy.subtitle}</p>}
            <HeroActions copy={copy} light centered={centered} />
          </div>
        </HeroInner>
        {!centered && config.hero?.layout !== 'minimal' && <div className="relative h-full min-h-[420px] overflow-hidden rounded-bl-[30%] bg-[#e7b36f]">{hasCover ? <img src={config.cover?.url} alt="" className="pn-cover absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center"><div className="h-72 w-72 rounded-full bg-[#fff0d8]/25 shadow-[0_0_80px_rgba(255,230,190,.25)]" /></div>}</div>}
      </div>
    </section>
  </Shell>;
}

function HeroActions({ copy, light = false, centered = false }: { copy: ReturnType<typeof heroCopy>; light?: boolean; centered?: boolean }) {
  return <div className={`mt-8 flex flex-wrap gap-3 ${centered ? 'justify-center' : ''}`}><a href="#vagas" className="inline-flex items-center gap-2 px-5 py-3 text-sm font-bold pn-card" style={{ background: light ? '#fff' : 'var(--brand)', color: light ? '#111' : contrastText('var(--brand)') }}>{copy.button}<ArrowRight className="h-4 w-4" /></a></div>;
}

function SectionStream({ company, jobs, config, flavor }: { company: PublicCompanyLike; jobs: PublicJobLike[]; config: CompanyPageConfig; flavor: ThemeFlavor }) {
  const sections = (Array.isArray(config.sections) && config.sections.length ? config.sections : DEFAULT_SECTIONS).filter((section) => section.type !== 'identity' && section.enabled !== false);
  const output: React.ReactNode[] = [];
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    const next = sections[i + 1];
    const next2 = sections[i + 2];
    if (section.type === 'about' && next?.type === 'jobs') {
      const consumeContact = next2?.type === 'contact';
      output.push(<OverviewJobsPair key={`${section.id}-${next.id}`} company={company} jobs={jobs} config={config} flavor={flavor} aboutSection={section} jobsSection={next} includeContact={consumeContact} />);
      i += consumeContact ? 2 : 1;
      continue;
    }
    if (section.type === 'categories') output.push(<CategoriesSection key={section.id} config={config} flavor={flavor} section={section} />);
    else if (section.type === 'about') output.push(<AboutSection key={section.id} company={company} config={config} flavor={flavor} section={section} />);
    else if (section.type === 'jobs') output.push(<JobsSection key={section.id} jobs={jobs} config={config} flavor={flavor} section={section} />);
    else if (section.type === 'contact') output.push(<ContactSection key={section.id} company={company} config={config} flavor={flavor} section={section} />);
    else if (section.type === 'socials') output.push(<SocialSection key={section.id} company={company} config={config} flavor={flavor} section={section} />);
    else if (section.type === 'legal') output.push(<LegalSection key={section.id} config={config} flavor={flavor} section={section} />);
  }
  return <>{output}</>;
}

function sectionWidths(section: CompanyPageSection, config: CompanyPageConfig) {
  const outer = section.width || config.width || 'wide';
  const inner = section.contentMode === 'independent' ? section.contentWidth || 'standard' : outer;
  return { outer, inner };
}

function SectionFrame({ section, config, children, className = '' }: { section: CompanyPageSection; config: CompanyPageConfig; children: React.ReactNode; className?: string }) {
  const { outer, inner } = sectionWidths(section, config);
  return <Shell width={outer}><div className={className} style={section.maxHeight ? { maxHeight: section.maxHeight, overflow: 'auto' } : undefined}><Shell width={inner} className="!px-0">{children}</Shell></div></Shell>;
}

function CategoriesSection({ config, flavor, section }: { config: CompanyPageConfig; flavor: ThemeFlavor; section: CompanyPageSection }) {
  if (config.categories?.enabled === false) return null;
  const items = config.categories?.items?.length ? config.categories.items : DEFAULT_CATEGORIES;
  const proxy: CompanyPageSection = { ...section, width: config.categories?.width || section.width, contentWidth: config.categories?.contentWidth || section.contentWidth, contentMode: config.categories?.contentMode || section.contentMode };
  const isDark = flavor.key === 'atlas' || flavor.key === 'pulse' || flavor.key === 'canvas';
  return <SectionFrame section={proxy} config={config} className="py-5 sm:py-7"><div className="flex flex-wrap items-center gap-3">
    {config.categories?.title && <span className="mr-2 text-[10px] font-black uppercase tracking-[.2em] opacity-40">{config.categories.title}</span>}
    {items.map((item) => {
      const external = /^https?:\/\//i.test(item.href);
      return <a key={item.id} href={item.href || '#'} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold transition pn-card ${flavor.key === 'pulse' ? 'border border-cyan-300/35 bg-cyan-300/[.04]' : flavor.key === 'canvas' ? 'border border-violet-300/25 bg-violet-300/[.05]' : flavor.key === 'noir' ? 'border border-[#8a4c29]/20 bg-white/45' : 'border border-current/12 bg-white/[.06]'}`} style={flavor.key === 'aurora' ? { background: 'rgba(255,255,255,.7)', color: '#1f2937' } : isDark ? undefined : undefined}>{item.label}<ArrowRight className="h-3 w-3 opacity-45" /></a>;
    })}
  </div></SectionFrame>;
}

function OverviewJobsPair({ company, jobs, config, flavor, aboutSection, jobsSection, includeContact }: { company: PublicCompanyLike; jobs: PublicJobLike[]; config: CompanyPageConfig; flavor: ThemeFlavor; aboutSection: CompanyPageSection; jobsSection: CompanyPageSection; includeContact: boolean }) {
  const outer = jobsSection.width || aboutSection.width || config.width || 'wide';
  const contacts = includeContact ? contactItems(company, config) : [];
  return <Shell width={outer}><section className={`grid gap-5 py-6 sm:py-10 lg:grid-cols-[.38fr_.62fr] ${flavor.key === 'atlas' ? 'border-y border-white/10' : ''}`}>
    <div className={`p-6 sm:p-8 pn-card ${panelClass(flavor, 'soft')}`}>
      <Eyebrow light={flavor.key === 'atlas' || flavor.key === 'pulse' || flavor.key === 'canvas'}>{config.about?.title || 'Sobre a empresa'}</Eyebrow>
      <p id="sobre" className="mt-5 text-lg leading-8 opacity-75">{config.about?.text || company.description || 'Conheça mais sobre a empresa.'}</p>
      {contacts.length > 0 && <div id="contato" className="mt-8 space-y-4 border-t border-current/12 pt-6">{contacts.slice(0, 5).map((item) => <ContactLine key={item.label} item={item} />)}</div>}
    </div>
    <div className={`p-6 sm:p-8 pn-card ${panelClass(flavor, 'strong')}`}><JobsList jobs={jobs} config={config} flavor={flavor} /></div>
  </section></Shell>;
}

function panelClass(flavor: ThemeFlavor, strength: 'soft' | 'strong') {
  if (flavor.key === 'pulse') return strength === 'strong' ? 'border border-fuchsia-400/35 bg-[#071020]' : 'border border-cyan-400/30 bg-[#06101d]';
  if (flavor.key === 'canvas') return 'border border-violet-300/20 bg-white/[.035] shadow-[0_0_55px_rgba(91,64,190,.08)]';
  if (flavor.key === 'atlas') return 'border border-white/10 bg-white/[.025]';
  if (flavor.key === 'noir') return strength === 'strong' ? 'border border-[#7e4628]/15 bg-white/60' : 'border border-[#7e4628]/15 bg-[#fffaf0]';
  return 'border border-black/8 bg-white/75 shadow-[0_18px_60px_rgba(30,40,80,.06)]';
}

function AboutSection({ company, config, flavor, section }: { company: PublicCompanyLike; config: CompanyPageConfig; flavor: ThemeFlavor; section: CompanyPageSection }) {
  const text = config.about?.text || company.description;
  if (!text) return null;
  return <SectionFrame section={section} config={config} className="border-t border-current/12 py-16 sm:py-20"><Eyebrow light={flavor.key === 'atlas' || flavor.key === 'pulse' || flavor.key === 'canvas'}>{config.about?.title || 'Sobre'}</Eyebrow><p id="sobre" className="mt-6 max-w-5xl text-2xl leading-[1.45] tracking-[-.025em] opacity-78 sm:text-3xl">{text}</p></SectionFrame>;
}

function JobsSection({ jobs, config, flavor, section }: { jobs: PublicJobLike[]; config: CompanyPageConfig; flavor: ThemeFlavor; section: CompanyPageSection }) {
  return <SectionFrame section={section} config={config} className="border-t border-current/12 py-16 sm:py-20"><JobsList jobs={jobs} config={config} flavor={flavor} /></SectionFrame>;
}

function JobsList({ jobs, config, flavor }: { jobs: PublicJobLike[]; config: CompanyPageConfig; flavor: ThemeFlavor }) {
  const layout = config.jobs?.layout || 'list';
  const dark = flavor.key === 'atlas' || flavor.key === 'pulse' || flavor.key === 'canvas';
  return <div id="vagas"><div className="flex flex-wrap items-end justify-between gap-5"><div><Eyebrow light={dark}>{config.jobs?.title || 'Vagas em destaque'}</Eyebrow><h2 className="mt-3 text-3xl font-black tracking-[-.045em] sm:text-5xl">{jobs.length ? `${jobs.length} ${jobs.length === 1 ? 'oportunidade' : 'oportunidades'}` : 'Novas oportunidades em breve'}</h2></div>{config.jobs?.intro && <p className="max-w-sm text-sm leading-6 opacity-50">{config.jobs.intro}</p>}</div>
    {!jobs.length ? <div className="mt-8 border-y border-current/12 py-8 text-sm opacity-50">Nenhuma vaga aberta neste momento.</div> : layout === 'grid' ? <div className="mt-8 grid gap-4 md:grid-cols-2">{jobs.map((job, index) => <JobCard key={job.id || job.slug || job.title || index} job={job} index={index} flavor={flavor} />)}</div> : layout === 'compact' ? <div className="mt-8 divide-y divide-current/12">{jobs.map((job, index) => <JobRow key={job.id || job.slug || job.title || index} job={job} index={index} compact />)}</div> : <div className="mt-8 divide-y divide-current/12">{jobs.map((job, index) => <JobRow key={job.id || job.slug || job.title || index} job={job} index={index} />)}</div>}
  </div>;
}

function JobRow({ job, index, compact = false }: { job: PublicJobLike; index: number; compact?: boolean }) {
  return <Link to={jobHref(job)} className={`group grid gap-3 ${compact ? 'py-4' : 'py-5'} sm:grid-cols-[48px_1fr_auto] sm:items-center`}><span className="text-[10px] font-bold opacity-28">{String(index + 1).padStart(2, '0')}</span><div><h3 className={`${compact ? 'text-base' : 'text-lg'} font-bold`}>{job.title || 'Oportunidade'}</h3><JobMeta job={job} /></div><ArrowRight className="h-4 w-4 opacity-30 transition group-hover:translate-x-1 group-hover:opacity-100" /></Link>;
}

function JobCard({ job, index, flavor }: { job: PublicJobLike; index: number; flavor: ThemeFlavor }) {
  return <Link to={jobHref(job)} className={`group min-h-[190px] border p-6 pn-card ${panelClass(flavor, 'soft')}`}><div className="flex justify-between text-[10px] uppercase tracking-[.18em] opacity-35"><span>#{String(index + 1).padStart(2, '0')}</span><ExternalLink className="h-4 w-4" /></div><h3 className="mt-10 text-xl font-black">{job.title || 'Oportunidade'}</h3><JobMeta job={job} /></Link>;
}

function ContactSection({ company, config, flavor, section }: { company: PublicCompanyLike; config: CompanyPageConfig; flavor: ThemeFlavor; section: CompanyPageSection }) {
  const items = contactItems(company, config);
  if (!items.length) return null;
  return <SectionFrame section={section} config={config} className="border-t border-current/12 py-14 sm:py-18"><div id="contato"><Eyebrow light={flavor.key === 'atlas' || flavor.key === 'pulse' || flavor.key === 'canvas'}>Contato</Eyebrow><div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{items.map((item) => <a key={item.label} href={item.href || undefined} target={item.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="border-b border-current/15 pb-4"><ContactLine item={item} /></a>)}</div></div></SectionFrame>;
}

function SocialSection({ company, config, flavor, section }: { company: PublicCompanyLike; config: CompanyPageConfig; flavor: ThemeFlavor; section: CompanyPageSection }) {
  const items = socialItems(company, config);
  if (!items.length) return null;
  return <SectionFrame section={section} config={config} className="border-t border-current/12 py-10"><div className="flex flex-wrap gap-5">{items.map((item) => <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm opacity-65 hover:opacity-100">{item.icon}{item.label}</a>)}</div></SectionFrame>;
}

function LegalSection({ config, section }: { config: CompanyPageConfig; flavor: ThemeFlavor; section: CompanyPageSection }) {
  const items = [] as Array<{ title: string; body: string }>;
  if (config.legal?.termsEnabled && config.legal.termsBody) items.push({ title: config.legal.termsTitle || 'Termos de uso', body: config.legal.termsBody });
  if (config.legal?.privacyEnabled && config.legal.privacyBody) items.push({ title: config.legal.privacyTitle || 'Política de privacidade', body: config.legal.privacyBody });
  if (!items.length) return null;
  return <SectionFrame section={section} config={config} className="border-t border-current/12 py-12"><div className="grid gap-6 md:grid-cols-2">{items.map((item) => <article key={item.title}><h3 className="font-bold">{item.title}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 opacity-60">{item.body}</p></article>)}</div></SectionFrame>;
}

function Footer({ company, config, flavor, preview }: { company: PublicCompanyLike; config: CompanyPageConfig; flavor: ThemeFlavor; preview: boolean }) {
  const dark = flavor.key === 'atlas' || flavor.key === 'pulse' || flavor.key === 'canvas';
  return <Shell width={config.width} fallback={flavor.preset.width}><footer className={`mt-6 flex flex-col gap-3 border-t py-7 text-xs sm:flex-row sm:items-center sm:justify-between ${dark ? 'border-white/10 text-white/40' : 'border-current/12 opacity-55'}`}><span>{config.footer?.text || `© ${new Date().getFullYear()} ${company.name || 'Empresa'}`}</span><Link to="/" className="underline underline-offset-4">{preview ? 'Prévia privada · ' : ''}PiraNegócios Business</Link></footer></Shell>;
}

function CompanyLogo({ company, config, large = false }: { company: PublicCompanyLike; config: CompanyPageConfig; large?: boolean }) {
  const chosen = config.branding?.logoSize || 'medium';
  const size = large || chosen === 'large' ? 'h-16 w-16' : chosen === 'small' ? 'h-8 w-8' : 'h-10 w-10';
  if (company.logoURL) return <img src={company.logoURL} alt={`Logo ${company.name || ''}`} className={`${size} shrink-0 object-contain`} />;
  return <span className={`${size} flex shrink-0 items-center justify-center border border-current/15 pn-card`}><Building2 className="h-5 w-5 opacity-40" /></span>;
}

function VerifiedSeal({ company, dark = false }: { company: PublicCompanyLike; dark?: boolean }) {
  if (!(company.isVerified || company.verificationStatus === 'VERIFIED')) return null;
  return <span title="Empresa verificada pelo PiraNegócios" aria-label="Empresa verificada pelo PiraNegócios" className="inline-flex h-7 w-7 items-center justify-center rounded-full" style={{ color: dark ? '#fff' : '#059669', background: dark ? 'rgba(255,255,255,.1)' : 'rgba(16,185,129,.1)' }}><BadgeCheck className="h-5 w-5" /></span>;
}

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return <div className={`text-[10px] font-black uppercase tracking-[.22em] ${light ? 'text-white/55' : 'opacity-45'}`}>{children}</div>;
}

function JobMeta({ job }: { job: PublicJobLike }) {
  const loc = job.location || [job.city, job.state].filter(Boolean).join(', ') || 'Local a combinar';
  return <p className="mt-2 text-xs opacity-48">{loc}{job.workModel ? ` · ${job.workModel}` : ''}{job.salary ? ` · ${job.salary}` : ''}</p>;
}

function ContactLine({ item }: { item: ReturnType<typeof contactItems>[number] }) {
  return <div><div className="flex items-center gap-2 text-[10px] uppercase tracking-[.16em] opacity-40">{item.icon}{item.label}</div><div className="mt-1.5 text-sm font-semibold">{item.value}</div></div>;
}

function contactItems(company: PublicCompanyLike, config: CompanyPageConfig) {
  const phone = config.contacts?.phone || company.phone || '';
  const secondary = config.contacts?.secondaryPhone || '';
  const whatsapp = config.contacts?.whatsapp || '';
  const email = config.contacts?.email || '';
  const website = config.contacts?.website || company.website || '';
  const loc = companyLocation(company);
  return [
    phone && { label: 'Telefone', value: phone, href: `tel:${phone.replace(/\D/g, '')}`, icon: <Phone className="h-4 w-4" /> },
    secondary && { label: 'Telefone 2', value: secondary, href: `tel:${secondary.replace(/\D/g, '')}`, icon: <Phone className="h-4 w-4" /> },
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
  ].filter((entry) => Boolean(entry[1])).map(([label, href, icon]) => ({ label: label as string, href: normalizeUrl(href as string), icon: icon as React.ReactNode }));
}

function companyLocation(company: PublicCompanyLike) {
  return company.address || company.cityState || [company.city, company.state].filter(Boolean).join(', ');
}

function jobHref(job: PublicJobLike) {
  return job.slug ? `/vagas/${encodeURIComponent(job.slug)}` : '/vagas';
}

function normalizeUrl(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return /^(https?:|mailto:|tel:)/i.test(raw) ? raw : `https://${raw}`;
}

function contrastText(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#fff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111' : '#fff';
}
