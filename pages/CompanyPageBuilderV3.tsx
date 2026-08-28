import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Code2,
  Eye,
  GripVertical,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  Monitor,
  Palette,
  Plus,
  Save,
  Send,
  Settings2,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import {
  COMPANY_PAGE_TEMPLATES,
  CompanyPageConfig,
  CompanyPageSection,
  CompanySiteRenderer,
  PublicCompanyLike,
  PublicJobLike,
  applyCompanyThemePreset,
} from '../components/company-page/CompanySiteRenderer';
import type { CompanyPageCategoryLink } from '../components/company-page/CompanyPageExtensions';
import { getCompanyThemeCapabilities, themeSupports } from '../components/company-page/CompanyThemeCapabilities';

type Panel = 'themes' | 'sections' | 'style' | 'content' | 'advanced';

const SECTION_META: Record<string, { label: string; description: string }> = {
  identity: { label: 'Identidade', description: 'Nome, logo e apresentação principal.' },
  categories: { label: 'Categorias', description: 'Departamentos, coleções ou atalhos. Podem usar imagem, círculos, cards ou chips.' },
  classifieds: { label: 'Produtos e serviços', description: 'Anúncios publicados pela empresa para aparecer na página. Produtos e serviços vêm dos Classificados.' },
  about: { label: 'Sobre', description: 'História, proposta e diferenciais da empresa.' },
  jobs: { label: 'Vagas', description: 'Oportunidades de trabalho publicadas pela empresa.' },
  contact: { label: 'Contato', description: 'Telefone, WhatsApp, e-mail, site e endereço.' },
  socials: { label: 'Redes sociais', description: 'Instagram, LinkedIn, Facebook e outros canais.' },
  legal: { label: 'Termos e privacidade', description: 'Textos jurídicos opcionais da empresa.' },
};

const ALL_SECTION_TYPES = Object.keys(SECTION_META);
const DEFAULT_CATEGORIES: CompanyPageCategoryLink[] = [
  { id: 'sobre', label: 'Sobre', href: '#sobre' },
  { id: 'contato', label: 'Contato', href: '#contato' },
];

function initialSections(config: CompanyPageConfig) {
  const capabilities = getCompanyThemeCapabilities(config.templateKey);
  const saved = Array.isArray(config.sections) ? config.sections.map((section) => ({ ...section })) : [];
  const result = saved.length
    ? saved
    : capabilities.recommendedSections.map((type) => ({ id: type, type, enabled: true, locked: type === 'identity' }));
  if (!result.some((section) => section.type === 'identity')) {
    result.unshift({ id: 'identity', type: 'identity', enabled: true, locked: true });
  }
  return result.map((section) => section.type === 'identity' ? { ...section, enabled: true, locked: true } : section);
}

function migrateLegacyCommerceSections(config: CompanyPageConfig, legacyVersion: number) {
  const sections = initialSections(config);
  if (legacyVersion >= 6 || !themeSupports(config.templateKey, 'commerceLayout')) return sections;
  if (sections.some((section) => section.type === 'classifieds')) return sections;
  const categoriesIndex = sections.findIndex((section) => section.type === 'categories');
  const insertAt = categoriesIndex >= 0 ? categoriesIndex + 1 : Math.min(1, sections.length);
  const next = [...sections];
  next.splice(insertAt, 0, { id: 'classifieds', type: 'classifieds', enabled: true });
  return next;
}

