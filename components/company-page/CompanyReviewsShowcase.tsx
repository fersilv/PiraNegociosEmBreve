import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

type CompanyReview = {
  id: string;
  rating: number;
  comment?: string | null;
  author?: string | null;
  createdAt: string;
  source: "RAPI10_APP" | "PIRANEGOCIOS" | string;
};

type CompanyReviewResponse = {
  place?: { id?: string; name?: string; companyId?: string | null; sourceType?: string | null };
  summary?: { average?: number | null; count?: number };
  reviews?: CompanyReview[];
};

const sourceLabel = (value: string) => value === "PIRANEGOCIOS" ? "PiraNegócios" : "Rapi10 App";

function Stars({ value }: { value: number }) {
  const score = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return <span aria-label={`${score} de 5 estrelas`} className="tracking-[0.08em] text-amber-500">{"★".repeat(score)}<span className="text-stone-300">{"★".repeat(5 - score)}</span></span>;
}

export function CompanyReviewsShowcase({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [data, setData] = useState<CompanyReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/public/company-pages/company/${encodeURIComponent(companyId)}/reviews`)
      .then((response) => { if (active) setData(response.data || null); })
      .catch(() => { if (active) setData(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyId]);

  const reviews = Array.isArray(data?.reviews) ? data!.reviews! : [];
  const count = Math.max(0, Number(data?.summary?.count || reviews.length || 0));
  const average = Number(data?.summary?.average);
  const displayAverage = Number.isFinite(average) && average > 0 ? average : null;
  const recent = useMemo(() => reviews.slice(0, 12), [reviews]);

  if (!loading && !count && !recent.length) return null;

  return (
    <section className="bg-[#f8f6f2] border-y border-stone-200" aria-label={`Avaliações de ${companyName}`}>
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full border border-stone-300 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-stone-600">Experiência de clientes</span>
            <h2 className="mt-4 font-serif text-3xl sm:text-4xl font-bold tracking-tight text-stone-950">O que dizem sobre {companyName}</h2>
            <p className="mt-3 text-sm sm:text-base leading-7 text-stone-600">Avaliações publicadas após moderação no ecossistema PiraNegócios e Rapi10. A origem de cada relato aparece junto da avaliação.</p>
          </div>
          {displayAverage !== null && count > 0 && (
            <div className="shrink-0 rounded-3xl border border-stone-200 bg-white px-6 py-5 shadow-sm min-w-[220px]">
              <div className="flex items-baseline gap-2"><strong className="text-4xl font-black text-stone-950">{displayAverage.toFixed(1).replace(".", ",")}</strong><span className="text-sm font-bold text-stone-400">/ 5</span></div>
              <div className="mt-1 text-lg"><Stars value={Math.round(displayAverage)} /></div>
              <div className="mt-2 text-xs font-bold text-stone-500">{count} {count === 1 ? "avaliação publicada" : "avaliações publicadas"}</div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true">
            {[0, 1, 2].map((item) => <div key={item} className="h-44 rounded-3xl bg-white border border-stone-200 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {recent.map((review) => (
              <article key={review.id} className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6 shadow-[0_12px_36px_rgba(41,37,36,0.05)]">
                <header className="flex items-start justify-between gap-4">
                  <div>
                    <Stars value={review.rating} />
                    <div className="mt-2 text-sm font-black text-stone-900">{review.author || "Cliente"}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${review.source === "PIRANEGOCIOS" ? "bg-[#fff0ec] text-[#a84330]" : "bg-cyan-50 text-cyan-800"}`}>{sourceLabel(review.source)}</span>
                </header>
                {review.comment ? <p className="mt-5 text-sm leading-6 text-stone-650">{review.comment}</p> : <p className="mt-5 text-sm italic text-stone-400">Avaliação enviada somente com nota.</p>}
                <footer className="mt-5 pt-4 border-t border-stone-100 text-[10px] font-bold uppercase tracking-[0.08em] text-stone-400">{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(review.createdAt))}</footer>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
