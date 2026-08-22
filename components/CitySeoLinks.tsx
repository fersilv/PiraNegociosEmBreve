import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { api, asArray } from "../lib/api";
import type { Job } from "../types/job";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function locationOf(job: Job) {
  const city = job.city?.trim() || String(job.location || "").split(",")[0].replace(/\s*\/\s*[A-Z]{2}$/i, "").trim();
  if (!city || /^remoto$/i.test(city)) return null;
  const state = job.state?.trim() || String(job.location || "").match(/(?:,|\/)\s*([A-Z]{2})\s*$/i)?.[1]?.toUpperCase();
  return { city, state };
}

export function CitySeoLinks() {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    let active = true;
    api.get("/jobs")
      .then((response) => active && setJobs(asArray<Job>(response.data)))
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const cities = useMemo(() => {
    const map = new Map<string, { city: string; state?: string; count: number }>();
    jobs.filter((job) => job.active !== false).forEach((job) => {
      const place = locationOf(job);
      if (!place) return;
      const slug = slugify(place.city);
      if (!slug) return;
      const current = map.get(slug);
      map.set(slug, { city: place.city, state: place.state, count: (current?.count || 0) + 1 });
    });
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count || a[1].city.localeCompare(b[1].city, "pt-BR"));
  }, [jobs]);

  if (!cities.length) return null;

  return (
    <section className="border-t border-stone-200 bg-[#f7f3ed] px-4 py-9">
      <div className="mx-auto max-w-6xl">
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta-600">Vagas por cidade</p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-stone-950">Encontre oportunidades perto de você</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Acesse diretamente as cidades que têm vagas ativas no PiraNegócios.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {cities.map(([slug, item]) => (
            <Link key={slug} to={`/vagas-em/${slug}`} className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-xs font-bold text-stone-700 transition hover:border-terracotta-300 hover:text-terracotta-700">
              <MapPin className="h-3.5 w-3.5 text-terracotta-500" />
              Vagas em {item.city}{item.state ? `, ${item.state}` : ""}
              <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] text-stone-400">{item.count}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
