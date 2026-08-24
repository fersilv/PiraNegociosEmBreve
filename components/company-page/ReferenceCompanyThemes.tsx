import React from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ExternalLink,
  Globe2,
  Instagram,
  Linkedin,
  Facebook,
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

export type CompanyThemeCategory = 'institutional' | 'classifieds' | 'restaurants' | 'fashion' | 'services' | 'other';
export type ExtraCompanyThemeKey =
  | 'mercado' | 'gazeta' | 'mosaico' | 'radar' | 'pregao'
  | 'bistro' | 'brasa' | 'jardim' | 'diner' | 'degustacao'
  | 'runway' | 'street' | 'boutique' | 'lookbook' | 'atelier'
  | 'pro' | 'oficio' | 'care' | 'studio' | 'local'
  | 'festival' | 'terra' | 'cosmos' | 'heritage' | 'mono';

export interface CompanyThemeCatalogItem {
  key: string;
  category: CompanyThemeCategory;
  name: string;
  eyebrow: string;
  description: string;
  bestFor: string;
}

export interface ExtendedThemePreset {
  width: CompanyPageWidth;
  theme: { primary: string; accent: string; background: string; text: string };
  branding: { typography: CompanyTypography; logoSize: 'small' | 'medium' | 'large'; corners: 'square' | 'soft' | 'round' };
  hero: { layout: 'split' | 'centered' | 'cover' | 'minimal' };
  jobs: { layout: 'list' | 'grid' | 'compact' };
  navigation: { sticky: boolean; transparent: boolean };
}

export const COMPANY_THEME_CATEGORIES: Array<{ id: CompanyThemeCategory; label: string; description: string }> = [
  { id: 'institutional', label: 'Institucional', description: 'Empresas, tecnologia e presença corporativa.' },
  { id: 'classifieds', label: 'Classificados', description: 'Marketplace, descoberta, vitrines e listagens.' },
  { id: 'restaurants', label: 'Restaurantes', description: 'Gastronomia, delivery, bares, cafés e experiência de marca.' },
  { id: 'fashion', label: 'Vestuário', description: 'Moda, campanhas, coleções, boutiques e streetwear.' },
  { id: 'services', label: 'Serviços', description: 'Profissionais, clínicas, oficinas, estúdios e negócios locais.' },
  { id: 'other', label: 'Outros', description: 'Experiências imersivas, culturais, naturais e experimentais.' },
];

export const EXTRA_COMPANY_PAGE_TEMPLATES: CompanyThemeCatalogItem[] = [
  { key: 'mercado', category: 'classifieds', name: 'Mercado', eyebrow: 'Marketplace', description: 'Busca central, trilhos de descoberta e vitrines em linguagem de app.', bestFor: 'Classificados gerais, lojas e catálogos locais' },
  { key: 'gazeta', category: 'classifieds', name: 'Gazeta', eyebrow: 'Index', description: 'Tipografia editorial, índices densos e leitura de classificados sem cards genéricos.', bestFor: 'Imóveis, veículos, empregos e anúncios tradicionais' },
  { key: 'mosaico', category: 'classifieds', name: 'Mosaico', eyebrow: 'Discovery wall', description: 'Descoberta visual em painéis de tamanhos diferentes e ritmo de galeria.', bestFor: 'Achadinhos, produtos criativos, brechós e multimarcas' },
  { key: 'radar', category: 'classifieds', name: 'Radar', eyebrow: 'Local discovery', description: 'Mapa abstrato, proximidade, busca e resultados em interface local.', bestFor: 'Classificados regionais e negócios de bairro' },
  { key: 'pregao', category: 'classifieds', name: 'Pregão', eyebrow: 'Trading interface', description: 'Painel escuro, dados e oportunidades em uma interface de mercado.', bestFor: 'Veículos, equipamentos e ofertas premium' },

  { key: 'bistro', category: 'restaurants', name: 'Bistrô', eyebrow: 'Storefront', description: 'Página de restaurante com leitura de vitrine, categorias e ação rápida.', bestFor: 'Restaurantes, cafés, padarias e delivery' },
  { key: 'brasa', category: 'restaurants', name: 'Brasa', eyebrow: 'Cinematic', description: 'Imagem de tela inteira, pouco texto e atmosfera dramática.', bestFor: 'Churrasco, hamburguerias, bares e casas noturnas' },
  { key: 'jardim', category: 'restaurants', name: 'Jardim', eyebrow: 'Quiet editorial', description: 'Fotografia grande, tipografia delicada e pausas generosas.', bestFor: 'Natural, brunch, cafés e gastronomia autoral' },
  { key: 'diner', category: 'restaurants', name: 'Diner', eyebrow: 'Food app', description: 'Descoberta por faixas, chips e módulos coloridos em linguagem de delivery.', bestFor: 'Lanches, pizzarias, sorveterias e redes' },
  { key: 'degustacao', category: 'restaurants', name: 'Degustação', eyebrow: 'Fine dining', description: 'Direção de arte silenciosa, quase cinematográfica, para marcas premium.', bestFor: 'Alta gastronomia, wine bars e hotelaria' },

  { key: 'runway', category: 'fashion', name: 'Runway', eyebrow: 'Campaign', description: 'Campanha full-screen, imagem dominante e tipografia que ocupa a tela.', bestFor: 'Moda autoral, luxo e coleções sazonais' },
  { key: 'street', category: 'fashion', name: 'Street', eyebrow: 'Interactive', description: 'Recortes, movimento sugerido e composição propositalmente imprevisível.', bestFor: 'Streetwear, sneakers, skate e cultura urbana' },
  { key: 'boutique', category: 'fashion', name: 'Boutique', eyebrow: 'Luxury editorial', description: 'Editorial de luxo com hierarquia elegante e quase nenhum ornamento.', bestFor: 'Boutiques, acessórios, joalheria e moda feminina' },
  { key: 'lookbook', category: 'fashion', name: 'Lookbook', eyebrow: 'Gallery', description: 'Coleção apresentada como galeria curada, índices e grandes enquadramentos.', bestFor: 'Confecções, designers e coleções' },
  { key: 'atelier', category: 'fashion', name: 'Atelier', eyebrow: 'Film portfolio', description: 'Narrativa minimalista de processo, imagem e detalhe.', bestFor: 'Ateliês, noivas, sob medida e artesanal' },

  { key: 'pro', category: 'services', name: 'Pro', eyebrow: 'Product landing', description: 'Serviço apresentado com clareza, impacto e seções de tela cheia.', bestFor: 'Consultorias, B2B e serviços técnicos' },
  { key: 'oficio', category: 'services', name: 'Ofício', eyebrow: 'Technical index', description: 'Informação precisa, linhas, índices e uma estética técnica sem cara de dashboard.', bestFor: 'Oficinas, manutenção e construção' },
  { key: 'care', category: 'services', name: 'Care', eyebrow: 'Calm service', description: 'Interface suave, navegação fácil e foco em confiança e contato.', bestFor: 'Saúde, estética, bem-estar e clínicas' },
  { key: 'studio', category: 'services', name: 'Studio', eyebrow: 'Immersive studio', description: 'Estúdio criativo com tipografia viva, camadas e composição experimental.', bestFor: 'Design, audiovisual, arquitetura e agências' },
  { key: 'local', category: 'services', name: 'Local', eyebrow: 'Near me', description: 'Conversão local, endereço, contato e descoberta em primeiro plano.', bestFor: 'Salões, pet shops, assistência e escolas' },

  { key: 'festival', category: 'other', name: 'Festival', eyebrow: 'Playground', description: 'Composição viva e cultural, com cartazes digitais e movimento sugerido.', bestFor: 'Eventos, música, arte e entretenimento' },
  { key: 'terra', category: 'other', name: 'Terra', eyebrow: 'Landscape', description: 'Imagem de paisagem, escala e respiro em linguagem cinematográfica.', bestFor: 'Turismo, rural, sustentabilidade e natureza' },
  { key: 'cosmos', category: 'other', name: 'Cosmos', eyebrow: 'Universe UI', description: 'Universo escuro com interface sci-fi, coordenadas e camadas técnicas.', bestFor: 'Games, inovação, tecnologia e audiovisual' },
  { key: 'heritage', category: 'other', name: 'Heritage', eyebrow: 'Archive', description: 'Arquivo cultural elegante, índices e linguagem de publicação.', bestFor: 'Instituições culturais, educação e negócios tradicionais' },
  { key: 'mono', category: 'other', name: 'Mono', eyebrow: 'Radical minimal', description: 'Preto, branco, fotografia e tipografia. Nada compete com a marca.', bestFor: 'Marcas que querem uma base neutra e premium' },
];

