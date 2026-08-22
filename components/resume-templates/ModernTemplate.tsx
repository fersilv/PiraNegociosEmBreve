import React from "react";
import {
  getExperienceStages,
  getResumeDisplayName,
  getResumeHeadline,
  TemplateProps,
  TemplateWrapper,
} from "./TemplateWrapper";
import { Mail, Phone, MapPin, Linkedin } from "lucide-react";
import { getResumePersonalDetails } from "./ResumePersonalDetails";

export function ModernTemplate({
  profile,
  color = "#0284c7",
  showPhoto,
  address,
  isFirstJob,
}: TemplateProps) {
  const nameToUse = getResumeDisplayName(profile);
  const headline = getResumeHeadline(profile);
  const displayAddress = address || profile.address;
  const photoUrl = profile.resumePhotoURL || profile.photoURL;
  const personalDetails = getResumePersonalDetails(profile);

  const experienceSection =
    profile.experiences && profile.experiences.length > 0 ? (
      <section>
        <SectionTitle color={color}>Experiência Profissional</SectionTitle>
        <div className="space-y-6">
          {profile.experiences.map((exp, idx) => {
            const stages = getExperienceStages(exp);
            return (
              <div
                key={exp.id || idx}
                className="relative pl-5 border-l-2 break-inside-avoid"
                style={{ borderColor: `${color}30` }}
              >
                <div
                  className="absolute w-2.5 h-2.5 rounded-full -left-[6px] top-1"
                  style={{ backgroundColor: color }}
                />
                <div className="font-bold text-stone-900 text-base">{exp.company}</div>
                {exp.description && stages.length > 1 && (
                  <p className="mt-1 text-sm text-stone-600 leading-relaxed">
                    {exp.description}
                  </p>
                )}
                <div className="mt-3 space-y-4">
                  {stages.map((stage, stageIdx) => (
                    <div key={stage.id || stageIdx} className="relative pl-4">
                      {stages.length > 1 && (
                        <span
                          className="absolute left-0 top-2 h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      )}
                      <div className="flex justify-between items-baseline mb-0.5 flex-wrap gap-x-4">
                        <h3 className="font-semibold text-stone-900">{stage.role}</h3>
                        <span className="text-xs text-stone-500 font-semibold whitespace-nowrap">
                          {stage.startDate} – {stage.current ? "Atual" : stage.endDate}
                        </span>
                      </div>
                      {stage.description && (
                        <p className="text-sm text-stone-600 leading-relaxed">
                          {stage.description}
                        </p>
                      )}
                      {stage.skills && stage.skills.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {stage.skills.map((skill) => (
                            <span
                              key={skill}
                              className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    ) : null;

  const educationSection =
    profile.education && profile.education.length > 0 ? (
      <section>
        <SectionTitle color={color}>Formação Acadêmica</SectionTitle>
        <div className="space-y-4">
          {profile.education.map((edu, idx) => (
            <div
              key={edu.id || idx}
              className="relative pl-5 border-l-2 break-inside-avoid"
              style={{ borderColor: `${color}30` }}
            >
              <div
                className="absolute w-2.5 h-2.5 rounded-full -left-[6px] top-1"
                style={{ backgroundColor: color }}
              />
              <h3 className="font-bold text-stone-900">
                {edu.degree}{edu.fieldOfStudy ? ` em ${edu.fieldOfStudy}` : ""}
              </h3>
              <div className="text-sm font-semibold" style={{ color }}>
                {edu.institution}
              </div>
              <div className="text-xs text-stone-500 font-semibold mt-0.5">
                {edu.startYear} – {edu.current ? "Atual" : edu.endYear}
              </div>
              {edu.description && (
                <p className="mt-1 text-sm leading-relaxed text-stone-600">{edu.description}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    ) : null;

  return (
    <TemplateWrapper>
      <div className="font-sans text-stone-800 min-h-[297mm]">
        <header
          className="px-10 py-8 text-white"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}
        >
          <div className="flex items-center gap-6">
            {showPhoto && photoUrl && (
              <img
                src={photoUrl}
                alt="Foto"
                className="w-24 h-24 rounded-full object-cover border-[3px] border-white/40 shadow-md shrink-0"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold tracking-tight leading-tight">{nameToUse}</h1>
              {headline && (
                <p className="text-lg font-medium opacity-90 mt-1 tracking-wide">{headline}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-5 text-sm opacity-90">
            {profile.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {profile.email}
              </span>
            )}
            {profile.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> {profile.phone}
              </span>
            )}
            {displayAddress && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> {displayAddress}
              </span>
            )}
            {profile.linkedinURL && (
              <span className="flex items-center gap-1.5">
                <Linkedin className="w-3.5 h-3.5" />{" "}
                {profile.linkedinURL
                  .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "")
                  .replace(/\/$/, "")}
              </span>
            )}
          </div>
          {personalDetails.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-white/80">
              {personalDetails.map((detail) => <span key={detail}>• {detail}</span>)}
            </div>
          )}
        </header>

        <div className="flex flex-row">
          <aside className="w-[30%] bg-stone-50 p-8 space-y-7 border-r border-stone-200 print:bg-stone-50">
            {profile.skills && profile.skills.length > 0 && (
              <section>
                <SectionTitle color={color}>Habilidades</SectionTitle>
                <ul className="space-y-1.5 text-sm">
                  {profile.skills.map((skill) => (
                    <li key={skill} className="flex items-center gap-2 text-stone-700">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      {skill}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {profile.languages && profile.languages.length > 0 && (
              <section>
                <SectionTitle color={color}>Idiomas</SectionTitle>
                <ul className="space-y-2 text-sm">
                  {profile.languages.map((lang, idx) => (
                    <li key={`${lang.name}-${idx}`} className="text-stone-700">
                      <div className="font-semibold">{lang.name}</div>
                      <div className="text-stone-500 text-xs">{lang.level}</div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {profile.courses && profile.courses.length > 0 && (
              <section>
                <SectionTitle color={color}>Cursos e Certificações</SectionTitle>
                <ul className="space-y-3 text-sm">
                  {profile.courses.map((course, idx) => (
                    <li key={course.id || idx}>
                      <div className="font-semibold text-stone-800">{course.name}</div>
                      <div className="text-stone-500 text-xs">
                        {course.institution} · {course.year}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {profile.salaryExpectation && (
              <section>
                <SectionTitle color={color}>Pretensão Salarial</SectionTitle>
                <p className="text-sm text-stone-700">{profile.salaryExpectation}</p>
              </section>
            )}
          </aside>

          <main className="w-[70%] p-8 space-y-7 bg-white">
            {profile.bio && (
              <section>
                <SectionTitle color={color}>Sobre Mim</SectionTitle>
                <p className="text-sm leading-relaxed text-stone-600 text-justify">
                  {profile.bio}
                </p>
              </section>
            )}

            {isFirstJob ? (
              <>
                {educationSection}
                {experienceSection}
              </>
            ) : (
              <>
                {experienceSection}
                {educationSection}
              </>
            )}
          </main>
        </div>
      </div>
    </TemplateWrapper>
  );
}

function SectionTitle({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <h2
      className="text-xs font-bold uppercase tracking-[0.15em] mb-3 pb-2 border-b"
      style={{ color, borderColor: `${color}30` }}
    >
      {children}
    </h2>
  );
}
