import React from 'react';
import {
  BadgeCheck,
  BriefcaseBusiness,
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
import { AdvancedSandbox } from './AdvancedSandbox';

export type CompanyPageWidth = 'compact' | 'standard' | 'wide' | 'full';
export type CompanyTemplateKey = 'essencial' | 'institucional' | 'vitrine' | 'editorial';

export interface CompanyPageSection {
  id: string;
  type: 'identity' | 'about' | 'contact' | 'socials' | 'advanced' | 'jobs' | 'legal' | string;
  enabled?: boolean;
  locked?: boolean;
}

export interface CompanyPageConfig {
  version?: number;
  templateKey?: CompanyTemplateKey | string;
  width?: CompanyPageWidth;
  theme?: { primary?: string; background?: string; text?: string; accent?: string };
  cover?: { enabled?: boolean; url?: string; height?: 'small' | 'medium' | 'large'; position?: string; overlay?: number };
  about?: { title?: string; text?: string };
  contacts?: { phone?: string; secondaryPhone?: string; whatsapp?: string; email?: string; website?: string };
  socials?: { instagram?: string; linkedin?: string; facebook?: string; youtube?: string; tiktok?: string };
  legal?: { termsEnabled?: boolean; termsTitle?: string; termsBody?: string; privacyEnabled?: boolean; privacyTitle?: string; privacyBody?: string };
  sections?: CompanyPageSection[];
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
  key: CompanyTemplateKey;
  name: string;
  description: string;
  eyebrow: string;
}> = [
  { key: 'essencial', name: 'Essencial', eyebrow: 'Limpo', description: 'Direto, elegante e com foco em marca, contato e vagas.' },
  { key: 'institucional', name: 'Institucional', eyebrow: 'Corporativo', description: 'Hero amplo, presença sólida e leitura mais formal.' },
  { key: 'vitrine', name: 'Vitrine', eyebrow: 'Visual', description: 'Capa protagonista e blocos fortes para marcas que querem impacto.' },
  { key: 'editorial', name: 'Editorial', eyebrow: 'Narrativo', description: 'Tipografia marcante e estrutura pensada para contar a história da empresa.' },
];

const DEFAULT_SECTIONS: CompanyPageSection[] = [
  { id: 'identity', type: 'identity', enabled: true, locked: true },
  { id: 'about', type: 'about', enabled: true },
  { id: 'contact', type: 'contact', enabled: true },
  { id: 'socials', type: 'socials', enabled: true },
  { id: 'advanced', type: 'advanced', enabled: false },
  { id: 'jobs', type: 'jobs', enabled: true, locked: true },
  { id: 'legal', type: 'legal', enabled: true },
];

function normalizedUrl(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw;
  return `https://${raw}`;
}

function widthClass(width: CompanyPageWidth = 'standard') {
  if (width === 'compact') return 'max-w-4xl';
  if (width === 'wide') return 'max-w-7xl';
  if (width === 'full') return 'max-w-none';
  return 'max-w-6xl';
}

function isVerified(company: PublicCompanyLike) {
  return Boolean(company.isVerified || company.verificationStatus === 'VERIFIED');
}

function companyLocation(company: PublicCompanyLike) {
  return company.address || company.cityState || [company.city, company.state].filter(Boolean).join(', ');
}

export function CompanySiteRenderer({
  company,
  jobs,
  page,
  preview = false,
}: {
  company: PublicCompanyLike;
  jobs: PublicJobLike[];
  page?: CompanyPageConfig | null;
  preview?: boolean;
}) {
  const config = page || {};
  const template = String(config.templateKey || 'essencial') as CompanyTemplateKey;
  const primary = config.theme?.primary || '#b64b36';
  const accent = config.theme?.accent || '#7c2d12';
  const background = config.theme?.background || '#fffdf9';
  const text = config.theme?.text || '#292524';
  const sections = Array.isArray(config.sections) && config.sections.length ? config.sections : DEFAULT_SECTIONS;
  const sectionEnabled = (type: string) => sections.some((section) => section.type === type && section.enabled !== false);
  const ordered = sections.filter((section) => section.type !== 'identity' && section.enabled !== false);
  const coverHeight = config.cover?.height === 'large' ? 'min-h-[480px]' : config.cover?.height === 'small' ? 'min-h-[260px]' : 'min-h-[360px]';
  const cover = Boolean(config.cover?.enabled && config.cover?.url);
  const location = companyLocation(company);
  const aboutText = config.about?.text || company.description || '';

  const shellStyle = { '--company-primary': primary, '--company-accent': accent } as React.CSSProperties;
  const headerClass = template === 'editorial'
    ? 'rounded-none border-y border-stone-200 bg-transparent'
    : template === 'institucional'
      ? 'rounded-[34px] shadow-[0_22px_70px_rgba(41,37,36,.12)]'
      : template === 'vitrine'
        ? 'rounded-[36px] shadow-[0_28px_80px_rgba(0,0,0,.24)]'
        : 'rounded-[28px] border border-stone-200/80 shadow-sm';

  return (
    <div style={{ ...shellStyle, backgroundColor: background, color: text }} className="min-h-screen w-full">
      <div className={`mx-auto w-full ${widthClass(config.width)} px-4 py-6 sm:px-6 sm:py-10 ${config.width === 'full' ? 'lg:px-8' : ''}`}>
        <header
          className={`relative overflow-hidden ${headerClass} ${cover ? coverHeight : ''}`}
          style={cover ? {
            backgroundImage: `linear-gradient(rgba(20,15,13,${Math.max(0, Math.min(75, Number(config.cover?.overlay ?? 28))) / 100}), rgba(20,15,13,${Math.max(0, Math.min(75, Number(config.cover?.overlay ?? 28))) / 100})), url(${config.cover?.url})`,
            backgroundPosition: config.cover?.position || 'center',
            backgroundSize: 'cover',
          } : template === 'vitrine' ? { background: `linear-gradient(135deg, ${accent}, ${primary})` } : { backgroundColor: template === 'editorial' ? background : `${primary}0D` }}
        >
          <div className={`relative z-10 flex h-full flex-col justify-end gap-6 p-7 sm:p-10 ${cover || template === 'vitrine' ? 'text-white' : ''}`}>
            <div className={`${template === 'editorial' ? 'max-w-4xl' : 'max-w-3xl'}`}>
              <div className="mb-5 flex items-center gap-4">
                {company.logoURL ? (
                  <img src={company.logoURL} alt="" className={`h-16 w-16 rounded-2xl object-cover ${cover || template === 'vitrine' ? 'bg-white p-1 shadow-xl' : 'border border-stone-200 bg-white p-1'}`} />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/90 text-2xl font-black text-stone-700 shadow-sm">
                    {String(company.name || 'E').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className={`${template === 'editorial' ? 'font-serif text-4xl sm:text-6xl' : 'text-3xl sm:text-5xl'} font-black tracking-tight`}>
                      {company.name || 'Sua empresa'}
                    </h1>
                    {isVerified(company) && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${cover || template === 'vitrine' ? 'bg-white/15 text-white ring-1 ring-white/25' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'}`}>
                        <BadgeCheck className="h-3.5 w-3.5" /> Verificada
                      </span>
                    )}
                  </div>
                  {location && (
                    <p className={`mt-2 flex items-start gap-1.5 text-sm font-medium ${cover || template === 'vitrine' ? 'text-white/80' : 'text-stone-500'}`}>
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {location}
                    </p>
                  )}
                </div>
              </div>
              {template === 'institucional' && aboutText && <p className="max-w-2xl text-base leading-7 text-stone-600">{aboutText.slice(0, 230)}{aboutText.length > 230 ? '…' : ''}</p>}
            </div>
          </div>
        </header>

        <main className={`${template === 'editorial' ? 'mt-12' : 'mt-8'} space-y-8`}>
          {ordered.map((section) => {
            if (section.type === 'about') {
              if (!aboutText) return null;
              return (
                <CompanySection key={section.id} template={template} title={config.about?.title || 'Sobre a empresa'}>
                  <p className={`${template === 'editorial' ? 'font-serif text-xl leading-9' : 'text-base leading-8'} whitespace-pre-line text-stone-600`}>{aboutText}</p>
                </CompanySection>
              );
            }

            if (section.type === 'contact') {
              const contacts = [
                { icon: Phone, label: config.contacts?.phone || company.phone, href: `tel:${config.contacts?.phone || company.phone || ''}` },
                { icon: Phone, label: config.contacts?.secondaryPhone, href: `tel:${config.contacts?.secondaryPhone || ''}` },
                { icon: Phone, label: config.contacts?.whatsapp ? `WhatsApp ${config.contacts.whatsapp}` : '', href: config.contacts?.whatsapp ? `https://wa.me/${config.contacts.whatsapp.replace(/\D/g, '')}` : '' },
                { icon: Mail, label: config.contacts?.email, href: config.contacts?.email ? `mailto:${config.contacts.email}` : '' },
                { icon: Globe, label: config.contacts?.website || company.website, href: normalizedUrl(config.contacts?.website || company.website) },
              ].filter((item) => item.label);
              if (!contacts.length) return null;
              return (
                <CompanySection key={section.id} template={template} title="Contato">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {contacts.map((item, index) => {
                      const Icon = item.icon;
                      return <a key={`${item.label}-${index}`} href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white/70 px-4 py-3 text-sm font-bold text-stone-700 transition hover:-translate-y-0.5 hover:shadow-md"><Icon className="h-4 w-4" style={{ color: primary }} /><span className="truncate">{item.label}</span></a>;
                    })}
                  </div>
                </CompanySection>
              );
            }

            if (section.type === 'socials') {
              const socials = [
                { icon: Instagram, label: 'Instagram', value: config.socials?.instagram || company.socialInstagram },
                { icon: Linkedin, label: 'LinkedIn', value: config.socials?.linkedin || company.socialLinkedin },
                { icon: Facebook, label: 'Facebook', value: config.socials?.facebook || company.socialFacebook },
                { icon: Youtube, label: 'YouTube', value: config.socials?.youtube },
                { icon: Music2, label: 'TikTok', value: config.socials?.tiktok },
              ].filter((item) => item.value);
              if (!socials.length) return null;
              return (
                <CompanySection key={section.id} template={template} title="Redes sociais">
                  <div className="flex flex-wrap gap-2.5">
                    {socials.map((item) => {
                      const Icon = item.icon;
                      return <a key={item.label} href={normalizedUrl(item.value)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-700 shadow-sm"><Icon className="h-4 w-4" style={{ color: primary }} />{item.label}</a>;
                    })}
                  </div>
                </CompanySection>
              );
            }

            if (section.type === 'advanced') {
              if (!config.advanced?.enabled) return null;
              return (
                <section key={section.id} className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
                  <AdvancedSandbox html={config.advanced.html} css={config.advanced.css} js={config.advanced.js} />
                </section>
              );
            }

            if (section.type === 'jobs') {
              return (
                <CompanySection key={section.id} template={template} title="Vagas abertas" icon={<BriefcaseBusiness className="h-5 w-5" />}>
                  {jobs.length ? (
                    <div className={`grid gap-4 ${template === 'vitrine' ? 'md:grid-cols-2' : ''}`}>
                      {jobs.map((job) => (
                        <Link key={job.id || job.slug || job.title} to={job.slug ? `/vagas/${job.slug}` : '#'} className="group flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                          <div className="min-w-0"><h3 className="font-black text-stone-900 group-hover:underline">{job.title || 'Oportunidade'}</h3><p className="mt-1 text-sm text-stone-500">{job.location || [job.city, job.state].filter(Boolean).join(', ') || 'Local a combinar'}</p></div>
                          <ExternalLink className="h-4 w-4 shrink-0" style={{ color: primary }} />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-10 text-center"><BriefcaseBusiness className="mx-auto h-7 w-7 text-stone-300" /><p className="mt-3 font-bold text-stone-700">Nenhuma vaga aberta neste momento.</p><p className="mt-1 text-sm text-stone-500">Quando a empresa publicar uma oportunidade, ela aparece aqui automaticamente.</p></div>
                  )}
                </CompanySection>
              );
            }

            if (section.type === 'legal') {
              if (!config.legal?.termsEnabled && !config.legal?.privacyEnabled) return null;
              return (
                <div key={section.id} className="flex flex-wrap items-center justify-center gap-4 border-t border-stone-200 py-6 text-xs font-bold text-stone-500">
                  {config.legal.termsEnabled && company.slug && <Link to={`/${company.slug}/termos`} className="hover:text-stone-900">{config.legal.termsTitle || 'Termos de uso'}</Link>}
                  {config.legal.privacyEnabled && company.slug && <Link to={`/${company.slug}/privacidade`} className="hover:text-stone-900">{config.legal.privacyTitle || 'Política de privacidade'}</Link>}
                </div>
              );
            }

            return null;
          })}

          {!sectionEnabled('jobs') && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              A prévia está sem o componente obrigatório de vagas. Ela pode ser salva como rascunho, mas não publicada.
            </div>
          )}
        </main>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 py-6 text-xs text-stone-400">
          <span>{preview ? 'Prévia privada · ' : ''}Página integrada ao PiraNegócios</span>
          <span>Vagas sincronizadas com o recrutamento da empresa</span>
        </footer>
      </div>
    </div>
  );
}

function CompanySection({ template, title, icon, children }: { template: CompanyTemplateKey; title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  const editorial = template === 'editorial';
  return (
    <section className={editorial ? 'grid gap-5 border-t border-stone-200 pt-7 md:grid-cols-[220px_1fr]' : 'rounded-[28px] border border-stone-200 bg-white/75 p-6 shadow-sm sm:p-8'}>
      <div className={`flex items-center gap-2 ${editorial ? 'self-start' : 'mb-5'}`}>{icon}<h2 className={`${editorial ? 'font-serif text-2xl' : 'text-lg'} font-black text-stone-900`}>{title}</h2></div>
      <div>{children}</div>
    </section>
  );
}
