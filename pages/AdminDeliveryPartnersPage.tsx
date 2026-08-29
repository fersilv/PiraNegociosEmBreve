import React, { useEffect, useMemo, useState } from 'react';
import { Bike, CircleDollarSign, Loader2, Plus, RefreshCw, Save, Truck, WalletCards } from 'lucide-react';
import { api } from '../lib/api';

type Partner = {
  id: string;
  name: string;
  type: string;
  status: string;
  priority?: number;
  cities?: string[];
  maxWeightGrams?: number | null;
  supportsRoundTrip?: boolean;
  supportsPrepaidBalance?: boolean;
  channelType?: string;
  channelTarget?: string | null;
  pixKey?: string | null;
  payoutDeadlineHours?: number;
  contactName?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
};

type RateTable = { id:string; version:number; name:string; startsAt?:string; endsAt?:string|null; active:boolean; rules?:any[] };

const blankPartner = {
  name:'', type:'MOTOBOY', status:'ACTIVE', priority:100, cities:'Piracicaba/SP', maxWeightKg:'', supportsRoundTrip:false, supportsPrepaidBalance:false, channelType:'WHATSAPP_INDIVIDUAL', channelTarget:'', pixKey:'', payoutDeadlineHours:24, contactName:'', contactPhone:'', notes:'',
};

