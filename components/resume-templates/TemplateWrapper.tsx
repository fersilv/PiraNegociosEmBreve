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
    <div className="resume-a4-document bg-white mx-auto shadow-sm border border-stone-200 print:border-none print:shadow-none">
      <style>{`
        .resume-workflow:has(#resume-builder-root) .resume-stage-actions {
          display: none !important;
        }

        .resume-a4-document {
          position: relative;
          width: 210mm;
          min-height: 297mm;
          box-sizing: border-box;
          padding-bottom: 13mm;
          overflow: visible;
        }

        .resume-a4-document::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 50;
          pointer-events: none;
          background: repeating-linear-gradient(
            to bottom,
            transparent 0,
            transparent calc(297mm - 1px),
            rgba(103, 83, 72, .20) calc(297mm - 1px),
            rgba(103, 83, 72, .20) 297mm
          );
        }

        .resume-a4-document section,
        .resume-a4-document .break-inside-avoid,
        .resume-a4-document li {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .resume-a4-document h1,
        .resume-a4-document h2,
        .resume-a4-document h3 {
          break-after: avoid;
          page-break-after: avoid;
        }

        .resume-a4-document p {
          orphans: 3;
          widows: 3;
        }

        .resume-brand-footer {
          position: absolute;
          left: 10mm;
          right: 10mm;
          bottom: 4mm;
          z-index: 60;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          min-height: 6mm;
          border-top: 1px solid rgba(87, 72, 64, .10);
          padding-top: 2mm;
          color: rgba(87, 72, 64, .48);
          font-family: Arial, sans-serif;
          font-size: 8px;
          font-weight: 600;
          letter-spacing: .02em;
          line-height: 1;
        }

        .resume-brand-footer img {
          width: 10px;
          height: 10px;
          object-fit: contain;
          opacity: .62;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 9mm 9mm 15mm !important;
          }

          .resume-a4-document {
            width: auto !important;
            min-width: 0 !important;
            max-width: none !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
          }

          .resume-a4-document::after {
            display: none !important;
          }

          .resume-a4-document section,
          .resume-a4-document .break-inside-avoid,
          .resume-a4-document li,
          .resume-a4-document article {
            break-inside: avoid-page !important;
            page-break-inside: avoid !important;
          }

          .resume-a4-document h1,
          .resume-a4-document h2,
          .resume-a4-document h3 {
            break-after: avoid-page !important;
            page-break-after: avoid !important;
          }

          .resume-brand-footer {
            position: fixed;
            left: 0;
            right: 0;
            bottom: -10mm;
            border-top-color: rgba(87, 72, 64, .12);
            background: white;
          }
        }
      `}</style>
      {children}
      <div className="resume-brand-footer" aria-label="Currículo criado no PiraNegócios">
        <img src="/brand/symbol-terracotta.png" alt="" aria-hidden="true" />
        <span>Currículo criado em piranegocios.com.br</span>
      </div>
    </div>
  );
}
