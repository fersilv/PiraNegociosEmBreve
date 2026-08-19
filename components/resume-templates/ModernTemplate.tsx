import React from "react";
import { TemplateProps, TemplateWrapper } from "./TemplateWrapper";
import { Mail, Phone, MapPin, Linkedin } from "lucide-react";

export function ModernTemplate({ profile, color = "#0284c7", showPhoto, address }: TemplateProps) {
  const nameToUse = profile.socialName || profile.displayName || profile.fullName || profile.name || "Seu Nome";

  return (
    <TemplateWrapper>
      <div className="flex flex-row min-h-[297mm] font-sans text-stone-800">
        
        {/* Left Sidebar */}
        <aside className="w-1/3 bg-stone-50 p-8 border-r border-stone-200 print:bg-stone-50">
          <div className="flex flex-col items-center text-center mb-8">
            {showPhoto && profile.photoURL && (
              <img src={profile.photoURL} alt="Foto de perfil" className="w-32 h-32 rounded-full object-cover mb-6 border-4 border-white shadow-sm" />
            )}
            <h1 className="text-2xl font-black uppercase tracking-tight mb-2 leading-tight" style={{ color }}>{nameToUse}</h1>
            <p className="text-sm font-semibold text-stone-500 uppercase tracking-widest">{profile.experiences?.[0]?.role || "Profissional"}</p>
          </div>

          <div className="space-y-6">
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-4 pb-2 border-b border-stone-200">Contato</h2>
              <ul className="space-y-3 text-sm text-stone-600">
                {profile.email && (
                  <li className="flex items-start gap-3"><Mail className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} /> <span className="break-all">{profile.email}</span></li>
                )}
                {profile.phone && (
                  <li className="flex items-start gap-3"><Phone className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} /> {profile.phone}</li>
                )}
                {address && (
                  <li className="flex items-start gap-3"><MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} /> {address}</li>
                )}
                {profile.linkedinURL && (
                  <li className="flex items-start gap-3"><Linkedin className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} /> <span className="break-all">{profile.linkedinURL.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '')}</span></li>
                )}
              </ul>
            </section>

            {profile.skills && profile.skills.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-4 pb-2 border-b border-stone-200">Habilidades</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill, idx) => (
                    <span key={idx} className="bg-white border border-stone-200 text-stone-600 text-xs px-2.5 py-1 rounded-md">
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {profile.courses && profile.courses.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-4 pb-2 border-b border-stone-200">Cursos</h2>
                <ul className="space-y-3 text-sm">
                  {profile.courses.map((course, idx) => (
                    <li key={idx}>
                      <div className="font-bold text-stone-800">{course.name}</div>
                      <div className="text-stone-500 text-xs">{course.institution} • {course.year}</div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="w-2/3 p-10 bg-white">
          {profile.bio && (
            <section className="mb-10">
              <h2 className="text-xl font-black uppercase tracking-tight mb-4 flex items-center gap-3" style={{ color }}>
                <span className="w-8 h-1 rounded-full" style={{ backgroundColor: color }}></span> Perfil
              </h2>
              <p className="text-sm leading-relaxed text-stone-600 text-justify">{profile.bio}</p>
            </section>
          )}

          {profile.experiences && profile.experiences.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-3" style={{ color }}>
                <span className="w-8 h-1 rounded-full" style={{ backgroundColor: color }}></span> Experiência
              </h2>
              <div className="space-y-6">
                {profile.experiences.map((exp, idx) => (
                  <div key={idx} className="relative pl-6 border-l-2 pb-2" style={{ borderColor: `${color}40` }}>
                    <div className="absolute w-3 h-3 rounded-full -left-[7px] top-1.5" style={{ backgroundColor: color }}></div>
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-bold text-base text-stone-900">{exp.role}</h3>
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-stone-100 text-stone-500 uppercase tracking-wider">{exp.startDate} – {exp.current ? "Atual" : exp.endDate}</span>
                    </div>
                    <div className="text-sm font-semibold mb-2" style={{ color }}>{exp.company}</div>
                    <p className="text-sm text-stone-600 leading-relaxed text-justify">{exp.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {profile.education && profile.education.length > 0 && (
            <section>
              <h2 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-3" style={{ color }}>
                <span className="w-8 h-1 rounded-full" style={{ backgroundColor: color }}></span> Educação
              </h2>
              <div className="space-y-5">
                {profile.education.map((edu, idx) => (
                  <div key={idx} className="relative pl-6 border-l-2" style={{ borderColor: `${color}40` }}>
                    <div className="absolute w-3 h-3 rounded-full -left-[7px] top-1.5" style={{ backgroundColor: color }}></div>
                    <h3 className="font-bold text-base text-stone-900">{edu.degree} {edu.fieldOfStudy ? `em ${edu.fieldOfStudy}` : ""}</h3>
                    <div className="text-sm font-semibold mb-1" style={{ color }}>{edu.institution}</div>
                    <div className="text-xs font-bold text-stone-500 uppercase tracking-wider">{edu.startYear} – {edu.current ? "Atual" : edu.endYear}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </TemplateWrapper>
  );
}
