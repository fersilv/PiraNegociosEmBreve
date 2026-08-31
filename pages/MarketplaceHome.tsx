import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Compass,
  LocateFixed,
  MapPin,
  PackageSearch,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ClassifiedCategoryIcon } from "../components/classifieds/ClassifiedCategoryIcon";
import { ClassifiedListingCard } from "../components/classifieds/ClassifiedListingCard";
import { FeedMonetizationSlot } from "../components/FeedMonetizationSlot";
import { JobCard } from "../components/JobCard";
import { Navbar } from "../components/Navbar";
import { SeoHead } from "../components/SeoHead";
import { useAuth } from "../contexts/AuthContext";
import { useVisitorLocation } from "../hooks/useVisitorLocation";
import { api, asArray } from "../lib/api";
import {
  buildLocalityRecommendation,
  localityRank,
} from "../lib/locationPersonalization";
import type {
  ClassifiedCategory,
  ClassifiedListing,
  ClassifiedSearchResponse,
} from "../types/classifieds";
import type { Job } from "../types/job";

const listingLocation = (listing: ClassifiedListing) =>
  [listing.city, listing.state].filter(Boolean).join(", ");

const jobLocation = (job: Job) =>
  job.city && job.state ? `${job.city}, ${job.state}` : job.location || "";

const jobDate = (job: Job) =>
  new Date(job.sourcePublishedAt || job.postedAt || job.createdAt || job.updatedAt || 0).getTime();

