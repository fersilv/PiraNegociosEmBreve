import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Navbar } from "../components/Navbar";
import { SeoHead } from "../components/SeoHead";
import { CompanyClassifiedsShowcase } from "../components/company-page/CompanyClassifiedsShowcase";
import {
  CompanyPageConfig,
  CompanySiteRenderer,
  PublicCompanyLike,
  PublicJobLike,
} from "../components/company-page/CompanySiteRenderer";

export default function PublicCompanyPage() {
  const { companySlug } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState<PublicCompanyLike | null>(null);
  const [jobs, setJobs] = useState<PublicJobLike[]>([]);
  const [page, setPage] = useState<CompanyPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!companySlug) return;
    let active = true;
    setLoading(true);
    api
      .get(`/public/companies/${encodeURIComponent(companySlug)}`)
      .then(async (response) => {
        if (!active) return;
        const nextCompany = {
          ...(response.data.company as PublicCompanyLike),
          isVerified: true,
          verificationStatus: "VERIFIED",
        };
        setCompany(nextCompany);
        setJobs(response.data.jobs || []);
        if (response.data.resolvedFromAlias && response.data.company?.slug !== companySlug) {
          navigate(`/${response.data.company.slug}`, { replace: true });
        }
        try {
          const pageResponse = await api.get(`/public/company-pages/company/${nextCompany.id}`);
          if (active) setPage(pageResponse.data?.page || null);
        } catch {
          if (active) setPage(null);
        }
      })
      .catch(() => active && setNotFound(true))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
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
            ...(company.address ? { address: company.address } : {}),
          }
        : undefined,
    [company, canonical],
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="w-7 h-7 animate-spin text-stone-400" /></div>;
  }

  if (notFound || !company) {
    return (
      <>
        <SeoHead title="Empresa não encontrada | PiraNegócios" description="Esta página não está disponível." canonical={canonical} noIndex />
        <Navbar />
        <main className="max-w-3xl mx-auto px-6 py-28 text-center">
          <h1 className="font-serif text-3xl font-bold">Empresa não encontrada</h1>
          <Link to="/vagas" className="inline-block mt-5 text-terracotta-700 font-bold">Explorar vagas</Link>
        </main>
      </>
    );
  }

  const description = `${company.name}${company.cityState ? ` em ${company.cityState}` : ", Pirassununga e região"}. ${company.description?.slice(0, 120) || "Conheça a empresa, suas oportunidades, produtos e serviços."}`;

  return (
    <>
      <SeoHead
        title={`${company.name} | PiraNegócios`}
        description={description}
        canonical={canonical}
        structuredData={structuredData}
      />
      <CompanySiteRenderer company={company} jobs={jobs} page={page} />
      <CompanyClassifiedsShowcase companyId={company.id} companyName={company.name} />
    </>
  );
}
