import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Accessibility,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { api, asArray } from "../lib/api";
import { useAuth, WorkLocationPreference } from "../contexts/AuthContext";
import { Job } from "../types/job";
import { JobModal } from "../components/JobModal";

type MatchMode = "recommended" | "recent" | "all" | "applied";
type Confidence = "high" | "medium" | "low";

type JobMatch = {
  job: Job;
  score: number;
  confidence: Confidence;
  matchedSkills: string[];
  missingSkills: string[];
  locationCompatible: boolean;
  locationKnown: boolean;
  remote: boolean;
};

const PAGE_SIZE = 12;
const STOP_WORDS = new Set(["a", "o", "as", "os", "de", "da", "do", "das", "dos", "em", "para", "com", "e", "um", "uma", "na", "no", "por", "que"]);

const normalize = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim();

const tokenize = (value: unknown) => normalize(value).split(/\s+/).filter((token) => token.length > 1 && !STOP_WORDS.has(token));

const unique = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const similarity = (a: string, b: string) => {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.84;
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const coverage = overlap / Math.max(leftTokens.size, rightTokens.size);
  return coverage >= 0.5 ? 0.72 : coverage >= 0.25 ? 0.46 : 0;
};

const textCoverage = (needle: string, haystack: string) => {
  const query = unique(tokenize(needle));
  if (!query.length) return 0;
  const source = new Set(tokenize(haystack));
  return query.filter((token) => source.has(token)).length / query.length;
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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [mode, setMode] = useState<MatchMode>("recommended");
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("TODAS");
  const [workModel, setWorkModel] = useState("TODOS");
  const [strongOnly, setStrongOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [jobsResponse, applicationsResponse] = await Promise.all([
          api.get("/jobs"),
          api.get("/applications/me").catch(() => ({ data: [] })),
        ]);
        if (!active) return;
        setJobs(asArray<Job>(jobsResponse.data).filter((job) => job.active !== false));
        setApplications(asArray(applicationsResponse.data));
      } catch (error) {
        console.error("Erro ao carregar vagas personalizadas:", error);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => setCurrentPage(1), [search, location, workModel, strongOnly, mode]);

  const appliedIds = useMemo(() => new Set(applications.map((application) => application.jobId)), [applications]);
  const candidateSkills = useMemo(() => unique([
    ...(profile?.skills || []),
    ...(profile?.experiences || []).flatMap((experience) => experience.skills || []),
    ...(profile?.courses || []).flatMap((course) => course.skills || []),
  ]), [profile]);
  const candidateRoles = useMemo(() => unique((profile?.experiences || []).flatMap((experience) => [
    experience.role,
    ...(experience.timeline || []).map((entry) => entry.role),
  ])), [profile]);
  const profileText = useMemo(() => [
    profile?.bio,
    ...(profile?.skills || []),
    ...(profile?.experiences || []).flatMap((experience) => [experience.role, experience.description, experience.company]),
    ...(profile?.education || []).flatMap((education) => [education.degree, education.fieldOfStudy, education.description]),
    ...(profile?.courses || []).flatMap((course) => [course.name, course.description]),
  ].filter(Boolean).join(" "), [profile]);

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
  const hasUsefulProfile = candidateSkills.length > 0 || candidateRoles.length > 0 || Boolean(profile?.bio);

  const matches = useMemo<JobMatch[]>(() => jobs.map((job) => {
    const jobSkills = unique(job.skills || []);
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];
    let skillScore = 0;
    if (jobSkills.length > 0 && candidateSkills.length > 0) {
      const coverage = jobSkills.map((jobSkill) => {
        const best = candidateSkills.reduce((current, candidateSkill) => Math.max(current, similarity(jobSkill, candidateSkill)), 0);
        if (best >= 0.55) matchedSkills.push(jobSkill);
        else if (best < 0.35) missingSkills.push(jobSkill);
        return best;
      });
      skillScore = coverage.reduce((total, current) => total + current, 0) / Math.max(1, coverage.length);
    }
    const roleMatch = candidateRoles.reduce((best, role) => Math.max(best, similarity(job.title, role)), 0);
    const textMatch = textCoverage(`${job.title} ${job.requirements || ""} ${job.description || ""}`, profileText);
    let score = jobSkills.length > 0
      ? skillScore * 65 + roleMatch * 25 + Math.min(1, textMatch * 2.2) * 10
      : roleMatch * 62 + Math.min(1, textMatch * 2.4) * 38;
    if (!hasUsefulProfile) score = 0;
    const remote = isRemote(job);
    const locationData = jobLocation(job);
    const locationKnown = remote || Boolean(locationData);
    const locationCompatible = remote || !hasLocationPreferences || Boolean(locationData && acceptedLocations.some((accepted) => sameLocation(accepted, locationData)));
    return {
      job,
      score: Math.max(0, Math.min(100, Math.round(score))),
      confidence: jobSkills.length > 0 ? (candidateSkills.length >= 3 ? "high" : "medium") : (candidateRoles.length > 0 ? "medium" : "low"),
      matchedSkills: matchedSkills.slice(0, 4),
      missingSkills: missingSkills.slice(0, 3),
      locationCompatible,
      locationKnown,
      remote,
    };
  }), [jobs, candidateSkills, candidateRoles, profileText, hasUsefulProfile, acceptedLocations, hasLocationPreferences]);

  const locations = useMemo(() => unique(jobs.map((job) => job.location || [job.city, job.state].filter(Boolean).join(", ")).filter(Boolean)).sort((a, b) => a.localeCompare(b, "pt-BR")), [jobs]);

  const filtered = useMemo(() => {
    let result = [...matches];
    const term = normalize(search);
    if (term) result = result.filter(({ job }) => normalize(`${job.title} ${job.companyName} ${job.location} ${job.description} ${job.requirements} ${(job.skills || []).join(" ")}`).includes(term));
    if (location !== "TODAS") result = result.filter(({ job }) => (job.location || [job.city, job.state].filter(Boolean).join(", ")) === location);
    if (workModel !== "TODOS") result = result.filter(({ job }) => normalize(job.workModel || "Presencial") === normalize(workModel));
    if (strongOnly) result = result.filter((item) => item.score >= 70);
    if (mode === "applied") result = result.filter(({ job }) => appliedIds.has(job.id));

    if (mode === "recommended") {
      result = result.filter((item) => item.locationCompatible);
      if (!includeExclusivePcdJobs) result = result.filter(({ job }) => (job.pcdMode || "GENERAL") !== "EXCLUSIVE");
      result.sort((a, b) => b.score - a.score || getPostedAt(b.job) - getPostedAt(a.job));
    } else {
      result.sort((a, b) => getPostedAt(b.job) - getPostedAt(a.job));
    }
    return result;
  }, [matches, search, location, workModel, strongOnly, mode, appliedIds, includeExclusivePcdJobs]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const pageStart = (activePage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const strongMatches = matches.filter((item) => item.score >= 70 && item.locationCompatible && (includeExclusivePcdJobs || (item.job.pcdMode || "GENERAL") !== "EXCLUSIVE")).length;
  const bestMatches = [...matches].filter((item) => item.locationCompatible && item.score >= 55 && (includeExclusivePcdJobs || (item.job.pcdMode || "GENERAL") !== "EXCLUSIVE")).sort((a, b) => b.score - a.score).slice(0, 3);

  const handleApply = async (job: Job) => {
    if (!user || appliedIds.has(job.id)) return;
    if (!profile?.resumeURL?.trim()) {
      alert("Para se candidatar, deixe seu currículo pronto primeiro.");
      window.location.assign("/user/curriculo");
      return;
    }
    try {
      await api.post("/applications", {
        jobId: job.id,
        jobTitle: job.title,
        companyName: job.isConfidential ? "Empresa Confidencial" : job.companyName,
        candidateId: user.uid,
        companyId: job.ownerId,
        status: "Enviado",
        appliedAt: new Date().toISOString(),
        resumeURL: profile.resumeURL,
      });
      setApplications((current) => [...current, { jobId: job.id, id: `local-${job.id}` }]);
      setSelectedJob(null);
      alert("Candidatura enviada com sucesso!");
    } catch (error) {
      console.error(error);
      alert("Não foi possível enviar a candidatura agora.");
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
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55 md:text-base">Além da trajetória, consideramos onde você realmente aceita trabalhar. Uma vaga excelente na cidade errada deixa de ser recomendação.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-white/10 bg-white/[0.055] p-2">
            <HeroMetric value={jobs.length} label="abertas" />
            <HeroMetric value={strongMatches} label="70%+ viáveis" />
            <HeroMetric value={acceptedLocations.length} label="cidades aceitas" />
          </div>
        </div>
      </section>

      {!hasLocationPreferences && (
        <section className="flex flex-col gap-4 rounded-[26px] border border-amber-200 bg-amber-50 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-amber-700">Localização ainda não configurada</p>
            <h2 className="mt-1 text-lg font-bold text-stone-950">Diga onde você mora e onde aceita trabalhar</h2>
            <p className="mt-1 text-sm text-stone-600">Até você configurar isso, não conseguimos eliminar vagas inviáveis pela distância.</p>
          </div>
          <Link to="/user/perfil" className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-bold text-white">Configurar cidades <ArrowRight className="h-4 w-4" /></Link>
        </section>
      )}

      {bestMatches.length > 0 && mode === "recommended" && (
        <section>
          <div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-terracotta-600">Melhores combinações</p><h2 className="font-serif text-2xl font-bold text-stone-950">Mais alinhadas com você agora</h2></div></div>
          <div className="grid gap-3 lg:grid-cols-3">
            {bestMatches.map((item) => <FeaturedMatch key={item.job.id} item={item} onOpen={() => setSelectedJob(item.job)} />)}
          </div>
        </section>
      )}

      <section id="user-jobs-results" className="scroll-mt-28 rounded-[30px] border border-stone-200 bg-white/85 p-4 shadow-sm md:p-6">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_190px]">
          <div className="relative"><Search className="absolute left-4 top-3.5 h-4 w-4 text-stone-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cargo, empresa, habilidade..." className="w-full rounded-2xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-terracotta-400" /></div>
          <select value={location} onChange={(event) => setLocation(event.target.value)} className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm"><option value="TODAS">Todas as cidades</option>{locations.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={workModel} onChange={(event) => setWorkModel(event.target.value)} className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm"><option value="TODOS">Todos os modelos</option><option>Presencial</option><option>Híbrido</option><option>Remoto</option></select>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-stone-100 pb-4">
          {([['recommended','Para você'],['recent','Mais recentes'],['all','Todas'],['applied','Minhas candidaturas']] as [MatchMode,string][]).map(([value,label]) => <button key={value} onClick={() => setMode(value)} className={`rounded-full px-4 py-2 text-xs font-bold ${mode === value ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600"}`}>{label}</button>)}
          <button onClick={() => setStrongOnly((current) => !current)} className={`ml-auto rounded-full border px-4 py-2 text-xs font-bold ${strongOnly ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-stone-200 text-stone-500"}`}>70%+ match</button>
        </div>

        <div className="mt-5 space-y-3">
          {paginated.length === 0 ? <div className="py-12 text-center text-sm text-stone-500">Nenhuma vaga encontrada com estes critérios.</div> : paginated.map((item) => <JobMatchCard key={item.job.id} item={item} applied={appliedIds.has(item.job.id)} onOpen={() => setSelectedJob(item.job)} />)}
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
    </div>
  );
}

function HeroMetric({ value, label }: { value: number; label: string }) {
  return <div className="rounded-[18px] px-3 py-3 text-center"><div className="text-2xl font-black text-white">{value}</div><div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-white/40">{label}</div></div>;
}

function FeaturedMatch({ item, onOpen }: { item: JobMatch; onOpen: () => void; key?: React.Key }) {
  return <button onClick={onOpen} className="group rounded-[26px] border border-stone-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-terracotta-600">{item.job.isConfidential ? "Empresa confidencial" : item.job.companyName}</p><h3 className="mt-1 text-lg font-bold text-stone-950">{item.job.title}</h3></div><strong className="text-xl text-stone-950">{item.score}%</strong></div><MatchProgress score={item.score} /><LocationStatus item={item} /><PcdBadge job={item.job} /></button>;
}

function JobMatchCard({ item, applied, onOpen }: { item: JobMatch; applied: boolean; onOpen: () => void; key?: React.Key }) {
  const { job } = item;
  return <button onClick={onOpen} className="w-full rounded-[24px] border border-stone-200 bg-white p-5 text-left transition hover:border-terracotta-200 hover:shadow-md"><div className="grid gap-4 lg:grid-cols-[1fr_250px]"><div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-terracotta-600">{job.isConfidential ? "Empresa confidencial" : job.companyName}</span>{applied && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Candidatura enviada</span>}<PcdBadge job={job} /></div><h3 className="mt-1 text-xl font-bold text-stone-950">{job.title}</h3><p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location || [job.city, job.state].filter(Boolean).join(", ")}</span><span>{job.workModel || "Presencial"}</span><span>{job.type}</span></p>{item.matchedSkills.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{item.matchedSkills.map((skill) => <span key={skill} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{skill}</span>)}</div>}</div><div className="rounded-2xl bg-stone-50 p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold text-stone-600">{matchLabel(item.score)}</span><strong className="text-lg text-stone-950">{item.score}%</strong></div><MatchProgress score={item.score} /><LocationStatus item={item} /></div></div></button>;
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