export const EXTRA_THEME_PRESETS: Record<ExtraCompanyThemeKey, ExtendedThemePreset> = {
  mercado: preset('wide', '#ff5a23', '#ffe28a', '#f7f7f5', '#171717', 'clean', 'round', 'grid'),
  gazeta: preset('wide', '#151515', '#9b1c1c', '#f3f0e8', '#151515', 'editorial', 'square', 'list'),
  mosaico: preset('full', '#5b34da', '#ff6b8a', '#f4f2ff', '#14131a', 'human', 'soft', 'grid'),
  radar: preset('wide', '#173f35', '#ff7849', '#eef4ef', '#18332d', 'clean', 'round', 'compact'),
  pregao: preset('full', '#d8ff3e', '#59d8ff', '#07090c', '#f5f7f9', 'technical', 'square', 'list'),
  bistro: preset('wide', '#ea1d2c', '#ffb7bd', '#f7f5f3', '#211c1c', 'clean', 'round', 'grid'),
  brasa: preset('full', '#ff5a1f', '#ffb000', '#090909', '#ffffff', 'clean', 'square', 'list'),
  jardim: preset('wide', '#4f6b50', '#c8a97e', '#eeeade', '#293129', 'editorial', 'square', 'list'),
  diner: preset('full', '#ea1d2c', '#ffd84d', '#fff7f4', '#242020', 'human', 'round', 'grid'),
  degustacao: preset('wide', '#b7a78c', '#6f5944', '#0c0c0c', '#f4efe8', 'editorial', 'square', 'list'),
  runway: preset('full', '#ffffff', '#ff334e', '#050505', '#ffffff', 'clean', 'square', 'list'),
  street: preset('full', '#111111', '#c9ff24', '#f0efe9', '#111111', 'technical', 'square', 'grid'),
  boutique: preset('wide', '#8f6b74', '#c5ad97', '#f6f1ef', '#2b2426', 'editorial', 'square', 'list'),
  lookbook: preset('full', '#222222', '#777777', '#f2f0eb', '#181818', 'editorial', 'square', 'grid'),
  atelier: preset('wide', '#6f5b4a', '#b99373', '#e9e1d7', '#2c2621', 'editorial', 'square', 'list'),
  pro: preset('full', '#ffffff', '#7cc7ff', '#050505', '#ffffff', 'clean', 'square', 'list'),
  oficio: preset('wide', '#ef5b2a', '#202c34', '#e8e7e2', '#17191a', 'technical', 'square', 'list'),
  care: preset('wide', '#13786e', '#f0b7c0', '#f4faf8', '#20312e', 'human', 'round', 'grid'),
  studio: preset('full', '#c7ff3d', '#8f5cff', '#0b0b0b', '#ffffff', 'clean', 'square', 'grid'),
  local: preset('wide', '#cc5843', '#2f806f', '#fff8ef', '#332722', 'human', 'round', 'compact'),
  festival: preset('full', '#ff3c78', '#dfff35', '#111111', '#ffffff', 'human', 'square', 'grid'),
  terra: preset('full', '#f0eadf', '#8e6f4d', '#0b0b0a', '#f5f0e8', 'editorial', 'square', 'list'),
  cosmos: preset('full', '#62d9ff', '#a87cff', '#03050a', '#eaf8ff', 'technical', 'square', 'compact'),
  heritage: preset('wide', '#6f1f1a', '#a78763', '#ece5d5', '#262018', 'editorial', 'square', 'list'),
  mono: preset('full', '#ffffff', '#aaaaaa', '#000000', '#ffffff', 'clean', 'square', 'list'),
};

function preset(width: CompanyPageWidth, primary: string, accent: string, background: string, text: string, typography: CompanyTypography, corners: 'square' | 'soft' | 'round', jobsLayout: 'list' | 'grid' | 'compact'): ExtendedThemePreset {
  return {
    width,
    theme: { primary, accent, background, text },
    branding: { typography, logoSize: 'large', corners },
    hero: { layout: width === 'full' ? 'cover' : 'split' },
    jobs: { layout: jobsLayout },
    navigation: { sticky: true, transparent: width === 'full' },
  };
}

export function isExtraCompanyTheme(value?: string): value is ExtraCompanyThemeKey {
  return Boolean(value && value in EXTRA_THEME_PRESETS);
}