function hydrate(raw: CompanyPageConfig | null | undefined, company: PublicCompanyLike): CompanyPageConfig {
  const config = raw || {};
  const legacyVersion = Number(config.version || 0);
  const templateKey = config.templateKey || 'aurora';
  const commerce = themeSupports(templateKey, 'commerceLayout');
  const configuredCategories = Array.isArray(config.categories?.items) ? config.categories.items : null;

  const next: CompanyPageConfig = {
    ...config,
    version: Math.max(6, legacyVersion || 6),
    editorMode: config.editorMode === 'code' ? 'code' : 'visual',
    templateKey,
    width: config.width || 'wide',
    theme: {
      primary: config.theme?.primary || '#111111',
      accent: config.theme?.accent || '#555555',
      background: config.theme?.background || '#ffffff',
      text: config.theme?.text || '#171717',
    },
    branding: {
      typography: config.branding?.typography || 'clean',
      logoSize: config.branding?.logoSize || 'medium',
      corners: config.branding?.corners || 'soft',
    },
    navigation: {
      enabled: config.navigation?.enabled !== false,
      sticky: config.navigation?.sticky !== false,
      transparent: Boolean(config.navigation?.transparent),
      jobsLabel: config.navigation?.jobsLabel || 'Vagas',
    },
    hero: {
      ...config.hero,
      layout: config.hero?.layout || 'split',
      eyebrow: config.hero?.eyebrow || '',
      title: config.hero?.title || company.name || '',
      subtitle: config.hero?.subtitle || '',
      jobsLabel: config.hero?.jobsLabel || 'Ver oportunidades',
      width: config.hero?.width || config.width || 'wide',
      contentWidth: config.hero?.contentWidth || 'wide',
      contentMode: config.hero?.contentMode || 'independent',
      maxHeight: Number(config.hero?.maxHeight || 0),
    },
    categories: {
      enabled: config.categories?.enabled !== false,
      title: config.categories?.title || (commerce ? 'Categorias' : 'Explore'),
      width: config.categories?.width || config.width || 'wide',
      contentWidth: config.categories?.contentWidth || config.width || 'wide',
      contentMode: config.categories?.contentMode || 'section',
      items: configuredCategories ?? (commerce ? [] : DEFAULT_CATEGORIES),
    },
    storefront: {
      promoText: config.storefront?.promoText || '',
      secondaryPromoText: config.storefront?.secondaryPromoText || '',
      showSearch: config.storefront?.showSearch,
      searchPlaceholder: config.storefront?.searchPlaceholder || 'O que você procura?',
      bannerStyle: config.storefront?.bannerStyle,
      categoryStyle: config.storefront?.categoryStyle,
      productsLayout: config.storefront?.productsLayout,
      cardsPerRow: config.storefront?.cardsPerRow || 4,
      featuredTitle: config.storefront?.featuredTitle || '',
      showProducts: config.storefront?.showProducts !== false,
      showServices: config.storefront?.showServices !== false,
    },
    jobs: {
      title: config.jobs?.title || 'Oportunidades',
      intro: config.jobs?.intro || '',
      layout: config.jobs?.layout || 'grid',
    },
    footer: { text: config.footer?.text || '' },
    cover: {
      enabled: Boolean(config.cover?.enabled),
      url: config.cover?.url || '',
      height: config.cover?.height || 'medium',
      position: config.cover?.position || 'center',
      overlay: Number(config.cover?.overlay ?? 28),
    },
    about: {
      title: config.about?.title || 'Sobre a empresa',
      text: config.about?.text || (company as any).description || '',
    },
    contacts: {
      phone: config.contacts?.phone || (company as any).phone || '',
      secondaryPhone: config.contacts?.secondaryPhone || '',
      whatsapp: config.contacts?.whatsapp || '',
      email: config.contacts?.email || '',
      website: config.contacts?.website || (company as any).website || '',
    },
    socials: {
      instagram: config.socials?.instagram || (company as any).socialInstagram || '',
      linkedin: config.socials?.linkedin || (company as any).socialLinkedin || '',
      facebook: config.socials?.facebook || (company as any).socialFacebook || '',
      youtube: config.socials?.youtube || '',
      tiktok: config.socials?.tiktok || '',
    },
    legal: {
      termsEnabled: Boolean(config.legal?.termsEnabled),
      termsTitle: config.legal?.termsTitle || 'Termos de uso',
      termsBody: config.legal?.termsBody || '',
      privacyEnabled: Boolean(config.legal?.privacyEnabled),
      privacyTitle: config.legal?.privacyTitle || 'Política de privacidade',
      privacyBody: config.legal?.privacyBody || '',
    },
  };

  next.sections = migrateLegacyCommerceSections(next, legacyVersion);
  return next;
}

function merge(config: CompanyPageConfig, key: keyof CompanyPageConfig, values: Record<string, unknown>) {
  return {
    ...config,
    [key]: {
      ...((config[key] as Record<string, unknown> | undefined) || {}),
      ...values,
    },
  } as CompanyPageConfig;
}

