import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  FileText,
  GraduationCap,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  UserRoundSearch,
} from "lucide-react";
import {
  AcademicEducation,
  ExtraCourse,
  ProfessionalExperience,
  getGreetingName,
  useAuth,
} from "../contexts/AuthContext";
import { api } from "../lib/api";

const emptyExperience: ProfessionalExperience = {
  company: "",
  role: "",
  startDate: "",
  endDate: "",
  current: false,
  description: "",
  skills: [],
};

const emptyEducation: AcademicEducation = {
  institution: "",
  degree: "",
  fieldOfStudy: "",
  startYear: "",
  endYear: "",
  current: false,
  status: "CONCLUIDO",
  description: "",
  skills: [],
};

const emptyCourse: ExtraCourse = {
  name: "",
  institution: "",
  year: "",
  type: "COURSE",
  description: "",
  skills: [],
};

export function UserProfessionalProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [bio, setBio] = useState("");
  const [linkedinURL, setLinkedinURL] = useState("");
  const [isOpenToWork, setIsOpenToWork] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [experiences, setExperiences] = useState<ProfessionalExperience[]>([]);
  const [education, setEducation] = useState<AcademicEducation[]>([]);
  const [courses, setCourses] = useState<ExtraCourse[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [experienceEditor, setExperienceEditor] = useState<number | "new" | null>(null);
  const [experienceDraft, setExperienceDraft] = useState<ProfessionalExperience>(emptyExperience);
  const [educationEditor, setEducationEditor] = useState<number | "new" | null>(null);
  const [educationDraft, setEducationDraft] = useState<AcademicEducation>(emptyEducation);
  const [courseEditor, setCourseEditor] = useState<number | "new" | null>(null);
  const [courseDraft, setCourseDraft] = useState<ExtraCourse>(emptyCourse);

  useEffect(() => {
    if (!profile) return;
    setBio(profile.bio || "");
    setLinkedinURL(profile.linkedinURL || "");
    setIsOpenToWork(Boolean(profile.isOpenToWork));
    setSkills(profile.skills || []);
    setExperiences(profile.experiences || []);
    setEducation(profile.education || []);
    setCourses(profile.courses || []);
    setDirty(false);
  }, [profile]);

  const readiness = useMemo(() => {
    let score = 10;
    if (bio.trim()) score += 20;
    if (experiences.length) score += 30;
    if (skills.length >= 3) score += 15;
    if (education.length) score += 10;
    if (courses.length) score += 5;
    if (linkedinURL.trim()) score += 5;
    if (profile?.resumeURL || profile?.resumePreferences) score += 5;
    return Math.min(100, score);
  }, [bio, experiences, skills, education, courses, linkedinURL, profile?.resumeURL, profile?.resumePreferences]);

  const markDirty = () => {
    setDirty(true);
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/users/me", {
        bio: bio.trim(),
        linkedinURL: linkedinURL.trim(),
        isOpenToWork,
        skills,
        experiences,
        education,
        courses,
      });
      await refreshProfile();
      setDirty(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2400);
    } catch (error) {
      console.error("Erro ao salvar perfil profissional:", error);
      alert("Não foi possível salvar seu perfil profissional agora.");
    } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    const skill = newSkill.trim().replace(/\s+/g, " ");
    if (!skill) return;
    if (skills.some((item) => item.localeCompare(skill, "pt-BR", { sensitivity: "base" }) === 0)) {
      setNewSkill("");
      return;
    }
    setSkills((current) => [...current, skill]);
    setNewSkill("");
    markDirty();
  };

  const openExperience = (index?: number) => {
    if (typeof index === "number") {
      setExperienceEditor(index);
      setExperienceDraft({ ...experiences[index], skills: experiences[index].skills || [] });
    } else {
      setExperienceEditor("new");
      setExperienceDraft({ ...emptyExperience });
    }
  };

  const commitExperience = () => {
    if (!experienceDraft.company.trim() || !experienceDraft.role.trim() || !experienceDraft.startDate.trim()) {
      alert("Preencha empresa, cargo e início da experiência.");
      return;
    }
    const normalized = {
      ...experienceDraft,
      company: experienceDraft.company.trim(),
      role: experienceDraft.role.trim(),
      description: experienceDraft.description?.trim() || "",
      endDate: experienceDraft.current ? "Atual" : experienceDraft.endDate?.trim() || "",
    };
    setExperiences((current) => experienceEditor === "new" ? [...current, normalized] : current.map((item, index) => index === experienceEditor ? normalized : item));
    setExperienceEditor(null);
    markDirty();
  };

  const openEducation = (index?: number) => {
    if (typeof index === "number") {
      setEducationEditor(index);
      setEducationDraft({ ...education[index], skills: education[index].skills || [] });
    } else {
      setEducationEditor("new");
      setEducationDraft({ ...emptyEducation });
    }
  };

  const commitEducation = () => {
    if (!educationDraft.institution.trim() || !educationDraft.degree.trim()) {
      alert("Preencha instituição e formação.");
      return;
    }
    const normalized = {
      ...educationDraft,
      institution: educationDraft.institution.trim(),
      degree: educationDraft.degree.trim(),
      fieldOfStudy: educationDraft.fieldOfStudy.trim(),
      endYear: educationDraft.current ? "Atual" : educationDraft.endYear.trim(),
    };
    setEducation((current) => educationEditor === "new" ? [...current, normalized] : current.map((item, index) => index === educationEditor ? normalized : item));
    setEducationEditor(null);
    markDirty();
  };

  const openCourse = (index?: number) => {
    if (typeof index === "number") {
      setCourseEditor(index);
      setCourseDraft({ ...courses[index], skills: courses[index].skills || [] });
    } else {
      setCourseEditor("new");
      setCourseDraft({ ...emptyCourse });
    }
  };

  const commitCourse = () => {
    if (!courseDraft.name.trim()) {
      alert("Informe o nome do curso ou certificação.");
      return;
    }
    const normalized = {
      ...courseDraft,
      name: courseDraft.name.trim(),
      institution: courseDraft.institution.trim(),
      year: courseDraft.year.trim(),
    };
    setCourses((current) => courseEditor === "new" ? [...current, normalized] : current.map((item, index) => index === courseEditor ? normalized : item));
    setCourseEditor(null);
    markDirty();
  };

  if (!profile) return <div className="flex min-h-[45vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-terracotta-600" /></div>;

  const name = profile.socialName || profile.displayName || profile.fullName || profile.name || getGreetingName(profile);

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-6 sm:space-y-6 md:pb-0">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-terracotta-600 sm:text-[10px]">Carreira · Perfil</p>
          <h1 className="mt-1 font-serif text-[32px] font-bold leading-[1.02] tracking-[-.025em] text-stone-950 sm:text-4xl">Seu perfil profissional</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">O que empresas e oportunidades usam para entender sua trajetória.</p>
        </div>
        <div className="hidden gap-2 sm:flex">
          <Link to="/user/preferencias" className="rounded-xl border border-stone-200 bg-white/75 px-4 py-2.5 text-xs font-bold text-stone-600">Preferências</Link>
          <Link to="/user/configuracoes" className="rounded-xl border border-stone-200 bg-white/75 px-4 py-2.5 text-xs font-bold text-stone-600">Configurações</Link>
        </div>
      </header>

      <section className="overflow-hidden rounded-[26px] border border-[#5b4030]/10 bg-[#2b211c] p-5 text-white shadow-[0_20px_60px_rgba(52,32,22,.14)] sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10 text-[#f0b99d]">
            {profile.photoURL ? <img src={profile.photoURL} alt="" className="h-full w-full object-cover" /> : <UserRoundSearch className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-serif text-xl font-bold sm:text-2xl">{name}</h2>
              {isOpenToWork && <span className="rounded-full bg-emerald-300 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-950">Buscando oportunidades</span>}
            </div>
            <p className="mt-1 text-xs text-white/45">Perfil {readiness}% completo</p>
          </div>
          <span className="text-xl font-black text-[#f0b99d]">{readiness}%</span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#e8ad8d]" style={{ width: `${readiness}%` }} /></div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white/[.055] px-3.5 py-3 text-xs font-bold text-white/75">
            <input type="checkbox" checked={isOpenToWork} onChange={(event) => { setIsOpenToWork(event.target.checked); markDirty(); }} className="h-4 w-4 accent-emerald-500" />
            Estou buscando oportunidades
          </label>
          <Link to="/user/curriculo" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f0c2a9] px-4 py-3 text-xs font-black text-[#342119]">Abrir meu currículo <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
        <ProfileSection icon={<Sparkles className="h-4 w-4" />} title="Resumo profissional" subtitle="Uma apresentação curta da sua trajetória.">
          <textarea value={bio} onChange={(event) => { setBio(event.target.value); markDirty(); }} rows={5} placeholder="Conte sua experiência, principais competências e o tipo de desafio profissional que busca." className="w-full resize-y rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm leading-6 outline-none" />
          <label className="mt-3 block"><span className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-stone-400"><Link2 className="h-3.5 w-3.5" /> LinkedIn</span><input type="url" value={linkedinURL} onChange={(event) => { setLinkedinURL(event.target.value); markDirty(); }} placeholder="https://linkedin.com/in/..." className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none" /></label>
        </ProfileSection>

        <ProfileSection icon={<Sparkles className="h-4 w-4" />} title="Competências" subtitle="Use palavras que realmente descrevem o que você sabe fazer.">
          <div className="flex flex-wrap gap-2">{skills.length ? skills.map((skill) => <span key={skill} className="inline-flex items-center gap-1.5 rounded-full border border-terracotta-200 bg-terracotta-50 px-3 py-1.5 text-xs font-bold text-terracotta-800">{skill}<button type="button" onClick={() => { setSkills((current) => current.filter((item) => item !== skill)); markDirty(); }} aria-label={`Remover ${skill}`} className="text-terracotta-500 hover:text-red-600">×</button></span>) : <p className="text-sm text-stone-400">Nenhuma competência cadastrada ainda.</p>}</div>
          <div className="mt-4 flex gap-2"><input value={newSkill} onChange={(event) => setNewSkill(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSkill(); } }} placeholder="Ex.: Atendimento ao cliente" className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none" /><button type="button" onClick={addSkill} disabled={!newSkill.trim()} className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-900 text-white disabled:opacity-30"><Plus className="h-4 w-4" /></button></div>
        </ProfileSection>
      </section>

      <ProfileSection icon={<BriefcaseBusiness className="h-4 w-4" />} title="Experiência" subtitle="Mostre onde trabalhou, em qual função e o que realizou." action={<button type="button" onClick={() => openExperience()} className="section-action"><Plus className="h-3.5 w-3.5" /> Adicionar</button>}>
        {experienceEditor !== null && <ExperienceEditor draft={experienceDraft} setDraft={setExperienceDraft} onCancel={() => setExperienceEditor(null)} onSave={commitExperience} />}
        <div className="mt-2 divide-y divide-stone-100">{experiences.length ? experiences.map((experience, index) => <div key={`${experience.company}-${experience.role}-${index}`} className="py-4 first:pt-0 last:pb-0"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h3 className="font-bold text-stone-950">{experience.role}</h3><p className="mt-0.5 text-sm font-semibold text-terracotta-700">{experience.company}</p><p className="mt-1 text-xs text-stone-400">{experience.startDate} → {experience.current ? "Atual" : experience.endDate || "Não informado"}</p>{experience.description && <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-600">{experience.description}</p>}</div><div className="flex gap-1"><IconButton label="Editar" onClick={() => openExperience(index)}><Pencil className="h-3.5 w-3.5" /></IconButton><IconButton label="Excluir" danger onClick={() => { setExperiences((current) => current.filter((_, itemIndex) => itemIndex !== index)); markDirty(); }}><Trash2 className="h-3.5 w-3.5" /></IconButton></div></div></div>) : <EmptyText>Adicione sua experiência mais relevante para começar.</EmptyText>}</div>
      </ProfileSection>

      <section className="grid gap-4 lg:grid-cols-2">
        <ProfileSection icon={<GraduationCap className="h-4 w-4" />} title="Formação" subtitle="Graduação, técnico, tecnólogo ou outras formações." action={<button type="button" onClick={() => openEducation()} className="section-action"><Plus className="h-3.5 w-3.5" /> Adicionar</button>}>
          {educationEditor !== null && <EducationEditor draft={educationDraft} setDraft={setEducationDraft} onCancel={() => setEducationEditor(null)} onSave={commitEducation} />}
          <div className="divide-y divide-stone-100">{education.length ? education.map((item, index) => <div key={`${item.institution}-${index}`} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"><div className="min-w-0 flex-1"><h3 className="font-bold text-stone-950">{item.degree}{item.fieldOfStudy ? ` · ${item.fieldOfStudy}` : ""}</h3><p className="mt-1 text-sm text-stone-600">{item.institution}</p><p className="mt-1 text-xs text-stone-400">{item.startYear}{item.startYear || item.endYear ? " → " : ""}{item.current ? "Atual" : item.endYear}</p></div><div className="flex gap-1"><IconButton label="Editar" onClick={() => openEducation(index)}><Pencil className="h-3.5 w-3.5" /></IconButton><IconButton label="Excluir" danger onClick={() => { setEducation((current) => current.filter((_, itemIndex) => itemIndex !== index)); markDirty(); }}><Trash2 className="h-3.5 w-3.5" /></IconButton></div></div>) : <EmptyText>Nenhuma formação cadastrada.</EmptyText>}</div>
        </ProfileSection>

        <ProfileSection icon={<FileText className="h-4 w-4" />} title="Cursos e certificações" subtitle="Complementos que reforçam seu repertório profissional." action={<button type="button" onClick={() => openCourse()} className="section-action"><Plus className="h-3.5 w-3.5" /> Adicionar</button>}>
          {courseEditor !== null && <CourseEditor draft={courseDraft} setDraft={setCourseDraft} onCancel={() => setCourseEditor(null)} onSave={commitCourse} />}
          <div className="divide-y divide-stone-100">{courses.length ? courses.map((course, index) => <div key={`${course.name}-${index}`} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"><div className="min-w-0 flex-1"><h3 className="font-bold text-stone-950">{course.name}</h3><p className="mt-1 text-sm text-stone-600">{[course.institution, course.year].filter(Boolean).join(" · ")}</p></div><div className="flex gap-1"><IconButton label="Editar" onClick={() => openCourse(index)}><Pencil className="h-3.5 w-3.5" /></IconButton><IconButton label="Excluir" danger onClick={() => { setCourses((current) => current.filter((_, itemIndex) => itemIndex !== index)); markDirty(); }}><Trash2 className="h-3.5 w-3.5" /></IconButton></div></div>) : <EmptyText>Nenhum curso ou certificação cadastrado.</EmptyText>}</div>
        </ProfileSection>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <QuickLink to="/user/curriculo" icon={<FileText className="h-4 w-4" />} title="Currículo" text="Gerar, importar e imprimir" />
        <QuickLink to="/user/preferencias" icon={<BriefcaseBusiness className="h-4 w-4" />} title="Preferências" text="Cidades, CNH, veículo e PCD" />
        <QuickLink to="/user/configuracoes" icon={<UserRoundSearch className="h-4 w-4" />} title="Configurações" text="Nome, foto e contato" />
      </section>

      {(dirty || saving || saved) && <div className="sticky bottom-[82px] z-20 flex items-center justify-between gap-3 rounded-2xl border border-[#5b4030]/10 bg-[#fffdfa]/95 p-3 shadow-[0_14px_45px_rgba(49,31,22,.18)] backdrop-blur-xl md:bottom-4"><div className="min-w-0">{saved ? <p className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><Check className="h-4 w-4" /> Perfil salvo</p> : <p className="truncate text-xs font-semibold text-stone-500">{saving ? "Salvando alterações..." : "Você tem alterações não salvas"}</p>}</div><button type="button" onClick={() => void save()} disabled={saving || !dirty} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#2b211c] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar</button></div>}

      <style>{`
        .section-action{display:inline-flex;align-items:center;gap:6px;border:1px solid #e7e5e4;border-radius:10px;background:#fff;padding:8px 10px;font-size:11px;font-weight:800;color:#57534e}
        .profile-edit-field{width:100%;border:1px solid #e7e5e4;border-radius:12px;background:#fff;padding:10px 12px;font-size:13px;outline:none}
        .profile-edit-field:focus{border-color:#c96847;box-shadow:0 0 0 3px rgba(201,104,71,.08)}
      `}</style>
    </div>
  );
}

function ProfileSection({ icon, title, subtitle, action, children }: { icon: React.ReactNode; title: string; subtitle: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-[24px] border border-[#5b4030]/10 bg-[#fffdfa] p-4 shadow-[0_12px_36px_rgba(61,40,28,.045)] sm:p-5"><div className="mb-4 flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f1dfd3] text-terracotta-700">{icon}</span><div className="min-w-0 flex-1"><h2 className="font-serif text-lg font-bold text-stone-950">{title}</h2><p className="mt-0.5 text-xs leading-5 text-stone-400">{subtitle}</p></div>{action}</div>{children}</section>;
}

function QuickLink({ to, icon, title, text }: { to: string; icon: React.ReactNode; title: string; text: string }) {
  return <Link to={to} className="flex items-center gap-3 rounded-2xl border border-[#5b4030]/10 bg-white/70 p-4 shadow-sm"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f1dfd3] text-terracotta-700">{icon}</span><span className="min-w-0 flex-1"><strong className="block text-sm text-stone-900">{title}</strong><span className="mt-0.5 block text-[11px] text-stone-400">{text}</span></span><ArrowRight className="h-4 w-4 text-stone-300" /></Link>;
}

function IconButton({ label, onClick, danger = false, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} title={label} aria-label={label} className={`flex h-8 w-8 items-center justify-center rounded-lg border ${danger ? "border-red-100 text-red-500 hover:bg-red-50" : "border-stone-200 text-stone-400 hover:bg-stone-50 hover:text-stone-700"}`}>{children}</button>;
}

function EmptyText({ children }: { children: React.ReactNode }) { return <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/60 px-4 py-6 text-center text-sm text-stone-400">{children}</div>; }

function ExperienceEditor({ draft, setDraft, onCancel, onSave }: { draft: ProfessionalExperience; setDraft: React.Dispatch<React.SetStateAction<ProfessionalExperience>>; onCancel: () => void; onSave: () => void }) {
  return <div className="mb-4 rounded-2xl border border-terracotta-200 bg-terracotta-50/40 p-4"><div className="grid gap-3 sm:grid-cols-2"><input className="profile-edit-field" value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))} placeholder="Cargo *" /><input className="profile-edit-field" value={draft.company} onChange={(event) => setDraft((current) => ({ ...current, company: event.target.value }))} placeholder="Empresa *" /><input className="profile-edit-field" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} placeholder="Início *" /><input className="profile-edit-field" disabled={draft.current} value={draft.current ? "" : draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} placeholder="Fim" /></div><label className="mt-3 flex items-center gap-2 text-xs font-bold text-stone-600"><input type="checkbox" checked={draft.current} onChange={(event) => setDraft((current) => ({ ...current, current: event.target.checked }))} /> Trabalho aqui atualmente</label><textarea className="profile-edit-field mt-3 min-h-24 resize-y" value={draft.description || ""} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Principais atividades e resultados" /><EditorActions onCancel={onCancel} onSave={onSave} /></div>;
}

function EducationEditor({ draft, setDraft, onCancel, onSave }: { draft: AcademicEducation; setDraft: React.Dispatch<React.SetStateAction<AcademicEducation>>; onCancel: () => void; onSave: () => void }) {
  return <div className="mb-4 rounded-2xl border border-terracotta-200 bg-terracotta-50/40 p-4"><div className="grid gap-3 sm:grid-cols-2"><input className="profile-edit-field" value={draft.degree} onChange={(event) => setDraft((current) => ({ ...current, degree: event.target.value }))} placeholder="Formação *" /><input className="profile-edit-field" value={draft.fieldOfStudy} onChange={(event) => setDraft((current) => ({ ...current, fieldOfStudy: event.target.value }))} placeholder="Área / curso" /><input className="profile-edit-field sm:col-span-2" value={draft.institution} onChange={(event) => setDraft((current) => ({ ...current, institution: event.target.value }))} placeholder="Instituição *" /><input className="profile-edit-field" value={draft.startYear} onChange={(event) => setDraft((current) => ({ ...current, startYear: event.target.value }))} placeholder="Início" /><input className="profile-edit-field" disabled={draft.current} value={draft.current ? "" : draft.endYear} onChange={(event) => setDraft((current) => ({ ...current, endYear: event.target.value }))} placeholder="Conclusão" /></div><label className="mt-3 flex items-center gap-2 text-xs font-bold text-stone-600"><input type="checkbox" checked={draft.current} onChange={(event) => setDraft((current) => ({ ...current, current: event.target.checked, status: event.target.checked ? "EM_ANDAMENTO" : current.status }))} /> Em andamento</label><EditorActions onCancel={onCancel} onSave={onSave} /></div>;
}

function CourseEditor({ draft, setDraft, onCancel, onSave }: { draft: ExtraCourse; setDraft: React.Dispatch<React.SetStateAction<ExtraCourse>>; onCancel: () => void; onSave: () => void }) {
  return <div className="mb-4 rounded-2xl border border-terracotta-200 bg-terracotta-50/40 p-4"><div className="grid gap-3 sm:grid-cols-2"><input className="profile-edit-field sm:col-span-2" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Curso ou certificação *" /><input className="profile-edit-field" value={draft.institution} onChange={(event) => setDraft((current) => ({ ...current, institution: event.target.value }))} placeholder="Instituição" /><input className="profile-edit-field" value={draft.year} onChange={(event) => setDraft((current) => ({ ...current, year: event.target.value }))} placeholder="Ano" /></div><EditorActions onCancel={onCancel} onSave={onSave} /></div>;
}

function EditorActions({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  return <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-500">Cancelar</button><button type="button" onClick={onSave} className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-black text-white">Aplicar</button></div>;
}
