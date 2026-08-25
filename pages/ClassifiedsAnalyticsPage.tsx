import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, BadgeDollarSign, Eye, Heart, Loader2, MessageCircle, MousePointerClick } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { ClassifiedAnalytics } from '../types/classifieds';

const EMPTY: ClassifiedAnalytics = {
  totals: { views: 0, favorites: 0, conversations: 0, offers: 0, acceptedOffers: 0, contactClicks: 0 },
  listings: [],
  daily: [],
};

export default function ClassifiedsAnalyticsPage() {
  const [data, setData] = useState<ClassifiedAnalytics>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.get('/classifieds/me/analytics')
      .then((response) => alive && setData(response.data as ClassifiedAnalytics))
      .catch((requestError: any) => alive && setError(requestError?.response?.data?.message || 'Não foi possível carregar os dados.'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const activity = useMemo(() => {
    const byDay = new Map<string, number>();
    data.daily.forEach((row) => byDay.set(String(row.day).slice(0, 10), (byDay.get(String(row.day).slice(0, 10)) || 0) + Number(row.count || 0)));
    return [...byDay.entries()].slice(-14);
  }, [data.daily]);
  const max = Math.max(1, ...activity.map(([, count]) => count));

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">Desempenho dos seus classificados</p><h1 className="mt-1 font-serif text-3xl font-black">Analytics</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Visualizações, interesse e conversões organizados por identidade Personal ou Business.</p></header>
      {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric icon={<Eye className="h-4 w-4" />} label="Visualizações" value={data.totals.views} />
        <Metric icon={<Heart className="h-4 w-4" />} label="Favoritos" value={data.totals.favorites} />
        <Metric icon={<MessageCircle className="h-4 w-4" />} label="Conversas" value={data.totals.conversations} />
        <Metric icon={<BadgeDollarSign className="h-4 w-4" />} label="Ofertas" value={data.totals.offers} />
        <Metric icon={<BarChart3 className="h-4 w-4" />} label="Ofertas aceitas" value={data.totals.acceptedOffers} />
        <Metric icon={<MousePointerClick className="h-4 w-4" />} label="Cliques contato" value={data.totals.contactClicks} />
      </div>

      <section className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
        <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Últimos 14 dias com atividade</p><h2 className="mt-1 text-lg font-black">Interações</h2></div><BarChart3 className="h-5 w-5 text-stone-300" /></div>
        {activity.length ? <div className="mt-6 flex h-40 items-end gap-2">{activity.map(([day, count]) => <div key={day} className="flex min-w-0 flex-1 flex-col items-center gap-2"><span className="text-[9px] font-bold text-stone-400">{count}</span><div className="w-full max-w-12 rounded-t-lg bg-[#c96847]" style={{ height: `${Math.max(6, (count / max) * 112)}px` }} /><span className="text-[8px] text-stone-400">{day.slice(5).split('-').reverse().join('/')}</span></div>)}</div> : <p className="mt-6 text-sm text-stone-400">Ainda não há interações suficientes para desenhar a atividade.</p>}
      </section>

      <section className="overflow-hidden rounded-[26px] bg-white shadow-sm ring-1 ring-stone-200">
        <div className="border-b border-stone-100 p-5"><p className="text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Por anúncio</p><h2 className="mt-1 text-lg font-black">O que desperta mais interesse</h2></div>
        {data.listings.length ? <div className="divide-y divide-stone-100">{data.listings.map((item) => <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_repeat(5,74px)] sm:items-center"><div className="min-w-0"><Link to={`/classificados/explorar/${encodeURIComponent(item.slug)}`} className="truncate text-sm font-black text-stone-900 hover:underline">{item.title}</Link><p className="mt-1 text-[10px] uppercase font-bold text-stone-400">{item.listingType === 'SERVICE' ? 'Serviço' : 'Produto'} · {item.status}</p></div><Mini label="Views" value={item.views} /><Mini label="Favoritos" value={item.favorites} /><Mini label="Chats" value={item.conversations} /><Mini label="Ofertas" value={item.offers} /><Mini label="Cliques" value={item.contactClicks} /></div>)}</div> : <div className="p-10 text-center text-sm text-stone-400">Publique seu primeiro anúncio para começar a medir.</div>}
      </section>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="rounded-[20px] bg-white p-4 ring-1 ring-stone-200"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-500">{icon}</span><p className="mt-3 text-2xl font-black text-stone-900">{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[.1em] text-stone-400">{label}</p></div>; }
function Mini({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-stone-50 px-2 py-2 text-center"><p className="text-sm font-black text-stone-800">{value}</p><p className="text-[8px] uppercase font-bold text-stone-400">{label}</p></div>; }
