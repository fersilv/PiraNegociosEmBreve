import React from "react";
import {
  getExperienceStages,
  getResumeDisplayName,
  getResumeHeadline,
  TemplateProps,
  TemplateWrapper,
} from "./TemplateWrapper";
import { Mail, Phone, MapPin, Linkedin } from "lucide-react";

export function ClassicTemplate({ profile, color = "#292524", showPhoto, address }: TemplateProps) {
  const nameToUse = getResumeDisplayName(profile);
  const headline = getResumeHeadline(profile);
  const displayAddress = address || profile.address;
  const photoUrl = profile.resumePhotoURL || profile.photoURL;

  return (
    <TemplateWrapper>
      <div className="p-12 font-serif text-stone-900 leading-relaxed" style={{ color: "#292524" }}>
        <header className="flex flex-col items-center text-center mb-8 border-b-2 pb-6" style={{ borderColor: color }}>
          {showPhoto && photoUrl && (
            <img src={photoUrl} alt="Foto de perfil" className="w-24 h-24 rounded-full object-cover mb-4 border border-stone-200" />
          )}
          <h1 className="text-3xl font-bold uppercase tracking-wider" style={{ color }}>{nameToUse}</h1>
          {headline && <div className="mt-1 mb-3 text-sm font-bold uppercase tracking-[0.14em] text-stone-500">{headline}</div>}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-stone-600">
            {profile.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {profile.email}</span>}
            {profile.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {profile.phone}</span>}
            {displayAddress && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {displayAddress}</span>}
            {profile.linkedinURL && <span className="flex items-center gap-1.5"><Linkedin className="w-3.5 h-3.5" /> {profile.linkedinURL.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "")}</span>}
          </div>
        </header>

        {profile.bio && (
          <section className="mb-8">
            <SectionTitle color={color}>Resumo Profissional</SectionTitle>
            <p className="text-justify text-sm leading-relaxed">{profile.bio}</p>
          </section>
        )}

        {profile.experiences && profile.experiences.length > 0 && (
          <section className="mb-8">
            <SectionTitle color={color}>Experiência Profissional</SectionTitle>
            <div className="space-y-6">
              {profile.experiences.map((exp, idx) => {
                const stages = getExperienceStages(exp);
                return (
                  <div key={exp.id || idx} className="break-inside-avoid">
                    <div className="flex justify-between items-baseline mb-2 gap-4">
                      <h3 className="font-bold text-base">{exp.company}</h3>
                      <span className="text-xs font-semibold text-stone-500 whitespace-nowrap">{exp.startDate} – {exp.current ? "Atual" : exp.endDate}</span>
                    </div>
                    {exp.description && stages.length > 1 && <p className="mb-3 text-sm leading-relaxed text-stone-600">{exp.description}</p>}
                    <div className="space-y-3 border-l border-stone-300 pl-4">
                      {stages.map((stage, stageIdx) => (
                        <div key={stage.id || stageIdx}>
                          <div className="flex justify-between gap-4 items-baseline">
                            <div className="font-bold text-sm">{stage.role}</div>
                            <span className="text-xs text-stone-500 whitespace-nowrap">{stage.startDate} – {stage.current ? "Atual" : stage.endDate}</span>
                          </div>
                          {stage.description && <p className="mt-1 text-sm text-justify leading-relaxed">{stage.description}</p>}
                          {stage.skills && stage.skills.length > 0 && <div className="mt-1.5 text-xs text-stone-500"><strong>Competências: </strong>{stage.skills.join(" • ")}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {profile.education && profile.education.length > 0 && (
          <section className="mb-8">
            <SectionTitle color={color}>Formação Acadêmica</SectionTitle>
            <div className="space-y-4">
              {profile.education.map((edu, idx) => (
                <div key={edu.id || idx} className="break-inside-avoid">
                  <div className="flex justify-between items-baseline mb-1 gap-4">
                    <h3 className="font-bold text-base">{edu.degree} {edu.fieldOfStudy ? `em ${edu.fieldOfStudy}` : ""}</h3>
                    <span className="text-sm font-semibold text-stone-600 whitespace-nowrap">{edu.startYear} – {edu.current ? "Atual" : edu.endYear}</span>
                  </div>
                  <div className="text-sm font-bold text-stone-700 italic">{edu.institution}</div>
                  {edu.description && <p className="mt-1 text-sm text-stone-600">{edu.description}</p>}
                  {edu.skills && edu.skills.length > 0 && <div className="mt-1 text-xs text-stone-500"><strong>Competências: </strong>{edu.skills.join(" • ")}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 break-inside-avoid">
          {profile.courses && profile.courses.length > 0 && (
            <section>
              <SectionTitle color={color}>Cursos e Certificações</SectionTitle>
              <ul className="list-disc list-inside text-sm space-y-1.5">
                {profile.courses.map((course, idx) => (
                  <li key={course.id || idx}><span className="font-semibold">{course.name}</span>{course.institution ? `, ${course.institution}` : ""}{course.year ? ` (${course.year})` : ""}</li>
                ))}
              </ul>
            </section>
          )}

          {profile.skills && profile.skills.length > 0 && (
            <section>
              <SectionTitle color={color}>Habilidades</SectionTitle>
              <div className="text-sm">{profile.skills.join(" • ")}</div>
            </section>
          )}
        </div>

        {profile.languages && profile.languages.length > 0 && (
          <section className="mt-8 break-inside-avoid">
            <SectionTitle color={color}>Idiomas</SectionTitle>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">{profile.languages.map((lang, idx) => <span key={`${lang.name}-${idx}`}><strong>{lang.name}</strong> — {lang.level}</span>)}</div>
          </section>
        )}
      </div>
    </TemplateWrapper>
  );
}

function SectionTitle({ children, color }: { children: React.ReactNode; color: string }) {
  return <h2 className="text-lg font-bold uppercase tracking-wider mb-3 pb-1 border-b" style={{ borderColor: color, color }}>{children}</h2>;
}