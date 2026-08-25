import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Loader2, Package, Plus, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { classifiedPrice } from '../components/classifieds/ClassifiedListingCard';
import { api } from '../lib/api';
import type { ClassifiedListing, ClassifiedListingStatus, ClassifiedListingType } from '../types/classifieds';

export default function ClassifiedsListingsPage({ listingType }: { listingType: ClassifiedListingType }) {
  const [items, setItems] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const products = listingType === 'PRODUCT';

  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get('/classifieds/me/listings');
      const rows = Array.isArray(response.data) ? response.data as ClassifiedListing[] : [];
      setItems(rows.filter((item) => (item.listingType || 'PRODUCT') === listingType));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar seus classificados.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [listingType]);

  const counts = useMemo(() => ({
    published: items.filter((item) => item.status === 'PUBLISHED').length,
    draft: items.filter((item) => item.status === 'DRAFT').length,
    paused: items.filter((item) => item.status === 'PAUSED').length,
  }), [items]);

  const setStatus = async (listing: ClassifiedListing, status: ClassifiedListingStatus) => {
    if (workingId) return;
    setWorkingId(listing.id); setError('');
    try {
      const response = status === 'PUBLISHED'
        ? await api.post(`/classifieds/me/listings/${listing.id}/publish`)
        : await api.post(`/classifieds/me/listings/${listing.id}/status`, { status });
      setItems((current) => current.map((item) => item.id === listing.id ? { ...item, ...response.data } : item));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível alterar este item.');
    } finally { setWorkingId(null); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">Sua vitrine</p><h1 className="mt-1 font-serif text-3xl font-black">{products ? 'Meus anúncios' : 'Meus serviços'}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">{products ? 'Produtos publicados, rascunhos, pausados e vendidos ficam organizados aqui.' : 'Gerencie separadamente os serviços que você oferece nos Classificados.'}</p></div>
        <Link to="/classificados/publicar" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#c96847] px-5 text-sm font-black text-white"><Plus className="h-4 w-4" /> {products ? 'Novo produto' : 'Novo serviço'}</Link>
      </header>
      {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      <div className="grid max-w-xl grid-cols-3 gap-3"><Stat label="Publicados" value={counts.published} /><Stat label="Rascunhos" value={counts.draft} /><Stat label="Pausados" value={counts.paused} /></div>
      {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div> : items.length ? <div className="space-y-3">{items.map((item) => <ListingRow key={item.id} listing={item} working={workingId === item.id} setStatus={setStatus} />)}</div> : <div className="rounded-[28px] border border-dashed border-stone-300 bg-white px-6 py-14 text-center">{products ? <Package className="mx-auto h-9 w-9 text-stone-300" /> : <Wrench className="mx-auto h-9 w-9 text-stone-300" />}<h2 className="mt-4 font-serif text-2xl font-black">{products ? 'Nenhum produto ainda' : 'Nenhum serviço ainda'}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">{products ? 'Crie seu primeiro anúncio de produto para começar sua vitrine.' : 'Publique seu primeiro serviço e apareça para quem procura esse tipo de trabalho na região.'}</p><Link to="/classificados/publicar" className="mt-5 inline-flex rounded-2xl bg-stone-900 px-5 py-3 text-sm font-black text-white">Criar agora</Link></div>}
    </div>
  );
}

function ListingRow({ listing, working, setStatus }: { listing: ClassifiedListing; working: boolean; setStatus: (listing: ClassifiedListing, status: ClassifiedListingStatus) => void }) {
  const image = listing.images?.[0]?.url;
  return <article className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-stone-200">
    {listing.moderationReason && <div className="flex gap-3 border-b border-amber-100 bg-amber-50 px-4 py-3 text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-xs font-black">Anúncio pausado para evitar duplicidade</p><p className="mt-1 text-xs leading-5">{listing.moderationReason} Edite o anúncio original em vez de manter duas versões do mesmo item.</p></div></div>}
    <div className="grid gap-4 p-4 sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:items-center">
      <div className="aspect-square overflow-hidden rounded-2xl bg-stone-100">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="h-7 w-7 text-stone-300" /></div>}</div>
      <div className="min-w-0"><div className="flex flex-wrap gap-2"><StatusBadge status={listing.status} />{listing.publicationChannels?.includes('COMPANY_PAGE') && <span className="rounded-full bg-teal-50 px-2 py-1 text-[9px] font-black uppercase text-teal-700">Página da empresa</span>}</div><h2 className="mt-2 truncate text-lg font-black text-stone-900">{listing.title}</h2><p className="mt-1 text-sm font-black">{classifiedPrice(listing)}</p><p className="mt-1 text-xs text-stone-400">{listing.viewsCount || 0} visualizações · {listing.favoritesCount || 0} favoritos · {listing.city}/{listing.state}</p></div>
      <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-3 sm:max-w-[280px] sm:justify-end sm:border-0 sm:pt-0"><Link to={`/classificados/explorar/${encodeURIComponent(listing.slug)}`} className="inline-flex items-center gap-1 rounded-xl bg-stone-900 px-3 py-2 text-xs font-black text-white">Ver <ArrowRight className="h-3.5 w-3.5" /></Link>{listing.status === 'DRAFT' && <button disabled={working} onClick={() => setStatus(listing, 'PUBLISHED')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white">Publicar</button>}{listing.status === 'PUBLISHED' && <><button disabled={working} onClick={() => setStatus(listing, 'PAUSED')} className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-black">Pausar</button>{listing.listingType === 'PRODUCT' && <button disabled={working} onClick={() => setStatus(listing, 'SOLD')} className="rounded-xl bg-[#fff1e9] px-3 py-2 text-xs font-black text-[#a84f34]">Vendido</button>}</>}{listing.status === 'PAUSED' && !listing.moderationReason && <button disabled={working} onClick={() => setStatus(listing, 'PUBLISHED')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white">Reativar</button>}{(listing.status === 'SOLD' || listing.status === 'PAUSED') && <button disabled={working} onClick={() => setStatus(listing, 'ARCHIVED')} className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-black">Arquivar</button>}{working && <Loader2 className="h-4 w-4 animate-spin" />}</div>
    </div>
  </article>;
}

function StatusBadge({ status }: { status: ClassifiedListingStatus }) { const map: Record<string, [string,string]> = { PUBLISHED: ['Publicado','bg-emerald-50 text-emerald-700'], DRAFT: ['Rascunho','bg-stone-100 text-stone-600'], PAUSED: ['Pausado','bg-amber-50 text-amber-700'], SOLD: ['Vendido','bg-blue-50 text-blue-700'], ARCHIVED: ['Arquivado','bg-stone-100 text-stone-400'], PENDING_REVIEW: ['Em análise','bg-violet-50 text-violet-700'] }; const [label,style] = map[status] || [status,'bg-stone-100']; return <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[.1em] ${style}`}>{label}</span>; }
function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-[18px] bg-white p-4 ring-1 ring-stone-200"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[.1em] text-stone-400">{label}</p></div>; }
