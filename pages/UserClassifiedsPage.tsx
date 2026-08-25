import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Building2, Heart, Loader2, MessageCircle, Plus, Store, Tag, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ClassifiedListingCard, classifiedPrice } from '../components/classifieds/ClassifiedListingCard';
import { useClassifiedsWorkspace } from '../contexts/ClassifiedsWorkspaceContext';
import { api } from '../lib/api';
import type { ClassifiedListing, ClassifiedListingStatus } from '../types/classifieds';

type Tab = 'mine' | 'favorites';

export default function UserClassifiedsPage() {
  const { data } = useClassifiedsWorkspace();
  const business = data?.activeIdentity === 'COMPANY';
  const identityName = business ? data?.company?.name || 'Empresa' : data?.personal.name || 'Meu perfil';
  const [tab, setTab] = useState<Tab>('mine');
  const [mine, setMine] = useState<ClassifiedListing[]>([]);
  const [favorites, setFavorites] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const requests: Promise<any>[] = [api.get('/classifieds/me/listings')];
      if (!business) requests.push(api.get('/classifieds/me/favorites'));
      const responses = await Promise.all(requests);
      setMine(Array.isArray(responses[0].data) ? responses[0].data : []);
      setFavorites(!business && Array.isArray(responses[1]?.data) ? responses[1].data : []);
      if (business) setTab('mine');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível carregar seus classificados.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [data?.activeIdentity, data?.company?.id]);

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
        <div><div className="flex items-center gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${business ? 'bg-[#dcece9] text-[#155a55]' : 'bg-[#f7dfd4] text-[#994b39]'}`}>{business ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}</span><p className={`text-[10px] font-black uppercase tracking-[.17em] ${business ? 'text-[#397c75]' : 'text-[#b06448]'}`}>{business ? 'PiraNegócios Business' : 'PiraNegócios Personal'}</p></div><h1 className="mt-2 font-serif text-3xl font-bold tracking-[-.03em] text-stone-900 sm:text-4xl">{identityName}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">{business ? 'Gerencie o catálogo, os anúncios e a vitrine pública da empresa sem misturar com seu perfil pessoal.' : 'Venda, compre, favorite e negocie como particular em um espaço separado da sua vida profissional.'}</p></div>
        <div className="flex gap-2"><Link to="/classificados/conversas" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 text-sm font-black text-stone-700"><MessageCircle className="h-4 w-4" /> Conversas</Link><Link to="/classificados/publicar" className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black text-white shadow-sm ${business ? 'bg-[#0d4542]' : 'bg-[#c96847]'}`}><Plus className="h-4 w-4" /> Novo anúncio</Link></div>
      </header>

      {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      <div className="grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3"><Stat label="Publicados" value={counts.published} /><Stat label="Rascunhos" value={counts.draft} /><Stat label="Vendidos" value={counts.sold} /></div>

      <div className="flex gap-2 overflow-x-auto border-b border-stone-200 pb-0"><TabButton active={tab === 'mine'} onClick={() => setTab('mine')} icon={<Store className="h-4 w-4" />} label={`${business ? 'Anúncios da empresa' : 'Meus anúncios'} (${mine.length})`} business={business} />{!business && <TabButton active={tab === 'favorites'} onClick={() => setTab('favorites')} icon={<Heart className="h-4 w-4" />} label={`Favoritos (${favorites.length})`} business={false} />}</div>

      {loading ? <div className="flex min-h-52 items-center justify-center text-sm font-semibold text-stone-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...</div> : tab === 'favorites' && !business ? (
        favorites.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">{favorites.map((listing) => <ClassifiedListingCard key={listing.id} listing={listing} onFavoriteChange={(id, favorited) => { if (!favorited) setFavorites((current) => current.filter((item) => item.id !== id)); }} />)}</div> : <Empty icon={<Heart className="h-7 w-7" />} title="Nenhum favorito ainda" text="Quando você salvar um anúncio, ele aparece aqui." action="Explorar classificados" href="/classificados" business={false} />
      ) : mine.length ? (
        <div className="space-y-3">{mine.map((listing) => <MyListingRow key={listing.id} listing={listing} working={workingId === listing.id} setStatus={setStatus} business={business} />)}</div>
      ) : <Empty icon={<Tag className="h-7 w-7" />} title={business ? 'A vitrine da empresa começa com o primeiro anúncio' : 'Seu primeiro anúncio pode nascer agora'} text={business ? 'Produtos e serviços podem aparecer nos Classificados, na página da empresa ou nos dois canais.' : 'Use fotos, preço e localização. A negociação pode acontecer pelo chat interno do PiraNegócios.'} action="Criar anúncio" href="/classificados/publicar" business={business} />}
    </div>
  );
}

