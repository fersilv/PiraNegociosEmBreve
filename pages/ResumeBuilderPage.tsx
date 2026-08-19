import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth, UserProfile, ProfessionalExperience, ExtraCourse, AcademicEducation, Language } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Printer, Settings, Check, Layout, Palette,
  Camera, MapPin, Plus, Trash2, Briefcase, GraduationCap, BookOpen,
  Globe, User, FileText, Sparkles, Loader2, Upload, ChevronDown
} from "lucide-react";
import { ClassicTemplate } from "../components/resume-templates/ClassicTemplate";
import { ModernTemplate } from "../components/resume-templates/ModernTemplate";
import { MinimalistTemplate } from "../components/resume-templates/MinimalistTemplate";
import { CreativeTemplate } from "../components/resume-templates/CreativeTemplate";
import { CityStateSelector } from "../components/CityStateSelector";
import { FileUpload } from "../components/FileUpload";
import { SearchSelect } from "../components/SearchSelect";

const TEMPLATES = [
  { id: "modern", name: "Moderno" },
  { id: "creative", name: "Criativo" },
  { id: "classic", name: "Clássico" },
  { id: "minimalist", name: "Minimalista" },
] as const;

const ACCENT_COLORS = [
  { hex: "#0284c7", name: "Azul" },
  { hex: "#f97316", name: "Laranja" },
  { hex: "#16a34a", name: "Verde" },
  { hex: "#dc2626", name: "Vermelho" },
  { hex: "#7c3aed", name: "Roxo" },
  { hex: "#292524", name: "Escuro" },
  { hex: "#0f766e", name: "Teal" },
];

const LANGUAGE_LEVELS = ["Básico", "Intermediário", "Avançado", "Fluente", "Nativo"];

type TemplateId = (typeof TEMPLATES)[number]["id"];

// Check if profile has meaningful data to show in a resume
function profileHasData(p: UserProfile | null): boolean {
  if (!p) return false;
  return !!(
    p.bio ||
    (p.experiences && p.experiences.length > 0) ||
    (p.education && p.education.length > 0) ||
    (p.skills && p.skills.length > 0) ||
    (p.courses && p.courses.length > 0)
  );
}

