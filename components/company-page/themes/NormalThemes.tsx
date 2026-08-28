import { ArrowRight, Search } from 'lucide-react';
import {
  ThemeProvider, ThemeRoot, ThemeNavigation, SectionStream, ThemeFooter,
  InternalPageOverlay, Shell, Eyebrow, HeroActions, HeroMedia, CompanyLogo,
  VerifiedBadge, heroCopy, useTheme, contrastText, coverUrl,
} from './ThemeEngine';
import { THEME_PRESETS } from './ThemeRegistry';
import type { ThemeKey } from './ThemeEngine';
import type { CompanyPageConfig } from '../CompanyPageExtensions';
import type { PublicCompanyLike, PublicJobLike } from '../PremiumCompanySiteRenderer';

type Props = { company: PublicCompanyLike; jobs: PublicJobLike[]; config: CompanyPageConfig; preview?: boolean };

// ═════════════════════════════════════════════════════════════════════════════
// HORIZON — Institutional Gradient / Aurora Borealis
// ═════════════════════════════════════════════════════════════════════════════

export function HorizonTheme(props: Props) {
  return (
    <ThemeProvider themeKey="horizon" preset={THEME_PRESETS.horizon} {...props}>
      <ThemeRoot>
        <ThemeNavigation variant="transparent" />
        <HorizonHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function HorizonHero() {
  const { visual, config } = useTheme();
  const copy = heroCopy();
  const hasCover = Boolean(config.cover?.enabled && config.cover?.url);
  return (
    <Shell className="pt-4 sm:pt-6">
      <section className="relative min-h-[720px] overflow-hidden pn-r" style={{ background: '#071635' }}>
        {hasCover && <img src={config.cover?.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" style={{ objectPosition: config.cover?.position || 'center' }} />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#06112b] via-transparent to-[#06112b]/15" />
        {/* Aurora blobs */}
        <div className="absolute -left-[10%] -top-[18%] h-[75%] w-[70%] rounded-full blur-[80px]" style={{ background: visual.primary, opacity: .48, animation: 'pnBlob1 13s ease-in-out infinite' }} />
        <div className="absolute -bottom-[20%] right-[-8%] h-[75%] w-[65%] rounded-full blur-[90px]" style={{ background: visual.accent, opacity: .45, animation: 'pnBlob2 16s ease-in-out infinite' }} />
        <div className="absolute left-[35%] top-[12%] h-[55%] w-[40%] rounded-full blur-[90px]" style={{ background: '#c084fc', opacity: .3, animation: 'pnBlob2 19s ease-in-out infinite reverse' }} />
        {/* Content */}
        <div className="relative z-10 flex min-h-[720px] items-end pb-14 pt-28 text-white">
          <Shell>
            <div className="max-w-4xl">
              {copy.eyebrow && <Eyebrow light>{copy.eyebrow}</Eyebrow>}
              <h1 className="mt-4 text-5xl font-semibold leading-[.9] tracking-[-.055em] sm:text-7xl lg:text-[92px]">{copy.title}</h1>
              {copy.text && <p className="mt-5 max-w-2xl text-lg leading-8 text-white/70">{copy.text}</p>}
              <HeroActions light />
            </div>
          </Shell>
        </div>
        {/* Glassmorphism overlay card */}
        <div className="absolute bottom-8 right-8 hidden rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-xl lg:block" style={{ width: 280 }}>
          <CompanyLogo />
          <p className="mt-3 text-sm font-bold text-white">{copy.title}</p>
          <p className="mt-1 text-xs text-white/50">Integrado ao PiraNegócios</p>
        </div>
      </section>
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MONUMENT — Swiss Grid Corporate
// ═════════════════════════════════════════════════════════════════════════════

export function MonumentTheme(props: Props) {
  return (
    <ThemeProvider themeKey="monument" preset={THEME_PRESETS.monument} {...props}>
      <ThemeRoot>
        <ThemeNavigation variant="editorial" />
        <MonumentHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function MonumentHero() {
  const { company, jobs, visual, config } = useTheme();
  const copy = heroCopy();
  const hasCover = coverUrl(config);
  return (
    <Shell>
      <section className="grid min-h-[680px] border-b-2 border-current py-14 lg:grid-cols-[180px_1fr_280px] lg:gap-10">
        <div className="text-xs uppercase tracking-[.18em] opacity-40">001<br/>Apresentação</div>
        <div>
          <h1 className="max-w-5xl text-6xl leading-[.88] tracking-[-.065em] sm:text-8xl">{copy.title}</h1>
          {copy.text && <p className="mt-8 max-w-2xl text-lg leading-8 opacity-65">{copy.text}</p>}
          <HeroActions />
        </div>
        <div className="border-l border-current/20 pl-6 text-sm">
          <MonumentRow label="Empresa" value={company.name || ''} />
          <MonumentRow label="Local" value={company.cityState || [company.city, company.state].filter(Boolean).join(', ') || 'Brasil'} />
          <MonumentRow label="Vagas" value={String(jobs.length)} />
          <MonumentRow label="Status" value="Verificada" />
        </div>
      </section>
      {hasCover && (
        <div className="my-8 overflow-hidden">
          <img src={hasCover} alt="" className="h-[400px] w-full object-cover grayscale" style={{ objectPosition: config.cover?.position || 'center' }} />
        </div>
      )}
    </Shell>
  );
}

function MonumentRow({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-current/15 py-4"><div className="text-[10px] uppercase tracking-[.18em] opacity-40">{label}</div><div className="mt-2 font-bold">{value}</div></div>;
}

// ═════════════════════════════════════════════════════════════════════════════
// SABOR — Taste Forward / Food
// ═════════════════════════════════════════════════════════════════════════════

export function SaborTheme(props: Props) {
  return (
    <ThemeProvider themeKey="sabor" preset={THEME_PRESETS.sabor} {...props}>
      <ThemeRoot>
        <ThemeNavigation />
        <SaborHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function SaborHero() {
  const { visual, config } = useTheme();
  const copy = heroCopy();
  const hasCover = coverUrl(config);
  return (
    <Shell className="pt-4">
      <section className="relative min-h-[620px] overflow-hidden pn-r" style={{ background: `linear-gradient(135deg, ${visual.primary}18, ${visual.accent}12)` }}>
        <div className="grid lg:grid-cols-[1fr_1.08fr]">
          <div className="flex min-h-[510px] flex-col justify-center p-8 sm:p-12">
            <Eyebrow>Conheça a casa</Eyebrow>
            <h1 className="mt-5 text-6xl font-black leading-[.9] tracking-[-.06em] sm:text-8xl">{copy.title}</h1>
            {copy.text && <p className="mt-7 max-w-xl text-lg leading-8 opacity-60">{copy.text}</p>}
            <div className="mt-8 flex flex-wrap gap-2">
              {['Cardápio', 'Delivery', 'Contato'].map(chip => (
                <span key={chip} className="rounded-full border border-current/15 px-4 py-2 text-xs font-bold opacity-60">{chip}</span>
              ))}
            </div>
            <HeroActions />
          </div>
          <div className="min-h-[420px] overflow-hidden rounded-bl-[80px]">
            {hasCover ? <img src={hasCover} alt="" className="h-full min-h-[420px] w-full object-cover" /> : (
              <div className="flex h-full min-h-[420px] items-center justify-center" style={{ background: `radial-gradient(circle at 60% 40%, ${visual.primary}44, ${visual.accent}22)` }}>
                <span className="text-8xl">🍽️</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// OFÍCIO — Trust First / Services
// ═════════════════════════════════════════════════════════════════════════════

export function OficioTheme(props: Props) {
  return (
    <ThemeProvider themeKey="oficio" preset={THEME_PRESETS.oficio} {...props}>
      <ThemeRoot>
        <ThemeNavigation />
        <OficioHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function OficioHero() {
  const { company, jobs, visual, config } = useTheme();
  const copy = heroCopy();
  return (
    <Shell className="pt-4">
      <section className="grid min-h-[560px] gap-8 py-10 lg:grid-cols-[1.1fr_.9fr]">
        <div className="flex flex-col justify-center">
          <Eyebrow>Confiança em primeiro lugar</Eyebrow>
          <h1 className="mt-5 text-5xl font-black leading-[.9] tracking-[-.06em] sm:text-7xl">{copy.title}</h1>
          {copy.text && <p className="mt-6 max-w-xl text-lg leading-8 opacity-60">{copy.text}</p>}
          <HeroActions />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <OficioCard icon="📍" label="Localização" value={company.cityState || [company.city, company.state].filter(Boolean).join(', ') || 'Brasil'} />
          <OficioCard icon="💼" label="Oportunidades" value={`${jobs.length} vagas abertas`} />
          <OficioCard icon="✅" label="Verificação" value="Empresa verificada" />
          <OficioCard icon="📞" label="Contato" value={config.contacts?.phone || company.phone || 'Disponível'} />
        </div>
      </section>
    </Shell>
  );
}

function OficioCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  const { visual } = useTheme();
  return (
    <div className="rounded-2xl border border-current/10 p-5 transition hover:shadow-lg" style={{ background: `${visual.primary}08` }}>
      <span className="text-2xl">{icon}</span>
      <p className="mt-3 text-[10px] font-black uppercase tracking-[.16em] opacity-40">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ATELIÊ — Editorial / Fashion
// ═════════════════════════════════════════════════════════════════════════════

export function AtelieTheme(props: Props) {
  return (
    <ThemeProvider themeKey="atelie" preset={THEME_PRESETS.atelie} {...props}>
      <ThemeRoot>
        <AtelieNav />
        <AtelieHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function AtelieNav() {
  const { company, config } = useTheme();
  if (config.navigation?.enabled === false) return null;
  return (
    <nav className="border-b border-current/15">
      <Shell>
        <div className="flex h-24 items-center">
          <div className="font-serif text-xl italic">{company.name}</div>
          <VerifiedBadge />
          <div className="ml-auto text-[10px] uppercase tracking-[.2em] opacity-40">Maison / story</div>
        </div>
      </Shell>
    </nav>
  );
}

function AtelieHero() {
  const { visual, config } = useTheme();
  const copy = heroCopy();
  const cover = coverUrl(config);
  return (
    <Shell>
      <section className="grid min-h-[720px] gap-12 py-16 lg:grid-cols-[.75fr_1.25fr]">
        <div className="flex flex-col justify-between">
          <div>
            <Eyebrow>A considered collection</Eyebrow>
            <h1 className="mt-8 font-serif text-6xl leading-[.98] sm:text-8xl">{copy.title}</h1>
          </div>
          {copy.text && <p className="max-w-lg text-lg leading-8 opacity-60">{copy.text}</p>}
          <HeroActions />
        </div>
        <div className="min-h-[560px] overflow-hidden pn-r">
          {cover ? <img src={cover} alt="" className="h-full min-h-[560px] w-full object-cover" style={{ objectPosition: config.cover?.position || 'center' }} /> : (
            <div className="flex h-full min-h-[560px] items-center justify-center" style={{ background: `linear-gradient(135deg, ${visual.primary}22, ${visual.accent}33)` }}>
              <CompanyLogo large />
            </div>
          )}
        </div>
      </section>
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// NEON — Dark Interface / Tech
// ═════════════════════════════════════════════════════════════════════════════

export function NeonTheme(props: Props) {
  return (
    <ThemeProvider themeKey="neon" preset={THEME_PRESETS.neon} {...props}>
      <ThemeRoot>
        <ThemeNavigation variant="dark" />
        <NeonHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function NeonHero() {
  const { company, jobs, visual, config } = useTheme();
  const copy = heroCopy();
  const cover = coverUrl(config);
  return (
    <Shell className="pt-4">
      <section className="relative min-h-[760px] overflow-hidden border border-cyan-400/30 bg-[#030713] text-white" style={{ clipPath: 'polygon(0 0,97% 0,100% 5%,100% 100%,3% 100%,0 95%)' }}>
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(0,229,255,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(255,43,214,.12) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        {/* Glow */}
        <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 78% 30%,${visual.accent}55,transparent 24%),radial-gradient(circle at 25% 65%,${visual.primary}44,transparent 30%)`, animation: 'pnGlow 5s ease-in-out infinite' }} />
        {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-screen" />}
        <Shell>
          <div className="relative z-10 grid min-h-[760px] items-center gap-10 py-20 lg:grid-cols-[1fr_.85fr]">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.25em] text-cyan-300">// {copy.eyebrow || 'SYSTEM READY'}</div>
              <h1 className="mt-5 text-6xl font-black uppercase leading-[.78] tracking-[-.07em] sm:text-8xl" style={{ textShadow: `0 0 28px ${visual.primary}55` }}>{copy.title}</h1>
              {copy.text && <p className="mt-7 max-w-2xl text-lg leading-8 text-white/65">{copy.text}</p>}
              <HeroActions light />
            </div>
            <div className="hidden border border-fuchsia-400/30 bg-white/[.03] p-4 lg:block" style={{ clipPath: 'polygon(8% 0,100% 0,100% 90%,92% 100%,0 100%,0 10%)' }}>
              <div className="flex min-h-[330px] flex-col justify-between p-6">
                <span className="text-cyan-300 text-4xl">⚡</span>
                <div>
                  <div className="text-[10px] uppercase tracking-[.2em] text-fuchsia-300">OPEN MISSIONS</div>
                  <div className="mt-3 text-7xl font-black">{String(jobs.length).padStart(2, '0')}</div>
                </div>
              </div>
            </div>
          </div>
        </Shell>
      </section>
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FLORA — Organic / Nature
// ═════════════════════════════════════════════════════════════════════════════

export function FloraTheme(props: Props) {
  return (
    <ThemeProvider themeKey="flora" preset={THEME_PRESETS.flora} {...props}>
      <ThemeRoot>
        <ThemeNavigation variant="editorial" />
        <FloraHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function FloraHero() {
  const { visual, config } = useTheme();
  const copy = heroCopy();
  const cover = coverUrl(config);
  return (
    <header className="relative min-h-[85vh] overflow-hidden text-white">
      {cover ? <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75" /> : (
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 65% 30%, ${visual.accent}66, transparent 30%),linear-gradient(135deg, ${visual.primary}, #1a2e1a)` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/30" />
      <Shell className="relative z-10 flex min-h-[85vh] flex-col">
        <div className="mt-auto pb-14">
          <Eyebrow light>{copy.eyebrow || 'Paisagem / origem'}</Eyebrow>
          <h1 className="mt-5 max-w-[1200px] font-serif text-6xl leading-[.85] sm:text-8xl lg:text-[96px]">{copy.title}</h1>
          {copy.text && <p className="mt-8 max-w-2xl text-lg leading-8 text-white/60">{copy.text}</p>}
          <HeroActions light />
        </div>
      </Shell>
    </header>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PULSE-EV — Live Energy / Events
// ═════════════════════════════════════════════════════════════════════════════

export function PulseEvTheme(props: Props) {
  return (
    <ThemeProvider themeKey="pulse-ev" preset={THEME_PRESETS['pulse-ev']} {...props}>
      <ThemeRoot>
        <PulseMarquee />
        <ThemeNavigation variant="dark" />
        <PulseHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function PulseMarquee() {
  const { visual } = useTheme();
  return (
    <div className="overflow-hidden whitespace-nowrap border-y-2 py-3 text-center text-sm font-black uppercase tracking-[.18em]" style={{ background: visual.accent, color: contrastText(visual.accent), borderColor: `${visual.accent}88` }}>
      <div style={{ animation: 'pnMarquee 20s linear infinite', display: 'inline-block' }}>
        LIVE • EXPERIENCE • CREATE • MOVE • CULTURE • LIVE • EXPERIENCE • CREATE • MOVE • CULTURE •&nbsp;
      </div>
    </div>
  );
}

function PulseHero() {
  const { visual, config } = useTheme();
  const copy = heroCopy();
  const cover = coverUrl(config);
  return (
    <header className="relative min-h-[90vh] overflow-hidden text-white">
      {cover ? <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" /> : (
        <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 30% 70%, ${visual.primary}88, transparent 30%),radial-gradient(circle at 70% 30%, ${visual.accent}66, transparent 30%),#111` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
      <Shell className="relative z-10 flex min-h-[90vh] flex-col justify-end pb-20">
        <Eyebrow light>{copy.eyebrow || 'LIVE NOW'}</Eyebrow>
        <h1 className="mt-5 max-w-6xl text-7xl font-black uppercase leading-[.72] tracking-[-.075em] sm:text-9xl">{copy.title}</h1>
        {copy.text && <p className="mt-8 max-w-xl text-lg font-bold leading-8 text-white/60">{copy.text}</p>}
        <HeroActions light />
      </Shell>
    </header>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// VITRINE — Smart Store / Commerce
// ═════════════════════════════════════════════════════════════════════════════

export function VitrineTheme(props: Props) {
  return (
    <ThemeProvider themeKey="vitrine" preset={THEME_PRESETS.vitrine} {...props}>
      <ThemeRoot>
        <ThemeNavigation />
        <VitrineHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function VitrineHero() {
  const { visual, config, company } = useTheme();
  const copy = heroCopy();
  const cover = coverUrl(config);
  const promo = config.storefront?.promoText;
  return (
    <>
      {promo && (
        <div className="border-b py-2.5 text-center text-xs font-bold" style={{ background: `${visual.primary}12`, borderColor: `${visual.primary}22` }}>
          <span style={{ color: visual.primary }}>✦</span> {promo}
        </div>
      )}
      <Shell className="pt-6">
        <section className="relative min-h-[520px] overflow-hidden pn-r" style={{ background: `linear-gradient(135deg, ${visual.primary}15, ${visual.accent}10)` }}>
          <div className="grid lg:grid-cols-2">
            <div className="flex min-h-[520px] flex-col justify-center p-8 sm:p-12">
              <span className="inline-flex items-center gap-2 rounded-full border border-current/10 bg-white/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em]">
                <span style={{ color: visual.primary }}>●</span> {copy.eyebrow || 'Loja oficial'}
              </span>
              <h1 className="mt-6 text-5xl font-black leading-[.88] tracking-[-.06em] sm:text-7xl">{copy.title}</h1>
              {copy.text && <p className="mt-5 max-w-lg text-lg leading-8 opacity-60">{copy.text}</p>}
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#vitrine" className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-black pn-r" style={{ background: visual.primary, color: contrastText(visual.primary) }}>
                  Explorar loja <ArrowRight className="h-4 w-4" />
                </a>
                <a href="#vagas" className="inline-flex items-center gap-2 border border-current/12 px-6 py-3.5 text-sm font-bold pn-r">
                  Trabalhe conosco
                </a>
              </div>
            </div>
            <div className="relative hidden min-h-[520px] lg:block">
              {cover ? <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" /> : (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: `radial-gradient(circle at 50% 50%, ${visual.primary}33, ${visual.accent}11)` }}>
                  <div className="rounded-3xl border border-current/10 bg-white/80 p-8 shadow-2xl backdrop-blur-xl">
                    <CompanyLogo large />
                    <p className="mt-4 text-center font-bold">{company.name}</p>
                    <p className="mt-1 text-center text-xs opacity-40">Vitrine oficial</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </Shell>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// BAZAR — Listing Portal / Classifieds
// ═════════════════════════════════════════════════════════════════════════════

export function BazarTheme(props: Props) {
  return (
    <ThemeProvider themeKey="bazar" preset={THEME_PRESETS.bazar} {...props}>
      <ThemeRoot>
        <ThemeNavigation />
        <BazarHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function BazarHero() {
  const { visual, config, company, jobs } = useTheme();
  const copy = heroCopy();
  const searchPlaceholder = config.storefront?.searchPlaceholder || 'O que você procura?';
  return (
    <Shell>
      <section className="py-8 sm:py-12">
        <div className="flex flex-wrap gap-2 pb-5">
          {['Destaques', 'Sobre', 'Contato', 'Oportunidades'].map(chip => (
            <span key={chip} className="whitespace-nowrap rounded-full bg-white px-5 py-2 text-xs font-bold shadow-sm">{chip}</span>
          ))}
        </div>
        <div className="grid min-h-[470px] overflow-hidden pn-r lg:grid-cols-[1.1fr_.9fr]" style={{ background: `${visual.primary}12` }}>
          <div className="flex flex-col justify-center p-8 sm:p-12">
            {config.storefront?.showSearch !== false && (
              <div className="mb-8 flex items-center rounded-full border border-current/10 bg-white/70 px-5 py-3 text-sm opacity-55">
                <Search className="mr-2 h-4 w-4" />{searchPlaceholder}
              </div>
            )}
            <Eyebrow>{copy.eyebrow || 'Descubra'}</Eyebrow>
            <h1 className="mt-5 text-5xl font-black leading-[.9] tracking-[-.06em] sm:text-7xl">{copy.title}</h1>
            {copy.text && <p className="mt-6 max-w-xl text-lg leading-8 opacity-60">{copy.text}</p>}
            <div className="mt-8 flex flex-wrap gap-2">
              <span className="rounded-full border border-current/15 px-4 py-2 text-xs font-bold opacity-60">{company.cityState || 'Brasil'}</span>
              <span className="rounded-full border border-current/15 px-4 py-2 text-xs font-bold opacity-60">{jobs.length} oportunidades</span>
            </div>
          </div>
          <div className="relative min-h-[260px] overflow-hidden">
            {coverUrl(config) ? <img src={coverUrl(config)} alt="" className="h-full w-full object-cover" /> : (
              <div className="flex h-full items-center justify-center" style={{ background: `radial-gradient(circle, ${visual.accent}44, ${visual.primary}22)` }}>
                <CompanyLogo large />
              </div>
            )}
          </div>
        </div>
      </section>
    </Shell>
  );
}
