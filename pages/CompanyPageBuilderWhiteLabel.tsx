import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  Code2,
  Eye,
  FileText,
  Globe2,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  Monitor,
  Palette,
  Save,
  Send,
  Settings2,
  Sparkles,
  Type,
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
} from '../components/company-page/CompanySiteRenderer';

type StudioPanel = 'brand' | 'hero' | 'page' | 'jobs' | 'contact' | 'advanced';
type CodeTab = 'html' | 'css' | 'js';

const PANELS: Array<{ id: StudioPanel; label: string; icon: React.ReactNode }> = [
  { id: 'brand', label: 'Marca', icon: <Palette className="h-4 w-4" /> },
  { id: 'hero', label: 'Abertura', icon: <ImageIcon className="h-4 w-4" /> },
  { id: 'page', label: 'Página', icon: <Monitor className="h-4 w-4" /> },
  { id: 'jobs', label: 'Vagas', icon: <BriefcaseBusiness className="h-4 w-4" /> },
  { id: 'contact', label: 'Contato', icon: <Globe2 className="h-4 w-4" /> },
  { id: 'advanced', label: 'Código', icon: <Code2 className="h-4 w-4" /> },
];

const SECTION_LABELS: Record<string, string> = {
  identity: 'Identidade',
  about: 'Sobre',
  jobs: 'Vagas',
  contact: 'Contato',
  socials: 'Redes sociais',
  legal: 'Termos e privacidade',
};