export function CompanyPageBuilderV3() {
  const { profile } = useAuth();
  const companyId = profile?.companyId;
  const [company, setCompany] = useState<PublicCompanyLike | null>(null);
  const [jobs, setJobs] = useState<PublicJobLike[]>([]);
  const [classifiedsCount, setClassifiedsCount] = useState(0);
  const [config, setConfig] = useState<CompanyPageConfig | null>(null);
  const [panel, setPanel] = useState<Panel>('themes');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const [companyResponse, pageResponse] = await Promise.all([
          api.get(`/companies/${companyId}`),
          api.get(`/companies/${companyId}/page`),
        ]);
        if (!active) return;
        const nextCompany = companyResponse.data as PublicCompanyLike;
        setCompany(nextCompany);
        setConfig(hydrate(pageResponse.data?.draft, nextCompany));

        const extras = await Promise.allSettled([
          nextCompany.slug ? api.get(`/public/companies/${nextCompany.slug}`) : Promise.resolve({ data: { jobs: [] } }),
          api.get(`/classifieds/company/${companyId}/listings`),
        ]);
        if (!active) return;

        const publicCompany = extras[0].status === 'fulfilled' ? extras[0].value.data : {};
        setJobs(Array.isArray(publicCompany?.jobs) ? publicCompany.jobs : []);

        const classifiedPayload = extras[1].status === 'fulfilled' ? extras[1].value.data : {};
        const classifiedItems = Array.isArray(classifiedPayload)
          ? classifiedPayload
          : Array.isArray(classifiedPayload?.items)
            ? classifiedPayload.items
            : [];
        setClassifiedsCount(classifiedItems.length);
      } catch (requestError: any) {
        if (active) setError(requestError?.response?.data?.message || 'Não foi possível carregar Minha Página.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [companyId]);

  const sections = useMemo(() => config ? initialSections(config) : [], [config]);
  const capabilities = useMemo(() => getCompanyThemeCapabilities(config?.templateKey), [config?.templateKey]);
  const change = (next: CompanyPageConfig) => {
    setConfig(next);
    setMessage('');
    setError('');
  };

  const saveDraft = async () => {
    if (!companyId || !config || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.put(`/companies/${companyId}/page/draft`, { config });
      setConfig(hydrate(response.data?.draft || config, company || {}));
      setMessage('Rascunho salvo.');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível salvar o rascunho.');
    } finally {
      setSaving(false);
    }
  };

  const preview = async () => {
    if (!companyId || !config || previewing) return;
    setPreviewing(true);
    setError('');
    const target = window.open('', '_blank');
    try {
      const response = await api.post(`/companies/${companyId}/page/preview`, { config });
      const url = `${window.location.origin}${response.data.url}`;
      if (target) target.location.href = url;
      else window.open(url, '_blank', 'noopener,noreferrer');
    } catch (requestError: any) {
      target?.close();
      setError(requestError?.response?.data?.message || 'Não foi possível abrir a prévia.');
    } finally {
      setPreviewing(false);
    }
  };

  const publish = async () => {
    if (!companyId || !config || publishing) return;
    setPublishing(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post(`/companies/${companyId}/page/publish`, { config });
      setConfig(hydrate(response.data?.draft || config, company || {}));
      setMessage('Página publicada.');
    } catch (requestError: any) {
      const payload = requestError?.response?.data;
      const warnings = payload?.validation?.warnings || payload?.message?.validation?.warnings;
      setError(
        Array.isArray(warnings) && warnings.length
          ? warnings.join(' ')
          : typeof payload?.message === 'string'
            ? payload.message
            : 'A página ainda não pode ser publicada.',
      );
    } finally {
      setPublishing(false);
    }
  };

  const updateSections = (next: CompanyPageSection[]) => config && change({ ...config, sections: next });
  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    updateSections(next);
  };
  const reorderSection = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const sourceIndex = sections.findIndex((section) => section.id === sourceId);
    const targetIndex = sections.findIndex((section) => section.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...sections];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    updateSections(next);
  };
  const removeSection = (id: string) => updateSections(sections.filter((section) => section.id !== id));
  const addSection = (type: string) => updateSections([...sections, { id: `${type}-${Date.now()}`, type, enabled: true }]);
  const updateSection = (id: string, values: Partial<CompanyPageSection>) => {
    updateSections(sections.map((section) => section.id === id ? { ...section, ...values } : section));
  };

  if (loading) {
    return <div className="flex min-h-[70vh] items-center justify-center text-stone-500">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando estúdio...
    </div>;
  }

  if (!companyId || !company || !config) {
    return <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <h1 className="text-2xl font-bold">Minha Página indisponível</h1>
      <p className="mt-3 text-stone-500">Sua conta precisa estar vinculada a uma empresa.</p>
    </div>;
  }

  const missingSections = ALL_SECTION_TYPES.filter((type) => (
    type !== 'identity'
    && !sections.some((section) => section.type === type)
    && (type !== 'classifieds' || capabilities.features.commerceLayout)
  ));

  return <div className="min-h-screen bg-[#e8e7e5] text-stone-950">
    <header className="sticky top-0 z-[80] border-b border-stone-200 bg-white/95 backdrop-blur-xl">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-stone-400">Minha Página · Studio</p>
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-bold">{company.name}</h1>
            {(company as any).isVerified || (company as any).verificationStatus === 'VERIFIED'
              ? <BadgeCheck className="h-4 w-4 text-emerald-600" />
              : null}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <TopButton onClick={saveDraft} loading={saving} icon={<Save className="h-4 w-4" />}>Salvar</TopButton>
          <TopButton onClick={preview} loading={previewing} icon={<Eye className="h-4 w-4" />} secondary>Prévia</TopButton>
          <TopButton onClick={publish} loading={publishing} icon={<Send className="h-4 w-4" />} dark>Publicar</TopButton>
        </div>
      </div>
      {(message || error)
        ? <div className={`border-t px-4 py-2 text-center text-xs font-bold ${error ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
          {error || message}
        </div>
        : null}
    </header>

    <div className="grid min-h-[calc(100vh-64px)] xl:grid-cols-[440px_minmax(0,1fr)]">
      <aside className="border-r border-stone-200 bg-white">
        <div className="grid grid-cols-5 gap-1 border-b border-stone-200 p-3">
          <PanelButton active={panel === 'themes'} onClick={() => setPanel('themes')} icon={<LayoutTemplate className="h-4 w-4" />} label="Modelos" />
          <PanelButton active={panel === 'sections'} onClick={() => setPanel('sections')} icon={<Settings2 className="h-4 w-4" />} label="Seções" />
          <PanelButton active={panel === 'style'} onClick={() => setPanel('style')} icon={<Palette className="h-4 w-4" />} label="Visual" />
          <PanelButton active={panel === 'content'} onClick={() => setPanel('content')} icon={<Monitor className="h-4 w-4" />} label="Conteúdo" />
          <PanelButton active={panel === 'advanced'} onClick={() => setPanel('advanced')} icon={<Code2 className="h-4 w-4" />} label="Avançado" />
        </div>

        <div className="max-h-[calc(100vh-118px)] overflow-y-auto p-5">
          {panel === 'themes' ? <ThemesPanel config={config} onChange={change} /> : null}
          {panel === 'sections'
            ? <SectionsPanel
              sections={sections}
              missing={missingSections}
              capabilities={capabilities}
              move={moveSection}
              reorder={reorderSection}
              remove={removeSection}
              add={addSection}
              update={updateSection}
              config={config}
              onChange={change}
            />
            : null}
          {panel === 'style' ? <StylePanel config={config} onChange={change} /> : null}
          {panel === 'content'
            ? <ContentPanel
              config={config}
              onChange={change}
              jobsCount={jobs.length}
              classifiedsCount={classifiedsCount}
            />
            : null}
          {panel === 'advanced' ? <AdvancedPanel config={config} onChange={change} /> : null}
        </div>
      </aside>

      <main className="min-w-0 p-3 sm:p-5 xl:p-7">
        <div className="mb-3 flex items-center justify-between text-[10px] font-black uppercase tracking-[.16em] text-stone-500">
          <span>Prévia ao vivo</span>
          <span>{company.name}</span>
        </div>
        <div className="mx-auto h-[calc(100vh-132px)] max-w-[1600px] overflow-auto rounded-[20px] border border-black/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,.15)]">
          <CompanySiteRenderer company={company} jobs={jobs} page={config} preview />
        </div>
      </main>
    </div>
  </div>;
}

function TopButton({ children, onClick, loading, icon, secondary, dark }: {
  children: React.ReactNode;
  onClick: () => void;
  loading: boolean;
  icon: React.ReactNode;
  secondary?: boolean;
  dark?: boolean;
}) {
  return <button
    type="button"
    onClick={onClick}
    disabled={loading}
    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50 ${
      dark ? 'bg-stone-950 text-white' : secondary ? 'hidden border border-stone-200 bg-white sm:inline-flex' : 'border border-stone-200 bg-white'
    }`}
  >
    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
    {children}
  </button>;
}

