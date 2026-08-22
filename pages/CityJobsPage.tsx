import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Briefcase, Building2, ExternalLink, Loader2, MapPin } from "lucide-react";
import { api } from "../lib/api";
import { applicationUrlLabel, safeApplicationUrl } from "../lib/jobApplication";

type CityJob = {
  id: string;
  slug?: string;
  title: string;
  location?: string;
  city?: string;
  state?: string;
  type?: string;
  workModel?: string;
  salary?: string;
  companyName?: string;
  company?: { name?: string } | null;
  sourceName?: string;
  description?: string;
  applicationUrl?: string | null;
  applicationUrlTitle?: string | null;
};
type CityData = { city: string; state?: string | null; slug: string; count: number; jobs: CityJob[]; updatedAt?: string };

export default function CityJobsPage() {
  const { citySlug = "" } = useParams<{ citySlug: string }>();
  const [data, setData] = useState<CityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/public/jobs-by-city/${encodeURIComponent(citySlug)}`)
      .then((response) => {
        if (!active) return;
        setData(response.data);
        setNotFound(false);
      })
      .catch(() => {
        if (!active) return;
        setData(null);
        setNotFound(true);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [citySlug]);

  useEffect(() => {
    if (!data) return;
    const place = `${data.city}${data.state ? `, ${data.state}` : ""}`;
    const title = `Vagas em ${place} hoje | PiraNegócios`;
    const description = `Encontre vagas de emprego em ${place} no PiraNegócios (Pira Negócios). Veja oportunidades ativas, empresas contratando e candidate-se online.`;
    document.title = title;
    setMeta("description", description);
    setMeta("og:title", title, "property");
    setMeta("og:description", description, "property");
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `https://piranegocios.com.br/vagas-em/${data.slug}`;

    const scriptId = "city-jobs-jsonld";
    document.getElementById(scriptId)?.remove();
    const script = document.createElement("script");
    script.id = scriptId;
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `Vagas em ${place}`,
      url: canonical.href,
      isPartOf: { "@type": "WebSite", name: "PiraNegócios", alternateName: ["Pira Negócios", "Pira Negócio"], url: "https://piranegocios.com.br/" },
      about: { "@type": "City", name: data.city },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: data.jobs.length,
        itemListElement: data.jobs.map((job, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `https://piranegocios.com.br/vagas/${job.slug}`,
          name: job.title,
        })),
      },
    });
    document.head.appendChild(script);
    return () => { document.getElementById(scriptId)?.remove(); };
  }, [data]);

  if (loading) return <div className="flex min-h-[70vh] items-center justify-center bg-[#f5f2eb]"><Loader2 className="h-8 w-8 animate-spin text-terracotta-600" /></div>;

  if (notFound || !data) {
    return <main className="min-h-screen bg-[#f5f2eb] px-4 py-20"><div className="mx-auto max-w-xl rounded-[30px] border border-stone-200 bg-white p-8 text-center"><MapPin className="mx-auto h-8 w-8 text-stone-300" /><h1 className="mt-4 font-serif text-3xl font-bold text-stone-950">Sem vagas ativas nesta cidade agora.</h1><p className="mt-3 text-sm leading-6 text-stone-500">A página volta a aparecer no nosso índice quando houver novas oportunidades verificadas.</p><Link to="/vagas" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-stone-950 px-5 py-3 text-sm font-bold text-white">Ver todas as vagas</Link></div></main>;
  }

  const place = `${data.city}${data.state ? `, ${data.state}` : ""}`;
  return (
    <div className="min-h-screen bg-[#f5f2eb] text-stone-900">
      <header className="border-b border-stone-200 bg-white/90 px-4 py-4 backdrop-blur-xl"><div className="mx-auto flex max-w-6xl items-center justify-between"><Link to="/" className="font-serif text-xl font-black text-stone-950">PiraNegócios</Link><Link to="/vagas" className="text-xs font-bold text-terracotta-700">Todas as vagas</Link></div></header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <Link to="/vagas" className="inline-flex items-center gap-2 text-xs font-bold text-stone-500"><ArrowLeft className="h-4 w-4" /> Voltar à busca</Link>
        <section className="mt-5 overflow-hidden rounded-[34px] bg-[#2b211c] p-6 text-white shadow-xl sm:p-9">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#efb89c]">Empregos e oportunidades locais</p>
          <h1 className="mt-3 max-w-4xl font-serif text-4xl font-bold sm:text-5xl">Vagas em {place}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/60">Encontre vagas de emprego em {data.city} publicadas por empresas, PATs e fontes regionais verificáveis. O PiraNegócios reúne oportunidades locais em um só lugar.</p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-4 py-2 text-xs font-bold text-white/75"><Briefcase className="h-4 w-4 text-[#efb89c]" /> {data.count} {data.count === 1 ? "oportunidade ativa" : "oportunidades ativas"}</div>
        </section>

        <section className="mt-8">
          <div className="mb-4"><h2 className="font-serif text-2xl font-bold">Oportunidades abertas em {data.city}</h2><p className="mt-1 text-sm text-stone-500">A lista acompanha as vagas ativas disponíveis no portal.</p></div>
          <div className="grid gap-3">
            {data.jobs.map((job) => {
              const companyName = job.company?.name || job.companyName || job.sourceName || "Empresa";
              const applicationHref = safeApplicationUrl(job.applicationUrl);
              return (
                <article key={job.id} className="group rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-terracotta-200 hover:shadow-md">
                  <Link to={`/vagas/${job.slug}`} className="block">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.12em] text-terracotta-600"><Building2 className="h-3.5 w-3.5" /> {companyName}</p><h3 className="mt-1 text-xl font-bold text-stone-950 group-hover:text-terracotta-700">{job.title}</h3><p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location || place}</span>{job.type && <span>{job.type}</span>}{job.workModel && <span>{job.workModel}</span>}</p></div>{job.salary && <span className="shrink-0 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700">{job.salary}</span>}</div>{job.description && <p className="mt-4 line-clamp-2 text-sm leading-6 text-stone-600">{job.description}</p>}
                  </Link>
                  {applicationHref && (
                    <div className="mt-4 border-t border-stone-100 pt-4">
                      <a href={applicationHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-terracotta-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-terracotta-700">
                        <ExternalLink className="h-3.5 w-3.5" /> {applicationUrlLabel(job.applicationUrlTitle)}
                      </a>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-10 rounded-[28px] border border-terracotta-100 bg-[#fffdfa] p-6 sm:p-8"><h2 className="font-serif text-2xl font-bold">Procurando emprego em {data.city}?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Crie seu currículo no PiraNegócios, informe as cidades onde aceita trabalhar e receba matches mais realistas para a sua região.</p><Link to="/login" className="mt-5 inline-flex rounded-xl bg-terracotta-600 px-5 py-3 text-sm font-bold text-white">Criar meu perfil</Link></section>
      </main>
    </div>
  );
}

function setMeta(name: string, content: string, attribute: "name" | "property" = "name") {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  element.content = content;
}
