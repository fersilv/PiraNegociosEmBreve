import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Code2, Eye, GripVertical, Image as ImageIcon, LayoutTemplate, Loader2, Monitor, Palette, Plus, Save, Send, Settings2, ShoppingBag, Trash2 } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
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
  isCommerceCompanyTheme,
} from '../components/company-page/CompanySiteRenderer';
import type { CompanyPageCategoryLink } from '../components/company-page/CompanyPageExtensions';
import { getCompanyThemeCapabilities, themeSupports } from '../components/company-page/CompanyThemeCapabilities';
import { FileUpload } from '../components/FileUpload';


type Panel = 'themes' | 'sections' | 'store' | 'style' | 'content' | 'advanced';

const SECTION_META: Record<string, { label: string; description: string }> = {
  identity: { label: 'Capa / identidade', description: 'Abertura do site. Fica fixa no topo.' },
  categories: { label: 'Categorias', description: 'Atalhos visuais para departamentos, linhas ou áreas.' },
  classifieds: { label: 'Classificados', description: 'Produtos e serviços publicados pela empresa para aparecerem na página.' },
  about: { label: 'Sobre', description: 'História, proposta e diferenciais da empresa.' },
  jobs: { label: 'Vagas', description: 'Oportunidades publicadas pela empresa.' },
  contact: { label: 'Contato', description: 'Telefone, WhatsApp, e-mail, site e endereço.' },
  socials: { label: 'Redes sociais', description: 'Instagram, LinkedIn, Facebook e outros canais.' },
  legal: { label: 'Termos e privacidade', description: 'Textos jurídicos opcionais.' },
};

const ALL_SECTION_TYPES = Object.keys(SECTION_META);
const DEFAULT_CATEGORIES: CompanyPageCategoryLink[] = [
  { id: 'sobre', label: 'Sobre', href: '#sobre' },
  { id: 'contato', label: 'Contato', href: '#contato' },
];

const BUSINESS_DAYS = [
  ['mon','Segunda'],['tue','Terça'],['wed','Quarta'],['thu','Quinta'],['fri','Sexta'],['sat','Sábado'],['sun','Domingo'],
] as const;

function initialSections(config: CompanyPageConfig) {
  const capabilities = getCompanyThemeCapabilities(config.templateKey);
  const saved = Array.isArray(config.sections) ? config.sections.map((section) => ({ ...section })) : [];
  const result: CompanyPageSection[] = saved.length
    ? saved
    : capabilities.recommendedSections.map((type) => ({ id: type, type, enabled: true, locked: type === 'identity' }));
  if (!result.some((section) => section.type === 'identity')) result.unshift({ id: 'identity', type: 'identity', enabled: true, locked: true });
  return result.map((section) => section.type === 'identity' ? { ...section, enabled: true, locked: true } : section);
}

function hydrate(raw: CompanyPageConfig | null | undefined, company: PublicCompanyLike): CompanyPageConfig {
  const config = raw || {};
  const legacyVersion = Number(config.version || 0);
  const templateKey = config.templateKey || 'aurora';
  const commerce = isCommerceCompanyTheme(String(templateKey));
  const configuredCategories = Array.isArray(config.categories?.items) ? config.categories.items : null;
  const next: CompanyPageConfig = {
    ...config,
    version: Math.max(7, legacyVersion || 7),
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
      cardsPerRow: config.storefront?.cardsPerRow,
      featuredTitle: config.storefront?.featuredTitle || '',
      showProducts: config.storefront?.showProducts,
      showServices: config.storefront?.showServices,
    },
    jobs: { title: config.jobs?.title || 'Oportunidades', intro: config.jobs?.intro || '', layout: config.jobs?.layout || 'grid' },
    footer: { text: config.footer?.text || '' },
    cover: {
      enabled: Boolean(config.cover?.enabled), url: config.cover?.url || '', height: config.cover?.height || 'medium', position: config.cover?.position || 'center', overlay: Number(config.cover?.overlay ?? 28),
    },
    about: { title: config.about?.title || 'Sobre a empresa', text: config.about?.text || (company as any).description || '' },
    contacts: {
      phone: config.contacts?.phone || (company as any).phone || '', secondaryPhone: config.contacts?.secondaryPhone || '', whatsapp: config.contacts?.whatsapp || '', email: config.contacts?.email || '', website: config.contacts?.website || (company as any).website || '',
    },
    socials: {
      instagram: config.socials?.instagram || (company as any).socialInstagram || '', linkedin: config.socials?.linkedin || (company as any).socialLinkedin || '', facebook: config.socials?.facebook || (company as any).socialFacebook || '', youtube: config.socials?.youtube || '', tiktok: config.socials?.tiktok || '',
    },
    legal: {
      termsEnabled: Boolean(config.legal?.termsEnabled), termsTitle: config.legal?.termsTitle || 'Termos de uso', termsBody: config.legal?.termsBody || '', privacyEnabled: Boolean(config.legal?.privacyEnabled), privacyTitle: config.legal?.privacyTitle || 'Política de privacidade', privacyBody: config.legal?.privacyBody || '',
    },
  };

  const hydratedSections = initialSections(next);
  if (commerce && legacyVersion < 7 && !hydratedSections.some((section) => section.type === 'classifieds')) {
    const categoriesIndex = hydratedSections.findIndex((section) => section.type === 'categories');
    const insertAt = categoriesIndex >= 0 ? categoriesIndex + 1 : Math.min(1, hydratedSections.length);
    hydratedSections.splice(insertAt, 0, { id: 'classifieds', type: 'classifieds', enabled: true });
  }
  next.sections = hydratedSections;
  return next;
}

