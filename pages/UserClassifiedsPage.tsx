import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Heart, Loader2, MoreHorizontal, Plus, Store, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ClassifiedListingCard, classifiedPrice } from '../components/classifieds/ClassifiedListingCard';
import { api } from '../lib/api';
import type { ClassifiedListing, ClassifiedListingStatus } from '../types/classifieds';

type Tab = 'mine' | 'favorites';

export default function UserClassifiedsPage() {
  const [tab, setTab] = useState<Tab>('mine');
  const [mine, setMine] = useState<ClassifiedListing[]>([]);
  const [favorites, setFavorites] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [mineResponse, favoriteResponse] = await Promise.all([
        api.get('/classifieds/me/listings'),
        api.get('/classifieds/me/favorites'),
      ]);
      setMine(Array.isArray(mineResponse.data) ? mineResponse.data : []);
      setFavorites(Array.isArray(favoriteResponse.data) ? favoriteResponse.data : []);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar seus classificados.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({
    published: mine.filter((item) => item.status === 'PUBLISHED').length,
    draft: mine.filter((item) => item.status === 'DRAFT').length,
    sold: mine.filter((item) => item.status === 'SOLD').length,
  }), [mine]);

  const setStatus = async (listing: ClassifiedListing, status: ClassifiedListingStatus) => {
    if (workingId) return;
    setWorkingId(listing.id); setError('');
    try {
      const response = status === 'PUBLISHED'
        ? await api.post(`/classifieds/me/listings/${listing.id}/publish`)
        : await api.post(`/classifieds/me/listings/${listing.id}/status`, { status });
      setMine((current) => current.map((item) => item.id === listing.id ? response.data : item));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível alterar o anúncio.');
    } finally { setWorkingId(null); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 pb-10 sm:px-0">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[.17em] text-[#b06448]">Meu marketplace</p><h1 className="mt-1 font-serif text-3xl font-bold tracking-[-.03em] text-stone-900 sm:text-4xl">Classificados</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Publique, pause, marque como vendido e acompanhe seus anúncios em uma única tela.</p></div>
        <Link to="/user/classificados/novo" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#c96847] px-5 text-sm font-black text-white shadow-[0_12px_30px_rgba(201,104,71,.18)]"><Plus className="h-4 w-4" /> Novo anúncio</Link>
      </header>

      {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      <div className="grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3"><Stat label="Publicados" value={counts.published} /><Stat label="Rascunhos" value={counts.draft} /><Stat label="Vendidos" value={counts.sold} /></div>

      <div className="flex gap-2 overflow-x-auto border-b border-stone-200 pb-0"><TabButton active={tab === 'mine'} onClick={() => setTab('mine')} icon={<Store className="h-4 w-4" />} label={`Meus anúncios (${mine.length})`} /><TabButton active={tab === 'favorites'} onClick={() => setTab('favorites')} icon={<Heart className="h-4 w-4" />} label={`Favoritos (${favorites.length})`} /></div>

      {loading ? <div className="flex min-h-52 items-center justify-center text-sm font-semibold text-stone-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...</div> : tab === 'favorites' ? (
        favorites.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">{favorites.map((listing) => <ClassifiedListingCard key={listing.id} listing={listing} onFavoriteChange={(id, favorited) => { if (!favorited) setFavorites((current) => current.filter((item) => item.id !== id)); }} />)}</div> : <Empty icon={<Heart className="h-7 w-7" />} title="Nenhum favorito ainda" text="Quando você salvar um anúncio, ele aparece aqui." action="Explorar classificados" href="/classificados" />
      ) : mine.length ? (
        <div className="space-y-3">{mine.map((listing) => <MyListingRow key={listing.id} listing={listing} working={workingId === listing.id} setStatus={setStatus} />)}</div>
      ) : <Empty icon={<Tag className="h-7 w-7" />} title="Seu primeiro anúncio pode nascer agora" text="Use fotos, preço e localização. O fluxo foi desenhado para funcionar inteiro pelo celular." action="Criar anúncio" href="/user/classificados/novo" />}
    </div>
  );
}

