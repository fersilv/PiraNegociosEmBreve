import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BadgeCheck, Grid3X3, Loader2, MapPin, PackageOpen, Search, ShoppingBag, Sparkles, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { classifiedPrice } from '../classifieds/ClassifiedListingCard';
import type { ClassifiedListing } from '../../types/classifieds';
import type { CompanyPageConfig, CompanyPageSection, CompanyPageCategoryLink, CompanyCategoryStyle, CompanyProductsLayout } from './CompanyPageExtensions';
import type { PublicCompanyLike, PublicJobLike } from './PremiumCompanySiteRenderer';

export const COMMERCE_COMPANY_THEME_KEYS = ['loja', 'vitrine', 'marketplace', 'catalogo', 'classificados-pro', 'mercado', 'gazeta', 'mosaico', 'radar', 'pregao'] as const;
export type CommerceCompanyThemeKey = typeof COMMERCE_COMPANY_THEME_KEYS[number];

export function isCommerceCompanyTheme(value?: string | null): value is CommerceCompanyThemeKey {
  return COMMERCE_COMPANY_THEME_KEYS.includes(String(value || '') as CommerceCompanyThemeKey);
}

type Props = {
  themeKey: CommerceCompanyThemeKey;
  company: PublicCompanyLike;
  jobs: PublicJobLike[];
  config: CompanyPageConfig;
  preview?: boolean;
};

type ThemeDefaults = {
  categoryStyle: CompanyCategoryStyle;
  productsLayout: CompanyProductsLayout;
  showSearch: boolean;
  bannerStyle: 'full' | 'split' | 'compact' | 'editorial';
  featuredTitle: string;
};

const THEME_DEFAULTS: Record<CommerceCompanyThemeKey, ThemeDefaults> = {
  loja: { categoryStyle: 'image-tiles', productsLayout: 'carousel', showSearch: false, bannerStyle: 'full', featuredTitle: 'Escolhas da marca' },
  vitrine: { categoryStyle: 'image-tiles', productsLayout: 'grid', showSearch: false, bannerStyle: 'split', featuredTitle: 'Vitrine' },
  marketplace: { categoryStyle: 'circles', productsLayout: 'carousel', showSearch: true, bannerStyle: 'compact', featuredTitle: 'Destaques para você' },
  catalogo: { categoryStyle: 'tiles', productsLayout: 'grid', showSearch: false, bannerStyle: 'editorial', featuredTitle: 'Catálogo' },
  'classificados-pro': { categoryStyle: 'chips', productsLayout: 'list', showSearch: true, bannerStyle: 'compact', featuredTitle: 'Anúncios em destaque' },
  mercado: { categoryStyle: 'circles', productsLayout: 'carousel', showSearch: true, bannerStyle: 'split', featuredTitle: 'Ofertas da loja' },
  gazeta: { categoryStyle: 'chips', productsLayout: 'list', showSearch: false, bannerStyle: 'editorial', featuredTitle: 'Classificados' },
  mosaico: { categoryStyle: 'image-tiles', productsLayout: 'masonry', showSearch: false, bannerStyle: 'full', featuredTitle: 'Descobertas' },
  radar: { categoryStyle: 'tiles', productsLayout: 'grid', showSearch: true, bannerStyle: 'split', featuredTitle: 'Perto de você' },
  pregao: { categoryStyle: 'chips', productsLayout: 'list', showSearch: true, bannerStyle: 'compact', featuredTitle: 'Oportunidades abertas' },
};

const LABELS: Record<string, string> = {
  categories: 'Categorias', classifieds: 'Produtos e serviços', about: 'Sobre', contact: 'Contato', socials: 'Redes sociais', jobs: 'Vagas', legal: 'Informações',
};

const DEFAULT_SECTION: Record<string, CompanyPageSection> = {
  identity: { id: 'identity', type: 'identity', enabled: true, locked: true },
  categories: { id: 'categories', type: 'categories', enabled: true },
  classifieds: { id: 'classifieds', type: 'classifieds', enabled: true },
  about: { id: 'about', type: 'about', enabled: true },
  contact: { id: 'contact', type: 'contact', enabled: true },
  socials: { id: 'socials', type: 'socials', enabled: true },
  jobs: { id: 'jobs', type: 'jobs', enabled: true },
  legal: { id: 'legal', type: 'legal', enabled: true },
};

function sectionList(config: CompanyPageConfig) {
  if (Array.isArray(config.sections) && config.sections.length) return config.sections.map((section) => ({ ...section }));
  return ['identity', 'categories', 'classifieds', 'about', 'contact', 'socials', 'jobs', 'legal'].map((type) => ({ ...DEFAULT_SECTION[type] }));
}

function cleanUrl(value?: string) {
  const text = String(value || '').trim();
  if (!text) return '';
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

function primaryImage(listing?: ClassifiedListing) {
  return listing?.images?.find((image) => image.isPrimary)?.url || listing?.images?.[0]?.url || '';
}

function categoryEntries(config: CompanyPageConfig, listings: ClassifiedListing[]): CompanyPageCategoryLink[] {
  const configured = Array.isArray(config.categories?.items) ? config.categories!.items!.filter((item) => item.label) : [];
  if (configured.length) {
    return configured.map((item) => {
      if (item.imageUrl) return item;
      const match = listings.find((listing) => listing.categorySlug === item.id || item.href?.includes(listing.categorySlug));
      return { ...item, imageUrl: primaryImage(match) || undefined };
    });
  }
  const unique = [...new Set(listings.map((listing) => listing.categorySlug).filter(Boolean))].slice(0, 10);
  return unique.map((slug) => {
    const match = listings.find((listing) => listing.categorySlug === slug);
    return { id: slug, label: slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), href: `#categoria-${slug}`, imageUrl: primaryImage(match) || undefined };
  });
}

function storefrontOptions(config: CompanyPageConfig, themeKey: CommerceCompanyThemeKey) {
  const defaults = THEME_DEFAULTS[themeKey];
  return {
    promoText: config.storefront?.promoText || '',
    secondaryPromoText: config.storefront?.secondaryPromoText || '',
    showSearch: config.storefront?.showSearch ?? defaults.showSearch,
    searchPlaceholder: config.storefront?.searchPlaceholder || 'O que você procura?',
    bannerStyle: config.storefront?.bannerStyle || defaults.bannerStyle,
    categoryStyle: config.storefront?.categoryStyle || defaults.categoryStyle,
    productsLayout: config.storefront?.productsLayout || defaults.productsLayout,
    cardsPerRow: config.storefront?.cardsPerRow || 4,
    featuredTitle: config.storefront?.featuredTitle || defaults.featuredTitle,
    showProducts: config.storefront?.showProducts !== false,
    showServices: config.storefront?.showServices !== false,
  };
}

function CommerceSearch({ placeholder }: { placeholder: string }) {
  return <form className="pc-search" action="/classificados/busca" method="get"><Search className="pc-search-icon" /><input name="q" placeholder={placeholder} /><button type="submit">Buscar</button></form>;
}

