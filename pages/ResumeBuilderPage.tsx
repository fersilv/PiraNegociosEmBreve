import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AcademicEducation,
  ExperienceTimelineEntry,
  ExtraCourse,
  Language,
  ProfessionalExperience,
  ResumeAIAnalysis,
  ResumePreferences,
  UserProfile,
  useAuth,
} from "../contexts/AuthContext";
import { api } from "../lib/api";
import { Link, Navigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Briefcase,
  Camera,
  Check,
  CheckCircle2,
  Edit3,
  FileText,
  Globe,
  GraduationCap,
  Layout,
  Loader2,
  Lock,
  Palette,
  Plus,
  Printer,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { ClassicTemplate } from "../components/resume-templates/ClassicTemplate";
import { ModernTemplate } from "../components/resume-templates/ModernTemplate";
import { MinimalistTemplate } from "../components/resume-templates/MinimalistTemplate";
import { CreativeTemplate } from "../components/resume-templates/CreativeTemplate";
import { CityStateSelector } from "../components/CityStateSelector";
import { FileUpload } from "../components/FileUpload";
import { SearchSelect } from "../components/SearchSelect";
import { useAiStatus } from "../hooks/useAiStatus";

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

type SkillSource =
  | { kind: "stage"; experienceIndex: number; stageIndex: number; label: string }
  | { kind: "education"; index: number; label: string }
  | { kind: "course"; index: number; label: string };

interface ImportConflict {
  field?: string;
  message?: string;
  options?: string[];
  sources?: string[];
}

interface ImportNotice {
  documents: number;
  conflicts: ImportConflict[];
}

const DEFAULT_RESUME_PREFERENCES: ResumePreferences = {
  nameMode: "SOCIAL",
  showHeadline: true,
  headline: "",
  showPhoto: true,
  template: "modern",
  color: "#0284c7",
};

const AI_PROCESS_MESSAGES = [
  "Documentos recebidos. Preparando as fontes para leitura.",
  "Lendo dados profissionais, contatos, vínculos e formações.",
  "Cruzando informações entre currículo, carteira e demais documentos.",
  "Organizando empresas e identificando evoluções de cargo.",
  "Mapeando cursos, certificações e habilidades comprovadas.",
  "Aplicando os dados ao seu currículo para você revisar.",
];

const SCORE_PROCESS_MESSAGES = [
  "Verificando a estrutura geral do currículo.",
  "Analisando como suas experiências contam sua trajetória.",
  "Conferindo clareza, evidências e organização das habilidades.",
  "Identificando pontos fortes e oportunidades de melhoria.",
  "Preparando sua pontuação e recomendações.",
];

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function profileHasData(p: UserProfile | null): boolean {
  if (!p) return false;
  return Boolean(
    p.bio ||
      (p.experiences && p.experiences.length > 0) ||
      (p.education && p.education.length > 0) ||
      (p.skills && p.skills.length > 0) ||
      (p.courses && p.courses.length > 0),
  );
}

function normalizeMonthYear(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(atual|presente)$/i.test(raw)) return "Atual";

  let match = raw.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (match) {
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return `${String(month).padStart(2, "0")}/${match[1]}`;
  }

  match = raw.match(/^\d{1,2}[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const month = Number(match[1]);
    if (month >= 1 && month <= 12) return `${String(month).padStart(2, "0")}/${match[2]}`;
  }

  match = raw.match(/^(\d{1,2})[/-](\d{4})$/);
  if (match) {
    const month = Number(match[1]);
    if (month >= 1 && month <= 12) return `${String(month).padStart(2, "0")}/${match[2]}`;
  }

  if (/^\d{4}$/.test(raw)) return raw;
  return raw;
}

function monthYearToInput(value: unknown): string {
  const normalized = normalizeMonthYear(value);
  const match = normalized.match(/^(\d{2})\/(\d{4})$/);
  return match ? `${match[2]}-${match[1]}` : "";
}

function monthInputToMonthYear(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  return match ? `${match[2]}/${match[1]}` : normalizeMonthYear(value);
}

function dateSortValue(value: string): number {
  const normalized = normalizeMonthYear(value);
  if (!normalized) return Number.MAX_SAFE_INTEGER;
  const match = normalized.match(/^(\d{2})\/(\d{4})$/);
  if (match) return Number(match[2]) * 12 + Number(match[1]);
  if (/^\d{4}$/.test(normalized)) return Number(normalized) * 12;
  return Number.MAX_SAFE_INTEGER - 1;
}

function normalizeStage(stage: ExperienceTimelineEntry): ExperienceTimelineEntry {
  return {
    ...stage,
    id: stage.id || makeId("stage"),
    role: String(stage.role || ""),
    startDate: normalizeMonthYear(stage.startDate),
    endDate: stage.current ? "Atual" : normalizeMonthYear(stage.endDate),
    description: String(stage.description || ""),
    skills: Array.isArray(stage.skills) ? stage.skills.filter(Boolean) : [],
  };
}

function syncExperience(exp: ProfessionalExperience): ProfessionalExperience {
  const rawTimeline = Array.isArray(exp.timeline) && exp.timeline.length > 0
    ? exp.timeline
    : [
        {
          id: makeId("stage"),
          role: exp.role || "",
          startDate: exp.startDate || "",
          endDate: exp.endDate || "",
          current: Boolean(exp.current),
          description: exp.description || "",
          skills: exp.skills || [],
        },
      ];
  const timeline = rawTimeline
    .map(normalizeStage)
    .sort((a, b) => dateSortValue(a.startDate) - dateSortValue(b.startDate));
  const datedStages = timeline.filter((stage) => Boolean(stage.startDate));
  const first = datedStages[0] || timeline[0];
  const latest = datedStages[datedStages.length - 1] || timeline[timeline.length - 1];
  const allSkills = Array.from(
    new Set([...(exp.skills || []), ...timeline.flatMap((stage) => stage.skills || [])]),
  );
  return {
    ...exp,
    id: exp.id || makeId("exp"),
    company: String(exp.company || ""),
    role: latest?.role || exp.role || "",
    startDate: first?.startDate || normalizeMonthYear(exp.startDate),
    endDate: latest?.current ? "Atual" : latest?.endDate || normalizeMonthYear(exp.endDate),
    current: Boolean(latest?.current),
    description: String(exp.description || ""),
    skills: allSkills,
    timeline,
  };
}

function prepareExperienceForSave(exp: ProfessionalExperience): ProfessionalExperience {
  const synced = syncExperience(exp);
  return syncExperience({
    ...synced,
    company: synced.company.trim(),
    description: String(synced.description || "").trim(),
    timeline: (synced.timeline || []).map((stage) => ({
      ...stage,
      role: String(stage.role || "").trim(),
      description: String(stage.description || "").trim(),
    })),
  });
}

function mergeExperiencesByCompany(value: unknown): ProfessionalExperience[] {
  if (!Array.isArray(value)) return [];
  const merged = new Map<string, ProfessionalExperience>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const normalized = syncExperience(raw as ProfessionalExperience);
    const key = normalized.company.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim() || normalized.id || makeId("exp");
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, normalized);
      continue;
    }
    merged.set(
      key,
      syncExperience({
        ...existing,
        description: existing.description || normalized.description,
        skills: Array.from(new Set([...(existing.skills || []), ...(normalized.skills || [])])),
        timeline: [...(existing.timeline || []), ...(normalized.timeline || [])],
      }),
    );
  }
  return Array.from(merged.values());
}

function normalizeEducation(value: unknown): AcademicEducation[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is AcademicEducation => Boolean(item && typeof item === "object"))
    .map((item) => ({
      ...item,
      id: item.id || makeId("edu"),
      skills: Array.isArray(item.skills) ? item.skills.filter(Boolean) : [],
    }));
}

