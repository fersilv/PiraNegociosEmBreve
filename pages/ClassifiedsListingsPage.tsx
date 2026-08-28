import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BadgePercent,
  CheckCircle2,
  Loader2,
  MoreVertical,
  Package,
  PackageCheck,
  PauseCircle,
  Plus,
  RefreshCw,
  Trash2,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { classifiedPrice } from '../components/classifieds/ClassifiedListingCard';
import { api } from '../lib/api';
import type { ClassifiedListing, ClassifiedListingStatus, ClassifiedListingType } from '../types/classifieds';

type ViewMode = 'ACTIVE' | 'ARCHIVED';
type LifecycleAction = 'archive' | 'republish' | 'sold' | 'delete' | 'unique';

export default function ClassifiedsListingsPage({ listingType }: { listingType: ClassifiedListingType }) {
  const [items, setItems] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('ACTIVE');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const products = listingType === 'PRODUCT';

  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get('/classifieds/me/listings');
      const rows = Array.isArray(response.data) ? response.data as ClassifiedListing[] : [];
      setItems(rows.filter((item) =>
        (item.listingType || 'PRODUCT') === listingType
        && item.attributes?.softDeleted !== true,
      ));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar seus classificados.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [listingType]);

  const counts = useMemo(() => ({
    published: items.filter((item) => item.status === 'PUBLISHED').length,
    draft: items.filter((item) => item.status === 'DRAFT').length,
    paused: items.filter((item) => item.status === 'PAUSED' || item.status === 'SOLD').length,
    archived: items.filter((item) => item.status === 'ARCHIVED').length,
  }), [items]);

  const visibleItems = useMemo(
    () => items.filter((item) => view === 'ARCHIVED' ? item.status === 'ARCHIVED' : item.status !== 'ARCHIVED'),
    [items, view],
  );

  const setStatus = async (listing: ClassifiedListing, status: ClassifiedListingStatus) => {
    if (workingId) return;
    setWorkingId(listing.id); setError(''); setMessage(''); setMenuId(null);
    try {
      const response = status === 'PUBLISHED'
        ? await api.post(`/classifieds/me/lifecycle/listings/${listing.id}/republish`)
        : await api.post(`/classifieds/me/listings/${listing.id}/status`, { status });
      setItems((current) => current.map((item) => item.id === listing.id ? { ...item, ...response.data } : item));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível alterar este item.');
    } finally { setWorkingId(null); }
  };

  const lifecycle = async (listing: ClassifiedListing, action: LifecycleAction) => {
    if (workingId) return;
    if (action === 'delete' && !window.confirm(`Excluir “${listing.title}”?\n\nO anúncio sairá da sua gestão e da vitrine, mas compras, conversas e histórico serão preservados.`)) return;
    setWorkingId(listing.id); setError(''); setMessage(''); setMenuId(null);
    try {
      let response;
      if (action === 'archive') response = await api.post(`/classifieds/me/lifecycle/listings/${listing.id}/archive`);
      else if (action === 'republish') response = await api.post(`/classifieds/me/lifecycle/listings/${listing.id}/republish`);
      else if (action === 'sold') response = await api.post(`/classifieds/me/lifecycle/listings/${listing.id}/sold`);
      else if (action === 'unique') response = await api.patch(`/classifieds/me/lifecycle/listings/${listing.id}/unique`, { unique: listing.attributes?.uniqueItem !== true });
      else response = await api.delete(`/classifieds/me/lifecycle/listings/${listing.id}`);

      if (action === 'delete') {
        setItems((current) => current.filter((item) => item.id !== listing.id));
        setMessage('Anúncio excluído da vitrine. O histórico relacionado foi preservado.');
      } else {
        setItems((current) => current.map((item) => item.id === listing.id ? { ...item, ...response.data } : item));
        if (action === 'archive') setMessage('Anúncio arquivado. Ele saiu da vitrine e dos relatórios ativos.');
        if (action === 'republish') setMessage('Anúncio publicado novamente.');
        if (action === 'unique') setMessage(listing.attributes?.uniqueItem === true ? 'O produto agora aceita múltiplas vendas.' : 'Produto marcado como item único.');
        if (action === 'sold') setMessage(response.data?.message || 'Venda registrada.');
      }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível concluir esta ação.');
    } finally { setWorkingId(null); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">Sua vitrine</p><h1 className="mt-1 font-serif text-3xl font-black">{products ? 'Meus anúncios' : 'Meus serviços'}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">{products ? 'Produtos podem continuar na vitrine depois de uma venda. Somente itens marcados como únicos saem automaticamente ao serem vendidos.' : 'Gerencie separadamente os serviços que você oferece nos Classificados.'}</p></div>
        <Link to="/classificados/publicar" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#c96847] px-5 text-sm font-black text-white"><Plus className="h-4 w-4" /> {products ? 'Novo produto' : 'Novo serviço'}</Link>
      </header>
      {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      {message && <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{message}</div>}

      <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Publicados" value={counts.published} /><Stat label="Rascunhos" value={counts.draft} /><Stat label="Pausados / vendidos" value={counts.paused} /><Stat label="Arquivados" value={counts.archived} /></div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setView('ACTIVE')} className={`rounded-full px-4 py-2 text-xs font-black ${view === 'ACTIVE' ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 ring-1 ring-stone-200'}`}>Ativos e rascunhos</button>
        <button type="button" onClick={() => setView('ARCHIVED')} className={`rounded-full px-4 py-2 text-xs font-black ${view === 'ARCHIVED' ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 ring-1 ring-stone-200'}`}>Arquivados ({counts.archived})</button>
      </div>

      {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div> : visibleItems.length ? <div className="space-y-3">{visibleItems.map((item) => <ListingRow key={item.id} listing={item} working={workingId === item.id} menuOpen={menuId === item.id} onMenu={() => setMenuId((current) => current === item.id ? null : item.id)} setStatus={setStatus} lifecycle={lifecycle} />)}</div> : <div className="rounded-[28px] border border-dashed border-stone-300 bg-white px-6 py-14 text-center">{view === 'ARCHIVED' ? <Archive className="mx-auto h-9 w-9 text-stone-300" /> : products ? <Package className="mx-auto h-9 w-9 text-stone-300" /> : <Wrench className="mx-auto h-9 w-9 text-stone-300" />}<h2 className="mt-4 font-serif text-2xl font-black">{view === 'ARCHIVED' ? 'Nada arquivado' : products ? 'Nenhum produto ainda' : 'Nenhum serviço ainda'}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">{view === 'ARCHIVED' ? 'Quando você arquivar um item, ele fica guardado aqui e deixa de participar da vitrine e dos relatórios ativos.' : products ? 'Crie seu primeiro anúncio de produto para começar sua vitrine.' : 'Publique seu primeiro serviço e apareça para quem procura esse tipo de trabalho na região.'}</p>{view !== 'ARCHIVED' && <Link to="/classificados/publicar" className="mt-5 inline-flex rounded-2xl bg-stone-900 px-5 py-3 text-sm font-black text-white">Criar agora</Link>}</div>}
    </div>
  );
}

function ListingRow({ listing, working, menuOpen, onMenu, setStatus, lifecycle }: {
  listing: ClassifiedListing;
  working: boolean;
  menuOpen: boolean;
  onMenu: () => void;
  setStatus: (listing: ClassifiedListing, status: ClassifiedListingStatus) => void;
  lifecycle: (listing: ClassifiedListing, action: LifecycleAction) => void;
}) {
  const image = listing.images?.[0]?.url;
  const promotionActive = isPromotionActive(listing);
  const uniqueItem = listing.attributes?.uniqueItem === true;
  const canRepublish = listing.status !== 'PUBLISHED' && listing.status !== 'PENDING_REVIEW' && !listing.moderationReason;

  return <article className="relative overflow-visible rounded-[24px] bg-white shadow-sm ring-1 ring-stone-200">
    {listing.moderationReason && <div className="flex gap-3 rounded-t-[24px] border-b border-amber-100 bg-amber-50 px-4 py-3 text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-xs font-black">Anúncio com pendência de moderação</p><p className="mt-1 text-xs leading-5">{listing.moderationReason}</p></div></div>}
    <div className="grid gap-4 p-4 sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:items-center">
      <div className="aspect-square overflow-hidden rounded-2xl bg-stone-100">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="h-7 w-7 text-stone-300" /></div>}</div>
      <div className="min-w-0"><div className="flex flex-wrap gap-2"><StatusBadge status={listing.status} />{uniqueItem && listing.listingType === 'PRODUCT' && <span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-black uppercase text-violet-700">Item único</span>}{listing.publicationChannels?.includes('COMPANY_PAGE') && <span className="rounded-full bg-teal-50 px-2 py-1 text-[9px] font-black uppercase text-teal-700">Página da empresa</span>}{promotionActive && <span className="rounded-full bg-rose-50 px-2 py-1 text-[9px] font-black uppercase text-rose-700">Oferta ativa</span>}{listing.commerceConfig?.onlineCheckout?.enabled && <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black uppercase text-blue-700">Compra online</span>}</div><h2 className="mt-2 truncate text-lg font-black text-stone-900">{listing.title}</h2><p className="mt-1 text-sm font-black">{classifiedPrice(listing)}</p><p className="mt-1 text-xs text-stone-400">{listing.viewsCount || 0} visualizações · {listing.favoritesCount || 0} favoritos · {listing.city}/{listing.state}</p></div>
      <div className="flex items-center gap-2 border-t border-stone-100 pt-3 sm:border-0 sm:pt-0">
        {listing.status === 'PUBLISHED' && <Link to={`/classificados/explorar/${encodeURIComponent(listing.slug)}`} className="rounded-xl bg-stone-900 px-3 py-2 text-xs font-black text-white">Ver</Link>}
        {listing.listingType !== 'SERVICE' && <Link to={`/classificados/comercial/${listing.id}`} className="inline-flex items-center gap-1 rounded-xl bg-[#fff1e9] px-3 py-2 text-xs font-black text-[#a84f34]"><BadgePercent className="h-3.5 w-3.5" /> Comercial</Link>}
        <div className="relative ml-auto">
          <button type="button" disabled={working} onClick={onMenu} className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-50" aria-label="Ações do anúncio">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}</button>
          {menuOpen && !working && <div className="absolute right-0 top-11 z-30 w-64 rounded-2xl border border-stone-200 bg-white p-2 shadow-2xl">
            {canRepublish && <MenuAction icon={<RefreshCw className="h-4 w-4" />} label={listing.status === 'DRAFT' ? 'Publicar' : 'Republicar'} onClick={() => lifecycle(listing, 'republish')} />}
            {listing.status === 'PUBLISHED' && <MenuAction icon={<PauseCircle className="h-4 w-4" />} label="Pausar anúncio" onClick={() => setStatus(listing, 'PAUSED')} />}
            {listing.listingType === 'PRODUCT' && listing.status === 'PUBLISHED' && <MenuAction icon={<PackageCheck className="h-4 w-4" />} label="Registrar como vendido" onClick={() => lifecycle(listing, 'sold')} />}
            {listing.listingType === 'PRODUCT' && listing.status !== 'ARCHIVED' && <MenuAction icon={<Package className="h-4 w-4" />} label={uniqueItem ? 'Permitir múltiplas vendas' : 'Marcar como item único'} onClick={() => lifecycle(listing, 'unique')} />}
            {listing.status !== 'ARCHIVED' && <MenuAction icon={<Archive className="h-4 w-4" />} label="Arquivar" onClick={() => lifecycle(listing, 'archive')} />}
            <div className="my-1 border-t border-stone-100" />
            <MenuAction danger icon={<Trash2 className="h-4 w-4" />} label="Excluir" onClick={() => lifecycle(listing, 'delete')} />
          </div>}
        </div>
      </div>
    </div>
  </article>;
}

function MenuAction({ icon, label, onClick, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-black transition ${danger ? 'text-red-700 hover:bg-red-50' : 'text-stone-700 hover:bg-stone-50'}`}>{icon}<span>{label}</span></button>;
}

function isPromotionActive(listing: ClassifiedListing) {
  const promotion = listing.commerceConfig?.promotion;
  if (!promotion) return false;
  const now = Date.now();
  const starts = promotion.startsAt ? new Date(promotion.startsAt).getTime() : null;
  const ends = promotion.endsAt ? new Date(promotion.endsAt).getTime() : null;
  return (starts == null || starts <= now) && (ends == null || ends > now);
}
function StatusBadge({ status }: { status: ClassifiedListingStatus }) { const map: Record<string, [string,string]> = { PUBLISHED: ['Publicado','bg-emerald-50 text-emerald-700'], DRAFT: ['Rascunho','bg-stone-100 text-stone-600'], PAUSED: ['Pausado','bg-amber-50 text-amber-700'], SOLD: ['Vendido','bg-blue-50 text-blue-700'], ARCHIVED: ['Arquivado','bg-stone-100 text-stone-400'], PENDING_REVIEW: ['Em análise','bg-violet-50 text-violet-700'] }; const [label,style] = map[status] || [status,'bg-stone-100']; return <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[.1em] ${style}`}>{label}</span>; }
function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-[18px] bg-white p-4 ring-1 ring-stone-200"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[.1em] text-stone-400">{label}</p></div>; }