function BrandLockup({ company }: { company: PublicCompanyLike }) {
  const companyAny = company as any;
  const logo = companyAny.logoURL || companyAny.logoUrl;
  return <div className="pc-brand">{logo ? <img src={logo} alt="" /> : <span>{String(company.name || 'L').slice(0, 1)}</span>}<strong>{company.name}</strong>{(companyAny.isVerified || companyAny.verificationStatus === 'VERIFIED') ? <BadgeCheck className="pc-verified" /> : null}</div>;
}

function Header({ company, config, sections, themeKey, search }: { company: PublicCompanyLike; config: CompanyPageConfig; sections: CompanyPageSection[]; themeKey: CommerceCompanyThemeKey; search: boolean }) {
  const links = sections.filter((section) => section.enabled !== false && ['categories', 'classifieds', 'about', 'contact'].includes(section.type));
  return <header className={`pc-header ${config.navigation?.sticky === false ? '' : 'is-sticky'}`}><div className="pc-header-inner"><a href="#top" className="pc-brand-link"><BrandLockup company={company} /></a>{themeKey === 'marketplace' || themeKey === 'mercado' ? <div className="pc-header-search">{search ? <CommerceSearch placeholder={config.storefront?.searchPlaceholder || 'Buscar nesta vitrine'} /> : null}</div> : null}<nav>{links.map((section) => <a key={section.id} href={`#${section.type === 'classifieds' ? 'vitrine' : section.type === 'categories' ? 'categorias' : section.type === 'about' ? 'sobre' : 'contato'}`}>{LABELS[section.type]}</a>)}</nav></div></header>;
}

function Hero({ company, config, themeKey, listings, search }: { company: PublicCompanyLike; config: CompanyPageConfig; themeKey: CommerceCompanyThemeKey; listings: ClassifiedListing[]; search: boolean }) {
  const companyAny = company as any;
  const cover = config.cover?.enabled && config.cover?.url ? config.cover.url : '';
  const logo = companyAny.logoURL || companyAny.logoUrl;
  const location = companyAny.cityState || [companyAny.city, companyAny.state].filter(Boolean).join(' · ');
  const options = storefrontOptions(config, themeKey);
  const imageCandidates = listings.map(primaryImage).filter(Boolean).slice(0, 4);
  const title = config.hero?.title || company.name;
  const subtitle = config.hero?.subtitle || companyAny.description || '';

  if (themeKey === 'gazeta') return <section className="pc-hero pc-hero-gazeta"><div className="pc-gazeta-rule"><span>{location || 'Classificados locais'}</span><span>{new Date().getFullYear()}</span></div><p className="pc-gazeta-kicker">{config.hero?.eyebrow || 'Edição comercial'}</p><h1>{title}</h1><div className="pc-gazeta-bottom"><p>{subtitle}</p><a href="#vitrine">Ver anúncios <ArrowRight /></a></div></section>;

  if (themeKey === 'pregao') return <section className="pc-hero pc-hero-pregao"><div className="pc-pregao-top"><span>MARKET / {company.name.toUpperCase()}</span><span>● ONLINE</span></div><div className="pc-pregao-grid"><div><p className="pc-mono-label">VITRINE VERIFICADA</p><h1>{title}</h1><p>{subtitle}</p>{search ? <CommerceSearch placeholder={options.searchPlaceholder} /> : null}</div><div className="pc-pregao-stats"><div><small>ITENS</small><b>{listings.length}</b></div><div><small>PRODUTOS</small><b>{listings.filter((item) => item.listingType !== 'SERVICE').length}</b></div><div><small>SERVIÇOS</small><b>{listings.filter((item) => item.listingType === 'SERVICE').length}</b></div></div></div></section>;

  if (themeKey === 'marketplace' || themeKey === 'mercado' || themeKey === 'classificados-pro') return <section className={`pc-hero pc-hero-discovery pc-hero-${themeKey}`}><div className="pc-discovery-copy"><p className="pc-eyebrow">{config.hero?.eyebrow || (themeKey === 'classificados-pro' ? 'Classificados da empresa' : 'Loja oficial')}</p><h1>{title}</h1><p>{subtitle}</p>{search ? <CommerceSearch placeholder={options.searchPlaceholder} /> : null}<div className="pc-discovery-meta"><span><BadgeCheck /> Empresa verificada</span>{location ? <span><MapPin /> {location}</span> : null}</div></div><div className="pc-discovery-art">{cover ? <img src={cover} alt="" /> : imageCandidates.length ? <div className="pc-mini-collage">{imageCandidates.map((image, index) => <img key={`${image}-${index}`} src={image} alt="" />)}</div> : <div className="pc-logo-poster">{logo ? <img src={logo} alt="" /> : <ShoppingBag />}</div>}</div></section>;

  if (themeKey === 'catalogo') return <section className="pc-hero pc-hero-catalogo"><div className="pc-catalogo-index"><span>CATÁLOGO</span><span>{String(listings.length).padStart(2, '0')} itens</span></div><div className="pc-catalogo-grid"><div><p className="pc-eyebrow">{config.hero?.eyebrow || 'Coleção da empresa'}</p><h1>{title}</h1><p>{subtitle}</p><a href="#vitrine">Explorar catálogo <ArrowRight /></a></div><div className="pc-catalogo-image">{cover ? <img src={cover} alt="" /> : imageCandidates[0] ? <img src={imageCandidates[0]} alt="" /> : logo ? <img className="is-logo" src={logo} alt="" /> : <PackageOpen />}</div></div></section>;

  if (themeKey === 'mosaico') return <section className="pc-hero pc-hero-mosaico"><div className="pc-mosaico-title"><p className="pc-eyebrow">{config.hero?.eyebrow || 'Seleção visual'}</p><h1>{title}</h1><p>{subtitle}</p></div><div className="pc-mosaico-art">{[cover, ...imageCandidates].filter(Boolean).slice(0, 5).map((image, index) => <img key={`${image}-${index}`} src={image} alt="" />)}{!cover && !imageCandidates.length ? <div className="pc-logo-poster">{logo ? <img src={logo} alt="" /> : <ShoppingBag />}</div> : null}</div></section>;

  if (themeKey === 'radar') return <section className="pc-hero pc-hero-radar"><div className="pc-radar-rings"><i /><i /><i /></div><div className="pc-radar-copy"><p className="pc-eyebrow">{config.hero?.eyebrow || 'Descoberta local'}</p><h1>{title}</h1><p>{subtitle}</p>{location ? <div className="pc-radar-location"><MapPin /> {location}</div> : null}{search ? <CommerceSearch placeholder={options.searchPlaceholder} /> : null}</div><div className="pc-radar-pin">{logo ? <img src={logo} alt="" /> : <span>{String(company.name || 'L').slice(0, 1)}</span>}</div></section>;

  return <section className={`pc-hero pc-hero-store pc-banner-${options.bannerStyle}`} style={cover ? { backgroundImage: `linear-gradient(rgba(0,0,0,.28),rgba(0,0,0,.48)),url(${JSON.stringify(cover)})` } : undefined}><div className="pc-store-copy"><p className="pc-eyebrow">{config.hero?.eyebrow || 'Loja oficial'}</p><h1>{title}</h1><p>{subtitle}</p><div className="pc-store-actions"><a href="#vitrine">Comprar agora <ArrowRight /></a>{location ? <span><MapPin /> {location}</span> : null}</div></div>{!cover ? <div className="pc-store-art">{imageCandidates.slice(0, 3).map((image, index) => <img key={`${image}-${index}`} src={image} alt="" />)}{!imageCandidates.length ? <div className="pc-logo-poster">{logo ? <img src={logo} alt="" /> : <ShoppingBag />}</div> : null}</div> : null}</section>;
}

