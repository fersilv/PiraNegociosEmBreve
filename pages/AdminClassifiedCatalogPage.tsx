import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Archive,
  ArchiveRestore,
  BadgeCheck,
  Box,
  CheckCircle2,
  Eye,
  Gavel,
  Loader2,
  MoreVertical,
  PackageSearch,
  PauseCircle,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import type { ClassifiedCategory } from '../types/classifieds';

type CatalogTab = 'PRODUCT' | 'SERVICE' | 'AUCTION' | 'ARCHIVED';
type ListingAction = 'archive' | 'restore' | 'delete' | 'publish' | 'pause';
type AuctionAction = 'cancel' | 'archive' | 'restore' | 'delete';
type Summary = {
  products: number;
  services: number;
  published: number;
  paused: number;
  pendingReview: number;
  archivedListings: number;
  auctions: number;
  activeAuctions: number;
  archivedAuctions: number;
};
type Listing = {
  id: string;
  slug: string;
  listingType: 'PRODUCT' | 'SERVICE';
  categorySlug: string;
  categoryName?: string | null;
  title: string;
  description: string;
  price?: string | number | null;
  priceType?: string;
  condition?: string;
  city: string;
  state: string;
  status: string;
  isFeatured?: boolean;
  moderationReason?: string | null;
  moderationReviewedAt?: string | null;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string | null;
  companyName?: string | null;
  sellerName?: string | null;
  sellerEmail?: string | null;
  image?: string | null;
  images?: Array<{ id?: string; url: string }>;
  hasAuction?: boolean;
};
type Auction = {
  id: string;
  listingId: string;
  title: string;
  slug: string;
  companyName: string;
  status: string;
  listingStatus: string;
  startPrice: string | number;
  minIncrement: string | number;
  currentBid?: string | number | null;
  bidCount?: number;
  startsAt?: string;
  endsAt?: string;
  closedAt?: string | null;
  archivedAt?: string | null;
  image?: string | null;
};
type ListingPage = { items: Listing[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
type AuctionPage = { items: Auction[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho', PUBLISHED: 'Publicado', PAUSED: 'Pausado', SOLD: 'Vendido', ARCHIVED: 'Arquivado', PENDING_REVIEW: 'Revisão',
  SCHEDULED: 'Agendado', OPEN: 'Aberto', ENDED: 'Encerrado', CANCELED: 'Cancelado',
};

export default function AdminClassifiedCatalogPage() {
  const [tab, setTab] = useState<CatalogTab>('PRODUCT');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [listings, setListings] = useState<ListingPage>({ items: [], pagination: { page: 1, pageSize: 30, total: 0, totalPages: 1 } });
  const [auctions, setAuctions] = useState<AuctionPage>({ items: [], pagination: { page: 1, pageSize: 30, total: 0, totalPages: 1 } });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Listing | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [menuKey, setMenuKey] = useState<string | null>(null);

  const archived = tab === 'ARCHIVED';
  const showingAuctions = tab === 'AUCTION';

  const loadSummary = async () => {
    const [summaryResponse, categoryResponse] = await Promise.all([
      api.get('/admin/classifieds-catalog/summary'),
      api.get('/classifieds/categories'),
    ]);
    setSummary(summaryResponse.data || null);
    setCategories(Array.isArray(categoryResponse.data) ? categoryResponse.data : []);
  };

  const loadAllArchivedAuctions = async () => {
    const first = await api.get('/admin/classifieds-catalog/auctions', { params: { q: query || undefined, page: 1, pageSize: 100, archived: true } });
    const firstData: AuctionPage = first.data || { items: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 } };
    const pages = Math.max(1, Number(firstData.pagination?.totalPages || 1));
    if (pages <= 1) return firstData;
    const remaining = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => api.get('/admin/classifieds-catalog/auctions', { params: { q: query || undefined, page: index + 2, pageSize: 100, archived: true } })));
    const items = [...firstData.items, ...remaining.flatMap(response => Array.isArray(response.data?.items) ? response.data.items : [])];
    return { items, pagination: { page: 1, pageSize: items.length, total: Number(firstData.pagination?.total || items.length), totalPages: 1 } };
  };

  const loadRows = async () => {
    setLoading(true); setMessage(''); setMenuKey(null);
    try {
      if (showingAuctions) {
        const response = await api.get('/admin/classifieds-catalog/auctions', { params: { q: query || undefined, status: status === 'ALL' ? undefined : status, page, pageSize: 30, archived: false } });
        setAuctions(response.data || { items: [], pagination: { page: 1, pageSize: 30, total: 0, totalPages: 1 } });
      } else if (archived) {
        const [listingResponse, archivedAuctions] = await Promise.all([
          api.get('/admin/classifieds-catalog/listings', { params: { q: query || undefined, page, pageSize: 30, archived: true } }),
          loadAllArchivedAuctions(),
        ]);
        setListings(listingResponse.data || { items: [], pagination: { page: 1, pageSize: 30, total: 0, totalPages: 1 } });
        setAuctions(archivedAuctions);
      } else {
        const response = await api.get('/admin/classifieds-catalog/listings', { params: { type: tab, q: query || undefined, status: status === 'ALL' ? undefined : status, page, pageSize: 30, archived: false } });
        setListings(response.data || { items: [], pagination: { page: 1, pageSize: 30, total: 0, totalPages: 1 } });
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível carregar o catálogo administrativo.');
    } finally { setLoading(false); }
  };

  const refresh = async () => {
    try { await loadSummary(); } catch (error: any) { setMessage(error?.response?.data?.message || 'Não foi possível carregar os indicadores.'); }
    await loadRows();
  };

  useEffect(() => { void loadSummary().catch(() => undefined); }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRows(); }, query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [tab, status, page, query]);
  useEffect(() => { setPage(1); setStatus('ALL'); }, [tab]);

  const openListing = async (id: string) => {
    setDetailLoading(true); setMessage(''); setMenuKey(null);
    try {
      const response = await api.get(`/admin/classifieds-catalog/listings/${id}`);
      setSelected(response.data);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível abrir o anúncio.');
    } finally { setDetailLoading(false); }
  };

  const mutateListing = async (id: string, action: ListingAction) => {
    if (action === 'delete' && !window.confirm('Excluir este anúncio da plataforma?\n\nA remoção é lógica: ele sai da vitrine, gestão e relatórios ativos, mas compras, pedidos, conversas e histórico continuam preservados.')) return;
    if (action === 'archive' && !window.confirm('Arquivar este anúncio? Ele sairá da vitrine e dos relatórios ativos, mas poderá ser restaurado.')) return;
    setWorking(`${action}-${id}`); setMessage(''); setMenuKey(null);
    try {
      if (action === 'delete') await api.delete(`/admin/classifieds-catalog/listings/${id}`);
      else if (action === 'archive' || action === 'restore') await api.post(`/admin/classifieds-catalog/listings/${id}/${action}`);
      else await api.patch(`/admin/classifieds-catalog/listings/${id}`, { status: action === 'publish' ? 'PUBLISHED' : 'PAUSED' });
      setSelected(null);
      setMessage(action === 'archive' ? 'Anúncio arquivado e removido dos relatórios ativos.' : action === 'restore' ? 'Anúncio restaurado para o status anterior.' : action === 'publish' ? 'Anúncio publicado novamente.' : action === 'pause' ? 'Anúncio pausado.' : 'Anúncio removido da plataforma com o histórico preservado.');
      await refresh();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível concluir a ação no anúncio.');
    } finally { setWorking(''); }
  };

  const mutateAuction = async (auction: Auction, action: AuctionAction) => {
    if (action === 'delete' && !window.confirm(`Excluir o leilão de “${auction.title}”?\n\nA remoção é lógica e preserva lances, arrematação, negociação e histórico.`)) return;
    if (action === 'archive' && !window.confirm(`Arquivar o leilão de “${auction.title}”?`)) return;
    if (action === 'cancel' && !window.confirm(`Cancelar o leilão de “${auction.title}”?`)) return;
    setWorking(`${action}-${auction.id}`); setMessage(''); setMenuKey(null);
    try {
      if (action === 'delete') await api.delete(`/admin/classifieds-catalog/auctions/${auction.id}`);
      else await api.post(`/admin/classifieds-catalog/auctions/${auction.id}/${action}`);
      setMessage(action === 'archive' ? 'Leilão arquivado e removido das visões operacionais.' : action === 'restore' ? 'Leilão restaurado para consulta histórica.' : action === 'cancel' ? 'Leilão cancelado.' : 'Leilão removido da gestão com o histórico preservado.');
      await refresh();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível concluir a ação no leilão.');
    } finally { setWorking(''); }
  };

  const tabs: Array<{ key: CatalogTab; label: string; count: number; icon: React.ReactNode }> = [
    { key: 'PRODUCT', label: 'Produtos', count: summary?.products || 0, icon: <Box className="h-4 w-4" /> },
    { key: 'SERVICE', label: 'Serviços', count: summary?.services || 0, icon: <Wrench className="h-4 w-4" /> },
    { key: 'AUCTION', label: 'Leilões', count: summary?.auctions || 0, icon: <Gavel className="h-4 w-4" /> },
    { key: 'ARCHIVED', label: 'Arquivados', count: (summary?.archivedListings || 0) + (summary?.archivedAuctions || 0), icon: <Archive className="h-4 w-4" /> },
  ];
  const pageInfo = showingAuctions ? auctions.pagination : listings.pagination;

  return <div className="mx-auto max-w-[1500px] space-y-6">
    <header className="overflow-hidden rounded-[30px] bg-[#191916] p-6 text-white shadow-[0_20px_60px_rgba(28,25,20,.15)] sm:p-8"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#ed9f8d]">Marketplace · operação</p><h1 className="mt-2 font-serif text-3xl font-black sm:text-4xl">Central dos Classificados</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">Modere todos os produtos, serviços e leilões. Arquivar é reversível; excluir remove da operação sem destruir o histórico relacionado.</p></div><button onClick={() => void refresh()} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-stone-900"><RefreshCw className="h-4 w-4" /> Atualizar tudo</button></div></header>
    {message && <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-bold text-stone-700 shadow-sm">{message}</div>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Publicados" value={summary?.published || 0} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} /><Metric label="Pausados" value={summary?.paused || 0} icon={<PauseCircle className="h-4 w-4 text-amber-600" />} /><Metric label="Em revisão" value={summary?.pendingReview || 0} icon={<ShieldCheck className="h-4 w-4 text-violet-600" />} /><Metric label="Leilões ativos" value={summary?.activeAuctions || 0} icon={<Gavel className="h-4 w-4 text-blue-600" />} /><Metric label="Arquivados" value={(summary?.archivedListings || 0) + (summary?.archivedAuctions || 0)} icon={<Archive className="h-4 w-4 text-stone-500" />} /></section>

    <section className="overflow-visible rounded-[28px] bg-white ring-1 ring-stone-200 shadow-sm">
      <div className="rounded-t-[28px] border-b border-stone-100 p-4 sm:p-5"><div className="flex flex-wrap gap-2">{tabs.map(item => <button key={item.key} onClick={() => setTab(item.key)} className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition ${tab === item.key ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{item.icon}{item.label}<span className={`rounded-full px-2 py-0.5 text-[9px] ${tab === item.key ? 'bg-white/15' : 'bg-white'}`}>{item.count}</span></button>)}</div><div className="mt-4 flex flex-col gap-3 sm:flex-row"><label className="relative min-w-0 flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar por anúncio, empresa ou anunciante..." className="h-11 w-full rounded-2xl border border-stone-200 bg-stone-50 pl-11 pr-4 text-sm font-semibold outline-none focus:border-stone-400" /></label>{!archived && <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-xs font-black text-stone-600 outline-none"><option value="ALL">Todos os status</option>{showingAuctions ? <><option value="SCHEDULED">Agendados</option><option value="OPEN">Abertos</option><option value="ENDED">Encerrados</option><option value="CANCELED">Cancelados</option></> : <><option value="PUBLISHED">Publicados</option><option value="PENDING_REVIEW">Em revisão</option><option value="PAUSED">Pausados</option><option value="DRAFT">Rascunhos</option><option value="SOLD">Vendidos</option></>}</select>}</div></div>
      {loading ? <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div> : archived ? <ArchivedList listings={listings.items} auctions={auctions.items} working={working} openListing={openListing} mutateListing={mutateListing} mutateAuction={mutateAuction} menuKey={menuKey} setMenuKey={setMenuKey} /> : showingAuctions ? <AuctionList rows={auctions.items} working={working} mutate={mutateAuction} menuKey={menuKey} setMenuKey={setMenuKey} /> : <ListingList rows={listings.items} open={openListing} detailLoading={detailLoading} working={working} mutate={mutateListing} menuKey={menuKey} setMenuKey={setMenuKey} />}
      {pageInfo.totalPages > 1 && <div className="flex items-center justify-between rounded-b-[28px] border-t border-stone-100 px-5 py-4 text-xs font-bold text-stone-500"><span>{pageInfo.total} {archived ? 'anúncios arquivados' : 'registros'}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))} className="rounded-xl bg-stone-100 px-3 py-2 disabled:opacity-40">Anterior</button><span className="px-2 py-2">{page} / {pageInfo.totalPages}</span><button disabled={page >= pageInfo.totalPages} onClick={() => setPage(current => current + 1)} className="rounded-xl bg-stone-100 px-3 py-2 disabled:opacity-40">Próxima</button></div></div>}
    </section>
    {selected && <ListingAdminModal listing={selected} categories={categories} working={working} close={() => setSelected(null)} saved={async () => { setSelected(null); await refresh(); }} mutate={mutateListing} />}
  </div>;
}