export function applyExtraCompanyThemePreset(config: CompanyPageConfig, key: ExtraCompanyThemeKey): CompanyPageConfig {
  const p = EXTRA_THEME_PRESETS[key];
  return {
    ...config,
    templateKey: key,
    width: p.width,
    theme: { ...config.theme, ...p.theme },
    branding: { ...config.branding, ...p.branding },
    hero: { ...config.hero, ...p.hero },
    jobs: { ...config.jobs, ...p.jobs },
    navigation: { ...config.navigation, ...p.navigation },
  };
}

type ThemeProps = { company: PublicCompanyLike; jobs: PublicJobLike[]; config: CompanyPageConfig; preview?: boolean };
type Visual = { primary: string; accent: string; background: string; text: string };

export function ExtraCompanyThemeRenderer({ themeKey, company, jobs, config, preview = false }: ThemeProps & { themeKey: ExtraCompanyThemeKey }) {
  const visual = resolveVisual(config, EXTRA_THEME_PRESETS[themeKey]);
  if (themeKey === 'mercado') return <MarketplaceTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} />;
  if (themeKey === 'gazeta') return <IndexTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} variant="classified" />;
  if (themeKey === 'mosaico') return <GalleryTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} variant="classified" />;
  if (themeKey === 'radar') return <LocalTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} variant="classified" />;
  if (themeKey === 'pregao') return <InterfaceTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} variant="trading" />;

  if (themeKey === 'bistro') return <StorefrontTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} />;
  if (themeKey === 'brasa') return <CinematicTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} variant="food" />;
  if (themeKey === 'jardim') return <QuietEditorialTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} variant="food" />;
  if (themeKey === 'diner') return <MarketplaceTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} restaurant />;
  if (themeKey === 'degustacao') return <FilmTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} variant="food" />;

  if (themeKey === 'runway') return <CinematicTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} variant="fashion" />;
  if (themeKey === 'street') return <PlaygroundTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} variant="fashion" />;
  if (themeKey === 'boutique') return <QuietEditorialTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} variant="fashion" />;
  if (themeKey === 'lookbook') return <GalleryTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} variant="fashion" />;
  if (themeKey === 'atelier') return <FilmTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} variant="fashion" />;

  if (themeKey === 'pro') return <CinematicTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} variant="service" />;
  if (themeKey === 'oficio') return <IndexTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} variant="service" />;
  if (themeKey === 'care') return <StorefrontTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} calm />;
  if (themeKey === 'studio') return <ImmersiveTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} />;
  if (themeKey === 'local') return <LocalTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} variant="service" />;

  if (themeKey === 'festival') return <PlaygroundTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} variant="culture" />;
  if (themeKey === 'terra') return <CinematicTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} variant="nature" />;
  if (themeKey === 'cosmos') return <InterfaceTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} variant="space" />;
  if (themeKey === 'heritage') return <ArchiveTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} />;
  return <MonoTheme company={company} jobs={jobs} config={config} preview={preview} visual={visual} />;
}

function resolveVisual(config: CompanyPageConfig, presetValue: ExtendedThemePreset): Visual {
  return {
    primary: config.theme?.primary || presetValue.theme.primary,
    accent: config.theme?.accent || presetValue.theme.accent,
    background: config.theme?.background || presetValue.theme.background,
    text: config.theme?.text || presetValue.theme.text,
  };
}

function MarketplaceTheme({ company, jobs, config, preview, visual, restaurant = false }: ThemeProps & { visual: Visual; restaurant?: boolean }) {
  const cover = coverUrl(config);
  const chips = restaurant ? ['Sobre', 'Localização', 'Contato', 'Equipe'] : ['Destaques', 'Sobre', 'Contato', 'Oportunidades'];
  return <Page visual={visual} typography="clean">
    <div className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur-xl">
      <Shell><div className="flex h-16 items-center gap-3"><Logo company={company} round /><b>{company.name}</b><Seal company={company} /><div className="ml-auto hidden w-[34%] items-center rounded-full bg-black/5 px-4 py-2 text-sm text-black/40 md:flex"><Search className="mr-2 h-4 w-4" />Buscar nesta página</div><a href="#contato" className="rounded-full px-4 py-2 text-xs font-black text-white" style={{ background: visual.primary }}>Contato</a></div></Shell>
    </div>
    <Shell>
      <div className="flex gap-3 overflow-x-auto py-5">{chips.map((chip) => <span key={chip} className="whitespace-nowrap rounded-full bg-white px-5 py-2 text-xs font-bold shadow-sm">{chip}</span>)}</div>
      <section className="relative grid min-h-[470px] overflow-hidden rounded-[34px] p-8 md:grid-cols-[1.1fr_.9fr] md:p-12" style={{ background: restaurant ? '#fff0f1' : `${visual.primary}12` }}>
        <div className="relative z-10 flex flex-col justify-center"><Eyebrow>{restaurant ? 'Sua experiência começa aqui' : 'Descubra a empresa'}</Eyebrow><h1 className="mt-5 text-5xl font-black leading-[.9] tracking-[-.06em] sm:text-7xl">{heroTitle(company, config)}</h1><p className="mt-6 max-w-xl text-lg leading-8 opacity-60">{heroText(company, config)}</p><div className="mt-8 flex flex-wrap gap-2"><Pill>{location(company) || 'Brasil'}</Pill><Pill>{jobs.length} oportunidades</Pill></div></div>
        <div className="relative mt-8 min-h-[260px] overflow-hidden rounded-[28px] md:mt-0">{cover ? <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <BrandPoster company={company} visual={visual} />}</div>
      </section>
      <About company={company} config={config} className="grid gap-8 py-16 md:grid-cols-[220px_1fr]" />
      <Jobs jobs={jobs} config={config} style="cards" />
      <Contact company={company} config={config} />
      <Footer company={company} config={config} preview={preview} />
    </Shell>
  </Page>;
}

