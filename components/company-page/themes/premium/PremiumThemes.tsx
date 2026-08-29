import { Search } from 'lucide-react';
import {
  ThemeProvider, ThemeRoot, ThemeNavigation, SectionStream, ThemeFooter,
  InternalPageOverlay, Shell, Eyebrow, HeroActions, HeroMedia, CompanyLogo,
  VerifiedBadge, heroCopy, useTheme, contrastText, coverUrl, companyLocation,
} from '../ThemeEngine';
import { THEME_PRESETS } from '../ThemeRegistry';
import type { CompanyPageConfig } from '../../CompanyPageExtensions';
import type { PublicCompanyLike, PublicJobLike } from '../../PremiumCompanySiteRenderer';

type Props = { company: PublicCompanyLike; jobs: PublicJobLike[]; config: CompanyPageConfig; preview?: boolean };

// ═════════════════════════════════════════════════════════════════════════════
// EMPIRE — Corporate Luxury
// ═════════════════════════════════════════════════════════════════════════════

export function EmpireTheme(props: Props) {
  return (
    <ThemeProvider themeKey="empire" preset={THEME_PRESETS.empire} {...props}>
      <ThemeRoot>
        <EmpireNav />
        <EmpireHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function EmpireNav() {
  const { company, config, visual } = useTheme();
  if (config.navigation?.enabled === false) return null;
  return (
    <nav className="border-b" style={{ borderColor: `${visual.accent}30` }}>
      <Shell>
        <div className="flex min-h-20 items-center gap-4">
          <CompanyLogo />
          <div>
            <b className="text-sm tracking-[.04em]">{company.name}</b>
            <VerifiedBadge />
          </div>
          <div className="ml-auto hidden items-center gap-8 text-[10px] font-bold uppercase tracking-[.2em] opacity-45 md:flex">
            <a href="#sobre">Institucional</a>
            <a href="#vagas">Carreiras</a>
            <a href="#contato">Contato</a>
          </div>
          <a href="#vagas" className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold md:ml-3" style={{ background: visual.accent, color: contrastText(visual.accent) }}>
            Carreiras <span className="opacity-60">→</span>
          </a>
        </div>
      </Shell>
    </nav>
  );
}

function EmpireHero() {
  const { company, jobs, visual, config } = useTheme();
  const copy = heroCopy();
  const cover = coverUrl(config);
  return (
    <header className="relative min-h-[85vh] overflow-hidden" style={{ background: visual.primary }}>
      {cover ? <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" /> : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${visual.primary}, ${visual.primary}dd),url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h60v60H0z' fill='none' stroke='%23${visual.accent.slice(1)}22' stroke-width='.5'/%3E%3C/svg%3E")` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
      {/* Gold line accent */}
      <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, ${visual.accent}, transparent)` }} />
      <Shell className="relative z-10 flex min-h-[85vh] items-end pb-20 text-white">
        <div className="max-w-5xl">
          <div className="inline-flex items-center gap-2 border px-4 py-2 text-[10px] font-bold uppercase tracking-[.2em]" style={{ borderColor: `${visual.accent}55`, color: visual.accent }}>
            ✦ {copy.eyebrow || 'Excelência corporativa'}
          </div>
          <h1 className="mt-8 font-serif text-6xl leading-[.85] tracking-[-.04em] sm:text-8xl lg:text-[110px]">{copy.title}</h1>
          {copy.text && <p className="mt-8 max-w-2xl text-lg leading-8 text-white/60">{copy.text}</p>}
          <HeroActions light />
          <div className="mt-12 grid grid-cols-3 gap-8 border-t border-white/15 pt-8 text-xs">
            <div><span className="opacity-40">FUNDAÇÃO</span><br/><b className="text-lg">{company.name?.split(' ').length || '—'}</b></div>
            <div><span className="opacity-40">VAGAS</span><br/><b className="text-lg">{jobs.length}</b></div>
            <div><span className="opacity-40">REGIÃO</span><br/><b className="text-lg">{company.state || 'BR'}</b></div>
          </div>
        </div>
      </Shell>
    </header>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STUDIO-PRO — Immersive Creative
// ═════════════════════════════════════════════════════════════════════════════

export function StudioProTheme(props: Props) {
  return (
    <ThemeProvider themeKey="studio-pro" preset={THEME_PRESETS['studio-pro']} {...props}>
      <ThemeRoot>
        <ThemeNavigation variant="dark" />
        <StudioHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function StudioHero() {
  const { config, visual } = useTheme();
  const copy = heroCopy();
  const cover = coverUrl(config);
  return (
    <header className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 18% 18%,${visual.primary}66,transparent 31%),radial-gradient(circle at 84% 72%,${visual.accent}66,transparent 32%)` }} />
      {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-screen" />}
      {/* Giant watermark */}
      <div className="absolute -left-[7vw] top-[18vh] whitespace-nowrap text-[24vw] font-black uppercase leading-none tracking-[-.1em] text-white/[.04]">STUDIO</div>
      <Shell className="relative z-10 flex min-h-screen flex-col">
        <div className="my-auto max-w-5xl py-24">
          <Eyebrow light>{copy.eyebrow || 'Brand / digital / motion'}</Eyebrow>
          <h1 className="mt-6 text-6xl font-black leading-[.8] tracking-[-.075em] sm:text-9xl">{copy.title}</h1>
          {copy.text && <p className="mt-8 max-w-2xl text-xl leading-8 text-white/60">{copy.text}</p>}
          <HeroActions light />
        </div>
        <div className="pb-8 text-[10px] uppercase tracking-[.22em] text-white/35">Scroll to explore ↓</div>
      </Shell>
    </header>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GOURMET — Fine Dining
// ═════════════════════════════════════════════════════════════════════════════

export function GourmetTheme(props: Props) {
  return (
    <ThemeProvider themeKey="gourmet" preset={THEME_PRESETS.gourmet} {...props}>
      <ThemeRoot>
        <GourmetNav />
        <GourmetHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function GourmetNav() {
  const { company, config, visual } = useTheme();
  if (config.navigation?.enabled === false) return null;
  return (
    <nav className="border-b border-white/10">
      <Shell>
        <div className="flex h-20 items-center">
          <div className="font-serif text-xl" style={{ color: visual.primary }}>{company.name}</div>
          <VerifiedBadge inverted />
          <div className="ml-auto text-[10px] uppercase tracking-[.22em] text-white/30">Experience</div>
        </div>
      </Shell>
    </nav>
  );
}

function GourmetHero() {
  const { visual, config, company } = useTheme();
  const copy = heroCopy();
  const cover = coverUrl(config);
  return (
    <header className="relative min-h-[90vh] overflow-hidden text-white">
      {cover ? <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ filter: 'brightness(.4) saturate(.9)' }} /> : (
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 100%, ${visual.primary}44, transparent 50%),#0c0c0c` }} />
      )}
      <Shell className="relative z-10 flex min-h-[90vh] flex-col items-center justify-center text-center">
        <div className="mb-4 text-[10px] uppercase tracking-[.3em]" style={{ color: visual.primary }}>{copy.eyebrow || 'Experiência'}</div>
        <h1 className="max-w-5xl font-serif text-6xl leading-[.9] sm:text-8xl lg:text-[120px]">{copy.title}</h1>
        {copy.text && <p className="mx-auto mt-8 max-w-xl text-lg leading-8" style={{ color: `${visual.text}99` }}>{copy.text}</p>}
        <div className="mt-10 h-px w-24" style={{ background: visual.primary }} />
        <div className="mt-4 text-xs uppercase tracking-[.2em] opacity-40">{companyLocation(company)}</div>
        <HeroActions light centered />
      </Shell>
    </header>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// RUNWAY — Campaign Hero / High Fashion
// ═════════════════════════════════════════════════════════════════════════════

export function RunwayTheme(props: Props) {
  return (
    <ThemeProvider themeKey="runway" preset={THEME_PRESETS.runway} {...props}>
      <ThemeRoot>
        <ThemeNavigation variant="dark" />
        <RunwayHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function RunwayHero() {
  const { visual, config } = useTheme();
  const copy = heroCopy();
  const cover = coverUrl(config);
  return (
    <header className="relative min-h-screen overflow-hidden bg-black text-white">
      {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-65" />}
      {!cover && <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom right, ${visual.accent}33, transparent 40%)` }} />}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
      <Shell className="relative z-10 flex min-h-screen flex-col justify-end pb-20">
        <Eyebrow light>{copy.eyebrow || 'Collection'}</Eyebrow>
        <h1 className="mt-4 max-w-[1200px] text-[15vw] font-black uppercase leading-[.68] tracking-[-.08em] sm:text-[10vw]">{copy.title}</h1>
        {copy.text && <p className="mt-8 max-w-2xl text-lg leading-8 text-white/55">{copy.text}</p>}
        <HeroActions light />
      </Shell>
    </header>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PORTAL — Multi-Business Marketplace
// ═════════════════════════════════════════════════════════════════════════════

export function PortalTheme(props: Props) {
  return (
    <ThemeProvider themeKey="portal" preset={THEME_PRESETS.portal} {...props}>
      <ThemeRoot>
        <ThemeNavigation />
        <PortalHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function PortalHero() {
  const { company, jobs, visual, config } = useTheme();
  const copy = heroCopy();
  const cover = coverUrl(config);
  const style = config.storefront?.bannerStyle || 'split';

  const renderSearch = () => config.storefront?.showSearch !== false && (
    <div className="mb-6 flex items-center rounded-2xl border border-current/10 bg-white px-6 py-4 shadow-sm" style={{ color: '#000' }}>
      <Search className="mr-3 h-5 w-5 opacity-35" />
      <span className="text-sm opacity-40">{config.storefront?.searchPlaceholder || 'Buscar produtos, serviços e vagas...'}</span>
      <button className="ml-auto rounded-xl px-5 py-2 text-xs font-bold text-white" style={{ background: visual.primary }}>Buscar</button>
    </div>
  );

  if (style === 'full') {
    return (
      <Shell>
        <section className="py-8">
          <div className="relative min-h-[500px] overflow-hidden rounded-3xl bg-black text-white p-10 sm:p-16">
            {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />}
            <div className="absolute inset-0" style={{ background: `linear-gradient(to top right, ${visual.primary}dd, transparent)` }} />
            <div className="relative z-10 flex h-full flex-col justify-end">
              <div className="max-w-2xl">
                <Eyebrow light>{copy.eyebrow || 'Portal de negócios'}</Eyebrow>
                <h1 className="mt-4 text-5xl font-black leading-[.88] tracking-[-.05em] sm:text-7xl">{copy.title}</h1>
                {copy.text && <p className="mt-5 text-lg leading-7 text-white/70">{copy.text}</p>}
              </div>
              <div className="mt-10 max-w-3xl">{renderSearch()}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl p-6" style={{ background: `${visual.accent}15` }}>
              <p className="text-2xl font-black">{jobs.length}</p>
              <p className="text-xs font-bold opacity-60">Oportunidades</p>
            </div>
            <div className="col-span-2 rounded-2xl border border-current/10 p-6 flex items-center gap-4">
              <CompanyLogo />
              <div>
                <p className="font-bold">{company.name}</p>
                <p className="text-xs opacity-40">{companyLocation(company)}</p>
              </div>
            </div>
          </div>
        </section>
      </Shell>
    );
  }

  if (style === 'compact') {
    return (
      <Shell>
        <section className="py-8">
          <div className="flex flex-col items-center justify-center rounded-3xl p-10 text-center sm:p-16" style={{ background: `${visual.primary}12` }}>
            <Eyebrow>{copy.eyebrow || 'Portal de negócios'}</Eyebrow>
            <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[.88] tracking-[-.05em] sm:text-6xl">{copy.title}</h1>
            <div className="mt-10 w-full max-w-2xl">{renderSearch()}</div>
          </div>
        </section>
      </Shell>
    );
  }

  if (style === 'editorial') {
    return (
      <Shell>
        <section className="py-12">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-16 items-center">
            <div>
              <Eyebrow>{copy.eyebrow || 'Portal de negócios'}</Eyebrow>
              <h1 className="mt-4 font-serif text-6xl leading-[.95] tracking-tight sm:text-7xl">{copy.title}</h1>
              {copy.text && <p className="mt-6 text-xl leading-relaxed opacity-60">{copy.text}</p>}
              <div className="mt-10">{renderSearch()}</div>
            </div>
            <div className="grid gap-4">
              {cover && <div className="aspect-[4/3] overflow-hidden rounded-3xl"><img src={cover} alt="" className="h-full w-full object-cover" /></div>}
              <div className="flex items-center gap-4 rounded-3xl p-6" style={{ background: `${visual.accent}15` }}>
                <span className="text-4xl">💼</span>
                <div>
                  <p className="text-xl font-black">{jobs.length}</p>
                  <p className="text-sm font-bold opacity-60">oportunidades</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </Shell>
    );
  }

  // Default: split
  return (
    <Shell>
      <section className="py-8">
        {/* Search bar */}
        {renderSearch()}
        {/* Hero grid */}
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="relative min-h-[420px] overflow-hidden rounded-2xl p-8 sm:p-12" style={{ background: `linear-gradient(135deg, ${visual.primary}, ${visual.primary}cc)` }}>
            {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />}
            <div className="relative z-10 flex h-full flex-col justify-end text-white">
              <Eyebrow light>{copy.eyebrow || 'Portal de negócios'}</Eyebrow>
              <h1 className="mt-4 text-5xl font-black leading-[.88] tracking-[-.05em] sm:text-7xl">{copy.title}</h1>
              {copy.text && <p className="mt-5 max-w-lg text-base leading-7 text-white/60">{copy.text}</p>}
            </div>
          </div>
          <div className="grid gap-4">
            <div className="rounded-2xl p-6" style={{ background: `${visual.accent}15` }}>
              <span className="text-3xl">💼</span>
              <p className="mt-3 text-4xl font-black">{jobs.length}</p>
              <p className="text-sm opacity-55">oportunidades abertas</p>
            </div>
            <div className="rounded-2xl border border-current/10 p-6">
              <CompanyLogo />
              <p className="mt-3 font-bold">{company.name}</p>
              <p className="text-sm opacity-40">{companyLocation(company)}</p>
              <VerifiedBadge />
            </div>
          </div>
        </div>
      </section>
    </Shell>
  );
}
