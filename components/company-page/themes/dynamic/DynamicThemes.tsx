import React, { useEffect, useRef, useState } from 'react';
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
// COSMOS — Universe UI / Sci-Fi
// ═════════════════════════════════════════════════════════════════════════════

export function CosmosTheme(props: Props) {
  return (
    <ThemeProvider themeKey="cosmos" preset={THEME_PRESETS.cosmos} {...props}>
      <ThemeRoot>
        <ThemeNavigation variant="dark" />
        <CosmosHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function CosmosHero() {
  const { visual, config, company, jobs } = useTheme();
  const copy = heroCopy();
  const cover = coverUrl(config);
  return (
    <header className="relative min-h-screen overflow-hidden bg-[#03050a] text-white">
      {/* Starfield */}
      <CosmosStars />
      {/* Nebula gradients */}
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 20%,${visual.primary}35,transparent 28%),radial-gradient(ellipse at 70% 80%,${visual.accent}30,transparent 28%),radial-gradient(circle at 50% 50%,#1a0a35 0%,transparent 50%)` }} />
      {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-screen" />}
      {/* Orbital rings */}
      <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[.06]" style={{ animation: 'pnFloat 12s ease-in-out infinite' }} />
      <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full border border-white/[.04]" />
      {/* Core glow */}
      <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: visual.accent, boxShadow: `0 0 80px 30px ${visual.accent}55` }} />
      <Shell className="relative z-10 flex min-h-screen flex-col">
        <div className="mt-auto max-w-5xl pb-24">
          <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.3em]" style={{ color: visual.primary }}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: visual.primary, animation: 'pnGlow 2s infinite' }} />
            SYS.ONLINE — {copy.eyebrow || 'TRANSMITTING'}
          </div>
          <h1 className="mt-6 text-6xl font-black leading-[.8] tracking-[-.07em] sm:text-9xl">{copy.title}</h1>
          {copy.text && <p className="mt-8 max-w-2xl text-lg leading-8 text-white/55">{copy.text}</p>}
          <HeroActions light />
          {/* Coords */}
          <div className="mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-6 font-mono text-[10px] text-white/30">
            <span>LAT: {company.state || '—'}</span>
            <span>NODES: {jobs.length}</span>
            <span>STATUS: ACTIVE</span>
          </div>
        </div>
      </Shell>
    </header>
  );
}

