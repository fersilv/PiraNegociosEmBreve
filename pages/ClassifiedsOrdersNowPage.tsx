import React, { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  ChevronRight,
  Clock3,
  Columns3,
  GripVertical,
  LayoutList,
  Loader2,
  MapPin,
  PackageCheck,
  Printer,
  RefreshCw,
  Search,
  ShoppingBag,
  Star,
  UserRound,
  X,
} from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import { ClassifiedMediaFrame } from '../components/classifieds/ClassifiedMediaFrame';
import { useAuth } from '../contexts/AuthContext';
import { useClassifiedsWorkspace } from '../contexts/ClassifiedsWorkspaceContext';
import { API_URL, SOCKET_PATH, api } from '../lib/api';

type Order = {
  id: string;
  listingId: string;
  title?: string;
  slug?: string;
  image?: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerWhatsapp?: string | null;
  buyerPhone?: string | null;
  buyerProfileAddress?: string | null;
  buyerProfileCity?: string | null;
  buyerProfileState?: string | null;
  quantity: number;
  itemKinds?: number;
  itemUnits?: number;
  unitPriceCents: number | string;
  itemSubtotalCents?: number | string | null;
  shippingCents?: number | string;
  buyerFeeCents?: number | string;
  discountCents?: number | string;
  totalCents: number | string;
  platformFeeCents?: number | string;
  sellerNetCents?: number | string;
  paymentProvider?: string | null;
  paymentMethod?: string | null;
  paymentStatus: string;
  status: string;
  orderMode?: string;
  fulfillmentMode: string;
  fulfillmentData?: any;
  deliveryQuoteSnapshot?: any;
  paymentFinancialSnapshot?: any;
  metadata?: any;
  operationalPriority?: 'NORMAL' | 'HIGH' | 'URGENT';
  manualPriority?: 'NORMAL' | 'HIGH' | 'URGENT';
  autoUrgent?: boolean;
  ageMinutes?: number;
  createdAt: string;
  updatedAt?: string;
  items?: Array<any>;
  events?: Array<any>;
};

type ViewMode = 'KANBAN' | 'LIST';
type PrintFormat = '58' | '80' | 'A4';
type PrintDocument = 'ORDER' | 'DELIVERY' | 'RECEIPT' | 'MIRROR';

type Column = {
  key: string;
  title: string;
  statuses: string[];
  targetStatus?: string;
  hint: string;
};

const COLUMNS: Column[] = [
  { key: 'NEW', title: 'Novos', statuses: ['CREATED','PAID'], hint: 'Entraram e aguardam confirmação' },
  { key: 'CONFIRMED', title: 'Confirmados', statuses: ['CONFIRMED'], targetStatus: 'CONFIRMED', hint: 'Aceitos pela operação' },
  { key: 'PREPARING', title: 'Em preparação', statuses: ['PREPARING'], targetStatus: 'PREPARING', hint: 'Separando ou preparando' },
  { key: 'READY', title: 'Prontos', statuses: ['READY'], targetStatus: 'READY', hint: 'Aguardando retirada ou saída' },
  { key: 'OUT', title: 'Em entrega', statuses: ['OUT_FOR_DELIVERY'], targetStatus: 'OUT_FOR_DELIVERY', hint: 'Saiu para o cliente' },
  { key: 'DONE', title: 'Concluídos', statuses: ['COMPLETED'], targetStatus: 'COMPLETED', hint: 'Finalizados' },
];

const STATUS_ACTIONS = [
  ['CONFIRMED','Confirmar'],
  ['PREPARING','Em preparação'],
  ['READY','Pronto'],
  ['OUT_FOR_DELIVERY','Saiu para entrega'],
  ['COMPLETED','Concluir'],
  ['CANCELED','Cancelar'],
] as const;

