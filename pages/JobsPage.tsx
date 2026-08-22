import React, { useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ExternalLink,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { JobCard } from "../components/JobCard";
import { JobModal } from "../components/JobModal";
import { Navbar } from "../components/Navbar";
import { SeoHead } from "../components/SeoHead";
import { api, asArray } from "../lib/api";
import {
  buildLocalityRecommendation,
  localityRank,
  type VisitorLocationHint,
} from "../lib/locationPersonalization";
import type { Job } from "../types/job";

const ITEMS_PER_PAGE = 12;
const STOP_WORDS = new Set([
  "a", "o", "as", "os", "de", "da", "do", "das", "dos", "em", "para", "com", "e", "um", "uma", "no", "na", "por",
]);

type PcdFilter = "TODOS" | "PCD" | "INCLUSIVE" | "EXCLUSIVE";
type SourceFilter = "TODOS" | "PLATAFORMA" | "EXTERNA" | "COM_FONTE";

const normalizeSearch = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim();

const words = (value: unknown) =>
  normalizeSearch(value).split(" ").filter((word) => word.length > 1 && !STOP_WORDS.has(word));

const stem = (word: string) => word.replace(/(oes|aes|ais)$/, "ao").replace(/s$/, "");

const distance = (a: string, b: string) => {
  const row = Array.from({ length: a.length + 1 }, (_, index) => index);
  for (let col = 1; col <= b.length; col += 1) {
    let diagonal = row[0];
    row[0] = col;
    for (let line = 1; line <= a.length; line += 1) {
      const old = row[line];
      row[line] = Math.min(
        row[line] + 1,
        row[line - 1] + 1,
        diagonal + (a[line - 1] === b[col - 1] ? 0 : 1),
      );
      diagonal = old;
    }
  }
  return row[a.length];
};

const relevance = (job: Job, search: string) => {
  const query = normalizeSearch(search);
  if (!query) return 1;
  const title = normalizeSearch(job.title);
  const searchable = normalizeSearch([
    job.title, job.companyName, job.sourceName, job.description, job.requirements,
    job.location, job.city, job.state, job.type, job.workModel, ...(job.skills || []),
  ].join(" "));
  if (title.includes(query)) return 1000;

  const haystack = words(searchable);
  const queryWords = words(search);
  let hits = 0;
  let score = 0;
  for (const token of queryWords) {
    const exact = haystack.some(
      (word) => stem(word) === stem(token) || word.startsWith(stem(token)) || stem(token).startsWith(stem(word)),
    );
    const fuzzy = !exact && token.length >= 5 && haystack.some(
      (word) => Math.abs(word.length - token.length) <= 1 && distance(word, token) <= 1,
    );
    if (exact || fuzzy) {
      hits += 1;
      score += title.includes(token) ? 20 : fuzzy ? 5 : 10;
    }
  }
  return hits >= Math.max(1, Math.ceil(queryWords.length * 0.6)) ? score : 0;
};

const locationLabel = (job: Job) =>
  job.city && job.state ? `${job.city}, ${job.state}` : job.location || "";

const jobDate = (job: Job) =>
  new Date(job.sourcePublishedAt || job.postedAt || job.createdAt || job.updatedAt || 0).getTime();

export default function JobsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialParams = useMemo(() => new URLSearchParams(location.search), []);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [visitorLocation, setVisitorLocation] = useState<VisitorLocationHint | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [searchTerm, setSearchTerm] = useState(initialParams.get("q") || "");
  const [locationFilter, setLocationFilter] = useState(initialParams.get("cidade") || "TODOS");
  const [workModelFilter, setWorkModelFilter] = useState("TODOS");
  const [typeFilter, setTypeFilter] = useState("TODOS");
  const [pcdFilter, setPcdFilter] = useState<PcdFilter>("TODOS");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("TODOS");
  const [salaryOnly, setSalaryOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"recentes" | "antigas">("recentes");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let active = true;
    Promise.allSettled([api.get("/jobs"), api.get("/public/location-hint")])
      .then(([jobsResult, locationResult]) => {
        if (!active) return;
        if (jobsResult.status === "fulfilled") {
          setJobs(asArray<Job>(jobsResult.value.data).filter((job) => job.active !== false));
        } else {
          console.error("Erro ao carregar vagas:", jobsResult.reason);
        }
        if (locationResult.status === "fulfilled") {
          setVisitorLocation(locationResult.value.data as VisitorLocationHint);
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const availableLocations = useMemo(
    () => Array.from(new Set<string>(jobs.map(locationLabel).filter((value): value is string => Boolean(value))))
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [jobs],
  );

  const locality = useMemo(
    () => buildLocalityRecommendation(visitorLocation, availableLocations),
    [visitorLocation, availableLocations],
  );

  const availableTypes = useMemo(
    () => Array.from(new Set<string>(jobs.map((job) => job.type).filter((value): value is string => Boolean(value))))
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [jobs],
  );

  const cityCount = availableLocations.length;
  const pcdCount = jobs.filter((job) => job.pcdMode === "INCLUSIVE" || job.pcdMode === "EXCLUSIVE").length;

  const filteredAndSortedJobs = useMemo(() => {
    let result = [...jobs];

    if (searchTerm.trim()) {
      result = result
        .map((job) => ({ job, score: relevance(job, searchTerm) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ job }) => job);
    }

    if (workModelFilter !== "TODOS") {
      result = result.filter(
        (job) => normalizeSearch(job.workModel || "Presencial") === normalizeSearch(workModelFilter),
      );
    }

    if (locationFilter !== "TODOS") {
      result = result.filter(
        (job) => normalizeSearch(locationLabel(job)) === normalizeSearch(locationFilter),
      );
    }

    if (typeFilter !== "TODOS") {
      result = result.filter((job) => normalizeSearch(job.type) === normalizeSearch(typeFilter));
    }

    if (pcdFilter === "PCD") {
      result = result.filter((job) => job.pcdMode === "INCLUSIVE" || job.pcdMode === "EXCLUSIVE");
    } else if (pcdFilter === "INCLUSIVE") {
      result = result.filter((job) => job.pcdMode === "INCLUSIVE");
    } else if (pcdFilter === "EXCLUSIVE") {
      result = result.filter((job) => job.pcdMode === "EXCLUSIVE");
    }

    if (sourceFilter === "PLATAFORMA") {
      result = result.filter((job) => !job.isExternalListing);
    } else if (sourceFilter === "EXTERNA") {
      result = result.filter((job) => job.isExternalListing === true);
    } else if (sourceFilter === "COM_FONTE") {
      result = result.filter((job) => Boolean(job.sourceUrl));
    }

    if (salaryOnly) result = result.filter((job) => Boolean(job.salary?.trim()));

    if (!searchTerm.trim()) {
      result.sort((a, b) => {
        if (locationFilter === "TODOS" && locality) {
          const localityDifference = localityRank(locationLabel(a), locality) - localityRank(locationLabel(b), locality);
          if (localityDifference) return localityDifference;
        }
        const sponsoredDifference = Number(Boolean(b.isSponsored)) - Number(Boolean(a.isSponsored));
        if (sponsoredDifference) return sponsoredDifference;
        return sortBy === "recentes" ? jobDate(b) - jobDate(a) : jobDate(a) - jobDate(b);
      });
    }

    return result;
  }, [
    jobs, searchTerm, locationFilter, workModelFilter, typeFilter, pcdFilter,
    sourceFilter, salaryOnly, sortBy, locality,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, locationFilter, workModelFilter, typeFilter, pcdFilter, sourceFilter, salaryOnly, sortBy]);

  const filterCount = [
    locationFilter !== "TODOS",
    workModelFilter !== "TODOS",
    typeFilter !== "TODOS",
    pcdFilter !== "TODOS",
    sourceFilter !== "TODOS",
    salaryOnly,
  ].filter(Boolean).length;

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedJobs.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const currentJobs = filteredAndSortedJobs.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const clearFilters = () => {
    setSearchTerm("");
    setLocationFilter("TODOS");
    setWorkModelFilter("TODOS");
    setTypeFilter("TODOS");
    setPcdFilter("TODOS");
    setSourceFilter("TODOS");
    setSalaryOnly(false);
    setSortBy("recentes");
  };

  const openJob = (job: Job) => {
    if (job.slug) navigate(`/vagas/${job.slug}`);
    else setSelectedJob(job);
  };

  return (
    <div className="min-h-screen bg-[#fffaf5] text-[#2d211c]">
      <SeoHead
        title="Vagas em Pirassununga e região | PiraNegócios"
        description="Pesquise vagas por cidade, modalidade, contrato e oportunidades PCD em Pirassununga e região."
        canonical={`${window.location.origin}/vagas`}
      />
      <Navbar />

      <main>
        <section className="relative overflow-hidden border-b border-[#4b3328]/10 bg-[#f2e7dd]">
          <div className="pointer-events-none absolute right-[-90px] top-[-120px] h-80 w-80 rounded-full border-[54px] border-[#c96847]/8" />
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b96345]">
                  Radar de oportunidades
                </p>
                <h1 className="mt-2 max-w-4xl font-serif text-4xl font-bold tracking-[-.035em] text-[#2d211c] sm:text-5xl lg:text-6xl">
                  Encontre trabalho sem precisar procurar em vinte lugares diferentes.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[#735f54] sm:text-base">
                  Vagas de empresas, PATs, agências e fontes públicas reunidas com cidade, modalidade, PCD e origem identificados.
                </p>
                {locality?.recommendedLabel && (
                  <div className="mt-4 inline-flex max-w-2xl items-start gap-2 rounded-2xl border border-[#c96847]/15 bg-white/55 px-3.5 py-2.5 text-xs font-semibold leading-5 text-[#6d5549]">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#c96847]" />
                    <span>
                      {locality.exact
                        ? `Você parece estar em ${locality.detectedLabel}. Sem filtros, mostramos primeiro as vagas daí e depois as cidades mais próximas.`
                        : `Você parece estar em ${locality.detectedLabel}. Como não há vagas exatamente aí, começamos por ${locality.recommendedLabel}.`}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
                <Metric value={jobs.length} label="vagas abertas" />
                <Metric value={cityCount} label="localidades" />
                <Metric value={pcdCount} label="vagas PCD" />
              </div>
            </div>

            <div className="mt-8 rounded-[26px] border border-[#4b3328]/10 bg-[#fffaf5] p-2.5 shadow-[0_18px_55px_rgba(69,44,32,.09)]">
              <div className="grid gap-2 md:grid-cols-[1.5fr_.85fr_auto]">
                <label className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a1887b]" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Cargo, empresa, habilidade ou palavra-chave"
                    className="h-12 w-full rounded-2xl border-0 bg-white pl-11 pr-10 text-sm font-medium outline-none ring-1 ring-[#4b3328]/10 placeholder:text-[#af9e95] focus:ring-2 focus:ring-[#c96847]/30"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#a18d82] hover:bg-[#f4ece6]"
                      aria-label="Limpar busca"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </label>
                <label className="relative">
                  <MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a1887b]" />
                  <select
                    value={locationFilter}
                    onChange={(event) => setLocationFilter(event.target.value)}
                    className="h-12 w-full appearance-none rounded-2xl border-0 bg-white pl-11 pr-4 text-sm font-bold text-[#574238] outline-none ring-1 ring-[#4b3328]/10 focus:ring-2 focus:ring-[#c96847]/30"
                  >
                    <option value="TODOS">Toda a região</option>
                    {availableLocations.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#2d211c] px-6 text-sm font-black text-white transition hover:bg-[#1f1714]"
                >
                  Buscar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="grid gap-7 lg:grid-cols-[278px_minmax(0,1fr)]">
            <aside className="self-start lg:sticky lg:top-24">
              <div className="rounded-[26px] border border-[#4b3328]/10 bg-white p-5 shadow-[0_10px_35px_rgba(66,43,31,.04)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-[#c96847]" />
                    <h2 className="text-sm font-black text-[#33251f]">Filtros</h2>
                    {filterCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c96847] px-1.5 text-[9px] font-black text-white">{filterCount}</span>
                    )}
                  </div>
                  {filterCount > 0 && (
                    <button onClick={clearFilters} className="text-[10px] font-bold text-[#a25a42] hover:underline">Limpar</button>
                  )}
                </div>

                <FilterGroup title="Modelo de trabalho">
                  <ChoiceList
                    value={workModelFilter}
                    onChange={setWorkModelFilter}
                    options={["TODOS", "Presencial", "Híbrido", "Remoto"]}
                    allLabel="Todos"
                  />
                </FilterGroup>

                <FilterGroup title="Contrato">
                  <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="filter-select">
                    <option value="TODOS">Todos os contratos</option>
                    {availableTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </FilterGroup>

                <FilterGroup title="Oportunidades PCD">
                  <ChoiceList
                    value={pcdFilter}
                    onChange={(value) => setPcdFilter(value as PcdFilter)}
                    options={["TODOS", "PCD", "INCLUSIVE", "EXCLUSIVE"]}
                    labels={{ TODOS: "Todas", PCD: "Abertas a PCD", INCLUSIVE: "Também para PCD", EXCLUSIVE: "Exclusivas PCD" }}
                    icon={<Accessibility className="h-3.5 w-3.5" />}
                  />
                </FilterGroup>

                <FilterGroup title="Origem da vaga">
                  <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as SourceFilter)} className="filter-select">
                    <option value="TODOS">Todas as origens</option>
                    <option value="PLATAFORMA">Publicadas no PiraNegócios</option>
                    <option value="EXTERNA">Fontes externas</option>
                    <option value="COM_FONTE">Com link da fonte</option>
                  </select>
                </FilterGroup>

                <FilterGroup title="Remuneração">
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#4b3328]/8 bg-[#faf6f2] p-3">
                    <input
                      type="checkbox"
                      checked={salaryOnly}
                      onChange={(event) => setSalaryOnly(event.target.checked)}
                      className="h-4 w-4 accent-[#c96847]"
                    />
                    <span className="flex items-center gap-2 text-xs font-bold text-[#5d493f]">
                      <DollarSign className="h-3.5 w-3.5 text-[#c96847]" /> Somente com salário informado
                    </span>
                  </label>
                </FilterGroup>

                <div className="mt-5 rounded-2xl bg-[#2d211c] p-4 text-white">
                  <p className="text-[9px] font-black uppercase tracking-[.16em] text-[#e7a283]">Quer aparecer para empresas?</p>
                  <p className="mt-2 text-sm font-bold">Crie seu currículo gratuito.</p>
                  <p className="mt-1 text-[11px] leading-5 text-white/45">Seu perfil pode entrar no banco de talentos de empresas verificadas.</p>
                  <Link to="/login?returnTo=%2Fuser%2Fcurriculo" className="mt-4 inline-flex items-center gap-1.5 text-xs font-black text-[#f0bf9f] hover:text-white">
                    Começar agora <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </aside>

            <div className="min-w-0">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-[#7c685d]">
                    <strong className="font-black text-[#2d211c]">{filteredAndSortedJobs.length}</strong>{" "}
                    {filteredAndSortedJobs.length === 1 ? "oportunidade encontrada" : "oportunidades encontradas"}
                  </p>
                  {searchTerm && <p className="mt-1 text-xs text-[#a08c81]">Resultados para “{searchTerm}”</p>}
                  {!searchTerm && locationFilter === "TODOS" && locality?.recommendedLabel && (
                    <p className="mt-1 text-xs font-semibold text-[#a05a43]">
                      Ordenadas por proximidade a {locality.detectedLabel}, depois por data.
                    </p>
                  )}
                </div>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as "recentes" | "antigas")}
                  className="self-start rounded-xl border border-[#4b3328]/10 bg-white px-3.5 py-2.5 text-xs font-bold text-[#5d493f] outline-none sm:self-auto"
                >
                  <option value="recentes">Mais recentes em cada cidade</option>
                  <option value="antigas">Mais antigas em cada cidade</option>
                </select>
              </div>

              {loading ? (
                <div className="space-y-4">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="h-52 animate-pulse rounded-[24px] border border-[#4b3328]/8 bg-white" />
                  ))}
                </div>
              ) : currentJobs.length > 0 ? (
                <div className="space-y-4">
                  {currentJobs.map((job) => (
                    <JobCard key={job.id} job={job} onClick={() => openJob(job)} />
                  ))}
                </div>
              ) : (
                <div className="rounded-[30px] border border-dashed border-[#4b3328]/20 bg-white/60 p-10 text-center sm:p-14">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f1e4da] text-[#bd6547]">
                    <Search className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-serif text-2xl font-bold text-[#2d211c]">Nenhuma vaga passou por todos esses filtros.</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#7b685e]">Tente ampliar a cidade, remover algum filtro ou pesquisar por um termo mais geral.</p>
                  <button onClick={clearFilters} className="mt-5 rounded-xl bg-[#2d211c] px-5 py-2.5 text-xs font-black text-white">Limpar filtros</button>
                </div>
              )}

              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={safePage === 1}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#4b3328]/10 bg-white text-[#604b40] disabled:opacity-30"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-3 text-xs font-bold text-[#756156]">Página {safePage} de {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={safePage === totalPages}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#4b3328]/10 bg-white text-[#604b40] disabled:opacity-30"
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="border-t border-[#4b3328]/8 bg-[#f2e7dd]">
          <div className="mx-auto grid max-w-7xl gap-5 px-4 py-10 sm:px-6 md:grid-cols-2 lg:px-8">
            <div className="rounded-[26px] border border-[#4b3328]/10 bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f0ded3] text-[#b76042]"><CheckCircle2 className="h-5 w-5" /></div>
              <h3 className="mt-4 font-serif text-2xl font-bold">Encontrou uma vaga em outro lugar?</h3>
              <p className="mt-2 text-xs leading-6 text-[#79665b]">Quando a oportunidade é coletada de uma fonte pública, procuramos manter a publicação original vinculada para você conferir os dados.</p>
              <div className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#a35a42]"><ExternalLink className="h-3.5 w-3.5" /> Procure o selo de origem nos cards e detalhes.</div>
            </div>
            <div className="rounded-[26px] bg-[#c96847] p-6 text-white">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/12"><BriefcaseBusiness className="h-5 w-5" /></div>
              <h3 className="mt-4 font-serif text-2xl font-bold">Está contratando?</h3>
              <p className="mt-2 text-xs leading-6 text-white/70">Publique sua vaga com cidade, PCD, habilidades e candidatura estruturados e encontre talentos da própria região.</p>
              <Link to="/company" className="mt-4 inline-flex items-center gap-2 text-xs font-black text-white">Acessar área da empresa <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#4b3328]/10 bg-[#2d211c] px-4 py-7 text-center text-[11px] text-white/30">
        © 2026 PiraNegócios · Vagas, currículos e talentos da região.
      </footer>

      {selectedJob && (
        <JobModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onApply={() => navigate(`/login?returnTo=${encodeURIComponent(`/vagas?applyTo=${selectedJob.id}`)}`)}
        />
      )}

      <style>{`
        .filter-select{width:100%;border:1px solid rgba(75,51,40,.10);border-radius:12px;background:#faf6f2;padding:10px 11px;font-size:12px;font-weight:700;color:#5d493f;outline:none}.filter-select:focus{border-color:rgba(201,104,71,.45);box-shadow:0 0 0 3px rgba(201,104,71,.08)}
      `}</style>
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-[104px] rounded-2xl border border-[#4b3328]/10 bg-white/65 px-4 py-3 backdrop-blur-sm">
      <p className="font-serif text-2xl font-bold text-[#2d211c]">{value.toLocaleString("pt-BR")}</p>
      <p className="mt-0.5 text-[9px] font-black uppercase tracking-[.12em] text-[#947e72]">{label}</p>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 border-t border-[#4b3328]/8 pt-4">
      <p className="mb-2.5 text-[10px] font-black uppercase tracking-[.13em] text-[#927d72]">{title}</p>
      {children}
    </div>
  );
}

function ChoiceList({
  value, onChange, options, allLabel, labels, icon,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel?: string;
  labels?: Record<string, string>;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const label = labels?.[option] || (option === "TODOS" ? allLabel || "Todos" : option);
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition ${
              active ? "bg-[#2d211c] text-white shadow-sm" : "bg-[#faf6f2] text-[#715c51] ring-1 ring-[#4b3328]/8 hover:bg-[#f2e8df]"
            }`}
          >
            {option !== "TODOS" && icon}
            {label}
          </button>
        );
      })}
    </div>
  );
}
