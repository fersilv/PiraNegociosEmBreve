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

export function getResumeHeadline(profile: UserProfile): string {
  if (profile.resumePreferences?.showHeadline === false) return "";
  const custom = profile.resumePreferences?.headline?.trim();
  if (custom) return custom;
  const firstExperience = profile.experiences?.[0];
  const timeline = firstExperience?.timeline || [];
  const latestStage = timeline.length > 0 ? timeline[timeline.length - 1] : undefined;
  return latestStage?.role || firstExperience?.role || "";
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