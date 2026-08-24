import React, { createContext, useContext } from 'react';
import {
  ArrowRight,
  BadgeCheck,
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
  Search,
  Sparkles,
  Youtube,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type {
  CompanyPageConfig,
  CompanyPageWidth,
  CompanyTypography,
  PublicCompanyLike,
  PublicJobLike,
} from './PremiumCompanySiteRenderer';
import {
  EXTRA_THEME_PRESETS,
  type ExtraCompanyThemeKey,
  type ExtendedThemePreset,
} from './ReferenceCompanyThemes';

type Archetype =
  | 'marketplace'
  | 'index'
  | 'gallery'
  | 'local'
  | 'interface'
  | 'storefront'
  | 'cinematic'
  | 'editorial'
  | 'playground'
  | 'film'
  | 'immersive'
  | 'archive'
  | 'mono';

type ThemeSpec = {
  archetype: Archetype;
  eyebrow: string;
  navHint?: string;
  atmosphere?: string;
};

type Visual = { primary: string; accent: string; background: string; text: string };
type ThemeContextValue = {
  themeKey: ExtraCompanyThemeKey;
  company: PublicCompanyLike;
  jobs: PublicJobLike[];
  config: CompanyPageConfig;
  preset: ExtendedThemePreset;
  visual: Visual;
  spec: ThemeSpec;
  preview: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_SPECS: Record<ExtraCompanyThemeKey, ThemeSpec> = {
  mercado: { archetype: 'marketplace', eyebrow: 'Descubra', navHint: 'Marketplace' },
  gazeta: { archetype: 'index', eyebrow: 'Índice', navHint: 'Classificados' },
  mosaico: { archetype: 'gallery', eyebrow: 'Curadoria', navHint: 'Discovery' },
  radar: { archetype: 'local', eyebrow: 'Perto de você', navHint: 'Local finder' },
  pregao: { archetype: 'interface', eyebrow: 'Mercado aberto', navHint: 'Live board' },
  bistro: { archetype: 'storefront', eyebrow: 'Bem-vindo', navHint: 'Casa' },
  brasa: { archetype: 'cinematic', eyebrow: 'Experiência', navHint: 'Food / people' },
  jardim: { archetype: 'editorial', eyebrow: 'Feito com calma', navHint: 'Editorial' },
  diner: { archetype: 'marketplace', eyebrow: 'Peça. Descubra. Volte.', navHint: 'Food app' },
  degustacao: { archetype: 'film', eyebrow: 'Experiência', navHint: 'Fine dining' },
  runway: { archetype: 'cinematic', eyebrow: 'Collection', navHint: 'Campaign' },
  street: { archetype: 'playground', eyebrow: 'Drop / culture', navHint: 'Street' },
  boutique: { archetype: 'editorial', eyebrow: 'Maison', navHint: 'Editorial' },
  lookbook: { archetype: 'gallery', eyebrow: 'Collection 01', navHint: 'Lookbook' },
  atelier: { archetype: 'film', eyebrow: 'Processo / forma', navHint: 'Atelier' },
  pro: { archetype: 'cinematic', eyebrow: 'Serviço / resultado', navHint: 'Professional' },
  oficio: { archetype: 'index', eyebrow: 'Precisão', navHint: 'Technical' },
  care: { archetype: 'storefront', eyebrow: 'Cuidado em primeiro lugar', navHint: 'Care' },
  studio: { archetype: 'immersive', eyebrow: 'Brand / digital / motion', navHint: 'Studio', atmosphere: 'STUDIO' },
  local: { archetype: 'local', eyebrow: 'Perto de você', navHint: 'Local' },
  festival: { archetype: 'playground', eyebrow: 'Agora', navHint: 'Culture' },
  terra: { archetype: 'cinematic', eyebrow: 'Paisagem / origem', navHint: 'Landscape' },
  cosmos: { archetype: 'interface', eyebrow: 'System online', navHint: 'Universe UI' },
  heritage: { archetype: 'archive', eyebrow: 'Arquivo 001', navHint: 'Archive' },
  mono: { archetype: 'mono', eyebrow: 'Independent', navHint: 'Mono' },
};

const DEFAULT_SECTIONS = [
  { id: 'about', type: 'about', enabled: true },
  { id: 'jobs', type: 'jobs', enabled: true, locked: true },
  { id: 'contact', type: 'contact', enabled: true },
  { id: 'socials', type: 'socials', enabled: true },
  { id: 'legal', type: 'legal', enabled: true },
];

export function ConfigurableExtraCompanyThemeRenderer({
  themeKey,
  company,
  jobs,
  config,
  preview = false,
}: {
  themeKey: ExtraCompanyThemeKey;
  company: PublicCompanyLike;
  jobs: PublicJobLike[];
  config: CompanyPageConfig;
  preview?: boolean;
}) {
  const preset = EXTRA_THEME_PRESETS[themeKey];
  const visual = resolveVisual(config, preset);
  const value: ThemeContextValue = {
    themeKey,
    company,
    jobs,
    config,
    preset,
    visual,
    spec: THEME_SPECS[themeKey],
    preview,
  };

  return (
    <ThemeContext.Provider value={value}>
      <ThemePage />
    </ThemeContext.Provider>
  );
}

function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('ThemeContext unavailable');
  return value;
}

function resolveVisual(config: CompanyPageConfig, preset: ExtendedThemePreset): Visual {
  return {
    primary: config.theme?.primary || preset.theme.primary,
    accent: config.theme?.accent || preset.theme.accent,
    background: config.theme?.background || preset.theme.background,
    text: config.theme?.text || preset.theme.text,
  };
}

function ThemePage() {
  const { config, preset, visual, spec } = useTheme();
  const typography = config.branding?.typography || preset.branding.typography;
  const fontClass = typography === 'editorial' ? 'font-serif' : typography === 'technical' ? 'font-mono' : 'font-sans';
  const radius = config.branding?.corners === 'square'
    ? '0px'
    : config.branding?.corners === 'round'
      ? '36px'
      : config.branding?.corners === 'soft'
        ? '18px'
        : preset.branding.corners === 'square'
          ? '0px'
          : preset.branding.corners === 'round'
            ? '36px'
            : '18px';
  const position = config.cover?.position || 'center';
  const overlay = Math.max(0, Math.min(75, Number(config.cover?.overlay ?? 34)));
  const brightness = Math.max(.38, 1 - (overlay / 100) * .78);

  return (
    <div
      className={`${fontClass} min-h-screen overflow-hidden`}
      data-theme-archetype={spec.archetype}
      style={{
        background: visual.background,
        color: visual.text,
        ['--brand' as any]: visual.primary,
        ['--accent' as any]: visual.accent,
        ['--radius' as any]: radius,
        ['--cover-position' as any]: position,
        ['--cover-brightness' as any]: brightness,
      }}
    >
      <style>{`
        [data-theme-archetype] .pn-corner { border-radius: var(--radius) !important; }
        [data-theme-archetype] .pn-cover-image { object-position: var(--cover-position); filter: brightness(var(--cover-brightness)); }
        [data-theme-archetype] a { color: inherit; }
      `}</style>
      <ThemeNavigation />
      <ThemeHero />
      <ThemeSections />
      <ThemeFooter />
    </div>
  );
}

function shellWidth(width: CompanyPageWidth | undefined, fallback: CompanyPageWidth) {
  const value = width || fallback;
  if (value === 'compact') return 'max-w-4xl';
  if (value === 'standard') return 'max-w-6xl';
  if (value === 'full') return 'max-w-none';
  return 'max-w-[1420px]';
}

function Shell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { config, preset } = useTheme();
  return <div className={`mx-auto w-full ${shellWidth(config.width, preset.width)} px-5 sm:px-8 ${className}`}>{children}</div>;
}

