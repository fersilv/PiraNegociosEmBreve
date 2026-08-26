import React, { useEffect, useMemo, useState } from 'react';
import { BadgeDollarSign, Building2, Gavel, Loader2, Save, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { api } from '../lib/api';

type PlanKey = 'FREE' | 'PLUS' | 'ELITE';
type RuleKind = 'SALE' | 'AUCTION';
type Rule = { id: string; scope: 'PLAN'|'COMPANY'; plan?: PlanKey|null; companyId?: string|null; companyName?: string|null; percentage: number|null; minimumFeeCents: number; maximumFeeCents: number|null; enabled: boolean };
type Draft = { percentage: string; minimum: string; maximum: string; enabled: boolean };
const PLANS: PlanKey[] = ['FREE','PLUS','ELITE'];
const EMPTY: Draft = { percentage: '', minimum: '0,00', maximum: '', enabled: true };
const productCode: Partial<Record<PlanKey,string>> = { PLUS: 'COMPANY_PLUS_MONTHLY', ELITE: 'COMPANY_ELITE_MONTHLY' };

export default function AdminClassifiedCommercePage() {
  const [saleRules,setSaleRules]=useState<Rule[]>([]);
  const [auctionRules,setAuctionRules]=useState<Rule[]>([]);
  const [saleDrafts,setSaleDrafts]=useState<Record<string,Draft>>({});
  const [auctionDrafts,setAuctionDrafts]=useState<Record<string,Draft>>({});
  const [prices,setPrices]=useState<Record<PlanKey,string>>({FREE:'0,00',PLUS:'',ELITE:''});
  const [query,setQuery]=useState(''); const [companies,setCompanies]=useState<any[]>([]); const [selected,setSelected]=useState<any|null>(null);
  const [saleCustom,setSaleCustom]=useState<Draft>({...EMPTY}); const [auctionCustom,setAuctionCustom]=useState<Draft>({...EMPTY});
  const [loading,setLoading]=useState(true); const [working,setWorking]=useState(''); const [message,setMessage]=useState('');

  const load=async()=>{setLoading(true);try{
    const [sales,auctions,products]=await Promise.all([api.get('/admin/classifieds-commerce/fee-rules'),api.get('/admin/classifieds-commerce/auction-fee-rules'),api.get('/admin/payments/products')]);
    const sr=Array.isArray(sales.data)?sales.data:[]; const ar=Array.isArray(auctions.data)?auctions.data:[]; const ps=Array.isArray(products.data)?products.data:[];
    setSaleRules(sr);setAuctionRules(ar);
    setSaleDrafts(Object.fromEntries(PLANS.map(p=>[p,fromRule(sr.find((r:Rule)=>r.scope==='PLAN'&&r.plan===p))])));
    setAuctionDrafts(Object.fromEntries(PLANS.map(p=>[p,fromRule(ar.find((r:Rule)=>r.scope==='PLAN'&&r.plan===p),p==='FREE'?'0,99':'0,99')])));
    const by=new Map(ps.map((p:any)=>[p.code,p]));setPrices({FREE:'0,00',PLUS:toReais((by.get('COMPANY_PLUS_MONTHLY') as any)?.priceCents||0),ELITE:toReais((by.get('COMPANY_ELITE_MONTHLY') as any)?.priceCents||0)});
  }catch(e:any){setMessage(e?.response?.data?.message||'Não foi possível carregar as regras de monetização.');}finally{setLoading(false)}};
  useEffect(()=>{void load()},[]);
  useEffect(()=>{const q=query.trim();if(q.length<2){setCompanies([]);return}const t=window.setTimeout(()=>api.get(`/admin/classifieds-commerce/companies?q=${encodeURIComponent(q)}`).then(r=>setCompanies(Array.isArray(r.data)?r.data:[])).catch(()=>setCompanies([])),250);return()=>window.clearTimeout(t)},[query]);

  const savePlan=async(kind:RuleKind,plan:PlanKey)=>{const drafts=kind==='SALE'?saleDrafts:auctionDrafts;const d=drafts[plan];setWorking(`${kind}-${plan}`);setMessage('');try{
    const base=kind==='SALE'?'fee-rules':'auction-fee-rules'; const reqs:Promise<any>[]=[api.patch(`/admin/classifieds-commerce/${base}/plans/${plan}`,payload(d))];
    if(kind==='SALE'&&productCode[plan]) reqs.push(api.patch(`/admin/payments/products/${productCode[plan]}`,{priceCents:toCents(prices[plan])}));
    await Promise.all(reqs);setMessage(`${kind==='SALE'?'Comissão de venda':'Taxa de leilão'} do plano ${plan} atualizada.`);await load();
  }catch(e:any){setMessage(e?.response?.data?.message||'Não foi possível salvar a regra.')}finally{setWorking('')}};

  const choose=(company:any)=>{setSelected(company);setQuery(company.name||'');setCompanies([]);setSaleCustom(fromRule(saleRules.find(r=>r.scope==='COMPANY'&&r.companyId===company.id)));setAuctionCustom(fromRule(auctionRules.find(r=>r.scope==='COMPANY'&&r.companyId===company.id),'0,99'))};
  const saveCustom=async(kind:RuleKind)=>{if(!selected)return;setWorking(`${kind}-company`);try{const base=kind==='SALE'?'fee-rules':'auction-fee-rules';const draft=kind==='SALE'?saleCustom:auctionCustom;await api.patch(`/admin/classifieds-commerce/${base}/companies/${selected.id}`,payload(draft));setMessage(`${kind==='SALE'?'Comissão de venda':'Taxa de leilão'} Custom de ${selected.name} salva.`);await load()}catch(e:any){setMessage(e?.response?.data?.message||'Não foi possível salvar a regra Custom.')}finally{setWorking('')}};
  const removeCustom=async(kind:RuleKind,rule:Rule)=>{if(!rule.companyId||!window.confirm(`Remover a regra Custom de ${rule.companyName||'esta empresa'}?`))return;setWorking(`delete-${kind}-${rule.companyId}`);try{const base=kind==='SALE'?'fee-rules':'auction-fee-rules';await api.delete(`/admin/classifieds-commerce/${base}/companies/${rule.companyId}`);setMessage('Regra Custom removida.');await load()}finally{setWorking('')}};

  const saleCustoms=useMemo(()=>saleRules.filter(r=>r.scope==='COMPANY'),[saleRules]); const auctionCustoms=useMemo(()=>auctionRules.filter(r=>r.scope==='COMPANY'),[auctionRules]);
  if(loading&&!Object.keys(saleDrafts).length)return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400"/></div>;
  return <div className="mx-auto max-w-7xl space-y-7">
    <header><p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta-600">Classificados · monetização</p><h1 className="mt-1 font-serif text-3xl font-black">Comissões e taxas</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Venda online e leilão têm regras independentes. Alterar uma não modifica a outra. Regra Custom por empresa sempre substitui a regra do plano.</p></header>
    {message&&<div className="rounded-2xl bg-stone-900 px-4 py-3 text-sm font-bold text-white">{message}</div>}

    <FeeSection kind="SALE" icon={<ShoppingCart className="h-5 w-5"/>} title="Comissão de venda online" text="Cobrada quando um produto é pago pelo checkout normal dos Classificados." drafts={saleDrafts} setDrafts={setSaleDrafts} prices={prices} setPrices={setPrices} working={working} savePlan={savePlan}/>
    <FeeSection kind="AUCTION" icon={<Gavel className="h-5 w-5"/>} title="Taxa de leilão" text="Cobrada somente no pagamento online do arremate. O padrão inicial é 0,99% sobre o valor arrematado; eventual frete não entra na base da taxa." drafts={auctionDrafts} setDrafts={setAuctionDrafts} prices={prices} setPrices={setPrices} working={working} savePlan={savePlan}/>

    <section className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <div className="rounded-[28px] bg-white p-5 ring-1 ring-stone-200"><div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-violet-700"/><div><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">Contrato especial</p><h2 className="text-lg font-black">Custom por empresa</h2></div></div><p className="mt-2 text-xs leading-5 text-stone-500">A mesma empresa pode ter uma comissão Custom de venda e outra taxa Custom de leilão.</p>
        <label className="relative mt-4 block"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"/><input value={query} onChange={e=>{setQuery(e.target.value);if(selected&&e.target.value!==selected.name)setSelected(null)}} placeholder="Buscar empresa por nome ou CNPJ" className="h-12 w-full rounded-2xl bg-stone-50 pl-11 pr-4 text-sm font-semibold outline-none ring-1 ring-stone-200"/></label>
        {companies.length>0&&<div className="mt-2 max-h-56 overflow-auto rounded-2xl border bg-white p-1">{companies.map(c=><button key={c.id} onClick={()=>choose(c)} className="w-full rounded-xl px-3 py-3 text-left hover:bg-stone-50"><p className="text-sm font-black">{c.name}</p><p className="text-[10px] text-stone-400">{c.city?`${c.city}/${c.state||''}`:'Local não informado'}</p></button>)}</div>}
        {selected&&<div className="mt-5 grid gap-4"><CustomBox title="Venda online" draft={saleCustom} onChange={setSaleCustom} onSave={()=>void saveCustom('SALE')} saving={working==='SALE-company'}/><CustomBox title="Leilão" draft={auctionCustom} onChange={setAuctionCustom} onSave={()=>void saveCustom('AUCTION')} saving={working==='AUCTION-company'}/></div>}
      </div>
      <div className="rounded-[28px] bg-white p-5 ring-1 ring-stone-200"><div className="flex items-center gap-3"><BadgeDollarSign className="h-5 w-5"/><h2 className="text-lg font-black">Regras Custom ativas</h2></div><CustomList title="Venda online" kind="SALE" rows={saleCustoms} onEdit={r=>choose({id:r.companyId,name:r.companyName||r.companyId})} onDelete={removeCustom}/><CustomList title="Leilão" kind="AUCTION" rows={auctionCustoms} onEdit={r=>choose({id:r.companyId,name:r.companyName||r.companyId})} onDelete={removeCustom}/></div>
    </section>
    <div className="rounded-[24px] border border-blue-200 bg-blue-50 p-5 text-xs leading-5 text-blue-900"><strong>Sem confusão de taxas:</strong> mensalidade do plano, comissão da venda normal e taxa de leilão são três coisas distintas. O seller pode negociar diretamente sem usar checkout; a taxa transacional só é aplicada quando o pagamento passa pelo fluxo online correspondente.</div>
  </div>;
}

function FeeSection({kind,icon,title,text,drafts,setDrafts,prices,setPrices,working,savePlan}:{kind:RuleKind;icon:React.ReactNode;title:string;text:string;drafts:Record<string,Draft>;setDrafts:React.Dispatch<React.SetStateAction<Record<string,Draft>>>;prices:Record<PlanKey,string>;setPrices:React.Dispatch<React.SetStateAction<Record<PlanKey,string>>>;working:string;savePlan:(kind:RuleKind,plan:PlanKey)=>Promise<void>}){return <section><div className="mb-3 flex items-start gap-3">{icon}<div><h2 className="text-xl font-black">{title}</h2><p className="mt-1 text-xs text-stone-500">{text}</p></div></div><div className="grid gap-4 lg:grid-cols-3">{PLANS.map(plan=><article key={plan} className="rounded-[26px] bg-white p-5 ring-1 ring-stone-200"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase text-stone-400">Plano</p><h3 className="text-xl font-black">{plan}</h3></div><span className="rounded-full bg-stone-100 px-3 py-1 text-[9px] font-black">{drafts[plan]?.enabled!==false?'Ativa':'Desativada'}</span></div>{kind==='SALE'&&<div className="mt-4"><MoneyInput label="Mensalidade" value={plan==='FREE'?'0,00':prices[plan]} setValue={v=>setPrices(c=>({...c,[plan]:v}))} disabled={plan==='FREE'}/></div>}<RuleFields draft={drafts[plan]||{...EMPTY}} onChange={d=>setDrafts(c=>({...c,[plan]:d}))}/><button onClick={()=>void savePlan(kind,plan)} disabled={working===`${kind}-${plan}`} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 text-sm font-black text-white disabled:opacity-50">{working===`${kind}-${plan}`?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>} Salvar</button></article>)}</div></section>}
function CustomBox({title,draft,onChange,onSave,saving}:{title:string;draft:Draft;onChange:(d:Draft)=>void;onSave:()=>void;saving:boolean}){return <div className="rounded-2xl bg-stone-50 p-4"><p className="text-xs font-black">{title}</p><RuleFields draft={draft} onChange={onChange}/><button onClick={onSave} disabled={saving} className="mt-3 flex h-10 w-full items-center justify-center rounded-xl bg-violet-700 text-xs font-black text-white">{saving?'Salvando...':'Salvar Custom'}</button></div>}
function CustomList({title,kind,rows,onEdit,onDelete}:{title:string;kind:RuleKind;rows:Rule[];onEdit:(r:Rule)=>void;onDelete:(kind:RuleKind,r:Rule)=>void}){return <div className="mt-5"><p className="text-[10px] font-black uppercase tracking-[.12em] text-stone-400">{title}</p>{rows.length?<div className="mt-2 space-y-2">{rows.map(r=><div key={r.id} className="flex items-center gap-3 rounded-2xl bg-stone-50 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{r.companyName||r.companyId}</p><p className="text-[10px] text-stone-500">{formatPercent(r.percentage)}% · mín. {money(r.minimumFeeCents)} · {r.maximumFeeCents==null?'sem teto':`teto ${money(r.maximumFeeCents)}`}</p></div><button onClick={()=>onEdit(r)} className="rounded-xl bg-white px-3 py-2 text-[10px] font-black ring-1 ring-stone-200">Editar</button><button onClick={()=>onDelete(kind,r)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600"><Trash2 className="h-4 w-4"/></button></div>)}</div>:<p className="mt-2 text-xs text-stone-400">Nenhuma regra Custom.</p>}</div>}
function RuleFields({draft,onChange}:{draft:Draft;onChange:(d:Draft)=>void}){const patch=(k:keyof Draft,v:any)=>onChange({...draft,[k]:v});return <div className="mt-4 grid grid-cols-2 gap-3"><Field label="Percentual (%)"><input value={draft.percentage} onChange={e=>patch('percentage',e.target.value)} inputMode="decimal" className={inputClass}/></Field><Field label="Ativa"><button type="button" onClick={()=>patch('enabled',!draft.enabled)} className={`h-11 rounded-xl text-xs font-black ${draft.enabled?'bg-emerald-100 text-emerald-800':'bg-stone-200 text-stone-500'}`}>{draft.enabled?'Sim':'Não'}</button></Field><MoneyInput label="Mínimo" value={draft.minimum} setValue={v=>patch('minimum',v)}/><MoneyInput label="Teto (opcional)" value={draft.maximum} setValue={v=>patch('maximum',v)}/></div>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.1em] text-stone-400">{label}</span>{children}</label>}
function MoneyInput({label,value,setValue,disabled=false}:{label:string;value:string;setValue:(v:string)=>void;disabled?:boolean}){return <Field label={label}><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-stone-400">R$</span><input value={value} disabled={disabled} onChange={e=>setValue(e.target.value)} inputMode="decimal" className={`${inputClass} pl-9 disabled:bg-stone-100`}/></div></Field>}
const inputClass='h-11 w-full rounded-xl bg-white px-3 text-sm font-bold outline-none ring-1 ring-stone-200 focus:ring-[#c96847]/40';
function fromRule(rule?:Rule,fallback=''){return rule?{percentage:String(rule.percentage??'').replace('.',','),minimum:toReais(rule.minimumFeeCents),maximum:rule.maximumFeeCents==null?'':toReais(rule.maximumFeeCents),enabled:rule.enabled}:{...EMPTY,percentage:fallback}}
function payload(d:Draft){return{percentage:d.percentage,minimumFeeCents:toCents(d.minimum),maximumFeeCents:d.maximum.trim()===''?null:toCents(d.maximum),enabled:d.enabled}}
function toCents(v:string){const n=Number(String(v||'0').replace(/\./g,'').replace(',','.'));return Number.isFinite(n)?Math.max(0,Math.round(n*100)):0}
function toReais(c:number){return (Number(c||0)/100).toFixed(2).replace('.',',')}
function money(c:number){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(c||0)/100)}
function formatPercent(v:number|null){return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:2})}
