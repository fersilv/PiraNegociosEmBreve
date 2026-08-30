import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FileText, Loader2, RefreshCw, Send, XCircle } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useClassifiedsWorkspace } from '../contexts/ClassifiedsWorkspaceContext';

type QuoteListItem = {
  id: string;
  title: string;
  slug: string;
  status: string;
  scope?: string;
  companyName?: string;
  customerName?: string;
  customerEmail?: string;
  amountCents?: number | null;
  latestVersion?: number | null;
  validUntil?: string | null;
  updatedAt?: string;
};

type Version = {
  id: string;
  version: number;
  amountCents: number;
  description: string;
  conditions?: string | null;
  deliveryDays?: number | null;
  validUntil: string;
  items?: any[];
  createdAt?: string;
};

type QuoteDetail = QuoteListItem & {
  versions?: Version[];
  events?: any[];
  contract?: any | null;
  acceptedVersionId?: string | null;
};

export default function ClassifiedsServiceQuotesPage() {
  const { data } = useClassifiedsWorkspace();
  const business = data?.activeIdentity === 'COMPANY';
  const location = useLocation();
  const navigate = useNavigate();
  const detailId = useMemo(() => {
    const match = location.pathname.match(/^\/classificados\/orcamentos\/([^/]+)$/);
    return match?.[1] || '';
  }, [location.pathname]);
  const [features, setFeatures] = useState<any>(null);
  const [items, setItems] = useState<QuoteListItem[]>([]);
  const [detail, setDetail] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adjustment, setAdjustment] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [proposal, setProposal] = useState({ amount: '', description: '', conditions: '', deliveryDays: '', validUntil: defaultValidUntil() });

  const load = async () => {
    setLoading(true); setError('');
    try {
      const featureResponse = await api.get('/classifieds/commerce/features');
      setFeatures(featureResponse.data || {});
      if (!featureResponse.data?.consultativeQuotes) {
        setItems([]); setDetail(null); return;
      }
      const listResponse = await api.get(business ? '/classifieds/service-quotes/company' : '/classifieds/service-quotes/mine');
      const list = Array.isArray(listResponse.data) ? listResponse.data as QuoteListItem[] : [];
      setItems(list);
      if (detailId) {
        const detailResponse = await api.get(business ? `/classifieds/service-quotes/company/${detailId}` : `/classifieds/service-quotes/mine/${detailId}`);
        setDetail(detailResponse.data as QuoteDetail);
      } else {
        setDetail(null);
      }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar os orçamentos.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [business, data?.company?.id, detailId]);

  const createVersion = async () => {
    if (!detail || working) return;
    const amount = Math.round(Number(String(proposal.amount).replace(',','.')) * 100);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Informe um valor válido para a proposta.'); return; }
    if (proposal.description.trim().length < 3) { setError('Descreva a proposta.'); return; }
    setWorking(true); setError(''); setNotice('');
    try {
      await api.post(`/classifieds/service-quotes/company/${detail.id}/versions`, {
        amountCents: amount,
        description: proposal.description.trim(),
        conditions: proposal.conditions.trim() || null,
        deliveryDays: proposal.deliveryDays ? Number(proposal.deliveryDays) : null,
        validUntil: new Date(proposal.validUntil).toISOString(),
        items: [],
      });
      setProposal({ amount:'', description:'', conditions:'', deliveryDays:'', validUntil:defaultValidUntil() });
      setNotice('Nova versão salva. A versão anterior continua preservada no histórico.');
      await load();
    } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível criar a versão.'); }
    finally { setWorking(false); }
  };

  const send = async () => {
    if (!detail || working) return;
    setWorking(true); setError('');
    try { await api.post(`/classifieds/service-quotes/company/${detail.id}/send`); setNotice('Proposta enviada ao cliente.'); await load(); }
    catch (requestError:any){setError(requestError?.response?.data?.message||'Não foi possível enviar a proposta.');}
    finally{setWorking(false);}
  };

  const cancel = async () => {
    if (!detail || working || !window.confirm('Cancelar esta solicitação de orçamento?')) return;
    setWorking(true); setError('');
    try { await api.patch(`/classifieds/service-quotes/company/${detail.id}/cancel`, { reason:'Cancelado pela empresa' }); setNotice('Orçamento cancelado.'); await load(); }
    catch (requestError:any){setError(requestError?.response?.data?.message||'Não foi possível cancelar.');}
    finally{setWorking(false);}
  };

  const accept = async (versionId?: string) => {
    if (!detail || working) return;
    setWorking(true); setError('');
    try { await api.post(`/classifieds/service-quotes/${detail.id}/accept`, { versionId }); setNotice('Proposta aceita. O contrato foi criado com snapshot desta versão.'); await load(); }
    catch(requestError:any){setError(requestError?.response?.data?.message||'Não foi possível aceitar a proposta.');}
    finally{setWorking(false);}
  };

  const requestAdjustment = async () => {
    if (!detail || working || adjustment.trim().length < 3) return;
    setWorking(true); setError('');
    try { await api.post(`/classifieds/service-quotes/${detail.id}/adjustment`, { note: adjustment.trim() }); setAdjustment(''); setNotice('Pedido de ajuste enviado.'); await load(); }
    catch(requestError:any){setError(requestError?.response?.data?.message||'Não foi possível pedir o ajuste.');}
    finally{setWorking(false);}
  };

  const decline = async () => {
    if (!detail || working) return;
    setWorking(true); setError('');
    try { await api.post(`/classifieds/service-quotes/${detail.id}/decline`, { reason: declineReason.trim() || null }); setNotice('Proposta recusada.'); await load(); }
    catch(requestError:any){setError(requestError?.response?.data?.message||'Não foi possível recusar.');}
    finally{setWorking(false);}
  };

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div>;
  if (features && !features.consultativeQuotes) return <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-9 text-center ring-1 ring-stone-200"><FileText className="mx-auto h-9 w-9 text-stone-300" /><h1 className="mt-4 font-serif text-3xl font-black">Orçamentos em preparação</h1><p className="mt-2 text-sm text-stone-500">O módulo está instalado, mas a feature flag de propostas consultivas ainda está desligada neste ambiente.</p></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">Serviços · Propostas</p><h1 className="mt-1 font-serif text-3xl font-black">Orçamentos</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">{business ? 'Receba solicitações, crie versões imutáveis e envie a proposta ao cliente.' : 'Acompanhe propostas, peça ajuste ou aceite exatamente a versão que você recebeu.'}</p></div><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-stone-600 ring-1 ring-stone-200"><RefreshCw className="h-4 w-4" /> Atualizar</button></header>
      {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      {notice && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div>}

      <div className="grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-stone-200 lg:self-start"><div className="flex items-center justify-between px-1"><h2 className="font-serif text-xl font-black">Solicitações</h2><span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-black text-stone-500">{items.length}</span></div><div className="mt-4 space-y-2">{items.length ? items.map((item) => <button key={item.id} onClick={() => navigate(`/classificados/orcamentos/${item.id}`)} className={`w-full rounded-2xl p-3 text-left ring-1 ${detailId===item.id?'bg-[#fff1e9] ring-[#e6c8bd]':'bg-stone-50 ring-stone-200'}`}><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-xs font-black text-stone-900">{item.title}</p><Status status={item.status}/></div><p className="mt-1 truncate text-[10px] text-stone-400">{business ? item.customerName || item.customerEmail || 'Cliente' : item.companyName || 'Empresa'}</p>{item.amountCents != null && <p className="mt-2 text-sm font-black">{money(item.amountCents)}</p>}</button>) : <p className="rounded-2xl bg-stone-50 p-5 text-center text-xs text-stone-400">Nenhum orçamento ainda.</p>}</div></aside>

        <main>{!detail ? <div className="flex min-h-72 items-center justify-center rounded-[28px] bg-white p-8 text-center ring-1 ring-stone-200"><div><FileText className="mx-auto h-10 w-10 text-stone-300" /><h2 className="mt-3 font-serif text-2xl font-black">Selecione uma solicitação</h2><p className="mt-2 text-sm text-stone-500">O histórico de versões, eventos e contrato aparece aqui.</p></div></div> : <QuoteDetailView detail={detail} business={business} working={working} proposal={proposal} setProposal={setProposal} adjustment={adjustment} setAdjustment={setAdjustment} declineReason={declineReason} setDeclineReason={setDeclineReason} onCreateVersion={() => void createVersion()} onSend={() => void send()} onCancel={() => void cancel()} onAccept={(versionId) => void accept(versionId)} onAdjustment={() => void requestAdjustment()} onDecline={() => void decline()} />}</main>
      </div>
    </div>
  );
}