function IndexTheme({ company, jobs, config, preview, visual, variant }: ThemeProps & { visual: Visual; variant: 'classified' | 'service' }) {
  return <Page visual={visual} typography={variant === 'classified' ? 'editorial' : 'technical'}>
    <Shell>
      <header className="border-b-2 border-current py-8"><div className="flex items-start justify-between gap-5"><div><Logo company={company} square /><div className="mt-3 flex items-center gap-2"><b className="text-xs uppercase tracking-[.18em]">{company.name}</b><Seal company={company} /></div></div><div className="text-right text-[10px] uppercase tracking-[.2em] opacity-45"><div>{variant === 'classified' ? 'Índice empresarial' : 'Ficha técnica'}</div><div className="mt-2">{location(company)}</div></div></div></header>
      <div className="grid min-h-[620px] border-b border-current/25 py-12 lg:grid-cols-[180px_1fr_280px] lg:gap-10"><div className="text-xs uppercase tracking-[.18em] opacity-40">001<br/>Apresentação</div><div><h1 className="max-w-5xl text-6xl leading-[.88] tracking-[-.065em] sm:text-8xl">{heroTitle(company, config)}</h1><p className="mt-8 max-w-2xl text-lg leading-8 opacity-65">{heroText(company, config)}</p></div><div className="border-l border-current/20 pl-6 text-sm"><Row label="Local" value={location(company) || 'Não informado'} /><Row label="Vagas" value={String(jobs.length)} /><Row label="Contato" value={config.contacts?.phone || company.phone || 'Disponível abaixo'} /></div></div>
      <About company={company} config={config} className="grid gap-10 border-b border-current/25 py-16 md:grid-cols-[180px_1fr]" />
      <Jobs jobs={jobs} config={config} style="index" />
      <Contact company={company} config={config} />
      <Footer company={company} config={config} preview={preview} />
    </Shell>
  </Page>;
}

function GalleryTheme({ company, jobs, config, preview, visual, variant }: ThemeProps & { visual: Visual; variant: 'classified' | 'fashion' }) {
  const cover = coverUrl(config);
  return <Page visual={visual} typography={variant === 'fashion' ? 'editorial' : 'clean'}>
    <div className="px-4 pt-4 sm:px-6"><div className="flex items-center gap-3 border-b border-current/15 pb-4"><Logo company={company} square /><span className="font-bold">{company.name}</span><Seal company={company} /><span className="ml-auto text-[10px] uppercase tracking-[.2em] opacity-40">{variant === 'fashion' ? 'Collection / 01' : 'Curated discovery'}</span></div></div>
    <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-12">
      <section className="min-h-[610px] overflow-hidden bg-black/5 lg:col-span-7">{cover ? <img src={cover} alt="" className="h-full min-h-[610px] w-full object-cover" /> : <BrandPoster company={company} visual={visual} />}</section>
      <section className="flex min-h-[610px] flex-col justify-between p-8 lg:col-span-5" style={{ background: visual.primary, color: contrastText(visual.primary) }}><Eyebrow light>{variant === 'fashion' ? 'New perspective' : 'Em destaque'}</Eyebrow><div><h1 className="text-6xl leading-[.82] tracking-[-.07em] sm:text-8xl">{heroTitle(company, config)}</h1><p className="mt-7 max-w-lg text-lg leading-8 opacity-65">{heroText(company, config)}</p></div><span className="text-xs uppercase tracking-[.2em] opacity-45">Explore ↓</span></section>
      <div className="min-h-[220px] border border-current/15 p-6 lg:col-span-4"><Eyebrow>Local</Eyebrow><p className="mt-10 text-3xl">{location(company) || 'Brasil'}</p></div>
      <div className="min-h-[220px] p-6 lg:col-span-8" style={{ background: visual.accent, color: contrastText(visual.accent) }}><Eyebrow light>Agora</Eyebrow><p className="mt-8 text-7xl font-black">{String(jobs.length).padStart(2, '0')}</p><p className="mt-2 opacity-55">oportunidades abertas</p></div>
    </div>
    <Shell><About company={company} config={config} className="py-16" /><Jobs jobs={jobs} config={config} style={variant === 'fashion' ? 'index' : 'cards'} /><Contact company={company} config={config} /><Footer company={company} config={config} preview={preview} /></Shell>
  </Page>;
}

