import React, { useState } from 'react';
import {
  X,
  User,
  Briefcase,
  GraduationCap,
  Award,
  Phone,
  Mail,
  FileText,
  PhoneCall,
  Linkedin,
  Target,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { openBase64InNewTab } from '../lib/fileViewer';
import {
  PublishedResumeViewerModal,
  type PublishedResumeSnapshotLike,
} from './PublishedResumeViewerModal';

export interface ProfessionalExperience {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
  skills?: string[];
}

export interface ExtraCourse {
  name: string;
  institution: string;
  year: string;
}

export interface AcademicEducation {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startYear: string;
  endYear: string;
  current: boolean;
  status?: 'CONCLUIDO' | 'EM_ANDAMENTO' | 'TRANCADO' | 'INTERROMPIDO';
}

export interface ResumeAIAnalysis {
  suggestions: string[];
  feedbackText: string;
  parsedAt?: string;
}

export interface CandidateJobCompatibility {
  score: number;
  occupationalScore?: number;
  technicalScore?: number;
  experienceScore?: number;
  educationScore?: number;
  preferenceScore?: number;
  evidence?: string[];
  missingRequirements?: string[];
  reason?: string;
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  boosted?: boolean;
}

interface CandidateProfileModalProps {
  candidate: {
    name: string;
    treatment?: string;
    phone: string;
    email: string;
    bio?: string;
    photoURL?: string;
    resumeURL?: string;
    resumeStatus?: 'DRAFT' | 'PUBLISHED';
    publishedResumeSnapshot?: PublishedResumeSnapshotLike | null;
    linkedinURL?: string;
    additionalPhones?: string[];
    experiences?: ProfessionalExperience[];
    skills?: string[];
    courses?: ExtraCourse[];
    education?: AcademicEducation[];
    aiAnalysis?: ResumeAIAnalysis;
  } | null;
  compatibility?: CandidateJobCompatibility | null;
  compatibilityJobTitle?: string;
  isOpen: boolean;
  onClose: () => void;
}

function scoreLabel(score: number) {
  if (score >= 75) return 'Aderência forte';
  if (score >= 55) return 'Boa aderência';
  if (score >= 35) return 'Aderência parcial';
  return 'Baixa aderência';
}

function MatchMetric({ label, value }: { label: string; value?: number }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold text-stone-500">
        <span>{label}</span><span>{Math.round(safeValue)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full rounded-full bg-terracotta-500" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

function isRealFileUrl(value?: string) {
  if (!value) return false;
  return value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://') || value.startsWith('blob:');
}

export function CandidateProfileModal({ candidate, compatibility, compatibilityJobTitle, isOpen, onClose }: CandidateProfileModalProps) {
  const [publishedResumeOpen, setPublishedResumeOpen] = useState(false);
  if (!isOpen || !candidate) return null;

  const hasPublishedSnapshot = Boolean(candidate.publishedResumeSnapshot);
  const hasLegacyFile = isRealFileUrl(candidate.resumeURL);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 md:p-8 border border-stone-200 shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col md:flex-row gap-8">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-stone-400 hover:text-stone-900 p-2 rounded-full hover:bg-stone-100 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex-1 space-y-8 pr-0 md:pr-4 md:border-r md:border-stone-100">
            <div className="flex items-start gap-4">
              {candidate.photoURL ? (
                <div className="w-16 h-16 rounded-full overflow-hidden border border-stone-200 bg-stone-50 shrink-0">
                  <img referrerPolicy="no-referrer" src={candidate.photoURL} alt={candidate.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0 text-stone-400">
                  <User className="w-8 h-8" />
                </div>
              )}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-serif font-bold text-stone-900 leading-tight">
                    {candidate.treatment ? `${candidate.treatment} ` : ''}{candidate.name}
                  </h2>
                  {compatibility?.boosted && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-violet-700">
                      <Zap className="h-3 w-3" /> Em destaque
                    </span>
                  )}
                </div>
                <span className="inline-block text-xs font-bold uppercase bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full tracking-wider">
                  Candidato Cadastrado
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Resumo Profissional</h4>
              <p className="text-sm text-stone-700 leading-relaxed font-sans">
                {candidate.bio || 'Nenhum resumo profissional inserido pelo candidato.'}
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-stone-100 pb-2">
                <Briefcase className="w-4 h-4 text-terracotta-600" />
                Histórico Profissional
              </h4>
              {candidate.experiences && candidate.experiences.length > 0 ? (
                <div className="space-y-4">
                  {candidate.experiences.map((exp, idx) => (
                    <div key={idx} className="bg-stone-50/50 border border-stone-200/50 p-4 rounded-2xl relative">
                      <h5 className="font-bold text-stone-900 text-sm">{exp.role}</h5>
                      <p className="text-xs text-stone-600 font-bold mt-0.5">{exp.company}</p>
                      <span className="inline-block text-[10px] font-mono font-medium text-stone-400 mt-1">{exp.startDate} - {exp.endDate}</span>
                      {exp.description && <p className="text-xs text-stone-600 mt-2.5 leading-relaxed">{exp.description}</p>}
                      {exp.skills && exp.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {exp.skills.map((sk, skIdx) => <span key={skIdx} className="text-[9px] bg-stone-100 border border-stone-200/50 text-stone-600 px-2 py-0.5 rounded-md font-medium">{sk}</span>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-stone-400 italic font-sans">Nenhuma experiência profissional cadastrada.</p>}
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-stone-100 pb-2">
                <GraduationCap className="w-4 h-4 text-terracotta-600" />
                Escolaridade e Formação Acadêmica
              </h4>
              {candidate.education && candidate.education.length > 0 ? (
                <div className="space-y-3">
                  {candidate.education.map((edu, idx) => (
                    <div key={idx} className="bg-stone-50/50 border border-stone-200/50 p-4 rounded-xl">
                      <h5 className="font-bold text-stone-900 text-sm">{edu.degree} em {edu.fieldOfStudy}</h5>
                      <p className="text-xs text-stone-600 font-bold mt-0.5">{edu.institution}</p>
                      <span className="text-[10px] font-mono font-medium text-stone-400 mt-1 block">{edu.startYear} - {edu.endYear}</span>
                      {edu.status && (
                        <span className="inline-block mt-2 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 bg-stone-100 text-stone-600 rounded">
                          {edu.status === 'CONCLUIDO' && 'Concluído'}
                          {edu.status === 'EM_ANDAMENTO' && 'Em andamento'}
                          {edu.status === 'TRANCADO' && 'Trancado'}
                          {edu.status === 'INTERROMPIDO' && 'Interrompido'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-stone-400 italic font-sans">Nenhuma formação acadêmica cadastrada.</p>}
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-stone-100 pb-2">
                <Award className="w-4 h-4 text-terracotta-600" />
                Cursos e Certificações Livres
              </h4>
              {candidate.courses && candidate.courses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {candidate.courses.map((course, idx) => (
                    <div key={idx} className="bg-stone-50/30 border border-stone-200/40 p-3 rounded-xl flex flex-col justify-between">
                      <div><h5 className="font-bold text-stone-900 text-xs">{course.name}</h5><p className="text-[10px] text-stone-500 mt-0.5">{course.institution}</p></div>
                      <span className="text-[9px] font-mono text-stone-400 mt-2 block">{course.year}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-stone-400 italic font-sans">Nenhum curso complementar cadastrado.</p>}
            </div>
          </div>

          <div className="w-full md:w-80 space-y-6">
            {compatibility && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.13em] text-emerald-700"><Target className="h-3.5 w-3.5" /> Compatibilidade</p>
                    {compatibilityJobTitle && <p className="mt-1 text-[10px] text-emerald-800/70">com {compatibilityJobTitle}</p>}
                  </div>
                  <div className="text-right"><strong className="text-2xl font-black text-emerald-800">{Math.round(Number(compatibility.score || 0))}%</strong><p className="text-[9px] font-bold text-emerald-700">{scoreLabel(Number(compatibility.score || 0))}</p></div>
                </div>

                {compatibility.reason && <p className="mt-3 text-[11px] leading-5 text-emerald-900/80">{compatibility.reason}</p>}

                <div className="mt-4 space-y-2.5 rounded-xl bg-white/80 p-3">
                  <MatchMetric label="Aderência ocupacional" value={compatibility.occupationalScore} />
                  <MatchMetric label="Competências técnicas" value={compatibility.technicalScore} />
                  <MatchMetric label="Experiência" value={compatibility.experienceScore} />
                  <MatchMetric label="Formação / certificações" value={compatibility.educationScore} />
                  <MatchMetric label="Localização / preferência" value={compatibility.preferenceScore} />
                </div>

                {compatibility.evidence && compatibility.evidence.length > 0 && (
                  <div className="mt-4">
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Evidências de aderência</p>
                    <div className="mt-2 space-y-1.5">{compatibility.evidence.slice(0, 6).map((item) => <p key={item} className="text-[10px] leading-4 text-stone-700">✓ {item}</p>)}</div>
                  </div>
                )}

                {compatibility.missingRequirements && compatibility.missingRequirements.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Pontos a validar</p>
                    <div className="mt-2 space-y-1.5">{compatibility.missingRequirements.slice(0, 6).map((item) => <p key={item} className="text-[10px] leading-4 text-amber-900">• {item}</p>)}</div>
                  </div>
                )}

                <p className="mt-3 text-[9px] leading-4 text-stone-500">Indicador auxiliar baseado no currículo e nos requisitos da vaga. Não substitui análise humana do processo seletivo.</p>
              </div>
            )}

            <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200/80 space-y-4">
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Informações de Contato</h4>
              <div className="space-y-3 font-sans text-stone-700 text-xs">
                <div className="flex items-center gap-2.5"><Phone className="w-4 h-4 text-stone-400 shrink-0" /><span className="font-bold">{candidate.phone || 'Não informado'}</span></div>
                <div className="flex items-center gap-2.5"><Mail className="w-4 h-4 text-stone-400 shrink-0" /><a href={`mailto:${candidate.email}`} className="font-medium hover:underline text-stone-800 break-all">{candidate.email}</a></div>
                {candidate.additionalPhones && candidate.additionalPhones.length > 0 && (
                  <div className="pt-2.5 border-t border-stone-200/60 space-y-2">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Telefones Adicionais:</span>
                    {candidate.additionalPhones.map((addPhone, idx) => <div key={idx} className="flex items-center gap-2.5 text-stone-600"><PhoneCall className="w-3.5 h-3.5 text-stone-400 shrink-0" /><span>{addPhone}</span></div>)}
                  </div>
                )}
                {candidate.linkedinURL && (
                  <div className="pt-2.5 border-t border-stone-200/60 flex items-center gap-2.5">
                    <Linkedin className="w-4 h-4 text-sky-600 shrink-0" />
                    <a href={candidate.linkedinURL.startsWith('http') ? candidate.linkedinURL : `https://${candidate.linkedinURL}`} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline text-sky-700">Perfil do LinkedIn</a>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Habilidades e Competências</h4>
              {candidate.skills && candidate.skills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">{candidate.skills.map((skill, idx) => <span key={idx} className="px-2.5 py-1 bg-terracotta-50 text-terracotta-800 text-[10px] font-bold rounded-lg border border-terracotta-100/60">{skill}</span>)}</div>
              ) : <p className="text-xs text-stone-400 italic">Nenhuma competência cadastrada.</p>}
            </div>

            {hasPublishedSnapshot ? (
              <button onClick={() => setPublishedResumeOpen(true)} className="w-full bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all">
                <FileText className="w-4 h-4 text-terracotta-400" /> Visualizar PDF do Currículo
              </button>
            ) : hasLegacyFile ? (
              <button onClick={() => openBase64InNewTab(candidate.resumeURL!, `Currículo_${candidate.name}`)} className="w-full bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all">
                <FileText className="w-4 h-4 text-terracotta-400" /> Visualizar arquivo do currículo
              </button>
            ) : (
              <div className="text-xs text-stone-400 text-center italic bg-stone-50 border border-stone-200/60 p-3 rounded-xl">Nenhuma versão publicada do currículo disponível.</div>
            )}
          </div>
        </div>
      </div>

      <PublishedResumeViewerModal
        snapshot={candidate.publishedResumeSnapshot}
        fallbackName={candidate.name}
        isOpen={publishedResumeOpen}
        onClose={() => setPublishedResumeOpen(false)}
      />
    </>
  );
}
