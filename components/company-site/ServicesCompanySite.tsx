import React from 'react';
import { ArrowUpRight, CheckCircle2, MessageCircle, Wrench } from 'lucide-react';
import { CompanyClassifiedsShowcase } from '../company-page/CompanyClassifiedsShowcase';
import { CompanyReviewsShowcase } from '../company-page/CompanyReviewsShowcase';
import { AboutBlock, BusinessHoursBadge, CompanyActions, CompanyLocation, CompanyLogo, JobsSection, PlatformFooter, VerifiedPill } from './CompanySiteShared';
import type { CompanySiteConfig, PublicCompanyLike, PublicJobLike } from './types';

export function ServicesCompanySite({company,jobs,config}:{company:PublicCompanyLike;jobs:PublicJobLike[];config:CompanySiteConfig}){
 return <div className="min-h-screen bg-[#f5f1e8] text-[#173b35]">
  <header className="mx-auto max-w-7xl px-5 pt-5 sm:px-7"><div className="flex min-h-16 items-center gap-4 rounded-[22px] bg-[#173b35] px-4 text-white shadow-xl"><CompanyLogo company={company} dark size="sm"/><strong className="min-w-0 flex-1 truncate">{company.name}</strong><BusinessHoursBadge config={config.businessHours} dark/></div></header>
  <section className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-7 sm:py-20 lg:grid-cols-[1.2fr_.8fr] lg:items-center"><div><div className="flex flex-wrap gap-2"><VerifiedPill/><span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6b85c]/20 px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-[#835d13]"><Wrench className="h-3.5 w-3.5"/>Atendimento & serviços</span></div><h1 className="mt-7 text-5xl font-black leading-[.98] tracking-[-.06em] sm:text-7xl">Solução profissional, com a identidade de <span className="text-[#b15e3f]">{company.name}</span>.</h1><p className="mt-6 max-w-2xl text-base leading-8 text-[#173b35]/65">{company.description||'Serviços, atendimento e canais oficiais reunidos para facilitar a relação com clientes.'}</p><div className="mt-5"><CompanyLocation company={company}/></div><div className="mt-8"><CompanyActions company={company}/></div></div><div className="rounded-[36px] bg-white p-7 shadow-[0_30px_80px_rgba(23,59,53,.12)] ring-1 ring-black/5"><MessageCircle className="h-7 w-7 text-[#b15e3f]"/><h2 className="mt-8 text-3xl font-black tracking-[-.04em]">Do primeiro contato à contratação.</h2><p className="mt-3 text-sm leading-6 text-[#173b35]/60">A vitrine abaixo é alimentada pelo catálogo empresarial e pode reunir serviços, produtos complementares e formas de negociação.</p><a href="#vitrine" className="mt-6 inline-flex items-center gap-2 text-xs font-black">Ver serviços <ArrowUpRight className="h-4 w-4"/></a><div className="mt-8 grid gap-2 text-xs font-bold text-[#173b35]/70"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600"/>Empresa verificada</span><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600"/>Reputação integrada</span><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600"/>Contato oficial</span></div></div></section>
  <CompanyClassifiedsShowcase companyId={company.id} companyName={company.name} companySlug={company.slug} variant="default"/>
  <CompanyReviewsShowcase companyId={company.id} companyName={company.name}/>
  <AboutBlock company={company} eyebrow="Quem atende você"/>
  <JobsSection company={company} jobs={jobs} title="Venha trabalhar com a gente"/>
  <PlatformFooter company={company}/>
 </div>;
}