function LocalTheme({ company, jobs, config, preview, visual, variant }: ThemeProps & { visual: Visual; variant: 'classified' | 'service' }) {
  const cover = coverUrl(config);
  return <Page visual={visual} typography="clean">
    <Shell>
      <nav className="flex h-20 items-center"><Logo company={company} round /><div className="ml-3"><b>{company.name}</b><div className="text-xs opacity-45">{location(company)}</div></div><Seal company={company} /><a href="#contato" className="ml-auto rounded-full px-4 py-2 text-xs font-black text-white" style={{ background: visual.primary }}>Chamar</a></nav>
      <section className="grid min-h-[620px] overflow-hidden rounded-[36px] border border-current/10 lg:grid-cols-[.78fr_1.22fr]"><div className="p-8 sm:p-12"><div className="flex items-center rounded-full border border-current/10 bg-white/70 px-4 py-3 text-sm opacity-55"><Search className="mr-2 h-4 w-4" />{variant === 'classified' ? 'Descobrir perto de você' : 'Encontre e fale com a empresa'}</div><h1 className="mt-12 text-5xl font-black leading-[.9] tracking-[-.06em] sm:text-7xl">{heroTitle(company, config)}</h1><p className="mt-6 text-lg leading-8 opacity-60">{heroText(company, config)}</p></div><div className="relative min-h-[420px]" style={{ background: `radial-gradient(circle at 62% 42%,${visual.accent} 0 3%,transparent 3.5%),repeating-linear-gradient(0deg,transparent 0 47px,rgba(0,0,0,.06) 48px),repeating-linear-gradient(90deg,transparent 0 47px,rgba(0,0,0,.06) 48px),${visual.primary}16` }}>{cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-multiply" />}<div className="absolute left-[58%] top-[37%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-3 shadow-2xl"><Logo company={company} round /></div><div className="absolute bottom-6 right-6 rounded-2xl bg-white px-5 py-4 shadow-xl"><div className="text-[10px] uppercase tracking-[.18em] opacity-40">Oportunidades</div><div className="mt-1 text-2xl font-black text-black">{jobs.length}</div></div></div></section>
      <About company={company} config={config} className="py-16" /><Jobs jobs={jobs} config={config} style="index" /><Contact company={company} config={config} /><Footer company={company} config={config} preview={preview} />
    </Shell>
  </Page>;
}

function InterfaceTheme({ company, jobs, config, preview, visual, variant }: ThemeProps & { visual: Visual; variant: 'trading' | 'space' }) {
  const cover = coverUrl(config);
  return <Page visual={visual} typography="technical">
    <div className="min-h-screen bg-[radial-gradient(circle_at_70%_20%,rgba(92,126,255,.18),transparent_25%),linear-gradient(180deg,rgba(255,255,255,.02),transparent)]">
      <Shell>
        <nav className="flex h-16 items-center border-b border-white/10"><Logo company={company} square /><span className="ml-3 text-xs font-bold uppercase tracking-[.2em]">{company.name}</span><Seal company={company} inverted /><span className="ml-auto text-[10px] uppercase tracking-[.2em] opacity-35">{variant === 'space' ? 'SYSTEM / ONLINE' : 'MARKET / LIVE'}</span></nav>
        <section className="grid min-h-[680px] items-end gap-10 py-14 lg:grid-cols-[1.15fr_.85fr]"><div><div className="text-[10px] uppercase tracking-[.25em] opacity-40">0001 / {variant === 'space' ? 'UNIVERSE' : 'OPPORTUNITY BOARD'}</div><h1 className="mt-6 text-6xl font-black uppercase leading-[.82] tracking-[-.07em] sm:text-8xl">{heroTitle(company, config)}</h1><p className="mt-8 max-w-2xl text-lg leading-8 opacity-50">{heroText(company, config)}</p><div className="mt-10 flex gap-8 text-xs"><div><span className="opacity-35">OPEN JOBS</span><b className="mt-2 block text-xl">{String(jobs.length).padStart(2, '0')}</b></div><div><span className="opacity-35">LOCATION</span><b className="mt-2 block text-xl">{location(company) || 'BR'}</b></div></div></div><div className="border border-white/10 bg-white/[.03] p-4"><div className="relative aspect-[4/3] overflow-hidden bg-black/20">{cover ? <img src={cover} alt="" className="h-full w-full object-cover opacity-65" /> : <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 50%,${visual.primary}55,transparent 8%),radial-gradient(circle at 50% 50%,transparent 0 26%,${visual.accent}22 27%,transparent 28%)` }} />}</div><div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-[10px] uppercase tracking-[.18em] opacity-40"><span>STATUS<br/><b className="text-white">VERIFIED DATA</b></span><span>NETWORK<br/><b className="text-white">PIRANEGÓCIOS</b></span></div></div></section>
        <Jobs jobs={jobs} config={config} style="terminal" /><About company={company} config={config} className="border-t border-white/10 py-16" /><Contact company={company} config={config} dark /><Footer company={company} config={config} preview={preview} dark />
      </Shell>
    </div>
  </Page>;
}

function StorefrontTheme({ company, jobs, config, preview, visual, calm = false }: ThemeProps & { visual: Visual; calm?: boolean }) {
  const cover = coverUrl(config);
  return <Page visual={visual} typography={calm ? 'human' : 'clean'}>
    <Shell>
      <nav className="flex h-20 items-center"><Logo company={company} round /><div className="ml-3"><b>{company.name}</b><div className="text-xs opacity-45">{location(company)}</div></div><Seal company={company} /><a href="#contato" className="ml-auto rounded-full px-5 py-2.5 text-xs font-black text-white" style={{ background: visual.primary }}>Contato</a></nav>
      <section className={`overflow-hidden rounded-[34px] ${calm ? 'bg-white' : ''}`} style={!calm ? { background: `${visual.primary}12` } : undefined}><div className="grid lg:grid-cols-[1fr_1.08fr]"><div className="flex min-h-[510px] flex-col justify-center p-8 sm:p-12"><Eyebrow>{calm ? 'Cuidado e confiança' : 'Conheça a casa'}</Eyebrow><h1 className="mt-5 text-6xl font-black leading-[.9] tracking-[-.06em] sm:text-8xl">{heroTitle(company, config)}</h1><p className="mt-7 max-w-xl text-lg leading-8 opacity-60">{heroText(company, config)}</p><div className="mt-8 flex flex-wrap gap-2"><Pill>Sobre</Pill><Pill>Contato</Pill><Pill>Equipe</Pill></div></div><div className="min-h-[420px] bg-black/5">{cover ? <img src={cover} alt="" className="h-full min-h-[420px] w-full object-cover" /> : <BrandPoster company={company} visual={visual} />}</div></div></section>
      <section className="grid gap-4 py-6 sm:grid-cols-3"><Feature label="Local" value={location(company) || 'Não informado'} /><Feature label="Oportunidades" value={String(jobs.length)} /><Feature label="Contato" value={config.contacts?.phone || company.phone || 'Veja abaixo'} /></section>
      <About company={company} config={config} className="py-16" /><Jobs jobs={jobs} config={config} style="cards" /><Contact company={company} config={config} /><Footer company={company} config={config} preview={preview} />
    </Shell>
  </Page>;
}

function CinematicTheme({ company, jobs, config, preview, visual, variant }: ThemeProps & { visual: Visual; variant: 'food' | 'fashion' | 'service' | 'nature' }) {
  const cover = coverUrl(config);
  const eyebrow = variant === 'food' ? 'Taste / place / people' : variant === 'fashion' ? 'Collection / campaign' : variant === 'service' ? 'Built to perform' : 'Land / scale / experience';
  return <Page visual={visual} typography={variant === 'nature' ? 'editorial' : 'clean'}>
    <header className="relative min-h-[92vh] overflow-hidden bg-black text-white">{cover ? <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75" /> : <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 65% 25%,${visual.accent}55,transparent 30%),linear-gradient(135deg,${visual.primary}44,#050505 55%)` }} />}<div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/25" /><div className="relative z-10 mx-auto flex min-h-[92vh] max-w-[1500px] flex-col px-6 sm:px-10"><nav className="flex h-20 items-center"><Logo company={company} /><b className="ml-3 text-sm uppercase tracking-[.16em]">{company.name}</b><Seal company={company} inverted /><a href="#vagas" className="ml-auto text-xs uppercase tracking-[.18em]">Oportunidades</a></nav><div className="mt-auto pb-14"><Eyebrow light>{eyebrow}</Eyebrow><h1 className="mt-5 max-w-[1250px] text-[15vw] font-black uppercase leading-[.68] tracking-[-.075em] sm:text-[10vw]">{heroTitle(company, config)}</h1><p className="mt-8 max-w-2xl text-lg leading-8 text-white/60">{heroText(company, config)}</p></div></div></header>
    <Shell><About company={company} config={config} className="grid gap-10 py-20 md:grid-cols-[220px_1fr]" /><Jobs jobs={jobs} config={config} style="index" /><Contact company={company} config={config} /><Footer company={company} config={config} preview={preview} /></Shell>
  </Page>;
}

