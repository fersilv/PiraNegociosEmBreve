import React from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Accessibility,
  MapPin,
  Briefcase,
  Laptop,
  DollarSign,
  Clock,
  ExternalLink,
  X,
  CheckCircle2,
  FileCheck2,
  FileText,
} from "lucide-react";
import { Job } from "../types/job";
import { JobReportForm } from "./JobReportForm";
import { ExternalApplicationActions } from "./ExternalApplicationActions";
import { useAuth } from "../contexts/AuthContext";

interface JobModalProps {
  job: Job;
  hasApplied?: boolean;
  onClose: () => void;
  onApply: () => void;
}

function safeSourceHref(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function JobModal({ job, hasApplied, onClose, onApply }: JobModalProps) {
  const sourceHref = safeSourceHref(job.sourceUrl);
  const pcdMode = job.pcdMode || "GENERAL";
  const { profile } = useAuth();
  const navigate = useNavigate();
  const hasStoredFile = Boolean(
    profile?.uploadedResumeFile?.dataUrl?.startsWith("data:") ||
    (profile?.resumeURL && (/^https?:\/\//i.test(profile.resumeURL) || profile.resumeURL.startsWith("data:"))),
  );
  const hasPublishedStructuredResume = profile?.resumeStatus === "PUBLISHED";
  const resumeIssue = job.requiresResumeFile
    ? (!hasStoredFile ? "Esta empresa exige um arquivo de currículo. Importe um PDF, Word ou outro documento antes de se candidatar." : "")
    : (!hasPublishedStructuredResume ? "Para esta vaga não é necessário anexar arquivo, mas seu currículo estruturado precisa estar publicado." : "");

  const handleApply = () => {
    if (resumeIssue) {
      onClose();
      navigate(job.requiresResumeFile ? "/user/curriculo?import=1" : "/user/curriculo?stage=publish");
      return;
    }
    onApply();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-offwhite w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-offwhite/90 backdrop-blur-md p-4 flex justify-between items-center border-b border-stone-200/50 z-10">
          <span className="text-xs font-bold tracking-widest text-terracotta-600 uppercase">Detalhes da Vaga</span>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-200/50 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              {pcdMode === "INCLUSIVE" && <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold text-sky-800"><Accessibility className="h-3.5 w-3.5" /> Também aberta a PCD</span>}
              {pcdMode === "EXCLUSIVE" && <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-bold text-violet-800"><Accessibility className="h-3.5 w-3.5" /> Exclusiva para PCD</span>}
              {job.acceptsPlatformApplications !== false && <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${job.requiresResumeFile ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{job.requiresResumeFile ? <FileCheck2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}{job.requiresResumeFile ? "Currículo em arquivo obrigatório" : "Currículo publicado é suficiente"}</span>}
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-stone-900 mb-2 flex items-center gap-3">{job.title}{job.isTalentPool && <span className="bg-purple-100 text-purple-700 text-xs uppercase font-bold px-3 py-1 rounded-lg shrink-0">Banco de Talentos</span>}</h2>
            <p className="text-terracotta-700 text-lg font-medium flex items-center gap-1.5">{job.isConfidential ? "Empresa Confidencial" : job.companyName}{!job.isConfidential && job.isCompanyVerified && <span className="inline-flex items-center justify-center bg-blue-50 border border-blue-200 text-blue-600 p-0.5 rounded-full cursor-help hover:bg-blue-100 transition-colors shrink-0" title="Esta empresa passou por verificação documental"><CheckCircle2 className="w-4 h-4" /></span>}</p>
          </div>

          <div className="flex flex-wrap gap-4 py-4 border-y border-stone-200/50">
            <Meta icon={<MapPin className="w-4 h-4 text-terracotta-500" />} value={job.location} />
            <Meta icon={<Briefcase className="w-4 h-4 text-terracotta-500" />} value={job.type} />
            <Meta icon={<Laptop className="w-4 h-4 text-terracotta-500" />} value={job.workModel || "Presencial"} />
            {job.salary && <Meta icon={<DollarSign className="w-4 h-4 text-terracotta-500" />} value={job.salary} />}
            <Meta icon={<Clock className="w-4 h-4 text-terracotta-500" />} value={job.postedAt} />
          </div>

          <div><h3 className="font-semibold text-stone-900 mb-3">Sobre a vaga</h3><p className="text-stone-600 whitespace-pre-line leading-relaxed">{job.description}</p></div>
          {job.requirements && <div><h3 className="font-semibold text-stone-900 mb-3">Requisitos</h3><p className="text-stone-600 whitespace-pre-line leading-relaxed">{job.requirements}</p></div>}

          {(job.sourceName || sourceHref) && <div className="rounded-2xl border border-stone-200 bg-white/75 p-4"><p className="text-[10px] font-bold uppercase tracking-[.17em] text-stone-400">Origem da oportunidade</p><div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-stone-800">{job.sourceName || "Fonte externa"}</p>{job.isExternalListing && <p className="mt-0.5 text-xs text-stone-500">Confira a publicação original antes de enviar dados fora da plataforma.</p>}</div>{sourceHref && <a href={sourceHref} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 hover:border-terracotta-300 hover:text-terracotta-700">Ver vaga na fonte <ExternalLink className="h-3.5 w-3.5" /></a>}</div></div>}

          {job.acceptsPlatformApplications !== false && resumeIssue && !hasApplied && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-bold text-amber-900">Antes de se candidatar</p><p className="mt-1 text-xs leading-5 text-amber-800">{resumeIssue}</p></div>}

          <div className="pt-6 border-t border-stone-200/50 flex flex-col sm:flex-row gap-4">
            {job.acceptsPlatformApplications === false ? (
              <div className="flex-1 rounded-xl bg-amber-50 border border-amber-200 px-5 py-3 text-sm text-amber-900"><p className="font-bold">Candidatura externa</p><ExternalApplicationActions title={job.title} instructions={job.externalApplicationInstructions} email={job.applicationEmail} whatsapp={job.applicationWhatsApp} /></div>
            ) : hasApplied ? (
              <button disabled className="flex-1 bg-green-100 text-green-700 py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 opacity-100 cursor-default"><CheckCircle2 className="w-5 h-5" /> Candidatura Enviada</button>
            ) : (
              <button onClick={handleApply} className={`flex-1 py-3 px-6 rounded-xl font-medium transition-colors shadow-lg ${resumeIssue ? "bg-stone-900 hover:bg-stone-800 text-white shadow-stone-900/10" : "bg-terracotta-600 hover:bg-terracotta-700 text-white shadow-terracotta-600/20"}`}>{resumeIssue ? (job.requiresResumeFile ? "Importar currículo para continuar" : "Revisar e publicar currículo") : (job.isTalentPool ? "Enviar Currículo" : "Candidatar-se à vaga")}</button>
            )}
            <button onClick={onClose} className="px-6 py-3 rounded-xl font-medium text-stone-600 hover:bg-stone-200/50 transition-colors">Voltar</button>
          </div>
          <JobReportForm jobId={job.id} />
        </div>
      </div>
      <div className="fixed inset-0 -z-10" onClick={onClose} />
    </div>,
    document.body,
  );
}

function Meta({ icon, value }: { icon: React.ReactNode; value?: string }) {
  return <div className="flex items-center gap-2 text-sm text-stone-600"><div className="bg-white p-2 rounded-lg shadow-sm">{icon}</div>{value || "Não informado"}</div>;
}