export default function MarketplaceHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const {
    location: visitorLocation,
    status: locationStatus,
    requestBrowserLocation,
    usingPreciseLocation,
  } = useVisitorLocation({ autoRequest: true });

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      api.get("/classifieds/categories"),
      api.get("/classifieds/listings?limit=30"),
      api.get("/jobs"),
    ])
      .then(([categoriesResult, listingsResult, jobsResult]) => {
        if (!active) return;

        if (categoriesResult.status === "fulfilled") {
          setCategories(Array.isArray(categoriesResult.value.data) ? categoriesResult.value.data : []);
        }
        if (listingsResult.status === "fulfilled") {
          setListings((listingsResult.value.data as ClassifiedSearchResponse)?.items || []);
        }
        if (jobsResult.status === "fulfilled") {
          setJobs(asArray<Job>(jobsResult.value.data).filter((job) => job.active !== false));
        }
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  const listingCities = useMemo(
    () =>
      Array.from(
        new Set(listings.map(listingLocation).filter((value): value is string => Boolean(value))),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [listings],
  );

  const allLocations = useMemo(
    () =>
      Array.from(
        new Set(
          [...listingCities, ...jobs.map(jobLocation)].filter(
            (value): value is string => Boolean(value),
          ),
        ),
      ),
    [listingCities, jobs],
  );

  const locality = useMemo(
    () => buildLocalityRecommendation(visitorLocation, allLocations),
    [visitorLocation, allLocations],
  );

  const nearbyListings = useMemo(
    () =>
      [...listings]
        .sort(
          (a, b) =>
            localityRank(listingLocation(a), locality) -
            localityRank(listingLocation(b), locality),
        )
        .slice(0, 10),
    [listings, locality],
  );

  const nearbyJobs = useMemo(
    () =>
      [...jobs]
        .sort((a, b) => {
          const localityDifference =
            localityRank(jobLocation(a), locality) - localityRank(jobLocation(b), locality);
          if (localityDifference) return localityDifference;
          return jobDate(b) - jobDate(a);
        })
        .slice(0, 4),
    [jobs, locality],
  );

  const searchClassifieds = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (city) {
      const match = city.match(/^(.+?),\s*([A-Z]{2})$/i);
      params.set("city", match?.[1] || city);
      if (match?.[2]) params.set("state", match[2].toUpperCase());
    }
    navigate(`/classificados/busca${params.size ? `?${params.toString()}` : ""}`);
  };

  const openJob = (job: Job) => {
    if (job.slug) navigate(`/vagas/${job.slug}`);
    else navigate(`/vagas?q=${encodeURIComponent(job.title)}`);
  };

  const locationHeadline = locality?.recommendedLabel
    ? `Perto de ${locality.recommendedLabel}`
    : "Na sua região";

  return (
    <div className="min-h-screen bg-[#fffaf5] text-[#2d211c] selection:bg-[#e8b29b] selection:text-[#2d211c]">
      <SeoHead
        title="PiraNegócios | Marketplace, classificados e vagas da região"
        description="Descubra produtos, serviços, classificados, empresas e vagas perto de você no marketplace regional do PiraNegócios."
        canonical={`${window.location.origin}/`}
      />
      <Navbar />

      <main>
        <section className="relative overflow-hidden border-b border-[#4b3328]/10 bg-[#2d211c] text-white">
          <div className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-[#c96847]/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 bottom-[-150px] h-[430px] w-[430px] rounded-full bg-[#f0bf9f]/15 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[.035] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />

          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:px-8 lg:py-24">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.055] px-3.5 py-2 text-[10px] font-black uppercase tracking-[.18em] text-[#f0bf9f]">
                <Compass className="h-3.5 w-3.5" />
                {usingPreciseLocation
                  ? "Localização atual ativada"
                  : locality?.detectedLabel
                    ? `Sua região · ${locality.detectedLabel}`
                    : "Marketplace regional"}
              </div>

              <h1 className="mt-6 max-w-4xl font-serif text-5xl font-bold leading-[.96] tracking-[-.04em] text-white sm:text-6xl lg:text-7xl xl:text-[78px]">
                O que você procura pode estar
                <span className="block text-[#e7a283]">bem mais perto.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-white/58 sm:text-lg sm:leading-8">
                Produtos, serviços, oportunidades e empresas da região reunidos em uma vitrine feita para movimentar negócios locais de verdade.
              </p>

              <form
                onSubmit={searchClassifieds}
                className="mt-8 max-w-4xl rounded-[26px] border border-white/10 bg-[#fffaf5] p-2.5 shadow-[0_24px_70px_rgba(0,0,0,.24)]"
              >
                <div className="grid gap-2 md:grid-cols-[1.45fr_.9fr_auto]">
                  <label className="relative">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a1897c]" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Produto, serviço, veículo, imóvel..."
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
                      {listingCities.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#c96847] px-6 text-sm font-black text-white shadow-[0_12px_30px_rgba(201,104,71,.24)] transition hover:-translate-y-0.5 hover:bg-[#b85c3d]"
                  >
                    Explorar <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>

              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link to="/classificados" className="inline-flex items-center gap-2 rounded-xl bg-white/8 px-3.5 py-2 text-xs font-bold text-white/70 transition hover:bg-white/12 hover:text-white">
                  <ShoppingBag className="h-3.5 w-3.5 text-[#e7a283]" /> Comprar e contratar
                </Link>
                <Link to="/vagas" className="inline-flex items-center gap-2 rounded-xl bg-white/8 px-3.5 py-2 text-xs font-bold text-white/70 transition hover:bg-white/12 hover:text-white">
                  <BriefcaseBusiness className="h-3.5 w-3.5 text-[#e7a283]" /> Encontrar vagas
                </Link>
                <Link to={user ? "/classificados/publicar" : "/login?returnTo=%2Fclassificados%2Fpublicar"} className="inline-flex items-center gap-2 rounded-xl bg-white/8 px-3.5 py-2 text-xs font-bold text-white/70 transition hover:bg-white/12 hover:text-white">
                  <Store className="h-3.5 w-3.5 text-[#e7a283]" /> Anunciar
                </Link>
              </div>
            </div>

            <div className="relative lg:pl-8">
              <div className="rounded-[34px] border border-white/10 bg-white/[.055] p-5 shadow-[0_28px_80px_rgba(0,0,0,.18)] backdrop-blur-xl sm:p-6">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#e7a283]">Radar PiraNegócios</p>
                    <h2 className="mt-1 font-serif text-2xl font-bold">{locationHeadline}</h2>
                    <p className="mt-2 max-w-md text-xs leading-5 text-white/45">
                      {usingPreciseLocation
                        ? "Seu navegador compartilhou a localização atual. A vitrine agora prioriza as cidades realmente mais próximas."
                        : locality?.detectedLabel
                          ? "Enquanto a localização precisa não está disponível, usamos uma referência regional aproximada para ordenar a vitrine."
                          : "Ative sua localização para colocar anúncios, serviços e vagas mais próximos no começo da vitrine."}
                    </p>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#f0bf9f]">
                    <MapPin className="h-5 w-5" />
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <StatCard value={loading ? "…" : listings.length.toLocaleString("pt-BR")} label="anúncios na vitrine" />
                  <StatCard value={loading ? "…" : categories.length.toLocaleString("pt-BR")} label="categorias" />
                  <StatCard value={loading ? "…" : jobs.length.toLocaleString("pt-BR")} label="vagas abertas" />
                  <StatCard value={loading ? "…" : allLocations.length.toLocaleString("pt-BR")} label="localidades ativas" />
                </div>

                <div className="mt-5 rounded-2xl border border-white/8 bg-black/10 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#f0bf9f]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-5 text-white/48">
                        {usingPreciseLocation
                          ? "Localização precisa ativa. As coordenadas ficam nesta sessão do navegador e são usadas somente para ordenar o conteúdo por proximidade."
                          : locationStatus === "requesting"
                            ? "Aguardando a permissão de localização do navegador para melhorar a ordem da vitrine."
                            : "A localização aproximada continua como fallback. Você pode tentar ativar o GPS do navegador quando quiser."}
                      </p>
                      {!usingPreciseLocation && locationStatus !== "requesting" && (
                        <button
                          type="button"
                          onClick={requestBrowserLocation}
                          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[.1em] text-white transition hover:bg-white/15"
                        >
                          <LocateFixed className="h-3.5 w-3.5 text-[#f0bf9f]" /> Usar minha localização
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#4b3328]/8 bg-[#f6eee7]">
          <div className="mx-auto grid max-w-7xl gap-px px-4 sm:px-6 md:grid-cols-3 lg:px-8">
            <PortalCard
              icon={<ShoppingBag className="h-5 w-5" />}
              eyebrow="Classificados"
              title="Comprar, vender e contratar"
              text="Uma vitrine regional para produtos e serviços sem perder tempo procurando em dezenas de lugares."
              to="/classificados"
            />
            <PortalCard
              icon={<BriefcaseBusiness className="h-5 w-5" />}
              eyebrow="Carreiras"
              title="Trabalho e talento local"
              text="Vagas, currículo e conexões entre quem procura oportunidade e quem precisa contratar."
              to="/carreiras"
            />
            <PortalCard
              icon={<Building2 className="h-5 w-5" />}
              eyebrow="Empresas"
              title="Seu negócio dentro do ecossistema"
              text="Presença, recrutamento e operação comercial reunidos em uma experiência conectada."
              to="/para-empresas"
            />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b96345]">
                {locality?.recommendedLabel ? `Vitrine local · ${locality.recommendedLabel}` : "Vitrine da região"}
              </p>
              <h2 className="mt-2 max-w-3xl font-serif text-4xl font-bold tracking-[-.025em] sm:text-5xl">
                Coisas boas acontecendo perto de você.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#735f54]">
                Anúncios recentes entram na vitrine e, quando existe contexto de localização, os mais próximos ganham prioridade.
              </p>
            </div>
            <Link to="/classificados/busca" className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[#4b3328]/12 bg-white px-5 py-3 text-sm font-bold text-[#49372e] shadow-sm transition hover:-translate-y-0.5 hover:border-[#c96847]/30">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {loading ? (
            <ListingSkeleton />
          ) : nearbyListings.length ? (
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {nearbyListings.map((listing, index) => (
                <React.Fragment key={listing.id}>
                  <ClassifiedListingCard listing={listing} />
                  {index === 4 && (
                    <FeedMonetizationSlot
                      placement="marketplace-home-classifieds"
                      slot={0}
                      className="col-span-full"
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <EmptyState text="Ainda não há anúncios públicos na vitrine. Os novos classificados vão aparecer aqui." />
          )}
        </section>

        <section className="border-y border-[#4b3328]/8 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
            <div className="flex items-end justify-between gap-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b96345]">Explore do seu jeito</p>
                <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-.025em] sm:text-4xl">Comece por uma categoria.</h2>
              </div>
              <Link to="/classificados/busca" className="hidden items-center gap-1.5 text-xs font-black text-[#a84f34] sm:inline-flex">Explorar tudo <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>

            {categories.length ? (
              <div className="-mx-4 mt-7 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 md:grid-cols-6 lg:grid-cols-8">
                {categories.slice(0, 8).map((category) => (
                  <Link key={category.slug} to={`/classificados/categoria/${encodeURIComponent(category.slug)}`} className="flex w-[128px] shrink-0 snap-start flex-col items-center gap-3 rounded-[22px] bg-[#fffaf5] px-3 py-5 text-center ring-1 ring-[#4b3328]/10 transition hover:-translate-y-1 hover:shadow-md sm:w-auto">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f7e9df] text-[#b45e42]">
                      <ClassifiedCategoryIcon name={category.icon} className="h-5 w-5" />
                    </span>
                    <span className="text-[11px] font-bold leading-tight text-[#4f3b31]">{category.name}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-7 rounded-[24px] border border-dashed border-[#4b3328]/15 bg-[#fffaf5] p-8 text-sm text-[#806b60]">As categorias aparecem aqui assim que a vitrine estiver disponível.</div>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2d211c] text-[#f0bf9f]">
                <BriefcaseBusiness className="h-5 w-5" />
              </div>
              <p className="mt-5 text-[10px] font-black uppercase tracking-[.2em] text-[#b96345]">Também tem carreira</p>
              <h2 className="mt-2 font-serif text-4xl font-bold tracking-[-.025em] sm:text-5xl">O marketplace também conecta trabalho e talento.</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#735f54]">
                As vagas continuam com uma experiência própria. Aqui elas entram como parte de uma economia local maior, ao lado dos negócios que fazem a região girar.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link to="/vagas" className="inline-flex items-center gap-2 rounded-2xl bg-[#c96847] px-5 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(201,104,71,.18)]">Ver vagas <ArrowRight className="h-4 w-4" /></Link>
                <Link to="/carreiras" className="inline-flex items-center gap-2 rounded-2xl border border-[#4b3328]/12 bg-white px-5 py-3 text-sm font-bold text-[#49372e]">Conhecer carreiras</Link>
              </div>
            </div>

            <div className="grid gap-4">
              {loading ? (
                [0, 1, 2].map((item) => <div key={item} className="h-48 animate-pulse rounded-[24px] bg-[#f0e7df]" />)
              ) : nearbyJobs.length ? (
                nearbyJobs.map((job, index) => (
                  <React.Fragment key={job.id}>
                    <JobCard job={job} onClick={() => openJob(job)} />
                    {index === 1 && (
                      <FeedMonetizationSlot
                        placement="marketplace-home-jobs"
                        slot={0}
                      />
                    )}
                  </React.Fragment>
                ))
              ) : (
                <EmptyState text="Nenhuma vaga pública encontrada neste momento." />
              )}
            </div>
          </div>
        </section>

        <section className="border-t border-[#4b3328]/8 bg-[#2d211c] text-white">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
            <Link to="/como-funciona" className="group rounded-[30px] border border-white/10 bg-white/[.055] p-7 transition hover:-translate-y-1 hover:bg-white/[.08] sm:p-9">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7a283]/15 text-[#f0bf9f]"><Sparkles className="h-5 w-5" /></span>
              <p className="mt-7 text-[10px] font-black uppercase tracking-[.18em] text-[#e7a283]">Entenda o ecossistema</p>
              <h2 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">Do anúncio à vaga, veja como cada parte se conecta.</h2>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-white">Como funciona <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </Link>
            <Link to="/para-empresas" className="group rounded-[30px] border border-[#e7a283]/25 bg-[#c96847] p-7 transition hover:-translate-y-1 hover:bg-[#bd6042] sm:p-9">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12 text-white"><Building2 className="h-5 w-5" /></span>
              <p className="mt-7 text-[10px] font-black uppercase tracking-[.18em] text-white/65">Para quem faz negócio</p>
              <h2 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">Sua empresa pode contratar, aparecer e vender no mesmo lugar.</h2>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-white">Conhecer soluções <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#4b3328]/10 bg-[#fffaf5]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src="/brand/symbol-terracotta.png" alt="" className="h-9 w-9 object-contain" />
            <div><p className="font-serif text-lg font-bold">PiraNegócios</p><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#ad6e50]">Negócios da região</p></div>
          </Link>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-[#735f54]">
            <Link to="/classificados">Classificados</Link>
            <Link to="/vagas">Vagas</Link>
            <Link to="/como-funciona">Como funciona</Link>
            <Link to="/para-empresas">Para empresas</Link>
            <Link to="/termos">Termos</Link>
            <Link to="/ajuda">Ajuda</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[.045] p-4">
      <p className="font-serif text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-white/35">{label}</p>
    </div>
  );
}

function PortalCard({ icon, eyebrow, title, text, to }: { icon: React.ReactNode; eyebrow: string; title: string; text: string; to: string }) {
  return (
    <Link to={to} className="group flex min-h-[210px] flex-col border-[#4b3328]/8 px-5 py-8 transition hover:bg-[#fffaf5] md:border-x md:px-7">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2d211c] text-[#f0bf9f]">{icon}</span>
      <p className="mt-5 text-[9px] font-black uppercase tracking-[.18em] text-[#b96345]">{eyebrow}</p>
      <h3 className="mt-1 font-serif text-2xl font-bold">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-[#735f54]">{text}</p>
      <span className="mt-auto pt-4 text-xs font-black text-[#9f5038]">Explorar <ArrowRight className="ml-1 inline h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
    </Link>
  );
}

function ListingSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {[0, 1, 2, 3, 4].map((item) => (
        <div key={item} className="overflow-hidden rounded-[22px] border border-[#4b3328]/8 bg-white">
          <div className="aspect-square animate-pulse bg-[#eee5de]" />
          <div className="space-y-2 p-4"><div className="h-3 w-2/3 animate-pulse rounded bg-[#eee5de]" /><div className="h-4 w-full animate-pulse rounded bg-[#eee5de]" /></div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-8 flex items-center gap-4 rounded-[24px] border border-dashed border-[#4b3328]/15 bg-white p-7 text-sm text-[#735f54]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f6eee7] text-[#b96345]"><PackageSearch className="h-5 w-5" /></span>
      {text}
    </div>
  );
}
