import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Briefcase,
  Globe,
  Loader2,
  MapPin,
  Phone,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Navbar } from "../components/Navbar";
import { SeoHead } from "../components/SeoHead";

type Job = {
  id: string;
  slug: string;
  title: string;
  location?: string;
  type?: string;
  workModel?: string;
  salary?: string;
};
type Company = {
  name: string;
  slug: string;
  description?: string;
  logoURL?: string;
  website?: string;
  address?: string;
  cityState?: string;
  phone?: string;
};

export default function PublicCompanyPage() {
  const { companySlug } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  useEffect(() => {
    if (companySlug)
      api
        .get(`/public/companies/${encodeURIComponent(companySlug)}`)
        .then((response) => {
          setCompany(response.data.company);
          setJobs(response.data.jobs || []);
          if (
            response.data.resolvedFromAlias &&
            response.data.company?.slug !== companySlug
          )
            navigate(`/${response.data.company.slug}`, { replace: true });
        })
        .catch(() => setNotFound(true))
        .finally(() => setLoading(false));
  }, [companySlug, navigate]);
  const canonical = `${window.location.origin}/${company?.slug || companySlug || ""}`;
  const structuredData = useMemo(
    () =>
      company
        ? {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: company.name,
            url: canonical,
            ...(company.logoURL ? { logo: company.logoURL } : {}),
            ...(company.website ? { sameAs: [company.website] } : {}),
            ...(company.phone ? { telephone: company.phone } : {}),
          }
        : undefined,
    [company, canonical],
  );
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-terracotta-600" />
      </div>
    );
  if (notFound || !company)
    return (
      <>
        <SeoHead
          title="Empresa não encontrada | PiraNegócios"
          description="Este perfil não está disponível."
          canonical={canonical}
          noIndex
        />
        <Navbar />
        <main className="max-w-3xl mx-auto px-6 py-28 text-center">
          <h1 className="font-serif text-3xl font-bold">
            Empresa não encontrada
          </h1>
          <Link
            to="/vagas"
            className="inline-block mt-5 text-terracotta-700 font-bold"
          >
            Explorar vagas
          </Link>
        </main>
      </>
    );
  const description = `${company.name}${company.cityState ? ` em ${company.cityState}` : ", Pirassununga e região"}. ${company.description?.slice(0, 120) || "Conheça a empresa e suas vagas abertas."}`;
  return (
    <div className="min-h-screen bg-stone-50">
      <SeoHead
        title={`${company.name} | Empresas de Pirassununga | PiraNegócios`}
        description={description}
        canonical={canonical}
        structuredData={structuredData}
      />
      <Navbar />
      <main className="max-w-4xl mx-auto px-5 py-10 md:py-16">
        <article className="bg-white border border-stone-200 rounded-3xl p-6 md:p-10">
          <header className="flex gap-5 items-center">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-terracotta-50 border border-terracotta-100 flex items-center justify-center">
              {company.logoURL ? (
                <img
                  src={company.logoURL}
                  alt={`Logo ${company.name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building2 className="w-9 h-9 text-terracotta-600" />
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest font-bold text-terracotta-600">
                Empresa local
              </p>
              <h1 className="font-serif text-3xl md:text-4xl font-bold text-stone-900 mt-1">
                {company.name}
              </h1>
              {company.cityState && (
                <p className="mt-2 text-stone-500 flex gap-1.5 items-center">
                  <MapPin className="w-4 h-4" />
                  {company.cityState}
                </p>
              )}
            </div>
          </header>
          {company.description && (
            <section className="mt-9 pt-7 border-t border-stone-100">
              <h2 className="font-serif text-2xl font-bold">Sobre a empresa</h2>
              <p className="mt-3 whitespace-pre-line leading-7 text-stone-700">
                {company.description}
              </p>
            </section>
          )}
          <div className="mt-7 flex flex-wrap gap-4 text-sm">
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex gap-2 items-center text-terracotta-700 font-bold hover:underline"
              >
                <Globe className="w-4 h-4" />
                Site da empresa
              </a>
            )}
            {company.phone && (
              <span className="inline-flex gap-2 items-center text-stone-600">
                <Phone className="w-4 h-4" />
                {company.phone}
              </span>
            )}
            {company.address && (
              <span className="inline-flex gap-2 items-center text-stone-600">
                <MapPin className="w-4 h-4" />
                {company.address}
              </span>
            )}
          </div>
        </article>
        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest font-bold text-terracotta-600">
                Oportunidades
              </p>
              <h2 className="mt-1 font-serif text-3xl font-bold">
                Vagas em aberto
              </h2>
            </div>
            <Link to="/vagas" className="text-sm font-bold text-terracotta-700">
              Ver todas
            </Link>
          </div>
          {jobs.length ? (
            <div className="mt-5 space-y-3">
              {jobs.map((job) => (
                <Link
                  key={job.id}
                  to={`/vagas/${job.slug}`}
                  className="block bg-white rounded-2xl border border-stone-200 p-5 hover:border-terracotta-300 hover:shadow-sm transition"
                >
                  <h3 className="font-bold text-lg text-stone-900">
                    {job.title}
                  </h3>
                  <p className="mt-2 text-sm text-stone-500 flex gap-4 flex-wrap">
                    <span>{job.location || "Pirassununga e região"}</span>
                    {job.type && <span>{job.type}</span>}
                    {job.salary && <span>{job.salary}</span>}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-5 bg-white border border-stone-200 rounded-2xl p-6 text-stone-600">
              Esta empresa não possui vagas abertas no momento.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
