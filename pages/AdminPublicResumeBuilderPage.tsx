import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CreditCard,
  FileText,
  Loader2,
  MousePointerClick,
  RefreshCw,
  Sparkles,
  UserPlus,
  Users,
  WalletCards,
} from 'lucide-react';
import { api } from '../lib/api';

type Summary = {
  periodDays: number;
  metrics: {
    sessions: number;
    resumesCreated: number;
    accountConversions: number;
    checkouts: number;
    sales: number;
    revenueCents: number;
    abandoned: number;
    sessionToResumePercent: number;
    checkoutConversionPercent: number;
    checkoutAbandonmentPercent: number;
  };
  funnel: Array<{ key: string; label: string; value: number }>;
  products: Array<{ productCode: string; name?: string; checkouts: number; sales: number; revenueCents: number; abandoned: number; conversionPercent: number }>;
  sources: Array<{ source: string; sessions: number; completed: number; converted: number }>;
  templates: Array<{ template: string; events: number; sessions: number }>;
  recentOrders: any[];
  recentEvents: any[];
};

function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100);
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function productLabel(code: string, fallback?: string) {
  if (fallback) return fallback;
  if (code === 'PUBLIC_RESUME_AI_REVIEW') return 'Análise por IA';
  if (code === 'PUBLIC_RESUME_AI_IMPROVEMENT') return 'Melhoria com IA';
  if (code === 'PUBLIC_RESUME_REMOVE_WATERMARK') return 'Remoção da marca';
  return code;
}

export function AdminPublicResumeBuilderPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/admin/public-resume/summary?days=${days}`);
      setData(response.data as Summary);
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Não foi possível carregar as métricas do criador público.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [days]);

  const maxFunnel = useMemo(() => Math.max(1, ...(data?.funnel || []).map((item) => Number(item.value || 0))), [data]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 admin-standalone-page">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-terracotta-600">Aquisição · Produto público</p>
          <h1 className="mt-1 font-serif text-3xl font-black text-stone-950">Criador público de currículos</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Acompanhe descoberta, uso do editor, currículos concluídos, compras, abandono, receita e conversão de visitantes anônimos em contas do PiraNegócios.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[7, 30, 90].map((value) => <button type="button" key={value} onClick={() => setDays(value)} className={`rounded-xl border px-3 py-2 text-xs font-black ${days === value ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-600'}`}>{value} dias</button>)}
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-600 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
        </div>
      </header>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
      {loading && !data ? <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-stone-200 bg-white"><Loader2 className="h-6 w-6 animate-spin text-terracotta-600" /></div> : data && <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <Metric icon={<Users />} label="Sessões" value={String(data.metrics.sessions)} hint={`${days} dias`} />
          <Metric icon={<FileText />} label="Currículos criados" value={String(data.metrics.resumesCreated)} hint={`${data.metrics.sessionToResumePercent}% das sessões`} />
          <Metric icon={<MousePointerClick />} label="Checkouts" value={String(data.metrics.checkouts)} hint={`${data.metrics.checkoutConversionPercent}% converteram`} />
          <Metric icon={<CreditCard />} label="Vendas" value={String(data.metrics.sales)} hint="pagamentos reais" />
          <Metric icon={<WalletCards />} label="Receita" value={money(data.metrics.revenueCents)} hint="sem simulações" />
          <Metric icon={<Activity />} label="Abandono" value={String(data.metrics.abandoned)} hint={`${data.metrics.checkoutAbandonmentPercent}% dos checkouts`} warn={data.metrics.abandoned > 0} />
          <Metric icon={<UserPlus />} label="Viraram conta" value={String(data.metrics.accountConversions)} hint="conversão para login" />
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.12fr_.88fr]">
          <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><BarChart3 className="h-5 w-5" /></span><div><h2 className="font-serif text-xl font-black">Funil do criador</h2><p className="text-xs text-stone-400">Pessoas únicas por etapa.</p></div></div>
            <div className="mt-5 space-y-3">{data.funnel.map((item, index) => { const percent = Math.max(2, Math.round((item.value / maxFunnel) * 100)); const previous = index === 0 ? item.value : data.funnel[index - 1]?.value || 0; const stepRate = previous > 0 ? Math.round((item.value / previous) * 1000) / 10 : 0; return <div key={item.key}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-bold text-stone-600">{item.label}</span><span className="font-mono text-stone-400"><strong className="text-stone-900">{item.value}</strong>{index > 0 ? ` · ${stepRate}% da etapa anterior` : ''}</span></div><div className="h-9 overflow-hidden rounded-xl bg-stone-100"><div className="flex h-full min-w-12 items-center rounded-xl bg-stone-900 px-3 text-[10px] font-black text-white transition-all" style={{ width: `${percent}%` }}>{percent}%</div></div></div>; })}</div>
          </section>

          <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><WalletCards className="h-5 w-5" /></span><div><h2 className="font-serif text-xl font-black">Receita por recurso</h2><p className="text-xs text-stone-400">O que o visitante realmente compra.</p></div></div>
            <div className="mt-5 space-y-3">{data.products.length === 0 ? <Empty text="Ainda não há checkouts no período." /> : data.products.map((item) => <div key={item.productCode} className="rounded-2xl border border-stone-200 p-4"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-stone-900">{productLabel(item.productCode, item.name)}</strong><p className="mt-1 text-[11px] text-stone-400">{item.sales} venda(s) de {item.checkouts} checkout(s) · {item.conversionPercent}%</p></div><strong className="text-sm text-emerald-700">{money(item.revenueCents)}</strong></div><div className="mt-3 flex gap-3 text-[10px] font-bold text-stone-400"><span>{item.abandoned} abandono(s)</span><span>{item.sales} aprovado(s)</span></div></div>)}</div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="font-serif text-xl font-black">Origem das sessões</h2><p className="mt-1 text-xs text-stone-400">UTM quando existe, referrer quando não existe.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead><tr className="border-b border-stone-100 text-[9px] uppercase tracking-[.12em] text-stone-400"><th className="pb-2">Origem</th><th className="pb-2 text-right">Sessões</th><th className="pb-2 text-right">Currículos</th><th className="pb-2 text-right">Contas</th></tr></thead><tbody>{data.sources.map((item, index) => <tr key={`${item.source}-${index}`} className="border-b border-stone-50"><td className="max-w-[260px] truncate py-3 font-bold text-stone-600" title={item.source}>{item.source}</td><td className="py-3 text-right">{item.sessions}</td><td className="py-3 text-right">{item.completed}</td><td className="py-3 text-right">{item.converted}</td></tr>)}</tbody></table></div></section>
          <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="font-serif text-xl font-black">Modelos escolhidos</h2><p className="mt-1 text-xs text-stone-400">Sessões que trocaram ou escolheram cada visual.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{data.templates.length === 0 ? <Empty text="Ainda não há escolhas de modelo registradas." /> : data.templates.map((item) => <div key={item.template} className="rounded-2xl border border-stone-200 bg-stone-50 p-4"><span className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">Template</span><strong className="mt-1 block capitalize text-sm">{item.template}</strong><p className="mt-2 text-xs text-stone-500">{item.sessions} sessão(ões) · {item.events} troca(s)</p></div>)}</div></section>
        </div>

        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-serif text-xl font-black">Pedidos recentes</h2><p className="mt-1 text-xs text-stone-400">Inclui pendentes para enxergar onde a compra está morrendo.</p></div><Sparkles className="h-5 w-5 text-stone-300" /></div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead><tr className="border-b border-stone-100 text-[9px] uppercase tracking-[.12em] text-stone-400"><th className="pb-2">Data</th><th className="pb-2">Produto</th><th className="pb-2">Status</th><th className="pb-2">Provedor</th><th className="pb-2">E-mail checkout</th><th className="pb-2 text-right">Valor</th></tr></thead><tbody>{data.recentOrders.map((item) => <tr key={item.id} className="border-b border-stone-50"><td className="py-3 text-stone-500">{dateTime(item.createdAt)}</td><td className="py-3 font-bold text-stone-700">{productLabel(item.productCode, item.productName)}</td><td className="py-3"><Status value={item.status} simulation={item.isSimulation} /></td><td className="py-3 text-stone-500">{item.provider || '-'}</td><td className="py-3 text-stone-500">{item.payerEmail || '-'}</td><td className="py-3 text-right font-bold">{money(item.amountCents)}</td></tr>)}</tbody></table>{data.recentOrders.length === 0 && <Empty text="Nenhum pedido criado ainda." />}</div>
        </section>

        <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="font-serif text-xl font-black">Rastreamento recente</h2><p className="mt-1 text-xs text-stone-400">Últimos eventos do funil. O conteúdo digitado no currículo nunca aparece aqui.</p><div className="mt-4 grid gap-2 lg:grid-cols-2">{data.recentEvents.slice(0, 40).map((event) => <div key={event.id} className="flex items-start gap-3 rounded-2xl border border-stone-100 bg-stone-50/70 p-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-terracotta-500" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-[11px] text-stone-700">{event.type}</strong><span className="text-[9px] text-stone-400">{dateTime(event.createdAt)}</span></div><p className="mt-1 truncate font-mono text-[9px] text-stone-400">sessão {String(event.sessionId).slice(0, 8)}</p>{event.metadata && Object.keys(event.metadata).length > 0 && <p className="mt-1 line-clamp-2 text-[10px] text-stone-500">{Object.entries(event.metadata).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}</p>}</div></div>)}</div></section>
      </>}
    </div>
  );
}

function Metric({ icon, label, value, hint, warn = false }: { icon: React.ReactNode; label: string; value: string; hint: string; warn?: boolean }) {
  return <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${warn ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-600'} [&>svg]:h-4 [&>svg]:w-4`}>{icon}</div><p className="mt-4 text-[9px] font-black uppercase tracking-[.12em] text-stone-400">{label}</p><strong className="mt-1 block text-2xl font-black text-stone-950">{value}</strong><p className="mt-1 text-[10px] text-stone-400">{hint}</p></div>;
}

function Status({ value, simulation }: { value: string; simulation?: boolean }) {
  const tone = value === 'PAID' ? 'bg-emerald-100 text-emerald-700' : value === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-600';
  return <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-black uppercase ${tone}`}>{value}{simulation ? ' · teste' : ''}</span>;
}

function Empty({ text }: { text: string }) {
  return <div className="col-span-full rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-4 text-center text-xs text-stone-400">{text}</div>;
}