export default function ClassifiedsOrdersNowPage() {
  const { user } = useAuth();
  const { data } = useClassifiedsWorkspace();
  const business = data?.activeIdentity === 'COMPANY';
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ACTIVE');
  const [view, setView] = useState<ViewMode>('KANBAN');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const load = async (silent = false) => {
    if (!business) return;
    if (!silent) setLoading(true);
    try {
      const response = await api.get('/classifieds/me/orders/operations');
      setOrders(Array.isArray(response.data) ? response.data : []);
      if (!silent) setError('');
    } catch (requestError: any) {
      if (!silent) setError(requestError?.response?.data?.message || 'Não foi possível carregar as vendas.');
    } finally { if (!silent) setLoading(false); }
  };

  const loadDetail = async (orderId: string, silent = false) => {
    if (!silent) setDetailLoading(true);
    try {
      const response = await api.get(`/classifieds/me/orders/operations/${orderId}`);
      setDetail(response.data as Order);
    } catch (requestError: any) {
      if (!silent) setError(requestError?.response?.data?.message || 'Não foi possível abrir o pedido.');
    } finally { if (!silent) setDetailLoading(false); }
  };

  useEffect(() => { void load(); }, [business, data?.company?.id]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    void loadDetail(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!business || !user) return;
    let socket: Socket | null = null;
    let disposed = false;
    let refreshTimer: number | null = null;
    void (async () => {
      const token = await user.getIdToken().catch(() => '');
      if (!token || disposed) return;
      const socketOrigin = new URL(API_URL, window.location.origin).origin;
      socket = io(`${socketOrigin}/classified-orders`, {
        path: SOCKET_PATH,
        transports: ['websocket','polling'],
        auth: { token },
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 4000,
      });
      socket.on('connect', () => setSocketConnected(true));
      socket.on('disconnect', () => setSocketConnected(false));
      socket.on('orders:update', (payload: { orderId?: string; reason?: string }) => {
        if (refreshTimer) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => {
          void load(true);
          if (selectedId && payload?.orderId === selectedId) void loadDetail(selectedId, true);
        }, 80);
        if (payload?.reason === 'CREATED') {
          setNotice('Nova venda recebida agora.');
          window.setTimeout(() => setNotice((current) => current === 'Nova venda recebida agora.' ? '' : current), 6000);
        }
      });
    })();
    return () => {
      disposed = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      socket?.disconnect();
      setSocketConnected(false);
    };
  }, [business, user?.uid, selectedId]);

  useEffect(() => {
    if (!business) return;
    const interval = window.setInterval(() => void load(true), socketConnected ? 30000 : 5000);
    return () => window.clearInterval(interval);
  }, [business, socketConnected]);

  const changeStatus = async (orderId: string, status: string) => {
    if (working || !status) return;
    setWorking(orderId); setError('');
    try {
      const response = await api.patch(`/classifieds/me/orders/operations/${orderId}/status`, { status });
      setOrders((current) => current.map((item) => item.id === orderId ? { ...item, ...response.data } : item));
      if (selectedId === orderId) void loadDetail(orderId, true);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível mover o pedido.');
      await load(true);
    } finally { setWorking(''); }
  };

  const changePriority = async (orderId: string, priority: 'NORMAL' | 'HIGH' | 'URGENT') => {
    if (working) return;
    setWorking(orderId); setError('');
    try {
      const response = await api.patch(`/classifieds/me/orders/operations/${orderId}/priority`, { priority });
      setOrders((current) => current.map((item) => item.id === orderId ? { ...item, ...response.data } : item));
      if (selectedId === orderId) void loadDetail(orderId, true);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível alterar a prioridade.');
    } finally { setWorking(''); }
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-BR');
    return orders.filter((order) => {
      if (filter === 'ACTIVE' && ['COMPLETED','CANCELED'].includes(order.status)) return false;
      if (filter === 'NEW' && !['CREATED','PAID'].includes(order.status)) return false;
      if (filter === 'PREPARING' && order.status !== 'PREPARING') return false;
      if (filter === 'READY' && order.status !== 'READY') return false;
      if (filter === 'DELIVERY' && order.status !== 'OUT_FOR_DELIVERY') return false;
      if (filter === 'HISTORY' && !['COMPLETED','CANCELED'].includes(order.status)) return false;
      if (!needle) return true;
      return [order.id, order.title, order.buyerName, order.buyerEmail, order.buyerWhatsapp]
        .some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(needle));
    }).sort(sortOperational);
  }, [orders, filter, query]);

  const counts = useMemo(() => ({
    ACTIVE: orders.filter((item) => !['COMPLETED','CANCELED'].includes(item.status)).length,
    NEW: orders.filter((item) => ['CREATED','PAID'].includes(item.status)).length,
    PREPARING: orders.filter((item) => item.status === 'PREPARING').length,
    READY: orders.filter((item) => item.status === 'READY').length,
    DELIVERY: orders.filter((item) => item.status === 'OUT_FOR_DELIVERY').length,
    HISTORY: orders.filter((item) => ['COMPLETED','CANCELED'].includes(item.status)).length,
  }), [orders]);

  const drop = (column: Column) => {
    if (!draggedId || !column.targetStatus) {
      setDraggedId(null);
      return;
    }
    const order = orders.find((item) => item.id === draggedId);
    setDraggedId(null);
    if (!order || order.status === column.targetStatus || ['COMPLETED','CANCELED'].includes(order.status)) return;
    void changeStatus(order.id, column.targetStatus);
  };

  if (!business) return <div className="mx-auto max-w-2xl rounded-[28px] bg-white p-8 text-center ring-1 ring-stone-200"><ShoppingBag className="mx-auto h-10 w-10 text-stone-300" /><h1 className="mt-4 font-serif text-3xl font-black">Minhas vendas é Business</h1><p className="mt-2 text-sm leading-6 text-stone-500">Abra o workspace de uma empresa para acompanhar a operação das vendas.</p></div>;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 pb-12">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${socketConnected ? 'bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,.10)]' : 'bg-amber-400'}`} /><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#397c75]">{socketConnected ? 'Ao vivo' : 'Reconectando · atualização automática'}</p></div><h1 className="mt-1 font-serif text-3xl font-black">Minhas vendas</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">A central operacional da empresa: vendas novas, em preparação, prontas, em entrega e concluídas.</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => setView('KANBAN')} className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-black ${view === 'KANBAN' ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200'}`}><Columns3 className="h-4 w-4" /> Kanban</button><button type="button" onClick={() => setView('LIST')} className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-black ${view === 'LIST' ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200'}`}><LayoutList className="h-4 w-4" /> Lista</button><button type="button" onClick={() => void load()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-3 text-xs font-black text-stone-600 ring-1 ring-stone-200"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button></div>
      </header>

      {notice && <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800"><BellRing className="h-5 w-5" /> {notice}</div>}
      {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      <section className="rounded-[24px] bg-white p-3 shadow-sm ring-1 ring-black/[.05]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pedido, cliente, produto, telefone..." className="h-11 w-full rounded-xl bg-stone-50 pl-10 pr-3 text-sm font-semibold outline-none ring-1 ring-stone-200" /></label>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">{[
            ['ACTIVE','Em aberto'],['NEW','Novos'],['PREPARING','Preparação'],['READY','Prontos'],['DELIVERY','Em entrega'],['HISTORY','Histórico'],
          ].map(([value,label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`shrink-0 rounded-xl px-3 py-2.5 text-[10px] font-black ${filter === value ? 'bg-[#0d4542] text-white' : 'bg-stone-100 text-stone-600'}`}>{label} <span className="ml-1 opacity-65">{(counts as any)[value] || 0}</span></button>)}</div>
        </div>
      </section>

      {loading ? <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div> : view === 'KANBAN' ? <div className="overflow-x-auto pb-3"><div className="grid min-w-[1320px] grid-cols-6 gap-3">{COLUMNS.map((column) => {
        const columnOrders = filtered.filter((order) => column.statuses.includes(order.status));
        return <section key={column.key} onDragOver={(event) => { if (column.targetStatus) event.preventDefault(); }} onDrop={() => drop(column)} className={`min-h-[520px] rounded-[24px] bg-stone-100/80 p-3 ring-1 ring-stone-200 ${column.targetStatus ? '' : 'cursor-default'}`}><div className="mb-3 flex items-start justify-between gap-2"><div><h2 className="text-sm font-black text-stone-800">{column.title}</h2><p className="mt-0.5 text-[9px] leading-4 text-stone-400">{column.hint}</p></div><span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-stone-500 ring-1 ring-stone-200">{columnOrders.length}</span></div><div className="space-y-2">{columnOrders.map((order) => <OrderCard key={order.id} order={order} working={working === order.id} onOpen={() => setSelectedId(order.id)} onDragStart={() => setDraggedId(order.id)} onPriority={changePriority} />)}{!columnOrders.length && <div className="rounded-2xl border border-dashed border-stone-300 px-3 py-8 text-center text-[10px] font-bold text-stone-400">Nada aqui agora</div>}</div></section>;
      })}</div></div> : <div className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-stone-200">{filtered.length ? <div className="divide-y divide-stone-100">{filtered.map((order) => <OrderListRow key={order.id} order={order} onOpen={() => setSelectedId(order.id)} />)}</div> : <div className="px-6 py-16 text-center text-sm text-stone-500">Nenhuma venda neste filtro.</div>}</div>}

      {selectedId && <OrderDetailModal order={detail} loading={detailLoading} working={working === selectedId} onClose={() => setSelectedId(null)} onStatus={(status) => void changeStatus(selectedId, status)} onPriority={(priority) => void changePriority(selectedId, priority)} />}
    </div>
  );
}

