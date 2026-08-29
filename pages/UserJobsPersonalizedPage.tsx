import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Accessibility,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crown,
  Loader2,
  LockKeyhole,
  MapPin,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { api, asArray } from "../lib/api";
import { useAuth, WorkLocationPreference } from "../contexts/AuthContext";
import { Job } from "../types/job";
import { JobModal } from "../components/JobModal";
import { PaymentCheckoutModal } from "../components/payments/PaymentCheckoutModal";
import { safeApplicationUrl } from "../lib/jobApplication";

type MatchMode = "recommended" | "recent" | "all" | "applied";
type ApplicationChannel = "ALL" | "EXTERNAL" | "INTERNAL";

type PremiumMatch = {
  jobId: string;
  score: number;
  occupationalScore: number;
  technicalScore: number;
  experienceScore: number;
  educationScore: number;
  preferenceScore: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  evidence: string[];
  missingRequirements: string[];
  reason: string;
};

type JobMatch = {
  job: Job;
  premium: PremiumMatch | null;
  locationCompatible: boolean;
  locationKnown: boolean;
  remote: boolean;
};

const PAGE_SIZE = 12;

const normalize = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim();

const unique = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getPostedAt = (job: Job) => {
  const date = new Date(job.sourcePublishedAt || job.postedAt || job.updatedAt || 0).getTime();
  return Number.isFinite(date) ? date : 0;
};

function jobLocation(job: Job): WorkLocationPreference | null {
  if (job.city && job.state) return { city: job.city, state: job.state };
  const match = String(job.location || "").match(/^(.+?),\s*([A-Za-z]{2})$/);
  return match ? { city: match[1].trim(), state: match[2].toUpperCase() } : null;
}

function sameLocation(a: WorkLocationPreference, b: WorkLocationPreference) {
  return normalize(a.city) === normalize(b.city) && a.state.toUpperCase() === b.state.toUpperCase();
}

function isRemote(job: Job) {
  return normalize(job.workModel).includes("remot");
}

function money(cents: number) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR");
}

function matchLabel(score: number) {
  if (score >= 75) return "Compatibilidade forte";
  if (score >= 55) return "Boa compatibilidade";
  if (score >= 35) return "Compatibilidade parcial";
  return "Baixa compatibilidade";
}

function progressClass(score: number) {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 55) return "bg-terracotta-500";
  if (score >= 35) return "bg-amber-500";
  return "bg-stone-400";
}