const DEFAULT_SECTIONS: CompanyPageSection[] = [
  { id: 'identity', type: 'identity', enabled: true, locked: true },
  { id: 'about', type: 'about', enabled: true },
  { id: 'jobs', type: 'jobs', enabled: true, locked: true },
  { id: 'contact', type: 'contact', enabled: true },
  { id: 'socials', type: 'socials', enabled: true },
  { id: 'legal', type: 'legal', enabled: true },
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
      <p class="eyebrow">Carreiras</p>
      <pn-company-name class="hero-name"></pn-company-name>
      <pn-company-address class="hero-location"></pn-company-address>
    </div>
    <pn-company-about class="hero-about"></pn-company-about>
  </section>

  <section class="jobs" id="jobs">
    <div class="section-heading">
      <p>Oportunidades</p>
      <h2>Faça parte do nosso time.</h2>
    </div>
    <pn-jobs></pn-jobs>
  </section>

  <footer class="brand-footer">
    <pn-company-phone></pn-company-phone>
    <pn-company-website></pn-company-website>
    <pn-social-links></pn-social-links>
    <small>Carreiras por PiraNegócios</small>
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

const DEFAULT_CODE_JS = `// Código opcional para interações da página da empresa.
// O ambiente é isolado do restante do PiraNegócios.`;

function mergeNested(
  config: CompanyPageConfig,
  key: keyof CompanyPageConfig,
  values: Record<string, unknown>,
): CompanyPageConfig {
  return {
    ...config,
    [key]: {
      ...((config[key] as Record<string, unknown> | undefined) || {}),
      ...values,
    },
  };
}

function hydratedConfig(raw: CompanyPageConfig | null | undefined, company: PublicCompanyLike): CompanyPageConfig {
  const config = raw || {};
  return {
    ...config,
    version: Math.max(3, Number(config.version || 3)),
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
      logoSize: config.branding?.logoSize || 'large',
      corners: config.branding?.corners || 'soft',
    },
    navigation: {
      enabled: config.navigation?.enabled !== false,
      sticky: config.navigation?.sticky !== false,
      transparent: Boolean(config.navigation?.transparent),
      jobsLabel: config.navigation?.jobsLabel || 'Vagas',
    },
    hero: {
      layout: config.hero?.layout || 'split',
      eyebrow: config.hero?.eyebrow || '',
      title: config.hero?.title || company.name || '',
      subtitle: config.hero?.subtitle || '',
      jobsLabel: config.hero?.jobsLabel || 'Ver oportunidades',
    },
    jobs: {
      title: config.jobs?.title || 'Oportunidades',
      intro: config.jobs?.intro || 'Conheça as vagas abertas e encontre a próxima oportunidade para fazer parte do nosso time.',
      layout: config.jobs?.layout || 'grid',
    },
    footer: {
      text: config.footer?.text || '',
    },
    cover: {
      enabled: Boolean(config.cover?.enabled),
      url: config.cover?.url || '',
      height: config.cover?.height || 'medium',
      position: config.cover?.position || 'center',
      overlay: Number(config.cover?.overlay ?? 34),
    },
    about: {
      title: config.about?.title || 'Sobre',
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
    sections: Array.isArray(config.sections) && config.sections.length
      ? config.sections
      : DEFAULT_SECTIONS,
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
  const [validation, setValidation] = useState<any>(null);
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
    if (!companyId) {
      setLoading(false);
      return;
    }
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
        setValidation(nextPage.validation || null);
        setAccess(nextPage.access || null);
        if (nextCompany.slug) {
          try {
            const publicResponse = await api.get(`/public/companies/${nextCompany.slug}`);
            if (active) setJobs(Array.isArray(publicResponse.data?.jobs) ? publicResponse.data.jobs : []);
          } catch {
            if (active) setJobs([]);
          }
        }
      } catch (requestError: any) {
        if (active) setError(requestError?.response?.data?.message || 'Não foi possível carregar Minha Página.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [companyId]);

  const sections = useMemo(
    () => Array.isArray(config?.sections) ? config!.sections! : DEFAULT_SECTIONS,
    [config],
  );

  const mode: CompanyEditorMode = config?.editorMode === 'code' ? 'code' : 'visual';

  const change = (next: CompanyPageConfig) => {
    setConfig(next);
    setMessage('');
    setError('');
  };

  const switchMode = (nextMode: CompanyEditorMode) => {
    if (!config) return;
    change({
      ...config,
      editorMode: nextMode,
      codePage: nextMode === 'code'
        ? {
            html: config.codePage?.html || DEFAULT_CODE_HTML,
            css: config.codePage?.css || DEFAULT_CODE_CSS,
            js: config.codePage?.js || DEFAULT_CODE_JS,
          }
        : config.codePage,
    });
    setPanel(nextMode === 'code' ? 'advanced' : 'brand');
  };

  const saveDraft = async () => {
    if (!companyId || !config || saving) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await api.put(`/companies/${companyId}/page/draft`, { config });
      setConfig(hydratedConfig(response.data?.draft || config, company || {}));
      setValidation(response.data?.validation || null);
      setMessage('Rascunho salvo.');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível salvar o rascunho.');
    } finally {
      setSaving(false);
    }
  };

  const openPreview = async () => {
    if (!companyId || !config || previewing) return;
    setPreviewing(true);
    setError('');
    const target = window.open('', '_blank');
    try {
      const response = await api.post(`/companies/${companyId}/page/preview`, { config });
      setValidation(response.data?.validation || validation);
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
    setMessage('');
    setError('');
    try {
      const response = await api.post(`/companies/${companyId}/page/publish`, { config });
      setConfig(hydratedConfig(response.data?.draft || config, company || {}));
      setValidation(response.data?.validation || null);
      setStatus('PUBLISHED');
      setRevision(Number(response.data?.revision || revision));
      setPublishedAt(response.data?.publishedAt || new Date().toISOString());
      setMessage('Página publicada.');
    } catch (requestError: any) {
      const payload = requestError?.response?.data;
      const details = payload?.validation || payload?.message?.validation;
      setValidation(details || validation);
      const warnings = details?.warnings;
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

  const updateSection = (id: string, values: Partial<CompanyPageSection>) => {
    if (!config) return;
    change({
      ...config,
      sections: sections.map((section) => section.id === id ? { ...section, ...values } : section),
    });
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    if (!config) return;
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    change({ ...config, sections: next });
  };

  if (loading) {
    return <div className="flex min-h-[70vh] items-center justify-center text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando estúdio...</div>;
  }

  if (!companyId || !company || !config) {
    return <div className="mx-auto max-w-2xl px-6 py-20 text-center"><h1 className="text-2xl font-bold text-stone-900">Minha Página indisponível</h1><p className="mt-3 text-stone-500">Sua conta precisa estar vinculada a uma empresa para usar este recurso.</p></div>;
  }

  return (
    <div className="min-h-screen bg-[#ecebea] text-stone-900">
      <header className="sticky top-0 z-[70] border-b border-stone-200 bg-white/95 backdrop-blur-xl">
        <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-stone-400">Minha Página</p>
            <div className="flex items-center gap-2"><h1 className="truncate text-base font-bold">{company.name}</h1>{company.isVerified || company.verificationStatus === 'VERIFIED' ? <BadgeCheck className="h-4 w-4 text-emerald-600" aria-label="Empresa verificada" /> : null}</div>
          </div>
          <div className="ml-auto hidden items-center gap-2 text-xs text-stone-400 lg:flex"><span>{status === 'PUBLISHED' ? `Publicado · versão ${revision}` : 'Somente rascunho'}</span>{publishedAt && <span>· {new Date(publishedAt).toLocaleDateString('pt-BR')}</span>}</div>
          <button type="button" onClick={saveDraft} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold hover:bg-stone-50 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar</button>
          <button type="button" onClick={openPreview} disabled={previewing} className="hidden items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold hover:bg-stone-50 disabled:opacity-50 sm:inline-flex">{previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Prévia</button>
          <button type="button" onClick={publish} disabled={publishing} className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-50">{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publicar</button>
        </div>
        {(message || error) && <div className={`border-t px-4 py-2 text-center text-xs font-semibold ${error ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}
      </header>

      <div className="grid min-h-[calc(100vh-64px)] lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-r border-stone-200 bg-white">
          <div className="border-b border-stone-200 px-4 py-3">
            <div className="flex gap-1 overflow-x-auto lg:grid lg:grid-cols-3">
              {PANELS.map((item) => (
                <button key={item.id} type="button" onClick={() => { setPanel(item.id); if (item.id === 'advanced') switchMode('code'); else if (mode === 'code') switchMode('visual'); }} className={`flex min-w-max items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-bold transition lg:min-w-0 ${panel === item.id ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'}`}>{item.icon}<span>{item.label}</span></button>
              ))}
            </div>
          </div>

          <div className="max-h-[calc(100vh-118px)] overflow-y-auto px-5 py-5">
            {mode === 'code' || panel === 'advanced' ? (
              <CodeStudio config={config} onChange={change} codeTab={codeTab} setCodeTab={setCodeTab} access={access} onBack={() => switchMode('visual')} />
            ) : panel === 'brand' ? (
              <BrandPanel config={config} onChange={change} />
            ) : panel === 'hero' ? (
              <HeroPanel config={config} onChange={change} />
            ) : panel === 'page' ? (
              <PagePanel config={config} onChange={change} sections={sections} updateSection={updateSection} moveSection={moveSection} />
            ) : panel === 'jobs' ? (
              <JobsPanel config={config} onChange={change} jobsCount={jobs.length} />
            ) : (
              <ContactPanel config={config} onChange={change} />
            )}
          </div>
        </aside>

        <main className="min-w-0 bg-[#d8d7d5] p-3 sm:p-5 lg:p-7">
          <div className="mb-3 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[.15em] text-stone-500"><span>Prévia ao vivo</span><span className="inline-flex items-center gap-1"><Monitor className="h-3.5 w-3.5" /> Site da empresa</span></div>
          <div className="mx-auto h-[calc(100vh-132px)] max-w-[1500px] overflow-auto rounded-[18px] border border-black/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,.15)]">
            <CompanySiteRenderer company={company} jobs={jobs} page={config} preview />
          </div>
        </main>
      </div>
    </div>
  );
}

function PanelHeading({ title, text, icon }: { title: string; text?: string; icon?: React.ReactNode }) {
  return <div className="mb-6 border-b border-stone-100 pb-4"><div className="flex items-center gap-2">{icon}<h2 className="text-lg font-bold tracking-tight">{title}</h2></div>{text && <p className="mt-1.5 text-xs leading-5 text-stone-500">{text}</p>}</div>;
}

function BrandPanel({ config, onChange }: { config: CompanyPageConfig; onChange: (next: CompanyPageConfig) => void }) {
  return (
    <div>
      <PanelHeading title="Identidade visual" text="O PiraNegócios fornece a infraestrutura. A aparência é da sua empresa." icon={<Palette className="h-4 w-4" />} />
      <FieldLabel>Direção inicial</FieldLabel>
      <div className="space-y-1 border-y border-stone-100 py-2">
        {COMPANY_PAGE_TEMPLATES.map((template) => (
          <button key={template.key} type="button" onClick={() => onChange({ ...config, templateKey: template.key })} className={`w-full px-2 py-3 text-left transition ${config.templateKey === template.key ? 'text-stone-950' : 'text-stone-500 hover:text-stone-900'}`}>
            <div className="flex items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${config.templateKey === template.key ? 'bg-stone-900 ring-4 ring-stone-100' : 'bg-stone-200'}`} /><div><div className="text-sm font-bold">{template.name} <span className="ml-1 text-[9px] font-bold uppercase tracking-widest text-stone-400">{template.eyebrow}</span></div><p className="mt-1 text-xs leading-5 text-stone-500">{template.description}</p></div></div>
          </button>
        ))}
      </div>

      <FieldLabel className="mt-6">Cores da marca</FieldLabel>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <ColorField label="Principal" value={config.theme?.primary || '#111111'} onChange={(value) => onChange(mergeNested(config, 'theme', { primary: value }))} />
        <ColorField label="Acento" value={config.theme?.accent || '#555555'} onChange={(value) => onChange(mergeNested(config, 'theme', { accent: value }))} />
        <ColorField label="Fundo" value={config.theme?.background || '#ffffff'} onChange={(value) => onChange(mergeNested(config, 'theme', { background: value }))} />
        <ColorField label="Texto" value={config.theme?.text || '#171717'} onChange={(value) => onChange(mergeNested(config, 'theme', { text: value }))} />
      </div>

      <FieldLabel className="mt-6">Tipografia</FieldLabel>
      <Select value={config.branding?.typography || 'clean'} onChange={(value) => onChange(mergeNested(config, 'branding', { typography: value }))} options={[['clean', 'Limpa'], ['editorial', 'Editorial'], ['technical', 'Técnica'], ['human', 'Humana']]} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div><FieldLabel>Logo</FieldLabel><Select value={config.branding?.logoSize || 'large'} onChange={(value) => onChange(mergeNested(config, 'branding', { logoSize: value }))} options={[['small', 'Pequena'], ['medium', 'Média'], ['large', 'Grande']]} /></div>
        <div><FieldLabel>Cantos</FieldLabel><Select value={config.branding?.corners || 'soft'} onChange={(value) => onChange(mergeNested(config, 'branding', { corners: value }))} options={[['square', 'Retos'], ['soft', 'Suaves'], ['round', 'Arredondados']]} /></div>
      </div>
    </div>
  );
}

function HeroPanel({ config, onChange }: { config: CompanyPageConfig; onChange: (next: CompanyPageConfig) => void }) {
  return (
    <div>
      <PanelHeading title="Abertura do site" text="Primeira impressão da empresa. Pode ser sóbria, editorial, centralizada ou com uma imagem de marca ocupando a tela." icon={<ImageIcon className="h-4 w-4" />} />
      <FieldLabel>Composição</FieldLabel>
      <Select value={config.hero?.layout || 'split'} onChange={(value) => onChange(mergeNested(config, 'hero', { layout: value }))} options={[['split', 'Marca + texto'], ['centered', 'Centralizada'], ['cover', 'Capa institucional'], ['minimal', 'Editorial minimalista']]} />
      <TextField label="Chamada curta" value={config.hero?.eyebrow || ''} placeholder="Ex.: Carreiras, Conectando o futuro..." onChange={(value) => onChange(mergeNested(config, 'hero', { eyebrow: value }))} />
      <TextField label="Título principal" value={config.hero?.title || ''} placeholder="Nome ou manifesto da empresa" onChange={(value) => onChange(mergeNested(config, 'hero', { title: value }))} />
      <TextArea label="Texto da abertura" value={config.hero?.subtitle || ''} placeholder="Deixe vazio para usar a descrição da empresa." rows={4} onChange={(value) => onChange(mergeNested(config, 'hero', { subtitle: value }))} />
      <TextField label="Texto do botão de vagas" value={config.hero?.jobsLabel || ''} placeholder="Ver oportunidades" onChange={(value) => onChange(mergeNested(config, 'hero', { jobsLabel: value }))} />

      <div className="mt-6 border-t border-stone-100 pt-5">
        <ToggleLine label="Usar imagem de capa" checked={Boolean(config.cover?.enabled)} onChange={(enabled) => onChange(mergeNested(config, 'cover', { enabled }))} />
        {config.cover?.enabled && <div className="mt-4 space-y-4"><FileUpload label="Imagem de capa" accept="image/*" value={config.cover?.url || ''} onChange={(value) => onChange(mergeNested(config, 'cover', { url: value }))} maxSizeKB={3072} placeholder="Envie uma imagem horizontal da própria marca" /><div className="grid grid-cols-2 gap-3"><div><FieldLabel>Altura</FieldLabel><Select value={config.cover?.height || 'medium'} onChange={(value) => onChange(mergeNested(config, 'cover', { height: value }))} options={[['small', 'Baixa'], ['medium', 'Média'], ['large', 'Alta']]} /></div><div><FieldLabel>Posição</FieldLabel><Select value={config.cover?.position || 'center'} onChange={(value) => onChange(mergeNested(config, 'cover', { position: value }))} options={[['center', 'Centro'], ['top', 'Topo'], ['bottom', 'Base'], ['left', 'Esquerda'], ['right', 'Direita']]} /></div></div><label className="block text-xs text-stone-500">Escurecer imagem · {Number(config.cover?.overlay ?? 34)}%<input type="range" min="0" max="75" value={Number(config.cover?.overlay ?? 34)} onChange={(event) => onChange(mergeNested(config, 'cover', { overlay: Number(event.target.value) }))} className="mt-2 w-full accent-stone-900" /></label></div>}
      </div>
    </div>
  );
}

function PagePanel({ config, onChange, sections, updateSection, moveSection }: { config: CompanyPageConfig; onChange: (next: CompanyPageConfig) => void; sections: CompanyPageSection[]; updateSection: (id: string, values: Partial<CompanyPageSection>) => void; moveSection: (index: number, direction: -1 | 1) => void }) {
  return (
    <div>
      <PanelHeading title="Estrutura da página" text="Identidade e vagas são parte da integração. O restante pode ser ligado, desligado e reorganizado." icon={<Settings2 className="h-4 w-4" />} />
      <div className="grid grid-cols-2 gap-3"><div><FieldLabel>Largura</FieldLabel><Select value={config.width || 'wide'} onChange={(value) => onChange({ ...config, width: value as any })} options={[['compact', 'Compacta'], ['standard', 'Padrão'], ['wide', 'Ampla'], ['full', 'Tela inteira']]} /></div><div><FieldLabel>Navegação</FieldLabel><Select value={config.navigation?.enabled === false ? 'off' : 'on'} onChange={(value) => onChange(mergeNested(config, 'navigation', { enabled: value === 'on' }))} options={[['on', 'Exibir'], ['off', 'Ocultar']]} /></div></div>
      {config.navigation?.enabled !== false && <div className="mt-4 space-y-3"><ToggleLine label="Menu acompanha a rolagem" checked={config.navigation?.sticky !== false} onChange={(sticky) => onChange(mergeNested(config, 'navigation', { sticky }))} /><ToggleLine label="Fundo transparente" checked={Boolean(config.navigation?.transparent)} onChange={(transparent) => onChange(mergeNested(config, 'navigation', { transparent }))} /><TextField label="Nome do link de vagas" value={config.navigation?.jobsLabel || ''} placeholder="Vagas" onChange={(value) => onChange(mergeNested(config, 'navigation', { jobsLabel: value }))} /></div>}

      <FieldLabel className="mt-7">Ordem e visibilidade</FieldLabel>
      <div className="border-y border-stone-100">
        {sections.map((section, index) => (
          <div key={section.id} className="flex items-center gap-2 border-b border-stone-100 py-3 last:border-b-0">
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{SECTION_LABELS[section.type] || section.type}</p>{section.locked && <p className="text-[10px] text-stone-400">Integrado ao PiraNegócios</p>}</div>
            {!section.locked && <button type="button" onClick={() => updateSection(section.id, { enabled: section.enabled === false })} className={`h-5 w-9 rounded-full p-0.5 transition ${section.enabled === false ? 'bg-stone-200' : 'bg-stone-900'}`} aria-label={`${section.enabled === false ? 'Exibir' : 'Ocultar'} ${SECTION_LABELS[section.type] || section.type}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${section.enabled === false ? '' : 'translate-x-4'}`} /></button>}
            <button type="button" onClick={() => moveSection(index, -1)} disabled={index === 0 || section.type === 'identity'} className="p-1 text-stone-400 hover:text-stone-900 disabled:opacity-20"><ArrowUp className="h-4 w-4" /></button>
            <button type="button" onClick={() => moveSection(index, 1)} disabled={index === sections.length - 1} className="p-1 text-stone-400 hover:text-stone-900 disabled:opacity-20"><ArrowDown className="h-4 w-4" /></button>
          </div>
        ))}
      </div>

      <TextField label="Título da seção Sobre" value={config.about?.title || ''} placeholder="Sobre" onChange={(value) => onChange(mergeNested(config, 'about', { title: value }))} />
      <TextArea label="Texto institucional" value={config.about?.text || ''} rows={7} placeholder="Conte a história e a proposta da empresa." onChange={(value) => onChange(mergeNested(config, 'about', { text: value }))} />
      <TextField label="Texto do rodapé" value={config.footer?.text || ''} placeholder="© Sua empresa" onChange={(value) => onChange(mergeNested(config, 'footer', { text: value }))} />
    </div>
  );
}

function JobsPanel({ config, onChange, jobsCount }: { config: CompanyPageConfig; onChange: (next: CompanyPageConfig) => void; jobsCount: number }) {
  return (
    <div>
      <PanelHeading title="Oportunidades" text={`${jobsCount} ${jobsCount === 1 ? 'vaga ativa está' : 'vagas ativas estão'} sincronizada${jobsCount === 1 ? '' : 's'} automaticamente. Você controla somente a apresentação.`} icon={<BriefcaseBusiness className="h-4 w-4" />} />
      <TextField label="Título" value={config.jobs?.title || ''} placeholder="Oportunidades" onChange={(value) => onChange(mergeNested(config, 'jobs', { title: value }))} />
      <TextArea label="Introdução" value={config.jobs?.intro || ''} rows={4} placeholder="Uma frase para apresentar as oportunidades." onChange={(value) => onChange(mergeNested(config, 'jobs', { intro: value }))} />
      <FieldLabel>Apresentação das vagas</FieldLabel>
      <div className="grid grid-cols-3 gap-2">{[['grid', 'Grade'], ['list', 'Lista'], ['compact', 'Compacta']].map(([value, label]) => <button key={value} type="button" onClick={() => onChange(mergeNested(config, 'jobs', { layout: value }))} className={`border-b-2 px-2 py-3 text-xs font-bold ${config.jobs?.layout === value ? 'border-stone-900 text-stone-900' : 'border-stone-100 text-stone-400'}`}>{label}</button>)}</div>
      <div className="mt-7 border-t border-stone-100 pt-5 text-xs leading-5 text-stone-500"><p><strong className="text-stone-700">Integrado:</strong> cargo, local, modelo de trabalho e salário vêm da vaga publicada. O clique continua levando ao fluxo de candidatura do PiraNegócios.</p></div>
    </div>
  );
}

function ContactPanel({ config, onChange }: { config: CompanyPageConfig; onChange: (next: CompanyPageConfig) => void }) {
  return (
    <div>
      <PanelHeading title="Contato e presença digital" text="Dados exibidos dentro do site da empresa. Os campos podem complementar o cadastro corporativo." icon={<Globe2 className="h-4 w-4" />} />
      <TextField label="Telefone" value={config.contacts?.phone || ''} onChange={(value) => onChange(mergeNested(config, 'contacts', { phone: value }))} />
      <TextField label="WhatsApp" value={config.contacts?.whatsapp || ''} onChange={(value) => onChange(mergeNested(config, 'contacts', { whatsapp: value }))} />
      <TextField label="E-mail público" value={config.contacts?.email || ''} onChange={(value) => onChange(mergeNested(config, 'contacts', { email: value }))} />
      <TextField label="Site institucional" value={config.contacts?.website || ''} onChange={(value) => onChange(mergeNested(config, 'contacts', { website: value }))} />
      <div className="mt-7 border-t border-stone-100 pt-5"><FieldLabel>Redes sociais</FieldLabel><TextField label="Instagram" value={config.socials?.instagram || ''} onChange={(value) => onChange(mergeNested(config, 'socials', { instagram: value }))} /><TextField label="LinkedIn" value={config.socials?.linkedin || ''} onChange={(value) => onChange(mergeNested(config, 'socials', { linkedin: value }))} /><TextField label="Facebook" value={config.socials?.facebook || ''} onChange={(value) => onChange(mergeNested(config, 'socials', { facebook: value }))} /><TextField label="YouTube" value={config.socials?.youtube || ''} onChange={(value) => onChange(mergeNested(config, 'socials', { youtube: value }))} /><TextField label="TikTok" value={config.socials?.tiktok || ''} onChange={(value) => onChange(mergeNested(config, 'socials', { tiktok: value }))} /></div>
      <div className="mt-7 border-t border-stone-100 pt-5"><FieldLabel>Documentos legais opcionais</FieldLabel><ToggleLine label="Termos de uso" checked={Boolean(config.legal?.termsEnabled)} onChange={(enabled) => onChange(mergeNested(config, 'legal', { termsEnabled: enabled }))} />{config.legal?.termsEnabled && <><TextField label="Título" value={config.legal?.termsTitle || ''} onChange={(value) => onChange(mergeNested(config, 'legal', { termsTitle: value }))} /><TextArea label="Conteúdo" value={config.legal?.termsBody || ''} rows={6} onChange={(value) => onChange(mergeNested(config, 'legal', { termsBody: value }))} /></>}<div className="mt-4"><ToggleLine label="Política de privacidade" checked={Boolean(config.legal?.privacyEnabled)} onChange={(enabled) => onChange(mergeNested(config, 'legal', { privacyEnabled: enabled }))} /></div>{config.legal?.privacyEnabled && <><TextField label="Título" value={config.legal?.privacyTitle || ''} onChange={(value) => onChange(mergeNested(config, 'legal', { privacyTitle: value }))} /><TextArea label="Conteúdo" value={config.legal?.privacyBody || ''} rows={6} onChange={(value) => onChange(mergeNested(config, 'legal', { privacyBody: value }))} /></>}</div>
    </div>
  );
}

function CodeStudio({ config, onChange, codeTab, setCodeTab, access, onBack }: { config: CompanyPageConfig; onChange: (next: CompanyPageConfig) => void; codeTab: CodeTab; setCodeTab: (tab: CodeTab) => void; access: any; onBack: () => void }) {
  const code = config.codePage || {};
  const value = codeTab === 'html' ? code.html || '' : codeTab === 'css' ? code.css || '' : code.js || '';
  const update = (nextValue: string) => onChange({ ...config, editorMode: 'code', codePage: { ...code, [codeTab]: nextValue } });
  return (
    <div>
      <PanelHeading title="Código livre" text="Construa qualquer visual usando HTML, CSS e JavaScript. Os componentes integrados injetam os dados oficiais e as vagas." icon={<Code2 className="h-4 w-4" />} />
      <div className="mb-5 flex items-center justify-between gap-3 border-y border-violet-100 bg-violet-50 px-3 py-2 text-[10px] font-semibold text-violet-700"><span>{access?.advancedEditor?.testMode ? 'Editor avançado liberado durante os testes.' : 'Editor avançado · Empresa Plus'}</span><button type="button" onClick={onBack} className="font-bold underline">Voltar ao visual</button></div>
      <div className="mb-3 flex gap-5 border-b border-stone-200">{(['html', 'css', 'js'] as CodeTab[]).map((tab) => <button key={tab} type="button" onClick={() => setCodeTab(tab)} className={`border-b-2 pb-2 text-xs font-bold uppercase ${codeTab === tab ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400'}`}>{tab}</button>)}</div>
      <textarea value={value} onChange={(event) => update(event.target.value)} spellCheck={false} className="min-h-[520px] w-full resize-y border-0 bg-[#151515] p-4 font-mono text-xs leading-6 text-stone-100 outline-none" />
      <div className="mt-5 border-t border-stone-100 pt-4 text-[11px] leading-5 text-stone-500"><p className="font-bold text-stone-700">Componentes integrados obrigatórios</p><code className="mt-2 block whitespace-pre-wrap">&lt;pn-company-name&gt; · &lt;pn-company-address&gt; · &lt;pn-verification-badge&gt; · &lt;pn-jobs&gt;</code><p className="mt-2">O selo só aparece quando a empresa estiver realmente verificada. Ele é visual, sem a palavra “Verificada”.</p></div>
    </div>
  );
}

function FieldLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`mb-2 text-[10px] font-bold uppercase tracking-[.15em] text-stone-400 ${className}`}>{children}</p>;
}

function TextField({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold text-stone-600">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full border-0 border-b border-stone-200 bg-transparent px-0 py-2 text-sm outline-none transition focus:border-stone-900" /></label>;
}

function TextArea({ label, value, onChange, rows = 4, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; rows?: number; placeholder?: string }) {
  return <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold text-stone-600">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} placeholder={placeholder} className="w-full resize-y border-0 border-b border-stone-200 bg-transparent px-0 py-2 text-sm leading-6 outline-none transition focus:border-stone-900" /></label>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="mb-1.5 block text-xs font-semibold text-stone-600">{label}</span><div className="flex items-center gap-2 border-b border-stone-200 py-2"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-7 w-7 cursor-pointer border-0 bg-transparent p-0" /><input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent font-mono text-xs uppercase outline-none" /></div></label>;
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full border-0 border-b border-stone-200 bg-transparent px-0 py-2.5 text-sm font-medium outline-none focus:border-stone-900">{options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select>;
}

function ToggleLine({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between gap-4 border-b border-stone-100 py-3"><span className="text-sm font-medium text-stone-700">{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-stone-900" /></label>;
}
