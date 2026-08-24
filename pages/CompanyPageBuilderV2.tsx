import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  BriefcaseBusiness,
  Code2,
  Eye,
  Globe2,
  Image as ImageIcon,
  Loader2,
  Monitor,
  Palette,
  Plus,
  Save,
  Send,
  Settings2,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { FileUpload } from '../components/FileUpload';
import {
  COMPANY_PAGE_TEMPLATES,
  CompanyEditorMode,
  CompanyPageConfig,
  CompanyPageSection,
  CompanySiteRenderer,
  PublicCompanyLike,
  PublicJobLike,
  applyCompanyThemePreset,
} from '../components/company-page/CompanySiteRenderer';
import type { CompanyPageCategoryLink } from '../components/company-page/CompanyPageExtensions';

type StudioPanel = 'brand' | 'hero' | 'page' | 'jobs' | 'contact' | 'advanced';
type CodeTab = 'html' | 'css' | 'js';

const PANELS: Array<{ id: StudioPanel; label: string; icon: React.ReactNode }> = [
  { id: 'brand', label: 'Marca', icon: <Palette className="h-4 w-4" /> },
  { id: 'hero', label: 'Capa', icon: <ImageIcon className="h-4 w-4" /> },
  { id: 'page', label: 'Página', icon: <Monitor className="h-4 w-4" /> },
  { id: 'jobs', label: 'Vagas', icon: <BriefcaseBusiness className="h-4 w-4" /> },
  { id: 'contact', label: 'Contato', icon: <Globe2 className="h-4 w-4" /> },
  { id: 'advanced', label: 'HTML', icon: <Code2 className="h-4 w-4" /> },
];

const SECTION_LABELS: Record<string, string> = {
  identity: 'Identidade',
  categories: 'Categorias / atalhos',
  about: 'Sobre',
  jobs: 'Vagas',
  contact: 'Contato',
  socials: 'Redes sociais',
  legal: 'Termos e privacidade',
};

const DEFAULT_SECTIONS: CompanyPageSection[] = [
  { id: 'identity', type: 'identity', enabled: true, locked: true },
  { id: 'categories', type: 'categories', enabled: true },
  { id: 'about', type: 'about', enabled: true },
  { id: 'jobs', type: 'jobs', enabled: true, locked: true },
  { id: 'contact', type: 'contact', enabled: true },
  { id: 'socials', type: 'socials', enabled: true },
  { id: 'legal', type: 'legal', enabled: true },
];

const DEFAULT_CATEGORIES: CompanyPageCategoryLink[] = [
  { id: 'sobre', label: 'Sobre', href: '#sobre' },
  { id: 'vagas', label: 'Vagas', href: '#vagas' },
  { id: 'contato', label: 'Contato', href: '#contato' },
];

const DEFAULT_CODE_HTML = `<main class="brand-site">
  <header class="brand-header">
    <div class="brand-lockup">
      <pn-company-logo class="brand-logo"></pn-company-logo>
      <pn-company-name class="brand-name"></pn-company-name>
      <pn-verification-badge></pn-verification-badge>
    </div>
    <a href="#jobs">Vagas</a>
  </header>
  <section class="brand-hero">
    <div>
      <p class="eyebrow">Empresa</p>
      <pn-company-name class="hero-name"></pn-company-name>
      <pn-company-address class="hero-location"></pn-company-address>
    </div>
    <pn-company-about class="hero-about"></pn-company-about>
  </section>
  <section class="jobs" id="jobs">
    <div class="section-heading"><p>Oportunidades</p><h2>Faça parte do nosso time.</h2></div>
    <pn-jobs></pn-jobs>
  </section>
  <footer class="brand-footer">
    <pn-company-phone></pn-company-phone>
    <pn-company-website></pn-company-website>
    <pn-social-links></pn-social-links>
    <small>PiraNegócios Business</small>
  </footer>
</main>`;

