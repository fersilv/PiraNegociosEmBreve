import React from 'react';
import { ArrowRight, Building2, MapPinned, ShieldCheck } from 'lucide-react';
import { CompanyClassifiedsShowcase } from '../company-page/CompanyClassifiedsShowcase';
import { CompanyReviewsShowcase } from '../company-page/CompanyReviewsShowcase';
import { AboutBlock, BusinessHoursBadge, CompanyActions, CompanyLocation, CompanyLogo, CompanySocials, JobsSection, PlatformFooter, VerifiedPill } from './CompanySiteShared';
import type { CompanySiteConfig, PublicCompanyLike, PublicJobLike } from './types';

export function InstitutionalCompanySite({company,jobs,config}:{company:PublicCompanyLike;jobs:PublicJobLike[];config:CompanySiteConfig}){
 return <div className="min-h-screen bg-[#f4f6f8] text-slate-950">
  <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-20 max-w-7xl items-center gap-4 px-5 sm:px-7"><CompanyLogo company={company} size="sm"/><strong className="min-w-0 flex-1 truncate text-base">{company.name}</strong><nav className="hidden items-center gap-6 text-[11px] font-black text-slate-500 lg:flex"><a href="#sobre">Institucional</a><a href="#vitrine">Atuação</a>{jobs.length>0&&<a href="#vagas">Carreiras</a>}<a href="#contato">Contato</a></nav><BusinessHoursBadge config={config.businessHours}/></div></header>
  <main><section className="relative overflow-hidden bg-[#0c2742] text-white"><div className="absolute inset-y-0 right-0 w-1/2 bg-[linear-gradient(135deg,transparent,rgba(255,255,255,.06))]"/><div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-7 sm:py-28 lg:grid-cols-[1.15fr_.85fr] lg:items-center"><div><VerifiedPill dark/><p className="mt-8 text-[10px] font-black uppercase tracking-[.22em] text-sky-200/55">Presença institucional</p><h1 className="mt-3 max-w-4xl text-5xl font-black tracking-[-.06em] sm:text-7xl">{company.name}</h1><p className="mt-6 max-w-2xl text-base leading-8 text-white/60">{company.description||'Conheça a organização, sua atuação regional e os canais oficiais de relacionamento.'}</p><div className="mt-6"><CompanyLocation company={company} dark/></div><div className="mt-8"><CompanyActions company={company} dark/></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1"><Info icon={<ShieldCheck/>} title="Identidade verificada" text="Informações vinculadas ao cadastro empresarial no PiraNegócios."/><Info icon={<MapPinned/>} title="Atuação regional" text={[company.city,company.state].filter(Boolean).join(' - ')||company.cityState||'Região'}/><Info icon={<Building2/>} title="Relacionamento" text="Canais, oportunidades e presença comercial reunidos em um único endereço."/></div></div></section>
  <AboutBlock company={company}/>
  <CompanyClassifiedsShowcase companyId={company.id} companyName={company.name} companySlug={company.slug} variant="default"/>
  <JobsSection company={company} jobs={jobs} tone="accent" title="Oportunidades na organização"/>
  <CompanyReviewsShowcase companyId={company.id} companyName={company.name}/>
  </main><PlatformFooter company={company}/>
 </div>;
}
function Info({icon,title,text}:{icon:React.ReactNode;title:string;text:string}){return <div className="rounded-[26px] border border-white/10 bg-white/[.06] p-5"><div className="h-5 w-5 text-sky-200">{icon}</div><strong className="mt-5 block text-sm">{title}</strong><p className="mt-2 text-xs leading-5 text-white/45">{text}</p></div>}
