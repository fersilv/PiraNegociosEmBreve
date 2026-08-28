import React from 'react';
import type { CompanyPageConfig, CompanyPageSection } from './CompanyPageExtensions';
import type { PublicCompanyLike, PublicJobLike } from './PremiumCompanySiteRenderer';
import { getCompanyThemeCapabilities } from './CompanyThemeCapabilities';

type Props = {
  themeKey: string;
  company: PublicCompanyLike;
  jobs: PublicJobLike[];
  config: CompanyPageConfig;
  preview?: boolean;
};

const SECTION_LABELS: Record<string, string> = {
  categories: 'Explorar', about: 'Sobre', jobs: 'Vagas', contact: 'Contato', socials: 'Redes', legal: 'Informações',
};

const WIDTHS: Record<string, string> = {
  compact: '760px', standard: '980px', wide: '1240px', full: '100%',
};

const FAMILY_CLASS: Record<string, string> = {
  institutional: 'pn-flex-institutional', commerce: 'pn-flex-commerce', classifieds: 'pn-flex-classifieds', services: 'pn-flex-services',
  food: 'pn-flex-food', fashion: 'pn-flex-fashion', creative: 'pn-flex-creative',
};

const DEFAULT_SECTION: Record<string, CompanyPageSection> = {
  identity: { id: 'identity', type: 'identity', enabled: true, locked: true },
  categories: { id: 'categories', type: 'categories', enabled: true },
  about: { id: 'about', type: 'about', enabled: true },
  jobs: { id: 'jobs', type: 'jobs', enabled: true },
  contact: { id: 'contact', type: 'contact', enabled: true },
  socials: { id: 'socials', type: 'socials', enabled: true },
  legal: { id: 'legal', type: 'legal', enabled: true },
};

function sectionList(config: CompanyPageConfig, themeKey: string) {
  const capabilities = getCompanyThemeCapabilities(themeKey);
  const saved = Array.isArray(config.sections) && config.sections.length ? config.sections.map((section) => ({ ...section })) : [];
  const seen = new Set(saved.map((section) => section.type));
  const sections = saved.length ? saved : capabilities.recommendedSections.map((type) => ({ ...DEFAULT_SECTION[type], id: type }));
  capabilities.requiredSections.forEach((type) => {
    if (!seen.has(type) && DEFAULT_SECTION[type]) sections.unshift({ ...DEFAULT_SECTION[type], id: type });
  });
  return sections;
}

function sectionWidth(section: CompanyPageSection, config: CompanyPageConfig) {
  const width = (section.contentWidth || section.width || config.width || 'wide') as string;
  return WIDTHS[width] || WIDTHS.wide;
}