function ThemeNavigation() {
  const { config, company, visual, spec } = useTheme();
  if (config.navigation?.enabled === false) return null;
  const sticky = config.navigation?.sticky !== false;
  const transparent = Boolean(config.navigation?.transparent);
  const interfaceLike = spec.archetype === 'interface' || spec.archetype === 'immersive';
  const editorial = spec.archetype === 'editorial' || spec.archetype === 'archive' || spec.archetype === 'film';

  return (
    <nav
      className={`${sticky ? 'sticky top-0 z-50' : 'relative z-30'} border-b backdrop-blur-xl`}
      style={{
        borderColor: interfaceLike ? 'rgba(255,255,255,.12)' : 'color-mix(in srgb, currentColor 14%, transparent)',
        background: transparent ? 'transparent' : interfaceLike ? 'rgba(3,5,10,.82)' : `${visual.background}e8`,
      }}
    >
      <Shell>
        <div className={`flex min-h-16 items-center gap-3 ${editorial ? 'sm:min-h-20' : ''}`}>
          <CompanyLogo />
          <div className="min-w-0">
            <div className={`truncate font-bold ${editorial ? 'font-serif text-lg' : 'text-sm'}`}>{company.name}</div>
            {spec.navHint && <div className="hidden text-[9px] uppercase tracking-[.2em] opacity-35 sm:block">{spec.navHint}</div>}
          </div>
          <VerifiedSeal />
          <div className="ml-auto hidden items-center gap-6 text-[10px] font-bold uppercase tracking-[.16em] opacity-55 md:flex">
            <a href="#sobre">Sobre</a>
            <a href="#vagas">{config.navigation?.jobsLabel || 'Vagas'}</a>
            <a href="#contato">Contato</a>
          </div>
          <a href="#vagas" className="ml-auto inline-flex items-center gap-2 border px-4 py-2 text-xs font-bold md:ml-2 pn-corner" style={{ borderColor: visual.primary }}>
            {config.navigation?.jobsLabel || 'Vagas'} <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </Shell>
    </nav>
  );
}

