import React from "react";
import { TemplateProps, TemplateWrapper } from "./TemplateWrapper";

export function MinimalistTemplate({ profile, color = "#1c1917", showPhoto, address }: TemplateProps) {
  const nameToUse = profile.socialName || profile.displayName || profile.fullName || profile.name || "Seu Nome";
  const displayAddress = address || profile.address;
  const photoUrl = profile.resumePhotoURL || profile.photoURL;

  const contactItems = [];
  if (profile.email) contactItems.push(profile.email);
  if (profile.phone) contactItems.push(profile.phone);
  if (displayAddress) contactItems.push(displayAddress);
  if (profile.linkedinURL) contactItems.push(profile.linkedinURL.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, ''));

  return (
    <TemplateWrapper>
      <div className="p-12 font-sans text-stone-800 font-light" style={{ color: "#1c1917" }}>
        
        {/* Header */}
        <header className="mb-10 flex flex-col items-start">
          <div className="flex w-full items-center justify-between mb-4">
            <h1 className="text-4xl tracking-tighter uppercase font-medium" style={{ color }}>{nameToUse}</h1>
            {showPhoto && photoUrl && (
              <img src={photoUrl} alt="Foto de perfil" className="w-20 h-20 rounded-lg object-cover grayscale opacity-90" />
            )}
          </div>
          <div className="text-sm tracking-wide text-stone-500 uppercase">
            {contactItems.join("  |  ")}
          </div>
        </header>

        {/* Bio */}
        {profile.bio && (
          <section className="mb-10">
            <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-3 font-semibold">Perfil</h2>
            <p className="text-sm leading-relaxed text-justify">{profile.bio}</p>
          </section>
        )}

        {/* Experience */}
        {profile.experiences && profile.experiences.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-5 font-semibold">Experiência Profissional</h2>
            <div className="space-y-6">
              {profile.experiences.map((exp, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-4 break-inside-avoid">
                  <div className="col-span-3 text-xs text-stone-500 pt-1">
                    {exp.startDate} — {exp.current ? "Atual" : exp.endDate}
                  </div>
                  <div className="col-span-9">
                    <h3 className="text-base font-medium text-stone-900">{exp.role}</h3>
                    <div className="text-sm text-stone-500 mb-2">{exp.company}</div>
                    <p className="text-sm leading-relaxed text-justify">{exp.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Education */}
        {profile.education && profile.education.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-5 font-semibold">Educação</h2>
            <div className="space-y-4">
              {profile.education.map((edu, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-4 break-inside-avoid">
                  <div className="col-span-3 text-xs text-stone-500 pt-1">
                    {edu.startYear} — {edu.current ? "Atual" : edu.endYear}
                  </div>
                  <div className="col-span-9">
                    <h3 className="text-base font-medium text-stone-900">{edu.degree} {edu.fieldOfStudy ? `em ${edu.fieldOfStudy}` : ""}</h3>
                    <div className="text-sm text-stone-500">{edu.institution}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-12 break-inside-avoid">
          {/* Skills */}
          {profile.skills && profile.skills.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-4 font-semibold">Habilidades</h2>
              <ul className="text-sm space-y-1.5 list-none p-0">
                {profile.skills.map((skill, idx) => (
                  <li key={idx} className="text-stone-700">{skill}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Courses */}
          {profile.courses && profile.courses.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-4 font-semibold">Cursos</h2>
              <ul className="text-sm space-y-3 list-none p-0">
                {profile.courses.map((course, idx) => (
                  <li key={idx}>
                    <div className="font-medium text-stone-900">{course.name}</div>
                    <div className="text-stone-500 text-xs">{course.institution}, {course.year}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="grid grid-cols-2 gap-12 mt-8 break-inside-avoid">
          {/* Languages */}
          {profile.languages && profile.languages.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-4 font-semibold">Idiomas</h2>
              <ul className="text-sm space-y-2 list-none p-0">
                {profile.languages.map((lang, idx) => (
                  <li key={idx}>
                    <span className="font-medium text-stone-900">{lang.name}</span> <span className="text-stone-500">— {lang.level}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Salary */}
          {profile.salaryExpectation && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-stone-400 mb-4 font-semibold">Pretensão Salarial</h2>
              <p className="text-sm text-stone-700">{profile.salaryExpectation}</p>
            </section>
          )}
        </div>

      </div>
    </TemplateWrapper>
  );
}