function PanelButton({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return <button
    type="button"
    onClick={onClick}
    className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] font-bold ${
      active ? 'bg-stone-950 text-white' : 'text-stone-500 hover:bg-stone-100'
    }`}
  >
    {icon}{label}
  </button>;
}

function Heading({ title, text }: { title: string; text: string }) {
  return <div className="mb-5 border-b border-stone-100 pb-4">
    <h2 className="text-lg font-bold">{title}</h2>
    <p className="mt-1 text-xs leading-5 text-stone-500">{text}</p>
  </div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 mt-4 block text-[10px] font-black uppercase tracking-[.12em] text-stone-500">{children}</label>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-stone-500" />;
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="min-h-28 w-full resize-y rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-stone-500" />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-stone-500" />;
}

function Toggle({ checked, onChange, label }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm">
    <span>{label}</span>
    <span className={`h-6 w-11 rounded-full p-1 transition ${checked ? 'bg-stone-950' : 'bg-stone-200'}`}>
      <span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} />
    </span>
  </button>;
}

function ThemesPanel({ config, onChange }: {
  config: CompanyPageConfig;
  onChange: (next: CompanyPageConfig) => void;
}) {
  return <>
    <Heading
      title="Modelos de site"
      text="Os modelos mudam composição, navegação, hero, categorias, catálogo e ritmo visual. Não são apenas paletas."
    />
    <div className="space-y-1">
      {COMPANY_PAGE_TEMPLATES.map((template) => <button
        type="button"
        key={template.key}
        onClick={() => {
          const next = applyCompanyThemePreset(config, template.key);
          onChange({ ...next, version: 6, templateKey: template.key });
        }}
        className={`w-full rounded-xl px-3 py-3 text-left transition ${
          config.templateKey === template.key ? 'bg-stone-950 text-white' : 'hover:bg-stone-100'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold">{template.name}</p>
            <p className={`mt-1 text-xs leading-5 ${config.templateKey === template.key ? 'text-stone-300' : 'text-stone-500'}`}>
              {template.description}
            </p>
          </div>
          <span className={`mt-1 text-[9px] font-black uppercase tracking-widest ${
            config.templateKey === template.key ? 'text-stone-300' : 'text-stone-400'
          }`}>
            {template.eyebrow}
          </span>
        </div>
      </button>)}
    </div>
  </>;
}

