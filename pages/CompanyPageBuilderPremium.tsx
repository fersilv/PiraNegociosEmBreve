import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Code2,
  Copy,
  Eye,
  FileText,
  Globe2,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  Lock,
  MonitorSmartphone,
  Palette,
  Save,
  Send,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  WandSparkles,
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

type VisualTab = 'templates' | 'layout' | 'content' | 'contact' | 'legal';
type CodeTab = 'html' | 'css' | 'js';

const VISUAL_TABS: Array<{ key: VisualTab; label: string; icon: React.ReactNode }> = [
  { key: 'templates', label: 'Modelos', icon: <LayoutTemplate className="h-4 w-4" /> },
  { key: 'layout', label: 'Aparência', icon: <Palette className="h-4 w-4" /> },
  { key: 'content', label: 'Componentes', icon: <LayoutGrid className="h-4 w-4" /> },
  { key: 'contact', label: 'Contato', icon: <Share2 className="h-4 w-4" /> },
  { key: 'legal', label: 'Legal', icon: <FileText className="h-4 w-4" /> },
];

const SECTION_LABELS: Record<string, string> = {
  identity: 'Identidade da empresa',
  about: 'Sobre a empresa',
  contact: 'Contato',
  socials: 'Redes sociais',
  jobs: 'Vagas abertas',
  legal: 'Termos e privacidade',
};

const REQUIRED_CODE_COMPONENTS = [
  { tag: 'pn-company-name', label: 'Nome da empresa', required: true },
  { tag: 'pn-company-address', label: 'Endereço', required: true },
  { tag: 'pn-verification-badge', label: 'Selo de verificação', required: true },
  { tag: 'pn-jobs', label: 'Vagas abertas', required: true },
  { tag: 'pn-company-logo', label: 'Logo', required: false },
  { tag: 'pn-company-about', label: 'Descrição', required: false },
  { tag: 'pn-company-phone', label: 'Telefone', required: false },
  { tag: 'pn-company-website', label: 'Site', required: false },
  { tag: 'pn-social-links', label: 'Redes sociais', required: false },
] as const;

const DEFAULT_CODE_HTML = `<main class="site-shell">
  <section class="hero">
    <div class="hero-grid">
      <div>
        <div class="brand-row">
          <pn-company-logo class="logo"></pn-company-logo>
          <pn-verification-badge></pn-verification-badge>
        </div>
        <p class="eyebrow">Página oficial</p>
        <pn-company-name class="company-name"></pn-company-name>
        <pn-company-address class="company-address"></pn-company-address>
      </div>
      <aside class="hero-card">
        <span class="hero-card-label">Sobre</span>
        <pn-company-about></pn-company-about>
      </aside>
    </div>
  </section>

  <section class="content-section">
    <div class="section-heading">
      <span>Oportunidades</span>
      <h2>Venha construir com a gente.</h2>
    </div>
    <pn-jobs></pn-jobs>
  </section>

  <section class="contact-strip">
    <div>
      <span class="contact-label">Contato</span>
      <pn-company-phone></pn-company-phone>
    </div>
    <pn-company-website></pn-company-website>
    <pn-social-links></pn-social-links>
  </section>
</main>`;

const DEFAULT_CODE_CSS = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');

