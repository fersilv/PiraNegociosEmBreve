import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Briefcase,
  Building2,
  CalendarDays,
  DollarSign,
  ExternalLink,
  Laptop,
  Loader2,
  MapPin,
  Eye,
  Info,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { api } from "../lib/api";
import { Navbar } from "../components/Navbar";
import { SeoHead } from "../components/SeoHead";
import { useAuth } from "../contexts/AuthContext";
import { JobReportForm } from "../components/JobReportForm";
import { ExternalApplicationActions } from "../components/ExternalApplicationActions";
import { ShareJobButtons } from "../components/ShareJobButtons";

type PublicCompany = {
  name: string;
  slug: string;
  logoURL?: string;
  cityState?: string;
  website?: string;
};
type PublicJob = {
  id: string;
  slug: string;
  title: string;
  description: string;
  location?: string;
  city?: string;
  state?: string;
  type?: string;
  workModel?: string;
  salary?: string;
  estimatedSalary?: string | null;
  estimatedSalarySource?: string | null;
  estimatedSalarySourceUrl?: string | null;
  estimatedSalaryRegion?: string | null;
  estimatedSalaryUpdatedAt?: string | null;
  requirements?: string;
  deadlineDate?: string;
  createdAt: string;
  acceptsPlatformApplications: boolean;
  externalApplicationInstructions?: string;
  applicationEmail?: string;
  applicationWhatsApp?: string;
  applicationUrl?: string | null;
  applicationUrlTitle?: string | null;
  company: PublicCompany | null;
  isExternalListing?: boolean;
  isConfidential?: boolean;
  sourceName?: string | null;
  sourceUrl?: string | null;
  isTalentPool?: boolean;
  updatedAt?: string;
  views?: number;
};

const siteUrl = window.location.origin;

