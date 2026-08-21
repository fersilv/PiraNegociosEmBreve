import React from "react";
import {
  ProfessionalExperience,
  UserProfile,
} from "../../contexts/AuthContext";

export interface TemplateProps {
  profile: UserProfile;
  color?: string;
  showPhoto?: boolean;
  address?: string;
  isFirstJob?: boolean;
}

export function getResumeDisplayName(profile: UserProfile): string {
  const preference = profile.resumePreferences?.nameMode || "SOCIAL";
  const civilName = profile.fullName || profile.displayName || profile.name || "";
  const socialName = profile.socialName?.trim() || "";
  if (preference === "CIVIL") return civilName || socialName || "Seu Nome";
  return socialName || civilName || "Seu Nome";
}

function monthYearValue(value: string | undefined): number {
  const raw = String(value || "").trim();
  if (/^(atual|presente)$/i.test(raw)) return Number.MAX_SAFE_INTEGER;
  const monthYear = raw.match(/^(\d{1,2})\/(\d{4})$/);
  if (monthYear) return Number(monthYear[2]) * 12 + Number(monthYear[1]);
  const year = raw.match(/^(\d{4})$/);
  return year ? Number(year[1]) * 12 : 0;
}

export function getResumeHeadline(profile: UserProfile): string {
  if (profile.resumePreferences?.showHeadline === false) return "";
  const custom = profile.resumePreferences?.headline?.trim();
  if (custom) return custom;

  const stages = (profile.experiences || []).flatMap((experience) =>
    getExperienceStages(experience).map((stage) => ({
      ...stage,
      company: experience.company,
    })),
  );
  const current = stages.find((stage) => stage.current);
  if (current?.role) return current.role;
  const latest = [...stages].sort(
    (a, b) =>
      Math.max(monthYearValue(b.endDate), monthYearValue(b.startDate)) -
      Math.max(monthYearValue(a.endDate), monthYearValue(a.startDate)),
  )[0];
  return latest?.role || "";
}

export function getExperienceStages(exp: ProfessionalExperience) {
  if (Array.isArray(exp.timeline) && exp.timeline.length > 0) return exp.timeline;
  return [
    {
      id: exp.id ? `${exp.id}-legacy` : undefined,
      role: exp.role,
      startDate: exp.startDate,
      endDate: exp.endDate,
      current: exp.current,
      description: exp.description,
      skills: exp.skills || [],
    },
  ];
}

export function TemplateWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="bg-white mx-auto shadow-sm border border-stone-200 print:border-none print:shadow-none"
      style={{
        width: "210mm",
        minHeight: "297mm",
        boxSizing: "border-box",
        pageBreakAfter: "auto",
      }}
    >
      {children}
    </div>
  );
}