function QuoteDetailView({ detail,business,working,proposal,setProposal,adjustment,setAdjustment,declineReason,setDeclineReason,onCreateVersion,onSend,onCancel,onAccept,onAdjustment,onDecline }:{ detail:QuoteDetail; business:boolean; working:boolean; proposal:any; setProposal:(value:any)=>void; adjustment:string; setAdjustment:(value:string)=>void; declineReason:string; setDeclineReason:(value:string)=>void; onCreateVersion:()=>void; onSend:()=>void; onCancel:()=>void; onAccept:(versionId?:string)=>void; onAdjustment:()=>void; onDecline:()=>void }) {
  const versions = Array.isArray(detail.versions) ? detail.versions : [];
  const latest = versions[0];
  const terminal = ['ACCEPTED','DECLINED','EXPIRED','CANCELED'].includes(String(detail.status).toUpperCase());
  return <div className="space-y-4"><section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Status status={detail.status}/><span className="text-[10px] font-bold text-stone-400">#{detail.id.slice(0,8).toUpperCase()}</span></div><h2 className="mt-2 font-serif text-2xl font-black">{detail.title}</h2><p className="mt-1 text-xs text-stone-500">{business ? detail.customerName || detail.customerEmail || 'Cliente' : detail.companyName || 'Empresa'}</p></div><Link to={`/classificados/explorar/${detail.slug}`} className="rounded-xl bg-stone-100 px-3 py-2 text-[10px] font-black text-stone-600">Ver anúncio</Link></div><div className="mt-5 rounded-2xl bg-stone-50 p-4"><p className="text-[9px] font-black uppercase tracking-[.14em] text-stone-400">Escopo solicitado</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">{detail.scope || 'Sem descrição.'}</p></div>{detail.contract && <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><CheckCircle2 className="mr-2 inline h-4 w-4" /> Contrato criado com snapshot da versão aceita.</div>}</section>

    {business && !terminal && <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6"><h3 className="font-serif text-xl font-black">Criar nova versão</h3><p className="mt-1 text-xs text-stone-500">Editar gera uma nova versão. A anterior nunca é sobrescrita.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Valor (R$)"><input value={proposal.amount} onChange={(e)=>setProposal({...proposal,amount:e.target.value})} inputMode="decimal" className="input" /></Field><Field label="Validade"><input type="datetime-local" value={proposal.validUntil} onChange={(e)=>setProposal({...proposal,validUntil:e.target.value})} className="input" /></Field><Field label="Prazo em dias"><input type="number" min={0} value={proposal.deliveryDays} onChange={(e)=>setProposal({...proposal,deliveryDays:e.target.value})} className="input" /></Field><div /></div><Field label="Descrição da proposta"><textarea rows={4} value={proposal.description} onChange={(e)=>setProposal({...proposal,description:e.target.value})} className="input h-auto py-3" /></Field><Field label="Condições"><textarea rows={3} value={proposal.conditions} onChange={(e)=>setProposal({...proposal,conditions:e.target.value})} className="input h-auto py-3" /></Field><div className="mt-4 flex flex-wrap gap-2"><button disabled={working} onClick={onCreateVersion} className="rounded-xl bg-stone-900 px-4 py-3 text-xs font-black text-white">Salvar nova versão</button>{latest && <button disabled={working} onClick={onSend} className="inline-flex items-center gap-2 rounded-xl bg-[#0d4542] px-4 py-3 text-xs font-black text-white"><Send className="h-4 w-4" /> Enviar ao cliente</button>}<button disabled={working} onClick={onCancel} className="ml-auto rounded-xl bg-red-50 px-4 py-3 text-xs font-black text-red-600">Cancelar solicitação</button></div></section>}

    <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6"><h3 className="font-serif text-xl font-black">Versões</h3><div className="mt-4 space-y-3">{versions.length ? versions.map((version,index)=><article key={version.id} className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black">Versão {version.version}{index===0?' · mais recente':''}</p><p className="mt-1 text-[10px] text-stone-400">Válida até {dateTime(version.validUntil)}{version.deliveryDays!=null?` · prazo ${version.deliveryDays} dia(s)`:''}</p></div><strong className="text-lg">{money(version.amountCents)}</strong></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">{version.description}</p>{version.conditions && <p className="mt-2 rounded-xl bg-white p-3 text-xs leading-5 text-stone-500"><strong>Condições:</strong> {version.conditions}</p>}{!business && !terminal && ['SENT','NEGOTIATING'].includes(String(detail.status).toUpperCase()) && index===0 && <button disabled={working} onClick={()=>onAccept(version.id)} className="mt-3 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white">Aceitar esta versão</button>}</article>) : <p className="text-xs text-stone-400">Nenhuma versão criada.</p>}</div></section>

    {!business && !terminal && ['SENT','NEGOTIATING'].includes(String(detail.status).toUpperCase()) && <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-[24px] bg-white p-5 ring-1 ring-stone-200"><h3 className="text-sm font-black">Pedir ajuste</h3><textarea rows={3} value={adjustment} onChange={(e)=>setAdjustment(e.target.value)} placeholder="Explique o que precisa mudar" className="input mt-3 h-auto py-3"/><button disabled={working||adjustment.trim().length<3} onClick={onAdjustment} className="mt-3 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">Solicitar ajuste</button></div><div className="rounded-[24px] bg-white p-5 ring-1 ring-stone-200"><h3 className="text-sm font-black">Recusar proposta</h3><textarea rows={3} value={declineReason} onChange={(e)=>setDeclineReason(e.target.value)} placeholder="Motivo opcional" className="input mt-3 h-auto py-3"/><button disabled={working} onClick={onDecline} className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-black text-red-600"><XCircle className="mr-1 inline h-4 w-4"/> Recusar</button></div></section>}

    <section className="rounded-[24px] bg-white p-5 ring-1 ring-stone-200"><h3 className="text-sm font-black">Linha do tempo</h3><div className="mt-4 space-y-2">{(detail.events||[]).map((event:any)=><div key={event.id} className="flex gap-3 text-xs"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-stone-300"/><div><p className="font-black text-stone-700">{event.action}</p><p className="mt-0.5 text-stone-400">{dateTime(event.createdAt)}{event.fromStatus||event.toStatus?` · ${event.fromStatus||'—'} → ${event.toStatus||'—'}`:''}</p></div></div>)}{!(detail.events||[]).length&&<p className="text-xs text-stone-400">Sem eventos registrados.</p>}</div></section>
  </div>;
}

function Status({status}:{status:string}){const value=String(status||'').toUpperCase();const cls=value==='ACCEPTED'?'bg-emerald-100 text-emerald-700':value==='DECLINED'||value==='CANCELED'?'bg-red-50 text-red-600':value==='EXPIRED'?'bg-stone-200 text-stone-500':'bg-amber-50 text-amber-700';return <span className={`rounded-full px-2 py-1 text-[8px] font-black ${cls}`}>{value||'—'}</span>;}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="mt-3 block"><span className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">{label}</span>{children}</label>;}
function money(cents?:number|null){return (Number(cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function dateTime(value?:string|null){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR');}
function defaultValidUntil(){const d=new Date(Date.now()+7*24*60*60*1000);const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);return local.toISOString().slice(0,16);}