function ThemeHero() {
  const theme = useTheme();
  const layout = theme.config.hero?.layout || theme.preset.hero.layout || 'split';
  if (theme.spec.archetype === 'immersive') return <ImmersiveHero layout={layout} />;
  if (theme.spec.archetype === 'interface') return <InterfaceHero layout={layout} />;
  if (theme.spec.archetype === 'playground') return <PlaygroundHero layout={layout} />;
  if (theme.spec.archetype === 'archive') return <ArchiveHero layout={layout} />;
  if (theme.spec.archetype === 'mono') return <MonoHero layout={layout} />;
  if (theme.spec.archetype === 'marketplace' || theme.spec.archetype === 'storefront' || theme.spec.archetype === 'local') return <UtilityHero layout={layout} />;
  return <EditorialHero layout={layout} />;
}

function heroCopy() {
  const { company, config, spec } = useTheme();
  return {
    eyebrow: config.hero?.eyebrow || spec.eyebrow,
    title: config.hero?.title || company.name || 'Sua empresa',
    text: config.hero?.subtitle || config.about?.text || company.description || '',
    button: config.hero?.jobsLabel || 'Ver oportunidades',
  };
}

function coverHeight() {
  const { config } = useTheme();
  if (config.cover?.height === 'small') return 360;
  if (config.cover?.height === 'large') return 760;
  return 560;
}

function HeroMedia({ className = '' }: { className?: string }) {
  const { company, config, visual } = useTheme();
  const height = coverHeight();
  if (config.cover?.enabled && config.cover?.url) {
    return <div className={`relative overflow-hidden pn-corner ${className}`} style={{ minHeight: height }}><img src={config.cover.url} alt="" className="pn-cover-image absolute inset-0 h-full w-full object-cover" /></div>;
  }
  return <div className={`relative flex items-center justify-center overflow-hidden pn-corner ${className}`} style={{ minHeight: height, background: `radial-gradient(circle at 75% 20%,${visual.accent}88,transparent 28%),linear-gradient(135deg,${visual.primary},${visual.background})` }}><div className="text-center"><CompanyLogo large /><div className="mt-5 text-3xl font-black">{company.name}</div></div></div>;
}

function EditorialHero({ layout }: { layout: NonNullable<CompanyPageConfig['hero']>['layout'] }) {
  const { visual, spec } = useTheme();
  const copy = heroCopy();
  if (layout === 'cover') return <CoverHero />;
  if (layout === 'centered') return <Shell><section className="py-20 text-center sm:py-28"><Eyebrow>{copy.eyebrow}</Eyebrow><h1 className="mx-auto mt-7 max-w-6xl font-serif text-6xl leading-[.9] tracking-[-.06em] sm:text-8xl">{copy.title}</h1>{copy.text && <p className="mx-auto mt-8 max-w-2xl text-lg leading-8 opacity-60">{copy.text}</p>}<HeroActions centered /></section><HeroMedia className="mb-12" /></Shell>;
  if (layout === 'minimal') return <Shell><section className="grid min-h-[520px] items-end gap-10 border-b border-current/15 py-14 lg:grid-cols-[1.15fr_.85fr]"><div><Eyebrow>{copy.eyebrow}</Eyebrow><h1 className="mt-7 text-6xl leading-[.88] tracking-[-.065em] sm:text-8xl">{copy.title}</h1></div><div>{copy.text && <p className="text-lg leading-8 opacity-60">{copy.text}</p>}<HeroActions /></div></section></Shell>;
  return <Shell><section className="grid min-h-[650px] items-center gap-10 py-12 lg:grid-cols-[.9fr_1.1fr]"><div><Eyebrow>{copy.eyebrow}</Eyebrow><h1 className="mt-7 text-6xl leading-[.88] tracking-[-.065em] sm:text-8xl">{copy.title}</h1>{copy.text && <p className="mt-7 max-w-xl text-lg leading-8 opacity-60">{copy.text}</p>}<HeroActions /></div><HeroMedia /></section><div className="h-px" style={{ background: `${visual.text}22` }} /><div className="py-4 text-[10px] uppercase tracking-[.2em] opacity-35">{spec.navHint}</div></Shell>;
}