:root { --ink:#161412; --paper:#f5f1eb; --accent:#b54e38; --muted:#726b64; }
body { background:var(--paper); color:var(--ink); font-family:'DM Sans',sans-serif; }
.site-shell { width:min(1240px,calc(100% - 32px)); margin:16px auto 48px; }
.hero { position:relative; overflow:hidden; border:1px solid rgba(31,27,24,.08); border-radius:36px; background:linear-gradient(145deg,#fff 0%,#faf4ed 55%,#ead8ca 100%); box-shadow:0 35px 100px rgba(50,35,25,.12); }
.hero::after { content:''; position:absolute; width:380px; height:380px; right:-100px; bottom:-170px; border-radius:50%; background:radial-gradient(circle,rgba(181,78,56,.35),transparent 68%); filter:blur(8px); }
.hero-grid { position:relative; z-index:1; display:grid; grid-template-columns:1.2fr .8fr; gap:56px; align-items:end; min-height:520px; padding:56px; }
.brand-row { display:flex; align-items:center; gap:14px; margin-bottom:72px; }
.logo { width:68px; height:68px; overflow:hidden; border-radius:20px; background:#fff; padding:4px; box-shadow:0 14px 38px rgba(0,0,0,.10); }
.eyebrow,.hero-card-label,.contact-label,.section-heading span { display:block; margin-bottom:13px; color:var(--accent); font-size:11px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; }
.company-name { max-width:760px; font-family:'Manrope',sans-serif; font-size:clamp(52px,7vw,94px); font-weight:800; letter-spacing:-.065em; line-height:.9; }
.company-address { margin-top:24px; color:var(--muted); font-size:14px; font-weight:600; }
.hero-card { padding:28px; border:1px solid rgba(255,255,255,.7); border-radius:28px; background:rgba(255,255,255,.55); backdrop-filter:blur(18px); box-shadow:0 18px 50px rgba(42,30,22,.08); color:#554d47; line-height:1.8; }
.content-section { padding:90px 12px 52px; }
.section-heading { display:grid; grid-template-columns:180px 1fr; gap:28px; align-items:start; margin-bottom:34px; }
.section-heading h2 { margin:0; max-width:700px; font-family:'Manrope',sans-serif; font-size:clamp(34px,5vw,62px); line-height:.98; letter-spacing:-.055em; }
pn-jobs .pn-jobs-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
pn-jobs .pn-job { border-radius:24px; padding:23px; }
.contact-strip { display:grid; grid-template-columns:1fr 1fr 1fr; gap:22px; align-items:center; padding:30px; border-radius:28px; background:#171513; color:#fff; }
.contact-strip a { color:#fff; }
pn-social-links .pn-socials { justify-content:flex-end; }
pn-social-links a { padding:8px 12px; border:1px solid rgba(255,255,255,.12); border-radius:999px; }
@media(max-width:800px){ .site-shell{width:min(100% - 20px,1240px);margin-top:10px}.hero-grid{grid-template-columns:1fr;min-height:auto;padding:30px;gap:40px}.brand-row{margin-bottom:55px}.company-name{font-size:clamp(46px,14vw,70px)}.content-section{padding:64px 4px 40px}.section-heading{grid-template-columns:1fr;gap:8px}pn-jobs .pn-jobs-grid{grid-template-columns:1fr}.contact-strip{grid-template-columns:1fr;padding:24px}pn-social-links .pn-socials{justify-content:flex-start} }`;

const DEFAULT_CODE_JS = `// O JavaScript roda isolado do PiraNegócios.
// Use para animações e interações da sua página.
document.querySelectorAll('.pn-job').forEach((card, index) => {
  card.style.animationDelay = (index * 70) + 'ms';
});`;

function nested(config: CompanyPageConfig, key: keyof CompanyPageConfig, patch: Record<string, unknown>): CompanyPageConfig {
  return { ...config, [key]: { ...((config[key] as Record<string, unknown>) || {}), ...patch } };
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
  const [visualTab, setVisualTab] = useState<VisualTab>('templates');
  const [codeTab, setCodeTab] = useState<CodeTab>('html');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copiedTag, setCopiedTag] = useState('');

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [companyResponse, pageResponse] = await Promise.all([
          api.get(`/companies/${companyId}`),
          api.get(`/companies/${companyId}/page`),
        ]);
        if (!active) return;
        const nextCompany = companyResponse.data;
        const nextPage = pageResponse.data;
        setCompany(nextCompany);
        setConfig(nextPage.draft || {});
        setStatus(nextPage.status || 'DRAFT');
        setRevision(Number(nextPage.revision || 1));
        setPublishedAt(nextPage.publishedAt || null);
        setValidation(nextPage.validation || null);
        setAccess(nextPage.access || null);
        if (nextCompany?.slug) {
          try {
            const publicResponse = await api.get(`/public/companies/${nextCompany.slug}`);
            if (active) setJobs(Array.isArray(publicResponse.data?.jobs) ? publicResponse.data.jobs : []);
          } catch { if (active) setJobs([]); }
        }
      } catch (loadError: any) {
        if (active) setError(loadError?.response?.data?.message || 'Não foi possível carregar o editor da página.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [companyId]);

  const mode: CompanyEditorMode = config?.editorMode === 'code' ? 'code' : 'visual';
  const sections = useMemo(() => Array.isArray(config?.sections) ? config!.sections! : [], [config]);
  const codeHtml = config?.codePage?.html || '';
  const missingCodeComponents = useMemo(() => REQUIRED_CODE_COMPONENTS.filter((item) => item.required && !new RegExp(`<${item.tag}(?:\\s|>)`, 'i').test(codeHtml)), [codeHtml]);

  const patch = (next: CompanyPageConfig) => { setConfig(next); setMessage(''); setError(''); };

  const switchMode = (nextMode: CompanyEditorMode) => {
    if (!config) return;
    if (nextMode === 'code') {
      patch({
        ...config,
        editorMode: 'code',
        codePage: {
          html: config.codePage?.html || DEFAULT_CODE_HTML,
          css: config.codePage?.css || DEFAULT_CODE_CSS,
          js: config.codePage?.js || DEFAULT_CODE_JS,
        },
      });
    } else patch({ ...config, editorMode: 'visual' });
  };

  const updateSection = (id: string, values: Partial<CompanyPageSection>) => {
    if (!config) return;
    patch({ ...config, sections: sections.map((section) => section.id === id ? { ...section, ...values } : section) });
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    if (!config) return;
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    patch({ ...config, sections: next });
  };

  const saveDraft = async () => {
    if (!companyId || !config || saving) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await api.put(`/companies/${companyId}/page/draft`, { config });
      setConfig(response.data.draft || config);
      setValidation(response.data.validation || null);
      setMessage('Rascunho salvo. Sua página pública continua exatamente como estava.');
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Não foi possível salvar o rascunho.');
    } finally { setSaving(false); }
  };

  const openPreview = async () => {
    if (!companyId || !config || previewing) return;
    setPreviewing(true); setError('');
    const previewWindow = window.open('', '_blank');
    try {
      const response = await api.post(`/companies/${companyId}/page/preview`, { config });
      setValidation(response.data.validation || validation);
      const url = `${window.location.origin}${response.data.url}`;
      if (previewWindow) previewWindow.location.href = url;
      else window.open(url, '_blank', 'noopener,noreferrer');
    } catch (previewError: any) {
      previewWindow?.close();
      setError(previewError?.response?.data?.message || 'Não foi possível criar a prévia temporária.');
    } finally { setPreviewing(false); }
  };

  const publish = async () => {
    if (!companyId || !config || publishing) return;
    setPublishing(true); setError(''); setMessage('');
    try {
      const response = await api.post(`/companies/${companyId}/page/publish`, { config });
      setConfig(response.data.draft || config);
      setValidation(response.data.validation || null);
      setStatus('PUBLISHED');
      setRevision(Number(response.data.revision || revision));
      setPublishedAt(response.data.publishedAt || new Date().toISOString());
      setMessage('Publicado. Esta é agora a versão oficial da página da empresa.');
    } catch (publishError: any) {
      const payload = publishError?.response?.data;
      const details = payload?.validation || payload?.message?.validation;
      const warnings = details?.warnings;
      setValidation(details || validation);
      setError(Array.isArray(warnings) && warnings.length ? warnings.join(' ') : (typeof payload?.message === 'string' ? payload.message : 'A página ainda não pode ser publicada.'));
    } finally { setPublishing(false); }
  };

  const copyComponent = async (tag: string) => {
    const value = `<${tag}></${tag}>`;
    try { await navigator.clipboard.writeText(value); } catch { /* browser may deny clipboard */ }
    setCopiedTag(tag);
    window.setTimeout(() => setCopiedTag(''), 1200);
  };

  if (!companyId) return <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-amber-900">Cadastre ou vincule uma empresa antes de criar a página pública.</div>;
  if (loading || !config || !company) return <div className="flex min-h-[55vh] items-center justify-center text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Preparando o estúdio...</div>;

  return (
    <div className="mx-auto max-w-[1700px] space-y-5">
      <header className="relative overflow-hidden rounded-[32px] border border-stone-200 bg-[#171513] p-5 text-white shadow-[0_26px_80px_rgba(45,33,26,.18)] sm:p-7">
        <div className="absolute -right-28 -top-36 h-96 w-96 rounded-full bg-terracotta-500/25 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/[.07] px-3 py-1 text-[9px] font-black uppercase tracking-[.2em] text-white/55">PiraNegócios Business</span>
              <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[.15em] ${status === 'PUBLISHED' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-300/15 text-amber-200'}`}>{status === 'PUBLISHED' ? `Publicado · v${revision}` : 'Rascunho privado'}</span>
            </div>
            <h1 className="mt-4 font-serif text-4xl font-black tracking-[-.04em] sm:text-5xl">Minha Página</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50">Seu site empresarial dentro do PiraNegócios. Use o editor visual ou assuma o controle completo do HTML, CSS e JavaScript.</p>
            {publishedAt && <p className="mt-2 text-[10px] font-bold text-white/30">Última publicação: {new Date(publishedAt).toLocaleString('pt-BR')}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void saveDraft()} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[.06] px-4 py-3 text-xs font-black text-white/75 transition hover:bg-white/[.1] disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar</button>
            <button onClick={() => void openPreview()} disabled={previewing} className="inline-flex items-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-400/10 px-4 py-3 text-xs font-black text-violet-100 transition hover:bg-violet-400/15 disabled:opacity-50">{previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Prévia</button>
            <button onClick={() => void publish()} disabled={publishing} className="inline-flex items-center gap-2 rounded-2xl bg-[#ef7f5c] px-5 py-3 text-xs font-black text-white shadow-[0_14px_35px_rgba(239,127,92,.25)] transition hover:-translate-y-0.5 disabled:opacity-50">{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publicar</button>
          </div>
        </div>
      </header>

      {(message || error) && <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || message}</div>}

      <div className="grid gap-5 2xl:grid-cols-[470px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[30px] border border-stone-200 bg-white shadow-[0_18px_60px_rgba(50,40,32,.08)]">
          <div className="border-b border-stone-200 p-3">
            <div className="grid grid-cols-2 gap-2 rounded-[18px] bg-stone-100 p-1.5">
              <button type="button" onClick={() => switchMode('visual')} className={`flex items-center justify-center gap-2 rounded-[14px] px-3 py-3 text-xs font-black transition ${mode === 'visual' ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-500'}`}><WandSparkles className="h-4 w-4" /> Editor visual</button>
              <button type="button" onClick={() => switchMode('code')} className={`relative flex items-center justify-center gap-2 rounded-[14px] px-3 py-3 text-xs font-black transition ${mode === 'code' ? 'bg-[#171513] text-white shadow-sm' : 'text-stone-500'}`}><Code2 className="h-4 w-4" /> Código <span className="absolute -right-1 -top-2 rounded-full bg-violet-600 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider text-white">Plus</span></button>
            </div>
            {mode === 'code' && <div className="mt-2 flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-[10px] font-bold text-violet-700"><Sparkles className="h-3.5 w-3.5" /> {access?.advancedEditor?.testMode ? 'Recurso Plus liberado durante os testes.' : 'Recurso do plano Empresa Plus.'}</div>}
          </div>

          {mode === 'visual' ? (
            <>
              <div className="overflow-x-auto border-b border-stone-200 bg-[#fbfaf8] p-2"><div className="flex min-w-max gap-1">{VISUAL_TABS.map((item) => <button key={item.key} onClick={() => setVisualTab(item.key)} className={`flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[10px] font-black transition ${visualTab === item.key ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-500 hover:bg-white hover:text-stone-900'}`}>{item.icon}{item.label}</button>)}</div></div>
              <div className="max-h-[calc(100vh-250px)] overflow-y-auto p-5 sm:p-6">
                {visualTab === 'templates' && <TemplateGallery config={config} onChange={patch} />}
                {visualTab === 'layout' && <AppearancePanel config={config} onChange={patch} />}
                {visualTab === 'content' && <ComponentsPanel config={config} sections={sections} updateSection={updateSection} moveSection={moveSection} />}
                {visualTab === 'contact' && <ContactPanel config={config} onChange={patch} />}
                {visualTab === 'legal' && <LegalPanel config={config} onChange={patch} />}
              </div>
            </>
          ) : (
            <CodeStudio
              config={config}
              onChange={patch}
              activeTab={codeTab}
              setActiveTab={setCodeTab}
              missing={missingCodeComponents}
              copyComponent={copyComponent}
              copiedTag={copiedTag}
            />
          )}
        </aside>

        <section className="min-w-0 rounded-[30px] border border-stone-200 bg-[#d9d6d0] p-3 shadow-inner sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-stone-500">Preview ao vivo</p><p className="mt-0.5 text-xs text-stone-500">Mesma renderização usada na prévia temporária e na página publicada.</p></div>
            <span className="hidden items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-stone-500 sm:inline-flex"><MonitorSmartphone className="h-3.5 w-3.5" /> {mode === 'code' ? 'Código completo' : config.templateKey || 'Aurora'}</span>
          </div>
          <div className="max-h-[calc(100vh-205px)] overflow-auto rounded-[24px] bg-white shadow-[0_30px_90px_rgba(45,37,31,.20)]"><CompanySiteRenderer company={company} jobs={jobs} page={config} preview /></div>
        </section>
      </div>
    </div>
  );
}

function PanelTitle({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div><div className="flex items-center gap-2 text-stone-900">{icon}<h2 className="font-black tracking-[-.02em]">{title}</h2></div><p className="mt-1 text-xs leading-5 text-stone-500">{text}</p></div>; }
function Field({ label, value, onChange, placeholder = '' }: { label: string; value?: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.14em] text-stone-500">{label}</span><input value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-[14px] border border-stone-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100" /></label>; }
function TextArea({ label, value, onChange, rows = 6 }: { label: string; value?: string; onChange: (value: string) => void; rows?: number }) { return <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.14em] text-stone-500">{label}</span><textarea rows={rows} value={value || ''} onChange={(event) => onChange(event.target.value)} className="w-full resize-y rounded-[14px] border border-stone-200 bg-white px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100" /></label>; }
function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) { return <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 rounded-[18px] border border-stone-200 bg-[#fbfaf8] p-3 text-left"><span className={`h-7 w-12 shrink-0 rounded-full p-1 transition ${checked ? 'bg-terracotta-600' : 'bg-stone-300'}`}><span className={`block h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : ''}`} /></span><span><span className="block text-sm font-black text-stone-800">{label}</span>{description && <span className="mt-0.5 block text-[11px] leading-4 text-stone-500">{description}</span>}</span></button>; }

function TemplateGallery({ config, onChange }: { config: CompanyPageConfig; onChange: (config: CompanyPageConfig) => void }) {
  return <div className="space-y-5"><PanelTitle icon={<LayoutTemplate className="h-4 w-4" />} title="Coleção PiraNegócios" text="Modelos desenhados como sites reais. A escolha troca a linguagem visual, sem apagar o conteúdo da empresa." /><div className="space-y-4">{COMPANY_PAGE_TEMPLATES.map((template) => { const selected = config.templateKey === template.key || (!config.templateKey && template.key === 'horizon'); return <button key={template.key} onClick={() => onChange({ ...config, templateKey: template.key })} className={`group w-full overflow-hidden rounded-[24px] border text-left transition ${selected ? 'border-terracotta-400 bg-terracotta-50/40 ring-2 ring-terracotta-100' : 'border-stone-200 bg-white hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-xl'}`}><TemplateMiniature template={template.key} /><div className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[8px] font-black uppercase tracking-[.18em] text-stone-400">{template.eyebrow}</p><h3 className="mt-1 text-base font-black tracking-[-.025em] text-stone-950">{template.name}</h3></div>{selected && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-terracotta-600 text-white"><Check className="h-4 w-4" /></span>}</div><p className="mt-2 text-[11px] leading-5 text-stone-500">{template.description}</p><p className="mt-3 border-t border-stone-100 pt-3 text-[10px] font-bold text-stone-400">Ideal para: {template.bestFor}</p></div></button>; })}</div><div className="rounded-[20px] border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4"><div className="flex items-center gap-2 text-violet-900"><Sparkles className="h-4 w-4" /><p className="text-sm font-black">Marketplace preparado</p></div><p className="mt-1 text-[11px] leading-5 text-violet-700">A galeria já trabalha por chave de template. Depois entram modelos de designers, licença, preço, preview e instalação.</p></div></div>;
}

function TemplateMiniature({ template }: { template: string }) {
  if (template === 'noir') return <div className="h-40 bg-[#111113] p-4"><div className="flex items-center justify-between"><div className="h-5 w-5 rounded-md bg-white"/><div className="h-3 w-16 rounded-full bg-white/10"/></div><div className="mt-12 h-4 w-20 rounded-full bg-white/10"/><div className="mt-3 h-7 w-4/5 rounded-lg bg-white"/><div className="mt-2 h-7 w-2/3 rounded-lg bg-white"/><div className="mt-5 flex gap-2"><div className="h-12 flex-1 rounded-xl bg-white/[.06]"/><div className="h-12 flex-1 rounded-xl bg-white/[.06]"/></div></div>;
  if (template === 'atlas') return <div className="grid h-40 grid-cols-[.8fr_1.2fr] bg-slate-950"><div className="border-r border-white/10 p-4"><div className="h-6 w-6 rounded-lg bg-white"/><div className="mt-14 h-4 w-4/5 rounded bg-white"/><div className="mt-2 h-4 w-2/3 rounded bg-white"/></div><div className="flex items-end p-4"><div className="w-full"><div className="h-1 w-10 bg-orange-400"/><div className="mt-4 h-3 w-full rounded bg-white/30"/><div className="mt-2 h-3 w-4/5 rounded bg-white/20"/><div className="mt-2 h-3 w-2/3 rounded bg-white/20"/></div></div></div>;
  if (template === 'pulse') return <div className="h-40 bg-gradient-to-br from-emerald-950 via-orange-600 to-rose-400 p-4"><div className="flex gap-2"><div className="h-6 w-6 rounded-lg bg-white"/><div className="h-3 w-14 rounded-full bg-white/20"/></div><div className="mt-9 h-4 w-20 rounded bg-white/50"/><div className="mt-2 h-7 w-4/5 rounded-lg bg-white"/><div className="mt-2 h-7 w-3/5 rounded-lg bg-white"/><div className="mt-5 grid grid-cols-2 gap-2"><div className="h-8 rounded-lg bg-white/90"/><div className="h-8 rounded-lg bg-white/90"/></div></div>;
  if (template === 'canvas') return <div className="h-40 bg-[#f4efe6] p-4"><div className="flex items-center gap-2"><div className="h-6 w-6 rounded-full bg-stone-900"/><div className="h-2 w-16 bg-stone-300"/></div><div className="mt-8 h-8 w-4/5 bg-stone-900"/><div className="mt-2 h-8 w-3/5 bg-stone-900"/><div className="mt-6 grid grid-cols-[.4fr_1fr] gap-4 border-t border-stone-300 pt-3"><div className="h-2 w-16 bg-stone-400"/><div><div className="h-2 w-full bg-stone-300"/><div className="mt-2 h-2 w-5/6 bg-stone-300"/></div></div></div>;
  return <div className="relative h-40 overflow-hidden bg-gradient-to-br from-white via-[#fbf4ec] to-[#ead1bf] p-4"><div className="absolute -bottom-12 -right-8 h-28 w-28 rounded-full bg-orange-300/50 blur-2xl"/><div className="relative flex items-center gap-2"><div className="h-6 w-6 rounded-lg bg-stone-900"/><div className="h-3 w-16 rounded-full bg-emerald-100"/></div><div className="relative mt-8 h-3 w-20 rounded bg-stone-300"/><div className="relative mt-2 h-7 w-4/5 rounded-lg bg-stone-900"/><div className="relative mt-2 h-7 w-2/3 rounded-lg bg-stone-900"/><div className="relative mt-5 ml-auto h-10 w-2/5 rounded-xl border border-white bg-white/60"/></div>;
}

function AppearancePanel({ config, onChange }: { config: CompanyPageConfig; onChange: (config: CompanyPageConfig) => void }) {
  const cover=config.cover||{};
  return <div className="space-y-5"><PanelTitle icon={<Palette className="h-4 w-4" />} title="Direção visual" text="Ajustes finos para adaptar o modelo à identidade da empresa." /><div><p className="mb-2 text-[9px] font-black uppercase tracking-[.14em] text-stone-500">Largura</p><div className="grid grid-cols-2 gap-2">{[['compact','Compacta'],['standard','Padrão'],['wide','Ampla'],['full','Tela inteira']].map(([value,label]) => <button key={value} onClick={() => onChange({ ...config, width:value as any })} className={`rounded-[14px] border px-3 py-2.5 text-xs font-black ${config.width===value?'border-stone-900 bg-stone-900 text-white':'border-stone-200 bg-white text-stone-600'}`}>{label}</button>)}</div></div><div className="grid grid-cols-2 gap-3">{[['primary','Principal','#b84f38'],['accent','Acento','#2f4f46'],['background','Fundo','#f8f5f0'],['text','Texto','#201d1b']].map(([key,label,fallback]) => <label key={key} className="text-[9px] font-black uppercase tracking-[.12em] text-stone-500">{label}<input type="color" value={(config.theme as any)?.[key] || fallback} onChange={(e)=>onChange(nested(config,'theme',{[key]:e.target.value}))} className="mt-2 h-12 w-full rounded-[14px] border border-stone-200 bg-white p-1.5" /></label>)}</div><Toggle label="Foto de capa" description="Opcional. Os modelos continuam bonitos mesmo sem imagem." checked={Boolean(cover.enabled)} onChange={(checked)=>onChange(nested(config,'cover',{enabled:checked}))}/>{cover.enabled && <div className="space-y-3 rounded-[20px] border border-stone-200 bg-stone-50 p-4"><FileUpload label="Imagem de capa" accept="image/*" value={cover.url || ''} onChange={(value)=>onChange(nested(config,'cover',{url:value}))} maxSizeKB={3072} placeholder="Envie uma imagem horizontal em alta qualidade" /><div className="grid grid-cols-2 gap-3"><label className="text-[9px] font-black uppercase text-stone-500">Altura<select value={cover.height || 'medium'} onChange={(e)=>onChange(nested(config,'cover',{height:e.target.value}))} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm"><option value="small">Baixa</option><option value="medium">Média</option><option value="large">Alta</option></select></label><label className="text-[9px] font-black uppercase text-stone-500">Contraste · {Number(cover.overlay ?? 28)}%<input type="range" min="0" max="75" value={Number(cover.overlay ?? 28)} onChange={(e)=>onChange(nested(config,'cover',{overlay:Number(e.target.value)}))} className="mt-4 w-full" /></label></div></div>}</div>;
}

function ComponentsPanel({ config, sections, updateSection, moveSection }: { config: CompanyPageConfig; sections: CompanyPageSection[]; updateSection:(id:string,v:Partial<CompanyPageSection>)=>void; moveSection:(i:number,d:-1|1)=>void }) {
  return <div className="space-y-5"><PanelTitle icon={<Settings2 className="h-4 w-4" />} title="Estrutura da página" text="Ative, oculte e ordene os blocos. Identidade e vagas permanecem obrigatórios." /><TextArea label="Sobre a empresa" value={config.about?.text} onChange={(v)=>{ /* handled below */ }} rows={0} />{sections.map((section,index)=><div key={section.id} className="flex items-center gap-3 rounded-[18px] border border-stone-200 bg-[#fbfaf8] p-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-black text-stone-800">{SECTION_LABELS[section.type] || section.type}</p>{section.locked && <span className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-2 py-0.5 text-[8px] font-black uppercase text-stone-600"><Lock className="h-2.5 w-2.5" /> obrigatório</span>}</div></div><button disabled={section.locked} onClick={()=>updateSection(section.id,{enabled:section.locked?true:section.enabled===false})} className={`h-7 w-12 rounded-full p-1 transition ${section.enabled!==false?'bg-terracotta-600':'bg-stone-300'} disabled:opacity-70`}><span className={`block h-5 w-5 rounded-full bg-white shadow transition ${section.enabled!==false?'translate-x-5':''}`} /></button><div className="flex flex-col"><button disabled={index===0} onClick={()=>moveSection(index,-1)} className="p-1 text-stone-400 disabled:opacity-20"><ArrowUp className="h-3.5 w-3.5" /></button><button disabled={index===sections.length-1} onClick={()=>moveSection(index,1)} className="p-1 text-stone-400 disabled:opacity-20"><ArrowDown className="h-3.5 w-3.5" /></button></div></div>)}</div>;
}

function ContactPanel({ config, onChange }: { config: CompanyPageConfig; onChange:(config:CompanyPageConfig)=>void }) { const c=config.contacts||{},s=config.socials||{}; return <div className="space-y-5"><PanelTitle icon={<Globe2 className="h-4 w-4" />} title="Contato e redes" text="Use informações específicas da página sem alterar os dados cadastrais da empresa." /><div className="space-y-3"><Field label="Telefone principal" value={c.phone} onChange={(v)=>onChange(nested(config,'contacts',{phone:v}))}/><Field label="Segundo telefone" value={c.secondaryPhone} onChange={(v)=>onChange(nested(config,'contacts',{secondaryPhone:v}))}/><Field label="WhatsApp" value={c.whatsapp} onChange={(v)=>onChange(nested(config,'contacts',{whatsapp:v}))}/><Field label="E-mail público" value={c.email} onChange={(v)=>onChange(nested(config,'contacts',{email:v}))}/><Field label="Site externo" value={c.website} onChange={(v)=>onChange(nested(config,'contacts',{website:v}))}/></div><div className="border-t border-stone-200 pt-5"><p className="mb-3 text-[9px] font-black uppercase tracking-[.14em] text-stone-500">Redes sociais</p><div className="space-y-3"><Field label="Instagram" value={s.instagram} onChange={(v)=>onChange(nested(config,'socials',{instagram:v}))}/><Field label="LinkedIn" value={s.linkedin} onChange={(v)=>onChange(nested(config,'socials',{linkedin:v}))}/><Field label="Facebook" value={s.facebook} onChange={(v)=>onChange(nested(config,'socials',{facebook:v}))}/><Field label="YouTube" value={s.youtube} onChange={(v)=>onChange(nested(config,'socials',{youtube:v}))}/><Field label="TikTok" value={s.tiktok} onChange={(v)=>onChange(nested(config,'socials',{tiktok:v}))}/></div></div><div className="border-t border-stone-200 pt-5"><TextArea label="Texto sobre a empresa" value={config.about?.text} onChange={(v)=>onChange(nested(config,'about',{text:v}))} rows={8}/></div></div>; }

function LegalPanel({ config, onChange }: { config: CompanyPageConfig; onChange:(config:CompanyPageConfig)=>void }) { const legal=config.legal||{}; return <div className="space-y-5"><PanelTitle icon={<ShieldCheck className="h-4 w-4" />} title="Termos e privacidade" text="Quando ativados, os documentos ganham páginas próprias dentro do endereço da empresa." /><Toggle label="Termos de uso" checked={Boolean(legal.termsEnabled)} onChange={(v)=>onChange(nested(config,'legal',{termsEnabled:v}))}/>{legal.termsEnabled && <div className="space-y-3"><Field label="Título" value={legal.termsTitle} onChange={(v)=>onChange(nested(config,'legal',{termsTitle:v}))}/><TextArea label="Conteúdo" value={legal.termsBody} onChange={(v)=>onChange(nested(config,'legal',{termsBody:v}))} rows={12}/></div>}<Toggle label="Política de privacidade" checked={Boolean(legal.privacyEnabled)} onChange={(v)=>onChange(nested(config,'legal',{privacyEnabled:v}))}/>{legal.privacyEnabled && <div className="space-y-3"><Field label="Título" value={legal.privacyTitle} onChange={(v)=>onChange(nested(config,'legal',{privacyTitle:v}))}/><TextArea label="Conteúdo" value={legal.privacyBody} onChange={(v)=>onChange(nested(config,'legal',{privacyBody:v}))} rows={12}/></div>}</div>; }

function CodeStudio({ config, onChange, activeTab, setActiveTab, missing, copyComponent, copiedTag }: { config: CompanyPageConfig; onChange:(config:CompanyPageConfig)=>void; activeTab:CodeTab; setActiveTab:(tab:CodeTab)=>void; missing:ReadonlyArray<{tag:string;label:string;required:boolean}>; copyComponent:(tag:string)=>void; copiedTag:string }) {
  const code=config.codePage||{};
  const value=code[activeTab]||'';
  const placeholder=activeTab==='html'?'<main>Seu site completo...</main>':activeTab==='css'?'/* CSS da página inteira */':'// JavaScript da página inteira';
  return <div className="max-h-[calc(100vh-250px)] overflow-y-auto p-5 sm:p-6"><div className="space-y-5"><PanelTitle icon={<Code2 className="h-4 w-4" />} title="Código do site inteiro" text="Aqui você controla toda a página. Os componentes PiraNegócios são dados vivos que você posiciona e estiliza como qualquer elemento HTML." /><div className={`rounded-[18px] border p-4 ${missing.length?'border-amber-200 bg-amber-50':'border-emerald-200 bg-emerald-50'}`}><div className="flex items-start gap-2"><ShieldCheck className={`mt-0.5 h-4 w-4 shrink-0 ${missing.length?'text-amber-700':'text-emerald-700'}`} /><div><p className={`text-xs font-black ${missing.length?'text-amber-900':'text-emerald-900'}`}>{missing.length?`${missing.length} componente(s) obrigatório(s) faltando`:'Estrutura obrigatória completa'}</p><p className={`mt-1 text-[10px] leading-4 ${missing.length?'text-amber-800':'text-emerald-700'}`}>Você pode mudar posição, tamanho, cor, tipografia e layout. A publicação só exige que nome, endereço, selo e vagas estejam presentes.</p></div></div></div><div><div className="mb-2 flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-[.16em] text-stone-500">Componentes disponíveis</p><span className="text-[9px] font-bold text-stone-400">Clique para copiar</span></div><div className="grid gap-2 sm:grid-cols-2">{REQUIRED_CODE_COMPONENTS.map((item)=>{const absent=missing.some((entry)=>entry.tag===item.tag);return <button key={item.tag} type="button" onClick={()=>void copyComponent(item.tag)} className={`rounded-[14px] border p-3 text-left transition hover:-translate-y-0.5 ${absent?'border-amber-200 bg-amber-50':'border-stone-200 bg-white hover:shadow-md'}`}><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black text-stone-800">{item.label}</span>{item.required?<span className={`rounded-full px-1.5 py-0.5 text-[7px] font-black uppercase ${absent?'bg-amber-200 text-amber-900':'bg-stone-100 text-stone-500'}`}>Obrigatório</span>:null}</div><code className="mt-1.5 block truncate text-[9px] text-violet-700">&lt;{item.tag}&gt;</code>{copiedTag===item.tag && <span className="mt-1 inline-flex items-center gap-1 text-[8px] font-black text-emerald-700"><Copy className="h-2.5 w-2.5"/> copiado</span>}</button>})}</div></div><div className="grid grid-cols-3 gap-1 rounded-[14px] bg-stone-100 p-1">{(['html','css','js'] as const).map((key)=><button key={key} onClick={()=>setActiveTab(key)} className={`rounded-[11px] px-3 py-2.5 text-[10px] font-black uppercase tracking-wider ${activeTab===key?'bg-[#171513] text-white shadow-sm':'text-stone-500'}`}>{key}</button>)}</div><textarea spellCheck={false} value={value} onChange={(e)=>onChange(nested(config,'codePage',{[activeTab]:e.target.value}))} className="min-h-[520px] w-full resize-y rounded-[18px] border border-[#292724] bg-[#121212] p-4 font-mono text-[11px] leading-6 text-[#c9f4d8] outline-none shadow-inner" placeholder={placeholder}/><div className="rounded-[18px] border border-stone-200 bg-stone-50 p-4 text-[10px] leading-5 text-stone-600"><p className="font-black text-stone-800">Sandbox profissional</p><p className="mt-1">O HTML/CSS/JS controla a página inteira, mas roda em origem isolada. Código de terceiros não recebe token, sessão ou acesso ao DOM autenticado do PiraNegócios.</p></div></div></div>;
}