const DEFAULT_CODE_CSS = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
:root{--ink:#111;--paper:#fff;--muted:#6b7280;--brand:#111}
body{background:var(--paper);color:var(--ink);font-family:Inter,sans-serif}
.brand-site{width:min(1180px,calc(100% - 40px));margin:0 auto}
.brand-header{display:flex;align-items:center;justify-content:space-between;padding:22px 0;border-bottom:1px solid #e5e7eb}
.brand-lockup{display:flex;align-items:center;gap:12px}.brand-logo{width:42px;height:42px}.brand-name{font-weight:800}.brand-header a{color:inherit;text-decoration:none;font-weight:700}
.brand-hero{display:grid;grid-template-columns:1.25fr .75fr;gap:72px;align-items:end;min-height:560px;padding:90px 0;border-bottom:1px solid #e5e7eb}
.eyebrow,.section-heading p{font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.hero-name{margin-top:18px;font-size:clamp(54px,8vw,104px);font-weight:800;letter-spacing:-.07em;line-height:.88}.hero-location{margin-top:26px;color:var(--muted);font-size:14px}.hero-about{font-size:18px;line-height:1.7;color:#4b5563}
.jobs{padding:100px 0}.section-heading{display:grid;grid-template-columns:180px 1fr;gap:30px;margin-bottom:42px}.section-heading h2{margin:0;font-size:clamp(36px,5vw,66px);line-height:.95;letter-spacing:-.055em}
pn-jobs .pn-jobs-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.brand-footer{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;border-top:1px solid #e5e7eb;padding:32px 0 50px;color:var(--muted);font-size:13px}
@media(max-width:760px){.brand-site{width:min(100% - 28px,1180px)}.brand-hero{grid-template-columns:1fr;min-height:auto;padding:70px 0;gap:38px}.section-heading{grid-template-columns:1fr;gap:8px}.jobs{padding:70px 0}pn-jobs .pn-jobs-grid{grid-template-columns:1fr}.brand-footer{grid-template-columns:1fr 1fr}.hero-name{font-size:clamp(48px,16vw,72px)}}`;

const DEFAULT_CODE_JS = `// Código opcional para interações da página da empresa.\n// O ambiente é isolado do restante do PiraNegócios.`;

function mergeNested(config: CompanyPageConfig, key: keyof CompanyPageConfig, values: Record<string, unknown>): CompanyPageConfig {
  return {
    ...config,
    [key]: {
      ...((config[key] as Record<string, unknown> | undefined) || {}),
      ...values,
    },
  };
}

function ensureSections(input?: CompanyPageSection[]): CompanyPageSection[] {
  const current = Array.isArray(input) && input.length ? input.map((item) => ({ ...item })) : DEFAULT_SECTIONS.map((item) => ({ ...item }));
  const byType = new Set(current.map((item) => item.type));
  if (!byType.has('identity')) current.unshift({ id: 'identity', type: 'identity', enabled: true, locked: true });
  if (!byType.has('categories')) {
    const identityIndex = current.findIndex((item) => item.type === 'identity');
    current.splice(Math.max(0, identityIndex + 1), 0, { id: 'categories', type: 'categories', enabled: true });
  }
  if (!byType.has('jobs')) current.push({ id: 'jobs', type: 'jobs', enabled: true, locked: true });
  return current.map((item) => item.type === 'identity' || item.type === 'jobs' ? { ...item, enabled: true, locked: true } : item);
}

function hydratedConfig(raw: CompanyPageConfig | null | undefined, company: PublicCompanyLike): CompanyPageConfig {
  const config = raw || {};
  return {
    ...config,
    version: Math.max(4, Number(config.version || 4)),
    editorMode: config.editorMode === 'code' ? 'code' : 'visual',
    templateKey: config.templateKey || 'aurora',
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
      layout: config.hero?.layout || 'cover',
      eyebrow: config.hero?.eyebrow || '',
      title: config.hero?.title || company.name || '',
      subtitle: config.hero?.subtitle || '',
      jobsLabel: config.hero?.jobsLabel || 'Ver oportunidades',
      width: config.hero?.width || config.width || 'wide',
      contentWidth: config.hero?.contentWidth || 'standard',
      contentMode: config.hero?.contentMode || 'independent',
      maxHeight: Number(config.hero?.maxHeight || 0),
    },
    categories: {
      enabled: config.categories?.enabled !== false,
      title: config.categories?.title || '',
      width: config.categories?.width || config.width || 'wide',
      contentWidth: config.categories?.contentWidth || config.width || 'wide',
      contentMode: config.categories?.contentMode || 'section',
      items: Array.isArray(config.categories?.items) && config.categories!.items!.length ? config.categories!.items : DEFAULT_CATEGORIES,
    },
    jobs: {
      title: config.jobs?.title || 'Vagas em destaque',
      intro: config.jobs?.intro || '',
      layout: config.jobs?.layout || 'list',
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
      text: config.about?.text || company.description || '',
    },
    contacts: {
      phone: config.contacts?.phone || company.phone || '',
      secondaryPhone: config.contacts?.secondaryPhone || '',
      whatsapp: config.contacts?.whatsapp || '',
      email: config.contacts?.email || '',
      website: config.contacts?.website || company.website || '',
    },
    socials: {
      instagram: config.socials?.instagram || company.socialInstagram || '',
      linkedin: config.socials?.linkedin || company.socialLinkedin || '',
      facebook: config.socials?.facebook || company.socialFacebook || '',
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
    sections: ensureSections(config.sections),
    codePage: {
      html: config.codePage?.html || DEFAULT_CODE_HTML,
      css: config.codePage?.css || DEFAULT_CODE_CSS,
      js: config.codePage?.js || DEFAULT_CODE_JS,
    },
  };
}

export function CompanyPageBuilder() {
  const { profile } = useAuth();
  const companyId = profile?.companyId;
  const [company, setCompany] = useState<PublicCompanyLike | null>(null);
  const [jobs, setJobs] = useState<PublicJobLike[]>([]);
  const [config, setConfig] = useState<CompanyPageConfig | null>(null);
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [revision, setRevision] = useState(1);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [access, setAccess] = useState<any>(null);
  const [panel, setPanel] = useState<StudioPanel>('brand');
  const [codeTab, setCodeTab] = useState<CodeTab>('html');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [companyResponse, pageResponse] = await Promise.all([
          api.get(`/companies/${companyId}`),
          api.get(`/companies/${companyId}/page`),
        ]);
        if (!active) return;
        const nextCompany = companyResponse.data as PublicCompanyLike;
        const nextPage = pageResponse.data || {};
        setCompany(nextCompany);
        setConfig(hydratedConfig(nextPage.draft, nextCompany));
        setStatus(nextPage.status || 'DRAFT');
        setRevision(Number(nextPage.revision || 1));
        setPublishedAt(nextPage.publishedAt || null);
        setAccess(nextPage.access || null);
        if (nextCompany.slug) {
          try {
            const publicResponse = await api.get(`/public/companies/${nextCompany.slug}`);
            if (active) setJobs(Array.isArray(publicResponse.data?.jobs) ? publicResponse.data.jobs : []);
          } catch { if (active) setJobs([]); }
        }
      } catch (requestError: any) {
        if (active) setError(requestError?.response?.data?.message || 'Não foi possível carregar Minha Página.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [companyId]);

  const sections = useMemo(() => ensureSections(config?.sections), [config?.sections]);
  const mode: CompanyEditorMode = config?.editorMode === 'code' ? 'code' : 'visual';
  const change = (next: CompanyPageConfig) => { setConfig(next); setMessage(''); setError(''); };

  const switchMode = (nextMode: CompanyEditorMode) => {
    if (!config) return;
    change({ ...config, editorMode: nextMode, codePage: nextMode === 'code' ? { html: config.codePage?.html || DEFAULT_CODE_HTML, css: config.codePage?.css || DEFAULT_CODE_CSS, js: config.codePage?.js || DEFAULT_CODE_JS } : config.codePage });
    setPanel(nextMode === 'code' ? 'advanced' : 'brand');
  };

  const saveDraft = async () => {
    if (!companyId || !config || saving) return;
    setSaving(true); setMessage(''); setError('');
    try {
      const response = await api.put(`/companies/${companyId}/page/draft`, { config });
      setConfig(hydratedConfig(response.data?.draft || config, company || {}));
      setMessage('Rascunho salvo.');
    } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível salvar o rascunho.'); }
    finally { setSaving(false); }
  };

  const openPreview = async () => {
    if (!companyId || !config || previewing) return;
    setPreviewing(true); setError('');
    const target = window.open('', '_blank');
    try {
      const response = await api.post(`/companies/${companyId}/page/preview`, { config });
      const previewUrl = `${window.location.origin}${response.data.url}`;
      if (target) target.location.href = previewUrl; else window.open(previewUrl, '_blank', 'noopener,noreferrer');
    } catch (requestError: any) { target?.close(); setError(requestError?.response?.data?.message || 'Não foi possível abrir a prévia.'); }
    finally { setPreviewing(false); }
  };

  const publish = async () => {
    if (!companyId || !config || publishing) return;
    setPublishing(true); setMessage(''); setError('');
    try {
      const response = await api.post(`/companies/${companyId}/page/publish`, { config });
      setConfig(hydratedConfig(response.data?.draft || config, company || {}));
      setStatus('PUBLISHED');
      setRevision(Number(response.data?.revision || revision));
      setPublishedAt(response.data?.publishedAt || new Date().toISOString());
      setMessage('Página publicada.');
    } catch (requestError: any) {
      const payload = requestError?.response?.data;
      const warnings = payload?.validation?.warnings || payload?.message?.validation?.warnings;
      setError(Array.isArray(warnings) && warnings.length ? warnings.join(' ') : typeof payload?.message === 'string' ? payload.message : 'A página ainda não pode ser publicada.');
    } finally { setPublishing(false); }
  };

  const updateSections = (next: CompanyPageSection[]) => config && change({ ...config, sections: next });
  const updateSection = (id: string, values: Partial<CompanyPageSection>) => updateSections(sections.map((section) => section.id === id ? { ...section, ...values } : section));
  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections]; [next[index], next[target]] = [next[target], next[index]]; updateSections(next);
  };

  if (loading) return <div className="flex min-h-[70vh] items-center justify-center text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando estúdio...</div>;
  if (!companyId || !company || !config) return <div className="mx-auto max-w-2xl px-6 py-20 text-center"><h1 className="text-2xl font-bold">Minha Página indisponível</h1><p className="mt-3 text-stone-500">Sua conta precisa estar vinculada a uma empresa para usar este recurso.</p></div>;

  return <div className="min-h-screen bg-[#ecebea] text-stone-900">
    <header className="sticky top-0 z-[70] border-b border-stone-200 bg-white/95 backdrop-blur-xl">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
        <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-stone-400">Minha Página</p><div className="flex items-center gap-2"><h1 className="truncate text-base font-bold">{company.name}</h1>{company.isVerified || company.verificationStatus === 'VERIFIED' ? <BadgeCheck className="h-4 w-4 text-emerald-600" /> : null}</div></div>
        <div className="ml-auto hidden text-xs text-stone-400 lg:block">{status === 'PUBLISHED' ? `Publicado · versão ${revision}` : 'Somente rascunho'}{publishedAt ? ` · ${new Date(publishedAt).toLocaleDateString('pt-BR')}` : ''}</div>
        <ActionButton onClick={saveDraft} loading={saving} icon={<Save className="h-4 w-4" />}>Salvar</ActionButton>
        <ActionButton onClick={openPreview} loading={previewing} icon={<Eye className="h-4 w-4" />} secondary className="hidden sm:inline-flex">Prévia</ActionButton>
        <ActionButton onClick={publish} loading={publishing} icon={<Send className="h-4 w-4" />} dark>Publicar</ActionButton>
      </div>
      {(message || error) && <div className={`border-t px-4 py-2 text-center text-xs font-semibold ${error ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}
    </header>

    <div className="grid min-h-[calc(100vh-64px)] lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="border-r border-stone-200 bg-white">
        <div className="border-b border-stone-200 px-4 py-3"><div className="flex gap-1 overflow-x-auto lg:grid lg:grid-cols-3">{PANELS.map((item) => <button key={item.id} type="button" onClick={() => { setPanel(item.id); if (item.id === 'advanced') switchMode('code'); else if (mode === 'code') switchMode('visual'); }} className={`flex min-w-max items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-bold transition lg:min-w-0 ${panel === item.id ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'}`}>{item.icon}{item.label}</button>)}</div></div>
        <div className="max-h-[calc(100vh-118px)] overflow-y-auto px-5 py-5">
          {mode === 'code' || panel === 'advanced' ? <CodeStudio config={config} onChange={change} codeTab={codeTab} setCodeTab={setCodeTab} access={access} onBack={() => switchMode('visual')} /> :
            panel === 'brand' ? <BrandPanel config={config} onChange={change} /> :
            panel === 'hero' ? <HeroPanel config={config} onChange={change} /> :
            panel === 'page' ? <PagePanel config={config} onChange={change} sections={sections} updateSection={updateSection} moveSection={moveSection} /> :
            panel === 'jobs' ? <JobsPanel config={config} onChange={change} jobsCount={jobs.length} /> :
            <ContactPanel config={config} onChange={change} />}
        </div>
      </aside>
      <main className="min-w-0 bg-[#d8d7d5] p-3 sm:p-5 lg:p-7"><div className="mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[.15em] text-stone-500"><span>Prévia ao vivo</span><span className="inline-flex items-center gap-1"><Monitor className="h-3.5 w-3.5" /> Site da empresa</span></div><div className="mx-auto h-[calc(100vh-132px)] max-w-[1600px] overflow-auto rounded-[18px] border border-black/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,.15)]"><CompanySiteRenderer company={company} jobs={jobs} page={config} preview /></div></main>
    </div>
  </div>;
}

function ActionButton({ children, onClick, loading, icon, secondary, dark, className = '' }: { children: React.ReactNode; onClick: () => void; loading: boolean; icon: React.ReactNode; secondary?: boolean; dark?: boolean; className?: string }) {
  return <button type="button" onClick={onClick} disabled={loading} className={`items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50 ${dark ? 'bg-stone-950 text-white' : secondary ? 'border border-stone-200 bg-white' : 'border border-stone-200 bg-white'} ${className || 'inline-flex'}`}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}{children}</button>;
}

function PanelHeading({ title, text, icon }: { title: string; text?: string; icon?: React.ReactNode }) {
  return <div className="mb-6 border-b border-stone-100 pb-4"><div className="flex items-center gap-2">{icon}<h2 className="text-lg font-bold tracking-tight">{title}</h2></div>{text && <p className="mt-1.5 text-xs leading-5 text-stone-500">{text}</p>}</div>;
}

function BrandPanel({ config, onChange }: { config: CompanyPageConfig; onChange: (next: CompanyPageConfig) => void }) {
  return <div><PanelHeading title="Identidade visual" text="O tema define a direção. Tudo abaixo continua personalizável pela empresa." icon={<Palette className="h-4 w-4" />} />
    <FieldLabel>Temas</FieldLabel><div className="space-y-1 border-y border-stone-100 py-2">{COMPANY_PAGE_TEMPLATES.map((template) => <button key={template.key} type="button" onClick={() => onChange(applyCompanyThemePreset(config, template.key))} className={`w-full px-2 py-3 text-left transition ${config.templateKey === template.key ? 'text-stone-950' : 'text-stone-500 hover:text-stone-900'}`}><div className="flex items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${config.templateKey === template.key ? 'bg-stone-900 ring-4 ring-stone-100' : 'bg-stone-200'}`} /><div><div className="text-sm font-bold">{template.name} <span className="ml-1 text-[9px] uppercase tracking-widest text-stone-400">{template.eyebrow}</span></div><p className="mt-1 text-xs leading-5 text-stone-500">{template.description}</p></div></div></button>)}</div>
    <FieldLabel className="mt-6">Cores</FieldLabel><div className="grid grid-cols-2 gap-4"><ColorField label="Principal" value={config.theme?.primary || '#111111'} onChange={(value) => onChange(mergeNested(config, 'theme', { primary: value }))} /><ColorField label="Acento" value={config.theme?.accent || '#555555'} onChange={(value) => onChange(mergeNested(config, 'theme', { accent: value }))} /><ColorField label="Fundo" value={config.theme?.background || '#ffffff'} onChange={(value) => onChange(mergeNested(config, 'theme', { background: value }))} /><ColorField label="Texto" value={config.theme?.text || '#171717'} onChange={(value) => onChange(mergeNested(config, 'theme', { text: value }))} /></div>
    <FieldLabel className="mt-6">Tipografia</FieldLabel><Select value={config.branding?.typography || 'clean'} onChange={(value) => onChange(mergeNested(config, 'branding', { typography: value }))} options={[['clean','Limpa'],['editorial','Editorial'],['technical','Técnica'],['human','Humana']]} />
    <div className="mt-4 grid grid-cols-2 gap-3"><div><FieldLabel>Logo</FieldLabel><Select value={config.branding?.logoSize || 'medium'} onChange={(value) => onChange(mergeNested(config, 'branding', { logoSize: value }))} options={[['small','Pequena'],['medium','Média'],['large','Grande']]} /></div><div><FieldLabel>Cantos</FieldLabel><Select value={config.branding?.corners || 'soft'} onChange={(value) => onChange(mergeNested(config, 'branding', { corners: value }))} options={[['square','Retos'],['soft','Suaves'],['round','Arredondados']]} /></div></div>
  </div>;
}

function HeroPanel({ config, onChange }: { config: CompanyPageConfig; onChange: (next: CompanyPageConfig) => void }) {
  const hero = config.hero || {};
  return <div><PanelHeading title="Capa / abertura" text="Controle a composição e também o tamanho real da sessão. O tema continua reconhecível, mas a empresa decide o enquadramento." icon={<ImageIcon className="h-4 w-4" />} />
    <FieldLabel>Composição</FieldLabel><Select value={hero.layout || 'cover'} onChange={(value) => onChange(mergeNested(config, 'hero', { layout: value }))} options={[['split','Texto + mídia'],['centered','Centralizada'],['cover','Capa inteira'],['minimal','Minimalista']]} />
    <div className="mt-4 grid grid-cols-2 gap-3"><div><FieldLabel>Largura da sessão</FieldLabel><WidthSelect value={hero.width || config.width || 'wide'} onChange={(value) => onChange(mergeNested(config, 'hero', { width: value }))} /></div><div><FieldLabel>Conteúdo</FieldLabel><Select value={hero.contentMode || 'independent'} onChange={(value) => onChange(mergeNested(config, 'hero', { contentMode: value }))} options={[['section','Segue a sessão'],['independent','Largura própria']]} /></div></div>
    {hero.contentMode === 'independent' && <div className="mt-4"><FieldLabel>Largura do conteúdo</FieldLabel><WidthSelect value={hero.contentWidth || 'standard'} onChange={(value) => onChange(mergeNested(config, 'hero', { contentWidth: value }))} /></div>}
    <NumberField label="Altura máxima da capa (px)" value={Number(hero.maxHeight || 0)} placeholder="0 = padrão do tema" min={0} max={1100} onChange={(value) => onChange(mergeNested(config, 'hero', { maxHeight: value }))} />
    <TextField label="Chamada curta" value={hero.eyebrow || ''} onChange={(value) => onChange(mergeNested(config, 'hero', { eyebrow: value }))} />
    <TextField label="Título principal" value={hero.title || ''} onChange={(value) => onChange(mergeNested(config, 'hero', { title: value }))} />
    <TextArea label="Slogan / descrição" value={hero.subtitle || ''} rows={4} placeholder="Se ficar vazio, usa a descrição da empresa." onChange={(value) => onChange(mergeNested(config, 'hero', { subtitle: value }))} />
    <TextField label="Texto do botão" value={hero.jobsLabel || ''} onChange={(value) => onChange(mergeNested(config, 'hero', { jobsLabel: value }))} />
    <div className="mt-6 border-t border-stone-100 pt-5"><ToggleLine label="Usar imagem de capa" checked={Boolean(config.cover?.enabled)} onChange={(enabled) => onChange(mergeNested(config, 'cover', { enabled }))} />{config.cover?.enabled && <div className="mt-4 space-y-4"><FileUpload label="Imagem de capa" accept="image/*" value={config.cover?.url || ''} onChange={(value) => onChange(mergeNested(config, 'cover', { url: value }))} maxSizeKB={3072} placeholder="Envie uma imagem horizontal da marca" /><div className="grid grid-cols-2 gap-3"><div><FieldLabel>Altura base</FieldLabel><Select value={config.cover?.height || 'medium'} onChange={(value) => onChange(mergeNested(config, 'cover', { height: value }))} options={[['small','Baixa'],['medium','Média'],['large','Alta']]} /></div><div><FieldLabel>Posição</FieldLabel><Select value={config.cover?.position || 'center'} onChange={(value) => onChange(mergeNested(config, 'cover', { position: value }))} options={[['center','Centro'],['top','Topo'],['bottom','Base'],['left','Esquerda'],['right','Direita']]} /></div></div><label className="block text-xs text-stone-500">Escurecer imagem · {Number(config.cover?.overlay ?? 28)}%<input type="range" min="0" max="75" value={Number(config.cover?.overlay ?? 28)} onChange={(event) => onChange(mergeNested(config, 'cover', { overlay: Number(event.target.value) }))} className="mt-2 w-full accent-stone-900" /></label></div>}</div>
  </div>;
}

function PagePanel({ config, onChange, sections, updateSection, moveSection }: { config: CompanyPageConfig; onChange: (next: CompanyPageConfig) => void; sections: CompanyPageSection[]; updateSection: (id: string, values: Partial<CompanyPageSection>) => void; moveSection: (index: number, direction: -1 | 1) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const categories = config.categories || {};
  const categoryItems = categories.items || DEFAULT_CATEGORIES;
  const updateCategory = (index: number, values: Partial<CompanyPageCategoryLink>) => onChange({ ...config, categories: { ...categories, items: categoryItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item) } });
  const removeCategory = (index: number) => onChange({ ...config, categories: { ...categories, items: categoryItems.filter((_, itemIndex) => itemIndex !== index) } });
  const addCategory = () => onChange({ ...config, categories: { ...categories, items: [...categoryItems, { id: `link-${Date.now()}`, label: 'Novo link', href: '#sobre' }] } });
  return <div><PanelHeading title="Estrutura da página" text="As sessões podem ter largura externa e largura interna diferentes. Categorias aceitam âncoras da página ou links externos." icon={<Settings2 className="h-4 w-4" />} />
    <div className="grid grid-cols-2 gap-3"><div><FieldLabel>Largura padrão</FieldLabel><WidthSelect value={config.width || 'wide'} onChange={(value) => onChange({ ...config, width: value })} /></div><div><FieldLabel>Navegação</FieldLabel><Select value={config.navigation?.enabled === false ? 'off' : 'on'} onChange={(value) => onChange(mergeNested(config, 'navigation', { enabled: value === 'on' }))} options={[['on','Exibir'],['off','Ocultar']]} /></div></div>
    {config.navigation?.enabled !== false && <div className="mt-4"><ToggleLine label="Menu acompanha a rolagem" checked={config.navigation?.sticky !== false} onChange={(sticky) => onChange(mergeNested(config, 'navigation', { sticky }))} /><ToggleLine label="Fundo transparente" checked={Boolean(config.navigation?.transparent)} onChange={(transparent) => onChange(mergeNested(config, 'navigation', { transparent }))} /><TextField label="Nome do link de vagas" value={config.navigation?.jobsLabel || ''} onChange={(value) => onChange(mergeNested(config, 'navigation', { jobsLabel: value }))} /></div>}

    <div className="mt-7 border-t border-stone-100 pt-5"><div className="flex items-center justify-between"><FieldLabel>Categorias / atalhos</FieldLabel><button type="button" onClick={addCategory} className="inline-flex items-center gap-1 text-[10px] font-bold text-stone-600"><Plus className="h-3.5 w-3.5" />Adicionar</button></div><ToggleLine label="Exibir sessão de categorias" checked={categories.enabled !== false} onChange={(enabled) => onChange({ ...config, categories: { ...categories, enabled } })} />
      {categories.enabled !== false && <><TextField label="Título opcional" value={categories.title || ''} placeholder="Ex.: Explore" onChange={(value) => onChange({ ...config, categories: { ...categories, title: value } })} /><div className="mt-3 grid grid-cols-2 gap-3"><div><FieldLabel>Largura da sessão</FieldLabel><WidthSelect value={categories.width || config.width || 'wide'} onChange={(value) => onChange({ ...config, categories: { ...categories, width: value } })} /></div><div><FieldLabel>Conteúdo</FieldLabel><Select value={categories.contentMode || 'section'} onChange={(value) => onChange({ ...config, categories: { ...categories, contentMode: value as any } })} options={[['section','Segue a sessão'],['independent','Largura própria']]} /></div></div>{categories.contentMode === 'independent' && <div className="mt-3"><FieldLabel>Largura interna</FieldLabel><WidthSelect value={categories.contentWidth || 'wide'} onChange={(value) => onChange({ ...config, categories: { ...categories, contentWidth: value } })} /></div>}
      <div className="mt-4 space-y-3">{categoryItems.map((item, index) => <div key={item.id} className="border-b border-stone-100 pb-3"><div className="grid grid-cols-[1fr_1.35fr_auto] gap-2"><input value={item.label} onChange={(event) => updateCategory(index, { label: event.target.value })} className="min-w-0 border-0 border-b border-stone-200 bg-transparent py-2 text-xs outline-none" placeholder="Nome" /><input value={item.href} onChange={(event) => updateCategory(index, { href: event.target.value })} className="min-w-0 border-0 border-b border-stone-200 bg-transparent py-2 font-mono text-[10px] outline-none" placeholder="#sobre ou https://..." /><button type="button" onClick={() => removeCategory(index)} className="p-2 text-stone-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div></div>)}</div></>}
    </div>

    <FieldLabel className="mt-7">Ordem e visibilidade</FieldLabel><div className="border-y border-stone-100">{sections.map((section, index) => <div key={section.id} className="border-b border-stone-100 last:border-b-0"><div className="flex items-center gap-2 py-3"><button type="button" onClick={() => setSelected(selected === section.id ? null : section.id)} className="min-w-0 flex-1 text-left"><p className="text-sm font-semibold">{SECTION_LABELS[section.type] || section.type}</p>{section.locked && <p className="text-[10px] text-stone-400">Integrado ao PiraNegócios</p>}</button>{!section.locked && <button type="button" onClick={() => updateSection(section.id, { enabled: section.enabled === false })} className={`h-5 w-9 rounded-full p-0.5 transition ${section.enabled === false ? 'bg-stone-200' : 'bg-stone-900'}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${section.enabled === false ? '' : 'translate-x-4'}`} /></button>}<button type="button" onClick={() => moveSection(index, -1)} disabled={index === 0 || section.type === 'identity'} className="p-1 text-stone-400 disabled:opacity-20"><ArrowUp className="h-4 w-4" /></button><button type="button" onClick={() => moveSection(index, 1)} disabled={index === sections.length - 1} className="p-1 text-stone-400 disabled:opacity-20"><ArrowDown className="h-4 w-4" /></button></div>{selected === section.id && section.type !== 'identity' && section.type !== 'categories' && <SectionLayoutEditor section={section} update={(values) => updateSection(section.id, values)} />}</div>)}</div>
    <TextField label="Título da seção Sobre" value={config.about?.title || ''} onChange={(value) => onChange(mergeNested(config, 'about', { title: value }))} /><TextArea label="Texto institucional" value={config.about?.text || ''} rows={7} onChange={(value) => onChange(mergeNested(config, 'about', { text: value }))} /><TextField label="Texto do rodapé" value={config.footer?.text || ''} onChange={(value) => onChange(mergeNested(config, 'footer', { text: value }))} />
  </div>;
}

function SectionLayoutEditor({ section, update }: { section: CompanyPageSection; update: (values: Partial<CompanyPageSection>) => void }) {
  return <div className="mb-4 grid gap-3 rounded-xl bg-stone-50 p-3"><div className="grid grid-cols-2 gap-3"><div><FieldLabel>Largura da sessão</FieldLabel><WidthSelect value={section.width || 'wide'} onChange={(value) => update({ width: value })} /></div><div><FieldLabel>Conteúdo</FieldLabel><Select value={section.contentMode || 'section'} onChange={(value) => update({ contentMode: value as any })} options={[['section','Segue a sessão'],['independent','Largura própria']]} /></div></div>{section.contentMode === 'independent' && <div><FieldLabel>Largura interna</FieldLabel><WidthSelect value={section.contentWidth || 'standard'} onChange={(value) => update({ contentWidth: value })} /></div>}<NumberField label="Altura máxima opcional (px)" value={Number(section.maxHeight || 0)} min={0} max={2000} placeholder="0 = sem limite" onChange={(value) => update({ maxHeight: value || undefined })} /></div>;
}

function JobsPanel({ config, onChange, jobsCount }: { config: CompanyPageConfig; onChange: (next: CompanyPageConfig) => void; jobsCount: number }) {
  return <div><PanelHeading title="Oportunidades" text={`${jobsCount} ${jobsCount === 1 ? 'vaga ativa sincronizada' : 'vagas ativas sincronizadas'} automaticamente.`} icon={<BriefcaseBusiness className="h-4 w-4" />} /><TextField label="Título" value={config.jobs?.title || ''} onChange={(value) => onChange(mergeNested(config, 'jobs', { title: value }))} /><TextArea label="Introdução" value={config.jobs?.intro || ''} rows={4} onChange={(value) => onChange(mergeNested(config, 'jobs', { intro: value }))} /><FieldLabel>Apresentação das vagas</FieldLabel><div className="grid grid-cols-3 gap-2">{[['grid','Grade'],['list','Lista'],['compact','Compacta']].map(([value,label]) => <button key={value} type="button" onClick={() => onChange(mergeNested(config, 'jobs', { layout: value }))} className={`border-b-2 px-2 py-3 text-xs font-bold ${config.jobs?.layout === value ? 'border-stone-900 text-stone-900' : 'border-stone-100 text-stone-400'}`}>{label}</button>)}</div></div>;
}

function ContactPanel({ config, onChange }: { config: CompanyPageConfig; onChange: (next: CompanyPageConfig) => void }) {
  return <div><PanelHeading title="Contato e presença digital" text="Esses dados aparecem dentro da identidade da empresa, não como identidade do PiraNegócios." icon={<Globe2 className="h-4 w-4" />} /><TextField label="Telefone" value={config.contacts?.phone || ''} onChange={(value) => onChange(mergeNested(config, 'contacts', { phone: value }))} /><TextField label="Telefone 2" value={config.contacts?.secondaryPhone || ''} onChange={(value) => onChange(mergeNested(config, 'contacts', { secondaryPhone: value }))} /><TextField label="WhatsApp" value={config.contacts?.whatsapp || ''} onChange={(value) => onChange(mergeNested(config, 'contacts', { whatsapp: value }))} /><TextField label="E-mail público" value={config.contacts?.email || ''} onChange={(value) => onChange(mergeNested(config, 'contacts', { email: value }))} /><TextField label="Site institucional" value={config.contacts?.website || ''} onChange={(value) => onChange(mergeNested(config, 'contacts', { website: value }))} />
    <div className="mt-7 border-t border-stone-100 pt-5"><FieldLabel>Redes sociais</FieldLabel><TextField label="Instagram" value={config.socials?.instagram || ''} onChange={(value) => onChange(mergeNested(config, 'socials', { instagram: value }))} /><TextField label="LinkedIn" value={config.socials?.linkedin || ''} onChange={(value) => onChange(mergeNested(config, 'socials', { linkedin: value }))} /><TextField label="Facebook" value={config.socials?.facebook || ''} onChange={(value) => onChange(mergeNested(config, 'socials', { facebook: value }))} /><TextField label="YouTube" value={config.socials?.youtube || ''} onChange={(value) => onChange(mergeNested(config, 'socials', { youtube: value }))} /><TextField label="TikTok" value={config.socials?.tiktok || ''} onChange={(value) => onChange(mergeNested(config, 'socials', { tiktok: value }))} /></div>
    <div className="mt-7 border-t border-stone-100 pt-5"><FieldLabel>Documentos legais</FieldLabel><ToggleLine label="Termos de uso" checked={Boolean(config.legal?.termsEnabled)} onChange={(enabled) => onChange(mergeNested(config, 'legal', { termsEnabled: enabled }))} />{config.legal?.termsEnabled && <><TextField label="Título" value={config.legal?.termsTitle || ''} onChange={(value) => onChange(mergeNested(config, 'legal', { termsTitle: value }))} /><TextArea label="Conteúdo" value={config.legal?.termsBody || ''} rows={6} onChange={(value) => onChange(mergeNested(config, 'legal', { termsBody: value }))} /></>}<ToggleLine label="Política de privacidade" checked={Boolean(config.legal?.privacyEnabled)} onChange={(enabled) => onChange(mergeNested(config, 'legal', { privacyEnabled: enabled }))} />{config.legal?.privacyEnabled && <><TextField label="Título" value={config.legal?.privacyTitle || ''} onChange={(value) => onChange(mergeNested(config, 'legal', { privacyTitle: value }))} /><TextArea label="Conteúdo" value={config.legal?.privacyBody || ''} rows={6} onChange={(value) => onChange(mergeNested(config, 'legal', { privacyBody: value }))} /></>}</div>
  </div>;
}

function CodeStudio({ config, onChange, codeTab, setCodeTab, access, onBack }: { config: CompanyPageConfig; onChange: (next: CompanyPageConfig) => void; codeTab: CodeTab; setCodeTab: (tab: CodeTab) => void; access: any; onBack: () => void }) {
  const code = config.codePage || {}; const value = codeTab === 'html' ? code.html || '' : codeTab === 'css' ? code.css || '' : code.js || '';
  const update = (nextValue: string) => onChange({ ...config, editorMode: 'code', codePage: { ...code, [codeTab]: nextValue } });
  return <div><PanelHeading title="Código livre" text="HTML, CSS e JavaScript rodam em ambiente isolado. Os componentes integrados mantêm os dados oficiais e as vagas." icon={<Code2 className="h-4 w-4" />} /><div className="mb-5 flex items-center justify-between border-y border-violet-100 bg-violet-50 px-3 py-2 text-[10px] font-semibold text-violet-700"><span>{access?.advancedEditor?.testMode ? 'Editor avançado liberado durante os testes.' : 'Editor avançado · Empresa Plus'}</span><button type="button" onClick={onBack} className="font-bold underline">Voltar ao visual</button></div><div className="mb-3 flex gap-5 border-b border-stone-200">{(['html','css','js'] as CodeTab[]).map((tab) => <button key={tab} type="button" onClick={() => setCodeTab(tab)} className={`border-b-2 pb-2 text-xs font-bold uppercase ${codeTab === tab ? 'border-stone-900' : 'border-transparent text-stone-400'}`}>{tab}</button>)}</div><textarea value={value} onChange={(event) => update(event.target.value)} spellCheck={false} className="min-h-[520px] w-full resize-y border-0 bg-[#151515] p-4 font-mono text-xs leading-6 text-stone-100 outline-none" /><div className="mt-5 text-[11px] leading-5 text-stone-500"><b>Obrigatórios:</b><code className="mt-2 block whitespace-pre-wrap">&lt;pn-company-name&gt; · &lt;pn-company-address&gt; · &lt;pn-verification-badge&gt; · &lt;pn-jobs&gt;</code></div></div>;
}

function WidthSelect({ value, onChange }: { value: string; onChange: (value: any) => void }) { return <Select value={value} onChange={onChange} options={[['compact','Compacta'],['standard','Padrão'],['wide','Ampla'],['full','Tela inteira']]} />; }
function FieldLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <p className={`mb-2 text-[10px] font-bold uppercase tracking-[.15em] text-stone-400 ${className}`}>{children}</p>; }
function TextField({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold text-stone-600">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full border-0 border-b border-stone-200 bg-transparent px-0 py-2 text-sm outline-none focus:border-stone-900" /></label>; }
function NumberField({ label, value, onChange, placeholder = '', min, max }: { label: string; value: number; onChange: (value: number) => void; placeholder?: string; min?: number; max?: number }) { return <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold text-stone-600">{label}</span><input type="number" min={min} max={max} value={value || ''} onChange={(event) => onChange(Number(event.target.value || 0))} placeholder={placeholder} className="w-full border-0 border-b border-stone-200 bg-transparent px-0 py-2 text-sm outline-none focus:border-stone-900" /></label>; }
function TextArea({ label, value, onChange, rows = 4, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; rows?: number; placeholder?: string }) { return <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold text-stone-600">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} placeholder={placeholder} className="w-full resize-y border-0 border-b border-stone-200 bg-transparent px-0 py-2 text-sm leading-6 outline-none focus:border-stone-900" /></label>; }
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="mb-1.5 block text-xs font-semibold text-stone-600">{label}</span><div className="flex items-center gap-2 border-b border-stone-200 py-2"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-7 w-7 border-0 bg-transparent p-0" /><input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent font-mono text-xs uppercase outline-none" /></div></label>; }
function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<[string,string]> }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full border-0 border-b border-stone-200 bg-transparent px-0 py-2.5 text-sm font-medium outline-none focus:border-stone-900">{options.map(([optionValue,label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select>; }
function ToggleLine({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex cursor-pointer items-center justify-between gap-4 border-b border-stone-100 py-3"><span className="text-sm font-medium text-stone-700">{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-stone-900" /></label>; }
