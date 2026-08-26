import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';

type Queue = 'PEOPLE' | 'PARTNER_AUTH';
type Filter = 'PENDING' | 'NEEDS_CHANGES' | 'REJECTED' | 'APPROVED' | 'ALL';
const FILTERS: Filter[] = ['PENDING','NEEDS_CHANGES','REJECTED','APPROVED','ALL'];

export default function AdminIdentityVerificationsPage() {
  const [queue,setQueue]=useState<Queue>('PEOPLE');
  const [filter,setFilter]=useState<Filter>('PENDING');
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState<any|null>(null);
  const [detailLoading,setDetailLoading]=useState(false);
  const [working,setWorking]=useState('');
  const [message,setMessage]=useState('');
  const [reason,setReason]=useState('');
  const [selfieUrl,setSelfieUrl]=useState<string|null>(null);

  const effectiveStatus = queue==='PARTNER_AUTH' && filter==='PENDING' ? 'SUBMITTED' : filter;
  const load=async()=>{
    setLoading(true);setMessage('');
    try{
      const endpoint=queue==='PEOPLE'
        ? `/admin/compliance/verifications?status=${effectiveStatus}`
        : `/admin/compliance/company-authorizations?status=${effectiveStatus}`;
      const response=await api.get(endpoint);
      setRows(Array.isArray(response.data)?response.data:[]);
    }catch(error:any){setMessage(error?.response?.data?.message||'Não foi possível carregar a fila.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load()},[queue,filter]);

  const cleanupSelfie=()=>{if(selfieUrl)URL.revokeObjectURL(selfieUrl);setSelfieUrl(null)};
  const close=()=>{cleanupSelfie();setSelected(null);setReason('')};

  const open=async(row:any)=>{
    cleanupSelfie();setSelected({row,detail:null});setReason('');setDetailLoading(true);
    try{
      const endpoint=queue==='PEOPLE'
        ? `/admin/compliance/verifications/${row.id}`
        : `/admin/compliance/company-authorizations/${row.id}`;
      const response=await api.get(endpoint);
      setSelected({row,detail:response.data});
      if(queue==='PEOPLE'){
        const selfie=response.data?.documents?.find((item:any)=>item.kind==='SELFIE');
        if(selfie)await loadSelfie(`/admin/compliance/documents/${selfie.id}`);
      }else if(response.data?.selfieAvailable){
        await loadSelfie(`/admin/compliance/company-authorizations/${row.id}/selfie`);
      }
    }catch(error:any){setMessage(error?.response?.data?.message||'Não foi possível abrir a análise.');}
    finally{setDetailLoading(false);}
  };

  const loadSelfie=async(endpoint:string)=>{
    try{
      const response=await api.get(endpoint,{responseType:'blob'});
      cleanupSelfie();
      setSelfieUrl(URL.createObjectURL(response.data as Blob));
    }catch{setSelfieUrl(null);}
  };

  const review=async(decision:'APPROVE'|'REJECT'|'NEEDS_CHANGES')=>{
    const id=selected?.row?.id;if(!id)return;
    setWorking(decision);setMessage('');
    try{
      if(queue==='PEOPLE') await api.post(`/admin/compliance/verifications/${id}/review`,{decision,reason});
      else {
        if(decision==='NEEDS_CHANGES') throw new Error('Para autorização de sócio, reprove e gere um novo link quando precisar corrigir os dados.');
        await api.post(`/admin/compliance/company-authorizations/${id}/review`,{decision,reason});
      }
      setMessage(decision==='APPROVE'?'Validação aprovada.':decision==='REJECT'?'Validação reprovada.':'Ajustes solicitados.');
      close();await load();
    }catch(error:any){setMessage(error?.response?.data?.message||error?.message||'Não foi possível registrar a decisão.');}
    finally{setWorking('');}
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-700">Segurança · Marketplace</p><h1 className="mt-1 font-serif text-3xl font-black">Validação cadastral</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Análise simples: identidade, contatos, selfie e, quando houver empresa, dados públicos do CNPJ e vínculo do responsável. Sem exigir contrato social, RG ou comprovante no fluxo padrão.</p></div><button onClick={()=>void load()} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-xs font-black ring-1 ring-stone-200"><RefreshCw className="h-4 w-4"/>Atualizar</button></header>

    {message&&<div className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-bold text-white">{message}</div>}

    <div className="grid gap-3 sm:grid-cols-2"><QueueCard active={queue==='PEOPLE'} icon={<UserRound className="h-5 w-5"/>} title="Pessoas e sócios diretos" text="Selfie da própria conta, incluindo o sócio que cadastrou a empresa." onClick={()=>{setQueue('PEOPLE');setFilter('PENDING')}}/><QueueCard active={queue==='PARTNER_AUTH'} icon={<UsersRound className="h-5 w-5"/>} title="Autorizações de sócio" text="Sócio responsável convidado por quem criou a empresa." onClick={()=>{setQueue('PARTNER_AUTH');setFilter('PENDING')}}/></div>

    <div className="flex gap-2 overflow-x-auto pb-1">{FILTERS.map(item=><button key={item} onClick={()=>setFilter(item)} className={`whitespace-nowrap rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[.1em] ${filter===item?'bg-stone-950 text-white':'bg-white text-stone-500 ring-1 ring-stone-200'}`}>{filterLabel(item,queue)}</button>)}</div>

    <section className="overflow-hidden rounded-[28px] bg-white ring-1 ring-stone-200">{loading?<div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400"/></div>:rows.length?<div className="divide-y divide-stone-100">{rows.map(row=><button key={row.id} onClick={()=>void open(row)} className="grid w-full gap-3 p-4 text-left hover:bg-stone-50 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] sm:items-center sm:p-5"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${queue==='PARTNER_AUTH'||row.context==='COMPANY'?'bg-[#eef8f6] text-[#397c75]':'bg-violet-50 text-violet-700'}`}>{queue==='PARTNER_AUTH'||row.context==='COMPANY'?<Building2 className="h-5 w-5"/>:<UserRound className="h-5 w-5"/>}</span><div className="min-w-0"><p className="truncate text-sm font-black">{queue==='PEOPLE'?row.userName:row.partnerName}</p><p className="mt-0.5 truncate text-[11px] text-stone-400">{queue==='PEOPLE'?(row.email||'Sem e-mail'):(row.partnerEmail||'Sem e-mail')}</p>{(row.companyName||row.legalName)&&<p className="mt-1 truncate text-[11px] font-bold text-[#397c75]">{row.companyName||row.legalName}</p>}</div></div><div className="text-xs text-stone-500">{queue==='PEOPLE'?<><p>Telefone: <strong>{row.whatsappPhoneE164?'validado':'verifique na ficha'}</strong></p><p className="mt-1">{row.context==='COMPANY'?(row.selectedQsaName||'Sócio não selecionado'):'Venda pessoal'}</p></>:<><p>Solicitado por <strong>{row.requestedByName||'administrador'}</strong></p><p className="mt-1">{row.grantFullPowers?'Plenos poderes':'Permissões limitadas'}</p></>}</div><div className="flex items-center justify-between gap-3 sm:justify-end"><Status status={row.status}/><ChevronRight className="h-4 w-4 text-stone-300"/></div></button>)}</div>:<Empty/>}</section>

    {selected&&<div className="fixed inset-0 z-[180] overflow-y-auto bg-black/60 p-3 sm:p-6" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="mx-auto my-3 max-w-6xl overflow-hidden rounded-[30px] bg-[#f7f5f2] shadow-2xl"><header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-stone-200 bg-white px-5 py-5 sm:px-7"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-violet-700">Análise cadastral</p><h2 className="mt-1 font-serif text-2xl font-black">{queue==='PEOPLE'?selected.row.userName:selected.row.partnerName}</h2></div><button onClick={close} className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100"><X className="h-4 w-4"/></button></header>{detailLoading?<div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-stone-400"/></div>:queue==='PEOPLE'?<PeopleReview data={selected.detail} selfieUrl={selfieUrl}/>:<PartnerReview data={selected.detail} selfieUrl={selfieUrl}/>} {!detailLoading&&<ReviewBox queue={queue} status={queue==='PEOPLE'?selected.detail?.verification?.status:selected.detail?.status} reason={reason} setReason={setReason} working={working} onReview={decision=>void review(decision)}/>}</section></div>}
  </div>;
}

function PeopleReview({data,selfieUrl}:{data:any;selfieUrl:string|null}){const p=data?.profile||{};const v=data?.verification||{};const qsa=Array.isArray(p.cnpjSnapshot?.qsa)?p.cnpjSnapshot.qsa:[];return <div className="space-y-5 p-4 sm:p-6"><div className="grid gap-4 lg:grid-cols-3"><Info title="Pessoa" icon={<UserRound className="h-5 w-5"/>}><Line label="Nome" value={p.userName}/><Line label="E-mail" value={p.email}/><Line label="Telefone" value={p.whatsappPhoneE164||p.phone}/><Line label="WhatsApp validado" value={p.whatsappVerifiedAt?'Sim':'Não'}/></Info><Info title="Verificação" icon={<ShieldCheck className="h-5 w-5"/>}><Line label="Contexto" value={v.context==='COMPANY'?'Empresa':'Pessoal'}/><Line label="Vínculo" value={v.relationship==='PARTNER'?'Sócio responsável':v.relationship==='EMPLOYEE'?'Funcionário':'Pessoa vendedora'}/><Line label="Declara ≥25%" value={v.declaresAtLeast25Percent?'Sim':'Não'}/><Line label="Sócio selecionado" value={v.selectedQsaName||'Não se aplica'}/></Info><Info title="Empresa" icon={<Building2 className="h-5 w-5"/>}><Line label="Nome comercial" value={p.companyName||'Não vinculada'}/><Line label="Razão social" value={p.legalName||'Não informada'}/><Line label="CNPJ" value={p.cnpj||'Não informado'}/><Line label="Situação" value={p.cnpjSituation||'Não informada'}/></Info></div><Selfie selfieUrl={selfieUrl}/>{v.context==='COMPANY'&&<section className="rounded-[24px] bg-white p-5 ring-1 ring-stone-200"><h3 className="text-sm font-black">Dados públicos do CNPJ</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><LineCard label="Endereço jurídico" value={p.legalAddress||[p.legalCity,p.legalState].filter(Boolean).join('/')}/><LineCard label="Fonte / consulta" value={[p.cnpjDataSource,p.cnpjDataCheckedAt?dateTime(p.cnpjDataCheckedAt):null].filter(Boolean).join(' · ')}/></div>{qsa.length>0&&<div className="mt-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">QSA</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{qsa.map((item:any)=><div key={`${item.name}-${item.qualification||''}`} className={`rounded-xl p-3 ring-1 ${normalize(item.name)===normalize(v.selectedQsaName)?'bg-emerald-50 ring-emerald-200':'bg-stone-50 ring-stone-200'}`}><p className="text-xs font-black">{item.name}</p><p className="mt-1 text-[10px] text-stone-500">{item.qualification||'Qualificação não informada'}</p></div>)}</div></div>}</section>}</div>}

function PartnerReview({data,selfieUrl}:{data:any;selfieUrl:string|null}){const qsa=Array.isArray(data?.cnpjSnapshot?.qsa)?data.cnpjSnapshot.qsa:[];return <div className="space-y-5 p-4 sm:p-6"><div className="grid gap-4 lg:grid-cols-3"><Info title="Sócio responsável" icon={<BadgeCheck className="h-5 w-5"/>}><Line label="Nome" value={data?.partnerName}/><Line label="E-mail" value={data?.partnerEmail}/><Line label="Telefone" value={data?.partnerPhone}/><Line label="Qualificação QSA" value={data?.qsaQualification}/></Info><Info title="Empresa" icon={<Building2 className="h-5 w-5"/>}><Line label="Nome comercial" value={data?.companyName}/><Line label="Razão social" value={data?.legalName}/><Line label="CNPJ" value={data?.cnpj}/><Line label="Situação" value={data?.cnpjSituation}/></Info><Info title="Autorização" icon={<UsersRound className="h-5 w-5"/>}><Line label="Solicitada por" value={data?.requestedByName}/><Line label="Poderes" value={data?.grantFullPowers?'Plenos poderes':'Limitados'}/><Line label="Aceite" value={data?.consentAcceptedAt?dateTime(data.consentAcceptedAt):'Ainda não'}/><Line label="Enviada" value={data?.submittedAt?dateTime(data.submittedAt):'Ainda não'}/></Info></div><Selfie selfieUrl={selfieUrl}/><section className="rounded-[24px] bg-white p-5 ring-1 ring-stone-200"><h3 className="text-sm font-black">Permissões concedidas ao administrador</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(data?.permissions||{}).filter(([,enabled])=>enabled).map(([key])=><div key={key} className="rounded-xl bg-stone-50 p-3 text-xs font-bold">{permissionName(key)}</div>)}</div></section>{qsa.length>0&&<section className="rounded-[24px] bg-white p-5 ring-1 ring-stone-200"><h3 className="text-sm font-black">QSA consultado</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{qsa.map((item:any)=><div key={`${item.name}-${item.qualification||''}`} className={`rounded-xl p-3 ring-1 ${normalize(item.name)===normalize(data?.partnerName)?'bg-emerald-50 ring-emerald-200':'bg-stone-50 ring-stone-200'}`}><p className="text-xs font-black">{item.name}</p><p className="mt-1 text-[10px] text-stone-500">{item.qualification||'Qualificação não informada'}</p></div>)}</div></section>}</div>}

function ReviewBox({queue,status,reason,setReason,working,onReview}:{queue:Queue;status:string;reason:string;setReason:(v:string)=>void;working:string;onReview:(d:'APPROVE'|'REJECT'|'NEEDS_CHANGES')=>void}){const editable=['PENDING','NEEDS_CHANGES','SUBMITTED'].includes(status);if(!editable)return <div className="border-t border-stone-200 bg-white p-5 sm:p-6"><div className="flex items-center gap-3"><Status status={status}/><span className="text-xs text-stone-500">Esta análise já foi encerrada.</span></div></div>;return <div className="border-t border-stone-200 bg-white p-5 sm:p-6"><h3 className="text-sm font-black">Decisão</h3><p className="mt-1 text-xs text-stone-500">Aprovar uma autorização empresarial libera a empresa. Em caso de dúvida, reprove e solicite um novo convite ou peça ajustes na verificação da própria conta.</p><textarea value={reason} onChange={event=>setReason(event.target.value)} rows={3} placeholder="Motivo ou observação da análise" className="mt-4 w-full rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm outline-none focus:border-violet-400"/><div className={`mt-4 grid gap-2 ${queue==='PEOPLE'?'sm:grid-cols-3':'sm:grid-cols-2'}`}><button disabled={Boolean(working)} onClick={()=>onReview('APPROVE')} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 text-xs font-black text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4"/>Aprovar</button>{queue==='PEOPLE'&&<button disabled={Boolean(working)} onClick={()=>onReview('NEEDS_CHANGES')} className="inline-flex h-11 items-center justify-center rounded-xl bg-amber-100 text-xs font-black text-amber-900 disabled:opacity-50">Pedir ajuste</button>}<button disabled={Boolean(working)} onClick={()=>onReview('REJECT')} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-700 text-xs font-black text-white disabled:opacity-50"><XCircle className="h-4 w-4"/>Reprovar</button></div></div>}
function QueueCard({active,icon,title,text,onClick}:{active:boolean;icon:React.ReactNode;title:string;text:string;onClick:()=>void}){return <button type="button" onClick={onClick} className={`rounded-[22px] border p-4 text-left ${active?'border-violet-300 bg-violet-50 ring-2 ring-violet-500/10':'border-stone-200 bg-white'}`}><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">{icon}</span><div><p className="text-sm font-black">{title}</p><p className="mt-1 text-xs leading-5 text-stone-500">{text}</p></div></div></button>}
function Selfie({selfieUrl}:{selfieUrl:string|null}){return <section className="rounded-[24px] bg-white p-5 ring-1 ring-stone-200"><div className="flex items-center justify-between"><h3 className="text-sm font-black">Selfie</h3><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${selfieUrl?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-700'}`}>{selfieUrl?'Recebida':'Ausente'}</span></div>{selfieUrl?<img src={selfieUrl} alt="Selfie enviada para validação" className="mt-4 max-h-[420px] w-full rounded-2xl bg-stone-950 object-contain"/>:<p className="mt-3 text-xs text-stone-500">Não há selfie disponível para conferir.</p>}</section>}
function Info({title,icon,children}:{title:string;icon:React.ReactNode;children:React.ReactNode}){return <section className="rounded-[22px] bg-white p-4 ring-1 ring-stone-200"><div className="flex items-center gap-2 text-stone-700">{icon}<h3 className="text-sm font-black">{title}</h3></div><div className="mt-4 space-y-2">{children}</div></section>}
function Line({label,value}:{label:string;value:any}){return <div><p className="text-[9px] font-black uppercase tracking-[.1em] text-stone-400">{label}</p><p className="mt-0.5 break-words text-xs font-bold text-stone-800">{value||'Não informado'}</p></div>}
function LineCard({label,value}:{label:string;value:any}){return <div className="rounded-xl bg-stone-50 p-3"><Line label={label} value={value}/></div>}
function Empty(){return <div className="flex min-h-64 flex-col items-center justify-center p-6 text-center"><ShieldCheck className="h-8 w-8 text-emerald-500"/><p className="mt-3 text-sm font-black">Nada nesta fila</p><p className="mt-1 text-xs text-stone-400">Novas solicitações aparecerão aqui.</p></div>}
function Status({status}:{status:string}){const approved=status==='APPROVED';const pending=['PENDING','SUBMITTED'].includes(status);const rejected=status==='REJECTED';return <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase ${approved?'bg-emerald-50 text-emerald-700':pending?'bg-amber-50 text-amber-700':rejected?'bg-red-50 text-red-700':'bg-stone-100 text-stone-600'}`}>{approved?'Aprovado':pending?'Aguardando':rejected?'Reprovado':status==='NEEDS_CHANGES'?'Ajustes':status||'Rascunho'}</span>}
function filterLabel(value:Filter,queue:Queue){if(value==='PENDING')return queue==='PARTNER_AUTH'?'Aguardando análise':'Pendentes';if(value==='NEEDS_CHANGES')return 'Ajustes';if(value==='REJECTED')return 'Reprovados';if(value==='APPROVED')return 'Aprovados';return 'Todos'}
function permissionName(key:string){return ({companyProfile:'Perfil da empresa',recruitment:'Recrutamento',marketplace:'Marketplace',finance:'Financeiro',team:'Equipe e permissões'} as Record<string,string>)[key]||key}
function normalize(value:any){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase()}
function dateTime(value:any){if(!value)return '';const date=new Date(value);return Number.isNaN(date.getTime())?String(value):date.toLocaleString('pt-BR')}