export default function AdminDeliveryPartnersPage() {
  const [partners,setPartners]=useState<Partner[]>([]);
  const [dashboard,setDashboard]=useState<any>({jobs:[],invoices:[],partnerBalances:[],payouts:[]});
  const [selected,setSelected]=useState<Partner|null>(null);
  const [form,setForm]=useState<any>({...blankPartner});
  const [tables,setTables]=useState<RateTable[]>([]);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [tableName,setTableName]=useState('Tabela vigente');
  const [rule,setRule]=useState({city:'Piracicaba',state:'SP',fixedPrice:'',minimumPrice:'',perKm:'',roundTripAdditional:'',estimatedMinutes:'45',maxDistanceKm:''});

  const load=async()=>{
    setLoading(true);setError('');
    try{
      const [partnersResponse,dashboardResponse]=await Promise.all([
        api.get('/admin/classifieds-delivery/partners'),
        api.get('/admin/classifieds-delivery/dashboard'),
      ]);
      setPartners(Array.isArray(partnersResponse.data)?partnersResponse.data:[]);
      setDashboard(dashboardResponse.data||{jobs:[],invoices:[],partnerBalances:[],payouts:[]});
    }catch(e:any){setError(e?.response?.data?.message||'Não foi possível carregar a operação de entregas.');}
    finally{setLoading(false);}
  };

  useEffect(()=>{void load();},[]);

  const selectPartner=async(partner:Partner)=>{
    setSelected(partner);
    setForm({
      name:partner.name,type:partner.type,status:partner.status,priority:partner.priority||100,
      cities:Array.isArray(partner.cities)?partner.cities.join(', '):'',maxWeightKg:partner.maxWeightGrams?Number(partner.maxWeightGrams)/1000:'',
      supportsRoundTrip:Boolean(partner.supportsRoundTrip),supportsPrepaidBalance:Boolean(partner.supportsPrepaidBalance),
      channelType:partner.channelType||'WHATSAPP_INDIVIDUAL',channelTarget:partner.channelTarget||'',pixKey:partner.pixKey||'',
      payoutDeadlineHours:partner.payoutDeadlineHours||24,contactName:partner.contactName||'',contactPhone:partner.contactPhone||'',notes:partner.notes||'',
    });
    try{const response=await api.get(`/admin/classifieds-delivery/partners/${partner.id}/rate-tables`);setTables(Array.isArray(response.data)?response.data:[]);}catch{setTables([]);}
  };

  const newPartner=()=>{setSelected(null);setForm({...blankPartner});setTables([]);setNotice('');setError('');};

  const savePartner=async()=>{
    if(working)return;
    setWorking(true);setError('');setNotice('');
    try{
      const payload={
        name:String(form.name||'').trim(),type:form.type,status:form.status,priority:Number(form.priority||100),
        cities:String(form.cities||'').split(',').map((v)=>v.trim()).filter(Boolean),
        maxWeightGrams:form.maxWeightKg===''?null:Math.round(Number(form.maxWeightKg)*1000),
        supportsRoundTrip:Boolean(form.supportsRoundTrip),supportsPrepaidBalance:Boolean(form.supportsPrepaidBalance),
        channelType:form.channelType,channelTarget:String(form.channelTarget||'').trim()||null,pixKey:String(form.pixKey||'').trim()||null,
        payoutDeadlineHours:Number(form.payoutDeadlineHours||24),contactName:String(form.contactName||'').trim()||null,contactPhone:String(form.contactPhone||'').trim()||null,notes:String(form.notes||'').trim()||null,
      };
      const response=selected?await api.put(`/admin/classifieds-delivery/partners/${selected.id}`,payload):await api.post('/admin/classifieds-delivery/partners',payload);
      setNotice(selected?'Parceiro atualizado.':'Parceiro criado.');
      await load();
      await selectPartner(response.data);
    }catch(e:any){setError(e?.response?.data?.message||'Não foi possível salvar o parceiro.');}
    finally{setWorking(false);}
  };

  const createTable=async()=>{
    if(!selected||working)return;
    setWorking(true);setError('');
    try{
      const response=await api.post(`/admin/classifieds-delivery/partners/${selected.id}/rate-tables`,{name:tableName,active:true,startsAt:new Date().toISOString()});
      setNotice(`Tabela v${response.data?.version||''} criada. Agora adicione regras.`);
      const tablesResponse=await api.get(`/admin/classifieds-delivery/partners/${selected.id}/rate-tables`);
      setTables(Array.isArray(tablesResponse.data)?tablesResponse.data:[]);
    }catch(e:any){setError(e?.response?.data?.message||'Não foi possível criar a tabela.');}
    finally{setWorking(false);}
  };

  const createRule=async(tableId:string)=>{
    if(working)return;
    setWorking(true);setError('');
    try{
      const cents=(value:string)=>value===''?null:Math.max(0,Math.round(Number(String(value).replace(',','.'))*100));
      await api.post(`/admin/classifieds-delivery/rate-tables/${tableId}/rules`,{
        priority:100,city:rule.city||null,state:rule.state||null,
        fixedPriceCents:cents(rule.fixedPrice),minimumPriceCents:cents(rule.minimumPrice)||0,perKmCents:cents(rule.perKm)||0,
        roundTripAdditionalCents:cents(rule.roundTripAdditional)||0,
        maxDistanceMeters:rule.maxDistanceKm===''?null:Math.round(Number(rule.maxDistanceKm)*1000),estimatedMinutes:Number(rule.estimatedMinutes||0)||null,
      });
      setNotice('Regra adicionada à tabela.');
      if(selected){const response=await api.get(`/admin/classifieds-delivery/partners/${selected.id}/rate-tables`);setTables(Array.isArray(response.data)?response.data:[]);}
    }catch(e:any){setError(e?.response?.data?.message||'Não foi possível criar a regra.');}
    finally{setWorking(false);}
  };

  const openInvoices=Array.isArray(dashboard.invoices)?dashboard.invoices:[];
  const jobs=Array.isArray(dashboard.jobs)?dashboard.jobs:[];
  const balances=Array.isArray(dashboard.partnerBalances)?dashboard.partnerBalances:[];
  const payouts=Array.isArray(dashboard.payouts)?dashboard.payouts:[];
  const balanceTotal=balances.reduce((sum:number,item:any)=>sum+Number(item.balanceCents||0),0);
  const activeJobs=jobs.filter((item:any)=>!['DELIVERED','CANCELED'].includes(String(item.status||'').toUpperCase()));

  if(loading)return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400"/></div>;

  return <div className="mx-auto max-w-7xl space-y-6 pb-12">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta-600">Admin · Logística</p><h1 className="mt-1 font-serif text-4xl font-black">Parceiros de entrega</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Cadastro operacional, tabelas versionadas, regras de preço, corridas, faturas e saldo dos parceiros.</p></div><div className="flex gap-2"><button onClick={newPartner} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-xs font-black text-white"><Plus className="h-4 w-4"/> Novo parceiro</button><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-stone-600 ring-1 ring-stone-200"><RefreshCw className="h-4 w-4"/> Atualizar</button></div></header>
    {error&&<div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
    {notice&&<div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div>}

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={<Truck className="h-5 w-5"/>} label="Parceiros" value={String(partners.length)}/><Metric icon={<Bike className="h-5 w-5"/>} label="Corridas abertas" value={String(activeJobs.length)}/><Metric icon={<WalletCards className="h-5 w-5"/>} label="Faturas abertas" value={String(openInvoices.length)}/><Metric icon={<CircleDollarSign className="h-5 w-5"/>} label="Saldo ledger" value={money(balanceTotal)}/></section>

    <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
      <aside className="rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-stone-200 xl:self-start"><h2 className="font-serif text-xl font-black">Parceiros</h2><div className="mt-4 space-y-2">{partners.map((partner)=><button key={partner.id} onClick={()=>void selectPartner(partner)} className={`w-full rounded-2xl p-3 text-left ring-1 ${selected?.id===partner.id?'bg-terracotta-50 ring-terracotta-200':'bg-stone-50 ring-stone-200'}`}><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-black">{partner.name}</p><p className="mt-1 text-[10px] text-stone-400">{partner.type} · prioridade {partner.priority||100}</p></div><span className={`rounded-full px-2 py-1 text-[8px] font-black ${partner.status==='ACTIVE'?'bg-emerald-100 text-emerald-700':'bg-stone-200 text-stone-500'}`}>{partner.status}</span></div></button>)}</div></aside>

      <main className="space-y-5"><section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6"><h2 className="font-serif text-xl font-black">{selected?`Editar ${selected.name}`:'Novo parceiro'}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><TextField label="Nome" value={form.name} onChange={(v)=>setForm({...form,name:v})}/><SelectField label="Tipo" value={form.type} onChange={(v)=>setForm({...form,type:v})} options={['MOTOBOY','BIKE','TRANSPORTADORA','MELHOR_ENVIO']}/><SelectField label="Status" value={form.status} onChange={(v)=>setForm({...form,status:v})} options={['ACTIVE','INACTIVE','SUSPENDED']}/><TextField label="Cidades / áreas (vírgula)" value={form.cities} onChange={(v)=>setForm({...form,cities:v})}/><TextField label="Peso máximo (kg)" value={form.maxWeightKg} onChange={(v)=>setForm({...form,maxWeightKg:v})} type="number"/><TextField label="Prioridade" value={form.priority} onChange={(v)=>setForm({...form,priority:v})} type="number"/><SelectField label="Canal" value={form.channelType} onChange={(v)=>setForm({...form,channelType:v})} options={['WHATSAPP_INDIVIDUAL','WHATSAPP_GROUP_INTEGRATED','WHATSAPP_GROUP_MANUAL','INTEGRATION']}/><TextField label="Destino do canal" value={form.channelTarget} onChange={(v)=>setForm({...form,channelTarget:v})}/><TextField label="Chave Pix" value={form.pixKey} onChange={(v)=>setForm({...form,pixKey:v})}/><TextField label="Contato" value={form.contactName} onChange={(v)=>setForm({...form,contactName:v})}/><TextField label="Telefone" value={form.contactPhone} onChange={(v)=>setForm({...form,contactPhone:v})}/><TextField label="Prazo de repasse (h)" value={form.payoutDeadlineHours} onChange={(v)=>setForm({...form,payoutDeadlineHours:v})} type="number"/></div><div className="mt-4 flex flex-wrap gap-3"><Toggle label="Aceita ida e volta" checked={form.supportsRoundTrip} onChange={(v)=>setForm({...form,supportsRoundTrip:v})}/><Toggle label="Aceita saldo pré-pago" checked={form.supportsPrepaidBalance} onChange={(v)=>setForm({...form,supportsPrepaidBalance:v})}/></div><label className="mt-4 block"><span className="text-[9px] font-black uppercase text-stone-400">Notas internas</span><textarea rows={3} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"/></label><button disabled={working} onClick={()=>void savePartner()} className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-stone-900 px-5 text-xs font-black text-white disabled:opacity-50"><Save className="h-4 w-4"/>{working?'Salvando...':'Salvar parceiro'}</button></section>

      {selected&&<section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6"><h2 className="font-serif text-xl font-black">Tabelas de preço</h2><p className="mt-1 text-xs text-stone-500">Cada nova tabela recebe versão crescente. Cotações antigas mantêm o snapshot da versão usada.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={tableName} onChange={(e)=>setTableName(e.target.value)} className="h-11 flex-1 rounded-xl border border-stone-200 px-3 text-sm"/><button disabled={working} onClick={()=>void createTable()} className="rounded-xl bg-[#0d4542] px-4 text-xs font-black text-white">Criar nova versão</button></div><div className="mt-4 space-y-4">{tables.map((table)=><div key={table.id} className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200"><div className="flex items-center justify-between"><div><p className="text-sm font-black">v{table.version} · {table.name}</p><p className="mt-1 text-[10px] text-stone-400">{table.active?'Ativa':'Inativa'} · início {dateTime(table.startsAt)}</p></div><span className="rounded-full bg-white px-2 py-1 text-[9px] font-black ring-1 ring-stone-200">{table.rules?.length||0} regra(s)</span></div><div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-4"><TextField label="Cidade" value={rule.city} onChange={(v)=>setRule({...rule,city:v})}/><TextField label="UF" value={rule.state} onChange={(v)=>setRule({...rule,state:v})}/><TextField label="Preço fixo R$" value={rule.fixedPrice} onChange={(v)=>setRule({...rule,fixedPrice:v})}/><TextField label="Mínimo R$" value={rule.minimumPrice} onChange={(v)=>setRule({...rule,minimumPrice:v})}/><TextField label="Por km R$" value={rule.perKm} onChange={(v)=>setRule({...rule,perKm:v})}/><TextField label="Ida/volta extra R$" value={rule.roundTripAdditional} onChange={(v)=>setRule({...rule,roundTripAdditional:v})}/><TextField label="Distância máx. km" value={rule.maxDistanceKm} onChange={(v)=>setRule({...rule,maxDistanceKm:v})}/><TextField label="Estimativa min" value={rule.estimatedMinutes} onChange={(v)=>setRule({...rule,estimatedMinutes:v})}/></div><button disabled={working} onClick={()=>void createRule(table.id)} className="mt-3 rounded-xl bg-stone-900 px-4 py-2.5 text-[10px] font-black text-white">Adicionar regra nesta versão</button>{table.rules?.length?<div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-[10px]"><thead className="text-stone-400"><tr><th className="py-2">Cidade</th><th>Distância</th><th>Fixo</th><th>Por km</th><th>Mínimo</th><th>Estimativa</th></tr></thead><tbody>{table.rules.map((r:any)=><tr key={r.id} className="border-t border-stone-200"><td className="py-2 font-bold">{r.city||'Qualquer'}{r.state?`/${r.state}`:''}</td><td>{r.maxDistanceMeters?`${(Number(r.maxDistanceMeters)/1000).toFixed(1)} km`:'—'}</td><td>{r.fixedPriceCents==null?'—':money(r.fixedPriceCents)}</td><td>{money(r.perKmCents||0)}</td><td>{money(r.minimumPriceCents||0)}</td><td>{r.estimatedMinutes?`${r.estimatedMinutes} min`:'—'}</td></tr>)}</tbody></table></div>:null}</div>)}</div></section>}
      </main>
    </div>

    <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-[26px] bg-white p-5 ring-1 ring-stone-200"><h2 className="font-serif text-xl font-black">Corridas recentes</h2><div className="mt-4 space-y-2">{jobs.slice(0,12).map((job:any)=><div key={job.id} className="flex items-center justify-between rounded-xl bg-stone-50 p-3 text-xs"><div><p className="font-black">{job.partnerName} · {job.companyName}</p><p className="mt-1 text-stone-400">{job.status} · {dateTime(job.createdAt)}</p></div><strong>{money(job.partnerPayableCents||job.amountCents||0)}</strong></div>)}</div></div><div className="rounded-[26px] bg-white p-5 ring-1 ring-stone-200"><h2 className="font-serif text-xl font-black">Repasses recentes</h2><div className="mt-4 space-y-2">{payouts.slice(0,12).map((payout:any)=><div key={payout.id} className="flex items-center justify-between rounded-xl bg-stone-50 p-3 text-xs"><div><p className="font-black">{payout.partnerName}</p><p className="mt-1 text-stone-400">{payout.status} · {dateTime(payout.createdAt)}</p></div><strong>{money(payout.amountCents||0)}</strong></div>)}{!payouts.length&&<p className="text-xs text-stone-400">Nenhum repasse registrado.</p>}</div></div></section>
  </div>;
}

function Metric({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){return <div className="rounded-[24px] bg-white p-5 ring-1 ring-stone-200"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-terracotta-50 text-terracotta-600">{icon}</div><p className="mt-4 text-[9px] font-black uppercase tracking-[.14em] text-stone-400">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;}
function TextField({label,value,onChange,type='text'}:{label:string;value:any;onChange:(v:string)=>void;type?:string}){return <label><span className="text-[9px] font-black uppercase text-stone-400">{label}</span><input type={type} value={value??''} onChange={(e)=>onChange(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-stone-200 px-3 text-sm"/></label>;}
function SelectField({label,value,onChange,options}:{label:string;value:string;onChange:(v:string)=>void;options:string[]}){return <label><span className="text-[9px] font-black uppercase text-stone-400">{label}</span><select value={value} onChange={(e)=>onChange(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold">{options.map((o)=><option key={o}>{o}</option>)}</select></label>;}
function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(v:boolean)=>void}){return <button type="button" onClick={()=>onChange(!checked)} className={`rounded-xl px-3 py-2 text-xs font-black ${checked?'bg-emerald-100 text-emerald-700':'bg-stone-100 text-stone-500'}`}>{checked?'✓ ':''}{label}</button>;}
function money(cents:any){return (Number(cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function dateTime(value?:string|null){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR');}
