import React, { useMemo, useState } from "react";
import { FileText, Loader2, Sparkles, Upload, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { ResumeBuilderStudio } from "./ResumeBuilderStudio";

const ACCEPTED_RESUME_FILES = [
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".rtf",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/rtf",
  "application/rtf",
  "image/png",
  "image/jpeg",
].join(",");
const MAX_FILES = 8;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 36 * 1024 * 1024;

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

export function ResumeWorkspace() {
  const { profile, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  const chooseFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected: File[] = Array.from<File>(event.target.files || []);
    event.target.value = "";
    setError("");
    setSuccess("");
    if (selected.length > MAX_FILES) {
      setError(`Selecione no máximo ${MAX_FILES} arquivos por vez.`);
      return;
    }
    const tooLarge = selected.find((file) => file.size > MAX_FILE_BYTES);
    if (tooLarge) {
      setError(`${tooLarge.name} excede o limite de 20 MB.`);
      return;
    }
    const total = selected.reduce((sum, file) => sum + file.size, 0);
    if (total > MAX_TOTAL_BYTES) {
      setError("O conjunto de arquivos excede 36 MB. Reduza a quantidade ou o tamanho dos documentos.");
      return;
    }
    setFiles(selected);
  };

  const importDocuments = async () => {
    if (!files.length || processing) return;
    setProcessing(true);
    setError("");
    setSuccess("");
    try {
      const documents = await Promise.all(
        files.map(async (file) => ({
          base64File: await readAsDataUrl(file),
          mimeType: file.type,
          fileName: file.name,
        })),
      );
      const response = await api.post(
        "/ai/analyze-resume-documents",
        { documents },
        { timeout: 180000 },
      );
      const data = response.data || {};
      const experiences = mergeUnique(
        profile?.experiences || [],
        Array.isArray(data.experiences) ? data.experiences : [],
        (item: any) => keyOf(item.company, item.role),
      );
      const education = mergeUnique(
        profile?.education || [],
        Array.isArray(data.education) ? data.education : [],
        (item: any) => keyOf(item.institution, item.degree, item.fieldOfStudy),
      );
      const courses = mergeUnique(
        profile?.courses || [],
        Array.isArray(data.courses) ? data.courses : [],
        (item: any) => keyOf(item.name, item.institution),
      );
      const skills = mergeUnique(
        profile?.skills || [],
        Array.isArray(data.skills) ? data.skills.map(String) : [],
        (item: string) => keyOf(item),
      );
      const languages = mergeUnique(
        profile?.languages || [],
        Array.isArray(data.languages) ? data.languages : [],
        (item: any) => keyOf(item.name),
      );

      await api.patch("/users/me", {
        fullName: data.name || profile?.fullName || profile?.displayName,
        phone: data.phone || profile?.phone,
        bio: data.bio || profile?.bio,
        experiences,
        education,
        courses,
        skills,
        languages,
      });
      await refreshProfile();
      setFiles([]);
      setSuccess(`${Number(data.documentsProcessed || documents.length)} arquivo(s) organizado(s). Os dados já foram aplicados ao seu currículo.`);
    } catch (uploadError: any) {
      console.error("Erro ao importar currículo/documentos:", uploadError);
      setError(
        uploadError?.response?.data?.message ||
          uploadError?.response?.data?.error ||
          uploadError?.message ||
          "Não foi possível importar os documentos agora.",
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="relative">
      <style>{`@media print { .resume-import-control, .resume-import-modal { display: none !important; } }`}</style>
      <ResumeBuilderStudio />

      <button
        type="button"
        onClick={() => { setOpen(true); setError(""); setSuccess(""); }}
        className="resume-import-control fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-[70] inline-flex items-center gap-2 rounded-2xl bg-[#2b211c] px-4 py-3 text-xs font-black text-white shadow-[0_18px_55px_rgba(43,33,28,.28)] transition hover:-translate-y-0.5 hover:bg-[#3a2b24] sm:bottom-7 sm:right-7 sm:px-5 sm:text-sm"
      >
        <Upload className="h-4 w-4 text-[#f0b99d]" /> Importar Word, PDF ou documentos
      </button>

      {open && (
        <div className="resume-import-modal fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-5" onClick={() => !processing && setOpen(false)}>
          <section className="w-full max-w-xl rounded-t-[30px] border border-white/10 bg-[#fffdfa] p-5 shadow-2xl sm:rounded-[30px] sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Sparkles className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-600">Importação inteligente</p>
                <h2 className="mt-1 font-serif text-2xl font-bold text-stone-950">Use o currículo que você já tem</h2>
                <p className="mt-2 text-xs leading-5 text-stone-500">Word, PDF, texto, RTF e imagens podem ser combinados. A IA extrai os dados e aplica ao perfil para você revisar.</p>
              </div>
              <button type="button" disabled={processing} onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 disabled:opacity-40" aria-label="Fechar"><X className="h-4 w-4" /></button>
            </div>

            <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-violet-200 bg-violet-50/45 px-4 py-7 text-center transition hover:border-violet-400 hover:bg-violet-50">
              <FileText className="h-7 w-7 text-violet-600" />
              <strong className="mt-3 text-sm text-stone-900">Selecionar Word, currículo ou documentos</strong>
              <span className="mt-1 text-[11px] text-stone-500">PDF, DOC, DOCX, TXT, RTF, PNG e JPG</span>
              <span className="mt-1 text-[10px] text-stone-400">até 8 arquivos · 20 MB por arquivo · 36 MB no conjunto</span>
              <input type="file" accept={ACCEPTED_RESUME_FILES} multiple onChange={chooseFiles} className="hidden" />
            </label>

            {files.length > 0 && (
              <div className="mt-4 space-y-2 rounded-2xl border border-stone-200 bg-stone-50/70 p-3">
                {files.map((file) => <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate font-bold text-stone-700">{file.name}</span><span className="shrink-0 text-stone-400">{(file.size / 1024 / 1024).toFixed(1)} MB</span></div>)}
                <div className="border-t border-stone-200 pt-2 text-right text-[10px] font-bold text-stone-400">Total: {(totalSize / 1024 / 1024).toFixed(1)} MB</div>
              </div>
            )}

            {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold leading-5 text-red-700">{error}</div>}
            {success && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold leading-5 text-emerald-700">{success}</div>}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={processing} onClick={() => setOpen(false)} className="rounded-xl border border-stone-200 px-4 py-3 text-xs font-bold text-stone-600 disabled:opacity-40">Fechar</button>
              <button type="button" disabled={!files.length || processing} onClick={() => void importDocuments()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-xs font-black text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40">
                {processing ? <><Loader2 className="h-4 w-4 animate-spin" /> Organizando documentos...</> : <><Sparkles className="h-4 w-4" /> Importar e aplicar dados</>}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
