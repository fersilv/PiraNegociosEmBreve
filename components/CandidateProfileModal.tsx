import React from 'react';
import { 
  X, 
  User, 
  Briefcase, 
  GraduationCap, 
  Award, 
  Phone, 
  Mail, 
  FileText, 
  Sparkles, 
  Check, 
  PhoneCall,
  Linkedin
} from 'lucide-react';
import { openBase64InNewTab } from '../lib/fileViewer';

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

interface CandidateProfileModalProps {
  candidate: {
    name: string;
    treatment?: string;
    phone: string;
    email: string;
    bio?: string;
    photoURL?: string;
    resumeURL?: string;
    linkedinURL?: string;
    additionalPhones?: string[];
    experiences?: ProfessionalExperience[];
    skills?: string[];
    courses?: ExtraCourse[];
    education?: AcademicEducation[];
    aiAnalysis?: ResumeAIAnalysis;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CandidateProfileModal({ candidate, isOpen, onClose }: CandidateProfileModalProps) {
  if (!isOpen || !candidate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 md:p-8 border border-stone-200 shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col md:flex-row gap-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-stone-400 hover:text-stone-900 p-2 rounded-full hover:bg-stone-100 transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Side: Professional and Educational History */}
        <div className="flex-1 space-y-8 pr-0 md:pr-4 md:border-r md:border-stone-100">
          {/* Header Profile Info */}
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
              <h2 className="text-2xl font-serif font-bold text-stone-900 leading-tight">
                {candidate.treatment ? `${candidate.treatment} ` : ''}{candidate.name}
              </h2>
              <span className="inline-block text-xs font-bold uppercase bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full tracking-wider">
                Candidato Cadastrado
              </span>
            </div>
          </div>

          {/* Bio Summary */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Resumo Profissional</h4>
            <p className="text-sm text-stone-700 leading-relaxed font-sans">
              {candidate.bio || 'Nenhum resumo profissional inserido pelo candidato.'}
            </p>
          </div>

          {/* Professional Experience */}
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
                    {exp.description && (
                      <p className="text-xs text-stone-600 mt-2.5 leading-relaxed">{exp.description}</p>
                    )}
                    {exp.skills && exp.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {exp.skills.map((sk, skIdx) => (
                          <span key={skIdx} className="text-[9px] bg-stone-100 border border-stone-200/50 text-stone-600 px-2 py-0.5 rounded-md font-medium">
                            {sk}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-400 italic font-sans">Nenhuma experiência profissional cadastrada.</p>
            )}
          </div>

          {/* Academic Education */}
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
            ) : (
              <p className="text-xs text-stone-400 italic font-sans">Nenhuma formação acadêmica cadastrada.</p>
            )}
          </div>

          {/* Courses & Licenses */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-stone-100 pb-2">
              <Award className="w-4 h-4 text-terracotta-600" />
              Cursos e Certificações Livres
            </h4>
            
            {candidate.courses && candidate.courses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {candidate.courses.map((course, idx) => (
                  <div key={idx} className="bg-stone-50/30 border border-stone-200/40 p-3 rounded-xl flex flex-col justify-between">
                    <div>
                      <h5 className="font-bold text-stone-900 text-xs">{course.name}</h5>
                      <p className="text-[10px] text-stone-500 mt-0.5">{course.institution}</p>
                    </div>
                    <span className="text-[9px] font-mono text-stone-400 mt-2 block">{course.year}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-400 italic font-sans">Nenhum curso complementar cadastrado.</p>
            )}
          </div>
        </div>

        {/* Right Side: Skills, Contact and AI insights */}
        <div className="w-full md:w-80 space-y-6">
          {/* Primary Contacts */}
          <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200/80 space-y-4">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Informações de Contato</h4>
            <div className="space-y-3 font-sans text-stone-700 text-xs">
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-stone-400 shrink-0" />
                <span className="font-bold">{candidate.phone || 'Não informado'}</span>
              </div>
              
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-stone-400 shrink-0" />
                <a href={`mailto:${candidate.email}`} className="font-medium hover:underline text-stone-800 break-all">
                  {candidate.email}
                </a>
              </div>

              {/* Additional Phone List */}
              {candidate.additionalPhones && candidate.additionalPhones.length > 0 && (
                <div className="pt-2.5 border-t border-stone-200/60 space-y-2">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Telefones Adicionais:</span>
                  {candidate.additionalPhones.map((addPhone, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-stone-600">
                      <PhoneCall className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span>{addPhone}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* LinkedIn Link */}
              {candidate.linkedinURL && (
                <div className="pt-2.5 border-t border-stone-200/60 flex items-center gap-2.5">
                  <Linkedin className="w-4 h-4 text-sky-600 shrink-0" />
                  <a 
                    href={candidate.linkedinURL.startsWith('http') ? candidate.linkedinURL : `https://${candidate.linkedinURL}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="font-bold hover:underline text-sky-700"
                  >
                    Perfil do LinkedIn
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Skills and Competencies */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Habilidades e Competências</h4>
            {candidate.skills && candidate.skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills.map((skill, idx) => (
                  <span key={idx} className="px-2.5 py-1 bg-terracotta-50 text-terracotta-800 text-[10px] font-bold rounded-lg border border-terracotta-100/60">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-400 italic">Nenhuma competência cadastrada.</p>
            )}
          </div>

          {/* Download Original Resume */}
          {candidate.resumeURL ? (
            <button
              onClick={() => openBase64InNewTab(candidate.resumeURL!, `Currículo_${candidate.name}`)}
              className="w-full bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all"
            >
              <FileText className="w-4 h-4 text-terracotta-400" />
              Visualizar PDF do Currículo
            </button>
          ) : (
            <div className="text-xs text-stone-400 text-center italic bg-stone-50 border border-stone-200/60 p-3 rounded-xl">
              Nenhum PDF de currículo anexado.
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
