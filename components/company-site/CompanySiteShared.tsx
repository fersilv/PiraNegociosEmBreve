import React, { useMemo, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, Building2, CheckCircle2, Clock3, ExternalLink, Facebook, Globe2, Instagram, Linkedin, MapPin, MessageCircle, Phone, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CompanyBusinessDay, CompanySiteConfig, PublicCompanyLike, PublicJobLike } from './types';

export function CompanyLogo({ company, dark = false, size = 'lg' }: { company: PublicCompanyLike; dark?: boolean; size?: 'sm'|'lg' }) {
  const box = size === 'sm' ? 'h-10 w-10 rounded-xl' : 'h-20 w-20 rounded-[24px]';
  return company.logoURL
    ? <img src={company.logoURL} alt={`Logo ${company.name}`} className={`${box} border ${dark?'border-white/15 bg-white':'border-black/10 bg-white'} object-contain p-2 shadow-sm`} />
    : <span className={`${box} inline-flex items-center justify-center ${dark?'bg-white/10 text-white':'bg-stone-100 text-stone-700'}`}><Building2 className={size==='sm'?'h-5 w-5':'h-8 w-8'} /></span>;
}

export function VerifiedPill({ dark = false }: { dark?: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.11em] ${dark?'bg-white/10 text-white/75 ring-1 ring-white/15':'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100'}`}><ShieldCheck className="h-3.5 w-3.5" /> Empresa verificada</span>;
}

export function CompanyLocation({ company, dark = false }: { company: PublicCompanyLike; dark?: boolean }) {
  const text = company.address || [company.city, company.state].filter(Boolean).join(' - ') || company.cityState;
  if (!text) return null;
  return <span className={`inline-flex items-start gap-1.5 text-sm ${dark?'text-white/55':'text-stone-500'}`}><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{text}</span>;
}

export function CompanyActions({ company, dark = false, compact = false }: { company: PublicCompanyLike; dark?: boolean; compact?: boolean }) {
  const whatsappDigits = String(company.whatsapp || company.phone || '').replace(/\D/g,'');
  const buttons = [
    company.phone ? { label: 'Ligar', href: `tel:${company.phone}`, icon: <Phone className="h-4 w-4" /> } : null,
    whatsappDigits ? { label: 'WhatsApp', href: `https://wa.me/${whatsappDigits}`, icon: <MessageCircle className="h-4 w-4" /> } : null,
    company.website ? { label: 'Site oficial', href: external(company.website), icon: <Globe2 className="h-4 w-4" /> } : null,
  ].filter(Boolean) as Array<{label:string;href:string;icon:React.ReactNode}>;
  if (!buttons.length) return null;
  return <div className="flex flex-wrap gap-2">{buttons.map((item,index)=><a key={item.label} href={item.href} target={item.href.startsWith('http')?'_blank':undefined} rel="noreferrer" className={`inline-flex items-center gap-2 rounded-xl px-4 ${compact?'py-2 text-[11px]':'py-3 text-xs'} font-black transition ${index===0 ? (dark?'bg-white text-stone-950':'bg-stone-950 text-white') : (dark?'bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15':'bg-white text-stone-800 ring-1 ring-stone-200 hover:bg-stone-50')}`}>{item.icon}{item.label}</a>)}</div>;
}