function SectionsPanel({ sections, missing, capabilities, move, reorder, remove, add, update, config, onChange }: any) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  return <>
    <Heading
      title="Reordenar seções"
      text="Arraste os blocos pela alça. A ordem abaixo é exatamente a ordem no site. As setas continuam disponíveis para ajuste fino."
    />

    <div className="mb-4 rounded-2xl bg-stone-950 px-4 py-3 text-white">
      <p className="text-[10px] font-black uppercase tracking-[.16em] text-stone-400">Organizador</p>
      <p className="mt-1 text-xs leading-5 text-stone-200">Segure ⋮⋮ e arraste uma seção para cima ou para baixo.</p>
    </div>

    <div className="space-y-2">
      {sections.map((section: CompanyPageSection, index: number) => {
        const meta = SECTION_META[section.type] || { label: section.type, description: '' };
        const required = capabilities.requiredSections.includes(section.type);

        return <div
          key={section.id}
          draggable={!required}
          onDragStart={(event) => {
            if (required) return;
            setDraggedId(section.id);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', section.id);
          }}
          onDragEnd={() => setDraggedId(null)}
          onDragOver={(event) => {
            if (!required) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            const source = event.dataTransfer.getData('text/plain') || draggedId;
            if (source) reorder(source, section.id);
            setDraggedId(null);
          }}
          className={`rounded-2xl border p-3 transition ${
            draggedId === section.id
              ? 'border-stone-950 bg-stone-100 opacity-60'
              : section.enabled === false
                ? 'border-stone-200 bg-stone-50 opacity-65'
                : 'border-stone-200 bg-white'
          }`}
        >
          <div className="flex items-start gap-2">
            <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${required ? 'bg-stone-100 text-stone-300' : 'cursor-grab bg-stone-100 text-stone-500 active:cursor-grabbing'}`}>
              {required ? <span className="text-[10px] font-black">{index + 1}</span> : <GripVertical className="h-4 w-4" />}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">
                <span className="mr-2 text-[10px] font-black text-stone-400">{String(index + 1).padStart(2, '0')}</span>
                {meta.label}
                {required ? <span className="ml-2 text-[8px] uppercase tracking-widest text-stone-400">fixa</span> : null}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-stone-500">{meta.description}</p>
            </div>

            <button type="button" onClick={() => move(index, -1)} disabled={index === 0 || required} className="rounded-lg p-1.5 hover:bg-stone-100 disabled:opacity-25">
              <ArrowUp className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => move(index, 1)} disabled={index === sections.length - 1 || required} className="rounded-lg p-1.5 hover:bg-stone-100 disabled:opacity-25">
              <ArrowDown className="h-4 w-4" />
            </button>
            {!required
              ? <button type="button" onClick={() => remove(section.id)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
              </button>
              : null}
          </div>

          {!required
            ? <Toggle
              checked={section.enabled !== false}
              onChange={(enabled) => update(section.id, { enabled })}
              label={section.enabled === false ? 'Seção desativada' : 'Seção visível'}
            />
            : null}

          {section.type !== 'identity' && themeSupports(config.templateKey, 'sectionSizing')
            ? <div className="grid grid-cols-2 gap-2">
              <Select value={section.width || config.width || 'wide'} onChange={(event) => update(section.id, { width: event.target.value })}>
                <option value="compact">Compacta</option>
                <option value="standard">Padrão</option>
                <option value="wide">Larga</option>
                <option value="full">Tela inteira</option>
              </Select>
              <Select value={section.contentMode || 'section'} onChange={(event) => update(section.id, { contentMode: event.target.value })}>
                <option value="section">Dentro da seção</option>
                <option value="independent">Independente</option>
              </Select>
            </div>
            : null}
        </div>;
      })}
    </div>

    {missing.length
      ? <div className="mt-5 rounded-2xl border border-dashed border-stone-300 p-3">
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-stone-400">Adicionar seção</p>
        <div className="flex flex-wrap gap-2">
          {missing.map((type: string) => <button
            type="button"
            key={type}
            onClick={() => add(type)}
            className="inline-flex items-center gap-1 rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold hover:bg-stone-950 hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            {SECTION_META[type]?.label || type}
          </button>)}
        </div>
      </div>
      : null}

    <div className="mt-5 border-t border-stone-100 pt-4">
      <Toggle checked={config.navigation?.enabled !== false} onChange={(enabled) => onChange(merge(config, 'navigation', { enabled }))} label="Menu de navegação" />
      <Toggle checked={config.navigation?.sticky !== false} onChange={(sticky) => onChange(merge(config, 'navigation', { sticky }))} label="Menu fixo ao rolar" />
    </div>
  </>;
}

function StylePanel({ config, onChange }: {
  config: CompanyPageConfig;
  onChange: (next: CompanyPageConfig) => void;
}) {
  const commerce = themeSupports(config.templateKey, 'commerceLayout');

  return <>
    <Heading
      title={commerce ? 'Layout da loja' : 'Identidade visual'}
      text={commerce
        ? 'Aqui você controla banner, navegação de categorias e apresentação dos produtos. A estrutura-base continua própria de cada tema.'
        : 'As opções abaixo só aparecem quando fazem sentido para o motor do tema.'}
    />

    {commerce
      ? <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4" />
          <p className="text-sm font-bold">Vitrine comercial</p>
        </div>

        <Label>Estilo do banner</Label>
        <Select
          value={config.storefront?.bannerStyle || ''}
          onChange={(event) => onChange(merge(config, 'storefront', { bannerStyle: event.target.value || undefined }))}
        >
          <option value="">Padrão do tema</option>
          <option value="full">Banner de campanha</option>
          <option value="split">Banner dividido</option>
          <option value="compact">Banner compacto</option>
          <option value="editorial">Editorial</option>
        </Select>

        <Label>Categorias</Label>
        <Select
          value={config.storefront?.categoryStyle || ''}
          onChange={(event) => onChange(merge(config, 'storefront', { categoryStyle: event.target.value || undefined }))}
        >
          <option value="">Padrão do tema</option>
          <option value="image-tiles">Cards com imagem</option>
          <option value="circles">Círculos com imagem</option>
          <option value="tiles">Cards sem imagem obrigatória</option>
          <option value="chips">Chips compactos</option>
        </Select>

        <Label>Produtos e serviços</Label>
        <Select
          value={config.storefront?.productsLayout || ''}
          onChange={(event) => onChange(merge(config, 'storefront', { productsLayout: event.target.value || undefined }))}
        >
          <option value="">Padrão do tema</option>
          <option value="carousel">Carrossel horizontal</option>
          <option value="grid">Grade</option>
          <option value="masonry">Mosaico</option>
          <option value="list">Lista detalhada</option>
        </Select>

        <Label>Cards por linha</Label>
        <Select
          value={String(config.storefront?.cardsPerRow || 4)}
          onChange={(event) => onChange(merge(config, 'storefront', { cardsPerRow: Number(event.target.value) }))}
        >
          <option value="2">2 cards</option>
          <option value="3">3 cards</option>
          <option value="4">4 cards</option>
          <option value="5">5 cards</option>
        </Select>

        <div className="mt-3 border-t border-stone-200 pt-2">
          <Toggle checked={config.storefront?.showSearch !== false} onChange={(showSearch) => onChange(merge(config, 'storefront', { showSearch }))} label="Busca na loja" />
          <Toggle checked={config.storefront?.showProducts !== false} onChange={(showProducts) => onChange(merge(config, 'storefront', { showProducts }))} label="Mostrar produtos" />
          <Toggle checked={config.storefront?.showServices !== false} onChange={(showServices) => onChange(merge(config, 'storefront', { showServices }))} label="Mostrar serviços" />
        </div>
      </div>
      : null}

    {themeSupports(config.templateKey, 'palette')
      ? <>
        <Label>Cores</Label>
        <div className="grid grid-cols-2 gap-3">
          {([['Principal', 'primary'], ['Acento', 'accent'], ['Fundo', 'background'], ['Texto', 'text']] as const).map(([label, key]) => <label key={key} className="text-xs text-stone-500">
            {label}
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-stone-200 p-2">
              <input
                type="color"
                value={(config.theme as any)?.[key] || '#111111'}
                onChange={(event) => onChange(merge(config, 'theme', { [key]: event.target.value }))}
                className="h-8 w-9 rounded border-0"
              />
              <span className="text-[10px] font-mono">{(config.theme as any)?.[key]}</span>
            </div>
          </label>)}
        </div>
      </>
      : null}

    {themeSupports(config.templateKey, 'typography')
      ? <>
        <Label>Tipografia</Label>
        <Select value={config.branding?.typography || 'clean'} onChange={(event) => onChange(merge(config, 'branding', { typography: event.target.value }))}>
          <option value="clean">Limpa</option>
          <option value="editorial">Editorial</option>
          <option value="technical">Técnica</option>
          <option value="human">Humana</option>
        </Select>
      </>
      : null}

    {themeSupports(config.templateKey, 'corners')
      ? <>
        <Label>Cantos</Label>
        <Select value={config.branding?.corners || 'soft'} onChange={(event) => onChange(merge(config, 'branding', { corners: event.target.value }))}>
          <option value="square">Retos</option>
          <option value="soft">Suaves</option>
          <option value="round">Arredondados</option>
        </Select>
      </>
      : null}

    {!commerce
      ? <>
        <Label>Largura geral</Label>
        <Select value={config.width || 'wide'} onChange={(event) => onChange({ ...config, width: event.target.value as any })}>
          <option value="compact">Compacta</option>
          <option value="standard">Padrão</option>
          <option value="wide">Larga</option>
          <option value="full">Tela inteira</option>
        </Select>
      </>
      : null}

    {themeSupports(config.templateKey, 'heroLayout')
      ? <>
        <Label>Layout da capa</Label>
        <Select value={config.hero?.layout || 'split'} onChange={(event) => onChange(merge(config, 'hero', { layout: event.target.value }))}>
          <option value="split">Dividida</option>
          <option value="centered">Centralizada</option>
          <option value="cover">Imagem / impacto</option>
          <option value="minimal">Minimalista</option>
        </Select>
      </>
      : null}

    {themeSupports(config.templateKey, 'cover')
      ? <>
        <Label>Imagem de capa (URL)</Label>
        <Input
          value={config.cover?.url || ''}
          onChange={(event) => onChange(merge(config, 'cover', { url: event.target.value, enabled: Boolean(event.target.value) }))}
          placeholder="https://..."
        />
        <Toggle checked={Boolean(config.cover?.enabled)} onChange={(enabled) => onChange(merge(config, 'cover', { enabled }))} label="Usar imagem na capa" />
      </>
      : null}
  </>;
}

function CategoryEditor({ config, onChange }: {
  config: CompanyPageConfig;
  onChange: (next: CompanyPageConfig) => void;
}) {
  const items = Array.isArray(config.categories?.items) ? config.categories.items : [];

  const updateItem = (index: number, values: Partial<CompanyPageCategoryLink>) => {
    const next = items.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item);
    onChange(merge(config, 'categories', { items: next }));
  };

  const removeItem = (index: number) => {
    onChange(merge(config, 'categories', { items: items.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const addItem = () => {
    const id = `categoria-${Date.now()}`;
    onChange(merge(config, 'categories', {
      items: [...items, { id, label: 'Nova categoria', href: '#vitrine', imageUrl: '' }],
    }));
  };

  return <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
    <div className="flex items-center gap-2">
      <ImageIcon className="h-4 w-4" />
      <p className="text-sm font-bold">Categorias da loja</p>
    </div>
    <p className="mt-1 text-[11px] leading-4 text-stone-500">
      Se você não criar nenhuma, a loja monta categorias automaticamente usando os anúncios publicados.
    </p>

    <Label>Título da seção</Label>
    <Input value={config.categories?.title || ''} onChange={(event) => onChange(merge(config, 'categories', { title: event.target.value }))} />

    <div className="mt-3 space-y-3">
      {items.map((item, index) => <div key={item.id || index} className="rounded-xl border border-stone-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Categoria {index + 1}</span>
          <button type="button" onClick={() => removeItem(index)} className="rounded-lg p-1 text-red-500 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <Input value={item.label || ''} onChange={(event) => updateItem(index, { label: event.target.value })} placeholder="Nome da categoria" />
        <div className="mt-2">
          <Input value={item.imageUrl || ''} onChange={(event) => updateItem(index, { imageUrl: event.target.value })} placeholder="Imagem opcional · https://..." />
        </div>
        <div className="mt-2">
          <Input value={item.href || ''} onChange={(event) => updateItem(index, { href: event.target.value })} placeholder="#vitrine ou link" />
        </div>
      </div>)}
    </div>

    <button type="button" onClick={addItem} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold hover:bg-stone-950 hover:text-white">
      <Plus className="h-4 w-4" /> Adicionar categoria
    </button>
  </div>;
}

function ContentPanel({ config, onChange, jobsCount, classifiedsCount }: {
  config: CompanyPageConfig;
  onChange: (next: CompanyPageConfig) => void;
  jobsCount: number;
  classifiedsCount: number;
}) {
  const commerce = themeSupports(config.templateKey, 'commerceLayout');

  return <>
    <Heading title="Conteúdo" text="Textos, promoções, categorias e canais pertencem à empresa. O tema decide como apresentar." />

    {commerce
      ? <div className="rounded-2xl bg-stone-950 p-4 text-white">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4" />
          <p className="text-sm font-bold">Classificados conectados: {classifiedsCount}</p>
        </div>
        <p className="mt-1 text-[11px] leading-5 text-stone-300">
          Só aparecem aqui produtos e serviços publicados com o canal “Página da empresa”.
        </p>
      </div>
      : null}

    {commerce
      ? <>
        <Label>Faixa promocional</Label>
        <Input
          value={config.storefront?.promoText || ''}
          onChange={(event) => onChange(merge(config, 'storefront', { promoText: event.target.value }))}
          placeholder="Ex.: Frete grátis acima de R$ 199"
        />
        <Label>Segunda chamada</Label>
        <Input
          value={config.storefront?.secondaryPromoText || ''}
          onChange={(event) => onChange(merge(config, 'storefront', { secondaryPromoText: event.target.value }))}
          placeholder="Ex.: 10% no PIX"
        />
        <Label>Título da vitrine</Label>
        <Input
          value={config.storefront?.featuredTitle || ''}
          onChange={(event) => onChange(merge(config, 'storefront', { featuredTitle: event.target.value }))}
          placeholder="Ex.: Mais vendidos"
        />
        <Label>Texto da busca</Label>
        <Input
          value={config.storefront?.searchPlaceholder || ''}
          onChange={(event) => onChange(merge(config, 'storefront', { searchPlaceholder: event.target.value }))}
          placeholder="O que você procura?"
        />
        <CategoryEditor config={config} onChange={onChange} />
      </>
      : null}

    <Label>Capa · linha de apoio</Label>
    <Input value={config.hero?.eyebrow || ''} onChange={(event) => onChange(merge(config, 'hero', { eyebrow: event.target.value }))} />

    <Label>Título principal</Label>
    <Input value={config.hero?.title || ''} onChange={(event) => onChange(merge(config, 'hero', { title: event.target.value }))} />

    <Label>Subtítulo</Label>
    <Textarea value={config.hero?.subtitle || ''} onChange={(event) => onChange(merge(config, 'hero', { subtitle: event.target.value }))} />

    <Label>Sobre · título</Label>
    <Input value={config.about?.title || ''} onChange={(event) => onChange(merge(config, 'about', { title: event.target.value }))} />

    <Label>Sobre · texto</Label>
    <Textarea value={config.about?.text || ''} onChange={(event) => onChange(merge(config, 'about', { text: event.target.value }))} />

    <div className="mt-6 rounded-2xl bg-stone-50 p-3">
      <p className="text-xs font-bold">Vagas conectadas: {jobsCount}</p>
      <p className="mt-1 text-[11px] leading-4 text-stone-500">A seção pode ser removida da página sem apagar as vagas da empresa.</p>
    </div>

    <Label>Telefone</Label>
    <Input value={config.contacts?.phone || ''} onChange={(event) => onChange(merge(config, 'contacts', { phone: event.target.value }))} />

    <Label>WhatsApp</Label>
    <Input value={config.contacts?.whatsapp || ''} onChange={(event) => onChange(merge(config, 'contacts', { whatsapp: event.target.value }))} />

    <Label>E-mail</Label>
    <Input value={config.contacts?.email || ''} onChange={(event) => onChange(merge(config, 'contacts', { email: event.target.value }))} />

    <Label>Site</Label>
    <Input value={config.contacts?.website || ''} onChange={(event) => onChange(merge(config, 'contacts', { website: event.target.value }))} />

    <Label>Instagram</Label>
    <Input value={config.socials?.instagram || ''} onChange={(event) => onChange(merge(config, 'socials', { instagram: event.target.value }))} />

    <Label>LinkedIn</Label>
    <Input value={config.socials?.linkedin || ''} onChange={(event) => onChange(merge(config, 'socials', { linkedin: event.target.value }))} />

    <Label>Texto do rodapé da empresa</Label>
    <Input value={config.footer?.text || ''} onChange={(event) => onChange(merge(config, 'footer', { text: event.target.value }))} />
  </>;
}

function AdvancedPanel({ config, onChange }: {
  config: CompanyPageConfig;
  onChange: (next: CompanyPageConfig) => void;
}) {
  const codeMode = config.editorMode === 'code';

  return <>
    <Heading
      title="Avançado"
      text="O modo HTML existente continua disponível e é preservado para páginas que já o utilizam."
    />
    <Toggle
      checked={codeMode}
      onChange={(enabled) => onChange({ ...config, editorMode: enabled ? 'code' : 'visual' })}
      label="Usar página HTML personalizada"
    />
    {codeMode
      ? <>
        <Label>HTML</Label>
        <Textarea value={config.codePage?.html || ''} onChange={(event) => onChange(merge(config, 'codePage', { html: event.target.value }))} />
        <Label>CSS</Label>
        <Textarea value={config.codePage?.css || ''} onChange={(event) => onChange(merge(config, 'codePage', { css: event.target.value }))} />
        <Label>JavaScript</Label>
        <Textarea value={config.codePage?.js || ''} onChange={(event) => onChange(merge(config, 'codePage', { js: event.target.value }))} />
      </>
      : <div className="mt-4 rounded-2xl bg-stone-50 p-4 text-xs leading-5 text-stone-500">
        No modo visual, cada tema usa uma composição própria e a marca PiraNegócios fica apenas no rodapé de integração.
      </div>}
  </>;
}

export default CompanyPageBuilderV3;