function merge(config: CompanyPageConfig, key: keyof CompanyPageConfig, values: Record<string, unknown>) {
  return { ...config, [key]: { ...((config[key] as Record<string, unknown> | undefined) || {}), ...values } } as CompanyPageConfig;
}

function prepareThemeStructure(config: CompanyPageConfig, themeKey: string) {
  const capabilities = getCompanyThemeCapabilities(themeKey);
  const sections = initialSections(config);
  const next = [...sections];
  if (!next.some((section) => section.type === 'identity')) next.unshift({ id: 'identity', type: 'identity', enabled: true, locked: true });
  if (capabilities.features.commerceLayout) {
    if (!next.some((section) => section.type === 'categories')) next.splice(1, 0, { id: `categories-${Date.now()}`, type: 'categories', enabled: true });
    if (!next.some((section) => section.type === 'classifieds')) {
      const categoriesIndex = next.findIndex((section) => section.type === 'categories');
      next.splice(categoriesIndex >= 0 ? categoriesIndex + 1 : 1, 0, { id: `classifieds-${Date.now()}`, type: 'classifieds', enabled: true });
    }
  }
  return { ...config, version: 7, sections: next };
}

export function CompanyPageBuilderV4() {
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
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    let active = true;
    (async () => {
      try {
        const [companyResponse, pageResponse] = await Promise.all([api.get(`/companies/${companyId}`), api.get(`/companies/${companyId}/page`)]);
        if (!active) return;
        const nextCompany = companyResponse.data as PublicCompanyLike;
        setCompany(nextCompany);
        setConfig(hydrate(pageResponse.data?.draft, nextCompany));
        const secondary: Promise<unknown>[] = [];
        if (nextCompany.slug) secondary.push(api.get(`/public/companies/${nextCompany.slug}`).then((response) => { if (active) setJobs(Array.isArray(response.data?.jobs) ? response.data.jobs : []); }).catch(() => { if (active) setJobs([]); }));
        secondary.push(api.get(`/classifieds/company/${companyId}/listings`).then((response) => { if (!active) return; const payload = response.data; const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : []; setClassifiedsCount(rows.length); }).catch(() => { if (active) setClassifiedsCount(0); }));
        await Promise.all(secondary);
      } catch (requestError: any) {
        if (active) setError(requestError?.response?.data?.message || 'Não foi possível carregar Minha Página.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [companyId]);

  const sections = useMemo(() => config ? initialSections(config) : [], [config]);
  const capabilities = useMemo(() => getCompanyThemeCapabilities(config?.templateKey), [config?.templateKey]);
  const commerce = isCommerceCompanyTheme(String(config?.templateKey || ''));
  const change = (next: CompanyPageConfig) => { setConfig(next); setMessage(''); setError(''); };

  const saveDraft = async () => {
    if (!companyId || !config || saving) return;
    setSaving(true); setError(''); setMessage('');
    try { const response = await api.put(`/companies/${companyId}/page/draft`, { config }); setConfig(hydrate(response.data?.draft || config, company as PublicCompanyLike)); setMessage('Rascunho salvo.'); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível salvar o rascunho.'); }
    finally { setSaving(false); }
  };

  const preview = async () => {
    if (!companyId || !config || previewing) return;
    setPreviewing(true); setError('');
    const target = window.open('', '_blank');
    try { const response = await api.post(`/companies/${companyId}/page/preview`, { config }); const url = `${window.location.origin}${response.data.url}`; if (target) target.location.href = url; else window.open(url, '_blank', 'noopener,noreferrer'); }
    catch (requestError: any) { target?.close(); setError(requestError?.response?.data?.message || 'Não foi possível abrir a prévia.'); }
    finally { setPreviewing(false); }
  };

  const publish = async () => {
    if (!companyId || !config || publishing) return;
    setPublishing(true); setError(''); setMessage('');
    try { const response = await api.post(`/companies/${companyId}/page/publish`, { config }); setConfig(hydrate(response.data?.draft || config, company as PublicCompanyLike)); setMessage('Página publicada.'); }
    catch (requestError: any) {
      const payload = requestError?.response?.data;
      const warnings = payload?.validation?.warnings || payload?.message?.validation?.warnings;
      setError(Array.isArray(warnings) && warnings.length ? warnings.join(' ') : typeof payload?.message === 'string' ? payload.message : 'A página ainda não pode ser publicada.');
    } finally { setPublishing(false); }
  };

  const updateSections = (next: CompanyPageSection[]) => config && change({ ...config, sections: next });
  const removeSection = (id: string) => updateSections(sections.filter((section) => section.id !== id));
  const addSection = (type: string) => updateSections([...sections, { id: `${type}-${Date.now()}`, type, enabled: true }]);
  const updateSection = (id: string, values: Partial<CompanyPageSection>) => updateSections(sections.map((section) => section.id === id ? { ...section, ...values } : section));
  const dropSection = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return setDraggedId(null);
    const source = sections.find((section) => section.id === draggedId);
    const target = sections.find((section) => section.id === targetId);
    if (!source || !target || source.type === 'identity' || target.type === 'identity') return setDraggedId(null);
    const next = sections.filter((section) => section.id !== draggedId);
    const index = next.findIndex((section) => section.id === targetId);
    next.splice(index, 0, source);
    updateSections(next);
    setDraggedId(null);
  };

  if (loading) return <div className="flex min-h-[70vh] items-center justify-center text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando estúdio...</div>;
  if (!companyId || !company || !config) return <div className="mx-auto max-w-2xl px-6 py-20 text-center"><h1 className="text-2xl font-bold">Minha Página indisponível</h1><p className="mt-3 text-stone-500">Sua conta precisa estar vinculada a uma empresa.</p></div>;

  const missingSections = ALL_SECTION_TYPES.filter((type) => (
    type !== 'identity'
    && !sections.some((section) => section.type === type)
    && (type !== 'classifieds' || capabilities.features.commerceLayout)
  ));

  return <div className="min-h-screen bg-[#e8e7e5] text-stone-950">
    <header className="sticky top-0 z-[80] border-b border-stone-200 bg-white/95 backdrop-blur-xl"><div className="flex min-h-16 items-center gap-3 px-4 sm:px-6"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.18em] text-stone-400">Minha Página · Studio V4</p><div className="flex items-center gap-2"><h1 className="truncate text-base font-bold">{company.name}</h1>{(company as any).isVerified || (company as any).verificationStatus === 'VERIFIED' ? <BadgeCheck className="h-4 w-4 text-emerald-600" /> : null}</div></div><div className="ml-auto flex gap-2"><TopButton onClick={saveDraft} loading={saving} icon={<Save className="h-4 w-4" />}>Salvar</TopButton><TopButton onClick={preview} loading={previewing} icon={<Eye className="h-4 w-4" />} secondary>Prévia</TopButton><TopButton onClick={publish} loading={publishing} icon={<Send className="h-4 w-4" />} dark>Publicar</TopButton></div></div>{(message || error) ? <div className={`border-t px-4 py-2 text-center text-xs font-bold ${error ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>{error || message}</div> : null}</header>

    <div className="grid min-h-[calc(100vh-64px)] xl:grid-cols-[440px_minmax(0,1fr)]"><aside className="border-r border-stone-200 bg-white"><div className="grid grid-cols-6 gap-1 border-b border-stone-200 p-3"><PanelButton active={panel === 'themes'} onClick={() => setPanel('themes')} icon={<LayoutTemplate className="h-4 w-4" />} label="Modelos" /><PanelButton active={panel === 'sections'} onClick={() => setPanel('sections')} icon={<Settings2 className="h-4 w-4" />} label="Seções" /><PanelButton active={panel === 'store'} onClick={() => setPanel('store')} icon={<ShoppingBag className="h-4 w-4" />} label="Loja" /><PanelButton active={panel === 'style'} onClick={() => setPanel('style')} icon={<Palette className="h-4 w-4" />} label="Visual" /><PanelButton active={panel === 'content'} onClick={() => setPanel('content')} icon={<Monitor className="h-4 w-4" />} label="Texto" /><PanelButton active={panel === 'advanced'} onClick={() => setPanel('advanced')} icon={<Code2 className="h-4 w-4" />} label="Código" /></div><div className="max-h-[calc(100vh-118px)] overflow-y-auto p-5">
      {panel === 'themes' ? <ThemesPanel config={config} onChange={change} /> : null}
      {panel === 'sections' ? <SectionsPanel sections={sections} missing={missingSections} capabilities={capabilities} remove={removeSection} add={addSection} update={updateSection} config={config} onChange={change} draggedId={draggedId} setDraggedId={setDraggedId} drop={dropSection} /> : null}
      {panel === 'store' ? <StorePanel config={config} onChange={change} commerce={commerce} classifiedsCount={classifiedsCount} /> : null}
      {panel === 'style' ? <StylePanel config={config} onChange={change} /> : null}
      {panel === 'content' ? <ContentPanel config={config} onChange={change} jobsCount={jobs.length} /> : null}
      {panel === 'advanced' ? <AdvancedPanel config={config} onChange={change} /> : null}
    </div></aside><main className="min-w-0 p-3 sm:p-5 xl:p-7"><div className="mb-3 flex items-center justify-between text-[10px] font-black uppercase tracking-[.16em] text-stone-500"><span>Prévia ao vivo</span><span>{commerce ? `${classifiedsCount} item(ns) na vitrine` : company.name}</span></div><div className="mx-auto h-[calc(100vh-132px)] max-w-[1700px] overflow-auto rounded-[20px] border border-black/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,.15)]"><CompanySiteRenderer company={company} jobs={jobs} page={config} preview /></div></main></div>
  </div>;
}

function TopButton({ children, onClick, loading, icon, secondary, dark }: { children: React.ReactNode; onClick: () => void; loading: boolean; icon: React.ReactNode; secondary?: boolean; dark?: boolean }) { return <button type="button" onClick={onClick} disabled={loading} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50 ${dark ? 'bg-stone-950 text-white' : secondary ? 'hidden border border-stone-200 bg-white sm:inline-flex' : 'border border-stone-200 bg-white'}`}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}{children}</button>; }
function PanelButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) { return <button type="button" onClick={onClick} className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] font-bold ${active ? 'bg-stone-950 text-white' : 'text-stone-500 hover:bg-stone-100'}`}>{icon}{label}</button>; }
function Heading({ title, text }: { title: string; text: string }) { return <div className="mb-5 border-b border-stone-100 pb-4"><h2 className="text-lg font-bold">{title}</h2><p className="mt-1 text-xs leading-5 text-stone-500">{text}</p></div>; }
function Label({ children }: { children: React.ReactNode }) { return <label className="mb-1.5 mt-4 block text-[10px] font-black uppercase tracking-[.12em] text-stone-500">{children}</label>; }
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-stone-500" />; }
function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className={`min-h-28 w-full resize-y rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-stone-500 ${props.className || ''}`} />; }
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-stone-500" />; }
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) { return <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm"><span>{label}</span><span className={`h-6 w-11 rounded-full p-1 transition ${checked ? 'bg-stone-950' : 'bg-stone-200'}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} /></span></button>; }

function ThemesPanel({ config, onChange }: { config: CompanyPageConfig; onChange: (next: CompanyPageConfig) => void }) {
  return <><Heading title="Modelos de site" text="O modelo muda a arquitetura, não só a paleta. Loja, marketplace, catálogo, mosaico e classificados têm estruturas próprias." /><div className="space-y-1">{COMPANY_PAGE_TEMPLATES.map((template) => <button type="button" key={template.key} onClick={() => { const themed = applyCompanyThemePreset(config, template.key); onChange(prepareThemeStructure({ ...themed, templateKey: template.key }, template.key)); }} className={`w-full rounded-xl px-3 py-3 text-left transition ${config.templateKey === template.key ? 'bg-stone-950 text-white' : 'hover:bg-stone-100'}`}><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-bold">{template.name}</p><p className={`mt-1 text-xs leading-5 ${config.templateKey === template.key ? 'text-stone-300' : 'text-stone-500'}`}>{template.description}</p></div><span className={`mt-1 text-[9px] font-black uppercase tracking-widest ${config.templateKey === template.key ? 'text-stone-300' : 'text-stone-400'}`}>{template.eyebrow}</span></div></button>)}</div></>;
}

function SectionsPanel({ sections, missing, capabilities, remove, add, update, config, onChange, draggedId, setDraggedId, drop }: any) {
  return <><Heading title="Reordenar seções" text="Segure o ícone de seis pontos e arraste. Tudo abaixo da capa pode mudar de posição. Remover um bloco não apaga os dados originais." /><div className="space-y-2">{sections.map((section: CompanyPageSection, index: number) => { const meta = SECTION_META[section.type] || { label: section.type, description: '' }; const required = capabilities.requiredSections.includes(section.type); const draggable = !required; return <div key={section.id} draggable={draggable} onDragStart={(event) => { if (!draggable) return; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', section.id); setDraggedId(section.id); }} onDragEnd={() => setDraggedId(null)} onDragOver={(event) => { if (draggable) event.preventDefault(); }} onDrop={() => drop(section.id)} className={`rounded-2xl border p-3 transition ${draggedId === section.id ? 'border-stone-900 bg-stone-100 opacity-55' : section.enabled === false ? 'border-stone-200 bg-stone-50 opacity-65' : 'border-stone-200 bg-white'} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}><div className="flex items-start gap-2">{draggable ? <GripVertical className="mt-0.5 h-5 w-5 shrink-0 text-stone-300" /> : <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center text-[9px] font-black text-stone-300">01</span>}<div className="min-w-0 flex-1"><p className="text-sm font-bold"><span className="mr-2 text-[9px] font-black text-stone-400">{String(index + 1).padStart(2, '0')}</span>{meta.label}{required ? <span className="ml-2 text-[8px] uppercase tracking-widest text-stone-400">fixa no topo</span> : null}</p><p className="mt-1 text-[11px] leading-4 text-stone-500">{meta.description}</p></div>{!required ? <button type="button" onClick={() => remove(section.id)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button> : null}</div>{!required ? <Toggle checked={section.enabled !== false} onChange={(enabled) => update(section.id, { enabled })} label={section.enabled === false ? 'Oculta' : 'Visível'} /> : null}{section.type !== 'identity' && themeSupports(config.templateKey, 'sectionSizing') ? <div className="grid grid-cols-2 gap-2"><Select value={section.width || config.width || 'wide'} onChange={(event) => update(section.id, { width: event.target.value })}><option value="compact">Compacta</option><option value="standard">Padrão</option><option value="wide">Larga</option><option value="full">Tela inteira</option></Select><Select value={section.contentMode || 'section'} onChange={(event) => update(section.id, { contentMode: event.target.value })}><option value="section">Bloco</option><option value="independent">Independente</option></Select></div> : null}</div>; })}</div>{missing.length ? <div className="mt-5 rounded-2xl border border-dashed border-stone-300 p-3"><p className="mb-2 text-[10px] font-black uppercase tracking-widest text-stone-400">Adicionar seção</p><div className="flex flex-wrap gap-2">{missing.map((type: string) => <button type="button" key={type} onClick={() => add(type)} className="inline-flex items-center gap-1 rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold hover:bg-stone-950 hover:text-white"><Plus className="h-3.5 w-3.5" />{SECTION_META[type]?.label || type}</button>)}</div></div> : null}<div className="mt-5 border-t border-stone-100 pt-4"><Toggle checked={config.navigation?.enabled !== false} onChange={(enabled) => onChange(merge(config, 'navigation', { enabled }))} label="Menu de navegação" /><Toggle checked={config.navigation?.sticky !== false} onChange={(sticky) => onChange(merge(config, 'navigation', { sticky }))} label="Menu fixo ao rolar" /></div></>;
}

function StorePanel({ config, onChange, commerce, classifiedsCount }: { config: CompanyPageConfig; onChange: (next: CompanyPageConfig) => void; commerce: boolean; classifiedsCount: number }) {
  const items = config.categories?.items || [];
  const updateCategory = (index: number, values: Partial<CompanyPageCategoryLink>) => onChange(merge(config, 'categories', { items: items.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item) }));
  const removeCategory = (index: number) => onChange(merge(config, 'categories', { items: items.filter((_, itemIndex) => itemIndex !== index) }));
  const addCategory = () => onChange(merge(config, 'categories', { items: [...items, { id: `categoria-${Date.now()}`, label: 'Nova categoria', href: '#vitrine' }] }));
  if (!commerce) return <><Heading title="Loja e classificados" text="Essas opções aparecem nos modelos comerciais." /><div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm leading-6 text-stone-500"><ShoppingBag className="mb-3 h-6 w-6" />Escolha Loja, Marketplace, Catálogo, Mercado, Gazeta, Mosaico, Radar, Pregão ou Classificados Pro para editar banner, categorias e vitrine.</div></>;
  return (
    <>
      <Heading title="Loja e classificados" text="Controle a experiência comercial. Os produtos e serviços vêm automaticamente dos Classificados da empresa." />
      <div className="rounded-2xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800">{classifiedsCount} produto(s)/serviço(s) publicados para a Página da Empresa.</div>
      <Label>Faixa promocional</Label>
      <Input value={config.storefront?.promoText || ''} placeholder="Ex.: Frete grátis acima de R$ 199" onChange={(event) => onChange(merge(config, 'storefront', { promoText: event.target.value }))} />
      <Label>Segunda mensagem da faixa</Label>
      <Input value={config.storefront?.secondaryPromoText || ''} placeholder="Ex.: 5% no Pix" onChange={(event) => onChange(merge(config, 'storefront', { secondaryPromoText: event.target.value }))} />
      <Toggle checked={config.storefront?.showSearch ?? true} onChange={(showSearch) => onChange(merge(config, 'storefront', { showSearch }))} label="Mostrar busca na loja" />
      <Label>Texto da busca</Label>
      <Input value={config.storefront?.searchPlaceholder || ''} onChange={(event) => onChange(merge(config, 'storefront', { searchPlaceholder: event.target.value }))} />
      <Label>Estilo do banner</Label>
      <Select value={config.storefront?.bannerStyle || ''} onChange={(event) => onChange(merge(config, 'storefront', { bannerStyle: event.target.value || undefined }))}>
        <option value="">Padrão único deste tema</option><option value="full">Campanha tela cheia</option><option value="split">Banner dividido</option><option value="compact">Banner compacto</option><option value="editorial">Editorial</option>
      </Select>
      <Label>Imagem do banner</Label>
      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
        <FileUpload label="Imagem principal" accept="image/*" value={config.cover?.url || ''} onChange={(value) => onChange(merge(config, 'cover', { enabled: Boolean(value), url: value }))} maxSizeKB={3072} placeholder="Envie a imagem do banner" />
      </div>
      <Label>Estilo das categorias</Label>
      <Select value={config.storefront?.categoryStyle || ''} onChange={(event) => onChange(merge(config, 'storefront', { categoryStyle: event.target.value || undefined }))}>
        <option value="">Padrão único deste tema</option><option value="image-tiles">Cards com imagem</option><option value="circles">Círculos com imagem</option><option value="tiles">Cards sem imagem</option><option value="chips">Chips / texto</option>
      </Select>
      <Label>Layout de produtos e serviços</Label>
      <Select value={config.storefront?.productsLayout || ''} onChange={(event) => onChange(merge(config, 'storefront', { productsLayout: event.target.value || undefined }))}>
        <option value="">Padrão único deste tema</option><option value="carousel">Carrossel horizontal</option><option value="grid">Grade</option><option value="masonry">Mosaico</option><option value="list">Lista</option>
      </Select>
      <Label>Cards por linha</Label>
      <Select value={String(config.storefront?.cardsPerRow || 4)} onChange={(event) => onChange(merge(config, 'storefront', { cardsPerRow: Number(event.target.value) }))}>
        <option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option>
      </Select>
      <Label>Título da vitrine</Label>
      <Input value={config.storefront?.featuredTitle || ''} placeholder="Se vazio, usa o título próprio do tema" onChange={(event) => onChange(merge(config, 'storefront', { featuredTitle: event.target.value }))} />
      <Toggle checked={config.storefront?.showProducts !== false} onChange={(showProducts) => onChange(merge(config, 'storefront', { showProducts }))} label="Mostrar produtos" />
      <Toggle checked={config.storefront?.showServices !== false} onChange={(showServices) => onChange(merge(config, 'storefront', { showServices }))} label="Mostrar serviços" />
      
      <div className="mt-6 border-t border-stone-100 pt-5">
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-bold">Categorias personalizadas</p><p className="mt-1 text-[11px] text-stone-500">Se deixar vazio, as categorias são criadas dos anúncios. Se preencher, pode usar com ou sem imagem.</p></div>
          <button type="button" onClick={addCategory} className="inline-flex items-center gap-1 rounded-full bg-stone-950 px-3 py-2 text-[10px] font-bold text-white"><Plus className="h-3.5 w-3.5" />Adicionar</button>
        </div>
        <div className="mt-3 space-y-3">
          {items.map((item, index) => (
            <div key={item.id || index} className="rounded-2xl border border-stone-200 p-3">
              <div className="flex gap-2">
                <div className="min-w-0 flex-1"><Input value={item.label || ''} placeholder="Nome da categoria" onChange={(event) => updateCategory(index, { label: event.target.value })} /></div>
                <button type="button" onClick={() => removeCategory(index)} className="rounded-xl p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-2"><Input value={item.imageUrl || ''} placeholder="Imagem opcional da categoria" onChange={(event) => updateCategory(index, { imageUrl: event.target.value })} /></div>
              <div className="mt-2"><Input value={item.href || ''} placeholder="Destino, ex.: #vitrine" onChange={(event) => updateCategory(index, { href: event.target.value })} /></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function StylePanel({ config, onChange }: { config: CompanyPageConfig; onChange: (next: CompanyPageConfig) => void }) {
  return <><Heading title="Identidade visual" text="A estrutura vem do modelo. Aqui você adapta a marca sem transformar todos os modelos no mesmo template." />{themeSupports(config.templateKey, 'palette') ? <><Label>Cores</Label><div className="grid grid-cols-2 gap-3">{([['Principal', 'primary'], ['Acento', 'accent'], ['Fundo', 'background'], ['Texto', 'text']] as const).map(([label, key]) => <label key={key} className="text-xs text-stone-500">{label}<div className="mt-1 flex items-center gap-2 rounded-xl border border-stone-200 p-2"><input type="color" value={(config.theme as any)?.[key] || '#111111'} onChange={(event) => onChange(merge(config, 'theme', { [key]: event.target.value }))} className="h-8 w-9 rounded border-0" /><span className="text-[10px] font-mono">{(config.theme as any)?.[key]}</span></div></label>)}</div></> : null}<Label>Tipografia</Label><Select value={config.branding?.typography || 'clean'} onChange={(event) => onChange(merge(config, 'branding', { typography: event.target.value }))}><option value="clean">Limpa</option><option value="editorial">Editorial</option><option value="technical">Técnica</option><option value="human">Humana</option></Select><Label>Cantos</Label><Select value={config.branding?.corners || 'soft'} onChange={(event) => onChange(merge(config, 'branding', { corners: event.target.value }))}><option value="square">Retos</option><option value="soft">Suaves</option><option value="round">Arredondados</option></Select>{!isCommerceCompanyTheme(String(config.templateKey || '')) ? <><Label>Largura geral</Label><Select value={config.width || 'wide'} onChange={(event) => onChange({ ...config, width: event.target.value as any })}><option value="compact">Compacta</option><option value="standard">Padrão</option><option value="wide">Larga</option><option value="full">Tela inteira</option></Select></> : null}</>;
}

function BusinessHoursEditor({ config, onChange }: { config: CompanyPageConfig; onChange: (next: CompanyPageConfig) => void }) {
  const business = config.businessHours || {};
  const days = business.days || {};
  const specialDates = business.specialDates || [];
  const patchBusiness = (values: Record<string, unknown>) => onChange(merge(config, 'businessHours', { ...business, ...values }));
  const patchDay = (key: string, values: { enabled?: boolean; open?: string; close?: string }) => {
    const current = (days as any)[key]?.[0] || { open: '08:00', close: '18:00' };
    const enabled = values.enabled ?? Boolean((days as any)[key]?.length);
    const interval = { open: values.open ?? current.open ?? '08:00', close: values.close ?? current.close ?? '18:00' };
    patchBusiness({ days: { ...days, [key]: enabled ? [interval] : [] } });
  };
  const patchSpecial = (index: number, values: Record<string, unknown>) => patchBusiness({ specialDates: specialDates.map((item, i) => i === index ? { ...item, ...values } : item) });
  return <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black">Horários de funcionamento</p><p className="mt-1 text-[11px] leading-4 text-stone-500">Esses horários aparecem na página da empresa e também podem alimentar o Catálogo Rapi10.</p></div><Toggle checked={business.enabled === true} onChange={(enabled) => patchBusiness({ enabled })} label="Ativar" /></div>{business.enabled === true ? <><div className="mt-4 space-y-2">{BUSINESS_DAYS.map(([key,label]) => { const interval = (days as any)[key]?.[0]; const enabled = Boolean(interval); return <div key={key} className="grid grid-cols-[92px_70px_1fr_1fr] items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-stone-200"><b className="text-[11px]">{label}</b><label className="flex items-center gap-1 text-[10px] text-stone-500"><input type="checkbox" checked={enabled} onChange={(event) => patchDay(key,{enabled:event.target.checked})}/>Aberto</label><input type="time" disabled={!enabled} value={interval?.open || '08:00'} onChange={(event) => patchDay(key,{open:event.target.value,enabled:true})} className="rounded-lg border border-stone-200 px-2 py-1.5 text-xs disabled:opacity-40"/><input type="time" disabled={!enabled} value={interval?.close || '18:00'} onChange={(event) => patchDay(key,{close:event.target.value,enabled:true})} className="rounded-lg border border-stone-200 px-2 py-1.5 text-xs disabled:opacity-40"/></div>; })}</div><div className="mt-4 flex items-center justify-between"><div><p className="text-[11px] font-black">Datas especiais</p><p className="text-[10px] text-stone-500">Feriados, eventos, recessos ou horários diferentes.</p></div><button type="button" onClick={() => patchBusiness({ specialDates: [...specialDates, { date: '', label: '', closed: true, open: '', close: '' }] })} className="inline-flex items-center gap-1 rounded-xl bg-stone-900 px-3 py-2 text-[10px] font-black text-white"><Plus className="h-3.5 w-3.5"/>Adicionar data</button></div><div className="mt-2 space-y-2">{specialDates.map((item,index) => <div key={`${index}-${item.date}`} className="grid gap-2 rounded-xl bg-white p-3 ring-1 ring-stone-200 sm:grid-cols-[140px_1fr_82px_110px_110px_36px]"><input type="date" value={item.date || ''} onChange={(event) => patchSpecial(index,{date:event.target.value})} className="rounded-lg border border-stone-200 px-2 py-2 text-xs"/><input value={item.label || ''} maxLength={80} placeholder="Ex.: Feriado municipal" onChange={(event) => patchSpecial(index,{label:event.target.value})} className="rounded-lg border border-stone-200 px-2 py-2 text-xs"/><label className="flex items-center gap-1 text-[10px] text-stone-500"><input type="checkbox" checked={item.closed === true} onChange={(event) => patchSpecial(index,{closed:event.target.checked})}/>Fechado</label><input type="time" disabled={item.closed === true} value={item.open || ''} onChange={(event) => patchSpecial(index,{open:event.target.value})} className="rounded-lg border border-stone-200 px-2 py-2 text-xs disabled:opacity-40"/><input type="time" disabled={item.closed === true} value={item.close || ''} onChange={(event) => patchSpecial(index,{close:event.target.value})} className="rounded-lg border border-stone-200 px-2 py-2 text-xs disabled:opacity-40"/><button type="button" aria-label="Remover data" onClick={() => patchBusiness({ specialDates: specialDates.filter((_,i) => i !== index) })} className="grid h-9 w-9 place-items-center rounded-lg bg-rose-50 text-rose-700"><Trash2 className="h-3.5 w-3.5"/></button></div>)}</div><div className="mt-3"><Toggle checked={business.showOnPage !== false} onChange={(showOnPage) => patchBusiness({ showOnPage })} label="Mostrar horário na página pública" /></div></> : null}</div>;
}

function ContentPanel({ config, onChange, jobsCount }: { config: CompanyPageConfig; onChange: (next: CompanyPageConfig) => void; jobsCount: number }) {
  return <><Heading title="Conteúdo" text="Textos, informações institucionais e canais da empresa." /><Label>Chamada da capa</Label><Input value={config.hero?.eyebrow || ''} onChange={(event) => onChange(merge(config, 'hero', { eyebrow: event.target.value }))} /><Label>Título da capa</Label><Input value={config.hero?.title || ''} onChange={(event) => onChange(merge(config, 'hero', { title: event.target.value }))} /><Label>Subtítulo da capa</Label><Textarea value={config.hero?.subtitle || ''} onChange={(event) => onChange(merge(config, 'hero', { subtitle: event.target.value }))} /><Label>Sobre · título</Label><Input value={config.about?.title || ''} onChange={(event) => onChange(merge(config, 'about', { title: event.target.value }))} /><Label>Sobre · texto</Label><Textarea value={config.about?.text || ''} onChange={(event) => onChange(merge(config, 'about', { text: event.target.value }))} /><div className="mt-6 rounded-2xl bg-stone-50 p-3"><p className="text-xs font-bold">Vagas conectadas: {jobsCount}</p><p className="mt-1 text-[11px] leading-4 text-stone-500">Você pode tirar a seção Vagas da página sem apagar nenhuma vaga.</p></div><Label>Telefone</Label><Input value={config.contacts?.phone || ''} onChange={(event) => onChange(merge(config, 'contacts', { phone: event.target.value }))} /><Label>WhatsApp</Label><Input value={config.contacts?.whatsapp || ''} onChange={(event) => onChange(merge(config, 'contacts', { whatsapp: event.target.value }))} /><Label>E-mail</Label><Input value={config.contacts?.email || ''} onChange={(event) => onChange(merge(config, 'contacts', { email: event.target.value }))} /><Label>Site</Label><Input value={config.contacts?.website || ''} onChange={(event) => onChange(merge(config, 'contacts', { website: event.target.value }))} /><BusinessHoursEditor config={config} onChange={onChange} /><Label>Instagram</Label><Input value={config.socials?.instagram || ''} onChange={(event) => onChange(merge(config, 'socials', { instagram: event.target.value }))} /><Label>LinkedIn</Label><Input value={config.socials?.linkedin || ''} onChange={(event) => onChange(merge(config, 'socials', { linkedin: event.target.value }))} /><Label>Texto do rodapé da empresa</Label><Input value={config.footer?.text || ''} onChange={(event) => onChange(merge(config, 'footer', { text: event.target.value }))} /></>;
}

function AdvancedPanel({ config, onChange }: { config: CompanyPageConfig; onChange: (next: CompanyPageConfig) => void }) {
  const codeMode = config.editorMode === 'code';
  return (
    <>
      <Heading title="Código personalizado" text="Para empresas que desejam criar uma experiência totalmente customizada." />
      <Toggle checked={codeMode} onChange={(enabled) => onChange({ ...config, editorMode: enabled ? 'code' : 'visual' })} label="Usar código personalizado (HTML/CSS/JS)" />
      {codeMode ? (
        <div className="mt-4 space-y-4">
          <div>
            <Label>HTML</Label>
            <div className="overflow-hidden rounded-xl border border-stone-200">
              <CodeMirror
                value={config.codePage?.html || ''}
                height="200px"
                extensions={[html()]}
                onChange={(value) => onChange(merge(config, 'codePage', { html: value }))}
                className="text-sm"
              />
            </div>
          </div>
          <div>
            <Label>CSS</Label>
            <div className="overflow-hidden rounded-xl border border-stone-200">
              <CodeMirror
                value={config.codePage?.css || ''}
                height="150px"
                extensions={[css()]}
                onChange={(value) => onChange(merge(config, 'codePage', { css: value }))}
                className="text-sm"
              />
            </div>
          </div>
          <div>
            <Label>JavaScript</Label>
            <div className="overflow-hidden rounded-xl border border-stone-200">
              <CodeMirror
                value={config.codePage?.js || ''}
                height="150px"
                extensions={[javascript({ jsx: false })]}
                onChange={(value) => onChange(merge(config, 'codePage', { js: value }))}
                className="text-sm"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-stone-50 p-4 text-xs leading-5 text-stone-500">
          No modo visual, a página é renderizada automaticamente usando o motor de temas. 
          Alterne para o modo de código para assumir o controle total da página HTML.
        </div>
      )}
    </>
  );
}

export default CompanyPageBuilderV4;