function PromoStrip({ primary, secondary }: { primary?: string; secondary?: string }) {
  if (!primary && !secondary) return null;
  return <div className="pc-promo-strip"><span>{primary || secondary}</span>{primary && secondary ? <span>{secondary}</span> : null}</div>;
}

function Categories({ entries, style }: { entries: CompanyPageCategoryLink[]; style: CompanyCategoryStyle }) {
  if (!entries.length) return null;
  return <div className={`pc-categories pc-categories-${style}`}>{entries.map((item, index) => <a key={item.id || `${item.label}-${index}`} href={item.href || '#vitrine'}><div className="pc-category-media">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <Grid3X3 />}</div><span>{item.label}</span><ArrowRight /></a>)}</div>;
}

function ProductCard({ listing, themeKey, index }: { listing: ClassifiedListing; themeKey: CommerceCompanyThemeKey; index: number }) {
  const image = primaryImage(listing);
  const location = [listing.city, listing.state].filter(Boolean).join(' · ');
  if (themeKey === 'gazeta') return <Link to={`/classificados/explorar/${encodeURIComponent(listing.slug)}`} className="pc-gazeta-row"><span className="pc-gazeta-number">{String(index + 1).padStart(2, '0')}</span><div><small>{listing.listingType === 'SERVICE' ? 'SERVIÇO' : listing.categorySlug}</small><h3>{listing.title}</h3></div><strong>{classifiedPrice(listing)}</strong><ArrowRight /></Link>;
  if (themeKey === 'pregao') return <Link to={`/classificados/explorar/${encodeURIComponent(listing.slug)}`} className="pc-pregao-row"><span>{String(index + 1).padStart(2, '0')}</span><b>{listing.title}</b><span>{listing.listingType === 'SERVICE' ? 'SERVICE' : listing.categorySlug.toUpperCase()}</span><strong>{classifiedPrice(listing)}</strong><span className="pc-up">VER ↗</span></Link>;
  if (themeKey === 'classificados-pro') return <Link to={`/classificados/explorar/${encodeURIComponent(listing.slug)}`} className="pc-listing-row"><div className="pc-listing-thumb">{image ? <img src={image} alt="" /> : <PackageOpen />}</div><div className="pc-listing-main"><small>{listing.listingType === 'SERVICE' ? 'Serviço' : listing.categorySlug}</small><h3>{listing.title}</h3><span>{location}</span></div><strong>{classifiedPrice(listing)}</strong><ArrowRight /></Link>;
  return <Link to={`/classificados/explorar/${encodeURIComponent(listing.slug)}`} className={`pc-product-card ${listing.isFeatured ? 'is-featured' : ''}`}><div className="pc-product-image">{image ? <img src={image} alt="" /> : <div><PackageOpen /></div>}{listing.isFeatured ? <span>DESTAQUE</span> : null}</div><div className="pc-product-copy"><small>{listing.listingType === 'SERVICE' ? 'Serviço' : listing.categorySlug.replace(/[-_]/g, ' ')}</small><h3>{listing.title}</h3><strong>{classifiedPrice(listing)}</strong>{location ? <p>{location}</p> : null}</div></Link>;
}

function ListingShelf({ title, items, layout, cardsPerRow, themeKey }: { title?: string; items: ClassifiedListing[]; layout: CompanyProductsLayout; cardsPerRow: number; themeKey: CommerceCompanyThemeKey }) {
  if (!items.length) return null;
  return <div className="pc-shelf">{title ? <div className="pc-shelf-heading"><h3>{title}</h3><span>{items.length} {items.length === 1 ? 'item' : 'itens'}</span></div> : null}<div className={`pc-products pc-products-${layout}`} style={{ ['--pc-columns' as any]: cardsPerRow }}>{items.map((listing, index) => <ProductCard key={listing.id} listing={listing} themeKey={themeKey} index={index} />)}</div></div>;
}

function ClassifiedsSection({ items, config, themeKey, loading }: { items: ClassifiedListing[]; config: CompanyPageConfig; themeKey: CommerceCompanyThemeKey; loading: boolean }) {
  const options = storefrontOptions(config, themeKey);
  const products = items.filter((item) => item.listingType !== 'SERVICE');
  const services = items.filter((item) => item.listingType === 'SERVICE');
  if (loading) return <div className="pc-loading"><Loader2 /></div>;
  if (!items.length) return null;
  const featured = items.filter((item) => item.isFeatured);
  return <div className="pc-catalog-body">{featured.length > 0 && themeKey !== 'gazeta' && themeKey !== 'pregao' ? <ListingShelf title={options.featuredTitle} items={featured} layout={options.productsLayout === 'list' ? 'grid' : options.productsLayout} cardsPerRow={options.cardsPerRow} themeKey={themeKey} /> : null}{options.showProducts ? <ListingShelf title={services.length ? 'Produtos' : featured.length ? 'Todos os produtos' : options.featuredTitle} items={products} layout={options.productsLayout} cardsPerRow={options.cardsPerRow} themeKey={themeKey} /> : null}{options.showServices ? <ListingShelf title={products.length ? 'Serviços' : options.featuredTitle} items={services} layout={options.productsLayout} cardsPerRow={options.cardsPerRow} themeKey={themeKey} /> : null}</div>;
}