function MyListingRow({ listing, working, setStatus }: { listing: ClassifiedListing; working: boolean; setStatus: (listing: ClassifiedListing, status: ClassifiedListingStatus) => void }) {
  const image = listing.images?.[0]?.url;
  return <article className="grid gap-4 rounded-[22px] bg-white p-3 shadow-sm ring-1 ring-stone-200 sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:items-center sm:p-4"><div className="aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100 sm:aspect-square">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-stone-300"><Tag className="h-7 w-7" /></div>}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={listing.status} />{listing.isFeatured && <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black uppercase tracking-[.12em] text-amber-700">Destaque</span>}</div><h2 className="mt-2 truncate text-base font-bold text-stone-900 sm:text-lg">{listing.title}</h2><p className="mt-1 text-sm font-black text-stone-800">{classifiedPrice(listing)}</p><p className="mt-1 text-xs text-stone-400">{listing.city} - {listing.state} · {listing.viewsCount || 0} visualizações · {listing.favoritesCount || 0} favoritos</p></div><div className="flex flex-wrap gap-2 border-t border-stone-100 pt-3 sm:max-w-[230px] sm:justify-end sm:border-0 sm:pt-0">{listing.status === 'DRAFT' && <button disabled={working} onClick={() => setStatus(listing, 'PUBLISHED')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Publicar</button>}{listing.status === 'PUBLISHED' && <><Link to={`/classificados/anuncio/${listing.slug}`} className="inline-flex items-center gap-1 rounded-xl bg-stone-900 px-3 py-2 text-xs font-bold text-white">Ver <ArrowRight className="h-3.5 w-3.5" /></Link><button disabled={working} onClick={() => setStatus(listing, 'PAUSED')} className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-600 disabled:opacity-50">Pausar</button><button disabled={working} onClick={() => setStatus(listing, 'SOLD')} className="rounded-xl bg-[#fff1e9] px-3 py-2 text-xs font-bold text-[#a84f34] disabled:opacity-50">Vendido</button></>}{listing.status === 'PAUSED' && <button disabled={working} onClick={() => setStatus(listing, 'PUBLISHED')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Reativar</button>}{listing.status === 'SOLD' && <button disabled={working} onClick={() => setStatus(listing, 'ARCHIVED')} className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-600 disabled:opacity-50">Arquivar</button>}{working && <span className="flex h-9 w-9 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin" /></span>}</div></article>;
}

function StatusBadge({ status }: { status: ClassifiedListingStatus }) { const map: Record<string, [string, string]> = { PUBLISHED: ['Publicado', 'bg-emerald-50 text-emerald-700'], DRAFT: ['Rascunho', 'bg-stone-100 text-stone-600'], PAUSED: ['Pausado', 'bg-amber-50 text-amber-700'], SOLD: ['Vendido', 'bg-blue-50 text-blue-700'], ARCHIVED: ['Arquivado', 'bg-stone-100 text-stone-400'], PENDING_REVIEW: ['Em análise', 'bg-violet-50 text-violet-700'] }; const [label, style] = map[status] || [status, 'bg-stone-100 text-stone-600']; return <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[.12em] ${style}`}>{label}</span>; }
function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-[18px] bg-white p-3 ring-1 ring-stone-200 sm:p-4"><p className="text-2xl font-black text-stone-900">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">{label}</p></div>; }
function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) { return <button onClick={onClick} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-black ${active ? 'border-[#c96847] text-[#a84f34]' : 'border-transparent text-stone-400'}`}>{icon}{label}</button>; }
function Empty({ icon, title, text, action, href }: { icon: React.ReactNode; title: string; text: string; action: string; href: string }) { return <div className="rounded-[26px] border border-dashed border-stone-300 bg-white px-5 py-12 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff1e9] text-[#b06448]">{icon}</div><h2 className="mt-4 font-serif text-2xl font-bold text-stone-900">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">{text}</p><Link to={href} className="mt-5 inline-flex rounded-2xl bg-stone-900 px-5 py-3 text-sm font-black text-white">{action}</Link></div>; }
