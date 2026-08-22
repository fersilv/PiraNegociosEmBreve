import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  FileText,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UserRoundSearch,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AdCarousel } from "../components/AdCarousel";
import { JobCard } from "../components/JobCard";
import { Navbar } from "../components/Navbar";
import { SeoHead } from "../components/SeoHead";
import { useAuth } from "../contexts/AuthContext";
import { api, asArray } from "../lib/api";
import {
  buildLocalityRecommendation,
  localityRank,
  type VisitorLocationHint,
} from "../lib/locationPersonalization";
import type { Job } from "../types/job";

const jobDate = (job: Job) =>
  new Date(
    job.sourcePublishedAt || job.postedAt || job.createdAt || job.updatedAt || 0,
  ).getTime();

const jobLocation = (job: Job) =>
  job.city && job.state ? `${job.city}, ${job.state}` : job.location || "";

export default function Home() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [visitorLocation, setVisitorLocation] = useState<VisitorLocationHint | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    let active = true;
    Promise.allSettled([api.get("/jobs"), api.get("/public/location-hint")])
      .then(([jobsResult, locationResult]) => {
        if (!active) return;
        if (jobsResult.status === "fulfilled") {
          setJobs(asArray<Job>(jobsResult.value.data).filter((job) => job.active !== false));
        } else {
          console.error("Erro ao carregar vagas públicas:", jobsResult.reason);
        }
        if (locationResult.status === "fulfilled") {
          setVisitorLocation(locationResult.value.data as VisitorLocationHint);
        }
      })
      .finally(() => active && setLoadingJobs(false));
    return () => {
      active = false;
    };
  }, []);

  const cities = useMemo(
    () =>
      Array.from(
        new Set<string>(
          jobs.map(jobLocation).filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [jobs],
  );

  const locality = useMemo(
    () => buildLocalityRecommendation(visitorLocation, cities),
    [visitorLocation, cities],
  );

  const sourceCount = useMemo(
    () =>
      new Set(
        jobs
          .map((job) =>
            job.isConfidential
              ? "confidencial"
              : job.companyName || job.sourceName || "",
          )
          .filter(Boolean),
      ).size,
    [jobs],
  );

  const recentJobs = useMemo(
    () =>
      [...jobs]
        .sort((a, b) => {
          const localityDifference =
            localityRank(jobLocation(a), locality) - localityRank(jobLocation(b), locality);
          if (localityDifference) return localityDifference;
          const sponsoredDifference = Number(Boolean(b.isSponsored)) - Number(Boolean(a.isSponsored));
          if (sponsoredDifference) return sponsoredDifference;
          return jobDate(b) - jobDate(a);
        })
        .slice(0, 6),
    [jobs, locality],
  );

  const remoteCount = jobs.filter(
    (job) => (job.workModel || "").toLowerCase() === "remoto",
  ).length;

  const workspacePath =
    profile?.type === "ADMIN"
      ? "/admin"
      : profile?.companyId
        ? "/company"
        : "/user";

  const searchJobs = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (city) params.set("cidade", city);
    navigate(`/vagas${params.size ? `?${params.toString()}` : ""}`);
  };

  const openJob = (job: Job) => {
    if (job.slug) navigate(`/vagas/${job.slug}`);
    else navigate(`/vagas?q=${encodeURIComponent(job.title)}`);
  };

  return (
    <div className="min-h-screen bg-[#fffaf5] text-[#2d211c] selection:bg-[#e8b29b] selection:text-[#2d211c]">
      <SeoHead
        title="PiraNegócios | Vagas, currículos e talentos da região"
        description="Encontre vagas em Pirassununga e região, crie seu currículo e conecte-se a empresas locais pelo PiraNegócios."
        canonical={`${window.location.origin}/`}
      />
      <Navbar />

      <main>
        <section className="relative overflow-hidden border-b border-[#4b3328]/10 bg-[#2d211c] text-white">
          <div className="pointer-events-none absolute -left-24 top-12 h-72 w-72 rounded-full bg-[#c96847]/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-28 bottom-[-120px] h-96 w-96 rounded-full bg-[#f0bf9f]/15 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[.035] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />

          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1.12fr_.88fr] lg:items-center lg:px-8 lg:py-24">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.055] px-3.5 py-2 text-[10px] font-black uppercase tracking-[.18em] text-[#f0bf9f]">
                <Sparkles className="h-3.5 w-3.5" />
                Empregos, talentos e negócios da região
              </div>

              <h1 className="mt-6 max-w-4xl font-serif text-5xl font-bold leading-[.98] tracking-[-.035em] text-white sm:text-6xl lg:text-7xl xl:text-[78px]">
                Trabalho perto de você.
                <span className="block text-[#e7a283]">Talento perto de quem contrata.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-white/58 sm:text-lg sm:leading-8">
                Um espaço regional para descobrir oportunidades reais, organizar sua carreira e aproximar empresas das pessoas certas, sem transformar a busca por trabalho em caça ao tesouro.
              </p>

              <form
                onSubmit={searchJobs}
                className="mt-8 max-w-4xl rounded-[26px] border border-white/10 bg-[#fffaf5] p-2.5 shadow-[0_24px_70px_rgba(0,0,0,.24)]"
              >
                <div className="grid gap-2 md:grid-cols-[1.45fr_.9fr_auto]">
                  <label className="relative">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a1897c]" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Cargo, habilidade ou empresa"
                      className="h-12 w-full rounded-2xl border-0 bg-white pl-11 pr-4 text-sm font-medium text-[#2d211c] outline-none ring-1 ring-[#5b4030]/10 placeholder:text-[#ae9d94] focus:ring-2 focus:ring-[#c96847]/35"
                    />
                  </label>
                  <label className="relative">
                    <MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a1897c]" />
                    <select
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      className="h-12 w-full appearance-none rounded-2xl border-0 bg-white pl-11 pr-4 text-sm font-bold text-[#5a453a] outline-none ring-1 ring-[#5b4030]/10 focus:ring-2 focus:ring-[#c96847]/35"
                    >
                      <option value="">Toda a região</option>
                      {cities.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#c96847] px-6 text-sm font-black text-white shadow-[0_12px_30px_rgba(201,104,71,.24)] transition hover:-translate-y-0.5 hover:bg-[#b85c3d]"
                  >
                    Buscar vagas <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs font-semibold text-white/42">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#e7a283]" /> Currículo gratuito
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#e7a283]" /> Vagas com fonte identificada
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#e7a283]" /> Matching regional
                </span>
              </div>
            </div>

            <div className="relative lg:pl-8">
              <div className="rounded-[34px] border border-white/10 bg-white/[.055] p-5 shadow-[0_28px_80px_rgba(0,0,0,.18)] backdrop-blur-xl sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#e7a283]">Radar regional</p>
                    <h2 className="mt-1 font-serif text-2xl font-bold">O mercado acontecendo agora</h2>
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[#f0bf9f]">
                    <Target className="h-5 w-5" />
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <StatCard value={loadingJobs ? "…" : jobs.length.toLocaleString("pt-BR")} label="vagas abertas" />
                  <StatCard value={loadingJobs ? "…" : cities.length.toLocaleString("pt-BR")} label="cidades com vagas" />
                  <StatCard value={loadingJobs ? "…" : sourceCount.toLocaleString("pt-BR")} label="empresas e fontes" />
                  <StatCard value={loadingJobs ? "…" : remoteCount.toLocaleString("pt-BR")} label="oportunidades remotas" />
                </div>

                <div className="mt-5 rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e7a283]/15 text-[#f0bf9f]">
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-white">Menos ruído, mais contexto.</p>
                      <p className="mt-1 text-xs leading-5 text-white/43">
                        Cidade, modelo de trabalho, PCD, origem da vaga e competências aparecem como dados, não escondidos num parágrafo.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#4b3328]/8 bg-[#f6eee7]">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 py-0 sm:px-6 lg:grid-cols-4 lg:px-8">
            <MiniBenefit icon={<Search className="h-4 w-4" />} title="Busca regional" text="Cidade e modalidade de verdade" />
            <MiniBenefit icon={<FileText className="h-4 w-4" />} title="Currículo inteligente" text="Um perfil que acompanha sua carreira" />
            <MiniBenefit icon={<UserRoundSearch className="h-4 w-4" />} title="Banco de talentos" text="Empresas encontram quem está disponível" />
            <MiniBenefit icon={<Building2 className="h-4 w-4" />} title="Recrutamento local" text="Da publicação à contratação" />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b96345]">
                {locality?.recommendedLabel ? `Perto de você · ${locality.recommendedLabel}` : "Oportunidades agora"}
              </p>
              <h2 className="mt-2 max-w-2xl font-serif text-4xl font-bold tracking-[-.025em] text-[#2d211c] sm:text-5xl">
                {locality?.recommendedLabel ? "Vagas mais próximas primeiro." : "Vagas que estão circulando pela região."}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#735f54]">
                {locality?.recommendedLabel
                  ? locality.exact
                    ? `Identificamos sua região como ${locality.detectedLabel}. Primeiro mostramos oportunidades daí e depois seguimos pelas cidades próximas, sempre pelas mais recentes.`
                    : `Você parece estar em ${locality.detectedLabel}, mas não há vagas abertas exatamente aí agora. Começamos por ${locality.recommendedLabel}, a cidade atendida mais próxima com oportunidades.`
                  : "Empresas locais, PATs, agências e fontes públicas reunidas em uma experiência única de busca."}
              </p>
            </div>
            <Link
              to="/vagas"
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[#4b3328]/12 bg-white px-5 py-3 text-sm font-bold text-[#49372e] shadow-sm transition hover:-translate-y-0.5 hover:border-[#c96847]/30"
            >
              Ver todas as vagas <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {loadingJobs ? (
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-52 animate-pulse rounded-[24px] border border-[#4b3328]/8 bg-white" />
              ))}
            </div>
          ) : recentJobs.length > 0 ? (
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {recentJobs.map((job) => (
                <JobCard key={job.id} job={job} onClick={() => openJob(job)} />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-[28px] border border-dashed border-[#4b3328]/20 bg-white/50 p-10 text-center text-sm text-[#806c61]">
              Nenhuma vaga aberta encontrada neste momento.
            </div>
          )}
        </section>

        <section id="como-funciona" className="border-y border-[#4b3328]/8 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
              <div className="lg:sticky lg:top-28">
                <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b96345]">Uma plataforma, dois lados</p>
                <h2 className="mt-2 font-serif text-4xl font-bold tracking-[-.025em] text-[#2d211c] sm:text-5xl">
                  Não é só um mural de vagas.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-[#735f54]">
                  O candidato organiza a própria trajetória. A empresa ganha ferramentas para buscar, comparar e conversar com talentos. A vaga é o encontro, não o sistema inteiro.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FeatureCard number="01" icon={<FileText className="h-5 w-5" />} title="Currículo que continua vivo" text="Experiências, habilidades, cursos, idiomas e preferências de trabalho ficam organizados em um perfil reutilizável." />
                <FeatureCard number="02" icon={<Target className="h-5 w-5" />} title="Match que respeita a realidade" text="Competências importam, mas cidade, trabalho remoto e mobilidade também. O sistema não recomenda o impossível." />
                <FeatureCard number="03" icon={<ShieldCheck className="h-5 w-5" />} title="Vaga com procedência" text="Quando a oportunidade vem de fora, a fonte original fica identificada e acessível para conferência." />
                <FeatureCard number="04" icon={<Building2 className="h-5 w-5" />} title="Empresa com ferramentas de RH" text="Publicação estruturada, banco de talentos, filtros, convites e acompanhamento do processo dentro do mesmo workspace." />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-[32px] border border-[#4b3328]/10 bg-[#f5ebe3] p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4 px-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b96345]">Parceiros & destaques</p>
                <p className="mt-1 text-sm text-[#786358]">Negócios da região também circulam por aqui.</p>
              </div>
            </div>
            <AdCarousel />
          </div>
        </section>

        <section id="empresas" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24">
          <div className="relative overflow-hidden rounded-[36px] bg-[#c96847] p-7 text-white shadow-[0_26px_80px_rgba(113,58,40,.18)] sm:p-10 lg:p-12">
            <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border-[52px] border-white/8" />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-white/85">
                  <BriefcaseBusiness className="h-3.5 w-3.5" /> Para empresas
                </span>
                <h2 className="mt-5 max-w-3xl font-serif text-4xl font-bold leading-tight tracking-[-.025em] sm:text-5xl">
                  A próxima boa contratação pode estar a algumas ruas da sua empresa.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
                  Publique vagas, pesquise currículos e construa um banco de talentos regional antes que toda seleção precise começar do zero.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link
                  to="/company"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-[#9f4d34] shadow-lg transition hover:-translate-y-0.5"
                >
                  Acessar área da empresa <ArrowRight className="h-4 w-4" />
                </Link>
                {!user && (
                  <Link
                    to="/login?returnTo=%2Fuser%2Fcurriculo"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/18 bg-white/8 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/12"
                  >
                    Quero procurar trabalho
                  </Link>
                )}
                {user && (
                  <Link
                    to={workspacePath}
                    className="inline-flex items-center justify-center rounded-2xl border border-white/18 bg-white/8 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/12"
                  >
                    Ir para meu espaço
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#4b3328]/10 bg-[#2d211c] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white font-serif font-black text-[#2d211c]">P</span>
              <div>
                <p className="font-serif text-lg font-bold">PiraNegócios</p>
                <p className="text-[10px] uppercase tracking-[.17em] text-white/32">A região trabalhando conectada</p>
              </div>
            </div>
            <p className="mt-4 max-w-lg text-xs leading-6 text-white/38">
              Vagas, currículos, talentos e ferramentas para aproximar pessoas e empresas de Pirassununga e região.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-white/55 md:justify-end">
            <Link to="/vagas" className="hover:text-white">Vagas</Link>
            <Link to="/termos" className="hover:text-white">Termos e LGPD</Link>
            <Link to="/login" className="hover:text-white">Entrar</Link>
          </div>
        </div>
        <div className="border-t border-white/6 px-4 py-5 text-center text-[11px] text-white/25">
          © 2026 PiraNegócios. Feito para movimentar oportunidades na região.
        </div>
      </footer>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[.055] p-4">
      <p className="font-serif text-3xl font-bold text-white">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[.13em] text-white/35">{label}</p>
    </div>
  );
}

function MiniBenefit({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="border-[#4b3328]/8 px-3 py-5 first:border-l-0 lg:border-l lg:px-5">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#bd6547] shadow-sm">{icon}</span>
        <div>
          <p className="text-xs font-black text-[#3f2e26]">{title}</p>
          <p className="mt-1 text-[10px] leading-4 text-[#8b7569]">{text}</p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ number, icon, title, text }: { number: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="rounded-[26px] border border-[#4b3328]/10 bg-[#fffaf5] p-5 shadow-[0_8px_35px_rgba(66,43,31,.04)] sm:p-6">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f0ded3] text-[#b75d40]">{icon}</span>
        <span className="font-mono text-[10px] font-bold text-[#bba99f]">{number}</span>
      </div>
      <h3 className="mt-5 font-serif text-xl font-bold text-[#2d211c]">{title}</h3>
      <p className="mt-2 text-xs leading-6 text-[#735f54]">{text}</p>
    </article>
  );
}
