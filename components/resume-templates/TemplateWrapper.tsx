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
            margin: 8mm !important;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html body #resume-builder-root #resume-preview-area,
          html body #resume-builder-root #resume-preview-area > div {
            width: 194mm !important;
            min-width: 194mm !important;
            max-width: 194mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            transform: none !important;
            filter: none !important;
            overflow: visible !important;
            background: white !important;
          }

          html body #resume-builder-root #resume-preview-area > div > .resume-a4-document,
          html body .resume-a4-document {
            width: 194mm !important;
            min-width: 194mm !important;
            max-width: 194mm !important;
            min-height: 0 !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
            box-sizing: border-box !important;
          }

          .resume-a4-document::after {
            display: none !important;
          }

          /* Na impressão o conteúdo deve fluir continuamente. A caixa pode ser
             fragmentada entre folhas; o navegador mantém cada linha de texto inteira. */
          .resume-a4-document section,
          .resume-a4-document .break-inside-avoid,
          .resume-a4-document li,
          .resume-a4-document article,
          .resume-a4-document .resume-experience-section,
          .resume-a4-document .resume-experience-card,
          .resume-a4-document .resume-experience-stage {
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          /* Evita título solitário no fim da folha, mas não segura o card inteiro. */
          .resume-a4-document h1,
          .resume-a4-document h2,
          .resume-a4-document h3,
          .resume-a4-document h4,
          .resume-a4-document .resume-experience-stage > div:first-child {
            break-after: avoid-page !important;
            page-break-after: avoid !important;
          }

          .resume-a4-document p,
          .resume-a4-document li {
            orphans: 2 !important;
            widows: 2 !important;
          }

          /* O modelo Criativo usa paddings grandes na tela. Na impressão reduzimos
             somente o suficiente para aproveitar a A4 sem mudar o visual do preview. */
          .resume-a4-document .resume-creative-hero {
            padding: 8mm 8mm 6mm !important;
          }

          .resume-a4-document .resume-creative-layout {
            gap: 6mm !important;
            padding: 7mm 8mm 9mm !important;
          }

          .resume-a4-document .resume-creative-main,
          .resume-a4-document .resume-creative-side {
            row-gap: 5mm !important;
          }

          .resume-brand-footer {
            position: static !important;
            margin: 7mm 8mm 0 !important;
            min-height: 5mm;
            padding-top: 2mm;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
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