function OrderCard({ order, working, onOpen, onDragStart, onPriority }: { order: Order; working: boolean; onOpen: () => void; onDragStart: () => void; onPriority: (id: string, priority: 'NORMAL'|'HIGH'|'URGENT') => void }) {
  const urgent = order.operationalPriority === 'URGENT' || order.operationalPriority === 'HIGH';
  const draggable = !['COMPLETED','CANCELED'].includes(order.status);
  return <article draggable={draggable} onDragStart={onDragStart} onClick={onOpen} className={`group cursor-pointer rounded-[18px] bg-white p-3 shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md ${urgent ? 'ring-amber-300' : 'ring-stone-200'}`}><div className="flex gap-3"><ClassifiedMediaFrame src={order.image} alt="" className="h-14 w-14 shrink-0 rounded-xl" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="text-[9px] font-black uppercase tracking-[.1em] text-stone-400">#{shortId(order.id)}</span><div className="flex items-center gap-1">{urgent && <span className="rounded-full bg-amber-50 px-2 py-1 text-[8px] font-black text-amber-700">PRIORIDADE</span>}{draggable && <GripVertical className="h-4 w-4 text-stone-300" />}</div></div><p className="mt-1 truncate text-xs font-black text-stone-800">{order.title || 'Pedido'}</p><p className="mt-1 truncate text-[10px] text-stone-500">{order.buyerName || 'Cliente'} · {Number(order.itemUnits || order.quantity || 1)} item(ns)</p></div></div><div className="mt-3 flex items-end justify-between gap-3"><div><p className="text-sm font-black">{moneyCents(order.totalCents)}</p><p className={`mt-0.5 text-[9px] font-bold ${order.paymentStatus === 'APPROVED' ? 'text-emerald-600' : 'text-amber-600'}`}>{paymentLabel(order)}</p></div><div className="text-right"><p className="inline-flex items-center gap-1 text-[9px] font-bold text-stone-400"><Clock3 className="h-3 w-3" /> {ageLabel(order.ageMinutes)}</p><p className="mt-1 text-[9px] font-black text-stone-500">{order.fulfillmentMode === 'DELIVERY' ? 'Entrega' : order.fulfillmentMode === 'PICKUP' ? 'Retirada' : 'Combinar'}</p></div></div><div className="mt-3 flex gap-1.5 border-t border-stone-100 pt-2"><button type="button" disabled={working} onClick={(event) => { event.stopPropagation(); void onPriority(order.id, order.manualPriority === 'URGENT' ? 'NORMAL' : 'URGENT'); }} className={`flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[9px] font-black ${order.manualPriority === 'URGENT' ? 'bg-amber-100 text-amber-800' : 'bg-stone-50 text-stone-500'}`}><Star className={`h-3 w-3 ${order.manualPriority === 'URGENT' ? 'fill-current' : ''}`} /> Prioridade</button><span className="flex h-8 items-center justify-center rounded-lg bg-stone-50 px-2 text-stone-400"><ChevronRight className="h-3.5 w-3.5" /></span></div></article>;
}

