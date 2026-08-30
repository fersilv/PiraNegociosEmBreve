import React, { useEffect, useMemo, useState } from 'react';
import { Heart, Loader2, RefreshCw, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ClassifiedListingCard } from '../components/classifieds/ClassifiedListingCard';
import { api } from '../lib/api';
import type { ClassifiedListing } from '../types/classifieds';

export default function ClassifiedsFavoritesPage() {
  const [items, setItems] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'ALL' | 'PRODUCT' | 'SERVICE'>('ALL');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get('/classifieds/me/favorites');
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar seus favoritos.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-BR');
    return items.filter((item) => {
      if (type !== 'ALL' && item.listingType !== type) return false;
      if (!needle) return true;
      return [item.title, item.description, item.city, item.state, item.neighborhood]
        .some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(needle));
    });
  }, [items, query, type]);

  const favoriteChanged = (listingId: string, favorited: boolean) => {
    if (!favorited) setItems((current) => current.filter((item) => item.id !== listingId));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-12">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">Salvos para depois</p>
          <h1 className="mt-1 flex items-center gap-2 font-serif text-3xl font-black"><Heart className="h-7 w-7 fill-rose-500 text-rose-500" /> Favoritos</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Produtos e serviços que você marcou com o coração ficam reunidos aqui.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-stone-600 ring-1 ring-stone-200 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </header>

      <div className="rounded-[22px] bg-white p-3 shadow-sm ring-1 ring-black/[.05] sm:flex sm:items-center sm:gap-3">
        <label className="relative block min-w-0 flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nos favoritos" className="h-11 w-full rounded-xl bg-stone-50 pl-10 pr-3 text-sm font-semibold outline-none ring-1 ring-stone-200 focus:bg-white" /></label>
        <div className="mt-2 flex gap-2 overflow-x-auto sm:mt-0">{(['ALL','PRODUCT','SERVICE'] as const).map((value) => <button key={value} type="button" onClick={() => setType(value)} className={`shrink-0 rounded-xl px-3 py-2.5 text-[10px] font-black ${type === value ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'}`}>{value === 'ALL' ? 'Tudo' : value === 'PRODUCT' ? 'Produtos' : 'Serviços'}</button>)}</div>
      </div>

      {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div> : visible.length ? <>
        <p className="text-xs font-bold text-stone-500">{visible.length} {visible.length === 1 ? 'favorito' : 'favoritos'}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{visible.map((listing) => <ClassifiedListingCard key={listing.id} listing={listing} detailBasePath="/classificados/explorar" onFavoriteChange={favoriteChanged} />)}</div>
      </> : <div className="rounded-[28px] border border-dashed border-stone-300 bg-white px-6 py-16 text-center"><Heart className="mx-auto h-10 w-10 text-stone-300" /><h2 className="mt-4 font-serif text-2xl font-black">{items.length ? 'Nada nesse filtro' : 'Nenhum favorito ainda'}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">{items.length ? 'Tente outro termo ou veja todos os tipos.' : 'Toque no coração de um produto ou serviço para guardar aqui.'}</p>{!items.length && <Link to="/classificados/explorar" className="mt-5 inline-flex rounded-2xl bg-stone-900 px-5 py-3 text-sm font-black text-white">Explorar Classificados</Link>}</div>}
    </div>
  );
}
