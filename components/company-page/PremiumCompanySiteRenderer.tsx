import React from 'react';
import {
  BadgeCheck,
  BriefcaseBusiness,
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
  Sparkles,
  Youtube,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { FullPageCompanySandbox } from './FullPageCompanySandbox';

export type CompanyPageWidth = 'compact' | 'standard' | 'wide' | 'full';
export type CompanyTemplateKey = 'aurora' | 'atlas' | 'pulse' | 'canvas' | 'noir' | 'essencial' | 'institucional' | 'vitrine' | 'editorial';
export type CompanyEditorMode = 'visual' | 'code';

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
  key: Exclude<CompanyTemplateKey, 'essencial' | 'institucional' | 'vitrine' | 'editorial'>;
  name: string;
  description: string;
  eyebrow: string;
  bestFor: string;
}> = [
  { key: 'aurora', name: 'Aurora', eyebrow: 'Premium clean', description: 'Leve, sofisticado e com presença de marca sem parecer template pronto.', bestFor: 'Serviços, tecnologia, saúde e marcas modernas' },
  { key: 'atlas', name: 'Atlas', eyebrow: 'Executive', description: 'Visual corporativo contemporâneo, sólido e elegante, com informação muito bem hierarquizada.', bestFor: 'Indústria, B2B, consultorias e empresas consolidadas' },
  { key: 'pulse', name: 'Pulse', eyebrow: 'Recruitment first', description: 'Energia visual e oportunidades no centro da experiência, sem perder a identidade institucional.', bestFor: 'Empresas contratando com frequência e employer branding' },
  { key: 'canvas', name: 'Canvas', eyebrow: 'Editorial', description: 'Tipografia grande, respiro e narrativa. Parece uma landing page desenhada sob medida.', bestFor: 'Arquitetura, moda, gastronomia, agências e negócios autorais' },
  { key: 'noir', name: 'Noir', eyebrow: 'Dark luxury', description: 'Escuro, preciso e sofisticado. Um visual premium para marcas que querem presença.', bestFor: 'Automotivo, eventos, estética, tecnologia e marcas premium' },
];

const DEFAULT_SECTIONS: CompanyPageSection[] = [
  { id: 'identity', type: 'identity', enabled: true, locked: true },
  { id: 'about', type: 'about', enabled: true },
  { id: 'contact', type: 'contact', enabled: true },
  { id: 'socials', type: 'socials', enabled: true },
  { id: 'jobs', type: 'jobs', enabled: true, locked: true },
  { id: 'legal', type: 'legal', enabled: true },
];