function UtilityHero({ layout }: { layout: NonNullable<CompanyPageConfig['hero']>['layout'] }) {
  const { jobs, company, visual, spec } = useTheme();
  const copy = heroCopy();
  if (layout === 'cover') return <CoverHero />;
  const centered = layout === 'centered';
  return <Shell><section className={`py-8 sm:py-12 ${centered ? 'text-center' : ''}`}><div className={`mb-6 flex flex-wrap gap-2 ${centered ? 'justify-center' : ''}`}>{['Empresa', location(company) || 'Brasil', `${jobs.length} oportunidades`].map((item) => <span key={item} className="rounded-full border border-current/10 px-4 py-2 text-xs font-semibold opacity-55">{item}</span>)}</div><div className={`grid overflow-hidden border border-current/10 pn-corner ${centered ? '' : 'lg:grid-cols-[1fr_.9fr]'}`} style={{ background: `${visual.primary}0d` }}><div className="p-8 sm:p-12"><div className="flex items-center border border-current/10 bg-white/60 px-4 py-3 text-sm opacity-50 pn-corner"><Search className="mr-2 h-4 w-4" />{spec.archetype === 'local' ? 'Encontre a empresa perto de você' : 'Descubra a empresa'}</div><Eyebrow className="mt-10">{copy.eyebrow}</Eyebrow><h1 className="mt-5 text-5xl font-black leading-[.88] tracking-[-.06em] sm:text-7xl">{copy.title}</h1>{copy.text && <p className="mt-6 text-lg leading-8 opacity-60">{copy.text}</p>}<HeroActions centered={centered} /></div>{layout !== 'minimal' && <HeroMedia className="m-5 min-h-[360px]" />}</div></section></Shell>;
}

function ImmersiveHero({ layout }: { layout: NonNullable<CompanyPageConfig['hero']>['layout'] }) {
  const { config, visual, spec } = useTheme();
  const copy = heroCopy();
  if (layout !== 'cover' && layout !== 'split') return <EditorialHero layout={layout} />;
  return <header className="relative min-h-screen overflow-hidden bg-black text-white"><div className="absolute inset-0" style={{ background: `radial-gradient(circle at 18% 18%,${visual.primary}66,transparent 31%),radial-gradient(circle at 84% 72%,${visual.accent}66,transparent 32%)` }} />{config.cover?.enabled && config.cover?.url && <img src={config.cover.url} alt="" className="pn-cover-image absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-screen" />}<div className="absolute -left-[7vw] top-[18vh] whitespace-nowrap text-[24vw] font-black uppercase leading-none tracking-[-.1em] text-white/[.055]">{spec.atmosphere || 'STUDIO'}</div><Shell className="relative z-10 flex min-h-screen flex-col"><div className="my-auto max-w-5xl py-24"><Eyebrow light>{copy.eyebrow}</Eyebrow><h1 className="mt-6 text-6xl font-black leading-[.8] tracking-[-.075em] sm:text-9xl">{copy.title}</h1>{copy.text && <p className="mt-8 max-w-2xl text-xl leading-8 text-white/60">{copy.text}</p>}<HeroActions light /></div><div className="pb-8 text-[10px] uppercase tracking-[.22em] text-white/35">Scroll to explore ↓</div></Shell></header>;
}

