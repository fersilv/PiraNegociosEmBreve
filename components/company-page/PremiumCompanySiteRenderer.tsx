import React from 'react';
import {
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
  footer?: {
    text?: string;
  };
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
  { key: 'aurora', name: 'Aurora', eyebrow: 'Clean brand', description: 'Base clara e neutra. A identidade vem da marca, não do PiraNegócios.', bestFor: 'Serviços, tecnologia, saúde e marcas contemporâneas' },
  { key: 'atlas', name: 'Atlas', eyebrow: 'Corporate', description: 'Estrutura sóbria com navegação e hierarquia de site institucional.', bestFor: 'Indústria, B2B, consultorias e empresas consolidadas' },
  { key: 'pulse', name: 'Pulse', eyebrow: 'Bold careers', description: 'Marca forte e vagas em destaque, sem aparência de portal de empregos.', bestFor: 'Empresas com contratação recorrente e employer branding' },
  { key: 'canvas', name: 'Canvas', eyebrow: 'Editorial', description: 'Tipografia, respiro e composição de landing page autoral.', bestFor: 'Moda, arquitetura, gastronomia, agências e negócios criativos' },
  { key: 'noir', name: 'Noir', eyebrow: 'Dark brand', description: 'Escuro e preciso para identidades que pedem contraste e presença.', bestFor: 'Tecnologia, automotivo, eventos e marcas premium' },
];

const DEFAULT_SECTIONS: CompanyPageSection[] = [
  { id: 'identity', type: 'identity', enabled: true, locked: true },
  { id: 'about', type: 'about', enabled: true },
  { id: 'jobs', type: 'jobs', enabled: true, locked: true },
  { id: 'contact', type: 'contact', enabled: true },
  { id: 'socials', type: 'socials', enabled: true },
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
  if (value === 'human') return 'font-sans tracking-[.005em]';
  return 'font-sans';
}

function radiusValue(value: CompanyPageConfig['branding'] extends infer T ? any : never) {
  if (value === 'square') return '0px';
  if (value === 'round') return '32px';
  return '16px';
}

export function CompanySiteRenderer({ company, jobs, page, preview = false }: { company: PublicCompanyLike; jobs: PublicJobLike[]; page?: CompanyPageConfig | null; preview?: boolean }) {
  const config = page || {};
  if (config.editorMode === 'code') {
    return (
      <FullPageCompanySandbox
        company={withPageOverrides(company, config)}
        jobs={jobs}
        html={config.codePage?.html || ''}
        css={config.codePage?.css || ''}
        js={config.codePage?.js || ''}
      />
    );
  }
  return <VisualCompanyMicrosite company={company} jobs={jobs} config={config} preview={preview} />;
}

function VisualCompanyMicrosite({ company, jobs, config, preview }: { company: PublicCompanyLike; jobs: PublicJobLike[]; config: CompanyPageConfig; preview: boolean }) {
  const template = templateKey(String(config.templateKey || 'aurora'));
  const dark = template === 'noir';
  const primary = config.theme?.primary || (dark ? '#ffffff' : '#111111');
  const accent = config.theme?.accent || primary;
  const background = config.theme?.background || (dark ? '#09090b' : '#ffffff');
  const text = config.theme?.text || (dark ? '#f5f5f4' : '#171717');
  const typography = config.branding?.typography || (template === 'canvas' ? 'editorial' : template === 'noir' ? 'technical' : 'clean');
  const radius = radiusValue(config.branding?.corners || (template === 'pulse' ? 'round' : 'soft'));
  const sections = Array.isArray(config.sections) && config.sections.length ? config.sections : DEFAULT_SECTIONS;
  const ordered = sections.filter((section) => section.type !== 'identity' && section.enabled !== false);
  const aboutText = config.about?.text || company.description || '';
  const location = companyLocation(company);
  const shell = widthClass(config.width);

  const style = {
    '--company-primary': primary,
    '--company-accent': accent,
    '--company-bg': background,
    '--company-text': text,
    '--company-radius': radius,
  } as React.CSSProperties;

  return (
    <div style={{ ...style, backgroundColor: background, color: text }} className={`min-h-screen w-full ${typographyClass(typography)}`}>
      {config.navigation?.enabled !== false && (
        <SiteNavigation company={company} config={config} dark={dark} shell={shell} />
      )}

      <Hero company={company} config={config} template={template} aboutText={aboutText} location={location} shell={shell} dark={dark} />

      <main className={`mx-auto w-full ${shell} ${config.width === 'full' ? '' : 'px-5 sm:px-8'}`}>
        {ordered.map((section) => {
          if (section.type === 'about' && aboutText) return <AboutSection key={section.id} title={config.about?.title || 'Sobre'} text={aboutText} template={template} />;
          if (section.type === 'jobs') return <JobsSection key={section.id} jobs={jobs} config={config} template={template} />;
          if (section.type === 'contact') return <ContactSection key={section.id} company={company} config={config} template={template} />;
          if (section.type === 'socials') return <SocialSection key={section.id} company={company} config={config} />;
          if (section.type === 'legal') return <LegalSection key={section.id} config={config} />;
          return null;
        })}
      </main>

      <footer className={`mx-auto mt-16 w-full ${shell} ${config.width === 'full' ? 'px-5 sm:px-8' : 'px-5 sm:px-8'} pb-8`}>
        <div className="flex flex-col gap-3 border-t pt-5 text-xs opacity-50 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)' }}>
          <span>{config.footer?.text || `© ${new Date().getFullYear()} ${company.name || 'Empresa'}`}</span>
          <span className="inline-flex items-center gap-1.5">{preview ? 'Prévia privada · ' : ''}<Link to="/" className="underline decoration-current/30 underline-offset-4 hover:opacity-80">PiraNegócios Business</Link></span>
        </div>
      </footer>
    </div>
  );
}

