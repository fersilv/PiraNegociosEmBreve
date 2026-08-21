import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { api, asArray } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Job } from "../types/job";
import { JobModal } from "../components/JobModal";

type MatchMode = "recommended" | "recent" | "all" | "applied";

type JobMatch = {
  job: Job;
  score: number;
  confidence: "high" | "medium" | "low";
  matchedSkills: string[];
  missingSkills: string[];
  roleMatch: number;
  textMatch: number;
};

const PAGE_SIZE = 12;

const STOP_WORDS = new Set([
  "a",
  "o",
  "as",
  "os",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "para",
  "com",
  "e",
  "um",
  "uma",
  "na",
  "no",
  "nas",
  "nos",
  "por",
  "que",
]);

const normalize = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim();

const tokenize = (value: unknown) =>
  normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

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
  const value = job.sourcePublishedAt || job.postedAt || job.updatedAt;
  const date = new Date(value || 0).getTime();
  return Number.isFinite(date) ? date : 0;
};

export function UserJobsPage() {
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
        setJobs(
          asArray<Job>(jobsResponse.data).filter((job) => job.active !== false),
        );
        setApplications(asArray(applicationsResponse.data));
      } catch (error) {
        console.error("Erro ao carregar vagas personalizadas:", error);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, location, workModel, strongOnly, mode]);

  const appliedIds = useMemo(
    () => new Set(applications.map((application) => application.jobId)),
    [applications],
  );

  const candidateSkills = useMemo(
    () =>
      unique([
        ...(profile?.skills || []),
        ...(profile?.experiences || []).flatMap((experience) =>
          experience.skills || [],
        ),
        ...(profile?.courses || []).flatMap((course) => course.skills || []),
      ]),
    [profile],
  );

  const candidateRoles = useMemo(
    () =>
      unique(
        (profile?.experiences || []).flatMap((experience) => [
          experience.role,
          ...(experience.timeline || []).map((entry) => entry.role),
        ]),
      ),
    [profile],
  );

  const profileText = useMemo(
    () =>
      [
        profile?.bio,
        ...(profile?.skills || []),
        ...(profile?.experiences || []).flatMap((experience) => [
          experience.role,
          experience.description,
          experience.company,
        ]),
        ...(profile?.education || []).flatMap((education) => [
          education.degree,
          education.fieldOfStudy,
          education.description,
        ]),
        ...(profile?.courses || []).flatMap((course) => [
          course.name,
          course.description,
        ]),
      ]
        .filter(Boolean)
        .join(" "),
    [profile],
  );

  const hasUsefulProfile =
    candidateSkills.length > 0 || candidateRoles.length > 0 || Boolean(profile?.bio);

  const matches = useMemo<JobMatch[]>(() => {
    return jobs.map((job) => {
      const jobSkills = unique(job.skills || []);
      const matchedSkills: string[] = [];
      const missingSkills: string[] = [];
      let skillScore = 0;

      if (jobSkills.length > 0 && candidateSkills.length > 0) {
        const coverage = jobSkills.map((jobSkill) => {
          const best = candidateSkills.reduce(
            (current, candidateSkill) =>
              Math.max(current, similarity(jobSkill, candidateSkill)),
            0,
          );
          if (best >= 0.55) matchedSkills.push(jobSkill);
          else if (best < 0.35) missingSkills.push(jobSkill);
          return best;
        });
        skillScore =
          coverage.reduce((total, current) => total + current, 0) /
          Math.max(1, coverage.length);
      }

      const roleMatch = candidateRoles.reduce(
        (best, role) => Math.max(best, similarity(job.title, role)),
        0,
      );
      const textMatch = textCoverage(
        `${job.title} ${job.requirements || ""} ${job.description || ""}`,
        profileText,
      );

      let score = 0;
      let confidence: JobMatch["confidence"] = "low";

      if (jobSkills.length > 0) {
        score = skillScore * 65 + roleMatch * 25 + Math.min(1, textMatch * 2.2) * 10;
        confidence = candidateSkills.length >= 3 ? "high" : "medium";
      } else {
        score = roleMatch * 62 + Math.min(1, textMatch * 2.4) * 38;
        confidence = candidateRoles.length > 0 ? "medium" : "low";
      }

      if (!hasUsefulProfile) score = 0;

      return {
        job,
        score: Math.max(0, Math.min(100, Math.round(score))),
        confidence,
        matchedSkills: matchedSkills.slice(0, 4),
        missingSkills: missingSkills.slice(0, 3),
        roleMatch: Math.round(roleMatch * 100),
        textMatch: Math.round(Math.min(1, textMatch * 2.2) * 100),
      };
    });
  }, [jobs, candidateSkills, candidateRoles, profileText, hasUsefulProfile]);

  const locations = useMemo(
    () =>
      unique(
        jobs
          .map((job) => job.location || [job.city, job.state].filter(Boolean).join("/"))
          .filter(Boolean),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [jobs],
  );

  const filtered = useMemo(() => {
    let result = [...matches];
    const term = normalize(search);

    if (term) {
      result = result.filter(({ job }) =>
        normalize(
          `${job.title} ${job.companyName} ${job.location} ${job.description} ${job.requirements}`,
        ).includes(term),
      );
    }

    if (location !== "TODAS") {
      result = result.filter(({ job }) => job.location === location);
    }

    if (workModel !== "TODOS") {
      result = result.filter(
        ({ job }) => normalize(job.workModel || "Presencial") === normalize(workModel),
      );
    }

    if (strongOnly) result = result.filter((item) => item.score >= 70);
    if (mode === "applied") result = result.filter(({ job }) => appliedIds.has(job.id));

    if (mode === "recent") {
      result.sort((a, b) => getPostedAt(b.job) - getPostedAt(a.job));
    } else if (mode === "all") {
      result.sort((a, b) => getPostedAt(b.job) - getPostedAt(a.job));
    } else {
      result.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return getPostedAt(b.job) - getPostedAt(a.job);
      });
    }

    return result;
  }, [matches, search, location, workModel, strongOnly, mode, appliedIds]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const pageStart = (activePage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const firstVisible = filtered.length === 0 ? 0 : pageStart + 1;
  const lastVisible = Math.min(pageStart + PAGE_SIZE, filtered.length);

  const strongMatches = matches.filter((item) => item.score >= 70).length;
  const bestMatches = [...matches]
    .filter((item) => item.score >= 55)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const goToPage = (page: number) => {
    const nextPage = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(nextPage);
    requestAnimationFrame(() => {
      document
        .getElementById("user-jobs-results")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleApply = async (job: Job) => {
    if (!user) return;
    if (appliedIds.has(job.id)) return;

    if (!profile?.resumeURL?.trim()) {
      alert(
        "Para se candidatar, deixe seu currículo pronto primeiro. Vamos levar você até ele agora.",
      );
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
      setApplications((current) => [
        ...current,
        { jobId: job.id, id: `local-${job.id}` },
      ]);
      setSelectedJob(null);
      alert("Candidatura enviada com sucesso!");
    } catch (error) {
      console.error(error);
      alert("Não foi possível enviar a candidatura agora.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 md:space-y-7">
      <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[#2b211c] px-6 py-7 text-white shadow-[0_32px_90px_rgba(45,28,18,.18)] md:px-8 md:py-9">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#d98b68]/18 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-white/[0.04] blur-2xl" />
        <div className="relative grid gap-7 xl:grid-cols-[1.35fr_.65fr] xl:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f0c2a9]">
              <Sparkles className="h-3.5 w-3.5" /> Oportunidades para você
            </span>
            <h1 className="mt-4 max-w-3xl font-serif text-3xl font-bold tracking-tight md:text-5xl">
              Vagas que conversam com a sua trajetória.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/52 md:text-base">
              Cruzamos suas habilidades, cargos e histórico profissional com as vagas abertas para destacar onde existe mais aderência.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-white/10 bg-white/[0.055] p-2 backdrop-blur">
            <HeroMetric value={jobs.length} label="abertas" />
            <HeroMetric value={strongMatches} label="70%+ match" />
            <HeroMetric value={applications.length} label="candidaturas" />
          </div>
        </div>
      </section>

      {!hasUsefulProfile && (
        <section className="flex flex-col gap-4 rounded-[26px] border border-amber-200 bg-amber-50 p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">Seu match ainda pode melhorar</p>
            <h2 className="mt-1 text-lg font-bold text-stone-950">Complete o currículo para personalizar as vagas</h2>
            <p className="mt-1 max-w-2xl text-sm text-stone-600">Precisamos de habilidades, experiências ou um resumo profissional para calcular aderência com segurança.</p>
          </div>
          <Link to="/user/curriculo" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 py-3 text-sm font-bold text-white">
            Completar currículo <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      )}

      {hasUsefulProfile && bestMatches.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-terracotta-700">Destaques do seu perfil</p>
              <h2 className="mt-1 text-2xl font-bold text-stone-950">Melhores combinações agora</h2>
            </div>
            <span className="hidden text-xs text-stone-400 sm:block">Atualizado com seu currículo atual</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {bestMatches.map((item) => (
              <article key={item.job.id} className="user-elevated group rounded-[26px] border border-[#5b4030]/10 bg-[#fffdfa]/90 p-5 transition duration-200 hover:-translate-y-1 hover:border-[#d98b68]/35">
                <div className="flex items-start justify-between gap-3">
                  <MatchBadge score={item.score} />
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-stone-500">{item.confidence === "high" ? "match forte" : "estimativa"}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-stone-950">{item.job.title}</h3>
                <p className="mt-1 text-sm font-medium text-terracotta-700">{item.job.isConfidential ? "Empresa confidencial" : item.job.companyName}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-500"><MapPin className="h-3.5 w-3.5" /> {item.job.location || "Local a combinar"}</p>

                <MatchProgress score={item.score} />

                {item.matchedSkills.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {item.matchedSkills.slice(0, 3).map((skill) => (
                      <span key={skill} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">✓ {skill}</span>
                    ))}
                  </div>
                )}

                <button type="button" onClick={() => setSelectedJob(item.job)} className="mt-5 flex w-full items-center justify-between rounded-xl bg-stone-950 px-4 py-3 text-sm font-bold text-white transition group-hover:bg-[#3a2921]">
                  Ver oportunidade <ArrowRight className="h-4 w-4" />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="user-glass rounded-[30px] p-4 md:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cargo, empresa, habilidade ou palavra-chave..."
              className="w-full py-3.5 pl-11 pr-4 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={location} onChange={(event) => setLocation(event.target.value)} className="min-w-[155px] px-3 py-3 text-xs font-bold text-stone-700">
              <option value="TODAS">Todas as cidades</option>
              {locations.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={workModel} onChange={(event) => setWorkModel(event.target.value)} className="min-w-[135px] px-3 py-3 text-xs font-bold text-stone-700">
              <option value="TODOS">Todo modelo</option>
              <option value="Presencial">Presencial</option>
              <option value="Híbrido">Híbrido</option>
              <option value="Remoto">Remoto</option>
            </select>
            <button type="button" onClick={() => setStrongOnly((value) => !value)} className={`inline-flex items-center gap-2 rounded-2xl border px-3.5 py-3 text-xs font-bold transition ${strongOnly ? "border-terracotta-300 bg-terracotta-50 text-terracotta-800" : "border-[#5b4030]/10 bg-white/70 text-stone-600"}`}>
              <Filter className="h-4 w-4" /> 70%+ match
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-1 overflow-x-auto rounded-2xl bg-[#eadfd5]/55 p-1.5">
          <ModeButton active={mode === "recommended"} onClick={() => setMode("recommended")}>Para você</ModeButton>
          <ModeButton active={mode === "recent"} onClick={() => setMode("recent")}>Mais recentes</ModeButton>
          <ModeButton active={mode === "all"} onClick={() => setMode("all")}>Todas</ModeButton>
          <ModeButton active={mode === "applied"} onClick={() => setMode("applied")}>Minhas candidaturas</ModeButton>
        </div>
      </section>

      <section id="user-jobs-results" className="scroll-mt-28 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">Explorar</p>
            <h2 className="mt-1 text-xl font-bold text-stone-950">{filtered.length} {filtered.length === 1 ? "oportunidade" : "oportunidades"}</h2>
            {!loading && filtered.length > 0 && (
              <p className="mt-1 text-xs text-stone-400">
                Exibindo {firstVisible}–{lastVisible} de {filtered.length}
              </p>
            )}
          </div>
          {hasUsefulProfile && mode === "recommended" && (
            <span className="hidden items-center gap-1.5 text-xs font-semibold text-stone-500 sm:flex"><Target className="h-4 w-4 text-terracotta-600" /> ordenadas pelo seu perfil</span>
          )}
        </div>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-terracotta-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-[#5b4030]/15 bg-white/50 p-10 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-stone-300" />
            <h3 className="mt-3 font-bold text-stone-900">Nenhuma vaga nesse recorte</h3>
            <p className="mt-1 text-sm text-stone-500">Tente remover filtros ou explorar todas as oportunidades.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {paginated.map((item) => {
                const hasApplied = appliedIds.has(item.job.id);
                return (
                  <article key={item.job.id} className="group rounded-[28px] border border-[#5b4030]/10 bg-[#fffdfa]/88 p-5 shadow-[0_12px_40px_rgba(63,42,29,.055)] transition hover:border-[#d98b68]/35 hover:shadow-[0_18px_55px_rgba(63,42,29,.09)] md:p-6">
                    <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {hasUsefulProfile && <MatchBadge score={item.score} compact />}
                          {hasApplied && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Candidatado</span>}
                          {item.job.isSponsored && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">Destaque</span>}
                        </div>

                        <h3 className="mt-3 text-xl font-bold text-stone-950 md:text-2xl">{item.job.title}</h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500">
                          <span className="font-semibold text-terracotta-700">{item.job.isConfidential ? "Empresa confidencial" : item.job.companyName}</span>
                          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {item.job.location || "Local a combinar"}</span>
                          <span>{item.job.workModel || "Presencial"}</span>
                          {item.job.type && <span>{item.job.type}</span>}
                        </div>

                        {hasUsefulProfile && <MatchProgress score={item.score} compact />}

                        {hasUsefulProfile && (
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">O que combina</p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {item.matchedSkills.length > 0 ? item.matchedSkills.map((skill) => (
                                  <span key={skill} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{skill}</span>
                                )) : (
                                  <span className="text-xs text-stone-500">{item.roleMatch >= 55 ? "Seu histórico de cargos se aproxima desta oportunidade." : "Aderência calculada pelo conteúdo do currículo."}</span>
                                )}
                              </div>
                            </div>
                            {item.missingSkills.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">A vaga também cita</p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {item.missingSkills.map((skill) => <span key={skill} className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">{skill}</span>)}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex min-w-[160px] flex-col gap-2 lg:items-end">
                        {item.job.salary && <p className="text-sm font-bold text-stone-800">{item.job.salary}</p>}
                        <button type="button" onClick={() => setSelectedJob(item.job)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-[#3a2921] lg:w-auto">
                          Ver detalhes <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {totalPages > 1 && (
              <nav className="mt-5 flex flex-col gap-3 rounded-[24px] border border-[#5b4030]/10 bg-[#fffdfa]/75 p-3 shadow-[0_12px_35px_rgba(63,42,29,.04)] sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação das vagas">
                <button
                  type="button"
                  onClick={() => goToPage(activePage - 1)}
                  disabled={activePage === 1}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#5b4030]/10 bg-white/80 px-4 py-2.5 text-xs font-bold text-stone-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </button>

                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs font-semibold text-stone-500">
                    Página <strong className="text-stone-900">{activePage}</strong> de {totalPages}
                  </span>
                  <div className="hidden items-center gap-1 md:flex">
                    {paginationWindow(activePage, totalPages).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => goToPage(page)}
                        className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-bold transition ${
                          page === activePage
                            ? "bg-[#2b211c] text-white shadow-sm"
                            : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                        }`}
                        aria-current={page === activePage ? "page" : undefined}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => goToPage(activePage + 1)}
                  disabled={activePage === totalPages}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2b211c] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#3a2921] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Próxima <ChevronRight className="h-4 w-4" />
                </button>
              </nav>
            )}
          </>
        )}
      </section>

      <section className="rounded-[26px] border border-[#5b4030]/10 bg-white/55 p-5 md:flex md:items-center md:justify-between md:gap-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-terracotta-100 text-terracotta-700"><TrendingUp className="h-5 w-5" /></span>
          <div>
            <h3 className="font-bold text-stone-950">O match melhora junto com o seu currículo</h3>
            <p className="mt-1 text-sm text-stone-500">Atualize experiências e habilidades para deixar as recomendações cada vez mais precisas.</p>
          </div>
        </div>
        <Link to="/user/curriculo" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-terracotta-700 md:mt-0">Atualizar currículo <ArrowRight className="h-4 w-4" /></Link>
      </section>

      {selectedJob && (
        <JobModal
          job={selectedJob}
          hasApplied={appliedIds.has(selectedJob.id)}
          onClose={() => setSelectedJob(null)}
          onApply={() => handleApply(selectedJob)}
        />
      )}
    </div>
  );
}

function HeroMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[18px] bg-black/10 px-3 py-3 text-center">
      <p className="text-xl font-bold text-white md:text-2xl">{value}</p>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.13em] text-white/35">{label}</p>
    </div>
  );
}

function MatchBadge({ score, compact = false }: { score: number; compact?: boolean }) {
  const style = score >= 75 ? "bg-emerald-50 text-emerald-700" : score >= 55 ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-600";
  return <span className={`inline-flex items-center gap-1.5 rounded-full font-bold ${style} ${compact ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-xs"}`}><Target className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /> {score}% match</span>;
}

function MatchProgress({ score, compact = false }: { score: number; compact?: boolean }) {
  const label = score >= 75
    ? "Compatibilidade forte"
    : score >= 55
      ? "Boa compatibilidade"
      : score >= 35
        ? "Compatibilidade parcial"
        : "Baixa compatibilidade";
  const barStyle = score >= 75
    ? "bg-emerald-500"
    : score >= 55
      ? "bg-amber-500"
      : score >= 35
        ? "bg-orange-400"
        : "bg-stone-400";

  return (
    <div className={compact ? "mt-4 max-w-xl" : "mt-4"}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className={`${compact ? "text-[10px]" : "text-xs"} font-bold text-stone-600`}>
          {label}
        </span>
        <span className={`${compact ? "text-[10px]" : "text-xs"} font-black tabular-nums text-stone-900`}>
          {score}%
        </span>
      </div>
      <div
        className={`${compact ? "h-2" : "h-2.5"} overflow-hidden rounded-full bg-stone-100 shadow-inner`}
        role="progressbar"
        aria-label={`Compatibilidade com a vaga: ${score}%`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
      >
        <div
          className={`h-full rounded-full ${barStyle} transition-[width] duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function paginationWindow(current: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${active ? "bg-[#2b211c] text-white shadow-sm" : "text-stone-600 hover:bg-white/50"}`}>
      {children}
    </button>
  );
}