function cleanUrl(value?: string) {
  const text = String(value || '').trim();
  if (!text) return '';
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

function phoneHref(value?: string) {
  return String(value || '').replace(/[^+\d]/g, '');
}

function whatsappHref(value?: string) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits.startsWith('55') ? digits : `55${digits}`}` : '';
}

function socialEntries(config: CompanyPageConfig) {
  const socials = config.socials || {};
  return [
    ['Instagram', socials.instagram], ['LinkedIn', socials.linkedin], ['Facebook', socials.facebook], ['YouTube', socials.youtube], ['TikTok', socials.tiktok],
  ].filter(([, value]) => Boolean(value)) as string[][];
}

function resolveHeroBackground(config: CompanyPageConfig) {
  return config.cover?.enabled && config.cover?.url ? `url(${JSON.stringify(config.cover.url)})` : undefined;
}

function JobCards({ jobs, config }: { jobs: PublicJobLike[]; config: CompanyPageConfig }) {
  const layout = config.jobs?.layout || 'grid';
  if (!jobs.length) return <p className="pn-flex-empty">Nenhuma oportunidade publicada no momento.</p>;
  return <div className={`pn-flex-jobs pn-flex-jobs-${layout}`}>
    {jobs.map((raw, index) => {
      const job = raw as any;
      const id = job.id || index;
      const location = [job.city, job.state].filter(Boolean).join(', ') || job.location || '';
      return <article className="pn-flex-job" key={id}>
        <div>
          <p className="pn-flex-kicker">{job.workModel || job.type || 'Oportunidade'}</p>
          <h3>{job.title || 'Vaga'}</h3>
          {location ? <p className="pn-flex-muted">{location}</p> : null}
        </div>
        {job.id ? <a className="pn-flex-link" href={`/vagas/${job.id}`}>Ver oportunidade</a> : null}
      </article>;
    })}
  </div>;
}

function Categories({ config }: { config: CompanyPageConfig }) {
  if (config.categories?.enabled === false) return null;
  const items = Array.isArray(config.categories?.items) ? config.categories?.items : [];
  if (!items.length) return null;
  return <div className="pn-flex-category-grid">
    {items.map((item) => <a key={item.id || item.href || item.label} href={item.href || '#'} className="pn-flex-category"><span>{item.label}</span><b>↗</b></a>)}
  </div>;
}

function Contact({ company, config }: { company: PublicCompanyLike; config: CompanyPageConfig }) {
  const companyAny = company as any;
  const phone = config.contacts?.phone || companyAny.phone;
  const whatsapp = config.contacts?.whatsapp;
  const email = config.contacts?.email || companyAny.email;
  const website = config.contacts?.website || companyAny.website;
  const address = companyAny.address || [companyAny.city, companyAny.state].filter(Boolean).join(', ');
  const rows = [
    phone && { label: 'Telefone', value: phone, href: `tel:${phoneHref(phone)}` },
    whatsapp && { label: 'WhatsApp', value: whatsapp, href: whatsappHref(whatsapp) },
    email && { label: 'E-mail', value: email, href: `mailto:${email}` },
    website && { label: 'Site', value: website, href: cleanUrl(website) },
    address && { label: 'Endereço', value: address },
  ].filter(Boolean) as Array<{ label: string; value: string; href?: string }>;
  if (!rows.length) return <p className="pn-flex-empty">Adicione os canais de contato da empresa no editor.</p>;
  return <div className="pn-flex-contact-grid">{rows.map((row) => <div className="pn-flex-contact" key={row.label}><small>{row.label}</small>{row.href ? <a href={row.href} target={row.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{row.value}</a> : <strong>{row.value}</strong>}</div>)}</div>;
}

function renderSection(section: CompanyPageSection, props: Props) {
  if (section.enabled === false || section.type === 'identity') return null;
  const { company, jobs, config } = props;
  const maxHeight = Number(section.maxHeight || 0);
  const style: React.CSSProperties = {
    ['--pn-section-width' as any]: sectionWidth(section, config),
    maxHeight: maxHeight > 0 ? `${maxHeight}px` : undefined,
    overflow: maxHeight > 0 ? 'auto' : undefined,
  };
  const title = section.type === 'about' ? config.about?.title || 'Sobre nós'
    : section.type === 'jobs' ? config.jobs?.title || 'Oportunidades'
      : section.type === 'categories' ? config.categories?.title || 'Explore'
        : SECTION_LABELS[section.type] || section.type;
  let body: React.ReactNode = null;
  if (section.type === 'categories') body = <Categories config={config} />;
  if (section.type === 'about') body = <p className="pn-flex-about">{config.about?.text || (company as any).description || 'Conte aqui a história, o propósito e os diferenciais da empresa.'}</p>;
  if (section.type === 'jobs') body = <><p className="pn-flex-intro">{config.jobs?.intro || ''}</p><JobCards jobs={jobs} config={config} /></>;
  if (section.type === 'contact') body = <Contact company={company} config={config} />;
  if (section.type === 'socials') {
    const entries = socialEntries(config);
    body = entries.length ? <div className="pn-flex-socials">{entries.map(([label, url]) => <a key={label} href={cleanUrl(url)} target="_blank" rel="noreferrer">{label}<span>↗</span></a>)}</div> : <p className="pn-flex-empty">Nenhuma rede social adicionada.</p>;
  }
  if (section.type === 'legal') {
    const legal = config.legal || {};
    const pieces = [legal.termsEnabled && { title: legal.termsTitle || 'Termos de uso', body: legal.termsBody }, legal.privacyEnabled && { title: legal.privacyTitle || 'Privacidade', body: legal.privacyBody }].filter(Boolean) as Array<{ title: string; body?: string }>;
    if (!pieces.length) return null;
    body = <div className="pn-flex-legal">{pieces.map((piece) => <details key={piece.title}><summary>{piece.title}</summary><p>{piece.body || 'Conteúdo não informado.'}</p></details>)}</div>;
  }
  if (body === null) return null;
  return <section key={section.id} id={section.type === 'categories' ? 'explorar' : section.type === 'about' ? 'sobre' : section.type === 'jobs' ? 'vagas' : section.type === 'contact' ? 'contato' : section.type} className={`pn-flex-section pn-flex-section-${section.type} pn-flex-content-${section.contentMode || 'section'}`} style={style}>
    <div className="pn-flex-section-inner"><p className="pn-flex-kicker">{SECTION_LABELS[section.type] || 'Conteúdo'}</p><h2>{title}</h2>{body}</div>
  </section>;
}

export function FlexibleCompanyThemeRenderer(props: Props) {
  const { company, config, themeKey } = props;
  const capabilities = getCompanyThemeCapabilities(themeKey);
  const sections = sectionList(config, themeKey);
  const enabledSections = sections.filter((section) => section.enabled !== false && section.type !== 'identity');
  const companyAny = company as any;
  const heroWidth = WIDTHS[String(config.hero?.contentWidth || config.hero?.width || config.width || 'wide')] || WIDTHS.wide;
  const logoSize = config.branding?.logoSize === 'small' ? 42 : config.branding?.logoSize === 'large' ? 76 : 56;
  const corners = config.branding?.corners === 'square' ? '0px' : config.branding?.corners === 'pill' ? '999px' : '18px';
  const rootStyle: React.CSSProperties = {
    ['--pn-primary' as any]: config.theme?.primary || '#151515',
    ['--pn-accent' as any]: config.theme?.accent || '#78716c',
    ['--pn-bg' as any]: config.theme?.background || '#ffffff',
    ['--pn-text' as any]: config.theme?.text || '#18181b',
    ['--pn-corners' as any]: corners,
    ['--pn-logo-size' as any]: `${logoSize}px`,
    ['--pn-hero-width' as any]: heroWidth,
  };
  const heroBackground = resolveHeroBackground(config);
  const heroStyle: React.CSSProperties = heroBackground ? {
    backgroundImage: `linear-gradient(rgba(0,0,0,${Math.min(90, Math.max(0, Number(config.cover?.overlay ?? 28))) / 100}),rgba(0,0,0,${Math.min(90, Math.max(0, Number(config.cover?.overlay ?? 28))) / 100})),${heroBackground}`,
    backgroundPosition: config.cover?.position || 'center', backgroundSize: 'cover',
  } : {};
  const heroMax = Number(config.hero?.maxHeight || 0);
  if (heroMax > 0) heroStyle.maxHeight = `${heroMax}px`;

  return <div className={`pn-flex-theme ${FAMILY_CLASS[capabilities.family] || ''} pn-flex-key-${themeKey} pn-flex-type-${config.branding?.typography || 'clean'} pn-flex-hero-${config.hero?.layout || 'cover'}`} style={rootStyle}>
    <style>{FLEXIBLE_THEME_CSS}</style>
    {config.navigation?.enabled !== false ? <header className={`pn-flex-nav ${config.navigation?.sticky !== false ? 'is-sticky' : ''} ${config.navigation?.transparent ? 'is-transparent' : ''}`}>
      <a href="#top" className="pn-flex-brand">{companyAny.logoUrl ? <img src={companyAny.logoUrl} alt="" /> : <span>{String(company.name || 'E').slice(0, 1)}</span>}<strong>{company.name}</strong></a>
      <nav>{enabledSections.filter((section) => ['categories', 'about', 'jobs', 'contact'].includes(section.type)).map((section) => <a key={section.id} href={`#${section.type === 'categories' ? 'explorar' : section.type === 'about' ? 'sobre' : section.type === 'jobs' ? 'vagas' : 'contato'}`}>{section.type === 'jobs' ? config.navigation?.jobsLabel || 'Vagas' : SECTION_LABELS[section.type]}</a>)}</nav>
    </header> : null}
    <main id="top">
      <section className="pn-flex-hero" style={heroStyle}>
        <div className="pn-flex-hero-inner">
          <div className="pn-flex-hero-copy"><p className="pn-flex-kicker">{config.hero?.eyebrow || (capabilities.family === 'commerce' ? 'Loja oficial' : capabilities.family === 'services' ? 'Serviços' : 'Empresa')}</p><h1>{config.hero?.title || company.name}</h1><p>{config.hero?.subtitle || companyAny.description || ''}</p><div className="pn-flex-hero-actions">{enabledSections.some((section) => section.type === 'contact') ? <a href="#contato">Falar com a empresa</a> : null}{enabledSections.some((section) => section.type === 'jobs') ? <a className="is-secondary" href="#vagas">{config.hero?.jobsLabel || 'Ver oportunidades'}</a> : null}</div></div>
          <div className="pn-flex-hero-mark">{companyAny.logoUrl ? <img src={companyAny.logoUrl} alt={company.name || ''} /> : <span>{String(company.name || 'E').slice(0, 2).toUpperCase()}</span>}</div>
        </div>
      </section>
      {enabledSections.map((section) => renderSection(section, props))}
    </main>
    <footer className="pn-flex-company-footer"><strong>{company.name}</strong><span>{config.footer?.text || 'Informações, produtos, serviços e oportunidades da empresa.'}</span></footer>
  </div>;
}