function SiteNavigation({ company, config, dark, shell }: { company: PublicCompanyLike; config: CompanyPageConfig; dark: boolean; shell: string }) {
  const sticky = config.navigation?.sticky !== false;
  const transparent = config.navigation?.transparent === true;
  const jobsLabel = config.navigation?.jobsLabel || 'Vagas';
  return (
    <div className={`${sticky ? 'sticky top-0 z-50' : 'relative z-20'} border-b backdrop-blur-xl`} style={{ borderColor: dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.08)', background: transparent ? 'transparent' : dark ? 'rgba(9,9,11,.9)' : 'rgba(255,255,255,.9)' }}>
      <div className={`mx-auto flex w-full ${shell} items-center gap-4 px-5 py-3 sm:px-8`}>
        <a href="#top" className="flex min-w-0 items-center gap-3">
          <CompanyLogo company={company} size="small" />
          <span className="truncate text-sm font-bold tracking-tight">{company.name}</span>
          <VerifiedSeal company={company} inverted={dark} />
        </a>
        <nav className="ml-auto hidden items-center gap-6 text-sm font-medium opacity-70 sm:flex">
          <a href="#sobre" className="hover:opacity-70">Sobre</a>
          <a href="#vagas" className="hover:opacity-70">{jobsLabel}</a>
          <a href="#contato" className="hover:opacity-70">Contato</a>
        </nav>
        <a href="#vagas" className="ml-auto rounded-full px-4 py-2 text-xs font-bold text-white sm:ml-0" style={{ backgroundColor: config.theme?.primary || '#111111' }}>{jobsLabel}</a>
      </div>
    </div>
  );
}

function Hero({ company, config, template, aboutText, location, shell, dark }: { company: PublicCompanyLike; config: CompanyPageConfig; template: ReturnType<typeof templateKey>; aboutText: string; location: string; shell: string; dark: boolean }) {
  const coverEnabled = Boolean(config.cover?.enabled && config.cover?.url);
  const heroLayout = config.hero?.layout || (template === 'canvas' ? 'minimal' : template === 'pulse' ? 'centered' : template === 'noir' ? 'cover' : 'split');
  const minHeight = config.cover?.height === 'small' ? '360px' : config.cover?.height === 'large' ? '650px' : '500px';
  const overlay = Math.max(0, Math.min(80, Number(config.cover?.overlay ?? 34))) / 100;
  const coverStyle = coverEnabled ? {
    backgroundImage: `linear-gradient(rgba(0,0,0,${overlay}), rgba(0,0,0,${Math.min(.75, overlay + .12)})), url(${config.cover?.url})`,
    backgroundPosition: config.cover?.position || 'center',
    backgroundSize: 'cover',
    minHeight,
  } : undefined;
  const title = config.hero?.title || company.name || 'Sua empresa';
  const subtitle = config.hero?.subtitle || aboutText;
  const eyebrow = config.hero?.eyebrow || '';
  const jobsLabel = config.hero?.jobsLabel || 'Ver oportunidades';
  const heroTextColor = coverEnabled ? '#fff' : undefined;

  if (heroLayout === 'minimal') {
    return (
      <section id="top" className={`mx-auto w-full ${shell} px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20`} style={{ color: heroTextColor }}>
        <div className="flex items-center gap-3"><CompanyLogo company={company} size="medium" /><VerifiedSeal company={company} inverted={coverEnabled || dark} /></div>
        {eyebrow && <p className="mt-12 text-xs font-bold uppercase tracking-[.22em] opacity-50">{eyebrow}</p>}
        <h1 className="mt-5 max-w-5xl text-5xl font-semibold leading-[.94] tracking-[-.055em] sm:text-7xl lg:text-8xl">{title}</h1>
        <div className="mt-10 grid gap-8 border-t pt-8 lg:grid-cols-[.65fr_1.35fr]" style={{ borderColor: coverEnabled || dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.14)' }}>
          <div className="space-y-3 text-sm opacity-65">{location && <p className="flex gap-2"><MapPin className="h-4 w-4" />{location}</p>}</div>
          <div>{subtitle && <p className="max-w-2xl text-lg leading-8 opacity-75">{subtitle}</p>}<a href="#vagas" className="mt-6 inline-flex items-center rounded-full px-5 py-3 text-sm font-bold text-white" style={{ backgroundColor: config.theme?.primary || '#111' }}>{jobsLabel}</a></div>
        </div>
      </section>
    );
  }

  const centered = heroLayout === 'centered';
  return (
    <section id="top" className={`relative overflow-hidden ${coverEnabled ? '' : 'border-b'} ${coverEnabled && config.width !== 'full' ? `mx-auto mt-5 ${shell} rounded-[var(--company-radius)]` : ''}`} style={coverEnabled ? coverStyle : { borderColor: dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.08)' }}>
      <div className={`mx-auto flex w-full ${shell} ${centered ? 'items-center justify-center text-center' : 'items-end'} px-5 py-16 sm:px-8 sm:py-24`} style={{ minHeight: coverEnabled ? minHeight : template === 'pulse' ? '540px' : '460px', color: heroTextColor }}>
        <div className={`${centered ? 'max-w-4xl' : 'grid w-full gap-12 lg:grid-cols-[1.25fr_.75fr] lg:items-end'}`}>
          <div>
            <div className={`flex items-center gap-3 ${centered ? 'justify-center' : ''}`}><CompanyLogo company={company} size={config.branding?.logoSize || 'large'} /><VerifiedSeal company={company} inverted={coverEnabled || dark} /></div>
            {eyebrow && <p className="mt-8 text-xs font-bold uppercase tracking-[.22em] opacity-60">{eyebrow}</p>}
            <h1 className="mt-5 text-5xl font-bold leading-[.94] tracking-[-.055em] sm:text-7xl lg:text-8xl">{title}</h1>
          </div>
          <div className={`${centered ? 'mx-auto mt-8 max-w-2xl' : ''}`}>
            {location && <p className={`flex gap-2 text-sm font-medium opacity-65 ${centered ? 'justify-center' : ''}`}><MapPin className="h-4 w-4 shrink-0" />{location}</p>}
            {subtitle && <p className="mt-5 text-base leading-7 opacity-75 sm:text-lg">{subtitle.length > 340 ? `${subtitle.slice(0, 340)}…` : subtitle}</p>}
            <a href="#vagas" className="mt-7 inline-flex items-center rounded-full px-5 py-3 text-sm font-bold text-white" style={{ backgroundColor: config.theme?.primary || '#111' }}>{jobsLabel}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function AboutSection({ title, text, template }: { title: string; text: string; template: ReturnType<typeof templateKey>; key?: React.Key }) {
  return (
    <section id="sobre" className={`py-16 sm:py-24 ${template === 'canvas' ? 'grid gap-10 lg:grid-cols-[.45fr_1fr]' : ''}`}>
      <SectionLabel>{title}</SectionLabel>
      <p className={`${template === 'canvas' ? 'text-2xl leading-10 sm:text-3xl sm:leading-[1.45]' : 'mt-6 max-w-4xl text-lg leading-8 opacity-75'}`}>{text}</p>
    </section>
  );
}

function JobsSection({ jobs, config, template }: { jobs: PublicJobLike[]; config: CompanyPageConfig; template: ReturnType<typeof templateKey>; key?: React.Key }) {
  const layout = config.jobs?.layout || (template === 'pulse' ? 'grid' : template === 'canvas' ? 'list' : 'grid');
  const title = config.jobs?.title || 'Oportunidades';
  const intro = config.jobs?.intro || 'Conheça as vagas abertas e encontre a próxima oportunidade para fazer parte do nosso time.';
  return (
    <section id="vagas" className="py-16 sm:py-24">
      <div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr] lg:items-end">
        <div><SectionLabel>{title}</SectionLabel></div>
        <p className="max-w-2xl text-base leading-7 opacity-65">{intro}</p>
      </div>
      {jobs.length === 0 ? (
        <div className="mt-10 border-y py-10 text-sm opacity-55" style={{ borderColor: 'rgba(127,127,127,.18)' }}>Nenhuma vaga aberta neste momento.</div>
      ) : (
        <div className={`mt-10 ${layout === 'list' || layout === 'compact' ? 'divide-y' : 'grid gap-4 md:grid-cols-2'}`} style={{ borderColor: 'rgba(127,127,127,.18)' }}>
          {jobs.map((job) => <JobItem key={job.id || job.slug || job.title} job={job} layout={layout} />)}
        </div>
      )}
    </section>
  );
}

function JobItem({ job, layout }: { job: PublicJobLike; layout: CompanyJobsLayout; key?: React.Key }) {
  const href = job.slug ? `/vagas/${encodeURIComponent(job.slug)}` : '/vagas';
  const location = job.location || [job.city, job.state].filter(Boolean).join(', ') || 'Local a combinar';
  if (layout === 'list' || layout === 'compact') {
    return (
      <Link to={href} className={`group flex items-center gap-5 py-5 ${layout === 'compact' ? 'text-sm' : ''}`}>
        <div className="min-w-0 flex-1"><h3 className={`${layout === 'compact' ? 'text-base' : 'text-xl'} font-semibold tracking-tight`}>{job.title || 'Oportunidade'}</h3><p className="mt-1 text-sm opacity-50">{location}{job.workModel ? ` · ${job.workModel}` : ''}</p></div>
        {job.salary && <span className="hidden text-sm font-medium opacity-55 sm:block">{job.salary}</span>}
        <ExternalLink className="h-4 w-4 opacity-35 transition group-hover:opacity-100" />
      </Link>
    );
  }
  return (
    <Link to={href} className="group border p-6 transition hover:-translate-y-0.5" style={{ borderColor: 'rgba(127,127,127,.18)', borderRadius: 'var(--company-radius)' }}>
      <div className="flex items-start justify-between gap-4"><h3 className="text-xl font-semibold tracking-tight">{job.title || 'Oportunidade'}</h3><ExternalLink className="h-4 w-4 shrink-0 opacity-35 transition group-hover:opacity-100" /></div>
      <p className="mt-4 text-sm opacity-55">{location}</p>
      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium opacity-55">{job.type && <span>{job.type}</span>}{job.workModel && <span>{job.workModel}</span>}{job.salary && <span>{job.salary}</span>}</div>
    </Link>
  );
}

function ContactSection({ company, config, template }: { company: PublicCompanyLike; config: CompanyPageConfig; template: ReturnType<typeof templateKey>; key?: React.Key }) {
  const phone = config.contacts?.phone || company.phone;
  const email = config.contacts?.email;
  const website = config.contacts?.website || company.website;
  const whatsapp = config.contacts?.whatsapp;
  const address = companyLocation(company);
  const items = [
    phone && { label: 'Telefone', value: phone, href: `tel:${phone.replace(/\D/g, '')}`, icon: <Phone className="h-4 w-4" /> },
    whatsapp && { label: 'WhatsApp', value: whatsapp, href: `https://wa.me/55${whatsapp.replace(/\D/g, '')}`, icon: <Phone className="h-4 w-4" /> },
    email && { label: 'E-mail', value: email, href: `mailto:${email}`, icon: <Mail className="h-4 w-4" /> },
    website && { label: 'Site', value: website, href: normalizedUrl(website), icon: <Globe className="h-4 w-4" /> },
    address && { label: 'Endereço', value: address, href: '', icon: <MapPin className="h-4 w-4" /> },
  ].filter(Boolean) as Array<{ label: string; value: string; href: string; icon: React.ReactNode }>;
  if (!items.length) return null;
  return (
    <section id="contato" className={`py-16 sm:py-24 ${template === 'atlas' ? 'border-t' : ''}`} style={{ borderColor: 'rgba(127,127,127,.18)' }}>
      <SectionLabel>Contato</SectionLabel>
      <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={`${item.label}-${item.value}`}><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] opacity-40">{item.icon}{item.label}</div>{item.href ? <a href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="mt-2 block break-words text-base font-medium hover:opacity-65">{item.value}</a> : <p className="mt-2 text-base font-medium">{item.value}</p>}</div>
        ))}
      </div>
    </section>
  );
}

