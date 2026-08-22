import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { UserJobsPersonalizedPage } from "./UserJobsPersonalizedPage";
import { api, asArray } from "../lib/api";
import type { Job } from "../types/job";
import { applicationUrlLabel, safeApplicationUrl } from "../lib/jobApplication";

export function UserJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    let active = true;
    api.get("/jobs")
      .then((response) => {
        if (active) setJobs(asArray<Job>(response.data));
      })
      .catch((error) => console.warn("Não foi possível carregar atalhos de candidatura online.", error));
    return () => { active = false; };
  }, []);

  const onlineApplications = useMemo(
    () => jobs
      .filter((job) => job.active !== false && safeApplicationUrl(job.applicationUrl))
      .sort((a, b) => new Date(b.sourcePublishedAt || b.postedAt || b.updatedAt || 0).getTime() - new Date(a.sourcePublishedAt || a.postedAt || a.updatedAt || 0).getTime()),
    [jobs],
  );

  return (
    <div className="space-y-6">
      {onlineApplications.length > 0 && (
        <section className="rounded-[26px] border border-terracotta-100 bg-[#fff8f3] p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-terracotta-600">Candidatura online</p>
              <h2 className="mt-1 font-serif text-xl font-bold text-stone-950">Vagas com inscrição em site externo</h2>
              <p className="mt-1 text-xs leading-5 text-stone-500">O botão leva direto ao portal indicado pela empresa ou pela fonte da vaga.</p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-terracotta-700 ring-1 ring-terracotta-100">{onlineApplications.length}</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {onlineApplications.map((job) => {
              const href = safeApplicationUrl(job.applicationUrl)!;
              return (
                <article key={job.id} className="min-w-[260px] max-w-[320px] flex-1 rounded-2xl border border-stone-200 bg-white p-4">
                  <p className="truncate text-[10px] font-bold uppercase tracking-wider text-stone-400">{job.isConfidential ? "Empresa confidencial" : job.companyName || job.sourceName || "Oportunidade"}</p>
                  <h3 className="mt-1 line-clamp-2 text-sm font-black text-stone-900">{job.title}</h3>
                  <p className="mt-1 truncate text-[11px] text-stone-500">{job.location || [job.city, job.state].filter(Boolean).join(", ") || "Local não informado"}</p>
                  <a href={href} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta-600 px-3 py-2.5 text-xs font-black text-white transition hover:bg-terracotta-700">
                    <ExternalLink className="h-3.5 w-3.5" /> {applicationUrlLabel(job.applicationUrlTitle)}
                  </a>
                </article>
              );
            })}
          </div>
        </section>
      )}
      <UserJobsPersonalizedPage />
    </div>
  );
}
