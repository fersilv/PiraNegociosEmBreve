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
  type?: string;
  workModel?: string;
  salary?: string;
  requirements?: string;
  deadlineDate?: string;
  createdAt: string;
  acceptsPlatformApplications: boolean;
  externalApplicationInstructions?: string;
  applicationEmail?: string;
  applicationWhatsApp?: string;
  company: PublicCompany | null;
  isExternalListing?: boolean;
  sourceName?: string | null;
  sourceUrl?: string | null;
};

const siteUrl = window.location.origin;

export default function PublicJobPage() {
  const { slug } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [views, setViews] = useState(0);
  const [activeViewers, setActiveViewers] = useState(0);

  useEffect(() => {
    if (!slug) return;
    api
      .get(`/public/jobs/${encodeURIComponent(slug)}`)
      .then((response) => setJob(response.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!job) return;

    // Fallback para api URL caso front e back estejam em portas separadas no dev
    const socketUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : window.location.origin;
    
    const socket: Socket = io(socketUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    const viewedKey = `viewed_job_${job.id}`;
    const alreadyViewed = localStorage.getItem(viewedKey);
    const incrementView = !alreadyViewed;

    socket.on("connect", () => {
      socket.emit("join-job", { jobId: job.id, incrementView });
      if (incrementView) {
        localStorage.setItem(viewedKey, "true");
      }
    });

    socket.on("job-stats-updated", (data: { views: number; activeViewers: number }) => {
      setViews(data.views);
      setActiveViewers(data.activeViewers);
    });

    return () => {
      socket.emit("leave-job", { jobId: job.id });
      socket.disconnect();
    };
  }, [job]);

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
    } else if (job.location) {
      data.jobLocation = {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: job.location,
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
  const description = `${job.title}${companyText}${job.location ? `, ${job.location}` : ""}. Veja os requisitos e candidate-se pelo PiraNegócios.`;
  
  return (
    <div className="min-h-screen bg-stone-50">
      <SeoHead
        title={`${job.title}${companyText} | Vagas em Pirassununga | PiraNegócios`}
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
            {job.location && (
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-terracotta-600" />
                {job.location}
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
            <span className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-terracotta-600" />
              {job.salary || "Salário a combinar"}
            </span>
          </div>
          <ShareJobButtons 
            title={job.title} 
            url={canonical} 
            companyName={job.company?.name || job.sourceName || "Empresa Confidencial"}
            location={job.location}
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
                />
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
        <p className="mt-7 text-xs text-stone-400 flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5" />
          Publicada em {new Date(job.createdAt).toLocaleDateString("pt-BR")}
        </p>
      </main>
    </div>
  );
}
