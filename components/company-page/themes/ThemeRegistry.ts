import type { ThemeKey, ThemeTier, ThemeCategory, ThemeCatalogItem, ThemePreset, ThemePalette } from './ThemeEngine';

// ─── Theme Catalog ──────────────────────────────────────────────────────────

export const THEME_CATALOG: ThemeCatalogItem[] = [
  // ── Normal (10) ──────────────────────────────────────────────────────────
  {
    key: 'horizon', name: 'Horizon', tier: 'normal', category: 'institutional',
    eyebrow: 'Living gradient', description: 'Gradientes vivos de aurora borealis, glassmorphism, hero full-bleed com blobs animados e composição editorial arejada.',
    bestFor: 'Tecnologia, saúde, educação, startups e empresas modernas',
    palette: { primary: '#4f46e5', accent: '#22d3ee', background: '#f7f8fc', text: '#111827' },
  },
  {
    key: 'monument', name: 'Monument', tier: 'normal', category: 'institutional',
    eyebrow: 'Swiss grid', description: 'Grid suíço preciso, preto e branco com acento de cor, tipografia monospace/serif, linhas de divisão e fotos em grayscale.',
    bestFor: 'Indústria, B2B, logística, consultorias e grandes empresas',
    palette: { primary: '#18181b', accent: '#f59e0b', background: '#fafafa', text: '#09090b' },
  },
  {
    key: 'vitrine', name: 'Vitrine', tier: 'normal', category: 'commerce',
    eyebrow: 'Smart store', description: 'Loja moderna com banner de campanha, categorias visuais em carrossel, prateleiras de produto e busca integrada.',
    bestFor: 'Lojas, marcas próprias, varejo, beleza e tecnologia',
    palette: { primary: '#7c3aed', accent: '#f472b6', background: '#faf5ff', text: '#1e1b4b' },
  },
  {
    key: 'bazar', name: 'Bazar', tier: 'normal', category: 'commerce',
    eyebrow: 'Listing portal', description: 'Portal de classificados com busca central, filtros visuais, grid denso de anúncios e comparação rápida de preços.',
    bestFor: 'Imóveis, veículos, equipamentos e classificados especializados',
    palette: { primary: '#ea580c', accent: '#0ea5e9', background: '#fff7ed', text: '#1c1917' },
  },
  {
    key: 'sabor', name: 'Sabor', tier: 'normal', category: 'food',
    eyebrow: 'Taste forward', description: 'Fotografia hero dominante, cards arredondados com estilo delivery, tons quentes e CTA de contato/pedido.',
    bestFor: 'Restaurantes, cafés, padarias, delivery e food trucks',
    palette: { primary: '#dc2626', accent: '#fbbf24', background: '#fef2f2', text: '#1c1917' },
  },
  {
    key: 'oficio', name: 'Ofício', tier: 'normal', category: 'services',
    eyebrow: 'Trust first', description: 'Clean e focado em confiança, com contato em destaque, seções de serviço, depoimentos e conversão local.',
    bestFor: 'Oficinas, clínicas, salões, pet shops e serviços técnicos',
    palette: { primary: '#0d9488', accent: '#f0abfc', background: '#f0fdfa', text: '#134e4a' },
  },
  {
    key: 'atelie', name: 'Ateliê', tier: 'normal', category: 'fashion',
    eyebrow: 'Editorial gaze', description: 'Layout assimétrico tipo magazine, tipografia serif grande, imagens full-bleed e grade editorial com muito respiro.',
    bestFor: 'Moda, design, arquitetura, fotografia e marcas autorais',
    palette: { primary: '#78716c', accent: '#a16207', background: '#fafaf9', text: '#1c1917' },
  },
  {
    key: 'neon', name: 'Neon', tier: 'normal', category: 'tech',
    eyebrow: 'Dark interface', description: 'Escuro imersivo com neon glow, grid techno, tipografia bold, job cards em estilo terminal e animações de brilho.',
    bestFor: 'Tech, games, automotivo, audiovisual e marcas premium',
    palette: { primary: '#00e5ff', accent: '#ff2bd6', background: '#050916', text: '#f7fbff' },
  },
  {
    key: 'flora', name: 'Flora', tier: 'normal', category: 'nature',
    eyebrow: 'Organic flow', description: 'Formas orgânicas, paleta terrosa, fotografia de paisagem, tipografia suave e composição sustentável.',
    bestFor: 'Turismo, rural, sustentabilidade, natureza e bem-estar',
    palette: { primary: '#4f6b50', accent: '#c8a97e', background: '#f0ebe0', text: '#2d3a2e' },
  },
  {
    key: 'pulse-ev', name: 'Pulse', tier: 'normal', category: 'events',
    eyebrow: 'Live energy', description: 'Tipografia gigante, cores vibrantes, faixas marquee animadas e composição de poster/cartaz de evento.',
    bestFor: 'Eventos, música, arte, esporte e entretenimento',
    palette: { primary: '#ff3c78', accent: '#dfff35', background: '#111111', text: '#ffffff' },
  },

  // ── Premium (5) ──────────────────────────────────────────────────────────
  {
    key: 'empire', name: 'Empire', tier: 'premium', category: 'institutional',
    eyebrow: 'Corporate luxury', description: 'Institucional de luxo com marble textures, dourado sutil, tipografia premium e seções de impacto com métricas.',
    bestFor: 'Holdings, bancos, construtoras, advocacias e empresas de prestígio',
    palette: { primary: '#1a1a2e', accent: '#c9a84c', background: '#f8f6f0', text: '#1a1a2e' },
  },
  {
    key: 'studio-pro', name: 'Studio', tier: 'premium', category: 'creative',
    eyebrow: 'Immersive creative', description: 'Estúdio criativo imersivo com camadas, parallax, tipografia viva, fundo escuro e composição experimental.',
    bestFor: 'Agências, estúdios, produtoras, designers e artistas',
    palette: { primary: '#c7ff3d', accent: '#8f5cff', background: '#0b0b0b', text: '#ffffff' },
  },
  {
    key: 'gourmet', name: 'Gourmet', tier: 'premium', category: 'food',
    eyebrow: 'Fine dining', description: 'Direção de arte silenciosa, quase cinematográfica, para experiências gastronômicas premium com menu visual.',
    bestFor: 'Alta gastronomia, wine bars, hotéis e experiências exclusivas',
    palette: { primary: '#b7a78c', accent: '#6f5944', background: '#0c0c0c', text: '#f4efe8' },
  },
  {
    key: 'runway', name: 'Runway', tier: 'premium', category: 'fashion',
    eyebrow: 'Campaign hero', description: 'Campanha full-screen com imagem dominante, tipografia que ocupa a tela e composição editorial de luxo.',
    bestFor: 'Alta moda, luxo, coleções sazonais e marcas de grife',
    palette: { primary: '#ffffff', accent: '#ff334e', background: '#050505', text: '#ffffff' },
  },
  {
    key: 'portal', name: 'Portal', tier: 'premium', category: 'commerce',
    eyebrow: 'Multi-business', description: 'Marketplace avançado com múltiplas vitrines, filtros dinâmicos, categorias expandidas e interface de discovery.',
    bestFor: 'Marketplaces, shoppings, galerias comerciais e multi-marcas',
    palette: { primary: '#2563eb', accent: '#fbbf24', background: '#f8fafc', text: '#0f172a' },
  },

  // ── Dynamic (5) ──────────────────────────────────────────────────────────
  {
    key: 'cosmos', name: 'Cosmos', tier: 'dynamic', category: 'tech',
    eyebrow: 'Universe UI', description: 'Universo escuro com estrelas animadas, parallax, interface sci-fi, coordenadas técnicas e glow effects.',
    bestFor: 'Games, inovação, tecnologia de ponta e audiovisual',
    palette: { primary: '#62d9ff', accent: '#a87cff', background: '#03050a', text: '#eaf8ff' },
  },
  {
    key: 'festival', name: 'Festival', tier: 'dynamic', category: 'events',
    eyebrow: 'Cultural playground', description: 'Composição viva com cartazes digitais, marquee scrolling, cores explosivas, recortes e movimento contínuo.',
    bestFor: 'Festivais, shows, arte urbana e entretenimento ao vivo',
    palette: { primary: '#ff6b2b', accent: '#00ff88', background: '#1a0a2e', text: '#fff5f0' },
  },
  {
    key: 'matrix', name: 'Matrix', tier: 'dynamic', category: 'tech',
    eyebrow: 'Terminal aesthetic', description: 'Estética hacker com rain effect, tipografia monospace, interface de terminal, glitch effects e dados ao vivo.',
    bestFor: 'Cybersegurança, DevOps, startups tech e empresas de dados',
    palette: { primary: '#00ff41', accent: '#ff0080', background: '#0a0a0a', text: '#00ff41' },
  },
  {
    key: 'aurora-dyn', name: 'Aurora', tier: 'dynamic', category: 'universal',
    eyebrow: 'Living color', description: 'Gradientes vivos animados com glassmorphism avançado, blur layers, cores que respiram e composição orgânica dinâmica.',
    bestFor: 'Qualquer empresa que queira uma presença digital premium e viva',
    palette: { primary: '#8b5cf6', accent: '#06b6d4', background: '#0f0f23', text: '#f5f3ff' },
  },
  {
    key: 'cinema', name: 'Cinema', tier: 'dynamic', category: 'creative',
    eyebrow: 'Cinematic storytelling', description: 'Narrativa cinematográfica com aspect ratio 21:9, transições suaves, tipografia dramática e storytelling visual.',
    bestFor: 'Produtoras, cineastas, fotógrafos e marcas de experiência',
    palette: { primary: '#fcd34d', accent: '#ef4444', background: '#0c0a09', text: '#fef3c7' },
  },
];

