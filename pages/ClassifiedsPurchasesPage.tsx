import React, { useEffect, useMemo, useState } from 'react';
import { Clipboard, Loader2, PackageCheck, QrCode, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type Purchase = {
  id: string;
  listingId: string;
  title: string;
  slug: string;
  image?: string | null;
  companyName?: string | null;
  quantity: number;
  totalCents: number;
  paymentMethod?: string | null;
  paymentStatus: string;
  providerStatusDetail?: string | null;
  status: string;
  fulfillmentMode: 'ARRANGE' | 'PICKUP' | 'DELIVERY';
  fulfillmentData?: { address?: string | null; note?: string | null } | null;
  createdAt: string;
  expiresAt?: string | null;
  pix?: { copyPaste?: string | null; qrCodeBase64?: string | null; ticketUrl?: string | null } | null;
};

type Filter = 'ALL' | 'PENDING' | 'PAID' | 'COMPLETED' | 'CANCELED';

export default function ClassifiedsPurchasesPage() {
  const [rows, setRows] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get('/classifieds/me/purchases');
      setRows(Array.isArray(response.data) ? response.data : []);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar suas compras.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => rows.filter((row) => {
    if (filter === 'PENDING') return ['PENDING','IN_PROCESS'].includes(row.paymentStatus);
    if (filter === 'PAID') return row.paymentStatus === 'APPROVED' && row.status !== 'COMPLETED';
    if (filter === 'COMPLETED') return row.status === 'COMPLETED';
    if (filter === 'CANCELED') return ['CANCELED','REJECTED','REFUNDED'].includes(row.paymentStatus) || row.status === 'CANCELED';
    return true;
  }), [rows, filter]);

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">Classificados · comprador</p><h1 className="mt-1 font-serif text-3xl font-black">Minhas compras</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Acompanhe pagamento, retirada, entrega e histórico dos produtos comprados online.</p></div><button onClick={() => void load()} className="rounded-xl bg-white px-4 py-2.5 text-xs font-black text-stone-600 ring-1 ring-stone-200">Atualizar</button></header>
    {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
    <div className="flex flex-wrap gap-2">{([['ALL','Todas'],['PENDING','Aguardando pagamento'],['PAID','Pagas'],['COMPLETED','Concluídas'],['CANCELED','Canceladas']] as Array<[Filter,string]>).map(([id,label]) => <button key={id} onClick={() => setFilter(id)} className={`rounded-full px-4 py-2 text-xs font-black ${filter === id ? 'bg-[#3a222b] text-white' : 'bg-white text-stone-500 ring-1 ring-stone-200'}`}>{label}</button>)}</div>
    {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div> : visible.length ? <div className="space-y-4">{visible.map((purchase) => <PurchaseCard key={purchase.id} purchase={purchase} />)}</div> : <div className="rounded-[28px] border border-dashed border-stone-300 bg-white px-6 py-14 text-center"><ShoppingBag className="mx-auto h-9 w-9 text-stone-300" /><h2 className="mt-4 font-serif text-2xl font-black">Nenhuma compra neste filtro</h2><Link to="/classificados/explorar" className="mt-5 inline-flex rounded-2xl bg-stone-950 px-5 py-3 text-sm font-black text-white">Explorar produtos</Link></div>}
  </div>;
}

function PurchaseCard({ purchase }: { purchase: Purchase }) {
  const copyPix = async () => { if (purchase.pix?.copyPaste) await navigator.clipboard.writeText(purchase.pix.copyPaste); };
  return <article className="overflow-hidden rounded-[26px] bg-white shadow-sm ring-1 ring-stone-200"><div className="grid gap-4 p-4 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center"><Link to={`/classificados/explorar/${encodeURIComponent(purchase.slug)}`} className="aspect-square overflow-hidden rounded-2xl bg-stone-100">{purchase.image ? <img src={purchase.image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><PackageCheck className="h-8 w-8 text-stone-300" /></div>}</Link><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Status purchase={purchase} /><span className="text-[10px] font-bold text-stone-400">#{purchase.id.slice(0,8).toUpperCase()}</span></div><Link to={`/classificados/explorar/${encodeURIComponent(purchase.slug)}`} className="mt-2 block truncate text-base font-black text-stone-950 hover:underline">{purchase.title}</Link><p className="mt-1 text-xs text-stone-400">{purchase.companyName} · {purchase.quantity} un. · {fulfillmentLabel(purchase.fulfillmentMode)}</p><p className="mt-2 text-xl font-black text-[#a84f34]">{moneyCents(purchase.totalCents)}</p>{purchase.fulfillmentData?.address && <p className="mt-2 text-[10px] text-stone-400">Entrega: {purchase.fulfillmentData.address}</p>}</div><div className="sm:text-right"><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">Pedido</p><p className="mt-1 text-xs font-black text-stone-700">{orderStatus(purchase.status)}</p><p className="mt-1 text-[10px] text-stone-400">{new Date(purchase.createdAt).toLocaleString('pt-BR')}</p></div></div>{purchase.pix?.copyPaste && ['PENDING','IN_PROCESS'].includes(purchase.paymentStatus) && <div className="border-t border-sky-100 bg-sky-50/60 p-4"><div className="flex items-center gap-2 text-xs font-black text-sky-800"><QrCode className="h-4 w-4" /> Pix aguardando pagamento</div><div className="mt-3 flex gap-2"><p className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2 text-[10px] text-stone-500 ring-1 ring-sky-100">{purchase.pix.copyPaste}</p><button onClick={() => void copyPix()} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-sky-700 px-3 py-2 text-[10px] font-black text-white"><Clipboard className="h-3.5 w-3.5" /> Copiar</button></div></div>}</article>;
}

function Status({ purchase }: { purchase: Purchase }) { const [label, cls] = purchase.paymentStatus === 'APPROVED' ? ['Pago','bg-emerald-50 text-emerald-700'] : ['PENDING','IN_PROCESS'].includes(purchase.paymentStatus) ? ['Aguardando pagamento','bg-amber-50 text-amber-700'] : purchase.paymentStatus === 'REFUNDED' ? ['Estornado','bg-violet-50 text-violet-700'] : ['Cancelado','bg-stone-100 text-stone-600']; return <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[.1em] ${cls}`}>{label}</span>; }
function fulfillmentLabel(value: string) { return value === 'PICKUP' ? 'Retirada' : value === 'DELIVERY' ? 'Entrega' : 'A combinar'; }
function orderStatus(value: string) { return ({ CREATED:'Criado',PAID:'Pago',CONFIRMED:'Confirmado',PREPARING:'Preparando',READY:'Pronto',OUT_FOR_DELIVERY:'Saiu para entrega',COMPLETED:'Concluído',CANCELED:'Cancelado' } as Record<string,string>)[value] || value; }
function moneyCents(value: unknown) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value || 0)/100); }
