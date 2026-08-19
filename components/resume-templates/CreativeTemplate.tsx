import React from "react";
import { TemplateProps, TemplateWrapper } from "./TemplateWrapper";
import { Mail, Phone, MapPin, Linkedin, LayoutDashboard } from "lucide-react";

export function CreativeTemplate({ profile, color = "#f97316", showPhoto, address }: TemplateProps) {
  const nameToUse = profile.socialName || profile.displayName || profile.fullName || profile.name || "Seu Nome";

  // Split name for creative styling (first name bold, rest thin)
  const nameParts = nameToUse.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ");

  return (
    <TemplateWrapper>
      <div className="font-sans text-stone-800 min-h-[297mm]">
        
        {/* Header Block with angled background */}
        <div className="relative overflow-hidden pb-8 pt-12 px-12" style={{ backgroundColor: `${color}15` }}>
          {/* Decorative element */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-bl-[100px] opacity-20 -mr-10 -mt-10" style={{ backgroundColor: color }}></div>
          
          <div className="relative z-10 flex items-center gap-8">
            {showPhoto && profile.photoURL && (
              <img src={profile.photoURL} alt="Foto de perfil" className="w-32 h-32 rounded-3xl object-cover shadow-lg transform -rotate-3 border-4 border-white" />
            )}
            <div>
              <h1 className="text-5xl tracking-tight mb-2">
                <span className="font-black" style={{ color }}>{firstName}</span> <span className="font-light text-stone-700">{lastName}</span>
              </h1>
              <p className="text-lg font-medium text-stone-600 tracking-wide uppercase">
                {profile.experiences?.[0]?.role || "Profissional Criativo"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8 p-12">
          
          {/* Main Content Column */}
          <div className="col-span-8 space-y-10">
            {/* Bio */}
            {profile.bio && (
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl" style={{ backgroundColor: `${color}20`, color }}>
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold text-stone-900">Sobre Mim</h2>
                </div>
                <p className="text-sm leading-relaxed text-stone-600">{profile.bio}</p>
              </section>
            )}

            {/* Experience */}
            {profile.experiences && profile.experiences.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow-sm" style={{ backgroundColor: color }}>
                    XP
                  </div>
                  <h2 className="text-xl font-bold text-stone-900">Experiência</h2>
                </div>
                <div className="space-y-6">
                  {profile.experiences.map((exp, idx) => (
                    <div key={idx} className="bg-stone-50 rounded-2xl p-5 border border-stone-100 break-inside-avoid shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-bold text-base text-stone-900">{exp.role}</h3>
                          <div className="text-sm font-medium" style={{ color }}>{exp.company}</div>
                        </div>
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-white text-stone-500 border border-stone-200">
                          {exp.startDate} – {exp.current ? "Atual" : exp.endDate}
                        </span>
                      </div>
                      <p className="text-sm text-stone-600 leading-relaxed mt-3">{exp.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Education */}
            {profile.education && profile.education.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow-sm" style={{ backgroundColor: color }}>
                    ED
                  </div>
                  <h2 className="text-xl font-bold text-stone-900">Educação</h2>
                </div>
                <div className="space-y-4">
                  {profile.education.map((edu, idx) => (
                    <div key={idx} className="flex gap-4 items-start break-inside-avoid">
                      <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ backgroundColor: color }}></div>
                      <div>
                        <h3 className="font-bold text-stone-900">{edu.degree} {edu.fieldOfStudy ? `em ${edu.fieldOfStudy}` : ""}</h3>
                        <div className="text-sm text-stone-600">{edu.institution}</div>
                        <div className="text-xs text-stone-400 mt-1">{edu.startYear} – {edu.current ? "Atual" : edu.endYear}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar Column */}
          <div className="col-span-4 space-y-10">
            
            {/* Contact */}
            <section>
              <h2 className="text-lg font-bold text-stone-900 mb-4 border-b-2 pb-2 inline-block" style={{ borderColor: color }}>Contato</h2>
              <ul className="space-y-4 text-sm text-stone-600">
                {profile.email && (
                  <li className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-stone-100" style={{ color }}><Mail className="w-4 h-4" /></div>
                    <span className="truncate">{profile.email}</span>
                  </li>
                )}
                {profile.phone && (
                  <li className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-stone-100" style={{ color }}><Phone className="w-4 h-4" /></div>
                    <span>{profile.phone}</span>
                  </li>
                )}
                {address && (
                  <li className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-stone-100" style={{ color }}><MapPin className="w-4 h-4" /></div>
                    <span>{address}</span>
                  </li>
                )}
                {profile.linkedinURL && (
                  <li className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-stone-100" style={{ color }}><Linkedin className="w-4 h-4" /></div>
                    <span className="truncate">{profile.linkedinURL.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '')}</span>
                  </li>
                )}
              </ul>
            </section>

            {/* Skills */}
            {profile.skills && profile.skills.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-stone-900 mb-4 border-b-2 pb-2 inline-block" style={{ borderColor: color }}>Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill, idx) => (
                    <span key={idx} className="text-xs font-bold px-3 py-1.5 rounded-xl text-white shadow-sm" style={{ backgroundColor: color }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Courses */}
            {profile.courses && profile.courses.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-stone-900 mb-4 border-b-2 pb-2 inline-block" style={{ borderColor: color }}>Cursos</h2>
                <ul className="space-y-4">
                  {profile.courses.map((course, idx) => (
                    <li key={idx} className="break-inside-avoid">
                      <div className="font-bold text-sm text-stone-900">{course.name}</div>
                      <div className="text-xs text-stone-500 mt-1">{course.institution} • {course.year}</div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </TemplateWrapper>
  );
}