function OrderListRow({ order, onOpen }: { order: Order; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="grid w-full gap-3 px-4 py-4 text-left hover:bg-stone-50 sm:grid-cols-[68px_minmax(0,1fr)_auto] sm:items-center"><ClassifiedMediaFrame src={order.image} alt="" className="hidden h-14 w-14 rounded-xl sm:block" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[9px] font-black uppercase text-stone-400">#{shortId(order.id)}</span><StatusBadge status={order.status} /><span className={`rounded-full px-2 py-1 text-[8px] font-black ${order.paymentStatus === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{paymentLabel(order)}</span>{order.operationalPriority !== 'NORMAL' && <span className="rounded-full bg-amber-100 px-2 py-1 text-[8px] font-black text-amber-800">PRIORIDADE</span>}</div><p className="mt-1 truncate text-sm font-black">{order.title}</p><p className="mt-1 text-xs text-stone-500">{order.buyerName} · {Number(order.itemUnits || order.quantity || 1)} item(ns) · {order.fulfillmentMode === 'DELIVERY' ? 'Entrega' : 'Retirada'}</p></div><div className="sm:text-right"><p className="text-sm font-black">{moneyCents(order.totalCents)}</p><p className="mt-1 text-[10px] font-bold text-stone-400">{formatDate(order.createdAt)}</p></div></button>;
}

function OrderDetailModal({ order, loading, working, onClose, onStatus, onPriority }: { order: Order | null; loading: boolean; working: boolean; onClose: () => void; onStatus: (status: string) => void; onPriority: (priority: 'NORMAL'|'HIGH'|'URGENT') => void }) {
  const [printFormat, setPrintFormat] = useState<PrintFormat>('80');
  const [printDocument, setPrintDocument] = useState<PrintDocument>('ORDER');
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = old; };
  }, []);
  return <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]"><header className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-4"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#397c75]">Detalhe operacional</p><h2 className="mt-1 text-lg font-black">{order ? `Pedido #${shortId(order.id)}` : 'Pedido'}</h2></div><button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100"><X className="h-4 w-4" /></button></header>{loading || !order ? <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div> : <div className="overflow-y-auto p-5 sm:p-6"><div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_.8fr]"><div className="space-y-5"><section className="rounded-2xl bg-stone-50 p-4"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={order.status} /><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${order.paymentStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{paymentLabel(order)}</span><span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-stone-600 ring-1 ring-stone-200">{order.fulfillmentMode === 'DELIVERY' ? 'Entrega' : order.fulfillmentMode === 'PICKUP' ? 'Retirada' : 'Combinar'}</span></div><p className="mt-3 text-[10px] font-bold text-stone-400">Criado em {formatDate(order.createdAt)}</p></section><section><h3 className="text-xs font-black uppercase tracking-[.12em] text-stone-400">Itens</h3><div className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-2xl ring-1 ring-stone-200">{(order.items || []).map((item: any) => <div key={item.id} className="flex gap-3 bg-white p-3"><ClassifiedMediaFrame src={item.image || item.listingSnapshot?.image} alt="" className="h-14 w-14 shrink-0 rounded-xl" /><div className="min-w-0 flex-1"><p className="text-xs font-black">{item.titleSnapshot || item.listingSnapshot?.title || order.title}</p><p className="mt-1 text-[10px] text-stone-500">{Number(item.quantity || 1)} × {moneyCents(item.unitPriceCents)}</p></div><p className="text-xs font-black">{moneyCents(item.totalCents)}</p></div>)}</div></section><section><h3 className="text-xs font-black uppercase tracking-[.12em] text-stone-400">Cliente</h3><div className="mt-2 grid gap-3 rounded-2xl bg-stone-50 p-4 sm:grid-cols-2"><Detail label="Nome" value={order.buyerName || 'Cliente'} icon={<UserRound className="h-4 w-4" />} /><Detail label="E-mail" value={order.buyerEmail || 'Não informado'} /><Detail label="WhatsApp" value={order.buyerWhatsapp || order.buyerPhone || 'Não informado'} /><Detail label="Endereço / recebimento" value={deliveryAddress(order)} icon={<MapPin className="h-4 w-4" />} /></div></section>{(order.events || []).length > 0 && <section><h3 className="text-xs font-black uppercase tracking-[.12em] text-stone-400">Linha do tempo</h3><div className="mt-2 space-y-2">{(order.events || []).map((event: any) => <div key={event.id} className="flex gap-3 rounded-xl bg-stone-50 px-3 py-2"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#397c75]" /><div><p className="text-[10px] font-black text-stone-700">{eventLabel(event)}</p><p className="text-[9px] text-stone-400">{formatDate(event.createdAt)}</p></div></div>)}</div></section>}</div><aside className="space-y-4"><section className="rounded-[22px] bg-[#0d3532] p-4 text-white"><p className="text-[9px] font-black uppercase tracking-[.14em] text-white/50">Total do pedido</p><p className="mt-2 text-3xl font-black">{moneyCents(order.totalCents)}</p><div className="mt-4 space-y-2 text-xs"><MoneyLine label="Produtos" value={order.itemSubtotalCents ?? (Number(order.totalCents || 0) - Number(order.shippingCents || 0))} /><MoneyLine label="Frete" value={order.shippingCents || 0} /><MoneyLine label="Taxas comprador" value={order.buyerFeeCents || 0} />{Number(order.discountCents || 0) > 0 && <MoneyLine label="Desconto" value={-Number(order.discountCents || 0)} />}</div></section><section className="rounded-[22px] bg-white p-4 ring-1 ring-stone-200"><p className="text-xs font-black">Andamento</p><div className="mt-3 grid gap-2">{STATUS_ACTIONS.map(([status,label]) => <button key={status} type="button" disabled={working || order.status === status || (['COMPLETED','CANCELED'].includes(order.status) && order.status !== status)} onClick={() => onStatus(status)} className={`h-10 rounded-xl px-3 text-left text-[10px] font-black disabled:opacity-40 ${order.status === status ? 'bg-[#0d4542] text-white' : status === 'CANCELED' ? 'bg-red-50 text-red-700' : 'bg-stone-50 text-stone-600'}`}>{label}</button>)}</div><div className="mt-4 border-t border-stone-100 pt-4"><p className="text-[9px] font-black uppercase text-stone-400">Prioridade</p><div className="mt-2 grid grid-cols-3 gap-1.5">{(['NORMAL','HIGH','URGENT'] as const).map((priority) => <button key={priority} type="button" onClick={() => onPriority(priority)} className={`rounded-lg px-2 py-2 text-[8px] font-black ${order.manualPriority === priority ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' : 'bg-stone-50 text-stone-500'}`}>{priority === 'NORMAL' ? 'Normal' : priority === 'HIGH' ? 'Alta' : 'Urgente'}</button>)}</div></div></section><section className="rounded-[22px] bg-white p-4 ring-1 ring-stone-200"><div className="flex items-center gap-2"><Printer className="h-4 w-4 text-stone-500" /><p className="text-xs font-black">Imprimir</p></div><label className="mt-3 block text-[9px] font-black uppercase text-stone-400">Documento<select value={printDocument} onChange={(event) => setPrintDocument(event.target.value as PrintDocument)} className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700"><option value="ORDER">Pedido / produção</option><option value="DELIVERY">Ficha de entrega</option><option value="RECEIPT">Recibo</option><option value="MIRROR">Espelho do pedido (não fiscal)</option></select></label><label className="mt-3 block text-[9px] font-black uppercase text-stone-400">Papel<select value={printFormat} onChange={(event) => setPrintFormat(event.target.value as PrintFormat)} className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700"><option value="58">Térmica 58 mm</option><option value="80">Térmica 80 mm</option><option value="A4">A4 / comum</option></select></label><button type="button" onClick={() => printOrder(order, printDocument, printFormat)} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-stone-900 text-xs font-black text-white"><Printer className="h-4 w-4" /> Abrir impressão</button></section></aside></div></div>}</div></div>;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string,[string,string]> = {
    CREATED: ['Novo','bg-blue-50 text-blue-700'], PAID: ['Pago / novo','bg-blue-50 text-blue-700'], CONFIRMED: ['Confirmado','bg-indigo-50 text-indigo-700'], PREPARING: ['Em preparação','bg-amber-50 text-amber-700'], READY: ['Pronto','bg-violet-50 text-violet-700'], OUT_FOR_DELIVERY: ['Em entrega','bg-cyan-50 text-cyan-700'], COMPLETED: ['Concluído','bg-emerald-50 text-emerald-700'], CANCELED: ['Cancelado','bg-red-50 text-red-700'],
  };
  const [label,style] = config[status] || [status,'bg-stone-100 text-stone-600'];
  return <span className={`rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-[.08em] ${style}`}>{label}</span>;
}