function normalizeCourses(value: unknown): ExtraCourse[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is ExtraCourse => Boolean(item && typeof item === "object"))
    .map((item) => ({
      ...item,
      id: item.id || makeId("course"),
      type: item.type === "CERTIFICATION" ? "CERTIFICATION" : "COURSE",
      skills: Array.isArray(item.skills) ? item.skills.filter(Boolean) : [],
    }));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function mergeUniqueStrings(current: string[], incoming: unknown): string[] {
  const next = Array.isArray(incoming)
    ? incoming.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const seen = new Set<string>();
  return [...current, ...next].filter((item) => {
    const key = item.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ResumeBuilderPage() {
  const { profile, loading, refreshProfile } = useAuth();
  const { enabled: aiEnabled } = useAiStatus();
  const [step, setStep] = useState(-1);
  const [isFirstJob, setIsFirstJob] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiProcessStage, setAiProcessStage] = useState(0);
  const [processingDocumentCount, setProcessingDocumentCount] = useState(1);
  const [aiError, setAiError] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [scoreOfferOpen, setScoreOfferOpen] = useState(false);
  const [scoreOfferMessage, setScoreOfferMessage] = useState("");
  const [importNotice, setImportNotice] = useState<ImportNotice | null>(null);

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
  const [formAiAnalysis, setFormAiAnalysis] = useState<ResumeAIAnalysis | undefined>();
  const [preferences, setPreferences] = useState<ResumePreferences>(DEFAULT_RESUME_PREFERENCES);
  const [scale, setScale] = useState(1);
  const previewRef = useRef<HTMLDivElement>(null);
  const initialProfileHydratedRef = useRef(false);
  const [newSkill, setNewSkill] = useState("");

  useEffect(() => {
    if (!profile) return;
    setFormName(profile.fullName || profile.name || "");
    setFormSocialName(profile.socialName || "");
    let initialBirthDate = "";
    if (profile.birthDate instanceof Date) initialBirthDate = profile.birthDate.toISOString().split("T")[0];
    else if (typeof profile.birthDate === "string") initialBirthDate = profile.birthDate.split("T")[0];
    setFormBirthDate(initialBirthDate);
    setFormPhone(profile.phone || "");
    setFormEmail(profile.email || "");
    setFormAddress(profile.address || "");
    setFormPhoto(profile.resumePhotoURL || "");
    setFormBio(profile.bio || "");
    setFormSalary(profile.salaryExpectation || "");
    setFormExperiences(mergeExperiencesByCompany(profile.experiences || []));
    setFormEducation(normalizeEducation(profile.education || []));
    setFormSkills(profile.skills || []);
    setFormCourses(normalizeCourses(profile.courses || []));
    setFormLanguages(profile.languages || []);
    setFormAiAnalysis(profile.resumeScoreUnlocked ? profile.aiAnalysis : undefined);
    setPreferences({
      ...DEFAULT_RESUME_PREFERENCES,
      ...(profile.resumePreferences || {}),
      nameMode: profile.resumePreferences?.nameMode || "SOCIAL",
    });
    if (!initialProfileHydratedRef.current) {
      initialProfileHydratedRef.current = true;
      if (profileHasData(profile)) setStep(99);
    }
  }, [profile]);

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

  useEffect(() => {
    if (step !== 99 || !profile) return;
    const timer = window.setTimeout(() => {
      void api.patch("/users/me", { resumePreferences: preferences }).catch((error) => {
        console.error("Erro ao salvar preferências do currículo:", error);
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [preferences, profile, step]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-stone-500">Carregando...</div>;
  if (!profile) return <Navigate to="/login" replace />;

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
    experiences: formExperiences.map(syncExperience),
    education: formEducation,
    skills: formSkills,
    courses: formCourses,
    languages: formLanguages,
    aiAnalysis: profile.resumeScoreUnlocked ? formAiAnalysis : undefined,
    resumePreferences: preferences,
  };

  const saveProgress = async () => {
    setSaving(true);
    try {
      const normalizedExperiences = formExperiences.map(prepareExperienceForSave);
      setFormExperiences(normalizedExperiences);
      await api.patch("/users/me", {
        fullName: formName,
        socialName: formSocialName,
        birthDate: formBirthDate || null,
        phone: formPhone,
        address: formAddress,
        resumePhotoURL: formPhoto || undefined,
        bio: formBio,
        salaryExpectation: formSalary || undefined,
        experiences: normalizedExperiences,
        education: formEducation,
        skills: formSkills,
        courses: formCourses,
        languages: formLanguages.length > 0 ? formLanguages : undefined,
        resumePreferences: preferences,
      });
      await refreshProfile();
    } catch (error) {
      console.error("Erro ao salvar progresso:", error);
    } finally {
      setSaving(false);
    }
  };

  const nextStep = async () => {
    await saveProgress();
    setStep((current) => current + 1);
  };
  const prevStep = () => setStep((current) => Math.max(-1, current - 1));
  const goToPreview = async () => {
    await saveProgress();
    setStep(99);
  };
  const finishBuilder = async () => {
    await saveProgress();
    if (aiEnabled && !profile.resumeScoreUnlocked) {
      setScoreOfferMessage("");
      setScoreOfferOpen(true);
      return;
    }
    setStep(99);
  };

  const reviewResume = async (candidateProfile: UserProfile = previewProfile) => {
    if (!aiEnabled) return undefined;
    if (!profile.resumeScoreUnlocked) {
      setScoreOfferMessage("");
      setScoreOfferOpen(true);
      return undefined;
    }
    setReviewing(true);
    try {
      const response = await api.post(
        "/ai/review-resume",
        { profile: candidateProfile },
        { timeout: 90000 },
      );
      const analysis = response.data as ResumeAIAnalysis;
      setFormAiAnalysis(analysis);
      await refreshProfile();
      return analysis;
    } catch (error) {
      console.error("Erro ao avaliar currículo:", error);
      return undefined;
    } finally {
      setReviewing(false);
    }
  };

  const handleScoreInterest = () => {
    if (profile.resumeScoreUnlocked) {
      setScoreOfferOpen(false);
      setStep(99);
      void reviewResume();
      return;
    }
    setScoreOfferMessage(
      "A etapa de pagamento será conectada a este botão. Seu currículo continua gratuito e disponível normalmente enquanto isso.",
    );
  };

  const handleAiUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from<File>(event.target.files || []);
    event.target.value = "";
    if (files.length === 0 || !aiEnabled) return;
    if (files.length > 8) {
      setAiError("Selecione no máximo 8 documentos por vez.");
      return;
    }

    const allowedTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);
    const unsupported = files.find((file) => !allowedTypes.has(file.type));
    if (unsupported) {
      setAiError(`O arquivo ${unsupported.name} precisa ser PDF, PNG ou JPG.`);
      return;
    }

    setAiError("");
    setImportNotice(null);
    setProcessingDocumentCount(files.length);
    setAiProcessing(true);
    setAiProcessStage(0);
    const timer = window.setInterval(() => {
      setAiProcessStage((current) => Math.min(4, current + 1));
    }, 2200);

    try {
      const documents = await Promise.all(
        files.map(async (file: File) => ({
          base64File: await readFileAsDataUrl(file),
          mimeType: file.type,
          fileName: file.name,
        })),
      );
      setAiProcessStage(1);
      const response = await api.post(
        "/ai/analyze-resume-documents",
        { documents },
        { timeout: 180000 },
      );
      const data = response.data || {};
      setAiProcessStage(3);

      const importedExperiences = mergeExperiencesByCompany(data.experiences || []);
      const importedEducation = normalizeEducation(data.education || []);
      const importedCourses = normalizeCourses(data.courses || []);
      const experiences = importedExperiences.length > 0
        ? mergeExperiencesByCompany([...formExperiences, ...importedExperiences])
        : formExperiences;
      const education = importedEducation.length > 0
        ? normalizeEducation([...formEducation, ...importedEducation])
        : formEducation;
      const courses = importedCourses.length > 0
        ? normalizeCourses([...formCourses, ...importedCourses])
        : formCourses;
      const skills = mergeUniqueStrings(formSkills, data.skills);
      const importedLanguages = Array.isArray(data.languages) ? data.languages : [];
      const languageMap = new Map<string, Language>();
      [...formLanguages, ...importedLanguages].forEach((language: Language) => {
        if (!language?.name) return;
        languageMap.set(language.name.toLocaleLowerCase("pt-BR"), language);
      });
      const languages = Array.from(languageMap.values());

      if (data.name) setFormName(String(data.name));
      if (data.phone) setFormPhone(String(data.phone));
      if (data.bio) setFormBio(String(data.bio));
      setFormExperiences(experiences);
      setFormEducation(education);
      setFormSkills(skills);
      setFormCourses(courses);
      setFormLanguages(languages);
      setFormAiAnalysis(undefined);

      const conflicts: ImportConflict[] = Array.isArray(data.conflicts)
        ? data.conflicts.filter((item: unknown): item is ImportConflict => Boolean(item && typeof item === "object"))
        : [];
      setImportNotice({
        documents: Number(data.documentsProcessed || files.length),
        conflicts,
      });

      setAiProcessStage(5);
      await api.patch("/users/me", {
        fullName: data.name || formName,
        phone: data.phone || formPhone,
        bio: data.bio || formBio,
        experiences,
        education,
        skills,
        courses,
        languages: languages.length > 0 ? languages : undefined,
        resumePreferences: preferences,
      });
      await refreshProfile();
      window.clearInterval(timer);
      window.setTimeout(() => {
        setAiProcessing(false);
        setStep(0);
      }, 550);
    } catch (error: any) {
      window.clearInterval(timer);
      setAiProcessing(false);
      setAiError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Não foi possível organizar os documentos. Tente novamente.",
      );
    }
  };

  const removeSkillEverywhere = (skill: string) => {
    setFormSkills((current) => current.filter((item) => item !== skill));
    setFormExperiences((current) =>
      current.map((exp) =>
        syncExperience({
          ...exp,
          skills: (exp.skills || []).filter((item) => item !== skill),
          timeline: (exp.timeline || []).map((stage) => ({
            ...stage,
            skills: (stage.skills || []).filter((item) => item !== skill),
          })),
        }),
      ),
    );
    setFormEducation((current) =>
      current.map((edu) => ({ ...edu, skills: (edu.skills || []).filter((item) => item !== skill) })),
    );
    setFormCourses((current) =>
      current.map((course) => ({ ...course, skills: (course.skills || []).filter((item) => item !== skill) })),
    );
  };

  const skillSources: SkillSource[] = [
    ...formExperiences.flatMap((exp, experienceIndex) =>
      (exp.timeline || []).map((stage, stageIndex) => ({
        kind: "stage" as const,
        experienceIndex,
        stageIndex,
        label: `${exp.company} · ${stage.role || "Etapa sem cargo"}`,
      })),
    ),
    ...formEducation.map((edu, index) => ({
      kind: "education" as const,
      index,
      label: `${edu.institution} · ${edu.degree}${edu.fieldOfStudy ? ` em ${edu.fieldOfStudy}` : ""}`,
    })),
    ...formCourses.map((course, index) => ({
      kind: "course" as const,
      index,
      label: `${course.type === "CERTIFICATION" ? "Certificação" : "Curso"} · ${course.name}`,
    })),
  ];

  const sourceHasSkill = (source: SkillSource, skill: string): boolean => {
    if (source.kind === "stage") {
      return Boolean(formExperiences[source.experienceIndex]?.timeline?.[source.stageIndex]?.skills?.includes(skill));
    }
    if (source.kind === "education") return Boolean(formEducation[source.index]?.skills?.includes(skill));
    return Boolean(formCourses[source.index]?.skills?.includes(skill));
  };

  const toggleSkillSource = (source: SkillSource, skill: string) => {
    if (source.kind === "stage") {
      setFormExperiences((current) =>
        current.map((exp, expIndex) => {
          if (expIndex !== source.experienceIndex) return exp;
          const timeline = (exp.timeline || []).map((stage, stageIndex) => {
            if (stageIndex !== source.stageIndex) return stage;
            const currentSkills = stage.skills || [];
            return {
              ...stage,
              skills: currentSkills.includes(skill)
                ? currentSkills.filter((item) => item !== skill)
                : [...currentSkills, skill],
            };
          });
          return syncExperience({ ...exp, timeline });
        }),
      );
      return;
    }
    if (source.kind === "education") {
      setFormEducation((current) =>
        current.map((edu, index) => {
          if (index !== source.index) return edu;
          const currentSkills = edu.skills || [];
          return {
            ...edu,
            skills: currentSkills.includes(skill)
              ? currentSkills.filter((item) => item !== skill)
              : [...currentSkills, skill],
          };
        }),
      );
      return;
    }
    setFormCourses((current) =>
      current.map((course, index) => {
        if (index !== source.index) return course;
        const currentSkills = course.skills || [];
        return {
          ...course,
          skills: currentSkills.includes(skill)
            ? currentSkills.filter((item) => item !== skill)
            : [...currentSkills, skill],
        };
      }),
    );
  };

  const template = (preferences.template || "modern") as TemplateId;
  const color = preferences.color || "#0284c7";
  const showPhoto = preferences.showPhoto !== false;

  const renderTemplate = () => {
    const props = { profile: previewProfile, color, showPhoto, isFirstJob };
    switch (template) {
      case "classic":
        return <ClassicTemplate {...props} />;
      case "minimalist":
        return <MinimalistTemplate {...props} />;
      case "creative":
        return <CreativeTemplate {...props} />;
      case "modern":
      default:
        return <ModernTemplate {...props} />;
    }
  };

  const STEPS = [
    { id: "personal", label: "Dados Pessoais", icon: <User className="w-4 h-4" /> },
    ...(isFirstJob ? [] : [{ id: "experience", label: "Experiência", icon: <Briefcase className="w-4 h-4" /> }]),
    { id: "education", label: "Formação", icon: <GraduationCap className="w-4 h-4" /> },
    { id: "skills", label: "Habilidades", icon: <Sparkles className="w-4 h-4" /> },
    { id: "courses", label: "Cursos", icon: <BookOpen className="w-4 h-4" /> },
    { id: "languages", label: "Idiomas", icon: <Globe className="w-4 h-4" /> },
    { id: "about", label: "Sobre Você", icon: <FileText className="w-4 h-4" /> },
  ];

  if (aiProcessing) {
    return <AiResumeProcessingScreen stage={aiProcessStage} documentCount={processingDocumentCount} />;
  }

  if (reviewing) {
    return <ResumeScoreProcessingScreen />;
  }

  if (step === -1) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 rounded-3xl bg-terracotta-100 flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-terracotta-600" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-900 mb-3">Vamos criar seu currículo!</h1>
          <p className="text-stone-500 mb-8 leading-relaxed">
            Preencha manualmente ou deixe a IA organizar os documentos que você já possui.
          </p>

          {aiError && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">Não conseguimos concluir a importação</p>
                <p className="mt-1">{aiError}</p>
              </div>
            </div>
          )}

          {aiEnabled && (
            <>
              <div className="bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-200 rounded-2xl p-5 mb-8 text-left">
                <h3 className="font-bold text-violet-900 flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-violet-500" /> Já tem documentos da sua trajetória?
                </h3>
                <p className="text-sm text-violet-700 mb-4">
                  Pode ser currículo, fotos, prints da Carteira de Trabalho, extrato da CTPS Digital ou certificados. Selecione vários de uma vez e a IA cruza as informações para montar sua trajetória.
                </p>
                <label className="cursor-pointer inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors shadow-sm">
                  <Upload className="w-4 h-4" /> Usar meus documentos
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg"
                    multiple
                    onChange={handleAiUpload}
                    className="hidden"
                  />
                </label>
                <p className="mt-2 text-[11px] text-violet-500">PDF, PNG ou JPG · até 8 arquivos por vez</p>
              </div>
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px flex-1 bg-stone-200" />
                <span className="text-sm text-stone-400 font-medium">ou preencha manualmente</span>
                <div className="h-px flex-1 bg-stone-200" />
              </div>
            </>
          )}

          <h2 className="text-lg font-bold text-stone-900 mb-4">Este é o seu primeiro emprego?</h2>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => { setIsFirstJob(true); setStep(0); }} className="flex-1 py-4 px-6 bg-white border-2 border-stone-200 rounded-2xl font-bold text-stone-700 hover:border-terracotta-400 hover:bg-terracotta-50 transition-all">
              Sim, é meu primeiro emprego
            </button>
            <button onClick={() => { setIsFirstJob(false); setStep(0); }} className="flex-1 py-4 px-6 bg-white border-2 border-stone-200 rounded-2xl font-bold text-stone-700 hover:border-terracotta-400 hover:bg-terracotta-50 transition-all">
              Não, já tenho experiência
            </button>
          </div>
          <Link to="/dashboard/pessoal" className="mt-8 inline-flex items-center gap-2 text-sm text-stone-400 hover:text-stone-600">
            <ArrowLeft className="w-4 h-4" /> Voltar ao painel
          </Link>
        </div>
      </div>
    );
  }

  if (step === 99) {
    return (
      <>
        <div className="min-h-screen bg-stone-100 flex flex-col md:flex-row" id="resume-builder-root">
          <aside id="resume-builder-sidebar" className="w-full md:w-[350px] bg-white border-b md:border-b-0 md:border-r border-stone-200 flex flex-col md:h-screen md:sticky md:top-0 z-10 shrink-0">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-3">
              <button onClick={() => setStep(0)} className="flex items-center gap-2 text-stone-600 hover:text-terracotta-600 font-medium text-sm">
                <ArrowLeft className="w-4 h-4" /> Editar dados
              </button>
              <button onClick={() => window.print()} className="bg-terracotta-600 hover:bg-terracotta-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm shadow-sm transition-colors">
                <Printer className="w-4 h-4" /> PDF
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-7">
              {aiEnabled && (
                <ResumeScoreCard
                  analysis={formAiAnalysis}
                  unlocked={Boolean(profile.resumeScoreUnlocked)}
                  reviewing={reviewing}
                  onReview={() => void reviewResume()}
                  onUpgrade={() => {
                    setScoreOfferMessage("");
                    setScoreOfferOpen(true);
                  }}
                />
              )}

              <section>
                <h2 className="text-xs font-bold text-stone-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Layout className="w-4 h-4 text-stone-400" /> Modelo
                </h2>
                <div className="grid grid-cols-2 gap-2.5">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => setPreferences((current) => ({ ...current, template: tpl.id }))}
                      className={`py-2.5 px-2 border-2 rounded-xl text-sm font-bold transition-all ${template === tpl.id ? "border-terracotta-600 text-terracotta-700 bg-terracotta-50" : "border-stone-200 text-stone-600 hover:border-stone-300 bg-white"}`}
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-xs font-bold text-stone-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-stone-400" /> Cor
                </h2>
                <div className="flex flex-wrap gap-2.5">
                  {ACCENT_COLORS.map((item) => (
                    <button
                      key={item.hex}
                      onClick={() => setPreferences((current) => ({ ...current, color: item.hex }))}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-sm"
                      style={{ backgroundColor: item.hex }}
                      title={item.name}
                    >
                      {color === item.hex && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-xs font-bold text-stone-900 uppercase tracking-widest flex items-center gap-2">
                  <Settings className="w-4 h-4 text-stone-400" /> Aparência do currículo
                </h2>
                <ToggleRow
                  checked={showPhoto}
                  onChange={(checked) => setPreferences((current) => ({ ...current, showPhoto: checked }))}
                  label="Mostrar foto"
                  icon={<Camera className="w-4 h-4 text-stone-400" />}
                />

                {formSocialName.trim() && (
                  <div>
                    <label className="mb-2 block text-xs font-bold text-stone-500 uppercase tracking-wider">Nome exibido</label>
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-stone-100 p-1">
                      <button
                        type="button"
                        onClick={() => setPreferences((current) => ({ ...current, nameMode: "SOCIAL" }))}
                        className={`rounded-lg px-3 py-2 text-xs font-bold ${preferences.nameMode !== "CIVIL" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}
                      >
                        Nome social
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreferences((current) => ({ ...current, nameMode: "CIVIL" }))}
                        className={`rounded-lg px-3 py-2 text-xs font-bold ${preferences.nameMode === "CIVIL" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}
                      >
                        Nome civil
                      </button>
                    </div>
                  </div>
                )}

                <ToggleRow
                  checked={preferences.showHeadline !== false}
                  onChange={(checked) => setPreferences((current) => ({ ...current, showHeadline: checked }))}
                  label="Mostrar título profissional"
                  icon={<Briefcase className="w-4 h-4 text-stone-400" />}
                />
                {preferences.showHeadline !== false && (
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-stone-500 uppercase tracking-wider">Título abaixo do nome</label>
                    <input
                      value={preferences.headline || ""}
                      onChange={(event) => setPreferences((current) => ({ ...current, headline: event.target.value }))}
                      placeholder={formExperiences[0]?.role || "Ex.: Líder de Atendimento"}
                      className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-terracotta-500"
                    />
                    <p className="mt-1 text-[11px] leading-relaxed text-stone-400">Se deixar vazio, usamos seu cargo mais recente.</p>
                  </div>
                )}
              </section>
            </div>
          </aside>

          <main ref={previewRef} id="resume-preview-area" className="flex-1 overflow-x-hidden overflow-y-auto bg-stone-100 p-4 md:p-8 flex justify-center items-start">
            <div className="origin-top transition-transform duration-150" style={{ transform: `scale(${scale})`, width: "210mm", transformOrigin: "top center" }}>
              {renderTemplate()}
            </div>
          </main>
        </div>
        {scoreOfferOpen && (
          <ResumeScoreOfferModal
            message={scoreOfferMessage}
            onLater={() => {
              setScoreOfferOpen(false);
              setScoreOfferMessage("");
            }}
            onContinue={handleScoreInterest}
          />
        )}
        <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4 portrait; margin: 0; } html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white !important; margin: 0 !important; padding: 0 !important; } #resume-builder-sidebar { display: none !important; } #resume-builder-root { display: block !important; background: white !important; } #resume-preview-area { padding: 0 !important; background: white !important; overflow: visible !important; } #resume-preview-area > div { transform: none !important; width: 100% !important; } }` }} />
      </>
    );
  }

  const currentStep = STEPS[step] || STEPS[0];
  const totalSteps = STEPS.length;
  const isLastWizardStep = step >= totalSteps - 1;

  const renderStepContent = () => {
    switch (currentStep?.id) {
      case "personal":
        return (
          <div className="space-y-5">
            {importNotice && (
              <div className={`rounded-2xl border p-4 ${importNotice.conflicts.length > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                <div className="flex items-start gap-3">
                  {importNotice.conflicts.length > 0 ? (
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  )}
                  <div>
                    <p className={`text-sm font-bold ${importNotice.conflicts.length > 0 ? "text-amber-900" : "text-emerald-900"}`}>
                      {importNotice.documents} {importNotice.documents === 1 ? "documento organizado" : "documentos organizados"}
                    </p>
                    <p className={`mt-1 text-xs leading-relaxed ${importNotice.conflicts.length > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                      {importNotice.conflicts.length > 0
                        ? `Encontramos ${importNotice.conflicts.length} divergência(s) entre as fontes. Revise os campos antes de concluir.`
                        : "Os dados foram cruzados e aplicados. Agora você pode revisar e complementar o que quiser."}
                    </p>
                    {importNotice.conflicts.slice(0, 3).map((conflict, index) => (
                      <div key={`${conflict.field || "conflito"}-${index}`} className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs text-amber-800">
                        <strong>{conflict.field || "Informação divergente"}:</strong> {conflict.message || "Confira as informações encontradas."}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Nome completo (registro) *" value={formName} onChange={setFormName} placeholder="Maria Silva dos Santos" />
              <FormField label="Nome social (opcional)" value={formSocialName} onChange={setFormSocialName} placeholder="Como prefere ser chamado" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Telefone / WhatsApp *" value={formPhone} onChange={setFormPhone} placeholder="(19) 99999-9999" />
              <FormField label="Data de nascimento" value={formBirthDate} onChange={setFormBirthDate} type="date" />
            </div>
            <FormField label="E-mail" value={formEmail} onChange={setFormEmail} disabled />
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">Cidade / Estado</label>
              <CityStateSelector initialValue={formAddress} onLocationChange={setFormAddress} />
            </div>
            <div className="pt-2">
              <label className="block text-sm font-semibold text-stone-700 mb-1">Foto para o currículo (opcional)</label>
              <p className="text-xs text-stone-500 mb-3">Ela pode ser diferente da foto do seu perfil.</p>
              <div className="flex items-start gap-4">
                <div className="flex-1 max-w-sm">
                  <FileUpload label="" accept="image/*" value={formPhoto} onChange={setFormPhoto} type="avatar" placeholder="Clique para subir uma foto profissional" />
                </div>
                {!formPhoto && profile.photoURL && <img src={profile.photoURL} alt="Perfil" className="w-16 h-16 rounded-2xl object-cover grayscale opacity-50" />}
              </div>
            </div>
            <FormField label="Pretensão salarial (opcional)" value={formSalary} onChange={setFormSalary} placeholder="Ex.: R$ 2.500,00 a R$ 3.000,00" />
          </div>
        );

      case "experience":
        return (
          <div className="space-y-4">
            {formExperiences.map((experience, index) => (
              <ExperienceEditor
                key={experience.id || index}
                value={experience}
                onChange={(next) => setFormExperiences((current) => current.map((item, itemIndex) => itemIndex === index ? syncExperience(next) : item))}
                onDelete={() => setFormExperiences((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              />
            ))}
            <ExperienceForm onAdd={(experience) => setFormExperiences((current) => [...current, syncExperience(experience)])} />
          </div>
        );

      case "education":
        return (
          <div className="space-y-4">
            {formEducation.map((education, index) => (
              <EducationEditor
                key={education.id || index}
                value={education}
                onChange={(next) => setFormEducation((current) => current.map((item, itemIndex) => itemIndex === index ? next : item))}
                onDelete={() => setFormEducation((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              />
            ))}
            <EducationForm onAdd={(education) => setFormEducation((current) => [...current, education])} />
          </div>
        );

      case "skills":
        return (
          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {formSkills.map((skill) => (
                  <span key={skill} className="bg-terracotta-100 text-terracotta-800 text-sm font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5">
                    {skill}
                    <button onClick={() => removeSkillEverywhere(skill)} className="text-terracotta-500 hover:text-terracotta-800">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  value={newSkill}
                  onChange={(event) => setNewSkill(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const skill = newSkill.trim();
                      if (skill && !formSkills.some((item) => item.toLocaleLowerCase("pt-BR") === skill.toLocaleLowerCase("pt-BR"))) {
                        setFormSkills((current) => [...current, skill]);
                        setNewSkill("");
                      }
                    }
                  }}
                  placeholder="Digite uma habilidade e pressione Enter"
                  className="flex-1 px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                />
                <button
                  onClick={() => {
                    const skill = newSkill.trim();
                    if (skill && !formSkills.some((item) => item.toLocaleLowerCase("pt-BR") === skill.toLocaleLowerCase("pt-BR"))) {
                      setFormSkills((current) => [...current, skill]);
                      setNewSkill("");
                    }
                  }}
                  className="bg-stone-900 text-white px-4 rounded-xl text-sm font-bold hover:bg-stone-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {formSkills.length > 0 && skillSources.length > 0 && (
              <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                <div className="mb-4">
                  <h3 className="font-bold text-stone-900">Onde você desenvolveu cada habilidade?</h3>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">
                    Uma habilidade pode estar ligada a várias experiências, formações, cursos ou certificações. Isso deixa o perfil mais verificável e melhora o matching.
                  </p>
                </div>
                <div className="space-y-5">
                  {formSkills.map((skill) => (
                    <div key={skill} className="rounded-xl border border-stone-200 bg-white p-3">
                      <div className="mb-2 text-sm font-bold text-stone-900">{skill}</div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {skillSources.map((source, sourceIndex) => {
                          const checked = sourceHasSkill(source, skill);
                          return (
                            <label key={`${skill}-${source.kind}-${sourceIndex}`} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-xs transition ${checked ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-stone-200 text-stone-600 hover:bg-stone-50"}`}>
                              <input type="checkbox" checked={checked} onChange={() => toggleSkillSource(source, skill)} className="mt-0.5 rounded" />
                              <span>{source.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case "courses":
        return (
          <div className="space-y-4">
            {formCourses.map((course, index) => (
              <CourseEditor
                key={course.id || index}
                value={course}
                onChange={(next) => setFormCourses((current) => current.map((item, itemIndex) => itemIndex === index ? next : item))}
                onDelete={() => setFormCourses((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              />
            ))}
            <CourseForm onAdd={(course) => setFormCourses((current) => [...current, course])} />
          </div>
        );

      case "languages":
        return (
          <div className="space-y-4">
            {formLanguages.map((language, index) => (
              <div key={`${language.name}-${index}`} className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex justify-between items-center">
                <div>
                  <div className="font-bold text-stone-900">{language.name}</div>
                  <div className="text-sm text-stone-500">{language.level}</div>
                </div>
                <button onClick={() => setFormLanguages((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-stone-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <LanguageForm onAdd={(language) => setFormLanguages((current) => [...current, language])} />
          </div>
        );

      case "about":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">{isFirstJob ? "Objetivo profissional *" : "Resumo profissional *"}</label>
              <p className="text-xs text-stone-500 mb-2">{isFirstJob ? "Descreva o que você busca profissionalmente e suas principais qualidades." : "Escreva um breve resumo sobre sua carreira, áreas de atuação e diferenciais."}</p>
              <textarea value={formBio} onChange={(event) => setFormBio(event.target.value)} rows={5} className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-500 resize-none" />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="bg-white border-b border-stone-200 px-4 md:px-8 py-4 flex items-center justify-between shrink-0">
        <Link to="/dashboard/pessoal" className="flex items-center gap-2 text-stone-500 hover:text-stone-700 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Painel
        </Link>
        <button onClick={goToPreview} className="text-sm font-bold text-terracotta-600 hover:text-terracotta-700 flex items-center gap-1.5">
          Pular para preview <ArrowRight className="w-4 h-4" />
        </button>
      </header>

      <div className="bg-white border-b border-stone-100 px-4 md:px-8 py-3 overflow-x-auto">
        <div className="max-w-2xl mx-auto flex items-center gap-1 min-w-max sm:min-w-0">
          {STEPS.map((item, index) => (
            <React.Fragment key={item.id}>
              <button
                onClick={() => setStep(index)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full transition-all whitespace-nowrap ${index === step ? "bg-terracotta-600 text-white" : index < step ? "bg-terracotta-100 text-terracotta-700" : "bg-stone-100 text-stone-400"}`}
              >
                {index < step ? <Check className="w-3 h-3" /> : item.icon}
                <span className="hidden sm:inline">{item.label}</span>
              </button>
              {index < STEPS.length - 1 && <div className={`w-5 sm:flex-1 h-0.5 rounded-full ${index < step ? "bg-terracotta-300" : "bg-stone-200"}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-terracotta-100 flex items-center justify-center text-terracotta-600">{currentStep?.icon}</div>
            <div>
              <h2 className="text-xl font-bold text-stone-900">{currentStep?.label}</h2>
              <p className="text-sm text-stone-500">Etapa {step + 1} de {totalSteps}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 md:p-8">{renderStepContent()}</div>
          <div className="flex justify-between items-center mt-6 gap-4">
            <button onClick={prevStep} className="flex items-center gap-2 text-stone-500 hover:text-stone-700 font-medium text-sm py-2.5 px-4 rounded-xl hover:bg-stone-100 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <button onClick={isLastWizardStep ? finishBuilder : nextStep} disabled={saving} className="bg-terracotta-600 hover:bg-terracotta-700 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 text-sm shadow-sm transition-colors disabled:opacity-60">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLastWizardStep ? "Concluir currículo" : "Próximo"}
              {!isLastWizardStep && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </main>

      {scoreOfferOpen && (
        <ResumeScoreOfferModal
          message={scoreOfferMessage}
          onLater={() => {
            setScoreOfferOpen(false);
            setScoreOfferMessage("");
            setStep(99);
          }}
          onContinue={handleScoreInterest}
        />
      )}
    </div>
  );
}

function AiResumeProcessingScreen({ stage, documentCount }: { stage: number; documentCount: number }) {
  return (
    <div className="min-h-screen overflow-hidden bg-stone-950 px-5 py-10 text-white flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-500/15 ring-1 ring-violet-400/30">
            <BrainCircuit className="h-8 w-8 text-violet-300 animate-pulse" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-300">Sua trajetória em construção</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold">A IA está organizando sua história profissional</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-stone-400">
            {documentCount} {documentCount === 1 ? "documento foi recebido" : "documentos foram recebidos"}. Estamos cruzando as fontes e preparando tudo para sua revisão.
          </p>
        </div>

        <div className="space-y-3">
          {AI_PROCESS_MESSAGES.map((message, index) => {
            const complete = index < stage;
            const active = index === stage;
            const hidden = index > stage + 1;
            if (hidden) return null;
            return (
              <div key={message} className={`flex items-start gap-3 transition-all duration-500 ${active ? "translate-x-1 opacity-100" : complete ? "opacity-70" : "opacity-35"}`}>
                <div className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${complete ? "bg-emerald-500/20 text-emerald-300" : active ? "bg-violet-500/20 text-violet-300" : "bg-white/5 text-stone-500"}`}>
                  {complete ? <Check className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </div>
                <div className={`max-w-[86%] rounded-2xl rounded-tl-sm border px-4 py-3 text-sm leading-relaxed ${active ? "border-violet-400/25 bg-violet-400/10 text-stone-100 shadow-lg shadow-violet-950/20" : "border-white/5 bg-white/[0.03] text-stone-400"}`}>
                  {message}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-violet-400 transition-all duration-700" style={{ width: `${Math.max(8, ((stage + 1) / AI_PROCESS_MESSAGES.length) * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

function ResumeScoreProcessingScreen() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setStage((current) => Math.min(SCORE_PROCESS_MESSAGES.length - 1, current + 1));
    }, 1800);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen overflow-hidden bg-stone-950 px-5 py-10 text-white flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-500/15 ring-1 ring-violet-400/30">
            <Sparkles className="h-8 w-8 text-violet-300 animate-pulse" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-300">Análise premium</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold">Vamos olhar seu currículo com olhos de recrutador</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-stone-400">A pontuação avalia o documento, nunca o valor ou potencial da pessoa.</p>
        </div>
        <div className="space-y-3">
          {SCORE_PROCESS_MESSAGES.map((message, index) => {
            if (index > stage + 1) return null;
            const complete = index < stage;
            const active = index === stage;
            return (
              <div key={message} className={`flex items-start gap-3 transition-all duration-500 ${active ? "translate-x-1 opacity-100" : complete ? "opacity-70" : "opacity-35"}`}>
                <div className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${complete ? "bg-emerald-500/20 text-emerald-300" : active ? "bg-violet-500/20 text-violet-300" : "bg-white/5 text-stone-500"}`}>
                  {complete ? <Check className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </div>
                <div className={`max-w-[86%] rounded-2xl rounded-tl-sm border px-4 py-3 text-sm leading-relaxed ${active ? "border-violet-400/25 bg-violet-400/10 text-stone-100" : "border-white/5 bg-white/[0.03] text-stone-400"}`}>
                  {message}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ResumeScoreOfferModal({ message, onLater, onContinue }: { message: string; onLater: () => void; onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white p-6 shadow-2xl sm:p-7">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-2xl font-bold text-stone-900">Seu currículo está pronto.</h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">Quer descobrir a pontuação do seu currículo, seus pontos fortes e o que pode ser melhorado?</p>
        <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-600">Análise profissional</span>
            <Lock className="h-4 w-4 text-violet-500" />
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="select-none text-4xl font-black text-stone-900 blur-[6px]">86</span>
            <span className="pb-1 text-sm font-bold text-stone-400">/100</span>
          </div>
          <p className="mt-2 text-[11px] text-stone-400">Prévia ilustrativa. Sua nota real ainda não foi calculada.</p>
        </div>
        {message && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">{message}</div>}
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button onClick={onLater} className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-bold text-stone-600 hover:bg-stone-50">Agora não</button>
          <button onClick={onContinue} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700">Quero ver minha pontuação</button>
        </div>
      </div>
    </div>
  );
}

function ResumeScoreCard({ analysis, unlocked, reviewing, onReview, onUpgrade }: { analysis?: ResumeAIAnalysis; unlocked: boolean; reviewing: boolean; onReview: () => void; onUpgrade: () => void }) {
  if (!unlocked) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Lock className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-violet-600">Análise profissional</p>
            <p className="mt-0.5 text-xs text-stone-500">Descubra a qualidade do documento e onde melhorar.</p>
          </div>
        </div>
        <div className="relative mt-4 overflow-hidden rounded-xl border border-violet-100 bg-white p-3">
          <div className="select-none blur-[5px]">
            <div className="flex items-end justify-between"><span className="text-3xl font-black text-stone-900">86<span className="text-xs text-stone-400">/100</span></span><span className="text-xs font-bold text-emerald-600">Muito bom</span></div>
            <div className="mt-2 h-2 rounded-full bg-violet-100"><div className="h-full w-[86%] rounded-full bg-violet-500" /></div>
            <div className="mt-3 space-y-1.5"><div className="h-2.5 w-full rounded bg-stone-200" /><div className="h-2.5 w-4/5 rounded bg-stone-200" /><div className="h-2.5 w-2/3 rounded bg-stone-200" /></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center"><div className="rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold text-violet-700 shadow-sm"><Lock className="mr-1 inline h-3 w-3" /> Pontuação bloqueada</div></div>
        </div>
        <p className="mt-2 text-[10px] text-stone-400">Visual ilustrativo. Nenhuma pontuação real foi calculada.</p>
        <button onClick={onUpgrade} className="mt-4 w-full rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-violet-700">Descobrir minha pontuação</button>
      </section>
    );
  }

  const score = Math.max(0, Math.min(100, Math.round(Number(analysis?.score) || 0)));
  return (
    <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Sparkles className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wider text-violet-600">Qualidade do currículo</p><p className="mt-0.5 text-xs text-stone-500">Nota do documento, não da pessoa.</p></div>
            {analysis?.score !== undefined && <div className="text-2xl font-black text-stone-900">{score}<span className="text-xs font-bold text-stone-400">/100</span></div>}
          </div>
          {analysis?.score !== undefined && <div className="mt-3 h-2 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${score}%` }} /></div>}
          {analysis?.feedbackText && <p className="mt-3 text-xs leading-relaxed text-stone-600">{analysis.feedbackText}</p>}
          {analysis?.suggestions && analysis.suggestions.length > 0 && <div className="mt-3 space-y-1.5">{analysis.suggestions.slice(0, 3).map((suggestion) => <div key={suggestion} className="flex items-start gap-2 text-xs text-stone-600"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" /><span>{suggestion}</span></div>)}</div>}
          <button onClick={onReview} disabled={reviewing} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50">
            {reviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BrainCircuit className="h-3.5 w-3.5" />}
            {analysis ? "Reavaliar currículo" : "Analisar meu currículo"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ToggleRow({ checked, onChange, label, icon }: { checked: boolean; onChange: (checked: boolean) => void; label: string; icon: React.ReactNode }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className={`w-10 h-6 rounded-full transition-colors flex items-center p-1 ${checked ? "bg-terracotta-500" : "bg-stone-300"}`}><div className={`w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${checked ? "translate-x-4" : "translate-x-0"}`} /></div>
      <span className="text-sm font-medium text-stone-700 flex items-center gap-2">{icon}{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="hidden" />
    </label>
  );
}

function FormField({ label, value, onChange, placeholder, disabled, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; disabled?: boolean; type?: string }) {
  return <div><label className="block text-sm font-semibold text-stone-700 mb-1">{label}</label><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} disabled={disabled} className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent disabled:bg-stone-100 disabled:text-stone-400" /></div>;
}

function ExperienceEditor({ value, onChange, onDelete }: { key?: React.Key; value: ProfessionalExperience; onChange: (value: ProfessionalExperience) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const experience = syncExperience(value);
  const stages = experience.timeline || [];
  const latest = [...stages].filter((stage) => stage.startDate).sort((a, b) => dateSortValue(a.startDate) - dateSortValue(b.startDate)).at(-1) || stages.at(-1);
  const updateStage = (index: number, patch: Partial<ExperienceTimelineEntry>) => {
    const timeline = stages.map((stage, stageIndex) => stageIndex === index ? normalizeStage({ ...stage, ...patch }) : stage);
    onChange(syncExperience({ ...experience, timeline }));
  };

  if (!editing) {
    return <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><div className="flex items-start justify-between gap-4"><div><div className="text-xs font-bold uppercase tracking-wider text-stone-400">{experience.company}</div><div className="mt-1 font-bold text-stone-900">{latest?.role || experience.role}</div><div className="mt-1 text-xs text-stone-500">{experience.startDate} – {experience.current ? "Atual" : experience.endDate}</div>{stages.length > 1 && <div className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700">{stages.length} etapas na empresa</div>}</div><div className="flex gap-1"><button onClick={() => setEditing(true)} className="rounded-lg p-2 text-stone-400 hover:bg-white hover:text-terracotta-600"><Edit3 className="h-4 w-4" /></button><button onClick={onDelete} className="rounded-lg p-2 text-stone-400 hover:bg-white hover:text-red-500"><Trash2 className="h-4 w-4" /></button></div></div></div>;
  }

  return (
    <div className="rounded-2xl border border-terracotta-200 bg-white p-4 sm:p-5 space-y-5">
      <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-4"><div><p className="text-xs font-bold uppercase tracking-wider text-terracotta-600">Trajetória na empresa</p><h3 className="font-bold text-stone-900">Edite cargos, períodos e descrições</h3></div><button onClick={() => setEditing(false)} className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-600">Concluir</button></div>
      <FormField label="Empresa *" value={experience.company} onChange={(company) => onChange({ ...experience, company })} />
      {stages.length > 1 && <div><label className="mb-1 block text-sm font-semibold text-stone-700">Descrição geral da passagem pela empresa (opcional)</label><textarea value={experience.description || ""} onChange={(event) => onChange({ ...experience, description: event.target.value })} rows={2} className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="Um resumo opcional da sua trajetória nessa empresa." /></div>}
      <div className="space-y-4">
        {stages.map((stage, index) => (
          <div key={stage.id || index} className="relative rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
            <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-terracotta-100 text-xs font-black text-terracotta-700">{index + 1}</span><span className="text-xs font-bold uppercase tracking-wider text-stone-500">Etapa da trajetória</span></div>{stages.length > 1 && <button onClick={() => onChange(syncExperience({ ...experience, timeline: stages.filter((_, stageIndex) => stageIndex !== index) }))} className="text-stone-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>}</div>
            <div className="grid gap-3 sm:grid-cols-2"><FormField label="Cargo / função *" value={stage.role} onChange={(role) => updateStage(index, { role })} placeholder="Ex.: Líder de Atendimento" /><FormField label="Início" value={monthYearToInput(stage.startDate)} onChange={(value) => updateStage(index, { startDate: monthInputToMonthYear(value) })} type="month" /><div><FormField label="Término" value={stage.current ? "" : monthYearToInput(stage.endDate)} onChange={(value) => updateStage(index, { endDate: monthInputToMonthYear(value) })} type="month" disabled={stage.current} /><label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs text-stone-600"><input type="checkbox" checked={stage.current} onChange={(event) => updateStage(index, { current: event.target.checked, endDate: event.target.checked ? "Atual" : "" })} className="rounded" /> Cargo atual</label></div></div>
            <div className="mt-3"><label className="mb-1 block text-sm font-semibold text-stone-700">Descrição desta etapa</label><textarea value={stage.description || ""} onChange={(event) => updateStage(index, { description: event.target.value })} rows={3} className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="Atividades, responsabilidades, resultados e conquistas deste cargo." /></div>
            {stage.skills && stage.skills.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{stage.skills.map((skill) => <span key={skill} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-600 border border-stone-200">{skill}</span>)}</div>}
          </div>
        ))}
      </div>
      <button onClick={() => onChange(syncExperience({ ...experience, timeline: [...stages.map((stage) => ({ ...stage, current: false, endDate: stage.current ? "" : stage.endDate })), { id: makeId("stage"), role: "", startDate: "", endDate: "", current: false, description: "", skills: [] }] }))} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/60 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"><Plus className="h-4 w-4" /> Adicionar evolução / novo cargo nesta empresa</button>
    </div>
  );
}

function ExperienceForm({ onAdd }: { onAdd: (experience: ProfessionalExperience) => void }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [current, setCurrent] = useState(false);
  const [description, setDescription] = useState("");
  const [companyOptions, setCompanyOptions] = useState<{ value: string; label: string }[]>([]);
  const handleCompanySearch = async (term: string) => { if (term.length < 2) return setCompanyOptions([]); try { const response = await api.get(`/companies/search?q=${encodeURIComponent(term)}`); setCompanyOptions((response.data || []).map((companyItem: { name: string }) => ({ value: companyItem.name, label: companyItem.name }))); } catch (error) { console.error(error); } };
  if (!open) return <button onClick={() => setOpen(true)} className="w-full py-3 border-2 border-dashed border-stone-300 rounded-2xl text-sm font-bold text-stone-500 hover:border-terracotta-400 hover:text-terracotta-600 transition-colors flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Adicionar experiência</button>;
  const handleAdd = () => {
    if (!role.trim() || !company.trim()) return;
    if (start && end && !current && end < start) { alert("O término da experiência não pode ser anterior ao início."); return; }
    const stage: ExperienceTimelineEntry = { id: makeId("stage"), role: role.trim(), startDate: monthInputToMonthYear(start), endDate: current ? "Atual" : monthInputToMonthYear(end), current, description, skills: [] };
    onAdd({ id: makeId("exp"), company: company.trim(), role: stage.role, startDate: stage.startDate, endDate: stage.endDate, current, description, skills: [], timeline: [stage] });
    setRole(""); setCompany(""); setStart(""); setEnd(""); setCurrent(false); setDescription(""); setOpen(false);
  };
  return <div className="border border-terracotta-200 bg-terracotta-50/30 rounded-2xl p-4 space-y-3"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><FormField label="Cargo *" value={role} onChange={setRole} placeholder="Vendedor" /><div className="z-20"><label className="block text-sm font-semibold text-stone-700 mb-1">Empresa *</label><SearchSelect value={company} onChange={setCompany} placeholder="Loja ABC" options={companyOptions} onSearch={handleCompanySearch} allowCustom customLabel="Adicionar empresa:" className="w-full" /></div><FormField label="Início" value={start} onChange={setStart} type="month" /><div><FormField label="Término" value={end} onChange={setEnd} type="month" disabled={current} /><label className="flex items-center gap-2 mt-1.5 cursor-pointer"><input type="checkbox" checked={current} onChange={(event) => { setCurrent(event.target.checked); if (event.target.checked) setEnd(""); }} className="rounded" /><span className="text-xs text-stone-600">Cargo atual</span></label></div></div><div><label className="block text-sm font-semibold text-stone-700 mb-1">Descrição desta etapa</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Atividades, responsabilidades, resultados e conquistas..." className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-500 resize-none" /></div><div className="flex gap-2 justify-end"><button onClick={() => setOpen(false)} className="text-sm text-stone-500 px-4 py-2">Cancelar</button><button onClick={handleAdd} className="bg-terracotta-600 text-white text-sm font-bold px-5 py-2 rounded-xl">Adicionar</button></div></div>;
}

function EducationEditor({ value, onChange, onDelete }: { key?: React.Key; value: AcademicEducation; onChange: (value: AcademicEducation) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  if (!editing) return <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 flex items-start justify-between gap-4"><div><div className="font-bold text-stone-900">{value.degree}{value.fieldOfStudy ? ` em ${value.fieldOfStudy}` : ""}</div><div className="text-sm text-stone-600">{value.institution}</div><div className="text-xs text-stone-500 mt-1">{value.startYear} – {value.current ? "Atual" : value.endYear}</div></div><div className="flex gap-1"><button onClick={() => setEditing(true)} className="p-2 text-stone-400 hover:text-terracotta-600"><Edit3 className="h-4 w-4" /></button><button onClick={onDelete} className="p-2 text-stone-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></div></div>;
  return <div className="rounded-2xl border border-terracotta-200 bg-white p-4 space-y-3"><div className="grid gap-3 sm:grid-cols-2"><FormField label="Instituição" value={value.institution} onChange={(institution) => onChange({ ...value, institution })} /><FormField label="Grau" value={value.degree} onChange={(degree) => onChange({ ...value, degree })} /><FormField label="Área de estudo" value={value.fieldOfStudy} onChange={(fieldOfStudy) => onChange({ ...value, fieldOfStudy })} /><FormField label="Ano de início" value={value.startYear} onChange={(startYear) => onChange({ ...value, startYear })} /><FormField label="Ano de término" value={value.current ? "" : value.endYear} onChange={(endYear) => onChange({ ...value, endYear })} disabled={value.current} /></div><label className="flex items-center gap-2 text-xs text-stone-600"><input type="checkbox" checked={value.current} onChange={(event) => onChange({ ...value, current: event.target.checked, endYear: event.target.checked ? "Atual" : "" })} /> Cursando atualmente</label><textarea value={value.description || ""} onChange={(event) => onChange({ ...value, description: event.target.value })} rows={2} placeholder="Descrição opcional, projetos, ênfases ou conquistas." className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-terracotta-500" />{value.skills && value.skills.length > 0 && <div className="flex flex-wrap gap-1.5">{value.skills.map((skill) => <span key={skill} className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-600">{skill}</span>)}</div>}<div className="flex justify-end"><button onClick={() => setEditing(false)} className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white">Concluir</button></div></div>;
}

function EducationForm({ onAdd }: { onAdd: (education: AcademicEducation) => void }) {
  const [open, setOpen] = useState(false); const [institution, setInstitution] = useState(""); const [degree, setDegree] = useState(""); const [field, setField] = useState(""); const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [current, setCurrent] = useState(false); const [institutionOptions, setInstitutionOptions] = useState<{ value: string; label: string }[]>([]);
  const searchInstitution = async (term: string) => { if (term.length < 2) return setInstitutionOptions([]); try { const response = await api.get(`/users/institutions/search?q=${encodeURIComponent(term)}`); setInstitutionOptions((response.data || []).map((item: { name: string }) => ({ value: item.name, label: item.name }))); } catch (error) { console.error(error); } };
  if (!open) return <button onClick={() => setOpen(true)} className="w-full py-3 border-2 border-dashed border-stone-300 rounded-2xl text-sm font-bold text-stone-500 hover:border-terracotta-400 hover:text-terracotta-600 transition-colors flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Adicionar formação</button>;
  const handleAdd = async () => { if (!institution.trim() || !degree.trim()) return; try { await api.post("/users/institutions", { name: institution }); } catch { /* catálogo auxiliar */ } onAdd({ id: makeId("edu"), institution, degree, fieldOfStudy: field, startYear: start, endYear: current ? "Atual" : end, current, skills: [] }); setInstitution(""); setDegree(""); setField(""); setStart(""); setEnd(""); setCurrent(false); setOpen(false); };
  return <div className="border border-terracotta-200 bg-terracotta-50/30 rounded-2xl p-4 space-y-3"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="block text-sm font-semibold text-stone-700 mb-1">Instituição *</label><SearchSelect value={institution} onChange={setInstitution} placeholder="Universidade X" options={institutionOptions} onSearch={searchInstitution} allowCustom customLabel="Adicionar nova instituição:" className="w-full" /></div><FormField label="Grau *" value={degree} onChange={setDegree} placeholder="Graduação / Técnico / Ensino Médio" /><FormField label="Área de estudo" value={field} onChange={setField} placeholder="Administração" /><FormField label="Ano de início" value={start} onChange={setStart} placeholder="2018" /><FormField label="Ano de término" value={end} onChange={setEnd} placeholder="2022" disabled={current} /></div><label className="flex items-center gap-2 text-xs text-stone-600"><input type="checkbox" checked={current} onChange={(event) => setCurrent(event.target.checked)} /> Cursando atualmente</label><div className="flex justify-end gap-2"><button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-stone-500">Cancelar</button><button onClick={handleAdd} className="rounded-xl bg-terracotta-600 px-5 py-2 text-sm font-bold text-white">Adicionar</button></div></div>;
}

function CourseEditor({ value, onChange, onDelete }: { key?: React.Key; value: ExtraCourse; onChange: (value: ExtraCourse) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  if (!editing) return <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 flex items-start justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{value.type === "CERTIFICATION" ? "Certificação" : "Curso"}</div><div className="font-bold text-stone-900">{value.name}</div><div className="text-sm text-stone-600">{value.institution}{value.year ? ` · ${value.year}` : ""}</div></div><div className="flex gap-1"><button onClick={() => setEditing(true)} className="p-2 text-stone-400 hover:text-terracotta-600"><Edit3 className="h-4 w-4" /></button><button onClick={onDelete} className="p-2 text-stone-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></div></div>;
  return <div className="rounded-2xl border border-terracotta-200 bg-white p-4 space-y-3"><div className="grid gap-3 sm:grid-cols-2"><FormField label="Nome" value={value.name} onChange={(name) => onChange({ ...value, name })} /><FormField label="Instituição" value={value.institution} onChange={(institution) => onChange({ ...value, institution })} /><FormField label="Ano" value={value.year} onChange={(year) => onChange({ ...value, year })} /><div><label className="block text-sm font-semibold text-stone-700 mb-1">Tipo</label><select value={value.type || "COURSE"} onChange={(event) => onChange({ ...value, type: event.target.value as "COURSE" | "CERTIFICATION" })} className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"><option value="COURSE">Curso</option><option value="CERTIFICATION">Certificação</option></select></div></div><textarea value={value.description || ""} onChange={(event) => onChange({ ...value, description: event.target.value })} rows={2} placeholder="Descrição opcional." className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-terracotta-500" />{value.skills && value.skills.length > 0 && <div className="flex flex-wrap gap-1.5">{value.skills.map((skill) => <span key={skill} className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-600">{skill}</span>)}</div>}<div className="flex justify-end"><button onClick={() => setEditing(false)} className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white">Concluir</button></div></div>;
}

function CourseForm({ onAdd }: { onAdd: (course: ExtraCourse) => void }) {
  const [open, setOpen] = useState(false); const [name, setName] = useState(""); const [institution, setInstitution] = useState(""); const [year, setYear] = useState(""); const [type, setType] = useState<"COURSE" | "CERTIFICATION">("COURSE");
  if (!open) return <button onClick={() => setOpen(true)} className="w-full py-3 border-2 border-dashed border-stone-300 rounded-2xl text-sm font-bold text-stone-500 hover:border-terracotta-400 hover:text-terracotta-600 transition-colors flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Adicionar curso ou certificação</button>;
  const handleAdd = () => { if (!name.trim()) return; onAdd({ id: makeId("course"), name, institution, year, type, skills: [] }); setName(""); setInstitution(""); setYear(""); setType("COURSE"); setOpen(false); };
  return <div className="border border-terracotta-200 bg-terracotta-50/30 rounded-2xl p-4 space-y-3"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><FormField label="Nome *" value={name} onChange={setName} placeholder="Excel Avançado" /><FormField label="Instituição" value={institution} onChange={setInstitution} placeholder="Senai" /><FormField label="Ano" value={year} onChange={setYear} placeholder="2025" /><div><label className="block text-sm font-semibold text-stone-700 mb-1">Tipo</label><select value={type} onChange={(event) => setType(event.target.value as "COURSE" | "CERTIFICATION")} className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"><option value="COURSE">Curso</option><option value="CERTIFICATION">Certificação</option></select></div></div><div className="flex justify-end gap-2"><button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-stone-500">Cancelar</button><button onClick={handleAdd} className="rounded-xl bg-terracotta-600 px-5 py-2 text-sm font-bold text-white">Adicionar</button></div></div>;
}

function LanguageForm({ onAdd }: { onAdd: (language: Language) => void }) {
  const [open, setOpen] = useState(false); const [name, setName] = useState(""); const [level, setLevel] = useState("Básico");
  if (!open) return <button onClick={() => setOpen(true)} className="w-full py-3 border-2 border-dashed border-stone-300 rounded-2xl text-sm font-bold text-stone-500 hover:border-terracotta-400 hover:text-terracotta-600 transition-colors flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Adicionar idioma</button>;
  const handleAdd = () => { if (!name.trim()) return; onAdd({ name, level }); setName(""); setLevel("Básico"); setOpen(false); };
  return <div className="border border-terracotta-200 bg-terracotta-50/30 rounded-2xl p-4 space-y-3"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><FormField label="Idioma *" value={name} onChange={setName} placeholder="Inglês" /><div><label className="block text-sm font-semibold text-stone-700 mb-1">Nível</label><select value={level} onChange={(event) => setLevel(event.target.value)} className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm">{LANGUAGE_LEVELS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></div><div className="flex justify-end gap-2"><button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-stone-500">Cancelar</button><button onClick={handleAdd} className="rounded-xl bg-terracotta-600 px-5 py-2 text-sm font-bold text-white">Adicionar</button></div></div>;
}
