import React from "react";
import {
  getExperienceStages,
  getResumeDisplayName,
  getResumeHeadline,
  TemplateProps,
  TemplateWrapper,
} from "./TemplateWrapper";
import { Mail, Phone, MapPin, Linkedin, LayoutDashboard } from "lucide-react";
import { getResumePersonalDetails } from "./ResumePersonalDetails";

export function CreativeTemplate({ profile, color = "#f97316", showPhoto, address }: TemplateProps) {
  const nameToUse = getResumeDisplayName(profile);
  const headline = getResumeHeadline(profile);
  const displayAddress = address || profile.address;
  const photoUrl = profile.resumePhotoURL || profile.photoURL;
  const personalDetails = getResumePersonalDetails(profile);
  const nameParts = nameToUse.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ");

  return (
    <TemplateWrapper>
      <div className="font-sans text-stone-800 min-h-[297mm]">
        <div className="relative overflow-hidden pb-8 pt-12 px-12" style={{ backgroundColor: `${color}15` }}>
          <div className="absolute top-0 right-0 w-64 h-64 rounded-bl-[100px] opacity-20 -mr-10 -mt-10" style={{ backgroundColor: color }} />
          <div className="relative z-10 flex items-center gap-8">
            {showPhoto && photoUrl && <img src={photoUrl} alt="Foto de perfil" className="w-32 h-32 rounded-3xl object-cover shadow-lg transform -rotate-3 border-4 border-white" />}
            <div>
              <h1 className="text-5xl tracking-tight mb-2">
                <span className="font-black" style={{ color }}>{firstName}</span>{" "}
                <span className="font-light text-stone-700">{lastName}</span>
              </h1>
              {headline && <p className="text-lg font-medium text-stone-600 tracking-wide uppercase">{headline}</p>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8 p-12">
          <div className="col-span-8 space-y-10">
            {profile.bio && (
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl" style={{ backgroundColor: `${color}20`, color }}><LayoutDashboard className="w-5 h-5" /></div>
                  <h2 className="text-xl font-bold text-stone-900">Sobre Mim</h2>
                </div>
                <p className="text-sm leading-relaxed text-stone-600">{profile.bio}</p>
              </section>
            )}

            {profile.experiences && profile.experiences.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow-sm" style={{ backgroundColor: color }}>XP</div>
                  <h2 className="text-xl font-bold text-stone-900">Experiência</h2>
                </div>
                <div className="space-y-6">
                  {profile.experiences.map((exp, idx) => {
                    const stages = getExperienceStages(exp);
                    return (
                      <div key={exp.id || idx} className="bg-stone-50 rounded-2xl p-5 border border-stone-100 break-inside-avoid shadow-sm">
                        <div className="flex justify-between items-start mb-3 gap-4">
                          <div>
                            <h3 className="font-bold text-base text-stone-900">{exp.company}</h3>
                            {stages.length > 1 && <div className="mt-1 text-xs font-bold" style={{ color }}>{stages.length} etapas na empresa</div>}
                          </div>
                          <span className="text-xs font-bold px-3 py-1 rounded-full bg-white text-stone-500 border border-stone-200 whitespace-nowrap">{exp.startDate} – {exp.current ? "Atual" : exp.endDate}</span>
                        </div>
                        {exp.description && stages.length > 1 && <p className="mb-3 text-sm leading-relaxed text-stone-600">{exp.description}</p>}
                        <div className="space-y-4">
                          {stages.map((stage, stageIdx) => (
                            <div key={stage.id || stageIdx} className="relative pl-4 border-l-2" style={{ borderColor: `${color}35` }}>
                              <div className="flex items-baseline justify-between gap-3">
                                <h4 className="font-bold text-sm text-stone-900">{stage.role}</h4>
                                <span className="text-[11px] text-stone-400 whitespace-nowrap">{stage.startDate} – {stage.current ? "Atual" : stage.endDate}</span>
                              </div>
                              {stage.description && <p className="mt-1 text-sm text-stone-600 leading-relaxed">{stage.description}</p>}
                              {stage.skills && stage.skills.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{stage.skills.map((skill) => <span key={skill} className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-stone-500 border border-stone-200">{skill}</span>)}</div>}
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
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow-sm" style={{ backgroundColor: color }}>ED</div>
                  <h2 className="text-xl font-bold text-stone-900">Educação</h2>
                </div>
                <div className="space-y-4">
                  {profile.education.map((edu, idx) => (
                    <div key={edu.id || idx} className="flex gap-4 items-start break-inside-avoid">
                      <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ backgroundColor: color }} />
                      <div>
                        <h3 className="font-bold text-stone-900">{edu.degree} {edu.fieldOfStudy ? `em ${edu.fieldOfStudy}` : ""}</h3>
                        <div className="text-sm text-stone-600">{edu.institution}</div>
                        <div className="text-xs text-stone-400 mt-1">{edu.startYear} – {edu.current ? "Atual" : edu.endYear}</div>
                        {edu.description && <p className="mt-1 text-sm text-stone-600">{edu.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="col-span-4 space-y-10">
            <section>
              <h2 className="text-lg font-bold text-stone-900 mb-4 border-b-2 pb-2 inline-block" style={{ borderColor: color }}>Contato</h2>
              <ul className="space-y-4 text-sm text-stone-600">
                {profile.email && <ContactItem color={color} icon={<Mail className="w-4 h-4" />} text={profile.email} />}
                {profile.phone && <ContactItem color={color} icon={<Phone className="w-4 h-4" />} text={profile.phone} />}
                {displayAddress && <ContactItem color={color} icon={<MapPin className="w-4 h-4" />} text={displayAddress} />}
                {profile.linkedinURL && <ContactItem color={color} icon={<Linkedin className="w-4 h-4" />} text={profile.linkedinURL.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "")} />}
              </ul>
              {personalDetails.length > 0 && (
                <div className="mt-5 border-t border-stone-200 pt-4">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Dados pessoais</p>
                  <ul className="space-y-2 text-xs font-semibold leading-5 text-stone-600">
                    {personalDetails.map((detail) => <li key={detail}>{detail}</li>)}
                  </ul>
                </div>
              )}
            </section>

            {profile.skills && profile.skills.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-stone-900 mb-4 border-b-2 pb-2 inline-block" style={{ borderColor: color }}>Skills</h2>
                <div className="flex flex-wrap gap-2">{profile.skills.map((skill) => <span key={skill} className="text-xs font-bold px-3 py-1.5 rounded-xl text-white shadow-sm" style={{ backgroundColor: color }}>{skill}</span>)}</div>
              </section>
            )}

            {profile.courses && profile.courses.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-stone-900 mb-4 border-b-2 pb-2 inline-block" style={{ borderColor: color }}>Cursos e Certificações</h2>
                <ul className="space-y-4">{profile.courses.map((course, idx) => <li key={course.id || idx} className="break-inside-avoid"><div className="font-bold text-sm text-stone-900">{course.name}</div><div className="text-xs text-stone-500 mt-1">{[course.institution, course.year].filter(Boolean).join(" • ")}</div></li>)}</ul>
              </section>
            )}

            {profile.languages && profile.languages.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-stone-900 mb-4 border-b-2 pb-2 inline-block" style={{ borderColor: color }}>Idiomas</h2>
                <ul className="space-y-3">{profile.languages.map((lang, idx) => <li key={`${lang.name}-${idx}`} className="flex justify-between items-baseline"><span className="font-bold text-sm text-stone-900">{lang.name}</span><span className="text-xs font-semibold px-2 py-1 rounded bg-stone-100 text-stone-600">{lang.level}</span></li>)}</ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </TemplateWrapper>
  );
}

function ContactItem({ icon, text, color }: { icon: React.ReactNode; text: string; color: string }) {
  return <li className="flex items-center gap-3"><div className="w-8 h-8 rounded-full flex items-center justify-center bg-stone-100" style={{ color }}>{icon}</div><span className="truncate">{text}</span></li>;
}