function ListingList({ rows, open, detailLoading, working, mutate, menuKey, setMenuKey }: { rows: Listing[]; open: (id: string) => void; detailLoading: boolean; working: string; mutate: (id: string, action: ListingAction) => void; menuKey: string|null; setMenuKey: React.Dispatch<React.SetStateAction<string|null>> }) {
  if (!rows.length) return <Empty icon={<PackageSearch className="h-8 w-8" />} title="Nenhum anúncio nesta visão" text="A busca ou o filtro atual não encontrou produtos ou serviços." />;
  return <div className="divide-y divide-stone-100">{rows.map(row => <div key={row.id} className="relative grid gap-4 p-4 hover:bg-stone-50 sm:p-5 lg:grid-cols-[72px_minmax(0,1.4fr)_minmax(150px,.7fr)_130px_auto] lg:items-center"><button onClick={() => open(row.id)} className="contents text-left"><Thumb src={row.image} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">{row.listingType === 'SERVICE' ? 'Serviço' : 'Produto'}</span>{row.isFeatured && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-[9px] font-black text-violet-700"><Sparkles className="h-3 w-3" /> Destaque</span>}</div><p className="mt-1 truncate text-sm font-black text-stone-950">{row.title}</p><p className="mt-1 truncate text-xs text-stone-400">{row.companyName || row.sellerName || 'Anunciante'} · {row.categoryName || row.categorySlug}</p></div><div><p className="text-xs font-bold text-stone-700">{row.city} - {row.state}</p><p className="mt-1 text-[10px] text-stone-400">{row.sellerEmail || 'Conta empresarial'}</p></div><StatusBadge value={row.status} /></button><div className="flex items-center justify-end gap-2"><button type="button" onClick={() => open(row.id)} className="inline-flex h-9 items-center gap-1 rounded-xl bg-stone-100 px-3 text-[10px] font-black text-stone-600"><Eye className="h-3.5 w-3.5" /> {detailLoading ? 'Abrindo...' : 'Abrir'}</button><ListingMenu listing={row} working={Boolean(working)} open={menuKey === `listing-${row.id}`} toggle={() => setMenuKey(current => current === `listing-${row.id}` ? null : `listing-${row.id}`)} mutate={mutate} /></div></div>)}</div>;
}