// ─── Category Labels ────────────────────────────────────────────────────────

export const THEME_CATEGORY_LABELS: Array<{ id: ThemeCategory; label: string; description: string }> = [
  { id: 'institutional', label: 'Institucional', description: 'Empresas, tecnologia e presença corporativa.' },
  { id: 'commerce', label: 'Comércio', description: 'Lojas, marketplaces, classificados e vitrines.' },
  { id: 'food', label: 'Gastronomia', description: 'Restaurantes, delivery, cafés e experiências.' },
  { id: 'services', label: 'Serviços', description: 'Profissionais, clínicas, oficinas e negócios locais.' },
  { id: 'fashion', label: 'Moda & Design', description: 'Moda, campanhas, coleções e editorial.' },
  { id: 'tech', label: 'Tecnologia', description: 'Tech, games, inovação e interfaces futuristas.' },
  { id: 'nature', label: 'Natureza', description: 'Turismo, sustentabilidade e bem-estar.' },
  { id: 'events', label: 'Eventos', description: 'Música, arte, esporte e entretenimento.' },
  { id: 'creative', label: 'Criativo', description: 'Agências, estúdios, produtoras e artistas.' },
  { id: 'universal', label: 'Universal', description: 'Temas versáteis para qualquer negócio.' },
];

// ─── Tier Labels ────────────────────────────────────────────────────────────