const FLEXIBLE_THEME_CSS = `
.pn-flex-theme{background:var(--pn-bg);color:var(--pn-text);min-height:100%;font-family:Inter,ui-sans-serif,system-ui,sans-serif;line-height:1.5}.pn-flex-theme *{box-sizing:border-box}.pn-flex-theme a{color:inherit}.pn-flex-type-editorial{font-family:Georgia,'Times New Roman',serif}.pn-flex-type-technical{font-family:'Courier New',monospace}.pn-flex-nav{height:78px;display:flex;align-items:center;justify-content:space-between;gap:28px;padding:0 max(24px,calc((100% - 1240px)/2));border-bottom:1px solid color-mix(in srgb,var(--pn-text) 12%,transparent);background:color-mix(in srgb,var(--pn-bg) 94%,transparent);backdrop-filter:blur(18px);z-index:20}.pn-flex-nav.is-sticky{position:sticky;top:0}.pn-flex-nav.is-transparent{background:color-mix(in srgb,var(--pn-bg) 70%,transparent)}.pn-flex-brand{display:flex;align-items:center;gap:12px;text-decoration:none;min-width:0}.pn-flex-brand img,.pn-flex-brand span{width:38px;height:38px;border-radius:12px;object-fit:contain;background:color-mix(in srgb,var(--pn-primary) 10%,white);display:grid;place-items:center;font-weight:900}.pn-flex-brand strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pn-flex-nav nav{display:flex;gap:22px;align-items:center}.pn-flex-nav nav a{text-decoration:none;font-size:13px;font-weight:700;opacity:.72}.pn-flex-nav nav a:hover{opacity:1}.pn-flex-hero{min-height:540px;display:grid;align-items:center;padding:76px 24px;background:linear-gradient(135deg,color-mix(in srgb,var(--pn-primary) 8%,var(--pn-bg)),var(--pn-bg));overflow:hidden}.pn-flex-hero-inner{width:min(var(--pn-hero-width),100%);margin:auto;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(220px,.65fr);gap:70px;align-items:center}.pn-flex-hero-copy h1{font-size:clamp(48px,8vw,104px);letter-spacing:-.065em;line-height:.9;margin:14px 0 24px;max-width:900px}.pn-flex-hero-copy>p:not(.pn-flex-kicker){max-width:670px;font-size:clamp(16px,2vw,21px);opacity:.7}.pn-flex-kicker{margin:0 0 10px;font-size:10px!important;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:var(--pn-accent)}.pn-flex-hero-mark{aspect-ratio:1;border:1px solid color-mix(in srgb,var(--pn-text) 14%,transparent);border-radius:var(--pn-corners);display:grid;place-items:center;background:color-mix(in srgb,var(--pn-bg) 75%,transparent);overflow:hidden}.pn-flex-hero-mark img{width:min(68%,240px);max-height:68%;object-fit:contain}.pn-flex-hero-mark span{font-size:clamp(56px,9vw,126px);font-weight:900;letter-spacing:-.08em}.pn-flex-hero-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:34px}.pn-flex-hero-actions a,.pn-flex-link{display:inline-flex;align-items:center;justify-content:center;padding:13px 18px;border-radius:var(--pn-corners);background:var(--pn-primary);color:white!important;text-decoration:none;font-size:12px;font-weight:800}.pn-flex-hero-actions a.is-secondary{background:transparent;color:var(--pn-text)!important;border:1px solid color-mix(in srgb,var(--pn-text) 18%,transparent)}.pn-flex-hero-cover .pn-flex-hero-copy{color:white}.pn-flex-hero-center .pn-flex-hero-inner,.pn-flex-hero-centered .pn-flex-hero-inner{grid-template-columns:1fr;text-align:center}.pn-flex-hero-center .pn-flex-hero-mark,.pn-flex-hero-centered .pn-flex-hero-mark{display:none}.pn-flex-hero-center .pn-flex-hero-copy>p,.pn-flex-hero-centered .pn-flex-hero-copy>p{margin-left:auto;margin-right:auto}.pn-flex-hero-center .pn-flex-hero-actions,.pn-flex-hero-centered .pn-flex-hero-actions{justify-content:center}.pn-flex-section{padding:82px 24px;border-top:1px solid color-mix(in srgb,var(--pn-text) 10%,transparent)}.pn-flex-section-inner{width:min(var(--pn-section-width),100%);margin:auto}.pn-flex-section h2{font-size:clamp(34px,5vw,66px);letter-spacing:-.05em;line-height:.98;margin:0 0 34px}.pn-flex-content-independent{padding-left:0;padding-right:0}.pn-flex-about{font-size:clamp(18px,2.2vw,28px);line-height:1.55;max-width:920px;opacity:.78}.pn-flex-intro{max-width:700px;opacity:.68;margin:-20px 0 30px}.pn-flex-category-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.pn-flex-category{min-height:120px;padding:22px;border:1px solid color-mix(in srgb,var(--pn-text) 13%,transparent);border-radius:var(--pn-corners);display:flex;align-items:flex-end;justify-content:space-between;text-decoration:none;font-weight:800;background:color-mix(in srgb,var(--pn-primary) 4%,var(--pn-bg))}.pn-flex-category b{font-size:22px}.pn-flex-jobs{display:grid;gap:12px}.pn-flex-jobs-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pn-flex-jobs-compact .pn-flex-job{min-height:auto}.pn-flex-job{min-height:180px;padding:24px;border:1px solid color-mix(in srgb,var(--pn-text) 13%,transparent);border-radius:var(--pn-corners);display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.pn-flex-job h3{font-size:21px;margin:5px 0}.pn-flex-muted,.pn-flex-empty{opacity:.6}.pn-flex-contact-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}.pn-flex-contact{padding:22px;border-radius:var(--pn-corners);background:color-mix(in srgb,var(--pn-primary) 6%,var(--pn-bg));display:flex;flex-direction:column;gap:8px}.pn-flex-contact small{font-size:10px;text-transform:uppercase;font-weight:800;letter-spacing:.12em;opacity:.55}.pn-flex-contact a,.pn-flex-contact strong{font-size:16px;text-decoration:none;word-break:break-word}.pn-flex-socials{display:flex;flex-wrap:wrap;gap:10px}.pn-flex-socials a{min-width:160px;display:flex;justify-content:space-between;padding:16px 18px;border:1px solid color-mix(in srgb,var(--pn-text) 13%,transparent);border-radius:var(--pn-corners);text-decoration:none;font-weight:700}.pn-flex-legal details{border-top:1px solid color-mix(in srgb,var(--pn-text) 13%,transparent);padding:18px 0}.pn-flex-legal summary{cursor:pointer;font-weight:800}.pn-flex-legal p{max-width:860px;white-space:pre-wrap;opacity:.7}.pn-flex-company-footer{display:flex;justify-content:space-between;gap:20px;padding:34px max(24px,calc((100% - 1240px)/2));border-top:1px solid color-mix(in srgb,var(--pn-text) 12%,transparent);font-size:12px}.pn-flex-company-footer span{opacity:.55}.pn-flex-commerce .pn-flex-hero,.pn-flex-classifieds .pn-flex-hero{background:var(--pn-primary);color:white}.pn-flex-commerce .pn-flex-hero-mark,.pn-flex-classifieds .pn-flex-hero-mark{background:color-mix(in srgb,var(--pn-primary) 82%,white);border-color:rgba(255,255,255,.22)}.pn-flex-commerce .pn-flex-kicker,.pn-flex-classifieds .pn-flex-kicker{color:color-mix(in srgb,var(--pn-accent) 70%,white)}.pn-flex-services .pn-flex-hero-inner{grid-template-columns:minmax(0,1fr) minmax(180px,.45fr)}.pn-flex-fashion .pn-flex-hero{min-height:680px}.pn-flex-fashion .pn-flex-hero-copy h1{font-weight:500}.pn-flex-creative .pn-flex-section:nth-child(even){background:color-mix(in srgb,var(--pn-accent) 5%,var(--pn-bg))}.pn-flex-key-marketplace .pn-flex-category,.pn-flex-key-classificados-pro .pn-flex-category{min-height:150px}.pn-flex-key-catalogo .pn-flex-category{aspect-ratio:1.25}.pn-flex-key-institucional-pro .pn-flex-hero-copy h1{max-width:1050px}.pn-flex-key-servicos-pro .pn-flex-contact{border-left:4px solid var(--pn-accent)}
@media(max-width:760px){.pn-flex-nav{height:auto;padding:14px 16px}.pn-flex-nav nav{display:none}.pn-flex-hero{min-height:auto;padding:58px 18px}.pn-flex-hero-inner{grid-template-columns:1fr;gap:32px}.pn-flex-hero-mark{max-width:240px}.pn-flex-section{padding:58px 18px}.pn-flex-jobs-grid{grid-template-columns:1fr}.pn-flex-job{align-items:flex-start;flex-direction:column}.pn-flex-company-footer{padding:28px 18px;flex-direction:column}}
`;