function MyListingRow({ listing, working, setStatus, business }: { listing: ClassifiedListing; working: boolean; setStatus: (listing: ClassifiedListing, status: ClassifiedListingStatus) => void; business: boolean }) {
  const image = listing.images?.[0]?.url;
  return <article className="grid gap-4 rounded-[22px] bg-white p-3 shadow-sm ring-1 ring-stone-200 sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:items-center sm:p-4"><div className="aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100 sm:aspect-square">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-stone-300"><Tag className="h-7 w-7" /></div>}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={listing.status} />{listing.isFeatured && <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black uppercase tracking-[.12em] text-amber-700">Destaque</span>}{business && <ChannelBadges channels={listing.publicationChannels || ['CLASSIFIEDS']} />}</div><h2 className="mt-2 truncate text-base font-bold text-stone-900 sm:text-lg">{listing.title}</h2><p className="mt-1 text-sm font-black text-stone-800">{classifiedPrice(listing)}</p><p className="mt-1 text-xs text-stone-400">{listing.listingType === 'SERVICE' ? 'Serviço' : 'Produto'} · {listing.city} - {listing.state} · {listing.viewsCount || 0} visualizações · {listing.favoritesCount || 0} favoritos</p></div><div className="flex flex-wrap gap-2 border-t border-stone-100 pt-3 sm:max-w-[250px] sm:justify-end sm:border-0 sm:pt-0">{listing.status === 'DRAFT' && <button disabled={working} onClick={() => setStatus(listing, 'PUBLISHED')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Publicar</button>}{listing.status === 'PUBLISHED' && <><Link to={`/classificados/anuncio/${listing.slug}`} className="inline-flex items-center gap-1 rounded-xl bg-stone-900 px-3 py-2 text-xs font-bold text-white">Ver <ArrowRight className="h-3.5 w-3.5" /></Link><button disabled={working} onClick={() => setStatus(listing, 'PAUSED')} className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-600 disabled:opacity-50">Pausar</button><button disabled={working} onClick={() => setStatus(listing, 'SOLD')} className="rounded-xl bg-[#fff1e9] px-3 py-2 text-xs font-bold text-[#a84f34] disabled:opacity-50">Vendido</button></>}{listing.status === 'PAUSED' && <button disabled={working} onClick={() => setStatus(listing, 'PUBLISHED')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Reativar</button>}{listing.status === 'SOLD' && <button disabled={working} onClick={() => setStatus(listing, 'ARCHIVED')} className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-600 disabled:opacity-50">Arquivar</button>}{working && <span className="flex h-9 w-9 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin" /></span>}</div></article>;
}

function ChannelBadges({ channels }: { channels: string[] }) { return <span className="inline-flex items-center gap-1">{channels.includes('CLASSIFIEDS') && <span title="Aparece nos Classificados" className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-black uppercase text-violet-700">Classificados</span>}{channels.includes('COMPANY_PAGE') && <span title="Aparece na página da empresa" className="rounded-full bg-teal-50 px-2 py-1 text-[9px] font-black uppercase text-teal-700">Página</span>}</span>; }
function StatusBadge({ status }: { status: ClassifiedListingStatus }) { const map: Record<string, [string, string]> = { PUBLISHED: ['Publicado', 'bg-emerald-50 text-emerald-700'], DRAFT: ['Rascunho', 'bg-stone-100 text-stone-600'], PAUSED: ['Pausado', 'bg-amber-50 text-amber-700'], SOLD: ['Vendido', 'bg-blue-50 text-blue-700'], ARCHIVED: ['Arquivado', 'bg-stone-100 text-stone-400'], PENDING_REVIEW: ['Em análise', 'bg-violet-50 text-violet-700'] }; const [label, style] = map[status] || [status, 'bg-stone-100 text-stone-600']; return <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[.12em] ${style}`}>{label}</span>; }
function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-[18px] bg-white p-3 ring-1 ring-stone-200 sm:p-4"><p className="text-2xl font-black text-stone-900">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">{label}</p></div>; }
function TabButton({ active, onClick, icon, label, business }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; business: boolean }) { return <button onClick={onClick} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-black ${active ? business ? 'border-[#277b72] text-[#155a55]' : 'border-[#c96847] text-[#a84f34]' : 'border-transparent text-stone-400'}`}>{icon}{label}</button>; }
function Empty({ icon, title, text, action, href, business }: { icon: React.ReactNode; title: string; text: string; action: string; href: string; business: boolean }) { return <div className="rounded-[26px] border border-dashed border-stone-300 bg-white px-5 py-12 text-center"><div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${business ? 'bg-[#e6f2ef] text-[#155a55]' : 'bg-[#fff1e9] text-[#b06448]'}`}>{icon}</div><h2 className="mt-4 font-serif text-2xl font-bold text-stone-900">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">{text}</p><Link to={href} className={`mt-5 inline-flex rounded-2xl px-5 py-3 text-sm font-black text-white ${business ? 'bg-[#0d4542]' : 'bg-stone-900'}`}>{action}</Link></div>; }
