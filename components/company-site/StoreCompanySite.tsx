import React from 'react';
import { ArrowRight, ShoppingBag, Sparkles } from 'lucide-react';
import { CompanyClassifiedsShowcase } from '../company-page/CompanyClassifiedsShowcase';
import { CompanyReviewsShowcase } from '../company-page/CompanyReviewsShowcase';
import { AboutBlock, BusinessHoursBadge, CompanyActions, CompanyLocation, CompanyLogo, JobsSection, PlatformFooter, VerifiedPill } from './CompanySiteShared';
import type { CompanySiteConfig, PublicCompanyLike, PublicJobLike } from './types';

export function StoreCompanySite({company,jobs,config}:{company:PublicCompanyLike;jobs:PublicJobLike[];config:CompanySiteConfig}){
  return <div className="min-h-screen bg-[#121216] text-white">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#121216]/92 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-5 sm:px-7"><CompanyLogo company={company} dark size="sm"/><strong className="min-w-0 flex-1 truncate text-sm">{company.name}</strong><nav className="hidden gap-5 text-[11px] font-black text-white/55 md:flex"><a href="#vitrine">Loja</a><a href="#sobre">Sobre</a>{jobs.length>0&&<a href="#vagas">Vagas</a>}<a href="#contato">Contato</a></nav><BusinessHoursBadge config={config.businessHours} dark /></div></header>
    <section className="relative overflow-hidden"><div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(241,255,61,.13),transparent_34%),radial-gradient(circle_at_10%_90%,rgba(109,40,217,.16),transparent_36%)]"/><div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-7 sm:py-24 lg:grid-cols-[1.15fr_.85fr] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><VerifiedPill dark/><span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1ff3d] px-2.5 py-1 text-[10px] font-black uppercase tracking-[.11em] text-[#121216]"><ShoppingBag className="h-3.5 w-3.5"/>Loja oficial</span></div><h1 className="mt-6 max-w-3xl text-5xl font-black leading-[.95] tracking-[-.065em] sm:text-7xl">{company.name}</h1><p className="mt-6 max-w-2xl text-base leading-7 text-white/55">{company.description||'Produtos, serviços e atendimento em uma vitrine integrada ao PiraNegócios.'}</p><div className="mt-6"><CompanyLocation company={company} dark/></div><div className="mt-8"><CompanyActions company={company} dark/></div></div><div className="rounded-[34px] border border-white/10 bg-white/[.055] p-7 shadow-2xl backdrop-blur"><Sparkles className="h-6 w-6 text-[#f1ff3d]"/><p className="mt-8 text-[10px] font-black uppercase tracking-[.18em] text-white/35">Experiência de compra</p><h2 className="mt-2 text-3xl font-black tracking-[-.045em]">Catálogo vivo, ligado à operação da empresa.</h2><p className="mt-4 text-sm leading-6 text-white/45">Itens publicados, disponibilidade, preços e serviços aparecem a partir dos dados comerciais da empresa no PiraNegócios.</p><a href="#vitrine" className="mt-7 inline-flex items-center gap-2 text-xs font-black text-[#f1ff3d]">Explorar a loja <ArrowRight className="h-4 w-4"/></a></div></div></section>
    <CompanyClassifiedsShowcase companyId={company.id} companyName={company.name} companySlug={company.slug} variant="store"/>
    <AboutBlock company={company} dark eyebrow="A marca"/>
    <CompanyReviewsShowcase companyId={company.id} companyName={company.name}/>
    <JobsSection company={company} jobs={jobs} tone="dark" title="Faça parte do time"/>
    <PlatformFooter company={company} dark/>
  </div>;
}