function templateKey(value?: string): Exclude<CompanyTemplateKey, 'essencial' | 'institucional' | 'vitrine' | 'editorial'> {
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

function widthClass(width: CompanyPageWidth = 'standard') {
  if (width === 'compact') return 'max-w-4xl';
  if (width === 'wide') return 'max-w-[1380px]';
  if (width === 'full') return 'max-w-none';
  return 'max-w-6xl';
}

function isVerified(company: PublicCompanyLike) {
  return Boolean(company.isVerified || company.verificationStatus === 'VERIFIED');
}

function companyLocation(company: PublicCompanyLike) {
  return company.address || company.cityState || [company.city, company.state].filter(Boolean).join(', ');
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

export function CompanySiteRenderer({ company, jobs, page, preview = false }: { company: PublicCompanyLike; jobs: PublicJobLike[]; page?: CompanyPageConfig | null; preview?: boolean }) {
  const config = page || {};
  const mode: CompanyEditorMode = config.editorMode === 'code' ? 'code' : 'visual';

  if (mode === 'code') {
    const mergedCompany = withPageOverrides(company, config);
    return (
      <div className="w-full overflow-hidden bg-white">
        <FullPageCompanySandbox
          company={mergedCompany}
          jobs={jobs}
          html={config.codePage?.html || ''}
          css={config.codePage?.css || ''}
          js={config.codePage?.js || ''}
        />
      </div>
    );
  }

  return <VisualCompanyPage company={company} jobs={jobs} config={config} preview={preview} />;
}

function VisualCompanyPage({ company, jobs, config, preview }: { company: PublicCompanyLike; jobs: PublicJobLike[]; config: CompanyPageConfig; preview: boolean }) {
  const template = templateKey(String(config.templateKey || 'aurora'));
  const primary = config.theme?.primary || '#b84f38';
  const accent = config.theme?.accent || '#2f4f46';
  const background = config.theme?.background || '#f8f5f0';
  const text = config.theme?.text || '#201d1b';
  const sections = Array.isArray(config.sections) && config.sections.length ? config.sections : DEFAULT_SECTIONS;
  const ordered = sections.filter((section) => section.type !== 'identity' && section.enabled !== false);
  const sectionEnabled = (type: string) => sections.some((section) => section.type === type && section.enabled !== false);
  const location = companyLocation(company);
  const aboutText = config.about?.text || company.description || '';
  const dark = template === 'noir';

  const style = {
    '--pn-primary': primary,
    '--pn-accent': accent,
    '--pn-bg': background,
    '--pn-text': text,
  } as React.CSSProperties;

  return (
    <div style={{ ...style, backgroundColor: dark ? '#0d0d0e' : background, color: dark ? '#f5f2ed' : text }} className="min-h-screen w-full overflow-hidden">
      <div className={`mx-auto w-full ${widthClass(config.width)} ${config.width === 'full' ? '' : 'px-4 sm:px-6'} py-4 sm:py-7`}>
        <PremiumHero template={template} company={company} config={config} location={location} primary={primary} accent={accent} aboutText={aboutText} />

        <main className={`${template === 'canvas' ? 'mt-14 space-y-14' : 'mt-7 space-y-7'} ${config.width === 'full' ? 'px-4 sm:px-8' : ''}`}>
          {ordered.map((section) => (
            <React.Fragment key={section.id}>
              {section.type === 'about' && aboutText ? <AboutSection template={template} title={config.about?.title || 'Sobre a empresa'} text={aboutText} primary={primary} /> : null}
              {section.type === 'contact' ? <ContactSection template={template} company={company} config={config} primary={primary} /> : null}
              {section.type === 'socials' ? <SocialSection template={template} company={company} config={config} primary={primary} /> : null}
              {section.type === 'jobs' ? <JobsSection template={template} jobs={jobs} primary={primary} accent={accent} /> : null}
              {section.type === 'legal' ? <LegalSection template={template} company={company} config={config} /> : null}
            </React.Fragment>
          ))}

          {!sectionEnabled('jobs') && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              A prévia está sem o componente obrigatório de vagas. O rascunho pode ser salvo, mas não publicado.
            </div>
          )}
        </main>

        <footer className={`mt-10 flex flex-wrap items-center justify-between gap-3 border-t py-6 text-[11px] font-semibold ${dark ? 'border-white/10 text-white/35' : 'border-stone-200 text-stone-400'} ${config.width === 'full' ? 'mx-4 sm:mx-8' : ''}`}>
          <span>{preview ? 'Prévia privada · ' : ''}Site empresarial integrado ao PiraNegócios</span>
          <span>Oportunidades sincronizadas automaticamente</span>
        </footer>
      </div>
    </div>
  );
}

function PremiumHero({ template, company, config, location, primary, accent, aboutText }: { template: ReturnType<typeof templateKey>; company: PublicCompanyLike; config: CompanyPageConfig; location: string; primary: string; accent: string; aboutText: string }) {
  const cover = Boolean(config.cover?.enabled && config.cover?.url);
  const coverStyle = cover ? {
    backgroundImage: `linear-gradient(110deg, rgba(8,8,10,.82), rgba(8,8,10,.18)), url(${config.cover?.url})`,
    backgroundPosition: config.cover?.position || 'center',
    backgroundSize: 'cover',
  } : undefined;

  if (template === 'canvas') {
    return (
      <header className="relative border-y border-stone-300/70 bg-[#f5f0e7] px-6 py-10 sm:px-10 sm:py-14" style={cover ? coverStyle : undefined}>
        <div className={`grid gap-10 lg:grid-cols-[1.25fr_.75fr] lg:items-end ${cover ? 'text-white' : 'text-stone-950'}`}>
          <div>
            <div className="mb-8 flex items-center gap-4">
              <CompanyLogo company={company} className="h-16 w-16 rounded-full" />
              <VerifiedBadge company={company} inverted={cover} />
            </div>
            <h1 className="max-w-4xl font-serif text-5xl font-black leading-[.95] tracking-[-.055em] sm:text-7xl lg:text-8xl">{company.name || 'Sua empresa'}</h1>
          </div>
          <div className="space-y-5 pb-1">
            {location && <p className={`flex items-start gap-2 text-sm font-semibold ${cover ? 'text-white/75' : 'text-stone-500'}`}><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{location}</p>}
            {aboutText && <p className={`text-base leading-7 ${cover ? 'text-white/80' : 'text-stone-600'}`}>{aboutText.slice(0, 220)}{aboutText.length > 220 ? '…' : ''}</p>}
          </div>
        </div>
      </header>
    );
  }

  if (template === 'noir') {
    return (
      <header className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[#121214] px-6 py-8 text-white shadow-[0_35px_100px_rgba(0,0,0,.35)] sm:px-10 sm:py-11" style={cover ? coverStyle : undefined}>
        <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full blur-3xl opacity-40" style={{ background: `radial-gradient(circle, ${primary}, transparent 68%)` }} />
        <div className="relative z-10 grid min-h-[360px] gap-10 lg:grid-cols-[1fr_.72fr] lg:items-end">
          <div className="self-start">
            <div className="flex items-center gap-4"><CompanyLogo company={company} className="h-14 w-14 rounded-2xl" /><VerifiedBadge company={company} inverted /></div>
          </div>
          <div className="lg:col-span-2 lg:grid lg:grid-cols-[1.2fr_.8fr] lg:items-end lg:gap-12">
            <h1 className="max-w-4xl text-5xl font-black leading-[.92] tracking-[-.055em] sm:text-7xl">{company.name || 'Sua empresa'}</h1>
            <div className="mt-8 space-y-4 lg:mt-0">
              <p className="text-[11px] font-black uppercase tracking-[.26em] text-white/35">Presença empresarial</p>
              {location && <p className="flex gap-2 text-sm font-semibold text-white/70"><MapPin className="h-4 w-4" />{location}</p>}
              {aboutText && <p className="text-sm leading-6 text-white/50">{aboutText.slice(0, 180)}{aboutText.length > 180 ? '…' : ''}</p>}
            </div>
          </div>
        </div>
      </header>
    );
  }

  if (template === 'pulse') {
    return (
      <header className="relative overflow-hidden rounded-[36px] text-white shadow-[0_30px_90px_rgba(38,20,15,.22)]" style={cover ? coverStyle : { background: `linear-gradient(125deg, ${accent}, ${primary} 62%, #f3a56f)` }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(255,255,255,.3),transparent_30%)]" />
        <div className="relative z-10 grid min-h-[430px] gap-10 p-7 sm:p-11 lg:grid-cols-[1fr_320px] lg:items-end">
          <div>
            <div className="mb-8 flex items-center gap-4"><CompanyLogo company={company} className="h-16 w-16 rounded-[20px]" /><VerifiedBadge company={company} inverted /></div>
            <p className="mb-4 text-[11px] font-black uppercase tracking-[.24em] text-white/60">Trabalhe com a gente</p>
            <h1 className="max-w-4xl text-5xl font-black leading-[.95] tracking-[-.05em] sm:text-7xl">{company.name || 'Sua empresa'}</h1>
          </div>
          <div className="rounded-[26px] border border-white/20 bg-black/15 p-5 backdrop-blur-xl">
            <Sparkles className="h-5 w-5 text-white/80" />
            <p className="mt-5 text-sm font-bold leading-6 text-white/85">Conheça a empresa, acompanhe as oportunidades e candidate-se às vagas abertas.</p>
            {location && <p className="mt-5 flex items-start gap-2 border-t border-white/15 pt-4 text-xs font-semibold text-white/60"><MapPin className="mt-0.5 h-4 w-4" />{location}</p>}
          </div>
        </div>
      </header>
    );
  }

  if (template === 'atlas') {
    return (
      <header className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-slate-950 text-white shadow-[0_28px_80px_rgba(15,23,42,.18)]" style={cover ? coverStyle : undefined}>
        <div className="grid lg:grid-cols-[.82fr_1.18fr]">
          <div className="flex min-h-[360px] flex-col justify-between border-b border-white/10 p-7 sm:p-10 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-4"><CompanyLogo company={company} className="h-14 w-14 rounded-2xl" /><VerifiedBadge company={company} inverted /></div>
            <div className="mt-16">
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-white/35">Empresa</p>
              <h1 className="mt-4 text-4xl font-black leading-[.98] tracking-[-.04em] sm:text-5xl">{company.name || 'Sua empresa'}</h1>
            </div>
          </div>
          <div className="flex min-h-[360px] flex-col justify-end p-7 sm:p-10">
            <div className="max-w-xl">
              <div className="mb-8 h-1.5 w-16 rounded-full" style={{ backgroundColor: primary }} />
              {aboutText && <p className="text-xl font-semibold leading-8 tracking-[-.02em] text-white/90">{aboutText.slice(0, 260)}{aboutText.length > 260 ? '…' : ''}</p>}
              {location && <p className="mt-8 flex items-start gap-2 text-sm font-semibold text-white/45"><MapPin className="mt-0.5 h-4 w-4" />{location}</p>}
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="relative overflow-hidden rounded-[36px] border border-[#e8dfd7] bg-[#fffdf9] shadow-[0_28px_90px_rgba(57,41,31,.10)]" style={cover ? coverStyle : undefined}>
      <div className={`relative z-10 grid min-h-[390px] gap-12 p-7 sm:p-11 lg:grid-cols-[1.15fr_.85fr] lg:items-end ${cover ? 'text-white' : ''}`}>
        <div>
          <div className="mb-10 flex items-center gap-4"><CompanyLogo company={company} className="h-16 w-16 rounded-[20px]" /><VerifiedBadge company={company} inverted={cover} /></div>
          <p className={`mb-4 text-[10px] font-black uppercase tracking-[.25em] ${cover ? 'text-white/55' : 'text-stone-400'}`}>Página oficial</p>
          <h1 className={`max-w-4xl text-5xl font-black leading-[.94] tracking-[-.055em] sm:text-7xl ${cover ? 'text-white' : 'text-stone-950'}`}>{company.name || 'Sua empresa'}</h1>
        </div>
        <div className={`rounded-[26px] p-5 ${cover ? 'border border-white/15 bg-black/15 backdrop-blur-xl' : 'border border-stone-200 bg-[#f7f1e9]'}`}>
          {aboutText && <p className={`text-sm font-medium leading-6 ${cover ? 'text-white/80' : 'text-stone-600'}`}>{aboutText.slice(0, 200)}{aboutText.length > 200 ? '…' : ''}</p>}
          {location && <p className={`mt-5 flex items-start gap-2 border-t pt-4 text-xs font-bold ${cover ? 'border-white/15 text-white/55' : 'border-stone-200 text-stone-500'}`}><MapPin className="mt-0.5 h-4 w-4" />{location}</p>}
        </div>
      </div>
      {!cover && <div className="absolute -bottom-28 -right-20 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: `radial-gradient(circle, ${primary}, transparent 65%)` }} />}
    </header>
  );
}

function CompanyLogo({ company, className }: { company: PublicCompanyLike; className: string }) {
  if (company.logoURL) return <img src={company.logoURL} alt={`Logo ${company.name || ''}`} className={`${className} shrink-0 border border-white/20 bg-white object-cover p-1 shadow-xl`} />;
  return <span className={`${className} flex shrink-0 items-center justify-center border border-white/20 bg-white text-xl font-black text-stone-800 shadow-xl`}><Building2 className="h-6 w-6" /></span>;
}

function VerifiedBadge({ company, inverted = false }: { company: PublicCompanyLike; inverted?: boolean }) {
  const verified = isVerified(company);
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[.12em] ${inverted ? 'border border-white/15 bg-white/10 text-white' : verified ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-stone-200 bg-white text-stone-500'}`}><BadgeCheck className="h-3.5 w-3.5" />{verified ? 'Verificada' : 'Verificação pendente'}</span>;
}

function SectionShell({ template, eyebrow, title, children }: { template: ReturnType<typeof templateKey>; eyebrow?: string; title: string; children: React.ReactNode }) {
  if (template === 'canvas') return <section className="grid gap-7 border-t border-stone-300/80 pt-8 md:grid-cols-[220px_minmax(0,1fr)]"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-stone-400">{eyebrow}</p><h2 className="mt-2 font-serif text-3xl font-black tracking-[-.035em] text-stone-950">{title}</h2></div><div>{children}</div></section>;
  if (template === 'noir') return <section className="rounded-[30px] border border-white/10 bg-white/[.045] p-6 shadow-[0_18px_55px_rgba(0,0,0,.18)] sm:p-8"><p className="text-[9px] font-black uppercase tracking-[.22em] text-white/30">{eyebrow}</p><h2 className="mt-2 text-2xl font-black tracking-[-.03em] text-white">{title}</h2><div className="mt-6">{children}</div></section>;
  return <section className="rounded-[30px] border border-stone-200/80 bg-white/85 p-6 shadow-[0_16px_50px_rgba(41,37,36,.06)] backdrop-blur sm:p-8"><p className="text-[9px] font-black uppercase tracking-[.22em] text-stone-400">{eyebrow}</p><h2 className="mt-2 text-2xl font-black tracking-[-.035em] text-stone-950">{title}</h2><div className="mt-6">{children}</div></section>;
}

function AboutSection({ template, title, text, primary }: { template: ReturnType<typeof templateKey>; title: string; text: string; primary: string }) {
  return <SectionShell template={template} eyebrow="Quem somos" title={title}><div className="grid gap-6 lg:grid-cols-[1fr_190px]"><p className={`${template === 'canvas' ? 'font-serif text-2xl leading-10 text-stone-700' : template === 'noir' ? 'text-base leading-8 text-white/62' : 'text-base leading-8 text-stone-600'} whitespace-pre-line`}>{text}</p>{template !== 'canvas' && <div className="hidden rounded-[24px] lg:block" style={{ background: `linear-gradient(145deg, ${primary}20, ${primary}06)` }} />}</div></SectionShell>;
}

function ContactSection({ template, company, config, primary }: { template: ReturnType<typeof templateKey>; company: PublicCompanyLike; config: CompanyPageConfig; primary: string }) {
  const contacts = [
    { icon: Phone, label: config.contacts?.phone || company.phone, href: `tel:${config.contacts?.phone || company.phone || ''}` },
    { icon: Phone, label: config.contacts?.secondaryPhone, href: `tel:${config.contacts?.secondaryPhone || ''}` },
    { icon: Phone, label: config.contacts?.whatsapp ? `WhatsApp · ${config.contacts.whatsapp}` : '', href: config.contacts?.whatsapp ? `https://wa.me/${config.contacts.whatsapp.replace(/\D/g, '')}` : '' },
    { icon: Mail, label: config.contacts?.email, href: config.contacts?.email ? `mailto:${config.contacts.email}` : '' },
    { icon: Globe, label: config.contacts?.website || company.website, href: normalizedUrl(config.contacts?.website || company.website) },
  ].filter((item) => item.label);
  if (!contacts.length) return null;
  return <SectionShell template={template} eyebrow="Fale com a empresa" title="Contato"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{contacts.map((item, index) => { const Icon=item.icon; return <a key={`${item.label}-${index}`} href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={`group flex items-center gap-3 rounded-[20px] border px-4 py-4 text-sm font-bold transition hover:-translate-y-0.5 ${template === 'noir' ? 'border-white/10 bg-white/[.04] text-white/75 hover:bg-white/[.07]' : 'border-stone-200 bg-white text-stone-700 hover:shadow-lg'}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${primary}12`, color: primary }}><Icon className="h-4 w-4" /></span><span className="truncate">{item.label}</span></a>; })}</div></SectionShell>;
}

function SocialSection({ template, company, config, primary }: { template: ReturnType<typeof templateKey>; company: PublicCompanyLike; config: CompanyPageConfig; primary: string }) {
  const socials = [
    { icon: Instagram, label: 'Instagram', value: config.socials?.instagram || company.socialInstagram },
    { icon: Linkedin, label: 'LinkedIn', value: config.socials?.linkedin || company.socialLinkedin },
    { icon: Facebook, label: 'Facebook', value: config.socials?.facebook || company.socialFacebook },
    { icon: Youtube, label: 'YouTube', value: config.socials?.youtube },
    { icon: Music2, label: 'TikTok', value: config.socials?.tiktok },
  ].filter((item) => item.value);
  if (!socials.length) return null;
  return <SectionShell template={template} eyebrow="Acompanhe" title="Redes sociais"><div className="flex flex-wrap gap-2.5">{socials.map((item) => { const Icon=item.icon; return <a key={item.label} href={normalizedUrl(item.value)} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-black transition hover:-translate-y-0.5 ${template === 'noir' ? 'border-white/10 bg-white/[.04] text-white/70' : 'border-stone-200 bg-white text-stone-700 shadow-sm'}`}><Icon className="h-4 w-4" style={{ color: primary }} />{item.label}</a>; })}</div></SectionShell>;
}

function JobsSection({ template, jobs, primary, accent }: { template: ReturnType<typeof templateKey>; jobs: PublicJobLike[]; primary: string; accent: string }) {
  return <SectionShell template={template} eyebrow="Oportunidades" title="Vagas abertas">{jobs.length ? <div className={`grid gap-3 ${template === 'pulse' ? 'md:grid-cols-2' : ''}`}>{jobs.map((job, index) => <Link key={job.id || job.slug || `${job.title}-${index}`} to={job.slug ? `/vagas/${job.slug}` : '/vagas'} className={`group relative overflow-hidden rounded-[22px] border p-5 transition hover:-translate-y-0.5 ${template === 'noir' ? 'border-white/10 bg-white/[.045] text-white hover:bg-white/[.07]' : template === 'pulse' ? 'border-stone-200 bg-white shadow-sm hover:shadow-xl' : 'border-stone-200 bg-white shadow-sm hover:shadow-lg'}`}><div className="relative z-10 flex items-start justify-between gap-5"><div className="min-w-0"><h3 className={`text-base font-black tracking-[-.02em] ${template === 'noir' ? 'text-white' : 'text-stone-950'}`}>{job.title || 'Oportunidade'}</h3><p className={`mt-2 text-sm ${template === 'noir' ? 'text-white/40' : 'text-stone-500'}`}>{job.location || [job.city, job.state].filter(Boolean).join(', ') || 'Local a combinar'}</p>{(job.type || job.workModel || job.salary) && <p className={`mt-3 text-[11px] font-bold ${template === 'noir' ? 'text-white/35' : 'text-stone-400'}`}>{[job.type, job.workModel, job.salary].filter(Boolean).join(' · ')}</p>}</div><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition group-hover:scale-105" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}><ExternalLink className="h-4 w-4" /></span></div></Link>)}</div> : <div className={`rounded-[24px] border border-dashed px-6 py-12 text-center ${template === 'noir' ? 'border-white/10 bg-white/[.025]' : 'border-stone-300 bg-white/60'}`}><BriefcaseBusiness className={`mx-auto h-7 w-7 ${template === 'noir' ? 'text-white/20' : 'text-stone-300'}`} /><p className={`mt-3 font-black ${template === 'noir' ? 'text-white/70' : 'text-stone-700'}`}>Nenhuma vaga aberta neste momento.</p><p className={`mt-1 text-sm ${template === 'noir' ? 'text-white/35' : 'text-stone-500'}`}>As próximas oportunidades aparecem aqui automaticamente.</p></div>}</SectionShell>;
}

function LegalSection({ template, company, config }: { template: ReturnType<typeof templateKey>; company: PublicCompanyLike; config: CompanyPageConfig }) {
  if (!config.legal?.termsEnabled && !config.legal?.privacyEnabled) return null;
  return <div className={`flex flex-wrap items-center justify-center gap-5 border-t py-6 text-xs font-bold ${template === 'noir' ? 'border-white/10 text-white/35' : 'border-stone-200 text-stone-500'}`}>{config.legal.termsEnabled && company.slug && <Link to={`/${company.slug}/termos`} className="hover:opacity-70">{config.legal.termsTitle || 'Termos de uso'}</Link>}{config.legal.privacyEnabled && company.slug && <Link to={`/${company.slug}/privacidade`} className="hover:opacity-70">{config.legal.privacyTitle || 'Política de privacidade'}</Link>}</div>;
}
