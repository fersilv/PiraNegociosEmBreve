import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Accessibility,
  Archive,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  LockKeyhole,
  MapPin,
  MoreHorizontal,
  PauseCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { api, asArray } from "../lib/api";
import type { Job } from "../types/job";

const normalize = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const jobDate = (job: Job) => new Date(job.createdAt || job.postedAt || job.updatedAt || 0).getTime();
const locationLabel = (job: Job) => job.location || [job.city, job.state].filter(Boolean).join(", ") || "Local não informado";

type StatusFilter = "TODAS" | "ATIVAS" | "PAUSADAS" | "BANCO";

export function CompanyJobsManagementPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("TODAS");
  const [model, setModel] = useState("TODOS");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get("/jobs/me");
      setJobs(asArray<Job>(response.data).sort((a, b) => jobDate(b) - jobDate(a)));
    } catch (error) {
      console.error("Erro ao carregar vagas da empresa:", error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const activeCount = jobs.filter((job) => job.active !== false && !job.isTalentPool).length;
  const pausedCount = jobs.filter((job) => job.active === false).length;
  const talentPoolCount = jobs.filter((job) => job.isTalentPool).length;
  const totalViews = jobs.reduce((sum, job) => sum + Number(job.views || 0), 0);

  const filtered = useMemo(() => jobs.filter((job) => {
    const text = normalize(`${job.title} ${job.location} ${job.city} ${job.state} ${job.type} ${job.workModel}`);
    if (search.trim() && !text.includes(normalize(search.trim()))) return false;
    if (status === "ATIVAS" && (job.active === false || job.isTalentPool)) return false;
    if (status === "PAUSADAS" && job.active !== false) return false;
    if (status === "BANCO" && !job.isTalentPool) return false;
    if (model !== "TODOS" && normalize(job.workModel || "Presencial") !== normalize(model)) return false;
    return true;
  }), [jobs, search, status, model]);

  const toggleActive = async (job: Job) => {
    setBusyId(job.id);
    try {
      await api.put(`/jobs/${job.id}`, { active: job.active === false });
      setJobs((current) => current.map((item) => item.id === job.id ? { ...item, active: job.active === false } : item));
    } catch (error) {
      console.error(error);
      alert("Não foi possível alterar o status da vaga.");
    } finally {
      setBusyId(null);
      setOpenMenu(null);
    }
  };

  const remove = async (job: Job) => {
    if (!window.confirm(`Excluir a vaga “${job.title}”? Essa ação não pode ser desfeita.`)) return;
    setBusyId(job.id);
    try {
      await api.delete(`/jobs/${job.id}`);
      setJobs((current) => current.filter((item) => item.id !== job.id));
    } catch (error: any) {
      console.error(error);
      alert(error?.response?.data?.message || "Não foi possível excluir a vaga.");
    } finally {
      setBusyId(null);
      setOpenMenu(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="relative overflow-hidden rounded-[32px] bg-[#1d1d1a] p-6 text-white shadow-[0_26px_80px_rgba(22,22,19,.18)] sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-terracotta-500/15 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-terracotta-300">Recrutamento · Gestão</p>
            <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight sm:text-5xl">Suas vagas, sem ruído.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">Publique, acompanhe e organize oportunidades da empresa. A criação detalhada fica em uma tela própria e a gestão fica aqui.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.06] px-4 py-3 text-xs font-bold text-white/70 hover:bg-white/[.1]"><RefreshCw className="h-4 w-4" /> Atualizar</button>
            <Link to="/company/vagas/nova" className="inline-flex items-center gap-2 rounded-xl bg-terracotta-600 px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-terracotta-700"><Plus className="h-4 w-4" /> Nova vaga</Link>
          </div>
        </div>

        <div className="relative mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric value={activeCount} label="ativas" icon={<CheckCircle2 className="h-4 w-4" />} />
          <Metric value={pausedCount} label="pausadas" icon={<PauseCircle className="h-4 w-4" />} />
          <Metric value={talentPoolCount} label="banco de talentos" icon={<Users className="h-4 w-4" />} />
          <Metric value={totalViews} label="visualizações" icon={<Eye className="h-4 w-4" />} />
        </div>
      </section>

      <section className="rounded-[26px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
          <label className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por cargo, cidade ou contrato" className="w-full rounded-2xl border border-stone-200 bg-stone-50/60 py-3 pl-11 pr-4 text-sm outline-none focus:border-terracotta-400" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {([['TODAS','Todas'],['ATIVAS','Ativas'],['PAUSADAS','Pausadas'],['BANCO','Banco de talentos']] as [StatusFilter,string][]).map(([value,label]) => <button key={value} onClick={() => setStatus(value)} className={`rounded-xl px-3 py-2 text-xs font-bold ${status === value ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600"}`}>{label}</button>)}
          </div>
          <select value={model} onChange={(event) => setModel(event.target.value)} className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs font-bold text-stone-600 outline-none"><option value="TODOS">Todos os modelos</option><option>Presencial</option><option>Híbrido</option><option>Remoto</option></select>
        </div>
      </section>

      <div className="flex items-center justify-between px-1"><p className="text-sm text-stone-500"><strong className="text-stone-900">{filtered.length}</strong> {filtered.length === 1 ? "vaga encontrada" : "vagas encontradas"}</p></div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">{[0,1,2,3].map((item) => <div key={item} className="h-56 animate-pulse rounded-[26px] border border-stone-200 bg-white" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[30px] border border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400"><Archive className="h-5 w-5" /></span>
          <h2 className="mt-4 font-serif text-2xl font-bold text-stone-900">Nenhuma vaga por aqui.</h2>
          <p className="mt-2 text-sm text-stone-500">Altere os filtros ou publique uma nova oportunidade.</p>
          <Link to="/company/vagas/nova" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Criar vaga</Link>
        </div>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {filtered.map((job) => (
            <article key={job.id} className="relative rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-700"><BriefcaseBusiness className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge job={job} />
                    {job.isInternal && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700"><LockKeyhole className="h-3 w-3" /> Interna</span>}
                    {job.pcdMode === "EXCLUSIVE" && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700"><Accessibility className="h-3 w-3" /> Exclusiva PCD</span>}
                    {job.pcdMode === "INCLUSIVE" && <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-700"><Accessibility className="h-3 w-3" /> Também PCD</span>}
                  </div>
                  <button onClick={() => navigate(`/company/vagas/${job.id}`)} className="mt-2 block text-left font-serif text-2xl font-bold leading-tight text-stone-950 hover:text-terracotta-700">{job.title}</button>
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {locationLabel(job)}</span><span>{job.workModel || "Presencial"}</span><span>{job.type || "Contrato não informado"}</span></p>
                </div>
                <div className="relative">
                  <button onClick={() => setOpenMenu((current) => current === job.id ? null : job.id)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 text-stone-400 hover:bg-stone-50" aria-label="Ações da vaga"><MoreHorizontal className="h-4 w-4" /></button>
                  {openMenu === job.id && <div className="absolute right-0 top-11 z-20 w-48 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl"><button onClick={() => navigate(`/company/vagas/${job.id}`)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-stone-700 hover:bg-stone-50"><Eye className="h-4 w-4" /> Abrir detalhes</button><button disabled={busyId === job.id} onClick={() => void toggleActive(job)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-50"><PauseCircle className="h-4 w-4" /> {job.active === false ? "Reativar vaga" : "Pausar vaga"}</button><button disabled={busyId === job.id} onClick={() => void remove(job)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Excluir vaga</button></div>}
                </div>
              </div>

              {job.description && <p className="mt-4 line-clamp-2 text-sm leading-6 text-stone-600">{job.description}</p>}

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-4">
                {job.salary && <span className="rounded-lg bg-stone-50 px-2.5 py-1.5 text-[10px] font-bold text-stone-600">{job.salary}</span>}
                <span className="rounded-lg bg-stone-50 px-2.5 py-1.5 text-[10px] font-bold text-stone-500">{job.acceptsPlatformApplications === false ? "Candidatura externa" : "Candidatura pelo PiraNegócios"}</span>
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-stone-400"><Clock3 className="h-3 w-3" /> {formatDate(job.createdAt || job.postedAt)}</span>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function Metric({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/8 bg-white/[.055] p-4"><div className="flex items-center justify-between"><strong className="font-serif text-3xl text-white">{value.toLocaleString("pt-BR")}</strong><span className="text-terracotta-300">{icon}</span></div><p className="mt-1 text-[9px] font-black uppercase tracking-[.13em] text-white/35">{label}</p></div>;
}

function StatusBadge({ job }: { job: Job }) {
  if (job.isTalentPool) return <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700"><Users className="h-3 w-3" /> Banco de talentos</span>;
  if (job.active === false) return <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-stone-500"><PauseCircle className="h-3 w-3" /> Pausada</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Ativa</span>;
}

function formatDate(value?: string | null) {
  if (!value) return "data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data não informada";
  return date.toLocaleDateString("pt-BR");
}
