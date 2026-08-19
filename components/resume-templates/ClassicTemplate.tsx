import React from "react";
import { TemplateProps, TemplateWrapper } from "./TemplateWrapper";
import { Mail, Phone, MapPin, Linkedin } from "lucide-react";

export function ClassicTemplate({ profile, color = "#292524", showPhoto, address }: TemplateProps) {
  const nameToUse = profile.socialName || profile.displayName || profile.fullName || profile.name || "Seu Nome";
  const displayAddress = address || profile.address;
  const photoUrl = profile.resumePhotoURL || profile.photoURL;

  return (
    <TemplateWrapper>
      <div className="p-12 font-serif text-stone-900 leading-relaxed" style={{ color: "#292524" }}>
        
        {/* Header */}
        <header className="flex flex-col items-center text-center mb-8 border-b-2 pb-6" style={{ borderColor: color }}>
          {showPhoto && photoUrl && (
            <img src={photoUrl} alt="Foto de perfil" className="w-24 h-24 rounded-full object-cover mb-4 border border-stone-200" />
          )}
          <h1 className="text-3xl font-bold uppercase tracking-wider mb-2" style={{ color }}>{nameToUse}</h1>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-stone-600">
            {profile.email && (
              <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {profile.email}</span>
            )}
            {profile.phone && (
              <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {profile.phone}</span>
            )}
            {displayAddress && (
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {displayAddress}</span>
            )}
            {profile.linkedinURL && (
              <span className="flex items-center gap-1.5"><Linkedin className="w-3.5 h-3.5" /> {profile.linkedinURL.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '')}</span>
            )}
          </div>
        </header>

        {/* Resumo Profissional */}
        {profile.bio && (
          <section className="mb-8">
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 pb-1 border-b" style={{ borderColor: color, color }}>Resumo Profissional</h2>
            <p className="text-justify text-sm leading-relaxed">{profile.bio}</p>
          </section>
        )}

        {/* Experiência */}
        {profile.experiences && profile.experiences.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold uppercase tracking-wider mb-4 pb-1 border-b" style={{ borderColor: color, color }}>Experiência Profissional</h2>
            <div className="space-y-5">
              {profile.experiences.map((exp, idx) => (
                <div key={idx} className="break-inside-avoid">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-bold text-base">{exp.role}</h3>
                    <span className="text-sm font-semibold text-stone-600">{exp.startDate} – {exp.current ? "Atual" : exp.endDate}</span>
                  </div>
                  <div className="text-sm font-bold text-stone-700 italic mb-2">{exp.company}</div>
                  <p className="text-sm text-justify leading-relaxed">{exp.description}</p>
                  {exp.skills && exp.skills.length > 0 && (
                    <div className="mt-2 text-xs text-stone-500">
                      <strong>Competências: </strong> {exp.skills.join(" • ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Formação Acadêmica */}
        {profile.education && profile.education.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold uppercase tracking-wider mb-4 pb-1 border-b" style={{ borderColor: color, color }}>Formação Acadêmica</h2>
            <div className="space-y-4">
              {profile.education.map((edu, idx) => (
                <div key={idx} className="break-inside-avoid">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-bold text-base">{edu.degree} {edu.fieldOfStudy ? `em ${edu.fieldOfStudy}` : ""}</h3>
                    <span className="text-sm font-semibold text-stone-600">{edu.startYear} – {edu.current ? "Atual" : edu.endYear}</span>
                  </div>
                  <div className="text-sm font-bold text-stone-700 italic">{edu.institution}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 break-inside-avoid">
          {/* Cursos */}
          {profile.courses && profile.courses.length > 0 && (
            <section>
              <h2 className="text-lg font-bold uppercase tracking-wider mb-3 pb-1 border-b" style={{ borderColor: color, color }}>Cursos Extracurriculares</h2>
              <ul className="list-disc list-inside text-sm space-y-1.5">
                {profile.courses.map((course, idx) => (
                  <li key={idx}>
                    <span className="font-semibold">{course.name}</span>, {course.institution} ({course.year})
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Habilidades */}
          {profile.skills && profile.skills.length > 0 && (
            <section>
              <h2 className="text-lg font-bold uppercase tracking-wider mb-3 pb-1 border-b" style={{ borderColor: color, color }}>Habilidades</h2>
              <div className="flex flex-wrap gap-2 text-sm">
                {profile.skills.join(" • ")}
              </div>
            </section>
          )}
        </div>

        {/* Idiomas */}
        {profile.languages && profile.languages.length > 0 && (
          <section className="mt-8 break-inside-avoid">
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 pb-1 border-b" style={{ borderColor: color, color }}>Idiomas</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
              {profile.languages.map((lang, idx) => (
                <span key={idx}><strong>{lang.name}</strong> — {lang.level}</span>
              ))}
            </div>
          </section>
        )}
      </div>
    </TemplateWrapper>
  );
}
