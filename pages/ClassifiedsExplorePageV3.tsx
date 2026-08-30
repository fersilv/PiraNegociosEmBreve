import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeDollarSign, FileText, Loader2, MapPin, MessageCircle, Search, ShieldCheck, ShoppingCart, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ClassifiedCheckoutModal } from '../components/classifieds/ClassifiedCheckoutModal';
import { ClassifiedCommercePriceHero, type AcceptedClassifiedOffer } from '../components/classifieds/ClassifiedCommercePriceHero';
import { ClassifiedFreightCalculator } from '../components/classifieds/ClassifiedFreightCalculator';
import { ClassifiedListingCard } from '../components/classifieds/ClassifiedListingCard';
import { ClassifiedMediaFrame } from '../components/classifieds/ClassifiedMediaFrame';
import { useAuth } from '../contexts/AuthContext';
import { useClassifiedsWorkspace } from '../contexts/ClassifiedsWorkspaceContext';
import { api } from '../lib/api';
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

  useEffect(() => {
    api.get('/classifieds/categories').then((response) => setCategories(Array.isArray(response.data) ? response.data : [])).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ limit: '36' });
    if (submitted) params.set('q', submitted);
    if (listingType) params.set('listingType', listingType);
    if (category) params.set('category', category);
    setLoading(true);
    api.get(`/classifieds/listings?${params.toString()}`)
      .then((response) => active && setResult(response.data as ClassifiedSearchResponse))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [submitted, listingType, category]);

  return <div className="mx-auto max-w-7xl space-y-5">
    <header><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">Marketplace</p><h1 className="mt-1 font-serif text-3xl font-black">Explorar</h1><p className="mt-2 text-sm text-stone-500">Produtos e serviços da região, com negociação e compra dentro do PiraNegócios.</p></header>
    <section className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[.06]"><form onSubmit={(event) => { event.preventDefault(); setSubmitted(query.trim()); }} className="flex gap-2"><label className="relative min-w-0 flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Produto, serviço ou palavra-chave" className="h-12 w-full rounded-2xl bg-stone-50 pl-11 pr-4 text-sm font-semibold outline-none ring-1 ring-stone-200" /></label><button className="rounded-2xl bg-stone-900 px-5 text-sm font-black text-white">Buscar</button></form><div className="mt-3 flex gap-2 overflow-x-auto">{['', 'PRODUCT', 'SERVICE'].map((value) => <button key={value || 'ALL'} type="button" onClick={() => setListingType(value)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${listingType === value ? 'bg-[#3a222b] text-white' : 'bg-stone-100 text-stone-600'}`}>{value === 'PRODUCT' ? 'Produtos' : value === 'SERVICE' ? 'Serviços' : 'Tudo'}</button>)}<select value={category} onChange={(event) => setCategory(event.target.value)} className="shrink-0 rounded-full bg-stone-100 px-4 py-2 text-xs font-black text-stone-600"><option value="">Todas as categorias</option>{categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></div></section>
    {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div> : result.items.length ? <><p className="text-xs font-bold text-stone-500">{result.total} anúncios encontrados</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{result.items.map((listing) => <ClassifiedListingCard key={listing.id} listing={listing} detailBasePath="/classificados/explorar" />)}</div></> : <div className="rounded-[26px] border border-dashed border-stone-300 bg-white px-6 py-14 text-center"><h2 className="font-serif text-2xl font-black">Nada encontrado.</h2></div>}
  </div>;
}