function AuctionList({ rows, working, mutate, menuKey, setMenuKey }: { rows: Auction[]; working: string; mutate: (row: Auction, action: AuctionAction) => void; menuKey: string|null; setMenuKey: React.Dispatch<React.SetStateAction<string|null>> }) {
  if (!rows.length) return <Empty icon={<Gavel className="h-8 w-8" />} title="Nenhum leilão nesta visão" text="Leilões ativos, encerrados e cancelados aparecerão aqui." />;
  return <div className="divide-y divide-stone-100">{rows.map(row => <div key={row.id} className="relative grid gap-4 p-4 sm:p-5 lg:grid-cols-[72px_minmax(0,1.4fr)_160px_130px_auto] lg:items-center"><Thumb src={row.image} /><div className="min-w-0"><p className="truncate text-sm font-black">{row.title}</p><p className="mt-1 text-xs text-stone-400">{row.companyName}</p><p className="mt-1 text-[10px] font-bold text-stone-500">{Number(row.bidCount || 0)} lance(s) · atual {money(row.currentBid || row.startPrice)}</p></div><div className="text-xs text-stone-500"><p><strong>Início:</strong> {dateTime(row.startsAt)}</p><p className="mt-1"><strong>Fim:</strong> {dateTime(row.endsAt)}</p></div><StatusBadge value={row.status} /><div className="flex justify-end"><AuctionMenu auction={row} working={Boolean(working)} open={menuKey === `auction-${row.id}`} toggle={() => setMenuKey(current => current === `auction-${row.id}` ? null : `auction-${row.id}`)} mutate={mutate} /></div></div>)}</div>;
}

