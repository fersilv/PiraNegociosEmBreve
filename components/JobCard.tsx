import React from "react";
import {
  Accessibility,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  Clock3,
  DollarSign,
  ExternalLink,
  Laptop,
  MapPin,
} from "lucide-react";
import type { Job } from "../types/job";
import { ShareJobButtons } from "./ShareJobButtons";

interface JobCardProps {
  key?: React.Key;
  job: Job;
  onClick: () => void;
  hasApplied?: boolean;
}

export function getRelativeTimeString(dateString?: string | null) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffInSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

  if (Math.abs(diffInSec) < 60) return rtf.format(diffInSec, "second");
  const diffInMin = Math.round(diffInSec / 60);
  if (Math.abs(diffInMin) < 60) return rtf.format(diffInMin, "minute");
  const diffInHour = Math.round(diffInMin / 60);
  if (Math.abs(diffInHour) < 24) return rtf.format(diffInHour, "hour");
  const diffInDay = Math.round(diffInHour / 24);
  if (Math.abs(diffInDay) < 30) return rtf.format(diffInDay, "day");
  const diffInMonth = Math.round(diffInDay / 30);
  if (Math.abs(diffInMonth) < 12) return rtf.format(diffInMonth, "month");
  const diffInYear = Math.round(diffInDay / 365);
  return rtf.format(diffInYear, "year");
}

function postedAt(job: Job) {
  return (
    job.sourcePublishedAt ||
    job.postedAt ||
    job.createdAt ||
    job.updatedAt ||
    ""
  );
}

export function JobCard({ job, onClick, hasApplied = false }: JobCardProps) {
  const relativeDate = getRelativeTimeString(postedAt(job));
  const companyLabel = job.isConfidential
    ? "Empresa confidencial"
    : job.companyName || job.sourceName || "Empresa não informada";
  const externalSource = job.isExternalListing && job.sourceName;
  const safeSourceUrl =
    job.sourceUrl && /^https?:\/\//i.test(job.sourceUrl) ? job.sourceUrl : null;

  return (
    <article
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
      className={`group relative w-full cursor-pointer overflow-hidden rounded-[24px] border bg-white p-5 text-left shadow-[0_10px_35px_rgba(66,43,31,.045)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(66,43,31,.10)] sm:p-6 ${
        job.isSponsored
          ? "border-[#e2a58c] ring-1 ring-[#efd2c5]"
          : "border-[#5b4030]/10 hover:border-[#c97655]/35"
      }`}
    >
      {job.isSponsored && (
        <div className="absolute right-0 top-0 rounded-bl-2xl bg-[#2d211c] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.15em] text-white">
          Destaque
        </div>
      )}

      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f5e8df] text-lg font-black text-[#b76042] shadow-inner">
          {companyLabel.charAt(0).toUpperCase() || "P"}
        </div>

        <div className="min-w-0 flex-1 pr-8 sm:pr-16">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 font-serif text-xl font-bold leading-tight text-[#2d211c] sm:text-[22px]">
              {job.title}
            </h3>
            {hasApplied && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-100">
                <CheckCircle2 className="h-3 w-3" /> Inscrito
              </span>
            )}
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-[#9d5d43]">
            {companyLabel}
            {!job.isConfidential && job.isCompanyVerified && (
              <CheckCircle2 className="h-3.5 w-3.5 text-sky-600" />
            )}
          </p>
        </div>

        <ArrowUpRight className="absolute right-5 top-6 h-5 w-5 text-[#bca89d] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#c96847]" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {job.isTalentPool && (
          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700 ring-1 ring-violet-100">
            Banco de talentos
          </span>
        )}
        {job.pcdMode === "INCLUSIVE" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-700 ring-1 ring-sky-100">
            <Accessibility className="h-3 w-3" /> Também para PCD
          </span>
        )}
        {job.pcdMode === "EXCLUSIVE" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700 ring-1 ring-violet-100">
            <Accessibility className="h-3 w-3" /> Exclusiva PCD
          </span>
        )}
        {job.acceptsPlatformApplications === false && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800 ring-1 ring-amber-100">
            <ExternalLink className="h-3 w-3" /> Candidatura externa
          </span>
        )}
      </div>

      {job.description && (
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-[#6f5c52]">
          {job.description}
        </p>
      )}

      {job.skills && job.skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {job.skills.slice(0, 4).map((skill) => (
            <span
              key={skill}
              className="rounded-lg bg-[#f7f2ed] px-2.5 py-1 text-[10px] font-bold text-[#72584b]"
            >
              {skill}
            </span>
          ))}
          {job.skills.length > 4 && (
            <span className="rounded-lg bg-[#f7f2ed] px-2.5 py-1 text-[10px] font-bold text-[#9a8174]">
              +{job.skills.length - 4}
            </span>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-4 border-t border-[#5b4030]/8 pt-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 text-xs text-[#77665d]">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-[#c96847]" />
            {job.location || "Local não informado"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5 text-[#c96847]" />
            {job.type || "Contrato não informado"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Laptop className="h-3.5 w-3.5 text-[#c96847]" />
            {job.workModel || "Presencial"}
          </span>
          {job.salary && (
            <span className="inline-flex items-center gap-1.5 font-bold text-[#433129]">
              <DollarSign className="h-3.5 w-3.5 text-[#c96847]" />
              {job.salary}
            </span>
          )}
          {relativeDate && (
            <span className="inline-flex items-center gap-1.5 text-[#9a887e]">
              <Clock3 className="h-3.5 w-3.5" />
              {relativeDate}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 xl:justify-end">
          {safeSourceUrl ? (
            <a
              href={safeSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#f7f2ed] px-2.5 py-1.5 text-[10px] font-black text-[#9d5d43] transition hover:bg-[#f1e4da]"
            >
              <ExternalLink className="h-3 w-3" /> Ver fonte original
            </a>
          ) : externalSource ? (
            <span className="max-w-[180px] truncate text-[10px] font-bold uppercase tracking-[.1em] text-[#a08c81]" title={externalSource}>
              Fonte: {externalSource}
            </span>
          ) : null}
          <div onClick={(event) => event.stopPropagation()} className="shrink-0">
            <ShareJobButtons
              title={job.title}
              url={`https://piranegocios.com.br/vagas/${job.slug || job.id}`}
              companyName={companyLabel}
              location={job.location}
              salary={job.salary}
              workModel={job.workModel}
              acceptsPlatformApplications={job.acceptsPlatformApplications}
              hideEmbed
            />
          </div>
        </div>
      </div>
    </article>
  );
}