export default function PublicJobPage() {
  const { slug } = useParams();
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [views, setViews] = useState(0);
  const [activeViewers, setActiveViewers] = useState(0);
  const isAdmin = profile?.type === "ADMIN";

  useEffect(() => {
    if (!slug) return;
    api
      .get(`/public/jobs/${encodeURIComponent(slug)}`)
      .then((response) => {
        const nextJob = response.data as PublicJob;
        setJob(nextJob);
        setViews(Number(nextJob.views || 0));
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!job || authLoading || isAdmin) return;

    const viewedKey = `viewed_job_${job.id}`;
    if (localStorage.getItem(viewedKey)) return;

    let cancelled = false;
    api
      .post(`/public/jobs/${job.id}/view`)
      .then((response) => {
        if (cancelled) return;
        setViews(Number(response.data?.views || 0));
        localStorage.setItem(viewedKey, "true");
      })
      .catch((error) => {
        console.warn("Não foi possível registrar visualização da vaga.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [job?.id, authLoading, isAdmin]);

  useEffect(() => {
    if (!job || authLoading || isAdmin) return;

    const socketUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace("/api", "")
      : window.location.origin;

    const socket: Socket = io(socketUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("join-job", { jobId: job.id, incrementView: false });
    });

    socket.on(
      "job-stats-updated",
      (data: { views: number; activeViewers: number }) => {
        setViews(data.views);
        setActiveViewers(data.activeViewers);
      },
    );

    return () => {
      socket.emit("leave-job", { jobId: job.id });
      socket.disconnect();
    };
  }, [job?.id, authLoading, isAdmin]);

  const canonical = `${siteUrl}/vagas/${job?.slug || slug || ""}`;
  const structuredData = useMemo(() => {
    if (!job) return undefined;
    const data: Record<string, unknown> = {
      "@context": "https://schema.org/",
      "@type": "JobPosting",
      title: job.title,
      description: [
        job.description,
        job.requirements ? `Requisitos:\n${job.requirements}` : "",
      ]
        .filter(Boolean)
        .join("\n")
        .split(/\n+/)
        .filter(Boolean)
        .map((part) => `<p>${part}</p>`)
        .join(""),
      identifier: {
        "@type": "PropertyValue",
        name: "PiraNegócios",
        value: job.id,
      },
      datePosted: new Date(job.createdAt).toISOString(),
      employmentType: job.type || undefined,
      hiringOrganization: {
        "@type": "Organization",
        name: job.company?.name || job.sourceName || "Fonte externa",
      },
    };
    if (job.deadlineDate)
      data.validThrough = `${job.deadlineDate}T23:59:59-03:00`;
    if (job.workModel?.toLowerCase() === "remoto") {
      data.jobLocationType = "TELECOMMUTE";
      data.applicantLocationRequirements = { "@type": "Country", name: "BR" };
    } else if (job.location || job.city) {
      data.jobLocation = {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: job.city || job.location,
          ...(job.state ? { addressRegion: job.state } : {}),
          addressCountry: "BR",
        },
      };
    }
    return data;
  }, [job]);

  const apply = () => {
    if (!job) return;
    if (!user)
      return navigate(
        `/login?returnTo=${encodeURIComponent(`/vagas/${job.slug}`)}`,
      );
    if (profile?.type !== "CANDIDATE")
      return alert("Apenas candidatos podem se candidatar às vagas.");
    navigate(`/vagas?applyTo=${encodeURIComponent(job.id)}`);
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-terracotta-600" />
      </div>
    );
  if (notFound || !job)
    return (
      <>
        <SeoHead
          title="Vaga não encontrada | PiraNegócios"
          description="Esta vaga não está mais disponível."
          canonical={canonical}
          noIndex
        />
        <Navbar />
        <main className="max-w-3xl mx-auto px-6 py-28 text-center">
          <h1 className="text-3xl font-serif font-bold">
            Esta vaga não está mais disponível
          </h1>
          <Link
            to="/vagas"
            className="inline-block mt-6 text-terracotta-700 font-bold"
          >
            Ver vagas abertas
          </Link>
        </main>
      </>
    );

  const organizationName = job.company?.name || job.sourceName;
  const isConfidential = job.isConfidential === true;
  const companyText = organizationName && !isConfidential ? ` em ${organizationName}` : "";
  const locationText = job.city
    ? `${job.city}${job.state ? `, ${job.state}` : ""}`
    : job.location || "";
  const description = `${job.title}${companyText}${locationText ? `, ${locationText}` : ""}. Veja os requisitos e como se candidatar pelo PiraNegócios.`;
  const hasOfficialSalary = Boolean(job.salary?.trim());
  const hasEstimatedSalary = !hasOfficialSalary && Boolean(job.estimatedSalary?.trim());
  const estimateSourceHref =
    hasEstimatedSalary && job.estimatedSalarySourceUrl && /^https?:\/\//i.test(job.estimatedSalarySourceUrl)
      ? job.estimatedSalarySourceUrl
      : null;
  
  return (
    <div className="min-h-screen bg-stone-50">
      <SeoHead
        title={`${job.title}${companyText}${locationText ? ` | Vaga em ${locationText}` : ""} | PiraNegócios`}
        description={description}
        canonical={canonical}
        structuredData={structuredData}
      />
      <Navbar />
      <main className="max-w-4xl mx-auto px-5 py-10 md:py-16">
        <p className="text-sm text-stone-500 mb-7">
          <Link to="/vagas" className="hover:text-terracotta-700">
            Vagas
          </Link>{" "}
          <span className="mx-2">/</span>
          {job.title}
        </p>
        <article className="bg-white border border-stone-200 rounded-3xl p-6 md:p-10 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-5 sm:items-start sm:justify-between">
            <div className="flex gap-4">
              <div className="w-14 h-14 shrink-0 rounded-2xl bg-terracotta-50 border border-terracotta-100 overflow-hidden flex items-center justify-center">
                {job.company?.logoURL ? (
                  <img
                    src={job.company.logoURL}
                    alt={`Logo ${job.company.name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building2 className="text-terracotta-600" />
                )}
              </div>
              <div>
                <h1 className="font-serif text-3xl md:text-4xl font-bold text-stone-900">
                  {job.title}
                  {job.isTalentPool && (
                    <span className="ml-3 align-middle bg-purple-100 text-purple-700 text-xs uppercase font-bold px-2 py-1 rounded shrink-0">Banco de Talentos</span>
                  )}
                </h1>
                {job.company?.slug ? (
                  <Link
                    to={`/${job.company.slug}`}
                    className="mt-2 inline-block text-terracotta-700 font-bold hover:underline"
                  >
                    {job.company.name}
                  </Link>
                ) : (
                  <p className="mt-2 text-amber-800 font-bold">
                    Vaga de fonte externa
                    {job.sourceName ? ` · ${job.sourceName}` : ""}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex items-center gap-2">
                {activeViewers > 0 && (
                  <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md flex items-center gap-1.5 border border-red-100" title={`${activeViewers} pessoas vendo agora`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                    {activeViewers}
                  </span>
                )}
                {views > 0 && (
                  <span className="text-[11px] font-bold text-stone-500 bg-stone-100 px-2 py-1 rounded-md flex items-center gap-1.5 border border-stone-200" title={`${views} visualizações totais`}>
                    <Eye className="w-3 h-3" />
                    {views}
                  </span>
                )}
              </div>
              
              {job.deadlineDate && (
                <span className="text-xs font-bold bg-amber-50 text-amber-800 px-3 py-1.5 rounded-lg border border-amber-100">
                  Até {new Date(`${job.deadlineDate}T12:00:00`).toLocaleDateString(
                    "pt-BR",
                  )}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 mt-8 py-5 border-y border-stone-100 text-sm text-stone-600">
            {locationText && (
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-terracotta-600" />
                {locationText}
              </span>
            )}
            {job.type && (
              <span className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-terracotta-600" />
                {job.type}
              </span>
            )}
            {job.workModel && (
              <span className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-terracotta-600" />
                {job.workModel}
              </span>
            )}
            <span className={`flex items-center gap-2 ${hasEstimatedSalary ? "font-bold text-amber-800" : ""}`}>
              <DollarSign className="w-4 h-4 text-terracotta-600" />
              {hasOfficialSalary
                ? job.salary
                : hasEstimatedSalary
                  ? `Média salarial estimada: ${job.estimatedSalary}`
                  : "Salário não informado"}
            </span>
          </div>

          {hasEstimatedSalary && (
            <details className="group mt-4 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-950">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold marker:content-none">
                <span className="flex min-w-0 items-center gap-2">
                  <Info className="h-4 w-4 shrink-0 text-amber-700" />
                  <span className="truncate">Média salarial estimada: {job.estimatedSalary}</span>
                </span>
                <span className="shrink-0 text-xs text-amber-700 group-open:hidden">Ver detalhes</span>
                <span className="hidden shrink-0 text-xs text-amber-700 group-open:inline">Ocultar detalhes</span>
              </summary>
              <div className="border-t border-amber-200 px-4 pb-4 pt-3">
                <p className="text-sm leading-6 text-amber-900">
                  Este valor é uma referência de mercado para o cargo e região e não foi informado pela empresa responsável pela vaga. A remuneração real oferecida pode ser maior ou menor, de acordo com experiência, jornada, benefícios, convenção coletiva e outros critérios da contratação.
                </p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-amber-900">
                  {job.estimatedSalarySource && (
                    <span><strong>Fonte:</strong> {job.estimatedSalarySource}</span>
                  )}
                  {job.estimatedSalaryRegion && (
                    <span><strong>Região considerada:</strong> {job.estimatedSalaryRegion}</span>
                  )}
                  {job.estimatedSalaryUpdatedAt && (
                    <span><strong>Referência consultada em:</strong> {new Date(job.estimatedSalaryUpdatedAt).toLocaleDateString("pt-BR")}</span>
                  )}
                </div>
                {estimateSourceHref && (
                  <a
                    href={estimateSourceHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-amber-800 underline decoration-amber-300 underline-offset-4 hover:text-amber-950"
                  >
                    Consultar fonte da média <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </details>
          )}

          <ShareJobButtons 
            title={job.title} 
            url={canonical} 
            companyName={job.company?.name || job.sourceName || "Empresa Confidencial"}
            location={locationText}
            salary={job.salary}
            workModel={job.workModel}
            acceptsPlatformApplications={job.acceptsPlatformApplications}
          />
          <section className="mt-8">
            <h2 className="font-serif text-2xl font-bold text-stone-900 mb-4">
              Sobre a vaga
            </h2>
            <div className="whitespace-pre-line leading-7 text-stone-700">
              {job.description}
            </div>
          </section>
          {job.requirements && (
            <section className="mt-8">
              <h2 className="font-serif text-2xl font-bold text-stone-900 mb-4">
                Requisitos
              </h2>
              <div className="whitespace-pre-line leading-7 text-stone-700">
                {job.requirements}
              </div>
            </section>
          )}
          <section className="mt-10 pt-7 border-t border-stone-100">
            <h2 className="font-serif text-xl font-bold text-stone-900">
              Como se candidatar
            </h2>
            {job.acceptsPlatformApplications ? (
              <button
                onClick={apply}
                className="mt-4 inline-flex items-center gap-2 bg-terracotta-600 hover:bg-terracotta-700 text-white px-6 py-3 rounded-xl font-bold shadow-sm"
              >
                Candidatar-se à vaga <ExternalLink className="w-4 h-4" />
              </button>
            ) : (
              <div className="mt-4 rounded-xl bg-amber-50 border border-amber-100 p-4 text-amber-950">
                <ExternalApplicationActions
                  title={job.title}
                  instructions={job.externalApplicationInstructions}
                  email={job.applicationEmail}
                  whatsapp={job.applicationWhatsApp}
                  applicationUrl={job.applicationUrl}
                  applicationUrlTitle={job.applicationUrlTitle}
                />
              </div>
            )}

            {!user && (
              <div className="mt-8 bg-gradient-to-br from-terracotta-50 to-orange-50 border border-terracotta-100 rounded-2xl p-5 md:p-6 flex flex-col sm:flex-row gap-5 items-center justify-between shadow-sm">
                <div>
                  <h3 className="font-serif font-bold text-terracotta-950 text-lg">
                    Aumente suas chances de contratação! 🚀
                  </h3>
                  <p className="text-terracotta-800 text-sm mt-1.5 leading-relaxed">
                    {job.acceptsPlatformApplications
                      ? "Crie seu currículo online no PiraNegócios gratuitamente e candidate-se com apenas um clique a esta e muitas outras vagas."
                      : `Cadastre seu currículo no PiraNegócios gratuitamente e seja encontrado por dezenas de empresas de ${job.city || (job.location ? job.location.split("-")[0].split(",")[0].trim() : "Pirassununga e região")} buscando talentos.`}
                  </p>
                </div>
                <Link
                  to={`/login?returnTo=${encodeURIComponent(`/vagas/${job.slug || job.id}`)}`}
                  className="w-full sm:w-auto shrink-0 bg-white border-2 border-terracotta-200 text-terracotta-700 font-bold px-6 py-3 rounded-xl text-sm text-center hover:bg-terracotta-50 hover:border-terracotta-300 transition-all shadow-sm"
                >
                  Criar Currículo Grátis
                </Link>
              </div>
            )}

            {job.sourceUrl && (
              <a
                href={job.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-sm font-bold text-terracotta-700 hover:underline"
              >
                Abrir publicação original
              </a>
            )}
            <JobReportForm jobId={job.id} />
          </section>
        </article>
        <div className="mt-7 flex items-center justify-between">
          <p className="text-xs text-stone-400 flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5" />
            Publicada em {new Date(job.createdAt).toLocaleDateString("pt-BR")}
          </p>
          {job.updatedAt && (
            <p className="text-xs text-stone-400 font-medium">
              Atualizada em {new Date(job.updatedAt).toLocaleDateString("pt-BR")} às {new Date(job.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}