function SocialSection({ company, config }: { company: PublicCompanyLike; config: CompanyPageConfig; key?: React.Key }) {
  const socials = [
    ['Instagram', config.socials?.instagram || company.socialInstagram, <Instagram className="h-4 w-4" />],
    ['LinkedIn', config.socials?.linkedin || company.socialLinkedin, <Linkedin className="h-4 w-4" />],
    ['Facebook', config.socials?.facebook || company.socialFacebook, <Facebook className="h-4 w-4" />],
    ['YouTube', config.socials?.youtube, <Youtube className="h-4 w-4" />],
    ['TikTok', config.socials?.tiktok, <Music2 className="h-4 w-4" />],
  ].filter((item) => Boolean(item[1])) as Array<[string, string, React.ReactNode]>;
  if (!socials.length) return null;
  return (
    <section className="pb-16 sm:pb-24"><div className="flex flex-wrap gap-3">{socials.map(([label, href, icon]) => <a key={label} href={normalizedUrl(href)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border px-4 py-2 text-sm font-medium hover:opacity-65" style={{ borderColor: 'rgba(127,127,127,.18)', borderRadius: '999px' }}>{icon}{label}</a>)}</div></section>
  );
}

function LegalSection({ config }: { config: CompanyPageConfig; key?: React.Key }) {
  const items = [
    config.legal?.termsEnabled && config.legal.termsBody ? { title: config.legal.termsTitle || 'Termos de uso', body: config.legal.termsBody } : null,
    config.legal?.privacyEnabled && config.legal.privacyBody ? { title: config.legal.privacyTitle || 'Política de privacidade', body: config.legal.privacyBody } : null,
  ].filter(Boolean) as Array<{ title: string; body: string }>;
  if (!items.length) return null;
  return <section className="border-t py-10" style={{ borderColor: 'rgba(127,127,127,.18)' }}>{items.map((item) => <details key={item.title} className="border-b py-4" style={{ borderColor: 'rgba(127,127,127,.14)' }}><summary className="cursor-pointer text-sm font-semibold">{item.title}</summary><div className="mt-4 whitespace-pre-wrap text-sm leading-7 opacity-65">{item.body}</div></details>)}</section>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-bold uppercase tracking-[.22em] opacity-45">{children}</h2>;
}

function CompanyLogo({ company, size = 'medium' }: { company: PublicCompanyLike; size?: 'small' | 'medium' | 'large' }) {
  const sizeClass = size === 'small' ? 'h-9 w-9' : size === 'large' ? 'h-20 w-20 sm:h-24 sm:w-24' : 'h-14 w-14';
  if (company.logoURL) return <img src={company.logoURL} alt={`Logo ${company.name || ''}`} className={`${sizeClass} shrink-0 object-contain`} />;
  return <span className={`${sizeClass} flex shrink-0 items-center justify-center border`} style={{ borderColor: 'rgba(127,127,127,.18)', borderRadius: 'var(--company-radius)' }}><Building2 className="h-5 w-5 opacity-45" /></span>;
}

function VerifiedSeal({ company, inverted = false }: { company: PublicCompanyLike; inverted?: boolean }) {
  if (!isVerified(company)) return null;
  return (
    <span title="Empresa verificada pelo PiraNegócios" aria-label="Empresa verificada pelo PiraNegócios" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ color: inverted ? '#fff' : '#0f9f6e', background: inverted ? 'rgba(255,255,255,.12)' : 'rgba(16,185,129,.10)' }}>
      <BadgeCheck className="h-5 w-5" />
    </span>
  );
}