export function UserJobsPersonalizedPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [matchStatus, setMatchStatus] = useState<any>(null);
  const [premiumMatches, setPremiumMatches] = useState<PremiumMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [mode, setMode] = useState<MatchMode>("recommended");
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("TODAS");
  const [workModel, setWorkModel] = useState("TODOS");
  const [applicationChannel, setApplicationChannel] = useState<ApplicationChannel>("ALL");
  const [strongOnly, setStrongOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [jobsResponse, applicationsResponse, matchResponse] = await Promise.all([
          api.get("/jobs"),
          api.get("/applications/me").catch(() => ({ data: [] })),
          api.get("/job-match/me").catch(() => ({ data: { active: false, matches: [] } })),
        ]);
        if (!active) return;
        setJobs(asArray<Job>(jobsResponse.data).filter((job) => job.active !== false));
        setApplications(asArray(applicationsResponse.data));
        setMatchStatus(matchResponse.data || null);
        setPremiumMatches(Array.isArray(matchResponse.data?.matches) ? matchResponse.data.matches : []);
      } catch (error) {
        console.error("Erro ao carregar vagas personalizadas:", error);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => setCurrentPage(1), [search, location, workModel, applicationChannel, strongOnly, mode]);

  const premiumActive = Boolean(matchStatus?.active);
  const matchProduct = matchStatus?.product;
  const matchMap = useMemo(() => new Map(premiumMatches.map((item) => [item.jobId, item])), [premiumMatches]);
  const appliedIds = useMemo(() => new Set(applications.map((application) => application.jobId)), [applications]);

  const acceptedLocations = useMemo<WorkLocationPreference[]>(() => {
    const locations: WorkLocationPreference[] = [];
    if (profile?.city && profile?.state) locations.push({ city: profile.city, state: profile.state });
    for (const item of profile?.jobPreferences?.preferredLocations || []) {
      if (!locations.some((current) => sameLocation(current, item))) locations.push(item);
    }
    return locations;
  }, [profile]);

  const hasLocationPreferences = acceptedLocations.length > 0;
  const includeExclusivePcdJobs = Boolean(profile?.jobPreferences?.includeExclusivePcdJobs);

  const matches = useMemo<JobMatch[]>(() => jobs.map((job) => {
    const remote = isRemote(job);
    const locationData = jobLocation(job);
    const locationKnown = remote || Boolean(locationData);
    const locationCompatible = remote || !hasLocationPreferences || Boolean(locationData && acceptedLocations.some((accepted) => sameLocation(accepted, locationData)));
    return {
      job,
      premium: premiumActive ? matchMap.get(job.id) || null : null,
      locationCompatible,
      locationKnown,
      remote,
    };
  }), [jobs, premiumActive, matchMap, acceptedLocations, hasLocationPreferences]);

  const locations = useMemo(() => unique(jobs.map((job) => job.location || [job.city, job.state].filter(Boolean).join(", ")).filter(Boolean)).sort((a, b) => a.localeCompare(b, "pt-BR")), [jobs]);

  const filtered = useMemo(() => {
    let result = [...matches];
    const term = normalize(search);
    if (term) result = result.filter(({ job }) => normalize(`${job.title} ${job.companyName} ${job.location} ${job.description} ${job.requirements} ${(job.skills || []).join(" ")}`).includes(term));
    if (location !== "TODAS") result = result.filter(({ job }) => (job.location || [job.city, job.state].filter(Boolean).join(", ")) === location);
    if (workModel !== "TODOS") result = result.filter(({ job }) => normalize(job.workModel || "Presencial") === normalize(workModel));
    if (applicationChannel === "EXTERNAL") result = result.filter(({ job }) => Boolean(safeApplicationUrl(job.applicationUrl)));
    if (applicationChannel === "INTERNAL") result = result.filter(({ job }) => !safeApplicationUrl(job.applicationUrl));
    if (strongOnly && premiumActive) result = result.filter((item) => Number(item.premium?.score || 0) >= 70);
    if (mode === "applied") result = result.filter(({ job }) => appliedIds.has(job.id));

    if (mode === "recommended") {
      result = result.filter((item) => item.locationCompatible);
      if (!includeExclusivePcdJobs) result = result.filter(({ job }) => (job.pcdMode || "GENERAL") !== "EXCLUSIVE");
      if (premiumActive) {
        result.sort((a, b) => Number(b.premium?.score || -1) - Number(a.premium?.score || -1) || getPostedAt(b.job) - getPostedAt(a.job));
      } else {
        result.sort((a, b) => getPostedAt(b.job) - getPostedAt(a.job));
      }
    } else {
      result.sort((a, b) => getPostedAt(b.job) - getPostedAt(a.job));
    }
    return result;
  }, [matches, search, location, workModel, applicationChannel, strongOnly, premiumActive, mode, appliedIds, includeExclusivePcdJobs]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const pageStart = (activePage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const strongMatches = premiumActive ? matches.filter((item) => Number(item.premium?.score || 0) >= 70 && item.locationCompatible && (includeExclusivePcdJobs || (item.job.pcdMode || "GENERAL") !== "EXCLUSIVE")).length : 0;
  const bestMatches = premiumActive ? [...matches].filter((item) => item.locationCompatible && Number(item.premium?.score || 0) >= 55 && (includeExclusivePcdJobs || (item.job.pcdMode || "GENERAL") !== "EXCLUSIVE")).sort((a, b) => Number(b.premium?.score || 0) - Number(a.premium?.score || 0)).slice(0, 3) : [];

  const refreshMatch = async () => {
    const response = await api.get("/job-match/me").catch(() => ({ data: { active: false, matches: [] } }));
    setMatchStatus(response.data || null);
    setPremiumMatches(Array.isArray(response.data?.matches) ? response.data.matches : []);
  };

  const handleApply = async (job: Job) => {
    if (!user || appliedIds.has(job.id)) return;
    try {
      await api.post("/applications", { jobId: job.id });
      setApplications((current) => [...current, { jobId: job.id, id: `local-${job.id}` }]);
      setSelectedJob(null);
      alert("Candidatura enviada com sucesso!");
    } catch (error: any) {
      console.error(error);
      alert(error?.response?.data?.message || "Não foi possível enviar a candidatura agora.");
    }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-terracotta-600" /></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 md:space-y-7">
      <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[#2b211c] px-6 py-7 text-white shadow-[0_32px_90px_rgba(45,28,18,.18)] md:px-8 md:py-9">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#d98b68]/20 blur-3xl" />
        <div className="relative grid gap-7 xl:grid-cols-[1.35fr_.65fr] xl:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f0c2a9]"><Sparkles className="h-3.5 w-3.5" /> Oportunidades para você</span>
            <h1 className="mt-4 max-w-3xl font-serif text-3xl font-bold tracking-tight md:text-5xl">Match profissional com os pés no chão.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55 md:text-base">As vagas continuam abertas para todos. O Match Inteligente acrescenta uma leitura profissional da aderência entre seu currículo e cada oportunidade.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-white/10 bg-white/[0.055] p-2">
            <HeroMetric value={jobs.length} label="abertas" />
            <HeroMetric value={premiumActive ? strongMatches : null} label={premiumActive ? "70%+ match" : "match premium"} />
            <HeroMetric value={acceptedLocations.length} label="cidades aceitas" />
          </div>
        </div>
      </section>

      {premiumActive ? (
        <section className="flex flex-col gap-4 rounded-[26px] border border-emerald-200 bg-emerald-50 p-5 md:flex-row md:items-center md:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-700">Match Inteligente ativo</p><h2 className="mt-1 text-lg font-bold text-stone-950">Seu ranking usa a análise profissional das vagas</h2><p className="mt-1 text-sm text-stone-600">Acesso válido até {dateLabel(matchStatus?.entitlement?.expiresAt)}. As vagas são analisadas uma vez quando ficam ativas; abrir esta tela não chama IA novamente.</p></div>
          <Crown className="h-8 w-8 shrink-0 text-emerald-600" />
        </section>
      ) : (
        <section className="flex flex-col gap-4 rounded-[26px] border border-violet-200 bg-violet-50 p-5 md:flex-row md:items-center md:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-700">Recurso premium</p><h2 className="mt-1 text-lg font-bold text-stone-950">Desbloqueie o Match Inteligente por {matchProduct?.durationDays || 30} dias</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">Veja percentual confiável, evidências do seu currículo, requisitos que ainda faltam e ranking personalizado. Todas as vagas continuam visíveis mesmo sem o premium.</p></div>
          <button type="button" disabled={matchProduct?.enabled === false} onClick={() => setPaymentOpen(true)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50"><LockKeyhole className="h-4 w-4" /> {`Liberar por ${money(matchProduct?.effectivePriceCents || matchProduct?.priceCents || 299)}`}</button>
        </section>
      )}

      {!hasLocationPreferences && (
        <section className="flex flex-col gap-4 rounded-[26px] border border-amber-200 bg-amber-50 p-5 md:flex-row md:items-center md:justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-amber-700">Localização ainda não configurada</p><h2 className="mt-1 text-lg font-bold text-stone-950">Diga onde você mora e onde aceita trabalhar</h2><p className="mt-1 text-sm text-stone-600">Até você configurar isso, não conseguimos eliminar vagas inviáveis pela distância.</p></div>
          <Link to="/user/perfil" className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-bold text-white">Configurar cidades <ArrowRight className="h-4 w-4" /></Link>
        </section>
      )}

      {bestMatches.length > 0 && mode === "recommended" && (
        <section>
          <div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-terracotta-600">Melhores combinações</p><h2 className="font-serif text-2xl font-bold text-stone-950">Mais alinhadas com você agora</h2></div></div>
          <div className="grid gap-3 lg:grid-cols-3">{bestMatches.map((item) => <FeaturedMatch key={item.job.id} item={item} onOpen={() => setSelectedJob(item.job)} />)}</div>
        </section>
      )}

      <section id="user-jobs-results" className="scroll-mt-28 rounded-[30px] border border-stone-200 bg-white/85 p-4 shadow-sm md:p-6">
        <div className="grid gap-3 xl:grid-cols-[1fr_220px_190px_210px]">
          <div className="relative"><Search className="absolute left-4 top-3.5 h-4 w-4 text-stone-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cargo, empresa, habilidade..." className="w-full rounded-2xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-terracotta-400" /></div>
          <select value={location} onChange={(event) => setLocation(event.target.value)} className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm"><option value="TODAS">Todas as cidades</option>{locations.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={workModel} onChange={(event) => setWorkModel(event.target.value)} className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm"><option value="TODOS">Todos os modelos</option><option>Presencial</option><option>Híbrido</option><option>Remoto</option></select>
          <select value={applicationChannel} onChange={(event) => setApplicationChannel(event.target.value as ApplicationChannel)} className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm"><option value="ALL">Toda candidatura</option><option value="EXTERNAL">Site externo</option><option value="INTERNAL">PiraNegócios</option></select>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-stone-100 pb-4">
          {([['recommended','Para você'],['recent','Mais recentes'],['all','Todas'],['applied','Minhas candidaturas']] as [MatchMode,string][]).map(([value,label]) => <button key={value} onClick={() => setMode(value)} className={`rounded-full px-4 py-2 text-xs font-bold ${mode === value ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600"}`}>{label}</button>)}
          {premiumActive && <button onClick={() => setStrongOnly((current) => !current)} className={`ml-auto rounded-full border px-4 py-2 text-xs font-bold ${strongOnly ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-stone-200 text-stone-500"}`}>70%+ match</button>}
        </div>

        <div className="mt-5 space-y-3">
          {paginated.length === 0 ? <div className="py-12 text-center text-sm text-stone-500">Nenhuma vaga encontrada com estes critérios.</div> : paginated.map((item) => <JobMatchCard key={item.job.id} item={item} premiumActive={premiumActive} applied={appliedIds.has(item.job.id)} onOpen={() => setSelectedJob(item.job)} />)}
        </div>

        {filtered.length > PAGE_SIZE && (
          <div className="mt-6 flex flex-col gap-3 border-t border-stone-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-stone-500">Página {activePage} de {totalPages} · {filtered.length} oportunidades</p>
            <div className="flex items-center gap-2">
              <button disabled={activePage === 1} onClick={() => setCurrentPage(activePage - 1)} className="rounded-xl border border-stone-200 p-2 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, index) => Math.max(1, Math.min(totalPages - 4, activePage - 2)) + index).filter((page, index, arr) => page >= 1 && page <= totalPages && arr.indexOf(page) === index).map((page) => <button key={page} onClick={() => setCurrentPage(page)} className={`h-9 min-w-9 rounded-xl px-2 text-xs font-bold ${page === activePage ? "bg-stone-900 text-white" : "border border-stone-200"}`}>{page}</button>)}
              <button disabled={activePage === totalPages} onClick={() => setCurrentPage(activePage + 1)} className="rounded-xl border border-stone-200 p-2 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </section>

      {selectedJob && <JobModal job={selectedJob} hasApplied={appliedIds.has(selectedJob.id)} onClose={() => setSelectedJob(null)} onApply={() => void handleApply(selectedJob)} />}

      <PaymentCheckoutModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title={`Match Inteligente · ${matchProduct?.durationDays || 30} dias`}
        description="Desbloqueie a análise de compatibilidade e o ranking personalizado sem sair da tela de vagas."
        amountCents={Number(matchProduct?.effectivePriceCents || matchProduct?.priceCents || 299)}
        productCode="JOB_MATCH_30D"
        confirmLabel="Gerar Pix"
        creatingLabel="Gerando Pix..."
        createCheckout={() => api.post("/payments/pix", { productCode: "JOB_MATCH_30D" })}
        onCompleted={async () => {
          await refreshMatch();
          setPaymentOpen(false);
        }}
      >
        <p className="text-center text-[10px] leading-5 text-stone-400">Ao continuar, você concorda com os <Link to="/termos" target="_blank" className="font-black text-stone-600 underline">Termos da plataforma</Link>.</p>
      </PaymentCheckoutModal>
    </div>
  );
}

function HeroMetric({ value, label }: { value: number | null; label: string }) {
  return <div className="rounded-[18px] px-3 py-3 text-center"><div className="text-2xl font-black text-white">{value === null ? <LockKeyhole className="mx-auto h-5 w-5 text-white/65" /> : value}</div><div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-white/40">{label}</div></div>;
}

function FeaturedMatch({ item, onOpen }: { item: JobMatch; onOpen: () => void; key?: React.Key }) {
  const score = Number(item.premium?.score || 0);
  return <button onClick={onOpen} className="group rounded-[26px] border border-stone-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-terracotta-600">{item.job.isConfidential ? "Empresa confidencial" : item.job.companyName}</p><h3 className="mt-1 text-lg font-bold text-stone-950">{item.job.title}</h3></div><strong className="text-xl text-stone-950">{score}%</strong></div><MatchProgress score={score} /><p className="mt-3 text-xs leading-5 text-stone-500">{item.premium?.reason}</p><LocationStatus item={item} /><PcdBadge job={item.job} /></button>;
}

function JobMatchCard({ item, premiumActive, applied, onOpen }: { item: JobMatch; premiumActive: boolean; applied: boolean; onOpen: () => void; key?: React.Key }) {
  const { job } = item;
  const score = Number(item.premium?.score || 0);
  return <button onClick={onOpen} className="w-full rounded-[24px] border border-stone-200 bg-white p-5 text-left transition hover:border-terracotta-200 hover:shadow-md"><div className="grid gap-4 lg:grid-cols-[1fr_280px]"><div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-terracotta-600">{job.isConfidential ? "Empresa confidencial" : job.companyName}</span>{applied && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Candidatura enviada</span>}<PcdBadge job={job} /></div><h3 className="mt-1 text-xl font-bold text-stone-950">{job.title}</h3><p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location || [job.city, job.state].filter(Boolean).join(", ")}</span><span>{job.workModel || "Presencial"}</span><span>{job.type}</span></p>{premiumActive && item.premium?.evidence?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{item.premium.evidence.slice(0, 4).map((evidence) => <span key={evidence} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">✓ {evidence}</span>)}</div> : null}{premiumActive && item.premium?.missingRequirements?.length ? <p className="mt-3 text-[11px] font-semibold text-amber-700">Pode faltar: {item.premium.missingRequirements.slice(0, 3).join(" · ")}</p> : null}</div><div className="rounded-2xl bg-stone-50 p-4">{premiumActive && item.premium ? <><div className="flex items-center justify-between"><span className="text-xs font-bold text-stone-600">{matchLabel(score)}</span><strong className="text-lg text-stone-950">{score}%</strong></div><MatchProgress score={score} /><p className="mt-3 text-[11px] leading-5 text-stone-500">{item.premium.reason}</p></> : <div className="flex min-h-[92px] flex-col items-center justify-center text-center"><LockKeyhole className="h-5 w-5 text-violet-500" /><p className="mt-2 text-xs font-black text-stone-700">Compatibilidade premium</p><p className="mt-1 text-[10px] leading-4 text-stone-400">Desbloqueie a nota e os motivos do match.</p></div>}<LocationStatus item={item} /></div></div></button>;
}

function MatchProgress({ score }: { score: number }) {
  return <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}><div className={`h-full rounded-full ${progressClass(score)}`} style={{ width: `${score}%` }} /></div>;
}

function LocationStatus({ item }: { item: JobMatch }) {
  if (item.remote) return <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-700"><Target className="h-3.5 w-3.5" /> Remota · cidade não limita</p>;
  if (!item.locationKnown) return <p className="mt-3 text-[11px] font-bold text-amber-700">Localização da vaga pouco estruturada</p>;
  return <p className={`mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold ${item.locationCompatible ? "text-emerald-700" : "text-stone-400"}`}><MapPin className="h-3.5 w-3.5" /> {item.locationCompatible ? "Cidade compatível" : "Fora das suas cidades"}</p>;
}

function PcdBadge({ job }: { job: Job }) {
  if (job.pcdMode === "EXCLUSIVE") return <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700"><Accessibility className="h-3 w-3" /> Exclusiva PCD</span>;
  if (job.pcdMode === "INCLUSIVE") return <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-700"><Accessibility className="h-3 w-3" /> Aberta a PCD</span>;
  return null;
}