function QuietEditorialTheme({ company, jobs, config, preview, visual, variant }: ThemeProps & { visual: Visual; variant: 'food' | 'fashion' }) {
  const cover = coverUrl(config);
  return <Page visual={visual} typography="editorial">
    <Shell>
      <nav className="flex h-24 items-center border-b border-current/15"><div className="font-serif text-xl italic">{company.name}</div><Seal company={company} /><div className="ml-auto text-[10px] uppercase tracking-[.2em] opacity-40">{variant === 'food' ? 'Table / story' : 'Maison / story'}</div></nav>
      <section className="grid min-h-[720px] gap-12 py-16 lg:grid-cols-[.75fr_1.25fr]"><div className="flex flex-col justify-between"><div><Eyebrow>{variant === 'food' ? 'A quiet experience' : 'A considered collection'}</Eyebrow><h1 className="mt-8 font-serif text-6xl leading-[.98] sm:text-8xl">{heroTitle(company, config)}</h1></div><p className="max-w-lg text-lg leading-8 opacity-60">{heroText(company, config)}</p></div><div className="min-h-[560px] bg-black/5">{cover ? <img src={cover} alt="" className="h-full min-h-[560px] w-full object-cover" /> : <BrandPoster company={company} visual={visual} />}</div></section>
      <About company={company} config={config} className="mx-auto max-w-4xl border-y border-current/15 py-20 text-center" /><Jobs jobs={jobs} config={config} style="index" /><Contact company={company} config={config} /><Footer company={company} config={config} preview={preview} />
    </Shell>
  </Page>;
}

function FilmTheme({ company, jobs, config, preview, visual, variant }: ThemeProps & { visual: Visual; variant: 'food' | 'fashion' }) {
  const cover = coverUrl(config);
  return <Page visual={visual} typography="editorial">
    <Shell>
      <div className="grid min-h-screen lg:grid-cols-[110px_1fr]"><aside className="hidden border-r border-current/15 py-8 lg:flex lg:flex-col lg:items-center"><div className="text-[10px] uppercase tracking-[.22em] [writing-mode:vertical-rl]">{company.name}</div><span className="mt-auto text-[10px] opacity-40">018</span></aside><main className="p-6 sm:p-10"><nav className="flex items-center"><Logo company={company} square /><Seal company={company} /><span className="ml-auto text-[10px] uppercase tracking-[.2em] opacity-40">{variant === 'food' ? 'Experience' : 'Work / process'}</span></nav><div className="grid min-h-[700px] items-center gap-10 py-14 lg:grid-cols-[1fr_.8fr]"><div><div className="text-sm opacity-45">#018</div><h1 className="mt-5 text-6xl leading-[.92] sm:text-8xl">{heroTitle(company, config)}</h1><p className="mt-7 max-w-xl text-lg leading-8 opacity-55">{heroText(company, config)}</p><a href="#vagas" className="mt-10 inline-flex items-center gap-3 border-b border-current pb-2 text-xs uppercase tracking-[.18em]">Explore <ArrowRight className="h-4 w-4" /></a></div><div className="aspect-[4/5] bg-black/5">{cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <BrandPoster company={company} visual={visual} />}</div></div><About company={company} config={config} className="border-t border-current/15 py-16" /><Jobs jobs={jobs} config={config} style="index" /><Contact company={company} config={config} /><Footer company={company} config={config} preview={preview} /></main></div>
    </Shell>
  </Page>;
}

function PlaygroundTheme({ company, jobs, config, preview, visual, variant }: ThemeProps & { visual: Visual; variant: 'fashion' | 'culture' }) {
  const cover = coverUrl(config);
  return <Page visual={visual} typography="human">
    <div className="overflow-hidden border-y-2 border-white/20 py-3 text-center text-sm font-black uppercase tracking-[.18em]" style={{ background: visual.accent, color: contrastText(visual.accent) }}>MOVE • CREATE • PEOPLE • CULTURE • MOVE • CREATE • PEOPLE • CULTURE</div>
    <div className="p-4 sm:p-6"><section className="relative min-h-[690px] overflow-hidden border-2 border-current"><div className="absolute -left-12 top-24 rotate-[-10deg] border-2 border-current bg-white px-8 py-4 text-xl font-black text-black">{variant === 'fashion' ? 'DROP 01' : 'LIVE NOW'}</div><div className="absolute right-6 top-6 flex items-center gap-2"><Logo company={company} square /><Seal company={company} inverted /></div><div className="grid min-h-[690px] lg:grid-cols-[1.1fr_.9fr]"><div className="flex flex-col justify-end p-7 sm:p-12"><h1 className="text-7xl font-black uppercase leading-[.72] tracking-[-.07em] sm:text-9xl">{heroTitle(company, config)}</h1><p className="mt-8 max-w-xl text-lg font-bold leading-8 opacity-60">{heroText(company, config)}</p></div><div className="min-h-[360px] border-t-2 border-current lg:border-l-2 lg:border-t-0">{cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Sparkles className="h-36 w-36 opacity-15" /></div>}</div></div></section></div>
    <Shell><Jobs jobs={jobs} config={config} style="cards" /><About company={company} config={config} className="border-y-2 border-current py-16 text-2xl font-bold" /><Contact company={company} config={config} /><Footer company={company} config={config} preview={preview} /></Shell>
  </Page>;
}

