import React from 'react';
import { Briefcase, MapPin, DollarSign, Laptop, CheckCircle2 } from 'lucide-react';
import { Job } from '../types/job';
import { ShareJobButtons } from './ShareJobButtons';

interface JobCardProps {
  key?: React.Key;
  job: Job;
  onClick: () => void;
  hasApplied?: boolean;
}

export function getRelativeTimeString(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSec = Math.round((date.getTime() - now.getTime()) / 1000);
  
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  
  if (Math.abs(diffInSec) < 60) return rtf.format(diffInSec, 'second');
  const diffInMin = Math.round(diffInSec / 60);
  if (Math.abs(diffInMin) < 60) return rtf.format(diffInMin, 'minute');
  const diffInHour = Math.round(diffInMin / 60);
  if (Math.abs(diffInHour) < 24) return rtf.format(diffInHour, 'hour');
  const diffInDay = Math.round(diffInHour / 24);
  if (Math.abs(diffInDay) < 30) return rtf.format(diffInDay, 'day');
  const diffInMonth = Math.round(diffInDay / 30);
  if (Math.abs(diffInMonth) < 12) return rtf.format(diffInMonth, 'month');
  const diffInYear = Math.round(diffInDay / 365);
  return rtf.format(diffInYear, 'year');
}

export function JobCard({ job, onClick, hasApplied = false }: JobCardProps) {
  return (
    <div 
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className={`text-left p-5 rounded-2xl transition-all duration-300 hover:shadow-lg w-full flex flex-col gap-3
        ${job.isSponsored 
          ? 'bg-terracotta-50/80 border border-terracotta-200 hover:border-terracotta-400' 
          : 'bg-white border border-stone-200 hover:border-terracotta-300'
        }`}
    >
      <div className="flex justify-between items-start gap-4">
        <div>
          <h4 className="font-semibold text-stone-900 text-lg line-clamp-1 flex items-center gap-2">
            {job.title}
            {job.isTalentPool && (
              <span className="bg-purple-100 text-purple-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded shrink-0">Banco de Talentos</span>
            )}
            {hasApplied && (
              <span className="bg-green-100 text-green-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded shrink-0 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Inscrito</span>
            )}
            {job.acceptsPlatformApplications === false && (
              <span className="bg-amber-100 text-amber-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded shrink-0">Candidatura externa</span>
            )}
          </h4>
          <p className="text-terracotta-700 text-sm font-medium flex items-center gap-1.5">
            {job.isConfidential ? 'Empresa Confidencial' : job.companyName}
            {!job.isConfidential && job.isCompanyVerified && (
              <span 
                className="inline-flex items-center justify-center bg-blue-50 border border-blue-200 text-blue-600 p-0.5 rounded-full cursor-help hover:bg-blue-100 transition-colors shrink-0" 
                title="Esta empresa passou por verificação documental"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            )}
          </p>
        </div>
        {job.isSponsored && (
          <span className="bg-terracotta-100 text-terracotta-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider shrink-0">
            Destaque
          </span>
        )}
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mt-auto pt-2 gap-4 border-t border-stone-100">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-1.5 text-xs text-stone-500">
            <MapPin className="w-3.5 h-3.5" />
            {job.location}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-stone-500">
            <Briefcase className="w-3.5 h-3.5" />
            {job.type}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-bold text-stone-700 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-md">
            <Laptop className="w-3 h-3 text-terracotta-600" />
            {job.workModel || 'Presencial'}
          </span>
          {job.salary && (
            <span className="flex items-center gap-1.5 text-xs text-stone-500">
              <DollarSign className="w-3.5 h-3.5" />
              {job.salary}
            </span>
          )}
          {job.updatedAt && (
            <span className="text-[10px] text-stone-400 font-medium ml-1">
              Atualizado {getRelativeTimeString(job.updatedAt)}
            </span>
          )}
        </div>
        
        <div onClick={(e) => e.stopPropagation()} className="shrink-0 -mt-2">
          <ShareJobButtons 
            title={job.title}
            url={`https://piranegocios.com.br/vagas/${job.slug || job.id}`}
            companyName={job.isConfidential ? "Empresa Confidencial" : job.companyName}
            location={job.location}
            salary={job.salary}
            workModel={job.workModel}
            acceptsPlatformApplications={job.acceptsPlatformApplications}
            hideEmbed
          />
        </div>
      </div>
    </div>
  );
}
