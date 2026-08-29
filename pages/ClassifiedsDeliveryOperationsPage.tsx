import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bike, CheckCircle2, Loader2, PackageCheck, RefreshCw, Truck, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useClassifiedsWorkspace } from '../contexts/ClassifiedsWorkspaceContext';

type DeliveryJob = {
  id: string;
  orderId: string;
  status: string;
  partnerName?: string;
  partnerType?: string;
  amountCents?: number;
  partnerPayableCents?: number;
  settlementMode?: string;
  paymentStatus?: string;
  orderStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  pickupSnapshot?: any;
  destinationSnapshot?: any;
};

type Order = {
  id: string;
  status?: string;
  paymentStatus?: string;
  fulfillmentMode?: string;
  deliveryQuoteSnapshot?: any;
  shippingCents?: number;
  totalCents?: number;
  buyerName?: string;
  buyerEmail?: string;
  createdAt?: string;
};

type Finance = {
  wallet?: { balanceCents?: number; companyId?: string };
  movements?: any[];
  invoices?: any[];
};

const statusFlow = ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'] as const;

export default function ClassifiedsDeliveryOperationsPage() {
  const { data } = useClassifiedsWorkspace();
  const business = data?.activeIdentity === 'COMPANY';
  const [features, setFeatures] = useState<any>(null);
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [finance, setFinance] = useState<Finance>({});
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const featuresResponse = await api.get('/classifieds/commerce/features');
      setFeatures(featuresResponse.data || {});
      if (!business) return;
      const [jobsResponse, ordersResponse, financeResponse] = await Promise.all([
        api.get('/classifieds/delivery/company/jobs').catch(() => ({ data: [] })),
        api.get('/classifieds/me/sales/orders').catch(() => ({ data: [] })),
        api.get('/classifieds/delivery-finance/company').catch(() => ({ data: {} })),
      ]);
      setJobs(Array.isArray(jobsResponse.data) ? jobsResponse.data : []);
      setOrders(Array.isArray(ordersResponse.data) ? ordersResponse.data : []);
      setFinance(financeResponse.data || {});
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar a operação de entregas.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [business, data?.company?.id]);

  const jobOrderIds = useMemo(() => new Set(jobs.map((job) => job.orderId)), [jobs]);
  const dispatchable = useMemo(() => orders.filter((order) => {
    const snapshot = order.deliveryQuoteSnapshot;
    return Boolean(snapshot?.partnerId) && !jobOrderIds.has(order.id) && ['APPROVED'].includes(String(order.paymentStatus || '').toUpperCase());
  }), [orders, jobOrderIds]);

  const callPartner = async (orderId: string) => {
    if (workingId) return;
    setWorkingId(orderId); setError(''); setNotice('');
    try {
      const response = await api.post(`/classifieds/delivery/orders/${orderId}/call-partner`);
      const partner = response.data?.partner?.name || 'parceiro';
      setNotice(`Corrida criada e ${partner} acionado. A mensagem operacional ficou registrada no despacho.`);
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível acionar o parceiro.');
    } finally { setWorkingId(''); }
  };

  const transition = async (job: DeliveryJob, status: string) => {
    if (workingId) return;
    setWorkingId(job.id); setError(''); setNotice('');
    try {
      await api.patch(`/classifieds/delivery/jobs/${job.id}/status`, { status });
      setNotice(`Entrega atualizada para ${statusLabel(status)}.`);
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível atualizar a entrega.');
    } finally { setWorkingId(''); }
  };

  if (!business) return <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-8 text-center ring-1 ring-stone-200"><Truck className="mx-auto h-9 w-9 text-stone-300" /><h1 className="mt-4 font-serif text-2xl font-black">Operação de entregas é Business</h1><p className="mt-2 text-sm text-stone-500">Entre com a identidade da empresa para despachar pedidos e acompanhar parceiros.</p></div>;
  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div>;

  const openJobs = jobs.filter((job) => !['DELIVERED','CANCELED'].includes(String(job.status).toUpperCase()));
  const completed = jobs.filter((job) => String(job.status).toUpperCase() === 'DELIVERED');
  const pendingInvoices = (finance.invoices || []).filter((item) => !['PAID','CANCELED'].includes(String(item.status || '').toUpperCase()));

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#397c75]">Business · Operação</p><h1 className="mt-1 font-serif text-3xl font-black">Entregas</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Despache pedidos pagos, acompanhe a corrida e mantenha o financeiro do parceiro no mesmo fluxo.</p></div><div className="flex gap-2"><Link to="/classificados/logistica" className="rounded-xl bg-white px-4 py-2.5 text-xs font-black text-stone-600 ring-1 ring-stone-200">Configurar logística</Link><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-black text-white"><RefreshCw className="h-4 w-4" /> Atualizar</button></div></header>
      {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      {notice && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div>}
      {!features?.localDeliveryPartners && <div className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">A infraestrutura de parceiros está instalada, mas a feature flag de entrega local ainda está desligada neste ambiente.</div>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<Truck className="h-5 w-5" />} label="Em operação" value={String(openJobs.length)} />
        <Metric icon={<PackageCheck className="h-5 w-5" />} label="Prontos para despachar" value={String(dispatchable.length)} />
        <Metric icon={<CheckCircle2 className="h-5 w-5" />} label="Entregues" value={String(completed.length)} />
        <Metric icon={<WalletCards className="h-5 w-5" />} label="Saldo logística" value={money(finance.wallet?.balanceCents || 0)} />
      </section>

      {dispatchable.length > 0 && <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6"><h2 className="font-serif text-xl font-black">Pedidos aguardando despacho</h2><p className="mt-1 text-xs text-stone-500">Pagamento aprovado e parceiro selecionado no checkout.</p><div className="mt-4 space-y-2">{dispatchable.map((order) => <div key={order.id} className="flex flex-col gap-3 rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-sm font-black">Pedido #{order.id.slice(0,8).toUpperCase()}</p><p className="mt-1 text-xs text-stone-500">{order.deliveryQuoteSnapshot?.partnerName || 'Parceiro selecionado'} · frete {money(order.shippingCents || 0)} · {dateTime(order.createdAt)}</p></div><button disabled={workingId === order.id || !features?.localDeliveryPartners} onClick={() => void callPartner(order.id)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0d4542] px-4 text-xs font-black text-white disabled:opacity-50">{workingId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bike className="h-4 w-4" />} Acionar parceiro</button></div>)}</div></section>}

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6"><h2 className="font-serif text-xl font-black">Corridas</h2>{!jobs.length ? <p className="mt-4 rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">Nenhuma corrida criada ainda.</p> : <div className="mt-4 space-y-3">{jobs.map((job) => <DeliveryJobCard key={job.id} job={job} working={workingId === job.id} onTransition={(status) => void transition(job,status)} />)}</div>}</section>

      <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6"><h2 className="font-serif text-xl font-black">Faturas de entrega</h2><p className="mt-1 text-xs text-stone-500">Uma corrida só gera uma fatura. Histórico e liquidação permanecem auditáveis.</p><div className="mt-4 space-y-2">{(finance.invoices || []).slice(0,20).map((invoice) => <div key={invoice.id} className="flex items-center justify-between rounded-2xl bg-stone-50 p-3 text-xs"><div><p className="font-black">{invoice.status || 'PENDING'}</p><p className="mt-1 text-stone-400">{dateTime(invoice.createdAt)}</p></div><strong>{money(invoice.amountCents || 0)}</strong></div>)}{!(finance.invoices || []).length && <p className="text-xs text-stone-400">Nenhuma fatura.</p>}</div>{pendingInvoices.length > 0 && <p className="mt-3 inline-flex items-center gap-2 text-[10px] font-bold text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> {pendingInvoices.length} fatura(s) em aberto.</p>}</div><div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6"><h2 className="font-serif text-xl font-black">Movimentos</h2><p className="mt-1 text-xs text-stone-500">Créditos e débitos do saldo pré-pago de logística.</p><div className="mt-4 space-y-2">{(finance.movements || []).slice(0,20).map((movement) => <div key={movement.id} className="flex items-center justify-between rounded-2xl bg-stone-50 p-3 text-xs"><div><p className="font-black">{movement.type || movement.reason || 'Movimento'}</p><p className="mt-1 text-stone-400">{dateTime(movement.createdAt)}</p></div><strong className={Number(movement.amountCents || 0) < 0 ? 'text-red-600' : 'text-emerald-600'}>{money(movement.amountCents || 0)}</strong></div>)}{!(finance.movements || []).length && <p className="text-xs text-stone-400">Nenhum movimento.</p>}</div></div></section>
    </div>
  );
}

