import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Code2,
  Eye,
  FileText,
  Globe2,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  Lock,
  Palette,
  Save,
  Send,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { FileUpload } from '../components/FileUpload';
import {
  COMPANY_PAGE_TEMPLATES,
  CompanyPageConfig,
  CompanyPageSection,
  CompanySiteRenderer,
  PublicCompanyLike,
  PublicJobLike,
} from '../components/company-page/CompanySiteRenderer';

type BuilderTab = 'templates' | 'layout' | 'content' | 'contact' | 'legal' | 'advanced';

const TAB_ITEMS: Array<{ key: BuilderTab; label: string; icon: React.ReactNode }> = [
  { key: 'templates', label: 'Modelos', icon: <LayoutTemplate className="h-4 w-4" /> },
  { key: 'layout', label: 'Aparência', icon: <Palette className="h-4 w-4" /> },
  { key: 'content', label: 'Componentes', icon: <Settings2 className="h-4 w-4" /> },
  { key: 'contact', label: 'Contato e redes', icon: <Share2 className="h-4 w-4" /> },
  { key: 'legal', label: 'Termos e privacidade', icon: <FileText className="h-4 w-4" /> },
  { key: 'advanced', label: 'HTML / CSS / JS', icon: <Code2 className="h-4 w-4" /> },
];

const SECTION_LABELS: Record<string, string> = {
  identity: 'Identidade da empresa',
  about: 'Sobre a empresa',
  contact: 'Contato',
  socials: 'Redes sociais',
  advanced: 'Bloco personalizado',
  jobs: 'Vagas abertas',
  legal: 'Links legais',
};

