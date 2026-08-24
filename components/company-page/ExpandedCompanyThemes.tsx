import React from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ExternalLink,
  Globe,
  Instagram,
  Linkedin,
  Facebook,
  Mail,
  MapPin,
  Music2,
  Phone,
  Search,
  Sparkles,
  Star,
  Utensils,
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
  { id: 'institutional', label: 'Institucional', description: 'Empresas, indústrias, tecnologia e presença corporativa.' },
  { id: 'classifieds', label: 'Classificados', description: 'Vitrines locais, ofertas, anúncios e marketplaces.' },
  { id: 'restaurants', label: 'Restaurantes', description: 'Bares, cafés, restaurantes, delivery e gastronomia.' },
  { id: 'fashion', label: 'Vestuário', description: 'Moda, lojas, boutiques, streetwear e marcas autorais.' },
  { id: 'services', label: 'Serviços', description: 'Profissionais, clínicas, oficinas, agências e negócios locais.' },
  { id: 'other', label: 'Outros', description: 'Temas versáteis para experiências fora das categorias anteriores.' },
];

export const EXTRA_COMPANY_PAGE_TEMPLATES: CompanyThemeCatalogItem[] = [
  { key: 'mercado', category: 'classifieds', name: 'Mercado', eyebrow: 'Marketplace', description: 'Vitrine clara, filtros visuais, módulos densos e leitura rápida.', bestFor: 'Classificados gerais, lojas multimarcas e catálogos locais' },
  { key: 'gazeta', category: 'classifieds', name: 'Gazeta', eyebrow: 'Newspaper', description: 'Classificados com linguagem de jornal, colunas, linhas finas e hierarquia editorial.', bestFor: 'Imóveis, veículos, empregos e anúncios tradicionais' },
  { key: 'mosaico', category: 'classifieds', name: 'Mosaico', eyebrow: 'Discovery', description: 'Blocos assimétricos, cor e descoberta visual inspirada em vitrines contemporâneas.', bestFor: 'Produtos variados, brechós, artesanato e achadinhos' },
  { key: 'radar', category: 'classifieds', name: 'Radar', eyebrow: 'Local finder', description: 'Experiência local com painel, marcadores, distância visual e listagem objetiva.', bestFor: 'Negócios de bairro, serviços próximos e classificados regionais' },
  { key: 'pregao', category: 'classifieds', name: 'Pregão', eyebrow: 'Listing board', description: 'Visual escuro e preciso, com preços, etiquetas e sensação de painel de oportunidades.', bestFor: 'Veículos, equipamentos, usados premium e ofertas especiais' },

  { key: 'bistro', category: 'restaurants', name: 'Bistrô', eyebrow: 'Editorial menu', description: 'Serifas, creme, fotografia e composição intimista de restaurante autoral.', bestFor: 'Bistrôs, cafés, padarias artesanais e gastronomia afetiva' },
  { key: 'brasa', category: 'restaurants', name: 'Brasa', eyebrow: 'Fire & smoke', description: 'Escuro, quente e dramático, com tipografia pesada e imagem ocupando espaço.', bestFor: 'Hamburguerias, churrascarias, bares e casas de carnes' },
  { key: 'jardim', category: 'restaurants', name: 'Jardim', eyebrow: 'Organic', description: 'Paleta botânica, curvas orgânicas, respiro e linguagem leve.', bestFor: 'Veganos, naturais, cafeterias, brunch e alimentação saudável' },
  { key: 'diner', category: 'restaurants', name: 'Diner', eyebrow: 'Retro pop', description: 'Faixas, cores saturadas e clima de cardápio retrô sem perder acabamento profissional.', bestFor: 'Lanchonetes, pizzarias, sorveterias e marcas jovens' },
  { key: 'degustacao', category: 'restaurants', name: 'Degustação', eyebrow: 'Fine dining', description: 'Luxo silencioso, muito espaço, tipografia elegante e conteúdo em ritmo de experiência.', bestFor: 'Alta gastronomia, wine bars, hotéis e restaurantes premium' },

  { key: 'runway', category: 'fashion', name: 'Runway', eyebrow: 'High fashion', description: 'Monocromático, imagem dominante, tipografia enorme e ritmo de passarela.', bestFor: 'Moda autoral, luxo e coleções sazonais' },
  { key: 'street', category: 'fashion', name: 'Street', eyebrow: 'Streetwear', description: 'Brutalista, adesivos, faixas, recortes e presença urbana.', bestFor: 'Streetwear, sneakers, skate e público jovem' },
  { key: 'boutique', category: 'fashion', name: 'Boutique', eyebrow: 'Soft luxury', description: 'Tons suaves, serifas finas, detalhes delicados e composição sofisticada.', bestFor: 'Boutiques, moda feminina, acessórios e joalheria' },
  { key: 'lookbook', category: 'fashion', name: 'Lookbook', eyebrow: 'Editorial grid', description: 'Grade fotográfica, legendas, índices e narrativa visual de coleção.', bestFor: 'Confecções, designers, editoriais e portfólios de coleção' },
  { key: 'atelier', category: 'fashion', name: 'Atelier', eyebrow: 'Craft couture', description: 'Composição artesanal, textura visual, linhas e detalhes de processo.', bestFor: 'Costura sob medida, ateliês, noivas e marcas artesanais' },

  { key: 'pro', category: 'services', name: 'Pro', eyebrow: 'Professional', description: 'Confiança, clareza, prova social visual e chamadas diretas.', bestFor: 'Consultorias, escritórios, contabilidade e B2B' },
  { key: 'oficio', category: 'services', name: 'Ofício', eyebrow: 'Hands on', description: 'Industrial e humano, com linguagem de trabalho bem feito e informação prática.', bestFor: 'Oficinas, manutenção, construção e serviços técnicos' },
  { key: 'care', category: 'services', name: 'Care', eyebrow: 'Calm care', description: 'Acolhedor, limpo, suave e com hierarquia tranquila.', bestFor: 'Clínicas, estética, bem-estar, saúde e terapias' },
  { key: 'studio', category: 'services', name: 'Studio', eyebrow: 'Creative service', description: 'Portfólio ousado, grid modular e apresentação de agência criativa.', bestFor: 'Agências, design, foto, vídeo e arquitetura' },
  { key: 'local', category: 'services', name: 'Local', eyebrow: 'Neighborhood', description: 'Amigável, direto, caloroso e pensado para conversão local.', bestFor: 'Salões, pet shops, assistência, escolas e pequenos negócios' },

  { key: 'festival', category: 'other', name: 'Festival', eyebrow: 'Culture', description: 'Cores, cartazes digitais, faixas e composição energética.', bestFor: 'Eventos, cultura, música, projetos e entretenimento' },
  { key: 'terra', category: 'other', name: 'Terra', eyebrow: 'Natural', description: 'Texturas cromáticas, tons terrosos e ritmo orgânico.', bestFor: 'Rural, sustentabilidade, turismo e marcas naturais' },
  { key: 'cosmos', category: 'other', name: 'Cosmos', eyebrow: 'Experimental', description: 'Escuro, espacial, gradientes e composição tecnológica experimental.', bestFor: 'Inovação, games, audiovisual e experiências digitais' },
  { key: 'heritage', category: 'other', name: 'Heritage', eyebrow: 'Classic', description: 'Clássico contemporâneo com molduras, serifas e presença histórica.', bestFor: 'Negócios tradicionais, hotelaria, educação e instituições culturais' },
  { key: 'mono', category: 'other', name: 'Mono', eyebrow: 'Universal', description: 'Ultraminimalista e tipográfico, deixando a identidade da empresa ocupar o palco.', bestFor: 'Qualquer negócio que queira uma base neutra e premium' },
];