function Detail({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) { return <div><p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[.1em] text-stone-400">{icon}{label}</p><p className="mt-1 whitespace-pre-line text-xs font-bold leading-5 text-stone-700">{value}</p></div>; }
function MoneyLine({ label, value }: { label: string; value: number | string | null | undefined }) { return <div className="flex justify-between gap-3"><span className="text-white/55">{label}</span><strong>{Number(value || 0) < 0 ? `- ${moneyCents(Math.abs(Number(value || 0)))}` : moneyCents(value)}</strong></div>; }
function shortId(id: string) { return String(id || '').split('-')[0].toUpperCase(); }
function moneyCents(value: unknown) { const cents = Number(value || 0); return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(cents) ? cents / 100 : 0); }
function formatDate(value: unknown) { const date = new Date(String(value || '')); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }); }
function ageLabel(minutes: unknown) { const value = Math.max(0, Number(minutes || 0)); if (value < 1) return 'agora'; if (value < 60) return `${Math.floor(value)} min`; return `${Math.floor(value / 60)}h ${Math.floor(value % 60)}m`; }
function paymentLabel(order: Order) { if (order.orderMode === 'PURCHASE_ORDER') return 'Ordem de compra'; if (order.paymentStatus === 'APPROVED') return order.paymentMethod ? `Pago · ${String(order.paymentMethod).replaceAll('_',' ')}` : 'Pago'; if (order.paymentStatus === 'IN_PROCESS') return 'Pagamento processando'; if (order.paymentStatus === 'PENDING') return 'Pagamento pendente'; return String(order.paymentStatus || 'Pagamento').replaceAll('_',' '); }
function deliveryAddress(order: Order) { const data = order.fulfillmentData || {}; const address = data.address || data.deliveryAddress || data.destinationAddress || null; if (typeof address === 'string' && address.trim()) return address.trim(); if (address && typeof address === 'object') return [address.street && `${address.street}${address.number ? `, ${address.number}` : ''}`, address.complement, address.neighborhood, address.city && `${address.city}${address.state ? `/${address.state}` : ''}`, address.zipCode || address.cep].filter(Boolean).join('\n'); const pieces = [data.street && `${data.street}${data.number ? `, ${data.number}` : ''}`, data.complement, data.neighborhood, data.city && `${data.city}${data.state ? `/${data.state}` : ''}`, data.zipCode || data.cep].filter(Boolean); if (pieces.length) return pieces.join('\n'); if (order.buyerProfileAddress) return [order.buyerProfileAddress, [order.buyerProfileCity,order.buyerProfileState].filter(Boolean).join('/')].filter(Boolean).join('\n'); return order.fulfillmentMode === 'PICKUP' ? 'Retirada na empresa' : 'Endereço não informado'; }
function eventLabel(event: any) { if (event.type === 'STATUS_CHANGED') return `${statusText(event.fromStatus)} → ${statusText(event.toStatus)}`; if (event.type === 'CHECKOUT_CREATED') return 'Compra iniciada'; if (event.type === 'PURCHASE_ORDER_CREATED') return 'Ordem de compra criada'; if (event.type === 'PRIORITY_CHANGED') return `Prioridade: ${event.metadata?.priority || 'alterada'}`; return String(event.type || 'Atualização').replaceAll('_',' ').toLocaleLowerCase('pt-BR'); }
function statusText(value: unknown) { return ({ CREATED:'Novo',PAID:'Pago',CONFIRMED:'Confirmado',PREPARING:'Em preparação',READY:'Pronto',OUT_FOR_DELIVERY:'Em entrega',COMPLETED:'Concluído',CANCELED:'Cancelado' } as Record<string,string>)[String(value || '')] || String(value || ''); }
function sortOperational(a: Order,b: Order) { const p = (item: Order) => item.operationalPriority === 'URGENT' ? 0 : item.operationalPriority === 'HIGH' ? 1 : 2; const diff = p(a)-p(b); if (diff) return diff; return new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime(); }