export const THEME_TIER_LABELS: Record<ThemeTier, { label: string; description: string; badge?: string }> = {
  normal: { label: 'Temas', description: 'Temas profissionais completos e estilizáveis.' },
  premium: { label: 'Premium', description: 'Temas sofisticados com design e recursos avançados.', badge: '★' },
  dynamic: { label: 'Dinâmicos', description: 'Temas com animações, efeitos e interatividade.', badge: '⚡' },
};

// ─── Presets ────────────────────────────────────────────────────────────────

export const THEME_PRESETS: Record<ThemeKey, ThemePreset> = {
  // Normal
  horizon:   p({ primary: '#4f46e5', accent: '#22d3ee', background: '#f7f8fc', text: '#111827' }, 'wide', 'clean', 'round', 'cover', 'grid', true, true),
  monument:  p({ primary: '#18181b', accent: '#f59e0b', background: '#fafafa', text: '#09090b' }, 'wide', 'technical', 'square', 'minimal', 'list', true, false),
  vitrine:   p({ primary: '#7c3aed', accent: '#f472b6', background: '#faf5ff', text: '#1e1b4b' }, 'full', 'clean', 'round', 'split', 'grid', true, false),
  bazar:     p({ primary: '#ea580c', accent: '#0ea5e9', background: '#fff7ed', text: '#1c1917' }, 'full', 'clean', 'soft', 'split', 'list', true, false),
  sabor:     p({ primary: '#dc2626', accent: '#fbbf24', background: '#fef2f2', text: '#1c1917' }, 'wide', 'human', 'round', 'cover', 'grid', true, false),
  oficio:    p({ primary: '#0d9488', accent: '#f0abfc', background: '#f0fdfa', text: '#134e4a' }, 'wide', 'clean', 'soft', 'split', 'compact', true, false),
  atelie:    p({ primary: '#78716c', accent: '#a16207', background: '#fafaf9', text: '#1c1917' }, 'wide', 'editorial', 'square', 'split', 'list', true, false),
  neon:      p({ primary: '#00e5ff', accent: '#ff2bd6', background: '#050916', text: '#f7fbff' }, 'wide', 'technical', 'square', 'split', 'list', true, true),
  flora:     p({ primary: '#4f6b50', accent: '#c8a97e', background: '#f0ebe0', text: '#2d3a2e' }, 'wide', 'editorial', 'soft', 'cover', 'list', true, false),
  'pulse-ev':p({ primary: '#ff3c78', accent: '#dfff35', background: '#111111', text: '#ffffff' }, 'full', 'human', 'square', 'cover', 'grid', true, true),
  // Premium
  empire:    p({ primary: '#1a1a2e', accent: '#c9a84c', background: '#f8f6f0', text: '#1a1a2e' }, 'wide', 'editorial', 'square', 'cover', 'list', true, false),
  'studio-pro':p({ primary: '#c7ff3d', accent: '#8f5cff', background: '#0b0b0b', text: '#ffffff' }, 'full', 'clean', 'square', 'cover', 'grid', true, true),
  gourmet:   p({ primary: '#b7a78c', accent: '#6f5944', background: '#0c0c0c', text: '#f4efe8' }, 'wide', 'editorial', 'square', 'cover', 'list', true, true),
  runway:    p({ primary: '#ffffff', accent: '#ff334e', background: '#050505', text: '#ffffff' }, 'full', 'clean', 'square', 'cover', 'list', true, true),
  portal:    p({ primary: '#2563eb', accent: '#fbbf24', background: '#f8fafc', text: '#0f172a' }, 'full', 'clean', 'round', 'split', 'grid', true, false),
  // Dynamic
  cosmos:    p({ primary: '#62d9ff', accent: '#a87cff', background: '#03050a', text: '#eaf8ff' }, 'full', 'technical', 'square', 'cover', 'compact', true, true),
  festival:  p({ primary: '#ff6b2b', accent: '#00ff88', background: '#1a0a2e', text: '#fff5f0' }, 'full', 'human', 'square', 'cover', 'grid', true, true),
  matrix:    p({ primary: '#00ff41', accent: '#ff0080', background: '#0a0a0a', text: '#00ff41' }, 'full', 'technical', 'square', 'minimal', 'compact', true, false),
  'aurora-dyn':p({ primary: '#8b5cf6', accent: '#06b6d4', background: '#0f0f23', text: '#f5f3ff' }, 'full', 'clean', 'round', 'cover', 'grid', true, true),
  cinema:    p({ primary: '#fcd34d', accent: '#ef4444', background: '#0c0a09', text: '#fef3c7' }, 'full', 'editorial', 'square', 'cover', 'list', true, true),
};

