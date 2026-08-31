import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeDollarSign, CheckCircle2, FileText, Loader2, MapPin, MessageCircle, PackageCheck, Search, ShieldCheck, ShoppingCart, Sparkles, X } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { ClassifiedCheckoutModal } from '../components/classifieds/ClassifiedCheckoutModal';
import { ClassifiedCommercePriceHero, type AcceptedClassifiedOffer } from '../components/classifieds/ClassifiedCommercePriceHero';
import { ClassifiedFreightCalculator } from '../components/classifieds/ClassifiedFreightCalculator';
import { ClassifiedListingCard } from '../components/classifieds/ClassifiedListingCard';
import { ClassifiedMediaFrame } from '../components/classifieds/ClassifiedMediaFrame';
import { useAuth } from '../contexts/AuthContext';
import { useClassifiedsWorkspace } from '../contexts/ClassifiedsWorkspaceContext';
import { API_URL, SOCKET_PATH, api } from '../lib/api';
import type { ClassifiedCategory, ClassifiedListing, ClassifiedSearchResponse } from '../types/classifieds';

export default function ClassifiedsExplorePageV3() {
  const { listingSlug } = useParams();
  return listingSlug ? <ListingDetail slug={listingSlug} /> : <ExploreGrid />;
}

function ExploreGrid() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [listingType, setListingType] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [result, setResult] = useState<ClassifiedSearchResponse>({ items: [], total: 0, page: 1, limit: 24, pages: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/classifieds/categories').then((response) => setCategories(Array.isArray(response.data) ? response.data : [])).catch(() => setCategories([])); }, []);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ limit: '36' });
    if (submitted) params.set('q', submitted);
    if (listingType) params.set('listingType', listingType);
    if (category) params.set('category', category);
    setLoading(true);
    api.get(`/classifieds/listings?${params.toString()}`).then((response) => active && setResult(response.data as ClassifiedSearchResponse)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [submitted, listingType, category]);

  return <div className="mx-auto max-w-7xl space-y-5">
    <header><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">Marketplace</p><h1 className="mt-1 font-serif text-3xl font-black">Explorar</h1><p className="mt-2 text-sm text-stone-500">Produtos e serviços da região, com negociação e compra dentro do PiraNegócios.</p></header>
    <section className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[.06]"><form onSubmit={(event) => { event.preventDefault(); setSubmitted(query.trim()); }} className="flex gap-2"><label className="relative min-w-0 flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Produto, serviço ou palavra-chave" className="h-12 w-full rounded-2xl bg-stone-50 pl-11 pr-4 text-sm font-semibold outline-none ring-1 ring-stone-200" /></label><button className="rounded-2xl bg-stone-900 px-5 text-sm font-black text-white">Buscar</button></form><div className="mt-3 flex gap-2 overflow-x-auto">{['', 'PRODUCT', 'SERVICE'].map((value) => <button key={value || 'ALL'} type="button" onClick={() => setListingType(value)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${listingType === value ? 'bg-[#3a222b] text-white' : 'bg-stone-100 text-stone-600'}`}>{value === 'PRODUCT' ? 'Produtos' : value === 'SERVICE' ? 'Serviços' : 'Tudo'}</button>)}<select value={category} onChange={(event) => setCategory(event.target.value)} className="shrink-0 rounded-full bg-stone-100 px-4 py-2 text-xs font-black text-stone-600"><option value="">Todas as categorias</option>{categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></div></section>
    {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div> : result.items.length ? <><p className="text-xs font-bold text-stone-500">{result.total} anúncios encontrados</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{result.items.map((listing) => <ClassifiedListingCard key={listing.id} listing={listing} detailBasePath="/classificados/explorar" />)}</div></> : <div className="rounded-[26px] border border-dashed border-stone-300 bg-white px-6 py-14 text-center"><h2 className="font-serif text-2xl font-black">Nada encontrado.</h2></div>}
  </div>;
}

type InteractionContext = { hasOfferRelationship: boolean; conversationId?: string | null; chatAvailable: boolean; latestOffer?: { id: string; status: string; amount: number; expiresAt?: string | null } | null };

function ListingDetail({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { data } = useClassifiedsWorkspace();
  const [listing, setListing] = useState<ClassifiedListing | null>(null);
  const [features, setFeatures] = useState<any>({});
  const [acceptedOffer, setAcceptedOffer] = useState<AcceptedClassifiedOffer | null>(null);
  const [interaction, setInteraction] = useState<InteractionContext>({ hasOfferRelationship: false, chatAvailable: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteScope, setQuoteScope] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [offersLive, setOffersLive] = useState(false);

  const refreshOfferContext = async (listingId: string) => {
    if (!user || !listingId) {
      setAcceptedOffer(null);
      setInteraction({ hasOfferRelationship: false, chatAvailable: false });
      return;
    }
    const [offerResponse, interactionResponse] = await Promise.all([
      api.get(`/classifieds/listings/${listingId}/my-accepted-offer`).catch(() => ({ data: null })),
      api.get(`/classifieds/listings/${listingId}/interaction-context`).catch(() => ({ data: { hasOfferRelationship: false, chatAvailable: false } })),
    ]);
    setAcceptedOffer(offerResponse.data || null);
    setInteraction(interactionResponse.data || { hasOfferRelationship: false, chatAvailable: false });
  };

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([api.get(`/classifieds/listings/${encodeURIComponent(slug)}`), api.get('/classifieds/commerce/features').catch(() => ({ data: {} }))])
      .then(async ([listingResponse, featureResponse]) => {
        if (!active) return;
        const next = listingResponse.data as ClassifiedListing;
        setListing(next); setFeatures(featureResponse.data || {}); setSelectedImage(0);
        if (user && next.listingType === 'PRODUCT') {
          const [offerResponse, interactionResponse] = await Promise.all([
            api.get(`/classifieds/listings/${next.id}/my-accepted-offer`).catch(() => ({ data: null })),
            api.get(`/classifieds/listings/${next.id}/interaction-context`).catch(() => ({ data: { hasOfferRelationship: false, chatAvailable: false } })),
          ]);
          if (active) { setAcceptedOffer(offerResponse.data || null); setInteraction(interactionResponse.data || { hasOfferRelationship: false, chatAvailable: false }); }
        } else { setAcceptedOffer(null); setInteraction({ hasOfferRelationship: false, chatAvailable: false }); }
      })
      .catch((requestError: any) => active && setError(requestError?.response?.data?.message || 'Anúncio não encontrado.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [slug, user?.uid]);

  useEffect(() => {
    if (!user || !listing?.id || listing.listingType !== 'PRODUCT') return;
    let socket: Socket | null = null;
    let disposed = false;
    let refreshTimer: number | null = null;
    void (async () => {
      const token = await user.getIdToken().catch(() => '');
      if (!token || disposed) return;
      const socketOrigin = new URL(API_URL, window.location.origin).origin;
      socket = io(`${socketOrigin}/classified-offers`, {
        path: SOCKET_PATH,
        transports: ['websocket', 'polling'],
        auth: { token },
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 4000,
      });
      socket.on('connect', () => setOffersLive(true));
      socket.on('disconnect', () => setOffersLive(false));
      socket.on('offers:update', (payload: { listingId?: string }) => {
        if (payload?.listingId !== listing.id) return;
        if (refreshTimer) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => void refreshOfferContext(listing.id), 80);
      });
    })();
    return () => {
      disposed = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      socket?.disconnect();
      setOffersLive(false);
    };
  }, [user?.uid, listing?.id, listing?.listingType]);

  useEffect(() => {
    if (!user || !listing?.id || listing.listingType !== 'PRODUCT' || offersLive) return;
    const interval = window.setInterval(() => void refreshOfferContext(listing.id), 7000);
    return () => window.clearInterval(interval);
  }, [user?.uid, listing?.id, listing?.listingType, offersLive]);

  const ownListing = useMemo(() => Boolean(listing && user && ((data?.activeIdentity === 'PERSONAL' && !listing.companyId && listing.sellerUserId === user.uid) || (data?.activeIdentity === 'COMPANY' && listing.companyId === data.company?.id))), [listing, user?.uid, data?.activeIdentity, data?.company?.id]);
  const canCheckout = Boolean(!ownListing && listing?.listingType === 'PRODUCT' && listing.commerceConfig?.onlineCheckout?.enabled === true);
  const canCart = Boolean(canCheckout && listing?.companyId && features?.cart === true && !acceptedOffer);
  const canOffer = Boolean(!ownListing && listing?.listingType === 'PRODUCT' && listing.price != null && !acceptedOffer);
  const canQuote = Boolean(!ownListing && listing?.listingType === 'SERVICE' && listing.companyId && features?.consultativeQuotes === true);
  const canBuyerChat = Boolean(!ownListing && listing?.listingType === 'PRODUCT' && interaction.chatAvailable);

  useEffect(() => {
    if (!canCheckout || searchParams.get('checkout') !== '1') return;
    setCheckoutOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    setSearchParams(next, { replace: true });
  }, [canCheckout, searchParams, setSearchParams]);

  const startChat = async () => {
    if (!listing || working || !canBuyerChat) return;
    if (interaction.conversationId) { navigate(`/classificados/conversas/${interaction.conversationId}`); return; }
    setWorking(true); setError('');
    try { const response = await api.post(`/classifieds/listings/${listing.id}/conversations`); navigate(`/classificados/conversas/${response.data.id}`); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível abrir a conversa desta negociação.'); }
    finally { setWorking(false); }
  };

  const submitOffer = async () => {
    if (!listing || working) return;
    const amount = Number(offerAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) { setError('Informe um valor válido.'); return; }
    setWorking(true); setError('');
    try {
      const response = await api.post(`/classifieds/listings/${listing.id}/offers`, { amount });
      setOfferOpen(false); setOfferAmount(''); setNotice('Oferta enviada. A conversa da negociação foi liberada.');
      setInteraction({ hasOfferRelationship: true, chatAvailable: true, conversationId: response.data?.conversationId || null, latestOffer: { id: response.data?.id, status: response.data?.status || 'PENDING', amount } });
      await refreshOfferContext(listing.id);
    } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível enviar a oferta.'); }
    finally { setWorking(false); }
  };

  const addToCart = async () => {
    if (!listing || working) return;
    setWorking(true); setError('');
    try { await api.post(`/classifieds/cart/items/${listing.id}`, { quantity: 1 }); setNotice('Produto adicionado ao carrinho.'); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível adicionar ao carrinho.'); }
    finally { setWorking(false); }
  };

  const requestQuote = async () => {
    if (!listing || working) return;
    if (quoteScope.trim().length < 10) { setError('Descreva um pouco melhor o serviço.'); return; }
    setWorking(true); setError('');
    try { const response = await api.post(`/classifieds/service-quotes/listings/${listing.id}`, { scope: quoteScope.trim(), attachments: [] }); setQuoteOpen(false); setQuoteScope(''); if (response.data?.id) navigate(`/classificados/orcamentos/${response.data.id}`); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível solicitar o orçamento.'); }
    finally { setWorking(false); }
  };

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>;
  if (!listing) return <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center"><p className="font-black">{error || 'Anúncio não encontrado.'}</p></div>;
  const images = listing.images || [];
  const stock = Number((listing.commerceConfig as any)?.onlineCheckout?.stockQuantity);
  const hasTrackedStock = Number.isFinite(stock);
  const condition = String((listing as any).condition || '').trim();
  const categoryName = String((listing as any).categoryName || (listing as any).category?.name || '').trim();

  return <div className="mx-auto max-w-7xl pb-24 lg:pb-8">
    <div className="mb-4 flex items-center justify-between gap-3"><button onClick={() => navigate('/classificados/explorar')} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black ring-1 ring-stone-200"><ArrowLeft className="h-4 w-4" /> Voltar</button><span className="hidden text-[10px] font-black uppercase tracking-[.14em] text-stone-400 sm:block">Compra protegida dentro do PiraNegócios</span></div>
    {(error || notice) && <div className={`mb-4 rounded-2xl px-4 py-3 text-sm font-bold ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{error || notice}</div>}

    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.38fr)_minmax(390px,.82fr)]">
      <section className="min-w-0">
        <div className="overflow-hidden rounded-[30px] bg-white ring-1 ring-stone-200"><ClassifiedMediaFrame src={images[selectedImage]?.url} alt={listing.title} className="aspect-[4/3] w-full" empty={<div className="flex h-full items-center justify-center text-stone-300">Sem foto</div>} /></div>
        {images.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{images.map((image, index) => <button key={image.id || image.url} type="button" onClick={() => setSelectedImage(index)} className={`shrink-0 overflow-hidden rounded-2xl bg-white p-1 ring-2 ${selectedImage === index ? 'ring-[#2f8b7d]' : 'ring-stone-100'}`}><ClassifiedMediaFrame src={image.url} alt="" className="h-20 w-24 rounded-xl" /></button>)}</div>}
        <div className="mt-6 rounded-[28px] bg-white p-6 ring-1 ring-stone-200 sm:p-7"><div className="flex items-center gap-2"><PackageCheck className="h-5 w-5 text-[#2f8b7d]" /><h2 className="font-serif text-2xl font-black">Sobre este {listing.listingType === 'SERVICE' ? 'serviço' : 'produto'}</h2></div><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-stone-700">{listing.description}</p></div>
      </section>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="overflow-hidden rounded-[30px] bg-white shadow-[0_18px_60px_rgba(28,25,23,.08)] ring-1 ring-stone-200">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap gap-2">{categoryName && <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.1em] text-stone-500">{categoryName}</span>}{condition && <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.1em] text-stone-500">{condition}</span>}{listing.seller?.verified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.08em] text-emerald-700"><ShieldCheck className="h-3 w-3" /> Verificado</span>}</div>
            <h1 className="mt-4 font-serif text-3xl font-black leading-[1.08] text-stone-950 sm:text-[34px]">{listing.title}</h1>
            <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-stone-500"><MapPin className="h-4 w-4" />{listing.neighborhood ? `${listing.neighborhood}, ` : ''}{listing.city} - {listing.state}</p>

            {listing.seller && <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[#f7f7f5] p-3"><ClassifiedMediaFrame src={listing.seller.photoURL} alt="" className="h-11 w-11 rounded-full" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-stone-900">{listing.seller.name}</p><p className="mt-0.5 text-[10px] font-bold text-stone-400">{listing.seller.type === 'COMPANY' ? 'Vendido por empresa' : 'Vendedor particular'}</p></div>{listing.seller.verified && <ShieldCheck className="h-5 w-5 text-emerald-600" />}</div>}

            {acceptedOffer && <div className="mt-5 rounded-[22px] bg-emerald-950 p-4 text-white"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-emerald-200" /><p className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-200">Sua oferta foi aceita</p></div><p className="mt-2 text-3xl font-black">{currency(acceptedOffer.amount)}</p><p className="mt-1 text-[11px] leading-5 text-emerald-100">Você tem até <strong>{deadline(acceptedOffer.expiresAt)}</strong> para realizar sua compra. Esse preço não acumula desconto de Pix ou cartão.</p></div>}

            <div className="mt-5 border-y border-stone-100 py-5"><ClassifiedCommercePriceHero listing={listing} acceptedOffer={acceptedOffer} />{hasTrackedStock && <p className={`mt-2 inline-flex items-center gap-1.5 text-[10px] font-black ${stock > 0 ? 'text-emerald-700' : 'text-red-600'}`}><CheckCircle2 className="h-3.5 w-3.5" />{stock > 0 ? `${stock} unidade${stock === 1 ? '' : 's'} disponível${stock === 1 ? '' : 'is'}` : 'Sem estoque no momento'}</p>}</div>

            {listing.listingType === 'PRODUCT' && <div className="mt-5"><ClassifiedFreightCalculator listing={listing} embedded /></div>}

            {!ownListing && <div className="mt-5 space-y-2">
              {canCheckout && <button type="button" onClick={() => setCheckoutOpen(true)} className={`inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 ${acceptedOffer ? 'bg-emerald-700 shadow-emerald-900/15' : 'bg-[#009ee3] shadow-sky-500/20'}`}><ShoppingCart className="h-5 w-5" /> COMPRAR</button>}
              {canCart && <button type="button" disabled={working} onClick={() => void addToCart()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-blue-50 text-xs font-black text-blue-800 ring-1 ring-blue-100"><ShoppingCart className="h-4 w-4" /> Adicionar ao carrinho</button>}
              {canOffer && <button type="button" onClick={() => setOfferOpen(true)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-amber-50 text-xs font-black text-amber-900 ring-1 ring-amber-100"><BadgeDollarSign className="h-4 w-4" /> Fazer uma oferta</button>}
              {canQuote && <button type="button" onClick={() => setQuoteOpen(true)} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 text-xs font-black text-white"><FileText className="h-4 w-4" /> Solicitar orçamento</button>}
              {canBuyerChat && <button type="button" disabled={working} onClick={() => void startChat()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-stone-100 text-xs font-black text-stone-700"><MessageCircle className="h-4 w-4" /> Conversa da oferta</button>}
            </div>}

            <div className="mt-5 grid gap-2 border-t border-stone-100 pt-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><Trust text="Pagamento e pedido registrados" /><Trust text="Dados do comprador protegidos" /></div>
          </div>
        </div>
      </aside>
    </div>

    {!ownListing && canCheckout && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 p-3 backdrop-blur lg:hidden"><div className="mx-auto flex max-w-3xl items-center gap-3"><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-black text-stone-500">{listing.title}</p><p className="text-base font-black text-stone-950">{acceptedOffer ? currency(acceptedOffer.amount) : currency(listing.price)}</p></div><button type="button" onClick={() => setCheckoutOpen(true)} className={`h-12 rounded-2xl px-5 text-xs font-black text-white ${acceptedOffer ? 'bg-emerald-700' : 'bg-[#009ee3]'}`}>COMPRAR</button></div></div>}

    <ClassifiedCheckoutModal listingId={listing.id} open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
    {offerOpen && <Modal title="Fazer oferta" onClose={() => setOfferOpen(false)}><p className="text-sm leading-6 text-stone-500">Envie o valor que deseja pagar. A oferta abre uma conversa de negociação. Se a empresa aceitar, o preço negociado fica disponível no checkout normal do produto.</p><input autoFocus value={offerAmount} onChange={(event) => setOfferAmount(event.target.value)} placeholder="Ex.: 85,00" className="mt-4 h-12 w-full rounded-2xl bg-stone-50 px-4 text-lg font-black ring-1 ring-stone-200" /><button disabled={working} onClick={() => void submitOffer()} className="mt-4 h-12 w-full rounded-2xl bg-stone-900 text-sm font-black text-white">Enviar oferta</button></Modal>}
    {quoteOpen && <Modal title="Solicitar orçamento" onClose={() => setQuoteOpen(false)}><textarea value={quoteScope} onChange={(event) => setQuoteScope(event.target.value)} rows={6} className="w-full rounded-2xl bg-stone-50 p-4 text-sm ring-1 ring-stone-200" placeholder="Descreva o serviço que você precisa..." /><button disabled={working} onClick={() => void requestQuote()} className="mt-4 h-12 w-full rounded-2xl bg-stone-900 text-sm font-black text-white">Enviar solicitação</button></Modal>}
  </div>;
}

function Trust({ text }: { text: string }) { return <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-[9px] font-bold leading-4 text-stone-500"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />{text}</div>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/45 p-4"><button className="absolute inset-0" onClick={onClose} aria-label="Fechar" /><div className="relative w-full max-w-md rounded-[26px] bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><h2 className="font-serif text-2xl font-black">{title}</h2><button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100"><X className="h-4 w-4" /></button></div><div className="mt-4">{children}</div></div></div>; }
function currency(value: unknown) { const n = Number(value); return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(n) ? n : 0); }
function deadline(value: unknown) { const date = new Date(String(value || '')); if (Number.isNaN(date.getTime())) return 'o fim da validade da oferta'; return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