function InterfaceHero({ layout }: { layout: NonNullable<CompanyPageConfig['hero']>['layout'] }) {
  const { company, jobs, visual } = useTheme();
  const copy = heroCopy();
  if (layout === 'centered' || layout === 'minimal') return <EditorialHero layout={layout} />;
  if (layout === 'cover') return <CoverHero />;
  return <Shell><section className="grid min-h-[680px] items-end gap-10 border-x border-white/10 bg-black/[.12] p-7 text-current sm:p-12 lg:grid-cols-[1fr_.7fr]"><div><div className="text-[10px] uppercase tracking-[.22em] opacity-40">SYS / {location(company) || 'BR'} / ONLINE</div><h1 className="mt-8 text-6xl font-bold leading-[.82] tracking-[-.075em] sm:text-9xl">{copy.title}</h1>{copy.text && <p className="mt-8 max-w-2xl text-lg leading-8 opacity-50">{copy.text}</p>}<HeroActions /></div><div className="border border-current/15 bg-white/[.04] p-5 pn-corner"><HeroMedia className="min-h-[250px]" /><div className="mt-5 grid grid-cols-2 gap-5 text-[10px] uppercase tracking-[.16em] opacity-55"><span>Open jobs<br/><b className="text-lg opacity-100" style={{ color: visual.accent }}>{jobs.length}</b></span><span>Node<br/><b className="text-lg opacity-100">{company.state || 'BR'}</b></span></div></div></section></Shell>;
}

function PlaygroundHero({ layout }: { layout: NonNullable<CompanyPageConfig['hero']>['layout'] }) {
  const { visual } = useTheme();
  const copy = heroCopy();
  if (layout === 'cover') return <CoverHero />;
  return <><div className="overflow-hidden border-y-2 border-current py-3 text-center text-sm font-black uppercase tracking-[.18em]" style={{ background: visual.accent, color: contrastText(visual.accent) }}>MOVE • CREATE • PEOPLE • CULTURE • MOVE • CREATE • PEOPLE</div><Shell><section className={`relative my-5 min-h-[640px] overflow-hidden border-2 border-current p-7 sm:p-12 ${layout === 'centered' ? 'text-center' : ''}`}><div className="absolute -right-16 top-16 rotate-12 border-2 border-current bg-white px-8 py-4 text-xl font-black text-black">LIVE / 01</div><div className="flex min-h-[560px] flex-col justify-end"><Eyebrow>{copy.eyebrow}</Eyebrow><h1 className="mt-6 max-w-6xl text-7xl font-black uppercase leading-[.72] tracking-[-.075em] sm:text-9xl">{copy.title}</h1>{copy.text && <p className="mt-8 max-w-xl text-lg font-bold leading-8 opacity-60">{copy.text}</p>}<HeroActions centered={layout === 'centered'} /></div></section></Shell></>;
}

function ArchiveHero({ layout }: { layout: NonNullable<CompanyPageConfig['hero']>['layout'] }) {
  if (layout === 'cover') return <CoverHero />;
  const { company } = useTheme();
  const copy = heroCopy();
  return <Shell><header className="border-b-4 border-double border-current py-8 text-center"><CompanyLogo large /><div className="mt-6 flex items-center justify-center gap-2"><h1 className="font-serif text-5xl sm:text-7xl">{copy.title}</h1><VerifiedSeal /></div><div className="mt-5 grid grid-cols-3 border-t border-current/15 pt-3 text-[10px] uppercase tracking-[.18em]"><span>Archive 001</span><span>{copy.eyebrow}</span><span>{location(company)}</span></div></header>{copy.text && <p className="mx-auto max-w-3xl py-16 text-center text-xl leading-9 opacity-60">{copy.text}</p>}</Shell>;
}

function MonoHero({ layout }: { layout: NonNullable<CompanyPageConfig['hero']>['layout'] }) {
  if (layout === 'cover') return <CoverHero />;
  const copy = heroCopy();
  return <Shell><section className={`grid min-h-[650px] items-end gap-10 border-b border-current py-14 ${layout === 'centered' ? 'text-center' : 'lg:grid-cols-[1.2fr_.8fr]'}`}><div><Eyebrow>{copy.eyebrow}</Eyebrow><h1 className="mt-6 text-7xl font-medium leading-[.77] tracking-[-.08em] sm:text-9xl">{copy.title}</h1></div><div>{copy.text && <p className="text-lg leading-8 opacity-70">{copy.text}</p>}<HeroActions centered={layout === 'centered'} /></div></section></Shell>;
}

function CoverHero() {
  const { config, visual } = useTheme();
  const copy = heroCopy();
  const minHeight = coverHeight();
  return <header className="relative flex items-end overflow-hidden text-white" style={{ minHeight: Math.max(620, minHeight) }}>{config.cover?.enabled && config.cover?.url ? <img src={config.cover.url} alt="" className="pn-cover-image absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 72% 18%,${visual.accent}99,transparent 28%),linear-gradient(135deg,${visual.primary},#050505)` }} />}<div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/10" /><Shell className="relative z-10 pb-14 sm:pb-20"><Eyebrow light>{copy.eyebrow}</Eyebrow><h1 className="mt-6 max-w-6xl text-6xl font-black leading-[.82] tracking-[-.075em] sm:text-9xl">{copy.title}</h1>{copy.text && <p className="mt-8 max-w-2xl text-xl leading-8 text-white/65">{copy.text}</p>}<HeroActions light /></Shell></header>;
}

function HeroActions({ centered = false, light = false }: { centered?: boolean; light?: boolean }) {
  const { company, config, visual } = useTheme();
  const copy = heroCopy();
  return <div className={`mt-8 flex flex-wrap items-center gap-4 ${centered ? 'justify-center' : ''}`}><a href="#vagas" className="inline-flex items-center gap-2 px-5 py-3 text-sm font-bold pn-corner" style={{ background: light ? '#fff' : visual.primary, color: light ? '#111' : contrastText(visual.primary) }}>{copy.button}<ArrowRight className="h-4 w-4" /></a>{location(company) && <span className={`inline-flex items-center gap-2 text-sm ${light ? 'text-white/55' : 'opacity-50'}`}><MapPin className="h-4 w-4" />{location(company)}</span>}</div>;
}

function ThemeSections() {
  const { config } = useTheme();
  const sections = Array.isArray(config.sections) && config.sections.length ? config.sections : DEFAULT_SECTIONS;
  return <Shell>{sections.filter((section) => section.type !== 'identity').map((section) => {
    if (section.type === 'jobs') return <JobsSection key={section.id} />;
    if (section.enabled === false) return null;
    if (section.type === 'about') return <AboutSection key={section.id} />;
    if (section.type === 'contact') return <ContactSection key={section.id} />;
    if (section.type === 'socials') return <SocialSection key={section.id} />;
    if (section.type === 'legal') return <LegalSection key={section.id} />;
    return null;
  })}</Shell>;
}

function AboutSection() {
  const { company, config, spec } = useTheme();
  const text = config.about?.text || company.description;
  if (!text) return null;
  return <section id="sobre" className={`border-t border-current/15 py-16 sm:py-24 ${spec.archetype === 'editorial' || spec.archetype === 'archive' ? 'grid gap-10 md:grid-cols-[220px_1fr]' : ''}`}><div><Eyebrow>{config.about?.title || 'Sobre'}</Eyebrow></div><p className="max-w-5xl text-2xl leading-[1.45] tracking-[-.025em] opacity-75 sm:text-3xl">{text}</p></section>;
}

function JobsSection() {
  const { jobs, config, spec, visual } = useTheme();
  const layout = config.jobs?.layout || 'grid';
  const title = config.jobs?.title || 'Oportunidades';
  const intro = config.jobs?.intro || 'Conheça as oportunidades abertas.';
  return <section id="vagas" className="border-t border-current/15 py-16 sm:py-24"><div className="flex flex-wrap items-end justify-between gap-6"><div><Eyebrow>{title}</Eyebrow><h2 className="mt-4 text-4xl font-black tracking-[-.05em] sm:text-6xl">{jobs.length ? `${jobs.length} ${jobs.length === 1 ? 'oportunidade' : 'oportunidades'}` : 'Novas oportunidades em breve'}</h2></div><p className="max-w-md text-sm leading-6 opacity-50">{intro}</p></div>{!jobs.length ? <div className="mt-10 border-y border-current/15 py-10 text-sm opacity-50">Nenhuma vaga aberta neste momento.</div> : layout === 'list' ? <div className="mt-10 divide-y divide-current/15">{jobs.map((job, index) => <JobRow key={job.id || job.slug || job.title || index} job={job} index={index} />)}</div> : layout === 'compact' ? <div className="mt-10 border-y border-current/15">{jobs.map((job, index) => <Link key={job.id || job.slug || job.title || index} to={jobHref(job)} className="grid gap-2 border-b border-current/15 py-4 last:border-b-0 sm:grid-cols-[48px_1fr_auto] sm:items-center"><span className="text-[10px] opacity-30">{String(index + 1).padStart(2, '0')}</span><div><b>{job.title || 'Oportunidade'}</b><JobMeta job={job} compact /></div><ArrowRight className="h-4 w-4 opacity-35" /></Link>)}</div> : <div className={`mt-10 grid gap-4 ${spec.archetype === 'marketplace' || spec.archetype === 'storefront' ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2'}`}>{jobs.map((job, index) => <Link key={job.id || job.slug || job.title || index} to={jobHref(job)} className="group min-h-[210px] border border-current/12 p-6 pn-corner" style={{ background: index === 0 && spec.archetype === 'immersive' ? visual.primary : 'rgba(255,255,255,.045)', color: index === 0 && spec.archetype === 'immersive' ? contrastText(visual.primary) : undefined }}><div className="flex justify-between text-[10px] uppercase tracking-[.18em] opacity-35"><span>{String(index + 1).padStart(2, '0')}</span><ExternalLink className="h-4 w-4" /></div><h3 className="mt-12 text-2xl font-black tracking-[-.035em]">{job.title || 'Oportunidade'}</h3><JobMeta job={job} /></Link>)}</div>}</section>;
}

function JobRow({ job, index }: { job: PublicJobLike; index: number }) {
  return <Link to={jobHref(job)} className="group grid gap-4 py-6 sm:grid-cols-[64px_1fr_auto] sm:items-center"><span className="text-xs font-bold opacity-30">{String(index + 1).padStart(2, '0')}</span><div><h3 className="text-xl font-bold">{job.title || 'Oportunidade'}</h3><JobMeta job={job} /></div><ArrowRight className="h-5 w-5 opacity-30 transition group-hover:translate-x-1 group-hover:opacity-100" /></Link>;
}

function JobMeta({ job, compact = false }: { job: PublicJobLike; compact?: boolean }) {
  const loc = job.location || [job.city, job.state].filter(Boolean).join(', ') || 'Local a combinar';
  return <p className={`${compact ? 'mt-1 text-xs' : 'mt-2 text-sm'} opacity-45`}>{loc}{job.workModel ? ` · ${job.workModel}` : ''}{job.salary ? ` · ${job.salary}` : ''}</p>;
}

function ContactSection() {
  const { company, config } = useTheme();
  const items = contactItems(company, config);
  if (!items.length) return null;
  return <section id="contato" className="border-t border-current/15 py-16 sm:py-20"><Eyebrow>Contato</Eyebrow><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <a key={item.label} href={item.href || undefined} target={item.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="border border-current/12 p-5 pn-corner"><div className="flex items-center gap-2 text-[10px] uppercase tracking-[.16em] opacity-40">{item.icon}{item.label}</div><div className="mt-3 break-words font-semibold">{item.value}</div></a>)}</div></section>;
}

function SocialSection() {
  const { company, config } = useTheme();
  const items = [
    ['Instagram', config.socials?.instagram || company.socialInstagram, <Instagram className="h-4 w-4" />],
    ['LinkedIn', config.socials?.linkedin || company.socialLinkedin, <Linkedin className="h-4 w-4" />],
    ['Facebook', config.socials?.facebook || company.socialFacebook, <Facebook className="h-4 w-4" />],
    ['YouTube', config.socials?.youtube, <Youtube className="h-4 w-4" />],
    ['TikTok', config.socials?.tiktok, <Music2 className="h-4 w-4" />],
  ].filter((item) => Boolean(item[1])) as Array<[string, string, React.ReactNode]>;
  if (!items.length) return null;
  return <section className="border-t border-current/15 py-10"><div className="flex flex-wrap gap-5">{items.map(([label, href, icon]) => <a key={label} href={normalizeUrl(href)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm opacity-60">{icon}{label}</a>)}</div></section>;
}

function LegalSection() {
  const { config } = useTheme();
  const entries = [
    config.legal?.termsEnabled && { title: config.legal.termsTitle || 'Termos de uso', body: config.legal.termsBody || '' },
    config.legal?.privacyEnabled && { title: config.legal.privacyTitle || 'Política de privacidade', body: config.legal.privacyBody || '' },
  ].filter(Boolean) as Array<{ title: string; body: string }>;
  if (!entries.length) return null;
  return <section className="border-t border-current/15 py-12"><div className="grid gap-8 md:grid-cols-2">{entries.map((entry) => <details key={entry.title} className="border-b border-current/15 pb-5"><summary className="cursor-pointer font-bold">{entry.title}</summary>{entry.body && <p className="mt-4 whitespace-pre-wrap text-sm leading-7 opacity-60">{entry.body}</p>}</details>)}</div></section>;
}

function ThemeFooter() {
  const { company, config, preview } = useTheme();
  return <Shell><footer className="flex flex-col gap-3 border-t border-current/15 py-7 text-xs opacity-45 sm:flex-row sm:justify-between"><span>{config.footer?.text || `© ${new Date().getFullYear()} ${company.name || 'Empresa'}`}</span><Link to="/" className="underline underline-offset-4">{preview ? 'Prévia privada · ' : ''}PiraNegócios Business</Link></footer></Shell>;
}

function CompanyLogo({ large = false }: { large?: boolean }) {
  const { company, config, preset } = useTheme();
  const selected = config.branding?.logoSize || preset.branding.logoSize;
  const size = large
    ? selected === 'small' ? 'h-16 w-16' : selected === 'medium' ? 'h-20 w-20' : 'h-24 w-24'
    : selected === 'small' ? 'h-8 w-8' : selected === 'large' ? 'h-12 w-12' : 'h-10 w-10';
  const corner = config.branding?.corners === 'square' ? 'rounded-none' : config.branding?.corners === 'round' ? 'rounded-full' : 'pn-corner';
  if (company.logoURL) return <img data-company-logo src={company.logoURL} alt={`Logo ${company.name || ''}`} className={`${size} ${corner} shrink-0 object-contain`} />;
  return <span className={`${size} ${corner} inline-flex shrink-0 items-center justify-center border border-current/15`}><Building2 className="h-5 w-5 opacity-40" /></span>;
}

function VerifiedSeal() {
  const { company } = useTheme();
  if (!(company.isVerified || company.verificationStatus === 'VERIFIED')) return null;
  return <span title="Empresa verificada pelo PiraNegócios" aria-label="Empresa verificada pelo PiraNegócios" className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"><BadgeCheck className="h-5 w-5" /></span>;
}

function Eyebrow({ children, light = false, className = '' }: { children: React.ReactNode; light?: boolean; className?: string }) {
  return <div className={`text-[10px] font-black uppercase tracking-[.24em] ${light ? 'text-white/55' : 'opacity-45'} ${className}`}>{children}</div>;
}

function contactItems(company: PublicCompanyLike, config: CompanyPageConfig) {
  const phone = config.contacts?.phone || company.phone || '';
  const second = config.contacts?.secondaryPhone || '';
  const whatsapp = config.contacts?.whatsapp || '';
  const email = config.contacts?.email || '';
  const website = config.contacts?.website || company.website || '';
  return [
    phone && { label: 'Telefone', value: phone, href: `tel:${phone.replace(/\D/g, '')}`, icon: <Phone className="h-4 w-4" /> },
    second && { label: 'Telefone 2', value: second, href: `tel:${second.replace(/\D/g, '')}`, icon: <Phone className="h-4 w-4" /> },
    whatsapp && { label: 'WhatsApp', value: whatsapp, href: `https://wa.me/55${whatsapp.replace(/\D/g, '')}`, icon: <Phone className="h-4 w-4" /> },
    email && { label: 'E-mail', value: email, href: `mailto:${email}`, icon: <Mail className="h-4 w-4" /> },
    website && { label: 'Site', value: website, href: normalizeUrl(website), icon: <Globe2 className="h-4 w-4" /> },
    location(company) && { label: 'Endereço', value: location(company), href: '', icon: <MapPin className="h-4 w-4" /> },
  ].filter(Boolean) as Array<{ label: string; value: string; href: string; icon: React.ReactNode }>;
}

function location(company: PublicCompanyLike) {
  return company.address || company.cityState || [company.city, company.state].filter(Boolean).join(', ');
}

function normalizeUrl(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return /^(https?:|mailto:|tel:)/i.test(raw) ? raw : `https://${raw}`;
}

function jobHref(job: PublicJobLike) {
  return job.slug ? `/vagas/${encodeURIComponent(job.slug)}` : '/vagas';
}

function contrastText(hex: string) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#fff';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111' : '#fff';
}