export function CompanySocials({ company, dark = false }: { company: PublicCompanyLike; dark?: boolean }) {
  const items = [
    company.socialInstagram ? ['Instagram', external(company.socialInstagram), <Instagram className="h-4 w-4" />] : null,
    company.socialLinkedin ? ['LinkedIn', external(company.socialLinkedin), <Linkedin className="h-4 w-4" />] : null,
    company.socialFacebook ? ['Facebook', external(company.socialFacebook), <Facebook className="h-4 w-4" />] : null,
  ].filter(Boolean) as Array<[string,string,React.ReactNode]>;
  if (!items.length) return null;
  return <div className="flex flex-wrap gap-2">{items.map(([label,href,icon])=><a key={label} href={href} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-black ${dark?'bg-white/10 text-white/70 hover:text-white':'bg-stone-100 text-stone-600 hover:text-stone-950'}`}>{icon}{label}</a>)}</div>;
}

export function BusinessHoursBadge({ config, dark = false }: { config?: CompanySiteConfig['businessHours'] | null; dark?: boolean }) {
  const [expanded,setExpanded]=useState(false);
  const result = useMemo(()=>businessStatus(config),[config]);
  if (!config?.enabled || config.showOnPage === false || !result) return null;
  return <div className="relative"><button type="button" onClick={()=>setExpanded(v=>!v)} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-black ${dark?'bg-white/10 text-white/75 ring-1 ring-white/10':'bg-white text-stone-700 ring-1 ring-stone-200'}`}><span className={`h-2 w-2 rounded-full ${result.open?'bg-emerald-400':'bg-stone-400'}`} /><Clock3 className="h-3.5 w-3.5" />{result.open?'Aberto agora':result.caption}</button>{expanded&&<div className={`absolute right-0 z-50 mt-2 w-64 rounded-2xl p-4 text-xs shadow-2xl ${dark?'bg-stone-900 text-white ring-1 ring-white/15':'bg-white text-stone-700 ring-1 ring-stone-200'}`}><p className="font-black">Horários de atendimento</p><div className="mt-3 space-y-1.5">{DAYS.map(day=><div key={day.key} className="flex justify-between gap-3"><span>{day.label}</span><span className="font-bold">{formatIntervals(config.days?.[day.key])}</span></div>)}</div></div>}</div>;
}

export function JobsSection({ company, jobs, tone = 'light', title = 'Trabalhe com a gente', intro }: { company: PublicCompanyLike; jobs: PublicJobLike[]; tone?: 'light'|'dark'|'accent'; title?: string; intro?: string }) {
  if (!jobs.length) return null;
  const dark=tone==='dark';
  return <section id="vagas" className={dark?'bg-[#111318] text-white':tone==='accent'?'bg-[#eef4ff] text-slate-950':'bg-white text-stone-950'}><div className="mx-auto max-w-7xl px-5 py-14 sm:px-7 sm:py-20"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className={`text-[10px] font-black uppercase tracking-[.2em] ${dark?'text-white/45':'text-stone-400'}`}>Carreiras</p><h2 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-4xl">{title}</h2><p className={`mt-3 max-w-2xl text-sm leading-6 ${dark?'text-white/50':'text-stone-500'}`}>{intro || `Oportunidades abertas em ${company.name}.`}</p></div><Link to={`/${encodeURIComponent(company.slug||'')}/vagas`} className={`inline-flex items-center gap-2 text-xs font-black ${dark?'text-white':'text-stone-800'}`}>Ver todas <ArrowRight className="h-4 w-4" /></Link></div><div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{jobs.slice(0,6).map((job,index)=><Link key={job.id||`${job.title}-${index}`} to={job.slug?`/vagas/${encodeURIComponent(job.slug)}`:'/vagas'} className={`group rounded-[24px] p-5 transition hover:-translate-y-0.5 ${dark?'bg-white/[.06] ring-1 ring-white/10':'bg-white ring-1 ring-stone-200 shadow-sm'}`}><div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${dark?'bg-white/10':'bg-stone-100'}`}><BriefcaseBusiness className="h-5 w-5" /></div><h3 className="mt-5 text-lg font-black">{job.title||'Oportunidade'}</h3><p className={`mt-2 text-xs ${dark?'text-white/45':'text-stone-500'}`}>{job.location || [job.city,job.state].filter(Boolean).join(' - ') || 'Local a combinar'}</p><span className={`mt-5 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[.1em] ${dark?'text-white/65':'text-stone-700'}`}>Ver vaga <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span></Link>)}</div></div></section>;
}

export function PlatformFooter({ company, dark = false }: { company: PublicCompanyLike; dark?: boolean }) {
  return <footer id="contato" className={dark?'bg-[#090a0d] text-white':'bg-stone-950 text-white'}><div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-7 md:grid-cols-[1fr_auto]"><div><div className="flex items-center gap-3"><CompanyLogo company={company} dark size="sm" /><div><strong className="block text-lg">{company.name}</strong><CompanyLocation company={company} dark /></div></div><div className="mt-5"><CompanyActions company={company} dark compact /></div><div className="mt-4"><CompanySocials company={company} dark /></div></div><div className="md:text-right"><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/35">Presença digital empresarial</p><a href="/" className="mt-3 inline-flex items-center gap-2 text-xs font-black text-white/65 hover:text-white"><img src="/brand/symbol-terracotta.png" alt="" className="h-5 w-5" /> Integrado ao PiraNegócios <ExternalLink className="h-3.5 w-3.5" /></a></div></div></footer>;
}

export function AboutBlock({ company, dark = false, eyebrow = 'Sobre' }: { company: PublicCompanyLike; dark?: boolean; eyebrow?: string }) {
  if (!company.description) return null;
  return <section id="sobre" className={dark?'bg-[#15171d] text-white':'bg-[#f7f6f2] text-stone-950'}><div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-7 sm:py-20 lg:grid-cols-[.75fr_1.25fr]"><div><p className={`text-[10px] font-black uppercase tracking-[.2em] ${dark?'text-white/40':'text-stone-400'}`}>{eyebrow}</p><h2 className="mt-3 text-3xl font-black tracking-[-.04em]">Conheça {company.name}</h2></div><p className={`text-base leading-8 ${dark?'text-white/60':'text-stone-600'}`}>{company.description}</p></div></section>;
}

const DAYS:Array<{key:CompanyBusinessDay;label:string;jsDay:number}>=[{key:'mon',label:'Segunda',jsDay:1},{key:'tue',label:'Terça',jsDay:2},{key:'wed',label:'Quarta',jsDay:3},{key:'thu',label:'Quinta',jsDay:4},{key:'fri',label:'Sexta',jsDay:5},{key:'sat',label:'Sábado',jsDay:6},{key:'sun',label:'Domingo',jsDay:0}];
function businessStatus(config?:CompanySiteConfig['businessHours']|null){
  if(!config?.enabled)return null;
  const timezone=config.timezone||'America/Sao_Paulo';
  const now=new Date();
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const wd=({Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6} as Record<string,number>)[parts.find(p=>p.type==='weekday')?.value||'Mon']??1;
  const key=DAYS.find(d=>d.jsDay===wd)?.key||'mon'; const minutes=Number(parts.find(p=>p.type==='hour')?.value||0)*60+Number(parts.find(p=>p.type==='minute')?.value||0);
  for(const interval of config.days?.[key]||[]){const a=toMinutes(interval.open),b=toMinutes(interval.close);if(a==null||b==null)continue;if(b>a&&minutes>=a&&minutes<b)return{open:true,caption:`Fecha às ${interval.close}`};if(b<=a&&minutes>=a)return{open:true,caption:`Fecha amanhã às ${interval.close}`};}
  return{open:false,caption:'Fechado agora'};
}
function toMinutes(value?:string){const m=String(value||'').match(/^(\d{2}):(\d{2})$/);if(!m)return null;return Number(m[1])*60+Number(m[2]);}
function formatIntervals(items?:Array<{open:string;close:string}>){return items?.length?items.map(i=>`${i.open}–${i.close}`).join(', '):'Fechado';}
function external(value:string){const v=String(value||'').trim();return /^https?:\/\//i.test(v)?v:`https://${v}`;}