export const EXTRA_THEME_PRESETS: Record<ExtraCompanyThemeKey, ExtendedThemePreset> = {
  mercado: preset('wide', '#2563eb', '#f59e0b', '#f5f7fb', '#152033', 'clean', 'soft', 'grid'),
  gazeta: preset('wide', '#8b1e1e', '#c7a96b', '#f3efe5', '#231f1a', 'editorial', 'square', 'list'),
  mosaico: preset('full', '#6d28d9', '#ec4899', '#fff7ed', '#201a24', 'human', 'round', 'grid'),
  radar: preset('wide', '#0f766e', '#fb923c', '#eef6f4', '#12322f', 'clean', 'soft', 'compact'),
  pregao: preset('wide', '#f4c430', '#f97316', '#111214', '#f5f5f4', 'technical', 'square', 'list'),
  bistro: preset('wide', '#713f2a', '#b8895b', '#f3eadf', '#35271e', 'editorial', 'soft', 'list'),
  brasa: preset('full', '#e23d28', '#f59e0b', '#15110f', '#f7efe8', 'human', 'square', 'grid'),
  jardim: preset('wide', '#567d46', '#d99f67', '#f4f1df', '#253126', 'editorial', 'round', 'list'),
  diner: preset('full', '#ef4444', '#22d3ee', '#fff2c7', '#251a1a', 'human', 'round', 'grid'),
  degustacao: preset('wide', '#6f5138', '#bda37c', '#f8f5ef', '#29241f', 'editorial', 'square', 'list'),
  runway: preset('full', '#111111', '#ef4444', '#f5f5f2', '#0b0b0b', 'clean', 'square', 'list'),
  street: preset('full', '#111111', '#b8ff2c', '#e7e7e2', '#111111', 'technical', 'square', 'grid'),
  boutique: preset('wide', '#a85f72', '#d2a679', '#f8f1f1', '#382b30', 'editorial', 'round', 'list'),
  lookbook: preset('wide', '#25324a', '#b8895b', '#f1efe9', '#1e2430', 'editorial', 'square', 'grid'),
  atelier: preset('wide', '#754c3b', '#c09a7a', '#eee5da', '#332822', 'editorial', 'soft', 'list'),
  pro: preset('wide', '#1d4ed8', '#14b8a6', '#f7f9fc', '#152033', 'clean', 'soft', 'grid'),
  oficio: preset('wide', '#dc5a26', '#294c60', '#f1eadf', '#292621', 'technical', 'square', 'list'),
  care: preset('wide', '#3c8d87', '#d89aa7', '#f3f8f6', '#243533', 'human', 'round', 'grid'),
  studio: preset('full', '#6d28d9', '#f43f5e', '#f5f2ff', '#17121e', 'clean', 'soft', 'grid'),
  local: preset('wide', '#cc5843', '#2e7d6e', '#fff8ef', '#362a25', 'human', 'round', 'compact'),
  festival: preset('full', '#7c3aed', '#ff4d6d', '#fff4a6', '#16121d', 'human', 'square', 'grid'),
  terra: preset('wide', '#6b7d3e', '#b96843', '#eee3d2', '#30291f', 'editorial', 'round', 'list'),
  cosmos: preset('full', '#8b5cf6', '#22d3ee', '#05040a', '#f8f7ff', 'technical', 'soft', 'compact'),
  heritage: preset('wide', '#6f1d1b', '#a67c52', '#efe8d8', '#2b241c', 'editorial', 'square', 'list'),
  mono: preset('wide', '#111111', '#777777', '#ffffff', '#111111', 'clean', 'square', 'list'),
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

export function ExtraCompanyThemeRenderer({ themeKey, company, jobs, config, preview = false }: ThemeProps & { themeKey: ExtraCompanyThemeKey }) {
  const p = EXTRA_THEME_PRESETS[themeKey];
  const props = { company, jobs, config, preview, p };
  if (['mercado', 'gazeta', 'mosaico', 'radar', 'pregao'].includes(themeKey)) return <ClassifiedTheme variant={themeKey as any} {...props} />;
  if (['bistro', 'brasa', 'jardim', 'diner', 'degustacao'].includes(themeKey)) return <RestaurantTheme variant={themeKey as any} {...props} />;
  if (['runway', 'street', 'boutique', 'lookbook', 'atelier'].includes(themeKey)) return <FashionTheme variant={themeKey as any} {...props} />;
  if (['pro', 'oficio', 'care', 'studio', 'local'].includes(themeKey)) return <ServiceTheme variant={themeKey as any} {...props} />;
  return <OtherTheme variant={themeKey as any} {...props} />;
}

type ExtendedProps = ThemeProps & { p: ExtendedThemePreset };

function ClassifiedTheme({ variant, company, jobs, config, preview, p }: ExtendedProps & { variant: 'mercado' | 'gazeta' | 'mosaico' | 'radar' | 'pregao' }) {
  const s = shellStyle(config, p);
  const cover = coverUrl(config);
  if (variant === 'gazeta') return <Gazeta company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  if (variant === 'mosaico') return <Mosaico company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  if (variant === 'radar') return <Radar company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  if (variant === 'pregao') return <Pregao company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  return <Mercado company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
}

function Mercado({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography={config.branding?.typography}>
    <nav className="border-b border-black/10 bg-white/90"><Shell width={config.width}><div className="flex h-16 items-center gap-3"><Logo company={company} /><b>{company.name}</b><Seal company={company} /><span className="ml-auto hidden text-xs opacity-50 sm:block">Vitrine local</span><a href="#vagas" className="rounded-full px-4 py-2 text-xs font-bold text-white" style={{ background: s.primary }}>Oportunidades</a></div></Shell></nav>
    <Shell width={config.width}><header className="grid gap-8 py-12 lg:grid-cols-[1.1fr_.9fr]"><div><Tag>Marketplace empresarial</Tag><h1 className="mt-5 text-5xl font-black tracking-[-.055em] sm:text-7xl">{heroTitle(company, config)}</h1><p className="mt-5 max-w-2xl text-lg leading-8 opacity-65">{heroText(company, config)}</p><div className="mt-8 flex flex-wrap gap-2"><Chip>Empresa</Chip><Chip>{location(company) || 'Brasil'}</Chip><Chip>{jobs.length} vagas</Chip></div></div><VisualPanel company={company} cover={cover} s={s} label="Destaques" /></header>
    <section className="grid gap-4 border-y border-black/10 py-5 sm:grid-cols-3"><Metric label="Empresa" value={company.name || 'Negócio'} /><Metric label="Local" value={location(company) || 'Não informado'} /><Metric label="Oportunidades" value={String(jobs.length)} /></section>
    <About company={company} config={config} className="grid gap-8 py-16 lg:grid-cols-[.35fr_1fr]" />
    <Jobs company={company} jobs={jobs} config={config} style="market" />
    <Contact company={company} config={config} style="tiles" />
    <Footer company={company} config={config} preview={preview} />
  </ThemeFrame>;
}

function Gazeta({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="editorial">
    <Shell width={config.width}><div className="border-b-4 border-double border-current py-5 text-center"><div className="flex items-center justify-center gap-3"><Logo company={company} square /><Seal company={company} /></div><h1 className="mt-3 font-serif text-4xl font-bold sm:text-6xl">{company.name}</h1><div className="mt-3 flex justify-between border-t border-current/20 pt-2 text-[10px] uppercase tracking-[.18em]"><span>{new Date().toLocaleDateString('pt-BR')}</span><span>Classificados & negócios</span><span>{location(company)}</span></div></div>
    <header className="grid gap-6 border-b border-current/20 py-10 lg:grid-cols-[1.4fr_.6fr]"><div><Tag>Em destaque</Tag><h2 className="mt-4 font-serif text-5xl font-bold leading-none sm:text-7xl">{heroTitle(company, config)}</h2><p className="mt-5 max-w-3xl text-lg leading-8 opacity-70">{heroText(company, config)}</p></div>{cover ? <img src={cover} alt="" className="aspect-[4/3] h-full w-full object-cover grayscale" /> : <div className="border border-current/20 p-6"><p className="text-xs uppercase tracking-[.2em] opacity-45">Painel</p><p className="mt-6 font-serif text-7xl">{jobs.length}</p><p className="text-sm opacity-55">oportunidades abertas</p></div>}</header>
    <div className="grid gap-8 py-12 lg:grid-cols-[.42fr_1fr]"><About company={company} config={config} className="border-r border-current/20 pr-8" /><Jobs company={company} jobs={jobs} config={config} style="newspaper" /></div>
    <Contact company={company} config={config} style="lines" /><Footer company={company} config={config} preview={preview} />
    </Shell>
  </ThemeFrame>;
}

function Mosaico({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="human">
    <div className="px-4 py-4 sm:px-6"><div className="flex items-center gap-3 rounded-[28px] bg-white/70 px-5 py-3 backdrop-blur"><Logo company={company} round /><b>{company.name}</b><Seal company={company} /><a href="#vagas" className="ml-auto text-sm font-bold">Explorar ↓</a></div></div>
    <div className="grid min-h-[650px] gap-4 px-4 pb-4 sm:px-6 lg:grid-cols-12">
      <div className="rounded-[36px] p-8 text-white lg:col-span-7 lg:p-12" style={{ background: `linear-gradient(135deg,${s.primary},${s.accent})` }}><Tag light>Descobertas locais</Tag><h1 className="mt-7 text-6xl font-black leading-[.88] tracking-[-.06em] sm:text-8xl">{heroTitle(company, config)}</h1><p className="mt-7 max-w-xl text-lg leading-8 text-white/75">{heroText(company, config)}</p></div>
      <div className="overflow-hidden rounded-[36px] bg-black/5 lg:col-span-5">{cover ? <img src={cover} alt="" className="h-full min-h-[320px] w-full object-cover" /> : <div className="flex h-full min-h-[320px] items-center justify-center"><Logo company={company} large /></div>}</div>
      <div className="rounded-[36px] bg-white p-7 lg:col-span-4"><Metric label="Local" value={location(company) || 'Região'} /><p className="mt-7 text-sm leading-6 opacity-55">Presença da empresa e canais oficiais em um só lugar.</p></div>
      <div className="rounded-[36px] p-7 text-white lg:col-span-8" style={{ background: s.text }}><p className="text-xs uppercase tracking-[.2em] opacity-45">Agora</p><p className="mt-3 text-5xl font-black">{jobs.length}</p><p className="opacity-55">oportunidades abertas</p></div>
    </div>
    <Shell width="wide"><About company={company} config={config} className="py-16" /><Jobs company={company} jobs={jobs} config={config} style="mosaic" /><Contact company={company} config={config} style="pills" /><Footer company={company} config={config} preview={preview} /></Shell>
  </ThemeFrame>;
}

function Radar({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="clean">
    <Shell width="wide"><nav className="flex h-16 items-center border-b border-current/10"><Logo company={company} /><b className="ml-3">{company.name}</b><Seal company={company} /><span className="ml-auto flex items-center gap-2 text-xs opacity-50"><MapPin className="h-4 w-4" />{location(company) || 'Sua região'}</span></nav>
    <header className="grid gap-6 py-8 lg:grid-cols-[.65fr_1.35fr]"><div className="rounded-[24px] border border-current/10 bg-white/70 p-7"><div className="flex h-11 items-center gap-3 rounded-full border border-current/10 bg-white px-4 text-sm opacity-55"><Search className="h-4 w-4" />Descobrir a empresa</div><h1 className="mt-9 text-5xl font-black tracking-[-.055em]">{heroTitle(company, config)}</h1><p className="mt-5 leading-7 opacity-60">{heroText(company, config)}</p><a href="#vagas" className="mt-7 inline-flex rounded-full px-5 py-3 text-sm font-bold text-white" style={{ background: s.primary }}>Ver oportunidades</a></div><div className="relative min-h-[430px] overflow-hidden rounded-[24px]" style={{ background: `radial-gradient(circle at 65% 40%,${s.accent}66 0 8%,transparent 9%),linear-gradient(135deg,${s.primary}18,transparent),repeating-linear-gradient(0deg,transparent 0 39px,rgba(0,0,0,.06) 40px),repeating-linear-gradient(90deg,transparent 0 39px,rgba(0,0,0,.06) 40px)` }}>{cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-multiply" />}<div className="absolute left-[20%] top-[25%] rounded-full bg-white p-3 shadow-xl"><Logo company={company} round /></div><div className="absolute bottom-5 right-5 rounded-2xl bg-white p-4 shadow-xl"><p className="text-[10px] uppercase tracking-[.18em] opacity-45">No radar</p><b className="mt-1 block">{jobs.length} vagas</b></div></div></header>
    <Jobs company={company} jobs={jobs} config={config} style="radar" /><About company={company} config={config} className="py-16" /><Contact company={company} config={config} style="tiles" /><Footer company={company} config={config} preview={preview} /></Shell>
  </ThemeFrame>;
}

function Pregao({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="technical">
    <div className="border-b border-white/10 bg-black/30"><Shell width="wide"><nav className="flex h-14 items-center text-xs uppercase tracking-[.14em]"><Logo company={company} square /><span className="ml-3 font-bold">{company.name}</span><Seal company={company} inverted /><span className="ml-auto opacity-40">PAINEL / {location(company) || 'BR'}</span></nav></Shell></div>
    <Shell width="wide"><header className="grid min-h-[560px] items-end gap-8 py-12 lg:grid-cols-[1.25fr_.75fr]"><div><Tag light>Listing board</Tag><h1 className="mt-5 text-6xl font-black uppercase leading-[.85] tracking-[-.06em] sm:text-8xl">{heroTitle(company, config)}</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-white/55">{heroText(company, config)}</p></div><div className="border border-white/15 p-6"><p className="text-[10px] uppercase tracking-[.2em] text-white/35">Atividade</p><p className="mt-4 text-7xl font-black" style={{ color: s.primary }}>{String(jobs.length).padStart(2,'0')}</p><p className="text-sm text-white/45">oportunidades disponíveis</p>{cover && <img src={cover} alt="" className="mt-8 aspect-[16/9] w-full object-cover grayscale" />}</div></header><Jobs company={company} jobs={jobs} config={config} style="board" /><About company={company} config={config} className="border-t border-white/10 py-16" /><Contact company={company} config={config} style="dark" /><Footer company={company} config={config} preview={preview} dark /></Shell>
  </ThemeFrame>;
}

function RestaurantTheme({ variant, company, jobs, config, preview, p }: ExtendedProps & { variant: 'bistro' | 'brasa' | 'jardim' | 'diner' | 'degustacao' }) {
  const s = shellStyle(config, p); const cover = coverUrl(config);
  if (variant === 'brasa') return <Brasa company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  if (variant === 'jardim') return <Jardim company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  if (variant === 'diner') return <Diner company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  if (variant === 'degustacao') return <Degustacao company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  return <Bistro company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
}

function Bistro({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="editorial"><Shell width="wide"><nav className="flex h-20 items-center border-b border-current/15"><Logo company={company} /><span className="ml-3 font-serif text-xl italic">{company.name}</span><Seal company={company} /><div className="ml-auto flex gap-6 text-xs uppercase tracking-[.16em]"><a href="#sobre">A casa</a><a href="#vagas">Equipe</a></div></nav><header className="grid gap-8 py-12 lg:grid-cols-[.9fr_1.1fr]"><div className="flex flex-col justify-end"><Tag>À mesa</Tag><h1 className="mt-5 font-serif text-6xl leading-[.95] sm:text-8xl">{heroTitle(company, config)}</h1><p className="mt-7 max-w-xl text-lg leading-8 opacity-65">{heroText(company, config)}</p><p className="mt-8 text-sm italic opacity-50">{location(company)}</p></div><div className="aspect-[4/5] overflow-hidden rounded-t-[180px] bg-black/5">{cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Utensils className="h-20 w-20 opacity-15" /></div>}</div></header><About company={company} config={config} className="grid gap-8 border-y border-current/15 py-16 lg:grid-cols-[.35fr_1fr]" /><Jobs company={company} jobs={jobs} config={config} style="menu" label="Trabalhe conosco" /><Contact company={company} config={config} style="lines" /><Footer company={company} config={config} preview={preview} /></Shell></ThemeFrame>;
}

function Brasa({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="human"><header className="relative min-h-[720px] overflow-hidden">{cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}<div className="absolute inset-0" style={{ background: `radial-gradient(circle at 70% 35%,${s.primary}77,transparent 28%),linear-gradient(180deg,transparent,#15110f)` }} /><Shell width="wide"><nav className="relative z-10 flex h-20 items-center text-white"><Logo company={company} round /><b className="ml-3 uppercase tracking-[.12em]">{company.name}</b><Seal company={company} inverted /><a href="#vagas" className="ml-auto border-b border-white/40 pb-1 text-xs uppercase tracking-[.16em]">Equipe</a></nav><div className="relative z-10 flex min-h-[600px] items-end pb-16"><div><Tag light>Fogo, sabor, gente</Tag><h1 className="mt-5 max-w-5xl text-7xl font-black uppercase leading-[.8] tracking-[-.07em] text-white sm:text-9xl">{heroTitle(company, config)}</h1><p className="mt-8 max-w-2xl text-xl leading-8 text-white/60">{heroText(company, config)}</p></div></div></Shell></header><Shell width="wide"><About company={company} config={config} className="py-20 text-2xl leading-10" /><Jobs company={company} jobs={jobs} config={config} style="brasa" label="Vem pra cozinha" /><Contact company={company} config={config} style="dark" /><Footer company={company} config={config} preview={preview} dark /></Shell></ThemeFrame>;
}

function Jardim({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="editorial"><Shell width="wide"><nav className="flex h-20 items-center"><Logo company={company} round /><span className="ml-3 font-serif text-xl">{company.name}</span><Seal company={company} /><span className="ml-auto text-xs uppercase tracking-[.16em] opacity-45">feito com calma</span></nav><header className="grid min-h-[620px] gap-8 rounded-[44px] p-8 sm:p-12 lg:grid-cols-[1fr_.85fr]" style={{ background: `${s.primary}18` }}><div className="flex flex-col justify-center"><Tag>Da horta à mesa</Tag><h1 className="mt-5 font-serif text-6xl leading-none sm:text-8xl">{heroTitle(company, config)}</h1><p className="mt-7 max-w-xl text-lg leading-8 opacity-65">{heroText(company, config)}</p><div className="mt-8 flex gap-3"><Chip>{location(company)}</Chip><Chip>{jobs.length} vagas</Chip></div></div><div className="relative flex items-center justify-center"><div className="absolute h-72 w-72 rounded-[45%_55%_60%_40%]" style={{ background: s.accent, opacity: .35 }} /><div className="relative h-[420px] w-[80%] overflow-hidden rounded-[48%_52%_42%_58%]">{cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-white/50"><Logo company={company} large round /></div>}</div></div></header><About company={company} config={config} className="grid gap-10 py-20 lg:grid-cols-[.3fr_1fr]" /><Jobs company={company} jobs={jobs} config={config} style="garden" label="Cultive sua carreira" /><Contact company={company} config={config} style="pills" /><Footer company={company} config={config} preview={preview} /></Shell></ThemeFrame>;
}

function Diner({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="human"><div className="border-y-4 border-current py-2 text-center text-xs font-black uppercase tracking-[.24em]" style={{ background: s.accent }}>OPEN • GOOD FOOD • GOOD PEOPLE • OPEN • GOOD FOOD • GOOD PEOPLE</div><Shell width="wide"><nav className="flex h-20 items-center"><Logo company={company} round /><b className="ml-3 text-lg uppercase">{company.name}</b><Seal company={company} /><span className="ml-auto rounded-full border-2 border-current px-4 py-2 text-xs font-black">{jobs.length} vagas</span></nav><header className="grid min-h-[560px] items-center gap-8 py-10 lg:grid-cols-[1fr_1fr]"><div><p className="inline-block -rotate-2 rounded-full px-5 py-2 text-sm font-black uppercase text-white" style={{ background: s.primary }}>Desde sempre com fome de futuro</p><h1 className="mt-8 text-7xl font-black uppercase leading-[.8] tracking-[-.07em] sm:text-9xl">{heroTitle(company, config)}</h1><p className="mt-7 max-w-xl text-xl font-bold leading-8">{heroText(company, config)}</p></div><div className="relative"><div className="absolute inset-4 rotate-6 rounded-[48px]" style={{ background: s.accent }} /><div className="relative aspect-square -rotate-2 overflow-hidden rounded-[48px] border-4 border-current bg-white">{cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Utensils className="h-24 w-24 opacity-20" /></div>}</div></div></header><Jobs company={company} jobs={jobs} config={config} style="diner" label="Junte-se à turma" /><About company={company} config={config} className="border-t-4 border-current py-16 text-3xl font-black" /><Contact company={company} config={config} style="tiles" /><Footer company={company} config={config} preview={preview} /></Shell></ThemeFrame>;
}

function Degustacao({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="editorial"><Shell width="standard"><nav className="flex h-24 items-center justify-center border-b border-current/15"><div className="text-center"><div className="flex items-center justify-center gap-2"><Logo company={company} square /><Seal company={company} /></div><p className="mt-2 text-[10px] uppercase tracking-[.24em] opacity-45">{company.name}</p></div></nav><header className="py-24 text-center"><Tag>Experiência</Tag><h1 className="mx-auto mt-7 max-w-5xl font-serif text-6xl leading-[.98] sm:text-8xl">{heroTitle(company, config)}</h1><p className="mx-auto mt-8 max-w-2xl text-lg leading-8 opacity-60">{heroText(company, config)}</p>{cover && <img src={cover} alt="" className="mt-16 aspect-[16/8] w-full object-cover" />}</header><About company={company} config={config} className="mx-auto max-w-3xl border-y border-current/15 py-16 text-center text-2xl leading-10" /><Jobs company={company} jobs={jobs} config={config} style="fine" label="Carreiras" /><Contact company={company} config={config} style="lines" /><Footer company={company} config={config} preview={preview} /></Shell></ThemeFrame>;
}

function FashionTheme({ variant, company, jobs, config, preview, p }: ExtendedProps & { variant: 'runway' | 'street' | 'boutique' | 'lookbook' | 'atelier' }) {
  const s = shellStyle(config, p); const cover = coverUrl(config);
  if (variant === 'street') return <Street company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  if (variant === 'boutique') return <Boutique company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  if (variant === 'lookbook') return <Lookbook company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  if (variant === 'atelier') return <Atelier company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  return <Runway company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
}

function Runway({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="clean"><nav className="absolute inset-x-0 top-0 z-20"><div className="flex h-20 items-center px-6 mix-blend-difference text-white sm:px-10"><b className="text-sm uppercase tracking-[.18em]">{company.name}</b><Seal company={company} inverted /><a href="#vagas" className="ml-auto text-xs uppercase tracking-[.18em]">Careers</a></div></nav><header className="relative min-h-screen overflow-hidden bg-black text-white">{cover ? <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75" /> : null}<div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/10" /><div className="relative z-10 flex min-h-screen items-end p-6 pb-14 sm:p-10 sm:pb-16"><div><Tag light>Collection / Company</Tag><h1 className="mt-5 max-w-[1300px] text-[16vw] font-black uppercase leading-[.68] tracking-[-.075em] sm:text-[12vw]">{heroTitle(company, config)}</h1><p className="mt-8 max-w-xl text-lg text-white/65">{heroText(company, config)}</p></div></div></header><Shell width="wide"><About company={company} config={config} className="grid gap-8 py-24 lg:grid-cols-[.25fr_1fr] text-3xl sm:text-5xl" /><Jobs company={company} jobs={jobs} config={config} style="runway" label="Join the house" /><Contact company={company} config={config} style="lines" /><Footer company={company} config={config} preview={preview} /></Shell></ThemeFrame>;
}

function Street({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="technical"><div className="border-y-4 border-black bg-black py-2 text-center text-sm font-black uppercase tracking-[.14em] text-white">DROP • COMMUNITY • WORK • CULTURE • DROP • COMMUNITY • WORK • CULTURE</div><div className="p-4 sm:p-6"><div className="grid min-h-[640px] border-4 border-black lg:grid-cols-[1.2fr_.8fr]"><div className="p-6 sm:p-10"><div className="flex items-center gap-3"><Logo company={company} square /><Seal company={company} /></div><h1 className="mt-12 text-7xl font-black uppercase leading-[.74] tracking-[-.07em] sm:text-9xl">{heroTitle(company, config)}</h1><p className="mt-8 max-w-xl text-lg font-bold leading-8">{heroText(company, config)}</p><div className="mt-10 inline-block -rotate-2 border-4 border-black px-5 py-3 text-sm font-black uppercase" style={{ background: s.accent }}>We are hiring / {jobs.length}</div></div><div className="relative min-h-[360px] border-t-4 border-black lg:border-l-4 lg:border-t-0">{cover ? <img src={cover} alt="" className="h-full w-full object-cover grayscale" /> : <div className="flex h-full items-center justify-center text-9xl font-black opacity-10">PN</div>}</div></div></div><Shell width="wide"><Jobs company={company} jobs={jobs} config={config} style="street" label="Open positions" /><About company={company} config={config} className="border-y-4 border-current py-16 text-3xl font-black uppercase" /><Contact company={company} config={config} style="tiles" /><Footer company={company} config={config} preview={preview} /></Shell></ThemeFrame>;
}

function Boutique({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="editorial"><Shell width="wide"><nav className="flex h-20 items-center"><span className="font-serif text-2xl italic">{company.name}</span><Seal company={company} /><div className="ml-auto flex gap-6 text-xs uppercase tracking-[.18em] opacity-50"><a href="#sobre">Maison</a><a href="#vagas">Carreiras</a></div></nav><header className="grid gap-10 pb-16 pt-8 lg:grid-cols-[.8fr_1.2fr]"><div className="flex flex-col justify-center"><Tag>Maison</Tag><h1 className="mt-6 font-serif text-6xl leading-[.95] sm:text-8xl">{heroTitle(company, config)}</h1><p className="mt-8 max-w-lg text-lg leading-8 opacity-60">{heroText(company, config)}</p><div className="mt-10 flex items-center gap-3"><Logo company={company} round /><span className="text-xs uppercase tracking-[.16em] opacity-45">{location(company)}</span></div></div><div className="aspect-[4/5] overflow-hidden rounded-[180px_180px_30px_30px] bg-black/5">{cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Logo company={company} large round /></div>}</div></header><About company={company} config={config} className="mx-auto max-w-4xl border-y border-current/15 py-20 text-center text-3xl leading-[1.45]" /><Jobs company={company} jobs={jobs} config={config} style="boutique" label="Carreiras" /><Contact company={company} config={config} style="pills" /><Footer company={company} config={config} preview={preview} /></Shell></ThemeFrame>;
}

function Lookbook({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="editorial"><Shell width="wide"><nav className="grid grid-cols-3 border-b border-current/20 py-4 text-[10px] uppercase tracking-[.18em]"><span>Lookbook 01</span><span className="text-center">{company.name}</span><span className="text-right">{location(company)}</span></nav><header className="grid gap-4 py-4 sm:grid-cols-12"><div className="min-h-[560px] bg-black/5 sm:col-span-7">{cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Logo company={company} large /></div>}</div><div className="flex flex-col justify-between border border-current/20 p-7 sm:col-span-5"><div className="flex items-center gap-2"><Logo company={company} square /><Seal company={company} /></div><div><Tag>Collection notes</Tag><h1 className="mt-5 text-6xl leading-[.9] tracking-[-.06em]">{heroTitle(company, config)}</h1><p className="mt-6 leading-7 opacity-60">{heroText(company, config)}</p></div></div></header><About company={company} config={config} className="grid gap-8 py-20 lg:grid-cols-[.2fr_1fr]" /><Jobs company={company} jobs={jobs} config={config} style="lookbook" label="Open roles" /><Contact company={company} config={config} style="lines" /><Footer company={company} config={config} preview={preview} /></Shell></ThemeFrame>;
}

function Atelier({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="editorial"><Shell width="wide"><nav className="flex h-20 items-center border-b border-current/20"><Logo company={company} square /><span className="ml-3 font-serif text-xl">Atelier {company.name}</span><Seal company={company} /><span className="ml-auto text-xs italic opacity-45">feito à mão</span></nav><header className="grid gap-10 py-16 lg:grid-cols-[.55fr_1fr]"><div><p className="font-serif text-8xl italic opacity-10">01</p><Tag>Ofício & forma</Tag><h1 className="mt-6 font-serif text-6xl leading-none sm:text-8xl">{heroTitle(company, config)}</h1><p className="mt-8 text-lg leading-8 opacity-60">{heroText(company, config)}</p></div><div className="relative"><div className="absolute inset-4 border border-current/20" /><div className="relative m-8 aspect-[4/5] overflow-hidden bg-black/5">{cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Logo company={company} large square /></div>}</div></div></header><About company={company} config={config} className="border-y border-current/20 py-20 text-3xl leading-[1.4]" /><Jobs company={company} jobs={jobs} config={config} style="atelier" label="Pessoas do atelier" /><Contact company={company} config={config} style="lines" /><Footer company={company} config={config} preview={preview} /></Shell></ThemeFrame>;
}

function ServiceTheme({ variant, company, jobs, config, preview, p }: ExtendedProps & { variant: 'pro' | 'oficio' | 'care' | 'studio' | 'local' }) {
  const s = shellStyle(config, p); const cover = coverUrl(config);
  if (variant === 'oficio') return <Oficio company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  if (variant === 'care') return <Care company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  if (variant === 'studio') return <Studio company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  if (variant === 'local') return <Local company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  return <Pro company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
}

function Pro({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="clean"><nav className="border-b border-current/10 bg-white/80"><Shell width="wide"><div className="flex h-18 items-center py-4"><Logo company={company} /><b className="ml-3">{company.name}</b><Seal company={company} /><div className="ml-auto hidden gap-6 text-xs font-bold sm:flex"><a href="#sobre">Empresa</a><a href="#vagas">Carreiras</a><a href="#contato">Contato</a></div></div></Shell></nav><Shell width="wide"><header className="grid min-h-[600px] items-center gap-10 py-14 lg:grid-cols-[1.1fr_.9fr]"><div><Tag>Serviço profissional</Tag><h1 className="mt-5 text-6xl font-black tracking-[-.055em] sm:text-8xl">{heroTitle(company, config)}</h1><p className="mt-7 max-w-2xl text-lg leading-8 opacity-60">{heroText(company, config)}</p><div className="mt-8 flex gap-3"><a href="#contato" className="rounded-lg px-5 py-3 text-sm font-bold text-white" style={{ background: s.primary }}>Fale conosco</a><a href="#vagas" className="rounded-lg border border-current/15 px-5 py-3 text-sm font-bold">Carreiras</a></div></div><VisualPanel company={company} cover={cover} s={s} label="Confiança" /></header><div className="grid border-y border-current/10 py-6 sm:grid-cols-3"><Metric label="Local" value={location(company) || 'Brasil'} /><Metric label="Vagas" value={String(jobs.length)} /><Metric label="Status" value="Ativo" /></div><About company={company} config={config} className="grid gap-8 py-20 lg:grid-cols-[.3fr_1fr]" /><Contact company={company} config={config} style="tiles" /><Jobs company={company} jobs={jobs} config={config} style="market" label="Carreiras" /><Footer company={company} config={config} preview={preview} /></Shell></ThemeFrame>;
}

function Oficio({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="technical"><Shell width="wide"><nav className="flex h-16 items-center border-b-2 border-current"><Logo company={company} square /><b className="ml-3 uppercase tracking-[.1em]">{company.name}</b><Seal company={company} /><span className="ml-auto text-[10px] uppercase tracking-[.18em] opacity-45">serviço bem feito</span></nav><header className="grid gap-0 border-x-2 border-b-2 border-current lg:grid-cols-[1.2fr_.8fr]"><div className="p-8 sm:p-12"><Tag>Ofício</Tag><h1 className="mt-6 text-6xl font-black uppercase leading-[.9] tracking-[-.055em] sm:text-8xl">{heroTitle(company, config)}</h1><p className="mt-7 max-w-xl text-lg leading-8 opacity-65">{heroText(company, config)}</p><div className="mt-10 text-sm"><b>{location(company)}</b></div></div><div className="min-h-[420px] border-t-2 border-current lg:border-l-2 lg:border-t-0">{cover ? <img src={cover} alt="" className="h-full w-full object-cover grayscale" /> : <div className="flex h-full items-center justify-center" style={{ background: s.primary }}><Building2 className="h-28 w-28 text-white/30" /></div>}</div></header><About company={company} config={config} className="border-x-2 border-b-2 border-current p-8 sm:p-12" /><Contact company={company} config={config} style="lines" /><Jobs company={company} jobs={jobs} config={config} style="board" label="Trabalhe conosco" /><Footer company={company} config={config} preview={preview} /></Shell></ThemeFrame>;
}

function Care({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="human"><Shell width="wide"><nav className="flex h-20 items-center"><Logo company={company} round /><b className="ml-3">{company.name}</b><Seal company={company} /><a href="#contato" className="ml-auto rounded-full px-4 py-2 text-xs font-bold text-white" style={{ background: s.primary }}>Contato</a></nav><header className="grid min-h-[580px] gap-10 rounded-[44px] p-8 sm:p-12 lg:grid-cols-[1fr_.8fr]" style={{ background: `linear-gradient(135deg,${s.primary}14,${s.accent}18)` }}><div className="flex flex-col justify-center"><Tag>Cuidado em primeiro lugar</Tag><h1 className="mt-6 text-6xl font-bold leading-[.95] tracking-[-.05em] sm:text-8xl">{heroTitle(company, config)}</h1><p className="mt-7 max-w-xl text-lg leading-8 opacity-60">{heroText(company, config)}</p></div><div className="relative flex items-center justify-center"><div className="h-[400px] w-[85%] overflow-hidden rounded-[48%_48%_42%_42%] bg-white/60">{cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Logo company={company} large round /></div>}</div></div></header><About company={company} config={config} className="mx-auto max-w-4xl py-20 text-center text-3xl leading-[1.45]" /><Contact company={company} config={config} style="pills" /><Jobs company={company} jobs={jobs} config={config} style="garden" label="Faça parte do cuidado" /><Footer company={company} config={config} preview={preview} /></Shell></ThemeFrame>;
}

function Studio({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="clean"><div className="p-4 sm:p-6"><div className="rounded-[34px] p-6 text-white sm:p-10" style={{ background: s.text }}><div className="flex items-center"><Logo company={company} round /><b className="ml-3">{company.name}</b><Seal company={company} inverted /><span className="ml-auto text-xs uppercase tracking-[.18em] text-white/40">creative service</span></div><header className="grid min-h-[540px] items-end gap-8 pt-16 lg:grid-cols-[1.2fr_.8fr]"><div><Tag light>Studio</Tag><h1 className="mt-5 text-7xl font-black leading-[.8] tracking-[-.07em] sm:text-9xl">{heroTitle(company, config)}</h1></div><div><p className="text-xl leading-8 text-white/60">{heroText(company, config)}</p><div className="mt-8 h-2 w-32" style={{ background: `linear-gradient(90deg,${s.primary},${s.accent})` }} /></div></header></div></div><Shell width="wide"><div className="grid gap-4 py-4 sm:grid-cols-2">{cover && <img src={cover} alt="" className="min-h-[360px] w-full rounded-[30px] object-cover sm:col-span-2" />}<About company={company} config={config} className="rounded-[30px] p-8" /><div className="rounded-[30px] p-8 text-white" style={{ background: s.primary }}><p className="text-xs uppercase tracking-[.18em] opacity-55">Open roles</p><p className="mt-4 text-7xl font-black">{jobs.length}</p></div></div><Jobs company={company} jobs={jobs} config={config} style="mosaic" label="Carreiras" /><Contact company={company} config={config} style="tiles" /><Footer company={company} config={config} preview={preview} /></Shell></ThemeFrame>;
}

function Local({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="human"><Shell width="standard"><nav className="flex h-20 items-center"><Logo company={company} round /><div className="ml-3"><b>{company.name}</b><p className="text-xs opacity-45">{location(company)}</p></div><Seal company={company} /><a href="#contato" className="ml-auto rounded-full px-4 py-2 text-xs font-bold text-white" style={{ background: s.primary }}>Chamar</a></nav><header className="grid gap-6 rounded-[36px] p-7 sm:p-10 lg:grid-cols-[1fr_.8fr]" style={{ background: s.background === '#fff8ef' ? '#fff0df' : `${s.primary}12` }}><div><Tag>Perto de você</Tag><h1 className="mt-5 text-5xl font-black tracking-[-.055em] sm:text-7xl">{heroTitle(company, config)}</h1><p className="mt-6 max-w-xl text-lg leading-8 opacity-65">{heroText(company, config)}</p><div className="mt-7 flex flex-wrap gap-2"><Chip>Atendimento local</Chip><Chip>{jobs.length} oportunidades</Chip></div></div><div className="overflow-hidden rounded-[28px] bg-white/60">{cover ? <img src={cover} alt="" className="h-full min-h-[320px] w-full object-cover" /> : <div className="flex h-full min-h-[320px] items-center justify-center"><Logo company={company} large round /></div>}</div></header><Contact company={company} config={config} style="pills" /><About company={company} config={config} className="py-16" /><Jobs company={company} jobs={jobs} config={config} style="radar" label="Quer trabalhar aqui?" /><Footer company={company} config={config} preview={preview} /></Shell></ThemeFrame>;
}

function OtherTheme({ variant, company, jobs, config, preview, p }: ExtendedProps & { variant: 'festival' | 'terra' | 'cosmos' | 'heritage' | 'mono' }) {
  const s = shellStyle(config, p); const cover = coverUrl(config);
  if (variant === 'terra') return <Terra company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  if (variant === 'cosmos') return <Cosmos company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  if (variant === 'heritage') return <Heritage company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  if (variant === 'mono') return <Mono company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
  return <Festival company={company} jobs={jobs} config={config} preview={preview} s={s} cover={cover} />;
}

function Festival({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="human"><div className="overflow-hidden"><div className="rotate-[-1deg] border-y-4 border-black py-3 text-center text-xl font-black uppercase tracking-[.12em]" style={{ background: s.accent }}>IDEIAS • CULTURA • GENTE • EXPERIÊNCIAS • IDEIAS • CULTURA • GENTE</div></div><div className="p-4 sm:p-6"><header className="grid min-h-[650px] border-4 border-black lg:grid-cols-[1.2fr_.8fr]"><div className="p-7 sm:p-12"><div className="flex items-center gap-3"><Logo company={company} square /><Seal company={company} /></div><Tag>Festival mode</Tag><h1 className="mt-6 text-7xl font-black uppercase leading-[.75] tracking-[-.07em] sm:text-9xl">{heroTitle(company, config)}</h1><p className="mt-8 max-w-xl text-xl font-bold leading-8">{heroText(company, config)}</p></div><div className="min-h-[360px] border-t-4 border-black lg:border-l-4 lg:border-t-0">{cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center" style={{ background: s.primary }}><Star className="h-36 w-36 text-white/30" /></div>}</div></header></div><Shell width="wide"><Jobs company={company} jobs={jobs} config={config} style="street" label="Open calls" /><About company={company} config={config} className="border-y-4 border-current py-16 text-3xl font-black" /><Contact company={company} config={config} style="tiles" /><Footer company={company} config={config} preview={preview} /></Shell></ThemeFrame>;
}

function Terra({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="editorial"><Shell width="wide"><nav className="flex h-20 items-center"><Logo company={company} round /><span className="ml-3 font-serif text-xl">{company.name}</span><Seal company={company} /><span className="ml-auto text-xs uppercase tracking-[.16em] opacity-45">raiz & futuro</span></nav><header className="grid gap-8 rounded-[48px] p-8 sm:p-12 lg:grid-cols-[.9fr_1.1fr]" style={{ background: `${s.primary}18` }}><div className="flex flex-col justify-center"><Tag>Terra</Tag><h1 className="mt-6 font-serif text-6xl leading-[.95] sm:text-8xl">{heroTitle(company, config)}</h1><p className="mt-7 max-w-xl text-lg leading-8 opacity-65">{heroText(company, config)}</p></div><div className="aspect-[4/3] overflow-hidden rounded-[46%_54%_42%_58%] bg-white/50">{cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Logo company={company} large round /></div>}</div></header><About company={company} config={config} className="grid gap-10 py-20 lg:grid-cols-[.3fr_1fr] text-2xl" /><Jobs company={company} jobs={jobs} config={config} style="garden" /><Contact company={company} config={config} style="pills" /><Footer company={company} config={config} preview={preview} /></Shell></ThemeFrame>;
}

function Cosmos({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="technical"><div className="relative overflow-hidden"><div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 80% 10%,${s.primary}66,transparent 28%),radial-gradient(circle at 20% 30%,${s.accent}44,transparent 24%)` }} /><Shell width="wide"><nav className="relative z-10 flex h-16 items-center border-b border-white/10"><Logo company={company} /><b className="ml-3 text-xs uppercase tracking-[.16em]">{company.name}</b><Seal company={company} inverted /><span className="ml-auto text-[10px] uppercase tracking-[.2em] text-white/35">SYSTEM ONLINE</span></nav><header className="relative z-10 grid min-h-[680px] items-end gap-10 py-16 lg:grid-cols-[1fr_.7fr]"><div><Tag light>Beyond ordinary</Tag><h1 className="mt-7 text-6xl font-bold leading-[.85] tracking-[-.07em] text-white sm:text-9xl">{heroTitle(company, config)}</h1><p className="mt-8 max-w-2xl text-lg leading-8 text-white/50">{heroText(company, config)}</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"><div className="aspect-video overflow-hidden rounded-xl bg-black/30">{cover ? <img src={cover} alt="" className="h-full w-full object-cover opacity-75" /> : <div className="flex h-full items-center justify-center"><Sparkles className="h-20 w-20 text-white/20" /></div>}</div><div className="mt-5 grid grid-cols-2 gap-4 text-xs text-white/45"><span>LOCATION<br/><b className="text-white/80">{location(company)}</b></span><span>OPEN JOBS<br/><b className="text-white/80">{jobs.length}</b></span></div></div></header></Shell></div><Shell width="wide"><Jobs company={company} jobs={jobs} config={config} style="board" /><About company={company} config={config} className="border-t border-white/10 py-20 text-white" /><Contact company={company} config={config} style="dark" /><Footer company={company} config={config} preview={preview} dark /></Shell></ThemeFrame>;
}

function Heritage({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="editorial"><Shell width="wide"><div className="m-4 border border-current/25 p-4 sm:m-8 sm:p-8"><nav className="flex items-center justify-center border-b border-current/20 pb-5"><div className="text-center"><div className="flex justify-center gap-2"><Logo company={company} square /><Seal company={company} /></div><p className="mt-3 text-xs uppercase tracking-[.24em]">{company.name}</p></div></nav><header className="py-20 text-center"><Tag>Established</Tag><h1 className="mx-auto mt-7 max-w-5xl font-serif text-6xl leading-none sm:text-8xl">{heroTitle(company, config)}</h1><p className="mx-auto mt-8 max-w-2xl text-lg leading-8 opacity-60">{heroText(company, config)}</p>{cover && <div className="mx-auto mt-14 max-w-4xl border border-current/20 p-3"><img src={cover} alt="" className="aspect-[16/9] w-full object-cover sepia-[.2]" /></div>}</header><About company={company} config={config} className="mx-auto max-w-4xl border-y border-current/20 py-16 text-center text-2xl leading-10" /><Jobs company={company} jobs={jobs} config={config} style="newspaper" /><Contact company={company} config={config} style="lines" /><Footer company={company} config={config} preview={preview} /></div></Shell></ThemeFrame>;
}

function Mono({ company, jobs, config, preview, s, cover }: LayoutProps) {
  return <ThemeFrame s={s} typography="clean"><Shell width="wide"><nav className="flex h-20 items-center border-b border-black"><b className="text-sm uppercase tracking-[.18em]">{company.name}</b><Seal company={company} /><div className="ml-auto flex gap-6 text-xs"><a href="#sobre">About</a><a href="#vagas">Jobs</a></div></nav><header className="grid min-h-[620px] items-end gap-8 border-b border-black py-14 lg:grid-cols-[1.2fr_.8fr]"><div><h1 className="text-7xl font-medium leading-[.82] tracking-[-.07em] sm:text-9xl">{heroTitle(company, config)}</h1></div><div><p className="text-lg leading-8">{heroText(company, config)}</p><p className="mt-7 text-xs uppercase tracking-[.16em] opacity-45">{location(company)}</p></div></header>{cover && <img src={cover} alt="" className="mt-8 max-h-[620px] w-full object-cover grayscale" />}<About company={company} config={config} className="grid gap-8 border-b border-black py-20 lg:grid-cols-[.25fr_1fr]" /><Jobs company={company} jobs={jobs} config={config} style="mono" /><Contact company={company} config={config} style="lines" /><Footer company={company} config={config} preview={preview} /></Shell></ThemeFrame>;
}

type ShellVisual = { primary: string; accent: string; background: string; text: string; style: React.CSSProperties };
type LayoutProps = ThemeProps & { s: ShellVisual; cover: string };

function shellStyle(config: CompanyPageConfig, p: ExtendedThemePreset): ShellVisual {
  const primary = config.theme?.primary || p.theme.primary;
  const accent = config.theme?.accent || p.theme.accent;
  const background = config.theme?.background || p.theme.background;
  const text = config.theme?.text || p.theme.text;
  const corners = config.branding?.corners || p.branding.corners;
  const radius = corners === 'square' ? '0px' : corners === 'round' ? '36px' : '18px';
  return { primary, accent, background, text, style: { '--brand': primary, '--accent': accent, '--paper': background, '--ink': text, '--radius': radius } as React.CSSProperties };
}

function ThemeFrame({ s, typography = 'clean', children }: { s: ShellVisual; typography?: CompanyTypography; children: React.ReactNode }) {
  const family = typography === 'editorial' ? 'font-serif' : typography === 'technical' ? 'font-mono' : 'font-sans';
  return <div className={`${family} min-h-screen`} style={{ ...s.style, background: s.background, color: s.text }}>{children}</div>;
}

function Shell({ width = 'wide', children }: { width?: CompanyPageWidth; children: React.ReactNode }) {
  const cls = width === 'full' ? 'max-w-none' : width === 'compact' ? 'max-w-4xl' : width === 'standard' ? 'max-w-6xl' : 'max-w-[1380px]';
  return <div className={`mx-auto w-full ${cls} px-5 sm:px-8`}>{children}</div>;
}

function heroTitle(company: PublicCompanyLike, config: CompanyPageConfig) { return config.hero?.title || company.name || 'Sua empresa'; }
function heroText(company: PublicCompanyLike, config: CompanyPageConfig) { return config.hero?.subtitle || config.about?.text || company.description || ''; }
function coverUrl(config: CompanyPageConfig) { return config.cover?.enabled && config.cover?.url ? config.cover.url : ''; }
function location(company: PublicCompanyLike) { return company.address || company.cityState || [company.city, company.state].filter(Boolean).join(', '); }
function verified(company: PublicCompanyLike) { return Boolean(company.isVerified || company.verificationStatus === 'VERIFIED'); }
function url(value?: string) { const raw = String(value || '').trim(); return raw ? (/^(https?:|mailto:|tel:)/i.test(raw) ? raw : `https://${raw}`) : ''; }
function jobHref(job: PublicJobLike) { return job.slug ? `/vagas/${encodeURIComponent(job.slug)}` : '/vagas'; }

function Logo({ company, large = false, round = false, square = false }: { company: PublicCompanyLike; large?: boolean; round?: boolean; square?: boolean }) {
  const size = large ? 'h-20 w-20 sm:h-24 sm:w-24' : 'h-10 w-10';
  const radius = square ? 'rounded-none' : round ? 'rounded-full' : 'rounded-xl';
  if (company.logoURL) return <img src={company.logoURL} alt={`Logo ${company.name || ''}`} className={`${size} ${radius} shrink-0 object-contain`} />;
  return <span className={`${size} ${radius} flex shrink-0 items-center justify-center border border-current/15`}><Building2 className="h-5 w-5 opacity-40" /></span>;
}

function Seal({ company, inverted = false }: { company: PublicCompanyLike; inverted?: boolean }) {
  if (!verified(company)) return null;
  return <span title="Empresa verificada pelo PiraNegócios" aria-label="Empresa verificada pelo PiraNegócios" className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full" style={{ color: inverted ? '#fff' : '#059669', background: inverted ? 'rgba(255,255,255,.12)' : 'rgba(16,185,129,.10)' }}><BadgeCheck className="h-5 w-5" /></span>;
}

function Tag({ children, light = false }: { children: React.ReactNode; light?: boolean }) { return <p className={`text-[10px] font-black uppercase tracking-[.22em] ${light ? 'text-white/55' : 'opacity-45'}`}>{children}</p>; }
function Chip({ children }: { children: React.ReactNode }) { return <span className="rounded-full border border-current/15 px-3 py-1.5 text-xs font-semibold opacity-65">{children}</span>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="p-4"><p className="text-[10px] uppercase tracking-[.18em] opacity-40">{label}</p><p className="mt-2 text-lg font-bold">{value}</p></div>; }

function VisualPanel({ company, cover, s, label }: { company: PublicCompanyLike; cover: string; s: ShellVisual; label: string }) {
  return <div className="relative min-h-[420px] overflow-hidden rounded-[var(--radius)] bg-white/60"><div className="absolute inset-4 rotate-2 rounded-[var(--radius)] opacity-30" style={{ background: `linear-gradient(135deg,${s.primary},${s.accent})` }} />{cover ? <img src={cover} alt="" className="relative h-full min-h-[420px] w-full -rotate-1 object-cover" /> : <div className="relative flex min-h-[420px] flex-col justify-between p-8"><Logo company={company} large /><div><Tag>{label}</Tag><p className="mt-3 text-3xl font-black">{company.name}</p></div></div>}</div>;
}

function About({ company, config, className = '' }: { company: PublicCompanyLike; config: CompanyPageConfig; className?: string }) {
  const text = config.about?.text || company.description;
  if (!text || sectionDisabled(config, 'about')) return null;
  return <section id="sobre" className={className}><div><Tag>{config.about?.title || 'Sobre'}</Tag><p className="mt-5 max-w-5xl text-xl leading-8 opacity-75">{text}</p></div></section>;
}

function Jobs({ jobs, config, style, label }: { company: PublicCompanyLike; jobs: PublicJobLike[]; config: CompanyPageConfig; style: string; label?: string }) {
  const title = label || config.jobs?.title || 'Oportunidades';
  const intro = config.jobs?.intro || 'Conheça as oportunidades abertas.';
  const dark = style === 'board' || style === 'brasa';
  return <section id="vagas" className="py-16 sm:py-20"><div className="flex flex-wrap items-end justify-between gap-6"><div><Tag light={dark}>{title}</Tag><h2 className="mt-3 text-4xl font-black tracking-[-.045em] sm:text-6xl">{jobs.length ? `${jobs.length} ${jobs.length === 1 ? 'oportunidade' : 'oportunidades'}` : 'Novas oportunidades em breve'}</h2></div><p className="max-w-md text-sm leading-6 opacity-55">{intro}</p></div>{!jobs.length ? <div className="mt-10 border-y border-current/15 py-10 text-sm opacity-50">Nenhuma vaga aberta neste momento.</div> : <JobCollection jobs={jobs} style={style} />}</section>;
}

function JobCollection({ jobs, style }: { jobs: PublicJobLike[]; style: string }) {
  if (['newspaper','menu','fine','lookbook','atelier','mono','board','radar'].includes(style)) return <div className="mt-10 divide-y divide-current/15">{jobs.map((job,index) => <Link key={job.id || job.slug || job.title || index} to={jobHref(job)} className="group grid gap-3 py-6 sm:grid-cols-[60px_1fr_auto] sm:items-center"><span className="text-xs font-bold opacity-30">{String(index+1).padStart(2,'0')}</span><div><h3 className="text-xl font-bold tracking-[-.025em]">{job.title || 'Oportunidade'}</h3><JobMeta job={job} /></div><ArrowRight className="h-5 w-5 opacity-30 transition group-hover:translate-x-1 group-hover:opacity-100" /></Link>)}</div>;
  const cardClass = style === 'street' || style === 'diner' ? 'border-4 border-current p-6 min-h-[220px]' : style === 'mosaic' ? 'rounded-[28px] p-7 min-h-[220px]' : 'rounded-[var(--radius)] border border-current/15 p-6 min-h-[200px]';
  return <div className="mt-10 grid gap-4 md:grid-cols-2">{jobs.map((job,index) => <Link key={job.id || job.slug || job.title || index} to={jobHref(job)} className={`group ${cardClass}`} style={style === 'mosaic' && index % 3 === 0 ? { background: 'var(--brand)', color: '#fff' } : undefined}><div className="flex justify-between"><span className="text-[10px] font-black uppercase tracking-[.16em] opacity-40">#{String(index+1).padStart(2,'0')}</span><ExternalLink className="h-4 w-4 opacity-30 group-hover:opacity-100" /></div><h3 className="mt-10 text-2xl font-black tracking-[-.035em]">{job.title || 'Oportunidade'}</h3><JobMeta job={job} /></Link>)}</div>;
}

function JobMeta({ job }: { job: PublicJobLike }) {
  const loc = job.location || [job.city, job.state].filter(Boolean).join(', ') || 'Local a combinar';
  return <p className="mt-2 text-sm opacity-50">{loc}{job.workModel ? ` · ${job.workModel}` : ''}{job.salary ? ` · ${job.salary}` : ''}</p>;
}

function contactData(company: PublicCompanyLike, config: CompanyPageConfig) {
  const phone = config.contacts?.phone || company.phone;
  const whatsapp = config.contacts?.whatsapp;
  const email = config.contacts?.email;
  const website = config.contacts?.website || company.website;
  return [
    phone && { label: 'Telefone', value: phone, href: `tel:${phone.replace(/\D/g,'')}`, icon: <Phone className="h-4 w-4" /> },
    whatsapp && { label: 'WhatsApp', value: whatsapp, href: `https://wa.me/55${whatsapp.replace(/\D/g,'')}`, icon: <Phone className="h-4 w-4" /> },
    email && { label: 'E-mail', value: email, href: `mailto:${email}`, icon: <Mail className="h-4 w-4" /> },
    website && { label: 'Site', value: website, href: url(website), icon: <Globe className="h-4 w-4" /> },
    location(company) && { label: 'Endereço', value: location(company), href: '', icon: <MapPin className="h-4 w-4" /> },
  ].filter(Boolean) as Array<{ label: string; value: string; href: string; icon: React.ReactNode }>;
}

function Contact({ company, config, style }: { company: PublicCompanyLike; config: CompanyPageConfig; style: 'tiles' | 'lines' | 'pills' | 'dark' }) {
  if (sectionDisabled(config, 'contact')) return null;
  const items = contactData(company, config); if (!items.length) return null;
  const dark = style === 'dark';
  const wrap = style === 'tiles' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3' : style === 'pills' ? 'flex flex-wrap gap-3' : 'grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3';
  return <section id="contato" className={`py-14 ${dark ? 'border-t border-white/10' : 'border-t border-current/15'}`}><Tag light={dark}>Contato</Tag><div className={`mt-7 ${wrap}`}>{items.map((item) => <a key={item.label} href={item.href || undefined} target={item.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className={`${style === 'tiles' ? 'rounded-[var(--radius)] border border-current/15 p-5' : style === 'pills' ? 'rounded-full border border-current/15 px-5 py-3' : 'border-b border-current/15 pb-4'} block`}><div className="flex items-center gap-2 text-[10px] uppercase tracking-[.16em] opacity-40">{item.icon}{item.label}</div><div className="mt-2 font-semibold">{item.value}</div></a>)}</div><Social company={company} config={config} dark={dark} /></section>;
}

function Social({ company, config, dark }: { company: PublicCompanyLike; config: CompanyPageConfig; dark?: boolean }) {
  if (sectionDisabled(config, 'socials')) return null;
  const items = [
    ['Instagram', config.socials?.instagram || company.socialInstagram, <Instagram className="h-4 w-4" />],
    ['LinkedIn', config.socials?.linkedin || company.socialLinkedin, <Linkedin className="h-4 w-4" />],
    ['Facebook', config.socials?.facebook || company.socialFacebook, <Facebook className="h-4 w-4" />],
    ['YouTube', config.socials?.youtube, <Youtube className="h-4 w-4" />],
    ['TikTok', config.socials?.tiktok, <Music2 className="h-4 w-4" />],
  ].filter((item) => Boolean(item[1])) as Array<[string,string,React.ReactNode]>;
  if (!items.length) return null;
  return <div className="mt-8 flex flex-wrap gap-4 text-sm">{items.map(([label,href,icon]) => <a key={label} href={url(href)} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 border-b pb-1 ${dark ? 'border-white/20 text-white/55' : 'border-current/20 opacity-60'}`}>{icon}{label}</a>)}</div>;
}

function Footer({ company, config, preview, dark = false }: { company: PublicCompanyLike; config: CompanyPageConfig; preview?: boolean; dark?: boolean }) {
  return <footer className={`mt-10 flex flex-col gap-3 border-t py-6 text-xs sm:flex-row sm:justify-between ${dark ? 'border-white/10 text-white/35' : 'border-current/15 opacity-45'}`}><span>{config.footer?.text || `© ${new Date().getFullYear()} ${company.name || 'Empresa'}`}</span><Link to="/" className="underline underline-offset-4">{preview ? 'Prévia privada · ' : ''}PiraNegócios Business</Link></footer>;
}

function sectionDisabled(config: CompanyPageConfig, type: string) {
  const section = config.sections?.find((item) => item.type === type);
  return section?.enabled === false;
}