function DeliveryJobCard({ job, working, onTransition }: { job: DeliveryJob; working: boolean; onTransition: (status:string)=>void }) {
  const status = String(job.status || '').toUpperCase();
  const terminal = ['DELIVERED','CANCELED'].includes(status);
  const next = status === 'CALLED' || status === 'CREATED' ? 'ACCEPTED' : status === 'ACCEPTED' ? 'PICKED_UP' : status === 'PICKED_UP' ? 'IN_TRANSIT' : status === 'IN_TRANSIT' ? 'DELIVERED' : null;
  return <article className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200"><div className="flex flex-col gap-3 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black">{job.partnerName || 'Parceiro'}</p><span className={`rounded-full px-2 py-1 text-[9px] font-black ${status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700' : status === 'PROBLEM' ? 'bg-red-100 text-red-700' : 'bg-sky-100 text-sky-700'}`}>{statusLabel(status)}</span></div><p className="mt-1 text-xs text-stone-500">Pedido #{job.orderId?.slice(0,8).toUpperCase()} · {job.partnerType || 'Entrega'} · {money(job.partnerPayableCents || job.amountCents || 0)}</p><p className="mt-1 text-[10px] text-stone-400">Liquidação: {job.settlementMode || '—'} · criada {dateTime(job.createdAt)}</p></div>{!terminal && <div className="flex flex-wrap gap-2">{next && <button disabled={working} onClick={() => onTransition(next)} className="rounded-xl bg-stone-900 px-3 py-2 text-[10px] font-black text-white disabled:opacity-50">{working ? 'Salvando...' : nextAction(next)}</button>}<button disabled={working} onClick={() => onTransition('PROBLEM')} className="rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-black text-amber-700">Problema</button><button disabled={working} onClick={() => onTransition('CANCELED')} className="rounded-xl bg-red-50 px-3 py-2 text-[10px] font-black text-red-600">Cancelar</button></div>}</div></article>;
}

function Metric({ icon,label,value }:{icon:React.ReactNode;label:string;value:string}) { return <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-stone-200"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e7f2ef] text-[#276b64]">{icon}</div><p className="mt-4 text-[9px] font-black uppercase tracking-[.14em] text-stone-400">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>; }
function money(cents:number){return (Number(cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function dateTime(value?:string|null){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR');}
function statusLabel(value:string){return ({CREATED:'Criada',CALLED:'Parceiro acionado',ACCEPTED:'Aceita',PICKED_UP:'Coletada',IN_TRANSIT:'Em trânsito',DELIVERED:'Entregue',CANCELED:'Cancelada',PROBLEM:'Problema'} as Record<string,string>)[value]||value;}
function nextAction(value:string){return ({ACCEPTED:'Marcar aceita',PICKED_UP:'Marcar coletada',IN_TRANSIT:'Saiu para entrega',DELIVERED:'Marcar entregue'} as Record<string,string>)[value]||value;}