export function ResumeBuilderPage() {
  const { profile, loading, refreshProfile } = useAuth();
  const [step, setStep] = useState(-1); // -1 = deciding, 0+ = wizard steps
  const [isFirstJob, setIsFirstJob] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Wizard form state
  const [formName, setFormName] = useState("");
  const [formSocialName, setFormSocialName] = useState("");
  const [formBirthDate, setFormBirthDate] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formPhoto, setFormPhoto] = useState("");
  const [formBio, setFormBio] = useState("");
  const [formSalary, setFormSalary] = useState("");
  const [formExperiences, setFormExperiences] = useState<ProfessionalExperience[]>([]);
  const [formEducation, setFormEducation] = useState<AcademicEducation[]>([]);
  const [formSkills, setFormSkills] = useState<string[]>([]);
  const [formCourses, setFormCourses] = useState<ExtraCourse[]>([]);
  const [formLanguages, setFormLanguages] = useState<Language[]>([]);

  // Preview state
  const [template, setTemplate] = useState<TemplateId>("modern");
  const [color, setColor] = useState("#0284c7");
  const [showPhoto, setShowPhoto] = useState(true);
  const [scale, setScale] = useState(1);
  const previewRef = useRef<HTMLDivElement>(null);

  // Temporary form fields for adding new items
  const [newSkill, setNewSkill] = useState("");

  // Initialize form from profile
  useEffect(() => {
    if (profile) {
      setFormName(profile.fullName || profile.name || "");
      setFormSocialName(profile.socialName || "");
      
      let initialBirthDate = "";
      if (profile.birthDate) {
        if (profile.birthDate instanceof Date) {
          initialBirthDate = profile.birthDate.toISOString().split("T")[0];
        } else if (typeof profile.birthDate === "string") {
          initialBirthDate = profile.birthDate.split("T")[0];
        }
      }
      setFormBirthDate(initialBirthDate);

      setFormPhone(profile.phone || "");
      setFormEmail(profile.email || "");
      setFormAddress(profile.address || "");
      setFormPhoto(profile.resumePhotoURL || "");
      setFormBio(profile.bio || "");
      setFormSalary(profile.salaryExpectation || "");
      setFormExperiences(profile.experiences || []);
      setFormEducation(profile.education || []);
      setFormSkills(profile.skills || []);
      setFormCourses(profile.courses || []);
      setFormLanguages(profile.languages || []);

      // If profile already has data, go straight to preview
      if (profileHasData(profile)) {
        setStep(99); // preview
      }
    }
  }, [profile]);

  // Scale calculation for responsive A4 preview
  const recalcScale = useCallback(() => {
    if (!previewRef.current) return;
    const available = previewRef.current.clientWidth - 16;
    setScale(available < 794 ? available / 794 : 1);
  }, []);

  useEffect(() => {
    recalcScale();
    window.addEventListener("resize", recalcScale);
    return () => window.removeEventListener("resize", recalcScale);
  }, [recalcScale, step]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-stone-500">Carregando...</div>;
  if (!profile) return <Navigate to="/login" replace />;

  // Save current form data to the profile
  const saveProgress = async () => {
    setSaving(true);
    try {
      await api.patch("/users/me", {
        fullName: formName,
        socialName: formSocialName,
        birthDate: formBirthDate || null,
        phone: formPhone,
        address: formAddress,
        resumePhotoURL: formPhoto || undefined,
        bio: formBio,
        salaryExpectation: formSalary || undefined,
        experiences: formExperiences,
        education: formEducation,
        skills: formSkills,
        courses: formCourses,
        languages: formLanguages.length > 0 ? formLanguages : undefined,
      });
      await refreshProfile();
    } catch (e) {
      console.error("Erro ao salvar progresso:", e);
    } finally {
      setSaving(false);
    }
  };

  const nextStep = async () => {
    await saveProgress();
    setStep((s) => s + 1);
  };

  const prevStep = () => setStep((s) => Math.max(-1, s - 1));

  const goToPreview = async () => {
    await saveProgress();
    setStep(99);
  };

  // Steps definition (dynamic based on isFirstJob)
  const STEPS = [
    { id: "personal", label: "Dados Pessoais", icon: <User className="w-4 h-4" /> },
    ...(isFirstJob ? [] : [{ id: "experience", label: "Experiência", icon: <Briefcase className="w-4 h-4" /> }]),
    { id: "education", label: "Formação", icon: <GraduationCap className="w-4 h-4" /> },
    { id: "skills", label: "Habilidades", icon: <Sparkles className="w-4 h-4" /> },
    { id: "courses", label: "Cursos", icon: <BookOpen className="w-4 h-4" /> },
    { id: "languages", label: "Idiomas", icon: <Globe className="w-4 h-4" /> },
    { id: "about", label: "Sobre Você", icon: <FileText className="w-4 h-4" /> },
  ];

  const currentStepIndex = step; // 0-indexed
  const totalSteps = STEPS.length;
  const isLastWizardStep = currentStepIndex >= totalSteps - 1;

  // Build a synthetic profile from form state for preview
  const previewProfile: UserProfile = {
    ...profile,
    fullName: formName,
    socialName: formSocialName,
    name: formName,
    birthDate: formBirthDate,
    phone: formPhone,
    email: formEmail,
    address: formAddress,
    resumePhotoURL: formPhoto,
    photoURL: formPhoto || profile.photoURL,
    bio: formBio,
    salaryExpectation: formSalary,
    experiences: formExperiences,
    education: formEducation,
    skills: formSkills,
    courses: formCourses,
    languages: formLanguages,
  };

  const renderTemplate = () => {
    const props = { profile: previewProfile, color, showPhoto, isFirstJob };
    switch (template) {
      case "classic":     return <ClassicTemplate {...props} />;
      case "minimalist":  return <MinimalistTemplate {...props} />;
      case "creative":    return <CreativeTemplate {...props} />;
      case "modern":
      default:            return <ModernTemplate {...props} />;
    }
  };

  // ─── AI Upload Handler ───
  const handleAiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const resp = await fetch("/api/ai/analyze-resume", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${await (await import("../lib/firebase")).auth.currentUser?.getIdToken()}` },
          body: JSON.stringify({ base64File: base64, mimeType: file.type }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.name) setFormName(data.name);
          if (data.phone) setFormPhone(data.phone);
          if (data.bio) setFormBio(data.bio);
          if (data.experiences) setFormExperiences(data.experiences);
          if (data.education) setFormEducation(data.education);
          if (data.skills) setFormSkills(data.skills);
          if (data.courses) setFormCourses(data.courses);
          setStep(0); // Go to first step to review
        } else {
          alert("Não foi possível analisar o currículo. Tente novamente.");
        }
        setAiLoading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setAiLoading(false);
      alert("Erro ao processar o arquivo.");
    }
  };

  // ─── STEP -1: INTRO SCREEN ───
  if (step === -1) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 rounded-3xl bg-terracotta-100 flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-terracotta-600" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-900 mb-3">Vamos criar seu currículo!</h1>
          <p className="text-stone-500 mb-10 leading-relaxed">
            Responda algumas perguntas e nós montamos um currículo profissional pra você em minutos.
          </p>

          {/* AI Upload Option */}
          <div className="bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-200 rounded-2xl p-5 mb-8 text-left">
            <h3 className="font-bold text-violet-900 flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-violet-500" /> Atalho com Inteligência Artificial
            </h3>
            <p className="text-sm text-violet-700 mb-3">
              Já tem um currículo em PDF? Envie e nossa IA preencherá todos os campos automaticamente para você apenas revisar.
            </p>
            <label className="relative cursor-pointer inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors shadow-sm">
              <Upload className="w-4 h-4" />
              {aiLoading ? "Analisando..." : "Enviar Currículo Existente"}
              <input type="file" accept=".pdf,image/*" onChange={handleAiUpload} className="hidden" disabled={aiLoading} />
            </label>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <div className="h-px flex-1 bg-stone-200" />
            <span className="text-sm text-stone-400 font-medium">ou preencha manualmente</span>
            <div className="h-px flex-1 bg-stone-200" />
          </div>

          <h2 className="text-lg font-bold text-stone-900 mb-4">Este é o seu primeiro emprego?</h2>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => { setIsFirstJob(true); setStep(0); }}
              className="flex-1 py-4 px-6 bg-white border-2 border-stone-200 rounded-2xl font-bold text-stone-700 hover:border-terracotta-400 hover:bg-terracotta-50 transition-all"
            >
              Sim, é meu primeiro emprego
            </button>
            <button
              onClick={() => { setIsFirstJob(false); setStep(0); }}
              className="flex-1 py-4 px-6 bg-white border-2 border-stone-200 rounded-2xl font-bold text-stone-700 hover:border-terracotta-400 hover:bg-terracotta-50 transition-all"
            >
              Não, já tenho experiência
            </button>
          </div>

          <Link to="/dashboard" className="mt-8 inline-flex items-center gap-2 text-sm text-stone-400 hover:text-stone-600">
            <ArrowLeft className="w-4 h-4" /> Voltar ao painel
          </Link>
        </div>
      </div>
    );
  }

  // ─── STEP 99: PREVIEW ───
  if (step === 99) {
    return (
      <>
        <div className="min-h-screen bg-stone-100 flex flex-col md:flex-row" id="resume-builder-root">
          <aside id="resume-builder-sidebar" className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-stone-200 flex flex-col md:h-screen md:sticky md:top-0 z-10 shrink-0">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-3">
              <button onClick={() => setStep(0)} className="flex items-center gap-2 text-stone-600 hover:text-terracotta-600 font-medium text-sm">
                <ArrowLeft className="w-4 h-4" /> Editar Dados
              </button>
              <button onClick={() => window.print()} className="bg-terracotta-600 hover:bg-terracotta-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm shadow-sm transition-colors">
                <Printer className="w-4 h-4" /> Exportar PDF
              </button>
            </div>
            <div className="p-5 md:p-6 flex-1 overflow-y-auto space-y-7">
              <section>
                <h2 className="text-xs font-bold text-stone-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Layout className="w-4 h-4 text-stone-400" /> Modelos
                </h2>
                <div className="grid grid-cols-2 gap-2.5">
                  {TEMPLATES.map((tpl) => (
                    <button key={tpl.id} onClick={() => setTemplate(tpl.id)} className={`py-2.5 px-2 border-2 rounded-xl text-sm font-bold transition-all ${template === tpl.id ? "border-terracotta-600 text-terracotta-700 bg-terracotta-50" : "border-stone-200 text-stone-600 hover:border-stone-300 bg-white"}`}>{tpl.name}</button>
                  ))}
                </div>
              </section>
              <section>
                <h2 className="text-xs font-bold text-stone-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-stone-400" /> Cor de Destaque
                </h2>
                <div className="flex flex-wrap gap-2.5">
                  {ACCENT_COLORS.map((c) => (
                    <button key={c.hex} onClick={() => setColor(c.hex)} className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-sm" style={{ backgroundColor: c.hex }} title={c.name}>
                      {color === c.hex && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h2 className="text-xs font-bold text-stone-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-stone-400" /> Opções
                </h2>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`w-10 h-6 rounded-full transition-colors flex items-center p-1 ${showPhoto ? "bg-terracotta-500" : "bg-stone-300"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${showPhoto ? "translate-x-4" : "translate-x-0"}`} />
                  </div>
                  <span className="text-sm font-medium text-stone-700 flex items-center gap-2"><Camera className="w-4 h-4 text-stone-400" /> Mostrar foto</span>
                  <input type="checkbox" checked={showPhoto} onChange={(e) => setShowPhoto(e.target.checked)} className="hidden" />
                </label>
              </section>
            </div>
          </aside>
          <main ref={previewRef} id="resume-preview-area" className="flex-1 overflow-x-hidden overflow-y-auto bg-stone-100 p-4 md:p-8 flex justify-center items-start">
            <div className="origin-top transition-transform duration-150" style={{ transform: `scale(${scale})`, width: "210mm", transformOrigin: "top center" }}>
              {renderTemplate()}
            </div>
          </main>
        </div>
        <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4 portrait; margin: 0; } html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white !important; margin: 0 !important; padding: 0 !important; } #resume-builder-sidebar { display: none !important; } #resume-builder-root { display: block !important; background: white !important; } #resume-preview-area { padding: 0 !important; background: white !important; overflow: visible !important; } #resume-preview-area > div { transform: none !important; width: 100% !important; } }` }} />
      </>
    );
  }

  // ─── WIZARD STEPS ───
  const currentStep = STEPS[step] || STEPS[0];

  const renderStepContent = () => {
    const stepId = currentStep?.id;

    switch (stepId) {
      case "personal":
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Nome Completo (Registro) *" value={formName} onChange={setFormName} placeholder="Maria Silva dos Santos" />
              <FormField label="Nome Social (Opcional)" value={formSocialName} onChange={setFormSocialName} placeholder="Como prefere ser chamado" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Telefone / WhatsApp *" value={formPhone} onChange={setFormPhone} placeholder="(19) 99999-9999" />
              <FormField label="Data de Nascimento" value={formBirthDate} onChange={setFormBirthDate} placeholder="DD/MM/AAAA" type="date" />
            </div>
            <FormField label="E-mail" value={formEmail} onChange={setFormEmail} placeholder="seu@email.com" disabled />
            
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">Cidade / Estado</label>
              <CityStateSelector initialValue={formAddress} onLocationChange={setFormAddress} />
            </div>

            <div className="pt-2">
              <label className="block text-sm font-semibold text-stone-700 mb-1">Foto para o Currículo (Opcional)</label>
              <p className="text-xs text-stone-500 mb-3">Ela pode ser diferente da foto do seu perfil.</p>
              
              <div className="flex items-start gap-4">
                <div className="flex-1 max-w-sm">
                  <FileUpload 
                    label="" 
                    accept="image/*" 
                    value={formPhoto} 
                    onChange={(b64) => setFormPhoto(b64)} 
                    type="avatar" 
                    placeholder="Clique para subir uma foto profissional"
                  />
                </div>
                {!formPhoto && profile?.photoURL && (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-xs font-semibold text-stone-400">Sua foto atual</span>
                    <img src={profile.photoURL} alt="Perfil" className="w-16 h-16 rounded-2xl object-cover grayscale opacity-50" />
                  </div>
                )}
              </div>
            </div>
            
            <FormField label="Pretensão Salarial (Opcional)" value={formSalary} onChange={setFormSalary} placeholder="Ex: R$ 2.500,00 a R$ 3.000,00" />
          </div>
        );

      case "about":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">
                {isFirstJob ? "Objetivo Profissional *" : "Resumo Profissional *"}
              </label>
              <p className="text-xs text-stone-500 mb-2">
                {isFirstJob
                  ? "Descreva o que você busca profissionalmente e suas principais qualidades."
                  : "Escreva um breve resumo sobre sua carreira, áreas de atuação e diferenciais."}
              </p>
              <textarea
                value={formBio}
                onChange={(e) => setFormBio(e.target.value)}
                rows={5}
                placeholder={isFirstJob
                  ? "Ex: Jovem proativo e dedicado, busco minha primeira oportunidade profissional para aplicar meus conhecimentos em [área] e contribuir para o crescimento da empresa..."
                  : "Ex: Profissional com 5 anos de experiência em [área], com foco em [especialidade]. Destaco-me pela capacidade de..."}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
        );

      case "experience":
        return (
          <div className="space-y-4">
            {formExperiences.map((exp, idx) => (
              <div key={idx} className="bg-stone-50 border border-stone-200 rounded-2xl p-4 relative">
                <button onClick={() => setFormExperiences(formExperiences.filter((_, i) => i !== idx))} className="absolute top-3 right-3 text-stone-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                <div className="font-bold text-stone-900">{exp.role}</div>
                <div className="text-sm text-stone-600">{exp.company}</div>
                <div className="text-xs text-stone-500 mt-1">{exp.startDate} – {exp.current ? "Atual" : exp.endDate}</div>
                {exp.description && <p className="text-sm text-stone-600 mt-2 line-clamp-2">{exp.description}</p>}
              </div>
            ))}
            <ExperienceForm onAdd={(exp) => setFormExperiences([...formExperiences, exp])} />
          </div>
        );

      case "education":
        return (
          <div className="space-y-4">
            {formEducation.map((edu, idx) => (
              <div key={idx} className="bg-stone-50 border border-stone-200 rounded-2xl p-4 relative">
                <button onClick={() => setFormEducation(formEducation.filter((_, i) => i !== idx))} className="absolute top-3 right-3 text-stone-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                <div className="font-bold text-stone-900">{edu.degree}{edu.fieldOfStudy ? ` em ${edu.fieldOfStudy}` : ""}</div>
                <div className="text-sm text-stone-600">{edu.institution}</div>
                <div className="text-xs text-stone-500 mt-1">{edu.startYear} – {edu.current ? "Atual" : edu.endYear}</div>
              </div>
            ))}
            <EducationForm onAdd={(edu) => setFormEducation([...formEducation, edu])} />
          </div>
        );

      case "skills":
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 min-h-[40px]">
              {formSkills.map((skill, idx) => (
                <span key={idx} className="bg-terracotta-100 text-terracotta-800 text-sm font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  {skill}
                  <button onClick={() => setFormSkills(formSkills.filter((_, i) => i !== idx))} className="text-terracotta-500 hover:text-terracotta-800"><Trash2 className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newSkill.trim()) { setFormSkills([...formSkills, newSkill.trim()]); setNewSkill(""); e.preventDefault(); }}}
                placeholder="Digite uma habilidade e pressione Enter"
                className="flex-1 px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-500"
              />
              <button onClick={() => { if (newSkill.trim()) { setFormSkills([...formSkills, newSkill.trim()]); setNewSkill(""); }}} className="bg-stone-900 text-white px-4 rounded-xl text-sm font-bold hover:bg-stone-800 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      case "courses":
        return (
          <div className="space-y-4">
            {formCourses.map((course, idx) => (
              <div key={idx} className="bg-stone-50 border border-stone-200 rounded-2xl p-4 relative">
                <button onClick={() => setFormCourses(formCourses.filter((_, i) => i !== idx))} className="absolute top-3 right-3 text-stone-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                <div className="font-bold text-stone-900">{course.name}</div>
                <div className="text-sm text-stone-600">{course.institution} · {course.year}</div>
              </div>
            ))}
            <CourseForm onAdd={(c) => setFormCourses([...formCourses, c])} />
          </div>
        );

      case "languages":
        return (
          <div className="space-y-4">
            {formLanguages.map((lang, idx) => (
              <div key={idx} className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex justify-between items-center">
                <div>
                  <div className="font-bold text-stone-900">{lang.name}</div>
                  <div className="text-sm text-stone-500">{lang.level}</div>
                </div>
                <button onClick={() => setFormLanguages(formLanguages.filter((_, i) => i !== idx))} className="text-stone-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <LanguageForm onAdd={(l) => setFormLanguages([...formLanguages, l])} />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 md:px-8 py-4 flex items-center justify-between shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2 text-stone-500 hover:text-stone-700 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Painel
        </Link>
        <button onClick={goToPreview} className="text-sm font-bold text-terracotta-600 hover:text-terracotta-700 flex items-center gap-1.5">
          Pular para Preview <ArrowRight className="w-4 h-4" />
        </button>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b border-stone-100 px-4 md:px-8 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-1">
          {STEPS.map((s, idx) => (
            <React.Fragment key={s.id}>
              <button
                onClick={() => setStep(idx)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full transition-all whitespace-nowrap ${
                  idx === step ? "bg-terracotta-600 text-white" :
                  idx < step ? "bg-terracotta-100 text-terracotta-700" :
                  "bg-stone-100 text-stone-400"
                }`}
              >
                {idx < step ? <Check className="w-3 h-3" /> : s.icon}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {idx < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded-full ${idx < step ? "bg-terracotta-300" : "bg-stone-200"}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-terracotta-100 flex items-center justify-center text-terracotta-600">
              {currentStep?.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900">{currentStep?.label}</h2>
              <p className="text-sm text-stone-500">Etapa {step + 1} de {totalSteps}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 md:p-8">
            {renderStepContent()}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center mt-6 gap-4">
            <button onClick={prevStep} className="flex items-center gap-2 text-stone-500 hover:text-stone-700 font-medium text-sm py-2.5 px-4 rounded-xl hover:bg-stone-100 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <button
              onClick={isLastWizardStep ? goToPreview : nextStep}
              disabled={saving}
              className="bg-terracotta-600 hover:bg-terracotta-700 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 text-sm shadow-sm transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isLastWizardStep ? "Ver Currículo" : "Próximo"}
              {!isLastWizardStep && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── SUB-COMPONENTS: Mini Forms for adding items ───

function FormField({ label, value, onChange, placeholder, disabled, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-stone-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent disabled:bg-stone-100 disabled:text-stone-400" />
    </div>
  );
}

function ExperienceForm({ onAdd }: { onAdd: (exp: ProfessionalExperience) => void }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(""); const [company, setCompany] = useState("");
  const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [current, setCurrent] = useState(false);
  const [desc, setDesc] = useState("");

  const [companyOptions, setCompanyOptions] = useState<{value: string; label: string}[]>([]);

  useEffect(() => {
    if (open) {
      // Pré-carregar algumas ou nada
    }
  }, [open]);

  const handleCompanySearch = async (term: string) => {
    if (!term || term.length < 2) {
      setCompanyOptions([]);
      return;
    }
    try {
      const { api } = await import("../lib/api");
      const res = await api.get(`/companies/search?q=${encodeURIComponent(term)}`);
      setCompanyOptions(res.data.map((c: any) => ({ value: c.name, label: c.name })));
    } catch (e) {
      console.error(e);
    }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="w-full py-3 border-2 border-dashed border-stone-300 rounded-2xl text-sm font-bold text-stone-500 hover:border-terracotta-400 hover:text-terracotta-600 transition-colors flex items-center justify-center gap-2">
      <Plus className="w-4 h-4" /> Adicionar Experiência
    </button>
  );

  const handleAdd = () => {
    if (!role.trim() || !company.trim()) return;
    onAdd({ role, company, startDate: start, endDate: current ? "Atual" : end, current, description: desc });
    setRole(""); setCompany(""); setStart(""); setEnd(""); setCurrent(false); setDesc(""); setOpen(false);
  };

  return (
    <div className="border border-terracotta-200 bg-terracotta-50/30 rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Cargo *" value={role} onChange={setRole} placeholder="Vendedor" />
        <div className="z-20">
          <label className="block text-sm font-semibold text-stone-700 mb-1">Empresa *</label>
          <SearchSelect
            value={company}
            onChange={setCompany}
            placeholder="Loja ABC"
            options={companyOptions}
            onSearch={handleCompanySearch}
            allowCustom={true}
            customLabel="Adicionar empresa:"
            className="w-full"
          />
        </div>
        <FormField label="Início" value={start} onChange={setStart} placeholder="03/2020" />
        <div>
          <FormField label="Término" value={end} onChange={setEnd} placeholder="12/2023" disabled={current} />
          <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
            <input type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)} className="rounded" />
            <span className="text-xs text-stone-600">Emprego atual</span>
          </label>
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-stone-700 mb-1">Descrição das atividades</label>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Descreva suas principais atividades e conquistas..."
          className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-500 resize-none" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setOpen(false)} className="text-sm text-stone-500 hover:text-stone-700 px-4 py-2">Cancelar</button>
        <button onClick={handleAdd} className="bg-terracotta-600 text-white text-sm font-bold px-5 py-2 rounded-xl hover:bg-terracotta-700 transition-colors">Adicionar</button>
      </div>
    </div>
  );
}

function EducationForm({ onAdd }: { onAdd: (edu: AcademicEducation) => void }) {
  const [open, setOpen] = useState(false);
  const [institution, setInstitution] = useState(""); const [degree, setDegree] = useState("");
  const [field, setField] = useState(""); const [start, setStart] = useState(""); const [end, setEnd] = useState("");
  const [current, setCurrent] = useState(false);

  if (!open) return (
    <button onClick={() => setOpen(true)} className="w-full py-3 border-2 border-dashed border-stone-300 rounded-2xl text-sm font-bold text-stone-500 hover:border-terracotta-400 hover:text-terracotta-600 transition-colors flex items-center justify-center gap-2">
      <Plus className="w-4 h-4" /> Adicionar Formação
    </button>
  );

  const [instOptions, setInstOptions] = useState<{value: string; label: string}[]>([]);

  const handleInstSearch = async (term: string) => {
    if (!term || term.length < 2) {
      setInstOptions([]);
      return;
    }
    try {
      const { api } = await import("../lib/api");
      const res = await api.get(`/users/institutions/search?q=${encodeURIComponent(term)}`);
      setInstOptions(res.data.map((i: any) => ({ value: i.name, label: i.name })));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdd = async () => {
    if (!institution.trim() || !degree.trim()) return;
    
    // Attempt to save new institution in backend silently (if doesn't exist)
    try {
      const { api } = await import("../lib/api");
      await api.post(`/users/institutions`, { name: institution });
    } catch (e) { /* ignore */ }

    onAdd({ institution, degree, fieldOfStudy: field, startYear: start, endYear: current ? "Atual" : end, current });
    setInstitution(""); setDegree(""); setField(""); setStart(""); setEnd(""); setCurrent(false); setOpen(false);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="w-full py-3 border-2 border-dashed border-stone-300 rounded-2xl text-sm font-bold text-stone-500 hover:border-terracotta-400 hover:text-terracotta-600 transition-colors flex items-center justify-center gap-2">
      <Plus className="w-4 h-4" /> Adicionar Formação
    </button>
  );

  return (
    <div className="border border-terracotta-200 bg-terracotta-50/30 rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="z-10">
          <label className="block text-sm font-semibold text-stone-700 mb-1">Instituição *</label>
          <SearchSelect
            value={institution}
            onChange={setInstitution}
            placeholder="Universidade X"
            options={instOptions}
            onSearch={handleInstSearch}
            allowCustom={true}
            customLabel="Adicionar nova instituição:"
            className="w-full"
          />
        </div>
        <FormField label="Grau *" value={degree} onChange={setDegree} placeholder="Graduação / Técnico / Ensino Médio" />
        <FormField label="Área de Estudo" value={field} onChange={setField} placeholder="Administração" />
        <FormField label="Ano de Início" value={start} onChange={setStart} placeholder="2018" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FormField label="Ano de Término" value={end} onChange={setEnd} placeholder="2022" disabled={current} />
          <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
            <input type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)} className="rounded" />
            <span className="text-xs text-stone-600">Cursando atualmente</span>
          </label>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setOpen(false)} className="text-sm text-stone-500 hover:text-stone-700 px-4 py-2">Cancelar</button>
        <button onClick={handleAdd} className="bg-terracotta-600 text-white text-sm font-bold px-5 py-2 rounded-xl hover:bg-terracotta-700 transition-colors">Adicionar</button>
      </div>
    </div>
  );
}

function CourseForm({ onAdd }: { onAdd: (c: ExtraCourse) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [institution, setInstitution] = useState(""); const [year, setYear] = useState("");

  if (!open) return (
    <button onClick={() => setOpen(true)} className="w-full py-3 border-2 border-dashed border-stone-300 rounded-2xl text-sm font-bold text-stone-500 hover:border-terracotta-400 hover:text-terracotta-600 transition-colors flex items-center justify-center gap-2">
      <Plus className="w-4 h-4" /> Adicionar Curso
    </button>
  );

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({ name, institution, year });
    setName(""); setInstitution(""); setYear(""); setOpen(false);
  };

  return (
    <div className="border border-terracotta-200 bg-terracotta-50/30 rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Nome do Curso *" value={name} onChange={setName} placeholder="Informática Básica" />
        <FormField label="Instituição" value={institution} onChange={setInstitution} placeholder="Senai" />
      </div>
      <FormField label="Ano de Conclusão" value={year} onChange={setYear} placeholder="2023" />
      <div className="flex gap-2 justify-end">
        <button onClick={() => setOpen(false)} className="text-sm text-stone-500 hover:text-stone-700 px-4 py-2">Cancelar</button>
        <button onClick={handleAdd} className="bg-terracotta-600 text-white text-sm font-bold px-5 py-2 rounded-xl hover:bg-terracotta-700 transition-colors">Adicionar</button>
      </div>
    </div>
  );
}

function LanguageForm({ onAdd }: { onAdd: (l: { name: string; level: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [level, setLevel] = useState("Básico");

  if (!open) return (
    <button onClick={() => setOpen(true)} className="w-full py-3 border-2 border-dashed border-stone-300 rounded-2xl text-sm font-bold text-stone-500 hover:border-terracotta-400 hover:text-terracotta-600 transition-colors flex items-center justify-center gap-2">
      <Plus className="w-4 h-4" /> Adicionar Idioma
    </button>
  );

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({ name, level });
    setName(""); setLevel("Básico"); setOpen(false);
  };

  return (
    <div className="border border-terracotta-200 bg-terracotta-50/30 rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Idioma *" value={name} onChange={setName} placeholder="Inglês" />
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">Nível</label>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-500">
            {LANGUAGE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setOpen(false)} className="text-sm text-stone-500 hover:text-stone-700 px-4 py-2">Cancelar</button>
        <button onClick={handleAdd} className="bg-terracotta-600 text-white text-sm font-bold px-5 py-2 rounded-xl hover:bg-terracotta-700 transition-colors">Adicionar</button>
      </div>
    </div>
  );
}