function ContactSection({ company, config }: { company: PublicCompanyLike; config: CompanyPageConfig }) {
  const companyAny = company as any;
  const rows = [
    ['WhatsApp', config.contacts?.whatsapp, config.contacts?.whatsapp ? `https://wa.me/${String(config.contacts.whatsapp).replace(/\D/g, '')}` : ''],
    ['Telefone', config.contacts?.phone || companyAny.phone, config.contacts?.phone || companyAny.phone ? `tel:${String(config.contacts?.phone || companyAny.phone).replace(/[^+\d]/g, '')}` : ''],
    ['E-mail', config.contacts?.email || companyAny.email, config.contacts?.email || companyAny.email ? `mailto:${config.contacts?.email || companyAny.email}` : ''],
    ['Site', config.contacts?.website || companyAny.website, cleanUrl(config.contacts?.website || companyAny.website)],
  ].filter((row) => Boolean(row[1]));
  return <div className="pc-contact-grid">{rows.map(([label, value, href]) => <a key={label} href={href || '#'} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer"><small>{label}</small><strong>{value}</strong><ArrowRight /></a>)}</div>;
}

function JobsSection({ jobs, config }: { jobs: PublicJobLike[]; config: CompanyPageConfig }) {
  if (!jobs.length) return null;
  return <div className="pc-jobs">{jobs.slice(0, 6).map((job: any, index) => <Link key={job.id || index} to={job.slug ? `/vagas/${job.slug}` : job.id ? `/vagas/${job.id}` : '/vagas'}><small>{job.workModel || 'Oportunidade'}</small><h3>{job.title}</h3><span>{job.location || [job.city, job.state].filter(Boolean).join(' · ')}</span><ArrowRight /></Link>)}</div>;
}

function GenericSection({ section, company, jobs, config }: { section: CompanyPageSection; company: PublicCompanyLike; jobs: PublicJobLike[]; config: CompanyPageConfig }) {
  if (section.enabled === false) return null;
  const companyAny = company as any;
  if (section.type === 'about') return <section id="sobre" className="pc-section pc-about"><p className="pc-section-kicker">Sobre</p><h2>{config.about?.title || 'Sobre a marca'}</h2><p>{config.about?.text || companyAny.description || ''}</p></section>;
  if (section.type === 'contact') return <section id="contato" className="pc-section"><p className="pc-section-kicker">Contato</p><h2>Fale com {company.name}</h2><ContactSection company={company} config={config} /></section>;
  if (section.type === 'jobs' && jobs.length) return <section id="vagas" className="pc-section"><p className="pc-section-kicker">Carreiras</p><h2>{config.jobs?.title || 'Trabalhe com a gente'}</h2><JobsSection jobs={jobs} config={config} /></section>;
  if (section.type === 'socials') {
    const links = [['Instagram', config.socials?.instagram], ['LinkedIn', config.socials?.linkedin], ['Facebook', config.socials?.facebook], ['YouTube', config.socials?.youtube], ['TikTok', config.socials?.tiktok]].filter((row) => Boolean(row[1]));
    if (!links.length) return null;
    return <section className="pc-section pc-social-section"><p className="pc-section-kicker">Acompanhe</p><div className="pc-socials">{links.map(([label, url]) => <a key={label} href={cleanUrl(url)} target="_blank" rel="noreferrer">{label}<ArrowRight /></a>)}</div></section>;
  }
  if (section.type === 'legal') {
    const legal = config.legal || {};
    if (!legal.termsEnabled && !legal.privacyEnabled) return null;
    return <section className="pc-section pc-legal">{legal.termsEnabled ? <details><summary>{legal.termsTitle || 'Termos de uso'}</summary><p>{legal.termsBody}</p></details> : null}{legal.privacyEnabled ? <details><summary>{legal.privacyTitle || 'Política de privacidade'}</summary><p>{legal.privacyBody}</p></details> : null}</section>;
  }
  return null;
}

export function CommerceCompanyThemeRenderer({ themeKey, company, jobs, config, preview = false }: Props) {
  const [items, setItems] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(Boolean((company as any).id));
  const sections = useMemo(() => sectionList(config), [config.sections]);
  const options = storefrontOptions(config, themeKey);

  useEffect(() => {
    const companyId = (company as any).id;
    if (!companyId) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    api.get(`/classifieds/company/${companyId}/listings`).then((response) => {
      if (!active) return;
      const payload = response.data;
      const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
      setItems(rows);
    }).catch(() => { if (active) setItems([]); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [(company as any).id]);

  const categories = useMemo(() => categoryEntries(config, items), [config.categories?.items, items]);
  const visible = sections.filter((section) => section.enabled !== false && section.type !== 'identity');
  const rootStyle: React.CSSProperties = {
    ['--pc-primary' as any]: config.theme?.primary || '#171717',
    ['--pc-accent' as any]: config.theme?.accent || '#ff5a36',
    ['--pc-bg' as any]: config.theme?.background || '#ffffff',
    ['--pc-text' as any]: config.theme?.text || '#171717',
  };

  return <div className={`pc-theme pc-theme-${themeKey} ${preview ? 'is-preview' : ''}`} style={rootStyle}><style>{COMMERCE_CSS}</style><PromoStrip primary={options.promoText} secondary={options.secondaryPromoText} /><Header company={company} config={config} sections={sections} themeKey={themeKey} search={options.showSearch} /><main id="top"><Hero company={company} config={config} themeKey={themeKey} listings={items} search={options.showSearch && themeKey !== 'marketplace' && themeKey !== 'mercado'} />{visible.map((section) => {
    if (section.type === 'categories') return config.categories?.enabled === false || !categories.length ? null : <section key={section.id} id="categorias" className="pc-section pc-section-categories"><div className="pc-section-heading"><p className="pc-section-kicker">Navegue</p><h2>{config.categories?.title || 'Categorias'}</h2></div><Categories entries={categories} style={options.categoryStyle} /></section>;
    if (section.type === 'classifieds') return <section key={section.id} id="vitrine" className="pc-section pc-section-catalog"><div className="pc-section-heading"><p className="pc-section-kicker">Vitrine oficial</p><h2>{options.featuredTitle}</h2><p>Produtos e serviços publicados por {company.name} nos Classificados.</p></div><ClassifiedsSection items={items} config={config} themeKey={themeKey} loading={loading} /></section>;
    return <React.Fragment key={section.id}><GenericSection section={section} company={company} jobs={jobs} config={config} /></React.Fragment>;
  })}</main><footer className="pc-company-footer"><BrandLockup company={company} /><span>{config.footer?.text || 'Vitrine, atendimento e informações da empresa.'}</span></footer></div>;
}

const COMMERCE_CSS = `
.pc-theme{--pc-radius:22px;background:var(--pc-bg);color:var(--pc-text);min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.pc-theme *{box-sizing:border-box}.pc-theme a{color:inherit}.pc-promo-strip{min-height:34px;display:flex;align-items:center;justify-content:center;gap:30px;padding:7px 18px;background:var(--pc-primary);color:#fff;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.pc-header{z-index:40;border-bottom:1px solid rgba(0,0,0,.09);background:color-mix(in srgb,var(--pc-bg) 94%,transparent);backdrop-filter:blur(18px)}.pc-header.is-sticky{position:sticky;top:0}.pc-header-inner{max-width:1480px;margin:auto;min-height:72px;padding:12px 28px;display:flex;align-items:center;gap:28px}.pc-brand-link{text-decoration:none}.pc-brand{display:flex;align-items:center;gap:10px;min-width:0}.pc-brand img,.pc-brand>span{width:40px;height:40px;border-radius:12px;object-fit:contain;background:#fff;display:grid;place-items:center;font-weight:950}.pc-brand strong{white-space:nowrap}.pc-verified{width:16px;color:var(--pc-accent)}.pc-header nav{margin-left:auto;display:flex;align-items:center;gap:20px}.pc-header nav a{text-decoration:none;font-size:11px;font-weight:850}.pc-header-search{flex:1;max-width:620px}.pc-search{height:50px;display:flex;align-items:center;gap:10px;border:1px solid rgba(0,0,0,.12);border-radius:999px;background:#fff;padding:5px 6px 5px 16px;color:#111}.pc-search-icon{width:17px}.pc-search input{flex:1;min-width:0;border:0;outline:0;font:inherit;font-size:13px}.pc-search button{border:0;border-radius:999px;background:var(--pc-primary);color:white;padding:11px 18px;font-size:11px;font-weight:900}.pc-hero{max-width:1480px;margin:0 auto}.pc-eyebrow,.pc-section-kicker{margin:0 0 12px;font-size:10px;font-weight:950;letter-spacing:.18em;text-transform:uppercase;color:var(--pc-accent)}.pc-hero h1{margin:0;letter-spacing:-.065em;line-height:.88}.pc-hero p{line-height:1.65}.pc-hero-store{max-width:none;min-height:680px;padding:70px max(28px,calc((100% - 1480px)/2));display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,.72fr);gap:55px;align-items:center;background:linear-gradient(135deg,color-mix(in srgb,var(--pc-primary) 92%,black),var(--pc-primary));color:white;background-size:cover;background-position:center}.pc-store-copy h1{font-size:clamp(64px,10vw,150px);max-width:1000px}.pc-store-copy>p:not(.pc-eyebrow){max-width:650px;font-size:18px;opacity:.72}.pc-store-actions{display:flex;align-items:center;gap:22px;margin-top:30px;flex-wrap:wrap}.pc-store-actions>a{display:inline-flex;align-items:center;gap:10px;border-radius:999px;background:white;color:#111;padding:15px 22px;text-decoration:none;font-size:12px;font-weight:900}.pc-store-actions span{display:flex;align-items:center;gap:7px;font-size:12px;opacity:.7}.pc-store-actions svg{width:16px}.pc-store-art{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:260px 190px;gap:12px;transform:rotate(2deg)}.pc-store-art img{width:100%;height:100%;object-fit:cover;border-radius:26px}.pc-store-art img:first-child{grid-row:span 2}.pc-logo-poster{width:100%;min-height:280px;border-radius:32px;background:rgba(255,255,255,.11);display:grid;place-items:center}.pc-logo-poster img{max-width:60%;max-height:180px;object-fit:contain!important}.pc-logo-poster svg{width:70px;height:70px}.pc-hero-discovery{padding:58px 28px 64px;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(330px,.9fr);gap:48px;align-items:center}.pc-discovery-copy h1{font-size:clamp(52px,7vw,105px);max-width:950px}.pc-discovery-copy>p:not(.pc-eyebrow){max-width:680px;color:color-mix(in srgb,var(--pc-text) 68%,transparent);font-size:17px}.pc-discovery-copy .pc-search{margin-top:30px;max-width:720px;box-shadow:0 20px 60px rgba(0,0,0,.1)}.pc-discovery-meta{display:flex;gap:18px;flex-wrap:wrap;margin-top:22px;font-size:11px;font-weight:800;opacity:.62}.pc-discovery-meta span{display:flex;gap:6px;align-items:center}.pc-discovery-meta svg{width:15px}.pc-discovery-art{min-height:440px;display:grid;place-items:center}.pc-discovery-art>img{width:100%;height:440px;object-fit:cover;border-radius:34px}.pc-mini-collage{width:100%;height:440px;display:grid;grid-template-columns:1.25fr .75fr;grid-template-rows:1fr 1fr;gap:10px}.pc-mini-collage img{width:100%;height:100%;object-fit:cover;border-radius:22px}.pc-mini-collage img:first-child{grid-row:span 2}.pc-theme-marketplace{--pc-primary:#ffe600;--pc-accent:#3483fa;--pc-bg:#f5f5f5;--pc-text:#222}.pc-theme-marketplace .pc-promo-strip{color:#222}.pc-theme-marketplace .pc-header{background:#ffe600}.pc-theme-marketplace .pc-search button{background:#3483fa}.pc-theme-marketplace .pc-hero-discovery{max-width:none;padding-left:max(28px,calc((100% - 1480px)/2));padding-right:max(28px,calc((100% - 1480px)/2));background:linear-gradient(#ffe600 0 52%,#f5f5f5 52%)}.pc-theme-marketplace .pc-discovery-copy{padding:40px 0}.pc-theme-mercado{--pc-primary:#fff7ed;--pc-accent:#ea580c;--pc-bg:#fffaf5;--pc-text:#34170d}.pc-theme-mercado .pc-header{background:#fffaf5}.pc-theme-mercado .pc-hero-discovery{background:radial-gradient(circle at 12% 20%,#fed7aa,transparent 38%),linear-gradient(120deg,#fff7ed,#ffedd5)}.pc-theme-classificados-pro{--pc-primary:#111827;--pc-accent:#f97316;--pc-bg:#f3f4f6;--pc-text:#111827}.pc-theme-classificados-pro .pc-hero-discovery{max-width:none;background:#111827;color:white;padding-left:max(28px,calc((100% - 1480px)/2));padding-right:max(28px,calc((100% - 1480px)/2))}.pc-theme-classificados-pro .pc-discovery-copy>p:not(.pc-eyebrow){color:#cbd5e1}.pc-hero-catalogo{padding:40px 28px 80px}.pc-catalogo-index{display:flex;justify-content:space-between;border-top:1px solid;padding-top:12px;font:800 10px/1 monospace;letter-spacing:.14em}.pc-catalogo-grid{display:grid;grid-template-columns:minmax(0,.82fr) minmax(0,1.18fr);gap:72px;align-items:end;margin-top:58px}.pc-catalogo-grid h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(64px,9vw,138px);letter-spacing:-.07em}.pc-catalogo-grid>div:first-child>p:not(.pc-eyebrow){max-width:520px;font-family:Georgia,serif;font-size:19px;opacity:.68}.pc-catalogo-grid a{display:inline-flex;align-items:center;gap:8px;margin-top:28px;font-size:12px;font-weight:900}.pc-catalogo-image{height:620px;background:#e7e5e4;display:grid;place-items:center;overflow:hidden}.pc-catalogo-image img{width:100%;height:100%;object-fit:cover}.pc-catalogo-image img.is-logo{object-fit:contain;padding:18%}.pc-catalogo-image svg{width:80px;height:80px;opacity:.25}.pc-hero-gazeta{padding:26px 28px 54px;font-family:Georgia,serif}.pc-gazeta-rule{border-top:5px double #111;border-bottom:1px solid #111;padding:9px 0;display:flex;justify-content:space-between;font:700 10px/1 monospace;letter-spacing:.1em;text-transform:uppercase}.pc-gazeta-kicker{text-align:center;margin:30px 0 8px!important;font:700 11px/1 monospace!important;text-transform:uppercase;letter-spacing:.15em}.pc-hero-gazeta h1{text-align:center;font-size:clamp(70px,12vw,174px);font-weight:400;letter-spacing:-.075em;border-bottom:5px double #111;padding-bottom:24px}.pc-gazeta-bottom{display:grid;grid-template-columns:1fr auto;gap:40px;align-items:end;padding-top:20px}.pc-gazeta-bottom p{font-size:17px;max-width:650px}.pc-gazeta-bottom a{display:flex;align-items:center;gap:8px;font:bold 12px/1 monospace}.pc-gazeta-bottom svg{width:16px}.pc-hero-mosaico{max-width:none;min-height:700px;display:grid;grid-template-columns:.72fr 1.28fr;gap:25px;padding:24px}.pc-mosaico-title{padding:58px 32px;display:flex;flex-direction:column;justify-content:flex-end;background:var(--pc-primary);color:white;border-radius:34px}.pc-mosaico-title h1{font-size:clamp(66px,9vw,130px)}.pc-mosaico-title>p:not(.pc-eyebrow){max-width:540px;opacity:.68}.pc-mosaico-art{display:grid;grid-template-columns:1fr .75fr;grid-template-rows:1fr .72fr;gap:10px}.pc-mosaico-art img{width:100%;height:100%;object-fit:cover;border-radius:28px}.pc-mosaico-art img:first-child{grid-row:span 2}.pc-mosaico-art img:nth-child(n+4){display:none}.pc-hero-radar{position:relative;min-height:620px;display:grid;grid-template-columns:1fr 280px;align-items:center;overflow:hidden;padding:70px 50px;background:linear-gradient(135deg,#ecfeff,#f0fdfa)}.pc-radar-rings{position:absolute;right:-80px;top:50%;width:650px;height:650px;transform:translateY(-50%);border:1px solid #0f766e22;border-radius:50%}.pc-radar-rings i{position:absolute;inset:16%;border:1px solid #0f766e33;border-radius:50%}.pc-radar-rings i:nth-child(2){inset:33%}.pc-radar-rings i:nth-child(3){inset:47%;background:#0f766e0e}.pc-radar-copy{position:relative;z-index:2;max-width:850px}.pc-radar-copy h1{font-size:clamp(58px,8vw,118px)}.pc-radar-copy>p:not(.pc-eyebrow){max-width:620px;font-size:18px;opacity:.68}.pc-radar-location{display:flex;align-items:center;gap:7px;margin-top:20px;font-size:12px;font-weight:850;color:#0f766e}.pc-radar-copy .pc-search{max-width:650px;margin-top:26px}.pc-radar-pin{position:relative;z-index:2;width:150px;height:150px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);background:#0f766e;display:grid;place-items:center;box-shadow:0 28px 90px #0f766e55}.pc-radar-pin img,.pc-radar-pin span{transform:rotate(45deg);width:72px;height:72px;object-fit:contain;color:white;font-size:54px;font-weight:950}.pc-hero-pregao{max-width:none;padding:0;background:#070b0a;color:#d1fae5;font-family:'Courier New',monospace}.pc-pregao-top{height:42px;padding:0 max(24px,calc((100% - 1480px)/2));display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #34d39933;color:#34d399;font-size:10px;font-weight:bold}.pc-pregao-grid{max-width:1480px;margin:auto;min-height:580px;padding:70px 28px;display:grid;grid-template-columns:1fr 360px;gap:60px;align-items:center}.pc-mono-label{font-size:10px!important;letter-spacing:.18em;color:#34d399}.pc-pregao-grid h1{font-size:clamp(58px,8vw,118px);text-transform:uppercase}.pc-pregao-grid>div:first-child>p:not(.pc-mono-label){max-width:700px;color:#a7f3d0aa}.pc-pregao-grid .pc-search{margin-top:30px;max-width:680px;border-radius:0;background:#0b1210;border-color:#34d39944;color:#d1fae5}.pc-pregao-grid .pc-search input{background:transparent;color:#d1fae5}.pc-pregao-grid .pc-search button{border-radius:0;background:#34d399;color:#052e16}.pc-pregao-stats{border:1px solid #34d39944}.pc-pregao-stats>div{padding:25px;border-bottom:1px solid #34d39933;display:flex;justify-content:space-between;align-items:end}.pc-pregao-stats>div:last-child{border-bottom:0}.pc-pregao-stats small{font-size:9px;color:#34d399}.pc-pregao-stats b{font-size:38px}.pc-section{max-width:1480px;margin:auto;padding:78px 28px;border-top:1px solid rgba(0,0,0,.09)}.pc-section-heading{display:grid;grid-template-columns:1fr minmax(260px,.6fr);gap:30px;align-items:end;margin-bottom:34px}.pc-section-heading .pc-section-kicker{grid-column:1/-1;margin-bottom:-15px}.pc-section-heading h2{font-size:clamp(38px,5.5vw,76px);letter-spacing:-.055em;line-height:.95;margin:0}.pc-section-heading>p:not(.pc-section-kicker){max-width:460px;opacity:.58;margin:0}.pc-categories{display:flex;gap:12px}.pc-categories>a{text-decoration:none}.pc-categories-chips{overflow-x:auto}.pc-categories-chips a{white-space:nowrap;border:1px solid rgba(0,0,0,.12);border-radius:999px;padding:12px 18px;font-size:12px;font-weight:850;display:flex;align-items:center;gap:15px}.pc-categories-chips .pc-category-media,.pc-categories-chips a>svg{display:none}.pc-categories-circles{overflow-x:auto;padding-bottom:10px}.pc-categories-circles a{min-width:116px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:9px;font-size:11px;font-weight:850}.pc-categories-circles .pc-category-media{width:92px;height:92px;border-radius:50%;overflow:hidden;background:#fff;border:1px solid rgba(0,0,0,.09);display:grid;place-items:center}.pc-categories-circles .pc-category-media img{width:100%;height:100%;object-fit:cover}.pc-categories-circles .pc-category-media svg{width:24px;opacity:.3}.pc-categories-circles a>svg{display:none}.pc-categories-tiles,.pc-categories-image-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}.pc-categories-tiles a,.pc-categories-image-tiles a{min-height:150px;border:1px solid rgba(0,0,0,.1);border-radius:var(--pc-radius);padding:18px;display:grid;grid-template-columns:1fr auto;align-items:end;overflow:hidden;font-size:13px;font-weight:900;position:relative}.pc-categories-tiles .pc-category-media{position:absolute;inset:0;background:color-mix(in srgb,var(--pc-primary) 7%,var(--pc-bg));display:grid;place-items:center;z-index:-1}.pc-categories-tiles .pc-category-media img{display:none}.pc-categories-image-tiles a{min-height:230px;color:white}.pc-categories-image-tiles .pc-category-media{position:absolute;inset:0;background:#333;z-index:-1}.pc-categories-image-tiles .pc-category-media:after{content:'';position:absolute;inset:0;background:linear-gradient(transparent 35%,rgba(0,0,0,.68))}.pc-categories-image-tiles .pc-category-media img{width:100%;height:100%;object-fit:cover}.pc-categories-image-tiles .pc-category-media svg{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);opacity:.4}.pc-catalog-body{display:grid;gap:54px}.pc-shelf-heading{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:18px}.pc-shelf-heading h3{font-size:24px;letter-spacing:-.035em;margin:0}.pc-shelf-heading span{font-size:10px;font-weight:850;opacity:.45}.pc-products{display:grid;gap:16px}.pc-products-grid{grid-template-columns:repeat(var(--pc-columns),minmax(0,1fr))}.pc-products-carousel{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:12px}.pc-products-carousel .pc-product-card{flex:0 0 min(310px,75vw);scroll-snap-align:start}.pc-products-masonry{grid-template-columns:repeat(var(--pc-columns),minmax(0,1fr));align-items:start}.pc-products-masonry .pc-product-card:nth-child(3n+1) .pc-product-image{aspect-ratio:.78}.pc-products-masonry .pc-product-card:nth-child(3n+2) .pc-product-image{aspect-ratio:1.08}.pc-products-list{display:block;border-top:1px solid rgba(0,0,0,.11)}.pc-product-card{text-decoration:none;min-width:0}.pc-product-image{aspect-ratio:1/1.08;position:relative;overflow:hidden;background:color-mix(in srgb,var(--pc-primary) 6%,var(--pc-bg));border-radius:var(--pc-radius)}.pc-product-image img{width:100%;height:100%;object-fit:cover;transition:.35s transform}.pc-product-card:hover .pc-product-image img{transform:scale(1.025)}.pc-product-image>div{height:100%;display:grid;place-items:center;opacity:.25}.pc-product-image>span{position:absolute;left:10px;top:10px;background:var(--pc-accent);color:white;border-radius:999px;padding:6px 8px;font-size:8px;font-weight:950}.pc-product-copy{padding:13px 3px}.pc-product-copy small{font-size:9px;font-weight:850;text-transform:uppercase;letter-spacing:.09em;opacity:.43}.pc-product-copy h3{font-size:15px;line-height:1.25;margin:6px 0 9px}.pc-product-copy strong{font-size:17px}.pc-product-copy p{font-size:10px;margin:7px 0 0;opacity:.45}.pc-listing-row{display:grid;grid-template-columns:110px minmax(0,1fr) auto 22px;gap:20px;align-items:center;padding:13px;border-bottom:1px solid rgba(0,0,0,.1);text-decoration:none;background:white}.pc-listing-thumb{width:110px;height:82px;border-radius:12px;background:#eee;overflow:hidden;display:grid;place-items:center}.pc-listing-thumb img{width:100%;height:100%;object-fit:cover}.pc-listing-main small{font-size:9px;text-transform:uppercase;font-weight:850;opacity:.45}.pc-listing-main h3{margin:3px 0;font-size:16px}.pc-listing-main span{font-size:10px;opacity:.5}.pc-listing-row>strong{font-size:17px}.pc-listing-row>svg{width:18px}.pc-gazeta-row{font-family:Georgia,serif;display:grid;grid-template-columns:55px minmax(0,1fr) auto 28px;gap:20px;align-items:center;padding:20px 0;border-top:1px solid #111;text-decoration:none}.pc-gazeta-number{font:700 11px/1 monospace}.pc-gazeta-row small{font:700 9px/1 monospace;text-transform:uppercase;letter-spacing:.1em}.pc-gazeta-row h3{font-size:22px;font-weight:400;margin:4px 0}.pc-gazeta-row strong{font-size:17px}.pc-gazeta-row svg{width:18px}.pc-theme-gazeta .pc-section{font-family:Georgia,serif;border-color:#111}.pc-theme-gazeta .pc-section-heading h2{font-weight:400}.pc-theme-gazeta .pc-section-kicker{font-family:monospace;color:#111}.pc-pregao-row{display:grid;grid-template-columns:45px minmax(0,1fr) 150px 120px 65px;gap:12px;padding:14px 12px;border-top:1px solid #34d39933;color:#d1fae5;text-decoration:none;font:11px/1.3 'Courier New',monospace}.pc-pregao-row>b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pc-pregao-row strong,.pc-up{color:#34d399}.pc-theme-pregao{--pc-bg:#070b0a;--pc-text:#d1fae5;--pc-accent:#34d399;--pc-primary:#052e16}.pc-theme-pregao .pc-header{background:#070b0af2;border-color:#34d39933}.pc-theme-pregao .pc-header nav a,.pc-theme-pregao .pc-brand{color:#d1fae5}.pc-theme-pregao .pc-section{border-color:#34d39933}.pc-theme-pregao .pc-section-heading h2{font-family:'Courier New',monospace;text-transform:uppercase}.pc-theme-pregao .pc-section-kicker{color:#34d399}.pc-loading{min-height:190px;display:grid;place-items:center}.pc-loading svg{animation:pc-spin 1s linear infinite}.pc-about>p:last-child{font-size:clamp(20px,2.5vw,34px);line-height:1.5;max-width:960px;opacity:.7}.pc-about h2,.pc-section>h2{font-size:clamp(38px,5vw,70px);letter-spacing:-.05em;line-height:1;margin:0 0 30px}.pc-contact-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}.pc-contact-grid a{min-height:130px;border:1px solid rgba(0,0,0,.11);border-radius:var(--pc-radius);padding:20px;display:grid;grid-template-columns:1fr auto;align-content:end;text-decoration:none}.pc-contact-grid small{grid-column:1/-1;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;opacity:.45}.pc-contact-grid strong{margin-top:8px;font-size:15px;word-break:break-word}.pc-contact-grid svg{width:18px}.pc-jobs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.pc-jobs a{min-height:170px;border:1px solid rgba(0,0,0,.11);border-radius:var(--pc-radius);padding:20px;text-decoration:none;display:flex;flex-direction:column;align-items:flex-start}.pc-jobs small{font-size:9px;font-weight:900;text-transform:uppercase;opacity:.45}.pc-jobs h3{font-size:18px;margin:8px 0}.pc-jobs span{font-size:11px;opacity:.5}.pc-jobs svg{margin-top:auto;width:18px}.pc-socials{display:flex;gap:10px;flex-wrap:wrap}.pc-socials a{min-width:180px;border:1px solid rgba(0,0,0,.1);border-radius:999px;padding:14px 18px;display:flex;justify-content:space-between;gap:20px;text-decoration:none;font-size:12px;font-weight:850}.pc-socials svg{width:16px}.pc-legal details{border-top:1px solid rgba(0,0,0,.1);padding:17px 0}.pc-legal summary{font-weight:850;cursor:pointer}.pc-legal p{max-width:850px;white-space:pre-wrap;opacity:.65}.pc-company-footer{max-width:1480px;margin:auto;border-top:1px solid rgba(0,0,0,.1);padding:35px 28px 50px;display:flex;justify-content:space-between;align-items:center;gap:30px;font-size:11px}.pc-company-footer>span{opacity:.48}.pc-theme-loja{--pc-radius:26px}.pc-theme-loja .pc-section-catalog{max-width:none;background:color-mix(in srgb,var(--pc-primary) 4%,var(--pc-bg));padding-left:max(28px,calc((100% - 1480px)/2));padding-right:max(28px,calc((100% - 1480px)/2))}.pc-theme-loja .pc-product-image{aspect-ratio:.82}.pc-theme-vitrine .pc-hero-store{min-height:560px;background:linear-gradient(120deg,#fff 0 50%,color-mix(in srgb,var(--pc-primary) 11%,white) 50%);color:var(--pc-text)}.pc-theme-vitrine .pc-store-actions>a{background:var(--pc-primary);color:white}.pc-theme-vitrine .pc-store-art{transform:none}.pc-theme-mosaico .pc-products-masonry{gap:10px}.pc-theme-radar .pc-product-image{border-radius:14px}.pc-theme-radar .pc-section-catalog{background:#f0fdfa}.pc-theme-catalogo .pc-section{border-color:#1c191733}.pc-theme-catalogo .pc-products-grid{gap:28px 14px}.pc-theme-catalogo .pc-product-image{border-radius:0}.pc-theme-catalogo .pc-product-copy h3{font-family:Georgia,serif;font-size:18px;font-weight:400}.pc-theme-catalogo .pc-section-heading h2{font-family:Georgia,serif;font-weight:400}.pc-theme-mercado .pc-product-card{background:white;border-radius:18px;padding:9px;box-shadow:0 8px 25px rgba(124,45,18,.08)}.pc-theme-mercado .pc-product-image{border-radius:13px}.pc-theme-marketplace .pc-section-catalog{max-width:none;padding-left:max(28px,calc((100% - 1480px)/2));padding-right:max(28px,calc((100% - 1480px)/2))}.pc-theme-marketplace .pc-product-card{background:white;border-radius:10px;padding:8px;box-shadow:0 1px 4px rgba(0,0,0,.12)}.pc-theme-marketplace .pc-product-image{border-radius:6px}.pc-theme-marketplace .pc-section-categories{background:#fff;border-radius:10px;margin-top:24px}.pc-theme-classificados-pro .pc-section-catalog{max-width:1320px}.pc-theme-gazeta .pc-company-footer,.pc-theme-gazeta .pc-header{font-family:Georgia,serif}.pc-theme-gazeta .pc-header{border-bottom:2px solid #111}.pc-theme-pregao .pc-company-footer{border-color:#34d39933}.pc-theme-pregao .pc-contact-grid a,.pc-theme-pregao .pc-jobs a,.pc-theme-pregao .pc-socials a{border-radius:0;border-color:#34d39933}.pc-theme-pregao .pc-brand img,.pc-theme-pregao .pc-brand>span{border-radius:0}.pc-banner-compact{min-height:500px}.pc-banner-split{min-height:600px}.pc-banner-editorial .pc-store-copy h1{font-family:Georgia,serif;font-weight:400}
@keyframes pc-spin{to{transform:rotate(360deg)}}
@media(max-width:1000px){.pc-products-grid,.pc-products-masonry{--pc-columns:3!important}.pc-header nav{display:none}.pc-hero-store,.pc-hero-discovery,.pc-catalogo-grid,.pc-hero-mosaico,.pc-pregao-grid{grid-template-columns:1fr}.pc-store-art,.pc-discovery-art{max-width:650px}.pc-catalogo-image{height:480px}.pc-mosaico-art{height:520px}.pc-hero-radar{grid-template-columns:1fr}.pc-radar-pin{display:none}.pc-jobs{grid-template-columns:1fr 1fr}.pc-section-heading{grid-template-columns:1fr}.pc-section-heading .pc-section-kicker{margin-bottom:0}}
@media(max-width:680px){.pc-promo-strip span:nth-child(2){display:none}.pc-header-inner{padding:10px 16px}.pc-header-search{display:none}.pc-brand strong{max-width:160px;overflow:hidden;text-overflow:ellipsis}.pc-hero-store,.pc-hero-discovery,.pc-hero-radar{padding:48px 18px;min-height:auto}.pc-store-copy h1,.pc-discovery-copy h1,.pc-radar-copy h1{font-size:clamp(50px,16vw,80px)}.pc-store-art{grid-template-rows:200px 140px}.pc-discovery-art{min-height:310px}.pc-mini-collage,.pc-discovery-art>img{height:310px}.pc-catalogo-grid{gap:32px}.pc-hero-catalogo{padding:28px 18px 50px}.pc-catalogo-grid h1{font-size:58px}.pc-catalogo-image{height:380px}.pc-hero-gazeta{padding:20px 18px 40px}.pc-hero-gazeta h1{font-size:62px}.pc-gazeta-bottom{grid-template-columns:1fr}.pc-hero-mosaico{padding:12px;grid-template-columns:1fr}.pc-mosaico-title{padding:45px 24px;min-height:400px}.pc-mosaico-art{height:390px}.pc-pregao-grid{padding:45px 18px}.pc-pregao-stats{display:grid;grid-template-columns:repeat(3,1fr)}.pc-pregao-stats>div{padding:12px;display:block;border-right:1px solid #34d39933}.pc-pregao-stats b{display:block;font-size:24px;margin-top:8px}.pc-section{padding:55px 18px}.pc-section-heading h2,.pc-about h2,.pc-section>h2{font-size:42px}.pc-products-grid,.pc-products-masonry{--pc-columns:2!important;gap:10px}.pc-products-carousel .pc-product-card{flex-basis:70vw}.pc-product-copy h3{font-size:13px}.pc-listing-row{grid-template-columns:82px minmax(0,1fr) auto;gap:10px}.pc-listing-thumb{width:82px;height:70px}.pc-listing-row>svg{display:none}.pc-listing-row>strong{font-size:13px}.pc-gazeta-row{grid-template-columns:32px minmax(0,1fr) auto;gap:10px}.pc-gazeta-row>svg{display:none}.pc-gazeta-row h3{font-size:17px}.pc-pregao-row{grid-template-columns:32px minmax(0,1fr) 85px}.pc-pregao-row>span:nth-child(3),.pc-pregao-row>.pc-up{display:none}.pc-categories-image-tiles,.pc-categories-tiles{grid-template-columns:1fr 1fr}.pc-categories-image-tiles a{min-height:170px}.pc-jobs{grid-template-columns:1fr}.pc-company-footer{padding:30px 18px 45px;align-items:flex-start;flex-direction:column}}
`;