function ListingDetail({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data } = useClassifiedsWorkspace();
  const [listing, setListing] = useState<ClassifiedListing | null>(null);
  const [features, setFeatures] = useState<any>({});
  const [acceptedOffer, setAcceptedOffer] = useState<AcceptedClassifiedOffer | null>(null);
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.get(`/classifieds/listings/${encodeURIComponent(slug)}`),
      api.get('/classifieds/commerce/features').catch(() => ({ data: {} })),
    ]).then(async ([listingResponse, featureResponse]) => {
      if (!active) return;
      const next = listingResponse.data as ClassifiedListing;
      setListing(next);
      setFeatures(featureResponse.data || {});
      setSelectedImage(0);
      if (user && next.listingType === 'PRODUCT') {
        const offerResponse = await api.get(`/classifieds/listings/${next.id}/my-accepted-offer`).catch(() => ({ data: null }));
        if (active) setAcceptedOffer(offerResponse.data || null);
      } else setAcceptedOffer(null);
    }).catch((requestError: any) => active && setError(requestError?.response?.data?.message || 'Anúncio não encontrado.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [slug, user?.uid]);

  const ownListing = useMemo(() => Boolean(listing && user && (
    (data?.activeIdentity === 'PERSONAL' && !listing.companyId && listing.sellerUserId === user.uid)
    || (data?.activeIdentity === 'COMPANY' && listing.companyId === data.company?.id)
  )), [listing, user?.uid, data?.activeIdentity, data?.company?.id]);
  const canCheckout = Boolean(!ownListing && listing?.listingType === 'PRODUCT' && listing.commerceConfig?.onlineCheckout?.enabled === true);
  const canCart = Boolean(canCheckout && listing?.companyId && features?.cart === true && !acceptedOffer);
  const canOffer = Boolean(!ownListing && listing?.listingType === 'PRODUCT' && listing.price != null && !acceptedOffer);
  const canQuote = Boolean(!ownListing && listing?.listingType === 'SERVICE' && listing.companyId && features?.consultativeQuotes === true);

  const startChat = async () => {
    if (!listing || working) return;
    setWorking(true); setError('');
    try { const response = await api.post(`/classifieds/listings/${listing.id}/conversations`); navigate(`/classificados/conversas/${response.data.id}`); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível iniciar a conversa.'); }
    finally { setWorking(false); }
  };
  const submitOffer = async () => {
    if (!listing || working) return;
    const amount = Number(offerAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) { setError('Informe um valor válido.'); return; }
    setWorking(true); setError('');
    try { await api.post(`/classifieds/listings/${listing.id}/offers`, { amount }); setOfferOpen(false); setOfferAmount(''); setNotice('Oferta enviada.'); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível enviar a oferta.'); }
    finally { setWorking(false); }
  };
  const addToCart = async () => {
    if (!listing || working) return;
    setWorking(true); setError('');
    try { await api.post(`/classifieds/cart/items/${listing.id}`, { quantity: 1 }); setNotice('Produto adicionado ao carrinho.'); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível adicionar ao carrinho.'); }
    finally { setWorking(false); }
  };
  const createPurchaseOrder = async () => {
    if (!listing || working || !acceptedOffer) return;
    setWorking(true); setError('');
    try { const response = await api.post(`/classifieds/listings/${listing.id}/purchase-order`, { quantity: 1, fulfillmentMode: 'ARRANGE' }); setNotice(response.data?.message || 'Ordem de compra enviada.'); navigate('/classificados/compras'); }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Não foi possível gerar a ordem de compra.'); }
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

  return <div className="mx-auto max-w-6xl">
    <button onClick={() => navigate('/classificados/explorar')} className="mb-4 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black ring-1 ring-stone-200"><ArrowLeft className="h-4 w-4" /> Explorar</button>
    {(error || notice) && <div className={`mb-4 rounded-2xl px-4 py-3 text-sm font-bold ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{error || notice}</div>}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
      <section><ClassifiedMediaFrame src={images[selectedImage]?.url} alt={listing.title} className="aspect-[4/3] w-full rounded-[28px] ring-1 ring-stone-200" empty={<div className="flex h-full items-center justify-center text-stone-300">Sem foto</div>} />{images.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{images.map((image, index) => <button key={image.id || image.url} type="button" onClick={() => setSelectedImage(index)} className={`shrink-0 overflow-hidden rounded-xl ring-2 ${selectedImage === index ? 'ring-[#2f8b7d]' : 'ring-transparent'}`}><ClassifiedMediaFrame src={image.url} alt="" className="h-20 w-24" /></button>)}</div>}<div className="mt-6 rounded-[26px] bg-white p-6 ring-1 ring-stone-200"><p className="text-[10px] font-black uppercase tracking-[.16em] text-stone-400">Descrição</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">{listing.description}</p></div></section>
      <aside className="lg:sticky lg:top-24 lg:self-start"><div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-stone-200"><ClassifiedCommercePriceHero listing={listing} acceptedOffer={acceptedOffer} />{!ownListing && <div className="mt-4 grid gap-2">{canCheckout && <button type="button" onClick={() => setCheckoutOpen(true)} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#009ee3] px-4 text-sm font-black text-white shadow-[0_12px_28px_rgba(0,158,227,.22)]"><ShoppingCart className="h-4 w-4" />{acceptedOffer ? 'Comprar pelo valor da oferta' : 'Comprar agora'}</button>}{acceptedOffer && <button type="button" disabled={working} onClick={() => void createPurchaseOrder()} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-50 text-xs font-black text-emerald-800 ring-1 ring-emerald-200"><FileText className="h-4 w-4" /> Gerar ordem de compra</button>}{canCart && <button type="button" disabled={working} onClick={() => void addToCart()} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-50 text-xs font-black text-blue-800"><ShoppingCart className="h-4 w-4" /> Adicionar ao carrinho</button>}</div>}<ClassifiedFreightCalculator listing={listing} embedded /><h1 className="mt-5 font-serif text-3xl font-black leading-tight">{listing.title}</h1><p className="mt-3 flex items-center gap-2 text-xs font-bold text-stone-500"><MapPin className="h-4 w-4" />{listing.neighborhood ? `${listing.neighborhood}, ` : ''}{listing.city} - {listing.state}</p>{listing.seller && <div className="mt-5 flex items-center gap-3 rounded-2xl bg-stone-50 p-3"><ClassifiedMediaFrame src={listing.seller.photoURL} alt="" className="h-11 w-11 rounded-full" /><div className="min-w-0"><div className="flex items-center gap-1"><p className="truncate text-sm font-black">{listing.seller.name}</p>{listing.seller.verified && <ShieldCheck className="h-4 w-4 text-emerald-600" />}</div><p className="text-[10px] text-stone-400">{listing.seller.type === 'COMPANY' ? 'Empresa' : 'Particular'}</p></div></div>}{!ownListing && <div className="mt-5 grid gap-2">{canOffer && <button type="button" onClick={() => setOfferOpen(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-amber-50 text-xs font-black text-amber-800"><BadgeDollarSign className="h-4 w-4" /> Fazer oferta</button>}{canQuote && <button type="button" onClick={() => setQuoteOpen(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-violet-50 text-xs font-black text-violet-800"><FileText className="h-4 w-4" /> Solicitar orçamento</button>}<button type="button" disabled={working} onClick={() => void startChat()} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-stone-900 text-xs font-black text-white"><MessageCircle className="h-4 w-4" /> Conversar</button></div>}</div></aside>
    </div>
    <ClassifiedCheckoutModal listingId={listing.id} open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
    {offerOpen && <Modal title="Fazer oferta" onClose={() => setOfferOpen(false)}><p className="text-sm text-stone-500">Envie o valor que deseja pagar. Se a empresa aceitar, esse preço fica disponível para você até expirar ou ser retirado pela empresa.</p><input autoFocus value={offerAmount} onChange={(event) => setOfferAmount(event.target.value)} placeholder="Ex.: 85,00" className="mt-4 h-12 w-full rounded-2xl bg-stone-50 px-4 text-lg font-black ring-1 ring-stone-200" /><button disabled={working} onClick={() => void submitOffer()} className="mt-4 h-12 w-full rounded-2xl bg-stone-900 text-sm font-black text-white">Enviar oferta</button></Modal>}
    {quoteOpen && <Modal title="Solicitar orçamento" onClose={() => setQuoteOpen(false)}><textarea value={quoteScope} onChange={(event) => setQuoteScope(event.target.value)} rows={6} className="w-full rounded-2xl bg-stone-50 p-4 text-sm ring-1 ring-stone-200" placeholder="Descreva o serviço que você precisa..." /><button disabled={working} onClick={() => void requestQuote()} className="mt-4 h-12 w-full rounded-2xl bg-stone-900 text-sm font-black text-white">Enviar solicitação</button></Modal>}
  </div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/45 p-4"><button className="absolute inset-0" onClick={onClose} aria-label="Fechar" /><div className="relative w-full max-w-md rounded-[26px] bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><h2 className="font-serif text-2xl font-black">{title}</h2><button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100"><X className="h-4 w-4" /></button></div><div className="mt-4">{children}</div></div></div>;
}
