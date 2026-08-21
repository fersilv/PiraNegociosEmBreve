import React from "react";
import {
  getExperienceStages,
  getResumeDisplayName,
  getResumeHeadline,
  TemplateProps,
  TemplateWrapper,
} from "./TemplateWrapper";

export function MinimalistTemplate({ profile, color = "#1c1917", showPhoto, address }: TemplateProps) {
  const nameToUse = getResumeDisplayName(profile);
  const headline = getResumeHeadline(profile);
  const displayAddress = address || profile.address;
  const photoUrl = profile.resumePhotoURL || profile.photoURL;

  const contactItems: string[] = [];
  if (profile.email) contactItems.push(profile.email);
  if (profile.phone) contactItems.push(profile.phone);
  if (displayAddress) contactItems.push(displayAddress);
  if (profile.linkedinURL) contactItems.push(profile.linkedinURL.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, ""));

  return (
    <TemplateWrapper>
      <div className="p-12 font-sans text-stone-800 font-light" style={{ color: "#1c1917" }}>
        <header className="mb-10 flex flex-col items-start">
          <div className="flex w-full items-center justify-between mb-3 gap-5">
            <div>
              <h1 className="text-4xl tracking-tighter uppercase font-medium" style={{ color }}>{nameToUse}</h1>
              {headline && <p className="mt-1 text-sm font-medium uppercase tracking-[0.14em] text-stone-500">{headline}</p>}
            </div>
            {showPhoto && photoUrl && <img src={photoUrl} alt="Foto de perfil" className="w-20 h-20 rounded-lg object-cover grayscale opacity-90" />}
          </div>
          <div className="text-sm tracking-wide text-stone-500 uppercase">{contactItems.join("  |  ")}</div>
        </header>

        {profile.bio && (
          <section className="mb-10">
            <SectionTitle>Perfil</SectionTitle>
            <p className="text-sm leading-relaxed text-justify">{profile.bio}</p>
          </section>
        )}

        {profile.experiences && profile.experiences.length > 0 && (
          <section className="mb-10">
            <SectionTitle>Experiência Profissional</SectionTitle>
            <div className="space-y-7">
              {profile.experiences.map((exp, idx) => {
                const stages = getExperienceStages(exp);
                return (
                  <div key={exp.id || idx} className="grid grid-cols-12 gap-4 break-inside-avoid">
                    <div className="col-span-3 text-xs text-stone-500 pt-1">{exp.startDate} — {exp.current ? "Atual" : exp.endDate}</div>
                    <div className="col-span-9">
                      <h3 className="text-base font-medium text-stone-900">{exp.company}</h3>
                      {exp.description && stages.length > 1 && <p className="mt-1 text-sm leading-relaxed text-stone-600">{exp.description}</p>}
                      <div className="mt-3 space-y-4 border-l border-stone-200 pl-4">
                        {stages.map((stage, stageIdx) => (
                          <div key={stage.id || stageIdx}>
                            <div className="flex items-baseline justify-between gap-4">
                              <h4 className="text-sm font-medium text-stone-900">{stage.role}</h4>
                              <span className="text-[11px] text-stone-400 whitespace-nowrap">{stage.startDate} — {stage.current ? "Atual" : stage.endDate}</span>
                            </div>
                            {stage.description && <p className="mt-1 text-sm leading-relaxed text-justify">{stage.description}</p>}
                            {stage.skills && stage.skills.length > 0 && <p className="mt-1 text-xs text-stone-500">{stage.skills.join(" · ")}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {profile.education && profile.education.length > 0 && (
          <section className="mb-10">
            <SectionTitle>Educação</SectionTitle>
            <div className="space-y-4">
              {profile.education.map((edu, idx) => (
                <div key={edu.id || idx} className="grid grid-cols-12 gap-4 break-inside-avoid">
                  <div className="col-span-3 text-xs text-stone-500 pt-1">{edu.startYear} — {edu.current ? "Atual" : edu.endYear}</div>
                  <div className="col-span-9">
                    <h3 className="text-base font-medium text-stone-900">{edu.degree} {edu.fieldOfStudy ? `em ${edu.fieldOfStudy}` : ""}</h3>
                    <div className="text-sm text-stone-500">{edu.institution}</div>
                    {edu.description && <p className="mt-1 text-sm text-stone-600">{edu.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-12 break-inside-avoid">
          {profile.skills && profile.skills.length > 0 && (
            <section>
              <SectionTitle>Habilidades</SectionTitle>
              <ul className="text-sm space-y-1.5 list-none p-0">{profile.skills.map((skill) => <li key={skill} className="text-stone-700">{skill}</li>)}</ul>
            </section>
          )}

          {profile.courses && profile.courses.length > 0 && (
            <section>
              <SectionTitle>Cursos e Certificações</SectionTitle>
              <ul className="text-sm space-y-3 list-none p-0">
                {profile.courses.map((course, idx) => (
                  <li key={course.id || idx}><div className="font-medium text-stone-900">{course.name}</div><div className="text-stone-500 text-xs">{[course.institution, course.year].filter(Boolean).join(", ")}</div></li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="grid grid-cols-2 gap-12 mt-8 break-inside-avoid">
          {profile.languages && profile.languages.length > 0 && (
            <section>
              <SectionTitle>Idiomas</SectionTitle>
              <ul className="text-sm space-y-2 list-none p-0">{profile.languages.map((lang, idx) => <li key={`${lang.name}-${idx}`}><span className="font-medium text-stone-900">{lang.name}</span> <span className="text-stone-500">— {lang.level}</span></li>)}</ul>
            </section>
          )}

          {profile.salaryExpectation && (
            <section><SectionTitle>Pretensão Salarial</SectionTitle><p className="text-sm text-stone-700">{profile.salaryExpectation}</p></section>
          )}
        </div>
      </div>
    </TemplateWrapper>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-4 font-semibold">{children}</h2>;
}