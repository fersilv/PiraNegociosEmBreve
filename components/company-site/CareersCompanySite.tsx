import React from 'react';
import { BriefcaseBusiness, UsersRound } from 'lucide-react';
import { CompanyClassifiedsShowcase } from '../company-page/CompanyClassifiedsShowcase';
import { CompanyReviewsShowcase } from '../company-page/CompanyReviewsShowcase';
import { AboutBlock, BusinessHoursBadge, CompanyActions, CompanyLocation, CompanyLogo, JobsSection, PlatformFooter, VerifiedPill } from './CompanySiteShared';
import type { CompanySiteConfig, PublicCompanyLike, PublicJobLike } from './types';

export function CareersCompanySite({company,jobs,config}:{company:PublicCompanyLike;jobs:PublicJobLike[];config:CompanySiteConfig}){
 return <div className="min-h-screen bg-[#eef2ff] text-slate-950">
  <header className="bg-[#181b3a] text-white"><div className="mx-auto flex min-h-16 max-w-7xl items-center gap-4 px-5 sm:px-7"><CompanyLogo company={company} dark size="sm"/><strong className="min-w-0 flex-1 truncate">{company.name}</strong><span className="hidden text-[10px] font-black uppercase tracking-[.16em] text-white/40 sm:block">Carreiras</span><BusinessHoursBadge config={config.businessHours} dark/></div></header>
  <section className="relative overflow-hidden bg-[#181b3a] text-white"><div className="absolute -right-20 top-0 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl"/><div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-7 sm:py-28 lg:grid-cols-[1.15fr_.85fr] lg:items-center"><div><VerifiedPill dark/><p className="mt-8 text-[10px] font-black uppercase tracking-[.2em] text-indigo-200/60">Pessoas constroem empresas</p><h1 className="mt-3 text-5xl font-black leading-[.95] tracking-[-.065em] sm:text-7xl">Construa sua próxima história na <span className="text-indigo-300">{company.name}</span>.</h1><p className="mt-6 max-w-2xl text-base leading-8 text-white/55">{company.description||'Conheça a empresa e encontre oportunidades abertas para fazer parte do time.'}</p><div className="mt-5"><CompanyLocation company={company} dark/></div><div className="mt-8"><CompanyActions company={company} dark/></div></div><div className="rounded-[34px] border border-white/10 bg-white/[.06] p-7"><UsersRound className="h-8 w-8 text-indigo-300"/><p className="mt-8 text-[10px] font-black uppercase tracking-[.18em] text-white/35">Agora</p><strong className="mt-2 block text-5xl tracking-[-.05em]">{jobs.length}</strong><p className="mt-2 text-sm text-white/50">{jobs.length===1?'oportunidade aberta':'oportunidades abertas'} no PiraNegócios.</p>{jobs.length>0&&<a href="#vagas" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-300 px-4 py-3 text-xs font-black text-[#181b3a]"><BriefcaseBusiness className="h-4 w-4"/>Ver oportunidades</a>}</div></div></section>
  <JobsSection company={company} jobs={jobs} tone="accent" title="Oportunidades abertas" intro={`Encontre a vaga que combina com seu momento profissional e conheça os processos de ${company.name}.`}/>
  <AboutBlock company={company} eyebrow="Nossa organização"/>
  <CompanyReviewsShowcase companyId={company.id} companyName={company.name}/>
  <CompanyClassifiedsShowcase companyId={company.id} companyName={company.name} companySlug={company.slug} variant="default"/>
  <PlatformFooter company={company}/>
 </div>;
}