function ImmersiveTheme({ company, jobs, config, preview, visual }: ThemeProps & { visual: Visual }) {
  const cover = coverUrl(config);
  return <Page visual={visual} typography="clean">
    <header className="relative min-h-screen overflow-hidden bg-black text-white"><div className="absolute inset-0" style={{ background: `radial-gradient(circle at 20% 20%,${visual.primary}55,transparent 30%),radial-gradient(circle at 80% 70%,${visual.accent}55,transparent 30%)` }} />{cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-screen" />}<div className="absolute -left-[8vw] top-[16vh] whitespace-nowrap text-[25vw] font-black uppercase leading-none tracking-[-.09em] text-white/[.06]">UNSEEN</div><div className="relative z-10 mx-auto flex min-h-screen max-w-[1500px] flex-col px-6 sm:px-10"><nav className="flex h-20 items-center"><Logo company={company} round /><Seal company={company} inverted /><span className="ml-auto text-xs uppercase tracking-[.2em] text-white/40">Drag your attention</span></nav><div className="my-auto max-w-5xl"><Eyebrow light>Brand / digital / motion</Eyebrow><h1 className="mt-6 text-6xl font-black leading-[.82] tracking-[-.07em] sm:text-9xl">{heroTitle(company, config)}</h1><p className="mt-8 max-w-2xl text-xl leading-8 text-white/60">{heroText(company, config)}</p></div><div className="pb-8 text-xs uppercase tracking-[.2em] text-white/35">Scroll to explore ↓</div></div></header>
    <Shell><About company={company} config={config} className="py-20" /><Jobs jobs={jobs} config={config} style="cards" /><Contact company={company} config={config} /><Footer company={company} config={config} preview={preview} /></Shell>
  </Page>;
}

function ArchiveTheme({ company, jobs, config, preview, visual }: ThemeProps & { visual: Visual }) {
  const cover = coverUrl(config);
  return <Page visual={visual} typography="editorial"><Shell><header className="border-b-4 border-double border-current py-6 text-center"><div className="flex justify-center"><Logo company={company} square /></div><div className="mt-3 flex items-center justify-center gap-2"><h1 className="font-serif text-4xl sm:text-6xl">{company.name}</h1><Seal company={company} /></div><div className="mt-4 grid grid-cols-3 border-t border-current/15 pt-3 text-[10px] uppercase tracking-[.18em]"><span>Archive 001</span><span>Business edition</span><span>{location(company)}</span></div></header><section className="grid gap-8 py-12 lg:grid-cols-[1.3fr_.7fr]"><div><Eyebrow>Featured entry</Eyebrow><h2 className="mt-5 font-serif text-6xl leading-[.95] sm:text-8xl">{heroTitle(company, config)}</h2><p className="mt-7 max-w-2xl text-lg leading-8 opacity-60">{heroText(company, config)}</p></div><div>{cover ? <img src={cover} alt="" className="aspect-[4/5] w-full object-cover grayscale" /> : <BrandPoster company={company} visual={visual} />}</div></section><About company={company} config={config} className="border-y border-current/20 py-16" /><Jobs jobs={jobs} config={config} style="index" /><Contact company={company} config={config} /><Footer company={company} config={config} preview={preview} /></Shell></Page>;
}

function MonoTheme({ company, jobs, config, preview, visual }: ThemeProps & { visual: Visual }) {
  const cover = coverUrl(config);
  return <Page visual={visual} typography="clean"><Shell><nav className="flex h-20 items-center border-b border-current"><b className="text-xs uppercase tracking-[.2em]">{company.name}</b><Seal company={company} /><div className="ml-auto flex gap-6 text-xs"><a href="#sobre">About</a><a href="#vagas">Jobs</a></div></nav><section className="grid min-h-[680px] items-end gap-10 border-b border-current py-14 lg:grid-cols-[1.2fr_.8fr]"><h1 className="text-7xl font-medium leading-[.78] tracking-[-.075em] sm:text-9xl">{heroTitle(company, config)}</h1><div><p className="text-lg leading-8 opacity-70">{heroText(company, config)}</p><div className="mt-7 text-xs uppercase tracking-[.18em] opacity-40">{location(company)}</div></div></section>{cover && <img src={cover} alt="" className="mt-8 max-h-[700px] w-full object-cover grayscale" />}<About company={company} config={config} className="grid gap-10 border-b border-current py-20 md:grid-cols-[220px_1fr]" /><Jobs jobs={jobs} config={config} style="index" /><Contact company={company} config={config} /><Footer company={company} config={config} preview={preview} /></Shell></Page>;
}

function Page({ visual, typography, children }: { visual: Visual; typography: CompanyTypography; children: React.ReactNode }) {
  const family = typography === 'editorial' ? 'font-serif' : typography === 'technical' ? 'font-mono' : 'font-sans';
  return <div className={`${family} min-h-screen overflow-hidden`} style={{ background: visual.background, color: visual.text, ['--brand' as any]: visual.primary, ['--accent' as any]: visual.accent }}>{children}</div>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1420px] px-5 sm:px-8">{children}</div>;
}

function Logo({ company, round = false, square = false }: { company: PublicCompanyLike; round?: boolean; square?: boolean }) {
  const radius = square ? 'rounded-none' : round ? 'rounded-full' : 'rounded-xl';
  if (company.logoURL) return <img src={company.logoURL} alt={`Logo ${company.name || ''}`} className={`h-10 w-10 shrink-0 object-contain ${radius}`} />;
  return <span className={`flex h-10 w-10 shrink-0 items-center justify-center border border-current/15 ${radius}`}><Building2 className="h-5 w-5 opacity-40" /></span>;
}

function Seal({ company, inverted = false }: { company: PublicCompanyLike; inverted?: boolean }) {
  if (!(company.isVerified || company.verificationStatus === 'VERIFIED')) return null;
  return <span title="Empresa verificada pelo PiraNegócios" aria-label="Empresa verificada pelo PiraNegócios" className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full" style={{ color: inverted ? '#fff' : '#059669', background: inverted ? 'rgba(255,255,255,.12)' : 'rgba(16,185,129,.10)' }}><BadgeCheck className="h-5 w-5" /></span>;
}

