import React from 'react';
import { ArrowRight, BadgeCheck, BriefcaseBusiness, MapPin, MessageCircle, ShoppingBag, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CompanyPageConfig } from './CompanyPageExtensions';
import type { PublicCompanyLike, PublicJobLike } from './PremiumCompanySiteRenderer';

export const STORE_COMPANY_THEME_PRESET = {
  width: 'full' as const,
  theme: { primary: '#f1ff3d', accent: '#8b5cf6', background: '#121216', text: '#f7f7f5' },
  branding: { typography: 'clean' as const, logoSize: 'large' as const, corners: 'round' as const },
  hero: { layout: 'cover' as const },
  jobs: { layout: 'grid' as const },
  navigation: { sticky: true, transparent: false },
};

export function applyStoreCompanyThemePreset(config: CompanyPageConfig): CompanyPageConfig {
  const preset = STORE_COMPANY_THEME_PRESET;
  return {
    ...config,
    templateKey: 'loja',
    width: preset.width,
    theme: { ...config.theme, ...preset.theme },
    branding: { ...config.branding, ...preset.branding },
    hero: { ...config.hero, ...preset.hero },
    jobs: { ...config.jobs, ...preset.jobs },
    navigation: { ...config.navigation, ...preset.navigation },
  };
}

export function StoreCompanyTheme({
  company,
  jobs,
  config,
  preview = false,
}: {
  company: PublicCompanyLike;
  jobs: PublicJobLike[];
  config: CompanyPageConfig;
  preview?: boolean;
}) {
  const primary = config.theme?.primary || STORE_COMPANY_THEME_PRESET.theme.primary;
  const accent = config.theme?.accent || STORE_COMPANY_THEME_PRESET.theme.accent;
  const background = config.theme?.background || STORE_COMPANY_THEME_PRESET.theme.background;
  const text = config.theme?.text || STORE_COMPANY_THEME_PRESET.theme.text;
  const heroTitle = config.hero?.title || company.name || 'Nossa loja';
  const heroSubtitle = config.hero?.subtitle || company.description || 'Produtos, serviços e oportunidades em um só lugar.';
  const coverEnabled = Boolean(config.cover?.enabled && config.cover?.url);
  const categories = config.categories?.enabled === false ? [] : (config.categories?.items || []);
  const visibleJobs = jobs.slice(0, 6);
  const location = company.cityState || [company.city, company.state].filter(Boolean).join(' - ');

  return (
    <div className="min-h-screen overflow-hidden" style={{ background, color: text }}>
      <header className={`${config.navigation?.sticky === false || preview ? '' : 'sticky top-0'} z-50 border-b border-white/10 bg-[#121216]/90 backdrop-blur-xl`}>
        <div className="mx-auto flex min-h-16 max-w-[1480px] items-center gap-4 px-4 sm:px-7 lg:px-10">
          <a href="#topo" className="flex min-w-0 items-center gap-3">
            {company.logoURL ? <img src={company.logoURL} alt="" className="h-9 w-9 rounded-xl bg-white object-contain p-1" /> : <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><ShoppingBag className="h-4 w-4" /></span>}
            <span className="truncate text-sm font-black tracking-[-.02em]">{company.name}</span>
            {(company.isVerified || company.verificationStatus === 'VERIFIED') && <BadgeCheck className="h-4 w-4 shrink-0" style={{ color: primary }} />}
          </a>
          <nav className="ml-auto hidden items-center gap-6 text-[11px] font-black uppercase tracking-[.14em] text-white/55 md:flex">
            <a href="#vitrine" className="transition hover:text-white">Loja</a>
            {visibleJobs.length > 0 && <a href="#vagas" className="transition hover:text-white">{config.navigation?.jobsLabel || 'Vagas'}</a>}
            <a href="#contato" className="transition hover:text-white">Contato</a>
          </nav>
          <a href="#vitrine" className="ml-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black text-[#121216] md:ml-3" style={{ background: primary }}>
            Ver produtos <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      <main id="topo">
        <section className="relative isolate min-h-[620px] border-b border-white/10">
          {coverEnabled && <div className="absolute inset-0 -z-20"><img src={config.cover!.url} alt="" className="h-full w-full object-cover" style={{ objectPosition: config.cover?.position || 'center' }} /><div className="absolute inset-0 bg-black" style={{ opacity: Math.min(0.85, Math.max(0, Number(config.cover?.overlay ?? 38) / 100)) }} /></div>}
          <div className="absolute -left-32 top-24 -z-10 h-96 w-96 rounded-full blur-[120px]" style={{ background: `${accent}55` }} />
          <div className="absolute -right-28 bottom-10 -z-10 h-80 w-80 rounded-full blur-[120px]" style={{ background: `${primary}30` }} />
          <div className="mx-auto grid min-h-[620px] max-w-[1480px] items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.15fr_.85fr] lg:px-10">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.06] px-3 py-2 text-[10px] font-black uppercase tracking-[.16em] text-white/70"><Sparkles className="h-3.5 w-3.5" style={{ color: primary }} />{config.hero?.eyebrow || 'Loja da empresa'}</div>
              <h1 className="mt-6 max-w-5xl text-[clamp(3.6rem,9vw,8.8rem)] font-black leading-[.82] tracking-[-.075em]">{heroTitle}</h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-white/60 sm:text-lg">{heroSubtitle}</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a href="#vitrine" className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-black text-[#121216]" style={{ background: primary }}><ShoppingBag className="h-4 w-4" /> Explorar loja</a>
                {visibleJobs.length > 0 && <a href="#vagas" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.05] px-6 py-3.5 text-sm font-black text-white"><BriefcaseBusiness className="h-4 w-4" /> Trabalhe conosco</a>}
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="ml-auto max-w-md rotate-2 rounded-[34px] border border-white/10 bg-white/[.055] p-5 shadow-2xl backdrop-blur-xl">
                <div className="rounded-[26px] bg-black/30 p-7">
                  {company.logoURL ? <img src={company.logoURL} alt={company.name || 'Logo'} className="h-24 w-24 rounded-[28px] bg-white object-contain p-3" /> : <ShoppingBag className="h-16 w-16" style={{ color: primary }} />}
                  <p className="mt-8 text-[10px] font-black uppercase tracking-[.18em] text-white/35">Vitrine oficial</p>
                  <p className="mt-2 text-3xl font-black tracking-[-.04em]">{company.name}</p>
                  {location && <p className="mt-4 flex items-center gap-2 text-xs font-bold text-white/45"><MapPin className="h-4 w-4" />{location}</p>}
                  <div className="mt-8 grid grid-cols-2 gap-2"><StoreStat label="Compra" value="Direto no anúncio" /><StoreStat label="Atendimento" value="Chat integrado" /></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {categories.length > 0 && <section className="border-b border-white/10"><div className="mx-auto max-w-[1480px] px-5 py-6 sm:px-8 lg:px-10"><div className="flex gap-2 overflow-x-auto pb-1">{categories.map((item) => <a key={item.id} href={item.href || '#vitrine'} className="whitespace-nowrap rounded-full border border-white/10 bg-white/[.04] px-4 py-2.5 text-xs font-black text-white/65 transition hover:bg-white/10 hover:text-white">{item.label}</a>)}</div></div></section>}

        <section className="border-b border-white/10 bg-white/[.025]"><div className="mx-auto grid max-w-[1480px] gap-px bg-white/10 sm:grid-cols-3"><TrustItem icon={<BadgeCheck className="h-5 w-5" />} title="Empresa verificada" text="Identidade empresarial vinculada ao PiraNegócios." color={primary} /><TrustItem icon={<MessageCircle className="h-5 w-5" />} title="Conversa no contexto" text="Chat associado ao produto ou serviço anunciado." color={primary} /><TrustItem icon={<ShoppingBag className="h-5 w-5" />} title="Vitrine integrada" text="Produtos e serviços publicados pela própria empresa." color={primary} /></div></section>

        {visibleJobs.length > 0 && <section id="vagas" className="border-b border-white/10 px-5 py-20 sm:px-8 lg:px-10"><div className="mx-auto max-w-[1480px]"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: primary }}>Faça parte</p><h2 className="mt-2 text-4xl font-black tracking-[-.045em] sm:text-5xl">{config.jobs?.title || 'Oportunidades abertas'}</h2>{config.jobs?.intro && <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">{config.jobs.intro}</p>}</div><Link to="/vagas" className="inline-flex items-center gap-2 text-xs font-black text-white/60 hover:text-white">Ver todas <ArrowRight className="h-4 w-4" /></Link></div><div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleJobs.map((job) => <Link key={job.id || job.slug} to={job.slug ? `/vagas/${job.slug}` : '/vagas'} className="group rounded-[24px] border border-white/10 bg-white/[.04] p-5 transition hover:-translate-y-1 hover:bg-white/[.075]"><p className="text-[10px] font-black uppercase tracking-[.14em] text-white/35">Oportunidade</p><h3 className="mt-2 text-lg font-black tracking-[-.025em]">{job.title}</h3><p className="mt-4 text-xs text-white/45">{job.location || [job.city, job.state].filter(Boolean).join(' - ') || 'Consulte a localização'}</p><span className="mt-6 inline-flex items-center gap-2 text-xs font-black" style={{ color: primary }}>Ver vaga <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span></Link>)}</div></div></section>}

        <section id="contato" className="px-5 py-16 sm:px-8 lg:px-10"><div className="mx-auto flex max-w-[1480px] flex-col gap-8 border-t border-white/10 pt-10 md:flex-row md:items-end md:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/35">{company.name}</p><p className="mt-2 max-w-xl text-sm leading-6 text-white/45">{config.footer?.text || 'Conheça nossos produtos, serviços e oportunidades pelo PiraNegócios.'}</p></div><div className="flex flex-wrap gap-2">{config.contacts?.website || company.website ? <a href={config.contacts?.website || company.website} target="_blank" rel="noreferrer" className="rounded-full border border-white/10 px-4 py-2.5 text-xs font-black text-white/70">Site</a> : null}<Link to="/classificados" className="rounded-full px-4 py-2.5 text-xs font-black text-[#121216]" style={{ background: primary }}>Marketplace</Link></div></div></section>
      </main>
    </div>
  );
}

function StoreStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white/[.055] p-3"><p className="text-[9px] font-black uppercase tracking-[.13em] text-white/30">{label}</p><p className="mt-1 text-xs font-black text-white/70">{value}</p></div>;
}

function TrustItem({ icon, title, text, color }: { icon: React.ReactNode; title: string; text: string; color: string }) {
  return <div className="bg-[#121216] px-5 py-8 sm:px-8 lg:px-10"><span style={{ color }}>{icon}</span><h3 className="mt-4 text-sm font-black">{title}</h3><p className="mt-1 max-w-sm text-xs leading-5 text-white/40">{text}</p></div>;
}