function ArchivedList({ listings, auctions, working, openListing, mutateListing, mutateAuction, menuKey, setMenuKey }: { listings: Listing[]; auctions: Auction[]; working: string; openListing: (id: string) => void; mutateListing: (id: string, action: ListingAction) => void; mutateAuction: (row: Auction, action: AuctionAction) => void; menuKey: string|null; setMenuKey: React.Dispatch<React.SetStateAction<string|null>> }) {
  if (!listings.length && !auctions.length) return <Empty icon={<Archive className="h-8 w-8" />} title="Arquivo vazio" text="Itens arquivados somem dos relatórios ativos e ficam guardados aqui." />;
  return <div><div className="border-b border-stone-100 bg-stone-50 px-5 py-3 text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Produtos e serviços arquivados nesta página · {listings.length}</div><div className="divide-y divide-stone-100">{listings.map(row => <div key={row.id} className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_150px_auto] lg:items-center"><button onClick={() => openListing(row.id)} className="min-w-0 text-left"><p className="truncate text-sm font-black">{row.title}</p><p className="mt-1 text-xs text-stone-400">{row.companyName || row.sellerName} · {row.listingType === 'SERVICE' ? 'Serviço' : 'Produto'}</p></button><p className="text-xs text-stone-400">Arquivado {dateTime(row.archivedAt)}</p><div className="flex justify-end"><ListingMenu listing={row} working={Boolean(working)} open={menuKey === `archived-listing-${row.id}`} toggle={() => setMenuKey(current => current === `archived-listing-${row.id}` ? null : `archived-listing-${row.id}`)} mutate={mutateListing} archived /></div></div>)}</div>{Boolean(auctions.length) && <><div className="border-y border-stone-100 bg-stone-50 px-5 py-3 text-[10px] font-black uppercase tracking-[.14em] text-stone-400">Todos os leilões arquivados · {auctions.length}</div><div className="divide-y divide-stone-100">{auctions.map(row => <div key={row.id} className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_150px_auto] lg:items-center"><div><p className="truncate text-sm font-black">{row.title}</p><p className="mt-1 text-xs text-stone-400">{row.companyName} · {STATUS_LABEL[row.status] || row.status}</p></div><p className="text-xs text-stone-400">Arquivado {dateTime(row.archivedAt)}</p><div className="flex justify-end"><AuctionMenu auction={row} working={Boolean(working)} open={menuKey === `archived-auction-${row.id}`} toggle={() => setMenuKey(current => current === `archived-auction-${row.id}` ? null : `archived-auction-${row.id}`)} mutate={mutateAuction} archived /></div></div>)}</div></>}</div>;
}

function ListingMenu({ listing, working, open, toggle, mutate, archived = false }: { listing: Listing; working: boolean; open: boolean; toggle: () => void; mutate: (id: string, action: ListingAction) => void; archived?: boolean }) {
  return <ActionMenu open={open} toggle={toggle} working={working}>{archived || listing.status === 'ARCHIVED' ? <><MenuRow icon={<ArchiveRestore className="h-4 w-4" />} label="Restaurar" onClick={() => mutate(listing.id,'restore')} /><MenuRow icon={<RefreshCw className="h-4 w-4" />} label="Republicar" onClick={() => mutate(listing.id,'publish')} /></> : <>{listing.status !== 'PUBLISHED' && listing.status !== 'PENDING_REVIEW' && <MenuRow icon={<RefreshCw className="h-4 w-4" />} label={listing.status === 'DRAFT' ? 'Publicar' : 'Republicar'} onClick={() => mutate(listing.id,'publish')} />}{listing.status === 'PUBLISHED' && <MenuRow icon={<PauseCircle className="h-4 w-4" />} label="Pausar" onClick={() => mutate(listing.id,'pause')} />}<MenuRow icon={<Archive className="h-4 w-4" />} label="Arquivar" onClick={() => mutate(listing.id,'archive')} /></>}<div className="my-1 border-t border-stone-100" /><MenuRow danger icon={<Trash2 className="h-4 w-4" />} label="Excluir" onClick={() => mutate(listing.id,'delete')} /></ActionMenu>;
}
function AuctionMenu({ auction, working, open, toggle, mutate, archived = false }: { auction: Auction; working: boolean; open: boolean; toggle: () => void; mutate: (row: Auction, action: AuctionAction) => void; archived?: boolean }) {
  return <ActionMenu open={open} toggle={toggle} working={working}>{archived || auction.archivedAt ? <MenuRow icon={<ArchiveRestore className="h-4 w-4" />} label="Restaurar" onClick={() => mutate(auction,'restore')} /> : <>{['SCHEDULED','OPEN'].includes(auction.status) && <MenuRow icon={<XCircle className="h-4 w-4" />} label="Cancelar" onClick={() => mutate(auction,'cancel')} />}<MenuRow icon={<Archive className="h-4 w-4" />} label="Arquivar" onClick={() => mutate(auction,'archive')} /></>}<div className="my-1 border-t border-stone-100" /><MenuRow danger icon={<Trash2 className="h-4 w-4" />} label="Excluir" onClick={() => mutate(auction,'delete')} /></ActionMenu>;
}
function ActionMenu({ open, toggle, working, children }: { open: boolean; toggle: () => void; working: boolean; children: React.ReactNode }) { return <div className="relative"><button type="button" disabled={working} onClick={toggle} className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 shadow-sm hover:bg-stone-50 disabled:opacity-40" aria-label="Mais ações">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}</button>{open && !working && <div className="absolute right-0 top-11 z-50 w-56 rounded-2xl border border-stone-200 bg-white p-2 text-stone-900 shadow-2xl">{children}</div>}</div>; }
function MenuRow({ icon, label, onClick, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) { return <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-black ${danger ? 'text-red-700 hover:bg-red-50' : 'text-stone-700 hover:bg-stone-50'}`}>{icon}{label}</button>; }

function ListingAdminModal({ listing, categories, working, close, saved, mutate }: { listing: Listing; categories: ClassifiedCategory[]; working: string; close: () => void; saved: () => Promise<void>; mutate: (id: string, action: ListingAction) => void }) {
  const [form, setForm] = useState({ title: listing.title || '', description: listing.description || '', listingType: listing.listingType || 'PRODUCT', categorySlug: listing.categorySlug || '', price: listing.price == null ? '' : String(listing.price), city: listing.city || '', state: listing.state || '', status: listing.status || 'PAUSED', moderationReason: listing.moderationReason || '', isFeatured: Boolean(listing.isFeatured) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const archived = listing.status === 'ARCHIVED';
  const options = form.listingType === 'SERVICE' ? categories.filter(item => item.parentSlug === 'servicos') : categories.filter(item => !item.parentSlug && item.slug !== 'servicos');
  const save = async () => { setSaving(true); setError(''); try { await api.patch(`/admin/classifieds-catalog/listings/${listing.id}`, { ...form, state: form.state.toUpperCase() }); await saved(); } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível salvar o anúncio.'); } finally { setSaving(false); } };

  const modal = <div className="fixed inset-0 z-[10000] overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><section role="dialog" aria-modal="true" className="mx-auto my-4 max-w-5xl overflow-hidden rounded-[30px] bg-[#f7f5f1] shadow-2xl"><header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-stone-200 bg-white/95 p-5 backdrop-blur-xl sm:p-6"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-stone-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-stone-500">{form.listingType === 'SERVICE' ? 'Serviço' : 'Produto'}</span><StatusBadge value={listing.status} />{listing.isFeatured && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[9px] font-black text-violet-700"><Sparkles className="h-3 w-3"/> Destaque</span>}</div><h2 className="mt-2 font-serif text-2xl font-black">Administrar anúncio</h2><p className="mt-1 text-xs text-stone-400">{listing.companyName || listing.sellerName} · {listing.sellerEmail || listing.id}</p></div><button onClick={close} className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-500"><X className="h-4 w-4" /></button></header><div className="space-y-5 p-5 sm:p-6">{error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}{Boolean(listing.images?.length) && <div className="flex gap-2 overflow-x-auto pb-1">{listing.images!.map(image => <img key={image.id || image.url} src={image.url} alt="" className="h-24 w-24 shrink-0 rounded-2xl object-cover ring-1 ring-stone-200" />)}</div>}{archived ? <div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="font-black">Este anúncio está arquivado</p><p className="mt-1 text-xs leading-5 text-stone-500">Ele está fora da operação. Restaurar recupera o status anterior; Republicar volta direto para a vitrine. Excluir é soft delete e mantém todo o histórico relacionado.</p><div className="mt-4 flex flex-wrap gap-2"><ActionButton disabled={Boolean(working)} onClick={() => mutate(listing.id,'restore')} icon={<ArchiveRestore className="h-4 w-4" />} label="Restaurar" /><ActionButton disabled={Boolean(working)} onClick={() => mutate(listing.id,'publish')} icon={<RefreshCw className="h-4 w-4" />} label="Republicar" /><ActionButton destructive disabled={Boolean(working)} onClick={() => mutate(listing.id,'delete')} icon={<Trash2 className="h-4 w-4" />} label="Excluir" /></div></div> : <><div className="grid gap-4 sm:grid-cols-2"><Field label="Tipo"><select value={form.listingType} onChange={event => setForm(current => ({ ...current, listingType: event.target.value as 'PRODUCT'|'SERVICE', categorySlug: '' }))} className={inputClass}><option value="PRODUCT">Produto</option><option value="SERVICE">Serviço</option></select></Field><Field label="Categoria"><select value={form.categorySlug} onChange={event => setForm(current => ({ ...current, categorySlug: event.target.value }))} className={inputClass}><option value="">Selecione</option>{options.map(category => <option key={category.slug} value={category.slug}>{category.name}</option>)}</select></Field></div><Field label="Título"><input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} className={inputClass} maxLength={160} /></Field><Field label="Descrição"><textarea value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} rows={7} className={`${inputClass} h-auto py-3`} /></Field><div className="grid gap-4 sm:grid-cols-3"><Field label="Preço"><input value={form.price} onChange={event => setForm(current => ({ ...current, price: event.target.value }))} className={inputClass} placeholder="Opcional" /></Field><Field label="Cidade"><input value={form.city} onChange={event => setForm(current => ({ ...current, city: event.target.value }))} className={inputClass} /></Field><Field label="UF"><input value={form.state} maxLength={2} onChange={event => setForm(current => ({ ...current, state: event.target.value.toUpperCase().slice(0,2) }))} className={inputClass} /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Status"><select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value }))} className={inputClass}><option value="PUBLISHED">Publicado / aprovado</option><option value="PENDING_REVIEW">Em revisão</option><option value="PAUSED">Pausado</option><option value="DRAFT">Rascunho</option><option value="SOLD">Vendido</option></select></Field><label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3"><input type="checkbox" checked={form.isFeatured} onChange={event => setForm(current => ({ ...current, isFeatured: event.target.checked }))} /><span><span className="block text-xs font-black">Destaque administrativo</span><span className="mt-0.5 block text-[10px] text-stone-400">Marcar como item em evidência.</span></span></label></div><Field label="Motivo / observação da moderação"><textarea value={form.moderationReason} onChange={event => setForm(current => ({ ...current, moderationReason: event.target.value }))} rows={3} className={`${inputClass} h-auto py-3`} placeholder="Ex.: informação incorreta, conteúdo proibido, ajuste solicitado..." /></Field><div className="flex flex-col gap-2 border-t border-stone-200 pt-5 sm:flex-row sm:items-center"><button onClick={() => void save()} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 text-xs font-black text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar alterações</button><button onClick={() => mutate(listing.id,'publish')} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 text-xs font-black text-emerald-700"><BadgeCheck className="h-4 w-4" /> Publicar</button><button onClick={() => mutate(listing.id,'pause')} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-50 px-4 text-xs font-black text-amber-700"><PauseCircle className="h-4 w-4" /> Pausar</button><div className="flex gap-2 sm:ml-auto"><ActionButton disabled={Boolean(working)} onClick={() => mutate(listing.id,'archive')} icon={<Archive className="h-4 w-4" />} label="Arquivar" /><ActionButton destructive disabled={Boolean(working)} onClick={() => mutate(listing.id,'delete')} icon={<Trash2 className="h-4 w-4" />} label="Excluir" /></div></div></>}</div></section></div>;
  return typeof document === 'undefined' ? null : createPortal(modal, document.body);
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200 shadow-sm"><div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">{label}</p>{icon}</div><p className="mt-2 text-2xl font-black text-stone-950">{value}</p></div>; }
function Thumb({ src }: { src?: string | null }) { return <div className="h-[72px] w-[72px] overflow-hidden rounded-2xl bg-stone-100">{src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-stone-300"><Box className="h-6 w-6" /></div>}</div>; }
function StatusBadge({ value }: { value: string }) { const tone = value === 'PUBLISHED' || value === 'OPEN' ? 'bg-emerald-50 text-emerald-700' : value === 'PENDING_REVIEW' || value === 'SCHEDULED' ? 'bg-violet-50 text-violet-700' : value === 'PAUSED' ? 'bg-amber-50 text-amber-700' : value === 'ARCHIVED' || value === 'CANCELED' ? 'bg-stone-100 text-stone-600' : 'bg-blue-50 text-blue-700'; return <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[.08em] ${tone}`}>{STATUS_LABEL[value] || value}</span>; }
function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center text-stone-400">{icon}<p className="mt-3 text-sm font-black text-stone-700">{title}</p><p className="mt-1 max-w-sm text-xs leading-5">{text}</p></div>; }
function ActionButton({ label, icon, onClick, disabled, destructive = false }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; destructive?: boolean }) { return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-[10px] font-black disabled:opacity-40 ${destructive ? 'bg-red-50 text-red-700' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{icon}{label}</button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.12em] text-stone-400">{label}</span>{children}</label>; }
const inputClass = 'h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-800 outline-none focus:border-stone-400';
function money(value: string|number|null|undefined) { const number = Number(value || 0); return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(number) ? number : 0); }
function dateTime(value?: string|null) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