function updateNested<T extends keyof CompanyPageConfig>(config: CompanyPageConfig, key: T, patch: Partial<NonNullable<CompanyPageConfig[T]>>) {
  return { ...config, [key]: { ...(config[key] as any || {}), ...patch } };
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
  const [tab, setTab] = useState<BuilderTab>('templates');
  const [advancedTab, setAdvancedTab] = useState<'html' | 'css' | 'js'>('html');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
        if (nextCompany?.slug) {
          try {
            const publicResponse = await api.get(`/public/companies/${nextCompany.slug}`);
            if (active) setJobs(Array.isArray(publicResponse.data?.jobs) ? publicResponse.data.jobs : []);
          } catch {
            if (active) setJobs([]);
          }
        }
      } catch (loadError: any) {
        if (active) setError(loadError?.response?.data?.message || 'Não foi possível carregar o editor da página.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [companyId]);

  const sections = useMemo(() => Array.isArray(config?.sections) ? config!.sections! : [], [config]);

  const patch = (next: CompanyPageConfig) => {
    setConfig(next);
    setMessage('');
    setError('');
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
      const warnings = response.data.validation?.warnings || [];
      setMessage(warnings.length ? `Rascunho salvo. ${warnings.join(' ')}` : 'Rascunho salvo.');
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
      setMessage('Página publicada. A versão pública da empresa já usa este layout.');
    } catch (publishError: any) {
      const payload = publishError?.response?.data;
      const warnings = payload?.validation?.warnings || payload?.message?.validation?.warnings;
      setValidation(payload?.validation || payload?.message?.validation || validation);
      setError(Array.isArray(warnings) && warnings.length ? warnings.join(' ') : (typeof payload?.message === 'string' ? payload.message : 'A página ainda não pode ser publicada.'));
    } finally { setPublishing(false); }
  };

  if (!companyId) return <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-amber-900">Cadastre ou vincule uma empresa antes de criar a página pública.</div>;
  if (loading || !config || !company) return <div className="flex min-h-[55vh] items-center justify-center text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando Minha Página...</div>;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header className="flex flex-col gap-4 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta-600">PiraNegócios Business · Site da empresa</p><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{status === 'PUBLISHED' ? `Publicado · v${revision}` : 'Rascunho'}</span></div>
          <h1 className="mt-2 font-serif text-3xl font-black text-stone-950 sm:text-4xl">Minha Página</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Monte o site da sua empresa, escolha componentes, personalize a identidade e publique quando estiver pronto. A página continua conectada às suas vagas no PiraNegócios.</p>
          {publishedAt && <p className="mt-2 text-[11px] font-semibold text-stone-400">Última publicação: {new Date(publishedAt).toLocaleString('pt-BR')}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void saveDraft()} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-xs font-black text-stone-700 shadow-sm disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar rascunho</button>
          <button onClick={() => void openPreview()} disabled={previewing} className="inline-flex items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs font-black text-violet-800 disabled:opacity-50">{previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Pré-visualizar</button>
          <button onClick={() => void publish()} disabled={publishing} className="inline-flex items-center gap-2 rounded-2xl bg-terracotta-600 px-5 py-3 text-xs font-black text-white shadow-lg shadow-terracotta-900/10 disabled:opacity-50">{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publicar</button>
        </div>
      </header>

      {(message || error || validation?.warnings?.length > 0) && <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${error ? 'border-red-200 bg-red-50 text-red-800' : validation?.warnings?.length ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || message || validation.warnings.join(' ')}</div>}

      <div className="grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
          <div className="overflow-x-auto border-b border-stone-200 bg-stone-50/70 p-2"><div className="flex min-w-max gap-1">{TAB_ITEMS.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={`flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-black transition ${tab === item.key ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-500 hover:bg-white hover:text-stone-900'}`}>{item.icon}{item.label}</button>)}</div></div>
          <div className="max-h-[calc(100vh-225px)] overflow-y-auto p-5 sm:p-6">
            {tab === 'templates' && <TemplatePanel config={config} onChange={patch} />}
            {tab === 'layout' && <LayoutPanel config={config} onChange={patch} />}
            {tab === 'content' && <div className="space-y-5"><PanelTitle icon={<Settings2 className="h-4 w-4" />} title="Componentes" text="Defina o que aparece e em qual ordem. Identidade e vagas são componentes obrigatórios." />{sections.map((section, index) => <div key={section.id} className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-3"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-black text-stone-800">{SECTION_LABELS[section.type] || section.type}</p>{section.locked && <span className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-2 py-0.5 text-[9px] font-black uppercase text-stone-600"><Lock className="h-2.5 w-2.5" /> obrigatório</span>}</div></div><button disabled={section.locked} onClick={() => updateSection(section.id, { enabled: section.locked ? true : section.enabled === false })} className={`h-7 w-12 rounded-full p-1 transition ${section.enabled !== false ? 'bg-terracotta-600' : 'bg-stone-300'} disabled:cursor-not-allowed disabled:opacity-70`}><span className={`block h-5 w-5 rounded-full bg-white shadow transition ${section.enabled !== false ? 'translate-x-5' : ''}`} /></button><div className="flex flex-col"><button disabled={index === 0} onClick={() => moveSection(index, -1)} className="p-1 text-stone-400 disabled:opacity-20"><ArrowUp className="h-3.5 w-3.5" /></button><button disabled={index === sections.length - 1} onClick={() => moveSection(index, 1)} className="p-1 text-stone-400 disabled:opacity-20"><ArrowDown className="h-3.5 w-3.5" /></button></div></div>)}</div>}
            {tab === 'contact' && <ContactPanel config={config} onChange={patch} />}
            {tab === 'legal' && <LegalPanel config={config} onChange={patch} />}
            {tab === 'advanced' && <AdvancedPanel config={config} onChange={patch} activeTab={advancedTab} setActiveTab={setAdvancedTab} />}
          </div>
        </section>

        <section className="min-w-0 rounded-[28px] border border-stone-200 bg-[#dedbd4] p-3 shadow-inner sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3 px-1"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-stone-500">Preview ao vivo</p><p className="text-xs text-stone-500">A versão temporária usa este mesmo renderer.</p></div><span className="hidden rounded-full bg-white/75 px-3 py-1.5 text-[10px] font-black text-stone-500 sm:inline">{config.templateKey || 'essencial'}</span></div>
          <div className="max-h-[calc(100vh-220px)] overflow-auto rounded-[22px] bg-white shadow-2xl"><CompanySiteRenderer company={company} jobs={jobs} page={config} preview /></div>
        </section>
      </div>
    </div>
  );
}

function PanelTitle({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div><div className="flex items-center gap-2 text-stone-900">{icon}<h2 className="font-black">{title}</h2></div><p className="mt-1 text-xs leading-5 text-stone-500">{text}</p></div>; }
function Field({ label, value, onChange, placeholder = '' }: { label: string; value?: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-stone-500">{label}</span><input value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100" /></label>; }
function TextArea({ label, value, onChange, rows = 6, placeholder = '' }: { label: string; value?: string; onChange: (value: string) => void; rows?: number; placeholder?: string }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-stone-500">{label}</span><textarea rows={rows} value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full resize-y rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100" /></label>; }
function ToggleRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) { return <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-3 text-left"><span className={`h-7 w-12 shrink-0 rounded-full p-1 transition ${checked ? 'bg-terracotta-600' : 'bg-stone-300'}`}><span className={`block h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : ''}`} /></span><span><span className="block text-sm font-black text-stone-800">{label}</span>{description && <span className="mt-0.5 block text-[11px] leading-4 text-stone-500">{description}</span>}</span></button>; }

function TemplatePanel({ config, onChange }: { config: CompanyPageConfig; onChange: (config: CompanyPageConfig) => void }) { return <div className="space-y-5"><PanelTitle icon={<LayoutTemplate className="h-4 w-4" />} title="Galeria de modelos" text="A estrutura já nasce preparada para uma futura loja de templates. Estes quatro modelos são os primeiros nativos." /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">{COMPANY_PAGE_TEMPLATES.map((template) => { const selected = config.templateKey === template.key; return <button key={template.key} onClick={() => onChange({ ...config, templateKey: template.key })} className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${selected ? 'border-terracotta-500 bg-terracotta-50 ring-2 ring-terracotta-100' : 'border-stone-200 bg-white hover:border-stone-300'}`}><div className={`mb-4 h-20 rounded-xl ${template.key === 'essencial' ? 'bg-gradient-to-br from-stone-100 to-white' : template.key === 'institucional' ? 'bg-gradient-to-br from-slate-800 to-slate-500' : template.key === 'vitrine' ? 'bg-gradient-to-br from-orange-500 via-rose-500 to-violet-600' : 'bg-[linear-gradient(90deg,#f5f0e8_0_35%,#292524_35%_38%,#fff_38%)]'}`} /><div className="flex items-start justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-wider text-stone-400">{template.eyebrow}</span><p className="text-sm font-black text-stone-900">{template.name}</p><p className="mt-1 text-[11px] leading-4 text-stone-500">{template.description}</p></div>{selected && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-terracotta-600 text-white"><Check className="h-3.5 w-3.5" /></span>}</div></button>; })}</div><div className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><div className="flex items-center gap-2 text-violet-900"><Sparkles className="h-4 w-4" /><p className="text-sm font-black">Futura loja de templates</p></div><p className="mt-1 text-[11px] leading-5 text-violet-700">O modelo fica identificado por chave e versão, então designers poderão publicar temas sem misturar a estrutura da empresa com o catálogo comercial.</p></div></div>; }

function LayoutPanel({ config, onChange }: { config: CompanyPageConfig; onChange: (config: CompanyPageConfig) => void }) { const cover = config.cover || {}; return <div className="space-y-5"><PanelTitle icon={<Palette className="h-4 w-4" />} title="Aparência" text="Controle largura, cores e capa sem tocar em código." /><div><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-stone-500">Largura da página</p><div className="grid grid-cols-2 gap-2">{[['compact','Compacta'],['standard','Padrão'],['wide','Ampla'],['full','Tela inteira']].map(([value,label]) => <button key={value} onClick={() => onChange({ ...config, width: value as any })} className={`rounded-xl border px-3 py-2.5 text-xs font-black ${config.width === value ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-600'}`}>{label}</button>)}</div></div><div className="grid grid-cols-2 gap-3"><label className="text-[10px] font-black uppercase text-stone-500">Cor principal<input type="color" value={config.theme?.primary || '#b64b36'} onChange={(e) => onChange(updateNested(config,'theme',{ primary:e.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white p-1" /></label><label className="text-[10px] font-black uppercase text-stone-500">Fundo<input type="color" value={config.theme?.background || '#fffdf9'} onChange={(e) => onChange(updateNested(config,'theme',{ background:e.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white p-1" /></label><label className="text-[10px] font-black uppercase text-stone-500">Texto<input type="color" value={config.theme?.text || '#292524'} onChange={(e) => onChange(updateNested(config,'theme',{ text:e.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white p-1" /></label><label className="text-[10px] font-black uppercase text-stone-500">Acento<input type="color" value={config.theme?.accent || '#7c2d12'} onChange={(e) => onChange(updateNested(config,'theme',{ accent:e.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white p-1" /></label></div><ToggleRow label="Usar foto de capa" description="A capa é opcional e pode ser removida a qualquer momento." checked={Boolean(cover.enabled)} onChange={(checked) => onChange(updateNested(config,'cover',{ enabled:checked }))} />{cover.enabled && <div className="space-y-3"><FileUpload label="Foto de capa" accept="image/*" value={cover.url || ''} onChange={(value) => onChange(updateNested(config,'cover',{ url:value }))} maxSizeKB={3072} placeholder="Envie uma imagem horizontal" /><div className="grid grid-cols-2 gap-3"><label className="text-[10px] font-black uppercase text-stone-500">Altura<select value={cover.height || 'medium'} onChange={(e) => onChange(updateNested(config,'cover',{ height:e.target.value as any }))} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm"><option value="small">Baixa</option><option value="medium">Média</option><option value="large">Alta</option></select></label><label className="text-[10px] font-black uppercase text-stone-500">Escurecer · {Number(cover.overlay ?? 28)}%<input type="range" min="0" max="75" value={Number(cover.overlay ?? 28)} onChange={(e) => onChange(updateNested(config,'cover',{ overlay:Number(e.target.value) }))} className="mt-3 w-full" /></label></div></div>}</div>; }

function ContactPanel({ config, onChange }: { config: CompanyPageConfig; onChange: (config: CompanyPageConfig) => void }) { const c=config.contacts||{}, s=config.socials||{}; return <div className="space-y-5"><PanelTitle icon={<Globe2 className="h-4 w-4" />} title="Contato e redes" text="Esses dados são específicos da página e podem complementar o Perfil da empresa." /><div className="space-y-3"><Field label="Telefone principal" value={c.phone} onChange={(v)=>onChange(updateNested(config,'contacts',{phone:v}))}/><Field label="Segundo telefone" value={c.secondaryPhone} onChange={(v)=>onChange(updateNested(config,'contacts',{secondaryPhone:v}))}/><Field label="WhatsApp" value={c.whatsapp} onChange={(v)=>onChange(updateNested(config,'contacts',{whatsapp:v}))}/><Field label="E-mail público" value={c.email} onChange={(v)=>onChange(updateNested(config,'contacts',{email:v}))}/><Field label="Site externo" value={c.website} onChange={(v)=>onChange(updateNested(config,'contacts',{website:v}))}/></div><div className="border-t border-stone-200 pt-5"><p className="mb-3 text-[10px] font-black uppercase tracking-wider text-stone-500">Redes sociais</p><div className="space-y-3"><Field label="Instagram" value={s.instagram} onChange={(v)=>onChange(updateNested(config,'socials',{instagram:v}))}/><Field label="LinkedIn" value={s.linkedin} onChange={(v)=>onChange(updateNested(config,'socials',{linkedin:v}))}/><Field label="Facebook" value={s.facebook} onChange={(v)=>onChange(updateNested(config,'socials',{facebook:v}))}/><Field label="YouTube" value={s.youtube} onChange={(v)=>onChange(updateNested(config,'socials',{youtube:v}))}/><Field label="TikTok" value={s.tiktok} onChange={(v)=>onChange(updateNested(config,'socials',{tiktok:v}))}/></div></div><div className="border-t border-stone-200 pt-5"><TextArea label="Sobre a empresa" value={config.about?.text} onChange={(v)=>onChange(updateNested(config,'about',{text:v}))} rows={8}/></div></div>; }

function LegalPanel({ config, onChange }: { config: CompanyPageConfig; onChange: (config: CompanyPageConfig) => void }) { const legal=config.legal||{}; return <div className="space-y-5"><PanelTitle icon={<ShieldCheck className="h-4 w-4" />} title="Termos e privacidade" text="Ative apenas o que a empresa quiser publicar. Os textos viram páginas próprias no endereço da empresa." /><ToggleRow label="Página de Termos de uso" checked={Boolean(legal.termsEnabled)} onChange={(v)=>onChange(updateNested(config,'legal',{termsEnabled:v}))}/>{legal.termsEnabled && <div className="space-y-3"><Field label="Título" value={legal.termsTitle} onChange={(v)=>onChange(updateNested(config,'legal',{termsTitle:v}))}/><TextArea label="Conteúdo dos termos" value={legal.termsBody} onChange={(v)=>onChange(updateNested(config,'legal',{termsBody:v}))} rows={12}/></div>}<ToggleRow label="Página de Política de privacidade" checked={Boolean(legal.privacyEnabled)} onChange={(v)=>onChange(updateNested(config,'legal',{privacyEnabled:v}))}/>{legal.privacyEnabled && <div className="space-y-3"><Field label="Título" value={legal.privacyTitle} onChange={(v)=>onChange(updateNested(config,'legal',{privacyTitle:v}))}/><TextArea label="Conteúdo da política" value={legal.privacyBody} onChange={(v)=>onChange(updateNested(config,'legal',{privacyBody:v}))} rows={12}/></div>}</div>; }

function AdvancedPanel({ config, onChange, activeTab, setActiveTab }: { config: CompanyPageConfig; onChange: (config: CompanyPageConfig) => void; activeTab:'html'|'css'|'js'; setActiveTab:(v:'html'|'css'|'js')=>void }) { const advanced=config.advanced||{}; const value=advanced[activeTab]||''; return <div className="space-y-5"><PanelTitle icon={<Code2 className="h-4 w-4" />} title="Editor avançado" text="HTML, CSS e JavaScript livres dentro de um sandbox isolado. O código não recebe sessão, token ou acesso ao DOM do PiraNegócios." /><div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-[11px] leading-5 text-blue-900"><div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Modo profissional com isolamento.</strong> Nome, endereço, selo e vagas continuam sendo componentes nativos obrigatórios. O código personalizado roda só dentro da área avançada.</span></div></div><ToggleRow label="Ativar conteúdo personalizado" checked={Boolean(advanced.enabled)} onChange={(v)=>onChange(updateNested(config,'advanced',{enabled:v}))}/>{advanced.enabled && <><div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1">{(['html','css','js'] as const).map((key)=><button key={key} onClick={()=>setActiveTab(key)} className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase ${activeTab===key?'bg-stone-900 text-white':'text-stone-500'}`}>{key}</button>)}</div><textarea spellCheck={false} value={value} onChange={(e)=>onChange(updateNested(config,'advanced',{[activeTab]:e.target.value} as any))} className="min-h-[360px] w-full resize-y rounded-2xl border border-stone-800 bg-[#161616] p-4 font-mono text-xs leading-6 text-emerald-200 outline-none" placeholder={activeTab==='html'?'<section>Seu conteúdo...</section>':activeTab==='css'?'.minha-classe { ... }':'// JavaScript da área personalizada'} /><div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900"><AlertTriangle className="mr-2 inline h-4 w-4" />Requisições de rede e acesso ao site pai ficam bloqueados no sandbox. Isso evita que um template de terceiros enxergue dados da conta.</div></>}</div>; }