function heroTitle(company: PublicCompanyLike, config: CompanyPageConfig) { return config.hero?.title || company.name || 'Sua empresa'; }
function heroText(company: PublicCompanyLike, config: CompanyPageConfig) { return config.hero?.subtitle || config.about?.text || company.description || ''; }
function coverUrl(config: CompanyPageConfig) { return config.cover?.enabled && config.cover?.url ? config.cover.url : ''; }
function location(company: PublicCompanyLike) { return company.address || company.cityState || [company.city, company.state].filter(Boolean).join(', '); }
function jobHref(job: PublicJobLike) { return job.slug ? `/vagas/${encodeURIComponent(job.slug)}` : '/vagas'; }
function contrastText(hex: string) { const clean = hex.replace('#', ''); if (clean.length !== 6) return '#fff'; const r = parseInt(clean.slice(0, 2), 16); const g = parseInt(clean.slice(2, 4), 16); const b = parseInt(clean.slice(4, 6), 16); return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111' : '#fff'; }

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) { return <div className={`text-[10px] font-black uppercase tracking-[.24em] ${light ? 'text-white/55' : 'opacity-45'}`}>{children}</div>; }
function Pill({ children }: { children: React.ReactNode }) { return <span className="rounded-full border border-current/15 px-4 py-2 text-xs font-bold opacity-60">{children}</span>; }
function Feature({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-current/10 bg-white/60 p-5"><Eyebrow>{label}</Eyebrow><div className="mt-3 text-lg font-bold text-black">{value}</div></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="border-b border-current/15 py-4"><div className="text-[10px] uppercase tracking-[.18em] opacity-40">{label}</div><div className="mt-2 font-bold">{value}</div></div>; }

function BrandPoster({ company, visual }: { company: PublicCompanyLike; visual: Visual }) {
  return <div className="flex h-full min-h-[320px] items-center justify-center p-10" style={{ background: `radial-gradient(circle at 70% 20%,${visual.accent}88,transparent 26%),linear-gradient(135deg,${visual.primary},${visual.background})` }}><div className="text-center"><Logo company={company} round /><div className="mt-5 text-3xl font-black">{company.name}</div></div></div>;
}

function About({ company, config, className = '' }: { company: PublicCompanyLike; config: CompanyPageConfig; className?: string }) {
  const section = config.sections?.find((item) => item.type === 'about');
  const text = config.about?.text || company.description;
  if (section?.enabled === false || !text) return null;
  return <section id="sobre" className={className}><div><Eyebrow>{config.about?.title || 'Sobre'}</Eyebrow><p className="mt-5 max-w-5xl text-xl leading-8 opacity-70">{text}</p></div></section>;
}

function Jobs({ jobs, config, style }: { jobs: PublicJobLike[]; config: CompanyPageConfig; style: 'cards' | 'index' | 'terminal' }) {
  const title = config.jobs?.title || 'Oportunidades';
  const intro = config.jobs?.intro || 'Conheça as oportunidades abertas.';
  return <section id="vagas" className="py-16 sm:py-20"><div className="flex flex-wrap items-end justify-between gap-6"><div><Eyebrow>{title}</Eyebrow><h2 className="mt-4 text-4xl font-black tracking-[-.05em] sm:text-6xl">{jobs.length ? `${jobs.length} ${jobs.length === 1 ? 'oportunidade' : 'oportunidades'}` : 'Novas oportunidades em breve'}</h2></div><p className="max-w-md text-sm leading-6 opacity-50">{intro}</p></div>{!jobs.length ? <div className="mt-10 border-y border-current/15 py-10 text-sm opacity-50">Nenhuma vaga aberta neste momento.</div> : style === 'cards' ? <div className="mt-10 grid gap-4 md:grid-cols-2">{jobs.map((job, index) => <Link key={job.id || job.slug || job.title || index} to={jobHref(job)} className="group min-h-[210px] rounded-3xl border border-current/10 bg-white/[.06] p-6"><div className="flex justify-between text-[10px] uppercase tracking-[.18em] opacity-35"><span>{String(index + 1).padStart(2, '0')}</span><ExternalLink className="h-4 w-4" /></div><h3 className="mt-12 text-2xl font-black tracking-[-.035em]">{job.title || 'Oportunidade'}</h3><JobMeta job={job} /></Link>)}</div> : <div className={`mt-10 divide-y ${style === 'terminal' ? 'divide-white/10' : 'divide-current/15'}`}>{jobs.map((job, index) => <Link key={job.id || job.slug || job.title || index} to={jobHref(job)} className="group grid gap-4 py-6 sm:grid-cols-[64px_1fr_auto] sm:items-center"><span className="text-xs font-bold opacity-30">{String(index + 1).padStart(2, '0')}</span><div><h3 className="text-xl font-bold">{job.title || 'Oportunidade'}</h3><JobMeta job={job} /></div><ArrowRight className="h-5 w-5 opacity-30 transition group-hover:translate-x-1 group-hover:opacity-100" /></Link>)}</div>}</section>;
}

function JobMeta({ job }: { job: PublicJobLike }) { const loc = job.location || [job.city, job.state].filter(Boolean).join(', ') || 'Local a combinar'; return <p className="mt-2 text-sm opacity-45">{loc}{job.workModel ? ` · ${job.workModel}` : ''}{job.salary ? ` · ${job.salary}` : ''}</p>; }

function Contact({ company, config, dark = false }: { company: PublicCompanyLike; config: CompanyPageConfig; dark?: boolean }) {
  const section = config.sections?.find((item) => item.type === 'contact');
  if (section?.enabled === false) return null;
  const phone = config.contacts?.phone || company.phone;
  const email = config.contacts?.email;
  const website = config.contacts?.website || company.website;
  const items = [
    phone && { label: 'Telefone', value: phone, href: `tel:${phone.replace(/\D/g, '')}`, icon: <Phone className="h-4 w-4" /> },
    email && { label: 'E-mail', value: email, href: `mailto:${email}`, icon: <Mail className="h-4 w-4" /> },
    website && { label: 'Site', value: website, href: normalizeUrl(website), icon: <Globe2 className="h-4 w-4" /> },
    location(company) && { label: 'Endereço', value: location(company), href: '', icon: <MapPin className="h-4 w-4" /> },
  ].filter(Boolean) as Array<{ label: string; value: string; href: string; icon: React.ReactNode }>;
  if (!items.length) return null;
  return <section id="contato" className={`border-t py-14 ${dark ? 'border-white/10' : 'border-current/15'}`}><Eyebrow light={dark}>Contato</Eyebrow><div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{items.map((item) => <a key={item.label} href={item.href || undefined} target={item.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="border-b border-current/15 pb-4"><div className="flex items-center gap-2 text-[10px] uppercase tracking-[.16em] opacity-40">{item.icon}{item.label}</div><div className="mt-2 font-semibold">{item.value}</div></a>)}</div><Social company={company} config={config} /></section>;
}

function Social({ company, config }: { company: PublicCompanyLike; config: CompanyPageConfig }) {
  const section = config.sections?.find((item) => item.type === 'socials'); if (section?.enabled === false) return null;
  const items = [
    ['Instagram', config.socials?.instagram || company.socialInstagram, <Instagram className="h-4 w-4" />],
    ['LinkedIn', config.socials?.linkedin || company.socialLinkedin, <Linkedin className="h-4 w-4" />],
    ['Facebook', config.socials?.facebook || company.socialFacebook, <Facebook className="h-4 w-4" />],
    ['YouTube', config.socials?.youtube, <Youtube className="h-4 w-4" />],
    ['TikTok', config.socials?.tiktok, <Music2 className="h-4 w-4" />],
  ].filter((item) => Boolean(item[1])) as Array<[string, string, React.ReactNode]>;
  return <div className="mt-8 flex flex-wrap gap-4">{items.map(([label, href, icon]) => <a key={label} href={normalizeUrl(href)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm opacity-55">{icon}{label}</a>)}</div>;
}

function Footer({ company, config, preview, dark = false }: { company: PublicCompanyLike; config: CompanyPageConfig; preview?: boolean; dark?: boolean }) {
  return <footer className={`flex flex-col gap-3 border-t py-7 text-xs sm:flex-row sm:justify-between ${dark ? 'border-white/10 text-white/35' : 'border-current/15 opacity-45'}`}><span>{config.footer?.text || `© ${new Date().getFullYear()} ${company.name || 'Empresa'}`}</span><Link to="/" className="underline underline-offset-4">{preview ? 'Prévia privada · ' : ''}PiraNegócios Business</Link></footer>;
}

function normalizeUrl(value?: string) { const raw = String(value || '').trim(); if (!raw) return ''; if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw; return `https://${raw}`; }