function printOrder(order: Order, documentType: PrintDocument, format: PrintFormat) {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=900');
  if (!popup) return;
  const items = (order.items || []).map((item: any) => `<tr><td>${escapeHtml(String(item.titleSnapshot || item.listingSnapshot?.title || order.title || 'Item'))}<br><small>${Number(item.quantity || 1)} × ${escapeHtml(moneyCents(item.unitPriceCents))}</small></td><td class="right">${escapeHtml(moneyCents(item.totalCents))}</td></tr>`).join('');
  const labels: Record<PrintDocument,string> = { ORDER:'PEDIDO / PRODUÇÃO', DELIVERY:'FICHA DE ENTREGA', RECEIPT:'RECIBO', MIRROR:'ESPELHO DO PEDIDO · NÃO FISCAL' };
  const pageSize = format === 'A4' ? 'A4' : `${format}mm auto`;
  const width = format === 'A4' ? '190mm' : `${Number(format)-6}mm`;
  const includeAddress = documentType === 'DELIVERY' || documentType === 'ORDER' || documentType === 'MIRROR';
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${labels[documentType]} #${shortId(order.id)}</title><style>@page{size:${pageSize};margin:${format === 'A4' ? '12mm' : '3mm'}}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0;font-size:${format === 'A4' ? '12px' : '10px'}}main{width:${width};max-width:100%;margin:0 auto}.center{text-align:center}.right{text-align:right}.muted{color:#666}.sep{border-top:1px dashed #777;margin:10px 0}h1{font-size:${format === 'A4' ? '20px' : '14px'};margin:0 0 4px}h2{font-size:${format === 'A4' ? '14px' : '11px'};margin:10px 0 4px}p{margin:3px 0;line-height:1.35}table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px solid #ddd;vertical-align:top}small{color:#555}.total{font-size:${format === 'A4' ? '18px' : '14px'};font-weight:800}.no-fiscal{font-weight:800;border:1px solid #111;padding:5px;text-align:center;margin:8px 0}</style></head><body><main><div class="center"><h1>${labels[documentType]}</h1><p>#${shortId(order.id)} · ${escapeHtml(formatDate(order.createdAt))}</p></div>${documentType === 'MIRROR' ? '<div class="no-fiscal">DOCUMENTO NÃO FISCAL</div>' : ''}<div class="sep"></div><h2>Cliente</h2><p><strong>${escapeHtml(order.buyerName || 'Cliente')}</strong></p><p>${escapeHtml(order.buyerWhatsapp || order.buyerPhone || order.buyerEmail || '')}</p>${includeAddress ? `<h2>${order.fulfillmentMode === 'DELIVERY' ? 'Entrega' : 'Recebimento'}</h2><p>${escapeHtml(deliveryAddress(order)).replaceAll('\n','<br>')}</p>` : ''}<div class="sep"></div><h2>Itens</h2><table>${items}</table><div class="sep"></div><p>Produtos <span style="float:right">${escapeHtml(moneyCents(order.itemSubtotalCents ?? Number(order.totalCents || 0)-Number(order.shippingCents || 0)))}</span></p><p>Frete <span style="float:right">${escapeHtml(moneyCents(order.shippingCents || 0))}</span></p><p class="total">TOTAL <span style="float:right">${escapeHtml(moneyCents(order.totalCents))}</span></p><p class="muted">${escapeHtml(paymentLabel(order))}</p>${documentType === 'RECEIPT' ? `<div class="sep"></div><p>Recebemos de <strong>${escapeHtml(order.buyerName || 'Cliente')}</strong> o valor de <strong>${escapeHtml(moneyCents(order.totalCents))}</strong> referente ao pedido #${shortId(order.id)}.</p><br><br><p class="center">________________________________</p><p class="center">Assinatura / responsável</p>` : ''}<div class="sep"></div><p class="center muted">Gerado pelo PiraNegócios · ${escapeHtml(new Date().toLocaleString('pt-BR'))}</p></main><script>window.onload=()=>setTimeout(()=>window.print(),120)</script></body></html>`);
  popup.document.close();
}
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char] || char)); }