function p(
  palette: ThemePalette,
  width: ThemePreset['width'],
  typography: ThemePreset['typography'],
  corners: ThemePreset['corners'],
  heroLayout: ThemePreset['heroLayout'],
  jobsLayout: ThemePreset['jobsLayout'],
  navSticky: boolean,
  navTransparent: boolean,
): ThemePreset {
  return { palette, width, typography, corners, logoSize: 'medium', heroLayout, jobsLayout, navSticky, navTransparent };
}

// ─── Migration Map (old theme key → new theme key) ─────────────────────────

export const THEME_MIGRATION_MAP: Record<string, ThemeKey> = {
  // Old institutional
  aurora: 'horizon', atlas: 'monument', pulse: 'neon', canvas: 'aurora-dyn', noir: 'oficio',
  institucional: 'monument', 'institucional-pro': 'empire', editorial: 'atelie',
  // Old commerce
  loja: 'vitrine', vitrine: 'vitrine', marketplace: 'portal', catalogo: 'vitrine',
  'classificados-pro': 'bazar',
  // Old classifieds
  mercado: 'bazar', gazeta: 'bazar', mosaico: 'vitrine', radar: 'bazar', pregao: 'bazar',
  // Old food
  bistro: 'sabor', brasa: 'gourmet', jardim: 'flora', diner: 'sabor', degustacao: 'gourmet',
  // Old fashion
  runway: 'runway', street: 'festival', boutique: 'atelie', lookbook: 'atelie', atelier: 'atelie',
  // Old services
  pro: 'empire', oficio: 'oficio', care: 'oficio', studio: 'studio-pro', local: 'oficio',
  'servicos-pro': 'oficio',
  // Old other
  festival: 'festival', terra: 'flora', cosmos: 'cosmos', heritage: 'monument', mono: 'monument',
  // Direct matches
  essencial: 'horizon',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export function resolveThemeKey(rawKey?: string | null): ThemeKey {
  const key = String(rawKey || 'horizon').toLowerCase();
  if (key in THEME_PRESETS) return key as ThemeKey;
  if (key in THEME_MIGRATION_MAP) return THEME_MIGRATION_MAP[key];
  return 'horizon';
}

export function getThemePreset(key: ThemeKey): ThemePreset {
  return THEME_PRESETS[key] || THEME_PRESETS.horizon;
}

export function getThemeCatalogItem(key: ThemeKey): ThemeCatalogItem | undefined {
  return THEME_CATALOG.find(t => t.key === key);
}

export function isCommerceTheme(key: ThemeKey): boolean {
  return key === 'vitrine' || key === 'bazar' || key === 'portal';
}

export function applyThemePreset(config: any, key: ThemeKey): any {
  const preset = getThemePreset(key);
  return {
    ...config,
    templateKey: key,
    width: preset.width,
    theme: { ...(config.theme || {}), ...preset.palette },
    branding: {
      ...(config.branding || {}),
      typography: preset.typography,
      logoSize: preset.logoSize,
      corners: preset.corners,
    },
    hero: { ...(config.hero || {}), layout: preset.heroLayout },
    jobs: { ...(config.jobs || {}), layout: preset.jobsLayout },
    navigation: {
      ...(config.navigation || {}),
      sticky: preset.navSticky,
      transparent: preset.navTransparent,
    },
  };
}
