import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Banknote, CalendarDays, CheckCircle2, CreditCard, Loader2, PackageCheck, PlugZap, RefreshCcw, ShoppingCart, TrendingUp, WalletCards } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useClassifiedsWorkspace } from '../contexts/ClassifiedsWorkspaceContext';
import { api } from '../lib/api';
import type { ClassifiedCommerceStatus, ClassifiedSalesDashboard } from '../types/classifieds';

type Order = {
  id: string;
  title?: string;
  slug?: string;
  buyerName?: string | null;
  totalCents: number | string;
  platformFeeCents: number | string;
  sellerNetCents: number | string;
  paymentMethod?: string | null;
  paymentStatus: string;
  status: string;
  fulfillmentMode: string;
  createdAt: string;
};

const ORDER_STATUS_OPTIONS = [
  ['CONFIRMED', 'Confirmado'],
  ['PREPARING', 'Preparando'],
  ['READY', 'Pronto'],
  ['OUT_FOR_DELIVERY', 'Saiu para entrega'],
  ['COMPLETED', 'Concluído'],
  ['CANCELED', 'Cancelado'],
] as const;

export default function ClassifiedsSalesPage() {
  const { data } = useClassifiedsWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const business = data?.activeIdentity === 'COMPANY';
  const [status, setStatus] = useState<ClassifiedCommerceStatus | null>(null);
  const [dashboard, setDashboard] = useState<ClassifiedSalesDashboard | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    if (!business) return;
    setLoading(true); setError('');
    try {
      const [statusResponse, dashboardResponse, ordersResponse] = await Promise.all([
        api.get('/classifieds/me/commerce/status'),
        api.get('/classifieds/me/sales/dashboard'),
        api.get('/classifieds/me/sales/orders'),
      ]);
      setStatus(statusResponse.data as ClassifiedCommerceStatus);
      setDashboard(dashboardResponse.data as ClassifiedSalesDashboard);
      setOrders(Array.isArray(ordersResponse.data) ? ordersResponse.data : []);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar o módulo de Vendas.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [business, data?.company?.id]);

  useEffect(() => {
    if (!business) return;
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) return;
    let alive = true;
    setWorking('oauth'); setError('');
    api.post('/classifieds/me/payments/mercado-pago/oauth/complete', { code, state })
      .then(() => {
        if (!alive) return;
        setNotice('Mercado Pago conectado. A empresa já pode configurar produtos para recebimento online.');
        navigate('/classificados/vendas', { replace: true });
        void load();
      })
      .catch((requestError: any) => {
        if (alive) setError(requestError?.response?.data?.message || 'Não foi possível concluir a conexão com o Mercado Pago.');
      })
      .finally(() => alive && setWorking(''));
    return () => { alive = false; };
  }, [business, location.search]);

  const mercadoPago = status?.paymentConnections?.find((item) => item.provider === 'MERCADO_PAGO');
  const connected = mercadoPago?.status === 'CONNECTED';

  const connectMercadoPago = async () => {
    if (working) return;
    setWorking('connect'); setError(''); setNotice('');
    try {
      const response = await api.post('/classifieds/me/payments/mercado-pago/oauth/start');
      const url = String(response.data?.authorizationUrl || '');
      if (!url) throw new Error('O Mercado Pago não retornou o endereço de autorização.');
      window.location.assign(url);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Não foi possível iniciar a conexão com o Mercado Pago.');
      setWorking('');
    }
  };

  const disconnectMercadoPago = async () => {
    if (working) return;
    setWorking('disconnect'); setError('');
    try {
      await api.post('/classifieds/me/payments/mercado-pago/disconnect');
      setNotice('Mercado Pago desconectado. Novas compras online ficam indisponíveis até uma nova conexão.');
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível desconectar o Mercado Pago.');
    } finally { setWorking(''); }
  };

  const changeOrderStatus = async (order: Order, next: string) => {
    if (working) return;
    setWorking(order.id); setError('');
    try {
      const response = await api.patch(`/classifieds/me/sales/orders/${order.id}/status`, { status: next });
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, ...response.data } : item));
      setNotice('Status atualizado. O cliente recebe a atualização no PiraNegócios.');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível atualizar o pedido.');
    } finally { setWorking(''); }
  };

  const topProducts = useMemo(() => dashboard?.products?.slice(0, 8) || [], [dashboard]);

  if (!business) {
    return <div className="mx-auto max-w-2xl rounded-[28px] bg-white p-8 text-center ring-1 ring-stone-200"><ShoppingCart className="mx-auto h-10 w-10 text-stone-300" /><h1 className="mt-4 font-serif text-3xl font-black">Vendas é um módulo Business</h1><p className="mt-2 text-sm leading-6 text-stone-500">Use uma empresa verificada para conectar pagamentos, acompanhar pedidos e administrar vendas online.</p></div>;
  }

  if (loading && !status) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#397c75]">Classificados Business</p><h1 className="mt-1 font-serif text-3xl font-black">Vendas</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Frente de caixa, pedidos, recebimentos, retirada/entrega e desempenho dos produtos em um só lugar. O módulo não tem mensalidade adicional: quando a empresa vende online, aplica-se a comissão configurada para o plano ou contrato Custom.</p></div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-stone-600 ring-1 ring-stone-200"><RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </header>
      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500"><span>Plano atual: <strong>{status?.plan || 'FREE'}</strong></span><Link to="/company/planos" className="rounded-full bg-white px-3 py-1.5 font-black text-[#397c75] ring-1 ring-stone-200">Ver ou alterar planos Business</Link></div>

      {(error || notice) && <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{error || notice}</div>}

      {!status?.companyVerified && <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-amber-950"><p className="text-sm font-black">Recebimento online exige empresa verificada</p><p className="mt-1 text-xs leading-5">A gestão de anúncios continua funcionando normalmente. Para conectar uma conta de pagamento e vender online, conclua primeiro a verificação da empresa.</p><Link to="/company/perfil" className="mt-4 inline-flex rounded-xl bg-amber-900 px-4 py-2 text-xs font-black text-white">Ir para verificação</Link></div>}

      <section className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
        <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
          <div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e6f3f0] text-[#17665f]"><PlugZap className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Recebimento online</p><h2 className="mt-1 text-lg font-black">Mercado Pago</h2></div>{connected && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase text-emerald-700"><BadgeCheck className="h-3.5 w-3.5" /> Conectado</span>}</div>
          <p className="mt-4 text-sm leading-6 text-stone-500">A empresa autoriza a própria conta Mercado Pago. As vendas pertencem à empresa e o PiraNegócios recebe somente a comissão configurada para cada venda.</p>
          {connected ? <div className="mt-4 rounded-2xl bg-stone-50 p-4"><p className="text-xs font-black text-stone-700">Conta conectada {mercadoPago?.externalUserId ? `· ID ${mercadoPago.externalUserId}` : ''}</p><p className="mt-1 text-[10px] text-stone-400">Conectada em {formatDate(mercadoPago?.connectedAt)}. As credenciais ficam criptografadas e não aparecem nesta tela.</p><button onClick={() => void disconnectMercadoPago()} disabled={Boolean(working)} className="mt-4 rounded-xl bg-white px-3 py-2 text-xs font-black text-red-600 ring-1 ring-red-100 disabled:opacity-50">Desconectar</button></div> : <button onClick={() => void connectMercadoPago()} disabled={!status?.companyVerified || Boolean(working)} className="mt-5 flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl bg-[#009ee3] px-4 py-3 text-left text-white shadow-[0_14px_35px_rgba(0,158,227,.24)] transition hover:bg-[#008ed0] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[320px]"><span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[10px] font-black text-[#009ee3]">MP</span><span><strong className="block text-sm">Conectar com Mercado Pago</strong><span className="mt-0.5 block text-[10px] font-semibold text-white/75">Autorizar a conta recebedora da empresa</span></span></span>{working === 'connect' || working === 'oauth' ? <Loader2 className="h-5 w-5 animate-spin" /> : <WalletCards className="h-5 w-5" />}</button>}
        </div>

        <div className="rounded-[28px] bg-[#0d3532] p-5 text-white shadow-sm sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-white/50">Comissão da plataforma</p><div className="mt-3 flex items-end gap-3"><p className="text-4xl font-black">{status?.feeRule ? `${formatPercent(status.feeRule.percentage)}%` : '—'}</p><span className="mb-1 rounded-full bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-[.1em] text-white/70">{status?.feeRule?.source || `Plano ${status?.plan || 'FREE'}`}</span></div>
          {status?.feeRule ? <div className="mt-5 grid grid-cols-2 gap-3"><FeeDetail label="Taxa mínima" value={moneyCents(status.feeRule.minimumFeeCents)} /><FeeDetail label="Teto por venda" value={status.feeRule.maximumFeeCents == null ? 'Sem teto' : moneyCents(status.feeRule.maximumFeeCents)} /></div> : <div className="mt-5 rounded-2xl bg-white/8 p-4 text-xs leading-5 text-white/65"><strong className="text-white">Taxa ainda não configurada.</strong> O checkout online fica bloqueado até existir uma regra para o plano {status?.plan || 'FREE'} ou uma regra Custom para esta empresa. Nenhuma porcentagem é assumida automaticamente.</div>}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric icon={<ShoppingCart className="h-4 w-4" />} label="Pedidos" value={String(Number(dashboard?.totals?.orders || 0))} />
        <Metric icon={<CheckCircle2 className="h-4 w-4" />} label="Pagos" value={String(Number(dashboard?.totals?.paid || 0))} />
        <Metric icon={<Banknote className="h-4 w-4" />} label="Vendas pagas" value={moneyCents(dashboard?.totals?.revenue)} />
        <Metric icon={<CreditCard className="h-4 w-4" />} label="Comissão" value={moneyCents(dashboard?.totals?.fees)} />
        <Metric icon={<TrendingUp className="h-4 w-4" />} label="Líquido empresa" value={moneyCents(dashboard?.totals?.net)} wide />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Frente de caixa</p><h2 className="mt-1 font-serif text-2xl font-black">Pedidos recentes</h2></div><PackageCheck className="h-6 w-6 text-stone-300" /></div>{orders.length ? <div className="mt-5 space-y-3">{orders.slice(0, 30).map((order) => <OrderRow key={order.id} order={order} working={working === order.id} onStatus={changeOrderStatus} />)}</div> : <Empty text="Quando a compra online entrar em operação e houver pedidos, eles aparecem aqui com pagamento, retirada/entrega e histórico de status." />}</div>

        <div className="space-y-5">
          <div className="rounded-[28px] bg-white p-5 ring-1 ring-stone-200"><div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-[#397c75]" /><h2 className="text-base font-black">Produtos mais vendidos</h2></div>{topProducts.length ? <div className="mt-4 space-y-3">{topProducts.map((product, index) => <div key={product.id} className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-xs font-black text-stone-500">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{product.title}</p><p className="mt-0.5 text-[10px] text-stone-400">{Number(product.units || 0)} unidades · {moneyCents(product.revenue)}</p></div></div>)}</div> : <Empty text="Ainda não há vendas pagas para montar o ranking." compact />}</div>
          <div className="rounded-[28px] bg-white p-5 ring-1 ring-stone-200"><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[#397c75]" /><h2 className="text-base font-black">Calendário de vendas</h2></div>{dashboard?.calendar?.length ? <div className="mt-4 grid grid-cols-2 gap-2">{dashboard.calendar.slice(-14).map((day) => <div key={day.day} className="rounded-2xl bg-stone-50 p-3"><p className="text-[9px] font-black uppercase text-stone-400">{new Date(`${day.day}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p><p className="mt-1 text-xs font-black">{Number(day.orders)} pedidos</p><p className="text-[10px] text-stone-500">{moneyCents(day.revenue)}</p></div>)}</div> : <Empty text="O calendário ganha movimento conforme as vendas chegam." compact />}</div>
        </div>
      </section>

      <div className="rounded-[24px] border border-[#b9d7d2] bg-[#eef8f6] p-5 text-sm leading-6 text-[#275f59]"><strong>Venda direta continua disponível.</strong> A empresa não é obrigada a conectar pagamento ou usar split. Ofertas, chat e negociação direta continuam funcionando sem taxa de venda online. Ao ativar checkout, a gestão de pedidos passa a ser liberada sem mensalidade adicional e a comissão é cobrada somente nas vendas online conforme a regra vigente.</div>
    </div>
  );
}

function OrderRow({ order, working, onStatus }: { order: Order; working: boolean; onStatus: (order: Order, status: string) => void }) {
  return <article className="grid gap-3 rounded-[20px] bg-stone-50 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><div className="flex flex-wrap gap-2"><StatusPill text={order.paymentStatus === 'APPROVED' ? 'Pago' : order.paymentStatus} ok={order.paymentStatus === 'APPROVED'} /><StatusPill text={order.status} /><StatusPill text={order.fulfillmentMode === 'DELIVERY' ? 'Entrega' : 'Retirada'} /></div><p className="mt-2 truncate text-sm font-black">{order.title || 'Produto'}</p><p className="mt-1 text-xs text-stone-500">{order.buyerName || 'Cliente'} · {moneyCents(order.totalCents)} · líquido {moneyCents(order.sellerNetCents)}</p><p className="mt-1 text-[10px] text-stone-400">{formatDate(order.createdAt)}</p></div><div className="flex items-center gap-2"><select disabled={working || ['COMPLETED','CANCELED'].includes(order.status)} value={order.status} onChange={(event) => void onStatus(order, event.target.value)} className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-xs font-black outline-none disabled:opacity-50">{!ORDER_STATUS_OPTIONS.some(([value]) => value === order.status) && <option value={order.status}>{order.status}</option>}{ORDER_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{working && <Loader2 className="h-4 w-4 animate-spin" />}</div></article>;
}

function Metric({ icon, label, value, wide = false }: { icon: React.ReactNode; label: string; value: string; wide?: boolean }) { return <div className={`rounded-[22px] bg-white p-4 ring-1 ring-stone-200 ${wide ? 'col-span-2 lg:col-span-1' : ''}`}><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-500">{icon}</span><p className="mt-3 text-xl font-black">{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[.1em] text-stone-400">{label}</p></div>; }
function FeeDetail({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-white/8 p-3"><p className="text-[9px] font-black uppercase tracking-[.1em] text-white/45">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>; }
function StatusPill({ text, ok = false }: { text: string; ok?: boolean }) { return <span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[.08em] ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-stone-500 ring-1 ring-stone-200'}`}>{text}</span>; }
function Empty({ text, compact = false }: { text: string; compact?: boolean }) { return <div className={`${compact ? 'py-6' : 'py-10'} text-center text-xs leading-5 text-stone-400`}>{text}</div>; }
function moneyCents(value: unknown) { const cents = Number(value || 0); return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(cents) ? cents / 100 : 0); }
function formatPercent(value: unknown) { const number = Number(value); return Number.isFinite(number) ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(number) : '0'; }
function formatDate(value: unknown) { const date = value ? new Date(String(value)) : null; return date && Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }
