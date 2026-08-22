import React, { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  Globe2,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { openBase64InNewTab } from "../lib/fileViewer";
import { CandidateWorkPreferencesCard } from "../components/CandidateWorkPreferencesCard";
import { ResumeBuilderStudio } from "./ResumeBuilderStudio";

const ACCEPTED_RESUME_FILES = [
  ".pdf", ".doc", ".docx", ".txt", ".rtf",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/rtf", "application/rtf", "image/png", "image/jpeg",
].join(",");
const MAX_FILES = 8;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 36 * 1024 * 1024;

type Stage = "resume" | "preferences" | "publish";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function keyOf(...values: unknown[]) {
  return values.map((value) => String(value || "").trim().toLocaleLowerCase("pt-BR")).join("|");
}

function mergeUnique<T>(current: T[], incoming: T[], key: (item: T) => string): T[] {
  const map = new Map<string, T>();
  [...current, ...incoming].forEach((item) => {
    const itemKey = key(item);
    if (itemKey) map.set(itemKey, item);
  });
  return Array.from(map.values());
}

function isResumeDocument(file: File) {
  return !file.type.startsWith("image/");
}

function publishedDateLabel(value: string | undefined) {
  if (!value) return "data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data não informada";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function ResumeWorkspace() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedStage = searchParams.get("stage");
  const initialStage: Stage = requestedStage === "preferences" || requestedStage === "publish" ? requestedStage : "resume";
  const [stage, setStageState] = useState<Stage>(initialStage);
  const [open, setOpen] = useState(searchParams.get("import") === "1");
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [openingStoredFile, setOpeningStoredFile] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setStage = (next: Stage) => {
    setStageState(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next === "resume") nextParams.delete("stage"); else nextParams.set("stage", next);
    nextParams.delete("import");
    setSearchParams(nextParams, { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);
  const completionSignals = useMemo(() => [
    Boolean(profile?.fullName?.trim()),
    Boolean(profile?.phone?.trim()),
    Boolean(profile?.city && profile?.state) || Boolean(profile?.address?.trim()),
    Boolean(profile?.bio?.trim()),
    Boolean(profile?.experiences?.length || profile?.education?.length),
    Boolean(profile?.skills?.length),
  ], [profile]);
  const completeness = Math.round((completionSignals.filter(Boolean).length / completionSignals.length) * 100);
  const score = profile?.aiAnalysis?.score !== undefined
    ? Math.max(0, Math.min(100, Math.round(Number(profile.aiAnalysis.score))))
    : null;
  const publishedSnapshot = profile?.publishedResumeSnapshot || null;
  const hasPublishedVersion = Boolean(publishedSnapshot) || profile?.resumeStatus === "PUBLISHED";
  const online = profile?.resumeStatus === "PUBLISHED" && hasPublishedVersion;
  const publishedScore = typeof publishedSnapshot?.score === "number" ? publishedSnapshot.score : null;
  const publishedAt = publishedSnapshot?.publishedAt || profile?.resumePublishedAt;

  const draftDiffersFromPublished = useMemo(() => {
    if (!publishedSnapshot) return true;
    const draft = {
      fullName: profile?.fullName || "",
      socialName: profile?.socialName || "",
      phone: profile?.phone || "",
      city: profile?.city || "",
      state: profile?.state || "",
      address: profile?.address || "",
      bio: profile?.bio || "",
      experiences: profile?.experiences || [],
      education: profile?.education || [],
      skills: profile?.skills || [],
      courses: profile?.courses || [],
      languages: profile?.languages || [],
      salaryExpectation: profile?.salaryExpectation || "",
      resumePhotoURL: profile?.resumePhotoURL || "",
      resumePreferences: profile?.resumePreferences || {},
    };
    const frozen = {
      fullName: publishedSnapshot.fullName || "",
      socialName: publishedSnapshot.socialName || "",
      phone: publishedSnapshot.phone || "",
      city: publishedSnapshot.city || "",
      state: publishedSnapshot.state || "",
      address: publishedSnapshot.address || "",
      bio: publishedSnapshot.bio || "",
      experiences: publishedSnapshot.experiences || [],
      education: publishedSnapshot.education || [],
      skills: publishedSnapshot.skills || [],
      courses: publishedSnapshot.courses || [],
      languages: publishedSnapshot.languages || [],
      salaryExpectation: publishedSnapshot.salaryExpectation || "",
      resumePhotoURL: publishedSnapshot.resumePhotoURL || "",
      resumePreferences: publishedSnapshot.resumePreferences || {},
    };
    return JSON.stringify(draft) !== JSON.stringify(frozen);
  }, [profile, publishedSnapshot]);

  const chooseFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected: File[] = Array.from<File>(event.target.files || []);
    event.target.value = "";
    setError("");
    setSuccess("");
    if (selected.length > MAX_FILES) return setError(`Selecione no máximo ${MAX_FILES} arquivos por vez.`);
    const tooLarge = selected.find((file) => file.size > MAX_FILE_BYTES);
    if (tooLarge) return setError(`${tooLarge.name} excede o limite de 20 MB.`);
    const total = selected.reduce((sum, file) => sum + file.size, 0);
    if (total > MAX_TOTAL_BYTES) return setError("O conjunto de arquivos excede 36 MB. Reduza a quantidade ou o tamanho dos documentos.");
    setFiles(selected);
    setOpen(true);
  };

  const importDocuments = async () => {
    if (!files.length || processing) return;
    setProcessing(true);
    setError("");
    setSuccess("");
    try {
      const documents = await Promise.all(files.map(async (file) => ({
        base64File: await readAsDataUrl(file),
        mimeType: file.type,
        fileName: file.name,
      })));
      const response = await api.post("/ai/analyze-resume-documents", { documents }, { timeout: 180000 });
      const data = response.data || {};
      const experiences = mergeUnique(profile?.experiences || [], Array.isArray(data.experiences) ? data.experiences : [], (item: any) => keyOf(item.company, item.role));
      const education = mergeUnique(profile?.education || [], Array.isArray(data.education) ? data.education : [], (item: any) => keyOf(item.institution, item.degree, item.fieldOfStudy));
      const courses = mergeUnique(profile?.courses || [], Array.isArray(data.courses) ? data.courses : [], (item: any) => keyOf(item.name, item.institution));
      const skills = mergeUnique(profile?.skills || [], Array.isArray(data.skills) ? data.skills.map(String) : [], (item: string) => keyOf(item));
      const languages = mergeUnique(profile?.languages || [], Array.isArray(data.languages) ? data.languages : [], (item: any) => keyOf(item.name));
      const primaryIndex = Math.max(0, files.findIndex(isResumeDocument));
      const primary = files[primaryIndex];
      const primaryData = documents[primaryIndex]?.base64File;

      await api.patch("/users/me", {
        fullName: data.name || profile?.fullName || profile?.displayName,
        phone: data.phone || profile?.phone,
        bio: data.bio || profile?.bio,
        experiences,
        education,
        courses,
        skills,
        languages,
        uploadedResumeFile: primary && primaryData ? {
          name: primary.name,
          mimeType: primary.type || "application/octet-stream",
          size: primary.size,
          dataUrl: primaryData,
          uploadedAt: new Date().toISOString(),
        } : undefined,
      });
      await refreshProfile();
      setFiles([]);
      setOpen(false);
      setSuccess(`${Number(data.documentsProcessed || documents.length)} arquivo(s) organizado(s). As alterações ficaram no rascunho; a última versão publicada, se existir, não foi alterada.`);
    } catch (uploadError: any) {
      console.error("Erro ao importar currículo/documentos:", uploadError);
      setError(uploadError?.response?.data?.message || uploadError?.response?.data?.error || uploadError?.message || "Não foi possível importar os documentos agora.");
    } finally {
      setProcessing(false);
    }
  };

  const openStoredFile = async () => {
    if (openingStoredFile) return;
    setOpeningStoredFile(true);
    setError("");
    try {
      const response = await api.get("/users/me/resume-file");
      const file = response.data;
      if (!file?.dataUrl || !file?.name) throw new Error("Arquivo não encontrado.");
      openBase64InNewTab(file.dataUrl, file.name);
    } catch (fileError: any) {
      setError(fileError?.response?.data?.message || fileError?.message || "Não foi possível abrir o arquivo.");
    } finally {
      setOpeningStoredFile(false);
    }
  };

  const removeStoredFile = async () => {
    if (!profile?.uploadedResumeFile) return;
    if (!window.confirm(`Remover o arquivo ${profile.uploadedResumeFile.name}? Os dados extraídos continuarão no rascunho e a versão publicada não será alterada.`)) return;
    try {
      await api.patch("/users/me", { uploadedResumeFile: null });
      await refreshProfile();
      setSuccess("Arquivo-base removido. O currículo estruturado continua salvo.");
    } catch (removeError: any) {
      setError(removeError?.response?.data?.message || "Não foi possível remover o arquivo agora.");
    }
  };

  const leaveWithDraft = () => navigate("/user");

  const publishResume = async () => {
    setPublishing(true);
    setError("");
    try {
      await api.patch("/users/me", { resumeStatus: "PUBLISHED" });
      await refreshProfile();
      setPublishConfirmOpen(false);
      setSuccess("Nova versão publicada. O rascunho e a versão online agora estão sincronizados.");
    } catch (publishError: any) {
      setError(publishError?.response?.data?.message || "Não foi possível publicar o currículo.");
    } finally {
      setPublishing(false);
    }
  };

  const unpublishResume = async () => {
    if (!online || publishing) return;
    if (!window.confirm("Tirar o currículo do ar? A última versão publicada ficará preservada e seu rascunho continuará salvo.")) return;
    setPublishing(true);
    setError("");
    try {
      await api.patch("/users/me", { resumeStatus: "DRAFT" });
      await refreshProfile();
      setSuccess("Currículo retirado do ar. A última versão publicada foi preservada e o rascunho continua salvo.");
    } catch (unpublishError: any) {
      setError(unpublishError?.response?.data?.message || "Não foi possível tirar o currículo do ar.");
    } finally {
      setPublishing(false);
    }
  };

  const scoreMessage = score === null
    ? "Seu rascunho ainda não tem uma pontuação disponível. Você pode publicar mesmo assim e revisar depois."
    : score >= 75
      ? `O rascunho atual está com ${score}/100. É uma faixa forte, mas a decisão de publicar continua sendo sua.`
      : score >= 55
        ? `O rascunho atual está com ${score}/100. Está utilizável, mas ainda há melhorias recomendadas.`
        : `O rascunho atual está com ${score}/100. Há pontos importantes para melhorar antes de substituir a versão publicada.`;

  const topStatus = online ? "Online" : hasPublishedVersion ? "Fora do ar" : "Somente rascunho";
  const topStatusClass = online
    ? "bg-emerald-100 text-emerald-700"
    : hasPublishedVersion
      ? "bg-stone-200 text-stone-600"
      : "bg-amber-100 text-amber-700";

  return (
    <div className="resume-workflow min-h-screen bg-[#f5efe8] text-[#241914]">
      <style>{`
        @media print { .resume-workflow-nav,.resume-source-bar,.resume-stage-actions,.resume-import-modal,.resume-publish-modal { display:none!important; } }
        .resume-workflow .resume-studio-body .bg-gradient-to-br.from-violet-50.to-blue-50 { display:none!important; }
      `}</style>

      <input ref={fileInputRef} type="file" accept={ACCEPTED_RESUME_FILES} multiple onChange={chooseFiles} className="hidden" />

      <div className="resume-workflow-nav sticky top-0 z-[65] border-b border-[#5b4030]/10 bg-[#fffaf5]/95 px-3 py-3 backdrop-blur-xl sm:px-5">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto">
          <button type="button" onClick={() => navigate("/user")} className="mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600" aria-label="Voltar ao meu espaço">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <StageButton number="1" label="Currículo" active={stage === "resume"} done={Boolean(profile?.bio || profile?.experiences?.length || profile?.education?.length)} onClick={() => setStage("resume")} />
          <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
          <StageButton number="2" label="Preferências" active={stage === "preferences"} done={Boolean(profile?.city && profile?.state)} onClick={() => setStage("preferences")} />
          <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
          <StageButton number="3" label="Versões e publicação" active={stage === "publish"} done={hasPublishedVersion} onClick={() => setStage("publish")} />
          <span className={`ml-auto hidden shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[.12em] sm:inline-flex ${topStatusClass}`}>{topStatus}</span>
        </div>
      </div>

      {stage === "resume" && (
        <>
          <section className="resume-source-bar mx-auto max-w-7xl px-3 pt-4 sm:px-5">
            <div className="flex flex-col gap-3 rounded-[24px] border border-[#ddcfc3] bg-[#fffdfa] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[.15em] text-terracotta-600">Documento-base</p>
                {profile?.uploadedResumeFile ? (
                  <><p className="mt-1 truncate text-sm font-bold text-stone-900">{profile.uploadedResumeFile.name}</p><p className="mt-1 text-[11px] text-stone-500">{(profile.uploadedResumeFile.size / 1024 / 1024).toFixed(1)} MB · disponível para vagas que exigem arquivo</p></>
                ) : (
                  <><p className="mt-1 text-sm font-bold text-stone-900">Nenhum arquivo guardado</p><p className="mt-1 text-[11px] text-stone-500">Opcional. O currículo estruturado publicado basta quando a empresa não exigir arquivo.</p></>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {profile?.uploadedResumeFile && <button type="button" disabled={openingStoredFile} onClick={() => void openStoredFile()} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs font-bold text-stone-700 disabled:opacity-50">{openingStoredFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Abrir arquivo</button>}
                <button type="button" onClick={() => { setError(""); setSuccess(""); fileInputRef.current?.click(); }} className="inline-flex items-center gap-2 rounded-xl bg-[#2b211c] px-3.5 py-2.5 text-xs font-bold text-white"><Upload className="h-4 w-4 text-[#f0b99d]" /> {profile?.uploadedResumeFile ? "Substituir / importar" : "Importar currículo"}</button>
                {profile?.uploadedResumeFile && <button type="button" onClick={() => void removeStoredFile()} className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-600"><Trash2 className="h-4 w-4" /> Remover</button>}
              </div>
            </div>
            {hasPublishedVersion && draftDiffersFromPublished && <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">Você está editando o <strong>rascunho</strong>. A última versão publicada continua congelada e {online ? "permanece online" : "está fora do ar"} até você publicar o rascunho.</div>}
            {hasPublishedVersion && !online && !draftDiffersFromPublished && <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-100 px-4 py-3 text-xs font-semibold text-stone-600">Existe uma versão publicada preservada, mas ela está <strong>fora do ar</strong>.</div>}
            {error && <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
            {success && <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">{success}</div>}
          </section>
          <ResumeBuilderStudio />
          <div className="resume-stage-actions sticky bottom-0 z-[60] border-t border-stone-200 bg-[#fffdfa]/96 p-3 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl justify-end"><button onClick={() => setStage("preferences")} className="inline-flex items-center gap-2 rounded-xl bg-[#2b211c] px-5 py-3 text-sm font-bold text-white">Continuar: preferências <ChevronRight className="h-4 w-4" /></button></div>
          </div>
        </>
      )}

      {stage === "preferences" && (
        <main className="mx-auto max-w-6xl space-y-5 px-3 py-5 sm:px-5 sm:py-7">
          <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-terracotta-600">Etapa 2 de 3</p><h1 className="mt-1 font-serif text-3xl font-bold">Preferências profissionais</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Cidade, mobilidade, CNH, veículo e informações PCD deixam candidaturas e matches mais realistas.</p></div>
          <CandidateWorkPreferencesCard />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><button onClick={() => setStage("resume")} className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-bold text-stone-600">Voltar ao currículo</button><button onClick={() => setStage("publish")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2b211c] px-5 py-3 text-sm font-bold text-white">Versões e publicação <ChevronRight className="h-4 w-4" /></button></div>
        </main>
      )}

      {stage === "publish" && (
        <main className="mx-auto max-w-6xl px-3 py-6 sm:px-5 sm:py-9">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-terracotta-600">Etapa 3 de 3</p><h1 className="mt-1 font-serif text-3xl font-bold">Versões do seu currículo</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Seu rascunho pode evoluir sem alterar a última versão publicada. Estar publicado e estar online agora são estados diferentes.</p></div>
            <button type="button" onClick={() => navigate("/user")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-bold text-stone-600"><ArrowLeft className="h-4 w-4" /> Voltar ao meu espaço</button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <VersionCard
              title="Última versão publicada"
              icon={<Globe2 className="h-5 w-5" />}
              tone="published"
              statusLabel={hasPublishedVersion ? (online ? "Online" : "Fora do ar") : "Sem versão"}
              active={hasPublishedVersion}
              subtitle={hasPublishedVersion ? `Publicada em ${publishedDateLabel(publishedAt)}` : "Você ainda não congelou uma versão para publicação."}
            >
              {hasPublishedVersion ? (
                <>
                  <div className="grid grid-cols-2 gap-3"><Metric label="Pontuação publicada" value={publishedScore === null ? "Sem nota" : `${publishedScore}/100`} tone={publishedScore !== null && publishedScore >= 70 ? "good" : "warn"} /><Metric label="Visibilidade" value={online ? "Online" : "Fora do ar"} tone={online ? "good" : "warn"} /></div>
                  <p className="mt-4 text-xs leading-5 text-stone-500">Esta é uma versão congelada. Editar o rascunho não altera este conteúdo. Novas candidaturas sem exigência de arquivo só usam esta versão enquanto ela estiver online.</p>
                  {online && <button disabled={publishing} onClick={() => void unpublishResume()} className="mt-5 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 disabled:opacity-50">Tirar currículo do ar</button>}
                </>
              ) : <p className="text-sm leading-6 text-stone-500">Seu rascunho continua salvo. Quando estiver pronto, publique para criar a primeira versão congelada.</p>}
            </VersionCard>

            <VersionCard
              title="Rascunho atual"
              icon={<FileText className="h-5 w-5" />}
              tone="draft"
              statusLabel="Editável"
              active
              subtitle={hasPublishedVersion ? (draftDiffersFromPublished ? "Tem alterações ainda não publicadas" : "Igual à última versão publicada") : "Sua versão de trabalho"}
            >
              <div className="grid grid-cols-2 gap-3"><Metric label="Completude" value={`${completeness}%`} tone={completeness >= 80 ? "good" : "warn"} /><Metric label="Pontuação atual" value={score === null ? "Sem nota" : `${score}/100`} tone={score !== null && score >= 70 ? "good" : "warn"} /></div>
              <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-600">{scoreMessage}</div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2"><button onClick={() => setStage("resume")} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-bold text-stone-600">Continuar editando</button><button disabled={publishing || (online && hasPublishedVersion && !draftDiffersFromPublished)} onClick={() => setPublishConfirmOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-45"><CheckCircle2 className="h-4 w-4" /> {online ? "Publicar nova versão" : hasPublishedVersion ? "Publicar rascunho" : "Publicar currículo"}</button></div>
            </VersionCard>
          </div>

          <section className="mt-4 rounded-[26px] border border-stone-200 bg-white p-5">
            <h2 className="font-serif text-xl font-bold text-stone-950">Checklist do rascunho</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <ReviewItem done={Boolean(profile?.fullName)} label="Identificação" />
              <ReviewItem done={Boolean(profile?.city && profile?.state)} label="Preferências" />
              <ReviewItem done={Boolean(profile?.bio)} label="Resumo" />
              <ReviewItem done={Boolean(profile?.experiences?.length || profile?.education?.length)} label="Trajetória" />
              <ReviewItem done={Boolean(profile?.skills?.length)} label="Competências" />
            </div>
          </section>

          {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
          {success && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">{success}</div>}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setStage("preferences")} className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-bold text-stone-600">Revisar preferências</button>
            <button type="button" onClick={leaveWithDraft} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2b211c] px-5 py-3 text-sm font-bold text-white"><Save className="h-4 w-4" /> Salvar rascunho e sair</button>
          </div>
        </main>
      )}

      {open && (
        <div className="resume-import-modal fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-5" onClick={() => !processing && setOpen(false)}>
          <section className="w-full max-w-xl rounded-t-[30px] border border-white/10 bg-[#fffdfa] p-5 shadow-2xl sm:rounded-[30px] sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Sparkles className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-600">Importação inteligente</p><h2 className="mt-1 font-serif text-2xl font-bold text-stone-950">Use o currículo que você já tem</h2><p className="mt-2 text-xs leading-5 text-stone-500">Word, PDF, TXT, RTF e imagens. A importação altera o rascunho, nunca a versão publicada.</p></div><button type="button" disabled={processing} onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100"><X className="h-4 w-4" /></button></div>
            {files.length === 0 ? <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-5 flex w-full flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-violet-200 bg-violet-50/45 px-4 py-7 text-center"><Upload className="h-7 w-7 text-violet-600" /><strong className="mt-3 text-sm text-stone-900">Selecionar documentos</strong><span className="mt-1 text-[11px] text-stone-500">PDF, DOC, DOCX, TXT, RTF, PNG e JPG · 20 MB por arquivo</span></button> : <div className="mt-5 space-y-2 rounded-2xl border border-stone-200 bg-stone-50/70 p-3">{files.map((file) => <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate font-bold text-stone-700">{file.name}</span><span className="shrink-0 text-stone-400">{(file.size / 1024 / 1024).toFixed(1)} MB</span></div>)}<div className="border-t border-stone-200 pt-2 text-right text-[10px] font-bold text-stone-400">Total: {(totalSize / 1024 / 1024).toFixed(1)} MB</div></div>}
            {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button disabled={processing} onClick={() => setOpen(false)} className="rounded-xl border border-stone-200 px-4 py-3 text-xs font-bold text-stone-600">Fechar</button>{files.length > 0 && <button disabled={processing} onClick={() => void importDocuments()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-xs font-black text-white disabled:opacity-40">{processing ? <><Loader2 className="h-4 w-4 animate-spin" /> Organizando...</> : <><Sparkles className="h-4 w-4" /> Importar e aplicar</>}</button>}</div>
          </section>
        </div>
      )}

      {publishConfirmOpen && (
        <div className="resume-publish-modal fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/55 p-4 backdrop-blur-sm" onClick={() => !publishing && setPublishConfirmOpen(false)}>
          <section className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-6 w-6" /></span>
            <h2 className="mt-5 font-serif text-2xl font-bold text-stone-950">{hasPublishedVersion ? "Publicar o rascunho como nova versão?" : "Publicar este currículo?"}</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">{scoreMessage}</p>
            <p className="mt-3 text-xs leading-5 text-stone-400">{hasPublishedVersion ? `${online ? "A versão online atual continuará intacta até você confirmar." : "A última versão publicada está fora do ar e continuará preservada até você confirmar."} Ao publicar, o rascunho será congelado como a nova versão e ficará online.` : "Seu rascunho será congelado como a primeira versão publicada. Depois você poderá continuar editando um novo rascunho sem alterar esta versão."}</p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2"><button disabled={publishing} onClick={() => setPublishConfirmOpen(false)} className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-bold text-stone-600">Agora não</button><button disabled={publishing} onClick={() => void publishResume()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white">{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar publicação</button></div>
          </section>
        </div>
      )}
    </div>
  );
}

function StageButton({ number, label, active, done, onClick }: { number: string; label: string; active: boolean; done: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${active ? "bg-[#2b211c] text-white" : "text-stone-500 hover:bg-stone-100"}`}><span className={`flex h-6 w-6 items-center justify-center rounded-lg text-[10px] ${active ? "bg-white/10" : done ? "bg-emerald-100 text-emerald-700" : "bg-stone-100"}`}>{done && !active ? <Check className="h-3 w-3" /> : number}</span>{label}</button>;
}

function VersionCard({ title, subtitle, icon, tone, active, statusLabel, children }: { title: string; subtitle: string; icon: React.ReactNode; tone: "published" | "draft"; active: boolean; statusLabel: string; children: React.ReactNode }) {
  const publishedTone = tone === "published";
  return <section className={`rounded-[28px] border p-5 shadow-sm sm:p-6 ${publishedTone ? "border-emerald-200 bg-[#fbfffc]" : "border-[#ddcfc3] bg-[#fffdfa]"}`}><div className="flex items-start gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${publishedTone ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{icon}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-serif text-2xl font-bold text-stone-950">{title}</h2><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[.12em] ${active ? (publishedTone ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700") : "bg-stone-100 text-stone-400"}`}>{statusLabel}</span></div><p className="mt-1 text-xs text-stone-500">{subtitle}</p></div></div><div className="mt-5">{children}</div></section>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" }) {
  return <div className={`rounded-2xl border p-4 ${tone === "good" ? "border-emerald-100 bg-emerald-50" : "border-amber-100 bg-amber-50"}`}><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">{label}</p><p className="mt-1 text-xl font-black text-stone-950">{value}</p></div>;
}

function ReviewItem({ done, label }: { done: boolean; label: string }) {
  return <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white p-3"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${done ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-400"}`}>{done ? <Check className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-current" />}</span><span className="text-xs font-bold text-stone-700">{label}</span></div>;
}