function CosmosStars() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + .3,
      a: Math.random(),
    }));
    stars.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.a * .5})`;
      ctx.fill();
    });
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

// ═════════════════════════════════════════════════════════════════════════════
// FESTIVAL — Cultural Playground
// ═════════════════════════════════════════════════════════════════════════════

export function FestivalTheme(props: Props) {
  return (
    <ThemeProvider themeKey="festival" preset={THEME_PRESETS.festival} {...props}>
      <ThemeRoot>
        <FestivalMarquee />
        <ThemeNavigation variant="dark" />
        <FestivalHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function FestivalMarquee() {
  const { visual } = useTheme();
  return (
    <div className="overflow-hidden whitespace-nowrap border-b-4 py-4" style={{ background: visual.primary, borderColor: visual.accent, color: contrastText(visual.primary) }}>
      <div className="flex" style={{ animation: 'pnMarquee 15s linear infinite' }}>
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className="mx-8 text-lg font-black uppercase tracking-[.1em]">
            ★ FESTIVAL ★ CULTURA ★ ARTE ★ MÚSICA ★ EXPERIÊNCIA ★ LIVE&nbsp;
          </span>
        ))}
      </div>
    </div>
  );
}

function FestivalHero() {
  const { visual, config } = useTheme();
  const copy = heroCopy();
  const cover = coverUrl(config);
  return (
    <header className="relative min-h-[90vh] overflow-hidden text-white">
      {cover ? <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" /> : (
        <div className="absolute inset-0" style={{ background: `repeating-conic-gradient(${visual.primary}22 0 25%,transparent 0 50%) 0 0/40px 40px, linear-gradient(135deg, #1a0a2e, #0a0020)` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />
      {/* Floating poster elements */}
      <div className="absolute right-[10%] top-[15%] rotate-12 border-4 px-8 py-4 text-xl font-black" style={{ borderColor: visual.accent, color: visual.accent }}>LIVE 2025</div>
      <div className="absolute bottom-[20%] left-[5%] -rotate-6 bg-white/10 px-6 py-3 text-sm font-bold backdrop-blur-sm">NEW WAVE</div>
      <Shell className="relative z-10 flex min-h-[90vh] flex-col justify-end pb-16">
        <Eyebrow light>{copy.eyebrow || 'Edição 2025'}</Eyebrow>
        <h1 className="mt-4 max-w-6xl text-8xl font-black uppercase leading-[.7] tracking-[-.08em] sm:text-[14vw]">{copy.title}</h1>
        {copy.text && <p className="mt-8 max-w-xl text-lg font-bold leading-8 text-white/55">{copy.text}</p>}
        <HeroActions light />
      </Shell>
    </header>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MATRIX — Terminal Aesthetic / Hacker
// ═════════════════════════════════════════════════════════════════════════════

export function MatrixTheme(props: Props) {
  return (
    <ThemeProvider themeKey="matrix" preset={THEME_PRESETS.matrix} {...props}>
      <ThemeRoot className="font-mono">
        <MatrixNav />
        <MatrixHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function MatrixNav() {
  const { company, visual } = useTheme();
  return (
    <nav className="border-b border-green-500/20">
      <Shell>
        <div className="flex h-14 items-center text-xs">
          <span style={{ color: visual.primary }}>█ </span>
          <span className="font-bold">{company.name}</span>
          <VerifiedBadge inverted />
          <span className="ml-auto text-[10px] opacity-40">[{new Date().toISOString().slice(0, 19).replace('T', ' ')}]</span>
        </div>
      </Shell>
    </nav>
  );
}

function MatrixHero() {
  const { visual, config, company, jobs } = useTheme();
  const copy = heroCopy();
  const [typed, setTyped] = useState('');
  const fullText = copy.title;

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i <= fullText.length) {
        setTyped(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 55);
    return () => clearInterval(interval);
  }, [fullText]);

  return (
    <Shell>
      <section className="min-h-[85vh] border-l-2 py-16 pl-6" style={{ borderColor: `${visual.primary}44` }}>
        {/* Terminal output */}
        <div className="text-xs opacity-40">
          <p>root@piranegocio:~$ whoami</p>
          <p style={{ color: visual.primary }}>{company.name}</p>
          <p>root@piranegocio:~$ status</p>
          <p style={{ color: visual.primary }}>ONLINE — {companyLocation(company) || 'BRASIL'} — {jobs.length} NODES ACTIVE</p>
          <p>root@piranegocio:~$ cat mission.txt</p>
        </div>
        <h1 className="mt-8 max-w-5xl text-4xl font-bold leading-[1.1] sm:text-6xl lg:text-7xl" style={{ color: visual.primary }}>
          {typed}<span className="animate-pulse">█</span>
        </h1>
        {copy.text && <p className="mt-8 max-w-2xl text-sm leading-7 opacity-45">&gt; {copy.text}</p>}
        {/* Scanline overlay */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[.03]">
          <div className="h-[1px] w-full bg-white" style={{ animation: 'pnScanline 4s linear infinite' }} />
        </div>
        <div className="mt-12 flex flex-wrap gap-3">
          <a href="#vagas" className="border px-6 py-3 text-xs font-bold transition hover:bg-green-500/10" style={{ borderColor: visual.primary, color: visual.primary }}>
            ./explore_jobs.sh →
          </a>
          <a href="#sobre" className="border border-current/20 px-6 py-3 text-xs font-bold opacity-55 transition hover:opacity-100">
            cat about.md
          </a>
        </div>
      </section>
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// AURORA-DYN — Living Color / Animated Gradients
// ═════════════════════════════════════════════════════════════════════════════

export function AuroraDynTheme(props: Props) {
  return (
    <ThemeProvider themeKey="aurora-dyn" preset={THEME_PRESETS['aurora-dyn']} {...props}>
      <ThemeRoot>
        <ThemeNavigation variant="dark" />
        <AuroraDynHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function AuroraDynHero() {
  const { visual, config, company } = useTheme();
  const copy = heroCopy();
  const cover = coverUrl(config);
  return (
    <Shell className="pt-4 sm:pt-6">
      <section className="relative min-h-[760px] overflow-hidden pn-r" style={{ background: '#0f0f23' }}>
        {/* Animated gradient blobs */}
        <div className="absolute -left-[15%] -top-[15%] h-[70%] w-[65%] rounded-full blur-[100px]" style={{ background: visual.primary, opacity: .5, animation: 'pnBlob1 10s ease-in-out infinite' }} />
        <div className="absolute -bottom-[15%] right-[-10%] h-[70%] w-[60%] rounded-full blur-[100px]" style={{ background: visual.accent, opacity: .45, animation: 'pnBlob2 14s ease-in-out infinite' }} />
        <div className="absolute left-[30%] top-[20%] h-[50%] w-[45%] rounded-full bg-pink-400/20 blur-[100px]" style={{ animation: 'pnBlob1 18s ease-in-out infinite reverse' }} />
        {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-screen" />}
        {/* Glassmorphism cards */}
        <div className="absolute right-[8%] top-[12%] hidden h-32 w-48 rotate-6 rounded-2xl border border-white/10 bg-white/[.06] p-4 backdrop-blur-xl lg:block">
          <CompanyLogo />
          <p className="mt-2 text-xs font-bold text-white/60">{company.name}</p>
        </div>
        <div className="absolute bottom-[15%] left-[6%] hidden h-24 w-36 -rotate-3 rounded-xl border border-white/8 bg-white/[.04] p-3 backdrop-blur-xl lg:block">
          <p className="text-[10px] text-white/40">Status</p>
          <p className="mt-1 text-sm font-bold text-white">Online</p>
        </div>
        {/* Content */}
        <Shell className="relative z-10 flex min-h-[760px] flex-col justify-center text-center text-white">
          <Eyebrow light>{copy.eyebrow || 'Living color'}</Eyebrow>
          <h1 className="mx-auto mt-6 max-w-5xl text-6xl font-semibold leading-[.88] tracking-[-.06em] sm:text-8xl lg:text-[100px]">{copy.title}</h1>
          {copy.text && <p className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-white/55">{copy.text}</p>}
          <HeroActions light centered />
        </Shell>
      </section>
    </Shell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CINEMA — Cinematic Storytelling
// ═════════════════════════════════════════════════════════════════════════════

export function CinemaTheme(props: Props) {
  return (
    <ThemeProvider themeKey="cinema" preset={THEME_PRESETS.cinema} {...props}>
      <ThemeRoot>
        <CinemaNav />
        <CinemaHero />
        <SectionStream />
        <ThemeFooter />
        <InternalPageOverlay />
      </ThemeRoot>
    </ThemeProvider>
  );
}

function CinemaNav() {
  const { company, visual } = useTheme();
  return (
    <nav className="border-b border-white/10">
      <Shell>
        <div className="flex h-16 items-center gap-3">
          <CompanyLogo />
          <span className="text-sm font-bold">{company.name}</span>
          <VerifiedBadge inverted />
          <div className="ml-auto flex items-center gap-1 text-[10px] tracking-[.1em] opacity-30">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: visual.accent }} />
            REC
          </div>
        </div>
      </Shell>
    </nav>
  );
}

function CinemaHero() {
  const { visual, config } = useTheme();
  const copy = heroCopy();
  const cover = coverUrl(config);
  return (
    <header className="relative overflow-hidden text-white" style={{ aspectRatio: '21/9', minHeight: '60vh' }}>
      {cover ? <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ filter: 'brightness(.45) contrast(1.1)' }} /> : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${visual.primary}33, ${visual.accent}22, #0c0a09)` }} />
      )}
      {/* Letterbox bars */}
      <div className="absolute inset-x-0 top-0 h-[10%] bg-black" />
      <div className="absolute inset-x-0 bottom-0 h-[10%] bg-black" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />
      <Shell className="relative z-10 flex h-full min-h-[60vh] items-center">
        <div className="max-w-4xl py-20">
          <div className="inline-flex items-center gap-3 text-[10px] uppercase tracking-[.3em]" style={{ color: visual.primary }}>
            <span className="h-px w-8" style={{ background: visual.primary }} />
            {copy.eyebrow || 'Uma produção'}
          </div>
          <h1 className="mt-6 font-serif text-6xl leading-[.85] sm:text-8xl lg:text-[100px]">{copy.title}</h1>
          {copy.text && <p className="mt-8 max-w-xl text-lg leading-8 text-white/50">{copy.text}</p>}
          <HeroActions light />
        </div>
      </Shell>
    </header>
  );
}
