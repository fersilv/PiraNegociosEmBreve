import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeDollarSign, CreditCard, Loader2, MapPin, MessageCircle, Search, ShieldCheck, ShoppingCart, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ClassifiedCheckoutModal } from '../components/classifieds/ClassifiedCheckoutModal';
import { ClassifiedListingCard, classifiedCommercePricing, classifiedPrice } from '../components/classifieds/ClassifiedListingCard';
import { useClassifiedsWorkspace } from '../contexts/ClassifiedsWorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { ClassifiedCategory, ClassifiedListing, ClassifiedSearchResponse } from '../types/classifieds';

export default function ClassifiedsExplorePage() {
  const { listingSlug } = useParams();
  if (listingSlug) return <InternalListingDetail slug={listingSlug} />;
  return <InternalExploreGrid />;
}

function InternalExploreGrid() {
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
    let alive = true;
    const params = new URLSearchParams({ limit: '36' });
    if (submitted) params.set('q', submitted);
    if (listingType) params.set('listingType', listingType);
    if (category) params.set('category', category);
    setLoading(true);
    api.get(`/classifieds/listings?${params.toString()}`)
      .then((response) => alive && setResult(response.data as ClassifiedSearchResponse))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [submitted, listingType, category]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b06448]">Marketplace interno</p>
        <h1 className="mt-1 font-serif text-3xl font-black">Explorar</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Você continua dentro do seu workspace enquanto procura, favorita, conversa ou faz uma oferta.</p>
      </header>

      <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[.06]">
        <form onSubmit={(event) => { event.preventDefault(); setSubmitted(query.trim()); }} className="flex gap-2">
          <label className="relative min-w-0 flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Produto, serviço ou palavra-chave" className="h-12 w-full rounded-2xl bg-stone-50 pl-11 pr-4 text-sm font-semibold outline-none ring-1 ring-stone-200 focus:bg-white focus:ring-[#c96847]/40" /></label>
          <button className="rounded-2xl bg-stone-900 px-5 text-sm font-black text-white">Buscar</button>
        </form>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {['', 'PRODUCT', 'SERVICE'].map((value) => <button key={value || 'ALL'} onClick={() => setListingType(value)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${listingType === value ? 'bg-[#3a222b] text-white' : 'bg-stone-100 text-stone-600'}`}>{value === 'PRODUCT' ? 'Produtos' : value === 'SERVICE' ? 'Serviços' : 'Tudo'}</button>)}
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="shrink-0 rounded-full border-0 bg-stone-100 px-4 py-2 text-xs font-black text-stone-600 outline-none"><option value="">Todas as categorias</option>{categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select>
        </div>
      </div>

      <div className="flex items-center justify-between"><p className="text-xs font-bold text-stone-500">{loading ? 'Buscando...' : `${result.total} anúncios encontrados`}</p></div>
      {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div> : result.items.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{result.items.map((listing) => <ClassifiedListingCard key={listing.id} listing={listing} detailBasePath="/classificados/explorar" />)}</div> : <div className="rounded-[26px] border border-dashed border-stone-300 bg-white px-6 py-14 text-center"><h2 className="font-serif text-2xl font-black">Nada encontrado.</h2><p className="mt-2 text-sm text-stone-500">Tente outra busca ou categoria.</p></div>}
    </div>
  );
}

function InternalListingDetail({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data } = useClassifiedsWorkspace();
  const [listing, setListing] = useState<ClassifiedListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offerOpen, setOfferOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get(`/classifieds/listings/${encodeURIComponent(slug)}`)
      .then((response) => alive && setListing(response.data as ClassifiedListing))
      .catch((requestError: any) => alive && setError(requestError?.response?.data?.message || 'Anúncio não encontrado.'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [slug]);

  const ownListing = useMemo(() => Boolean(listing && user && (
    (data?.activeIdentity === 'PERSONAL' && !listing.companyId && listing.sellerUserId === user.uid)
    || (data?.activeIdentity === 'COMPANY' && listing.companyId && listing.companyId === data.company?.id)
  )), [listing, user, data?.activeIdentity, data?.company?.id]);

  const startChat = async () => {
    if (!listing || working) return;
    setWorking(true); setError('');
    try {
      const response = await api.post(`/classifieds/listings/${listing.id}/conversations`);
      navigate(`/classificados/conversas/${response.data.id}`);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível iniciar a conversa.');
    } finally { setWorking(false); }
  };

  const submitOffer = async () => {
    if (!listing || working) return;
    const amount = Number(offerAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) { setError('Informe um valor válido.'); return; }
    setWorking(true); setError('');
    try {
      await api.post(`/classifieds/listings/${listing.id}/offers`, { amount });
      setOfferOpen(false);
      setOfferAmount('');
      setNotice('Oferta enviada. O anunciante tem 48 horas para aceitar ou recusar.');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Não foi possível enviar a oferta.');
    } finally { setWorking(false); }
  };

  const trackContact = (channel: string) => {
    if (!listing) return;
    void api.post(`/classifieds/listings/${listing.id}/events`, { type: 'CONTACT_CLICK', channel }).catch(() => undefined);
  };

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>;
  if (!listing) return <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center"><p className="font-black">{error || 'Anúncio não encontrado.'}</p><Link to="/classificados/explorar" className="mt-4 inline-flex rounded-xl bg-stone-900 px-4 py-2 text-xs font-black text-white">Voltar</Link></div>;

  const pricing = classifiedCommercePricing(listing);
  const canOffer = !ownListing && listing.listingType === 'PRODUCT' && listing.price != null;
  const canCheckout = !ownListing && listing.listingType === 'PRODUCT' && listing.commerceConfig?.onlineCheckout?.enabled === true;
  return (
    <div className="mx-auto max-w-6xl">
      <button onClick={() => navigate('/classificados/explorar')} className="mb-4 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black shadow-sm ring-1 ring-stone-200"><ArrowLeft className="h-4 w-4" /> Explorar</button>
      {(error || notice) && <div className={`mb-4 rounded-2xl px-4 py-3 text-sm font-bold ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{error || notice}</div>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          <div className="grid gap-3 sm:grid-cols-2">{listing.images?.length ? listing.images.map((image, index) => <div key={image.id || image.url} className={`overflow-hidden rounded-[24px] bg-stone-100 ${index === 0 ? 'sm:col-span-2 aspect-[16/9]' : 'aspect-[4/3]'}`}><img src={image.url} alt="" className="h-full w-full object-cover" /></div>) : <div className="flex aspect-[16/9] items-center justify-center rounded-[24px] bg-stone-100 text-stone-300 sm:col-span-2">Sem foto</div>}</div>
          <div className="mt-6 rounded-[26px] bg-white p-6 ring-1 ring-stone-200"><p className="text-[10px] font-black uppercase tracking-[.16em] text-stone-400">Descrição</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">{listing.description}</p></div>
        </section>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <PriceBlock listing={listing} />
            <h1 className="mt-3 font-serif text-3xl font-black leading-tight">{listing.title}</h1>
            <p className="mt-3 flex items-center gap-2 text-xs font-bold text-stone-500"><MapPin className="h-4 w-4" />{listing.neighborhood ? `${listing.neighborhood}, ` : ''}{listing.city} - {listing.state}</p>
            {listing.seller && <div className="mt-5 flex items-center gap-3 rounded-2xl bg-stone-50 p-3"><div className="h-11 w-11 overflow-hidden rounded-full bg-stone-200">{listing.seller.photoURL && <img src={listing.seller.photoURL} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0"><div className="flex items-center gap-1"><p className="truncate text-sm font-black">{listing.seller.name}</p>{listing.seller.verified && <ShieldCheck className="h-4 w-4 text-emerald-600" />}</div><p className="text-[10px] text-stone-400">{listing.seller.type === 'COMPANY' ? 'Empresa' : 'Particular'}</p></div></div>}
            {!ownListing ? <div className="mt-5 grid gap-2">{canCheckout && <button type="button" onClick={() => setCheckoutOpen(true)} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#009ee3] text-sm font-black text-white shadow-[0_12px_28px_rgba(0,158,227,.22)]"><ShoppingCart className="h-4 w-4" /> Comprar agora</button>}<button disabled={working} onClick={() => void startChat()} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-stone-900 text-sm font-black text-white disabled:opacity-50"><MessageCircle className="h-4 w-4" /> Conversar</button>{canOffer && <button disabled={working} onClick={() => { setOfferAmount(String(pricing.currentPrice ?? listing.price ?? '').replace('.', ',')); setOfferOpen(true); }} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#c96847] text-sm font-black text-white"><BadgeDollarSign className="h-4 w-4" /> Fazer oferta</button>}</div> : <div className="mt-5 grid gap-2"><Link to="/classificados/anuncios" className="flex h-12 items-center justify-center rounded-2xl bg-stone-100 text-sm font-black text-stone-700">Este anúncio é seu</Link>{listing.listingType !== 'SERVICE' && <Link to={`/classificados/comercial/${listing.id}`} className="flex h-11 items-center justify-center rounded-2xl bg-[#fff1e9] text-xs font-black text-[#a84f34]">Editar preço e promoção</Link>}</div>}
            {(listing.contactWhatsapp || listing.contactPhone) && !ownListing && <div className="mt-4 border-t border-stone-100 pt-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">Contato externo opcional</p><div className="mt-2 flex gap-2">{listing.contactWhatsapp && <a onClick={() => trackContact('WHATSAPP')} href={`https://wa.me/${String(listing.contactWhatsapp).replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">WhatsApp</a>}{listing.contactPhone && <a onClick={() => trackContact('PHONE')} href={`tel:${listing.contactPhone}`} className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-black text-stone-700">Telefone</a>}</div></div>}
          </div>
        </aside>
      </div>

      {offerOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"><button aria-label="Fechar" className="absolute inset-0" onClick={() => !working && setOfferOpen(false)} /><div className="relative w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl"><button onClick={() => setOfferOpen(false)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-stone-100"><X className="h-4 w-4" /></button><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#b06448]">Oferta válida por 48 horas</p><h2 className="mt-2 font-serif text-2xl font-black">Quanto você quer oferecer?</h2><p className="mt-2 text-sm text-stone-500">O anunciante recebe o valor e pode aceitar ou recusar sem você precisar iniciar uma conversa.</p><label className="mt-5 block"><span className="text-xs font-black text-stone-500">Sua oferta</span><div className="mt-2 flex h-14 items-center rounded-2xl bg-stone-50 px-4 ring-1 ring-stone-200"><span className="mr-2 text-sm font-black text-stone-500">R$</span><input autoFocus value={offerAmount} onChange={(event) => setOfferAmount(event.target.value)} inputMode="decimal" className="min-w-0 flex-1 bg-transparent text-xl font-black outline-none" /></div></label><button disabled={working} onClick={() => void submitOffer()} className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-[#c96847] text-sm font-black text-white disabled:opacity-50">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar oferta'}</button></div></div>}
      <ClassifiedCheckoutModal listingId={listing.id} open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
    </div>
  );
}

function PriceBlock({ listing }: { listing: ClassifiedListing }) {
  if (listing.priceType === 'CONTACT') return <p className="text-2xl font-black text-stone-900">{classifiedPrice(listing)}</p>;
  const pricing = classifiedCommercePricing(listing);
  const pixEnabled = listing.commerceConfig?.paymentPricing?.pix?.enabled === true && pricing.pixPrice != null && pricing.currentPrice != null && pricing.pixPrice < pricing.currentPrice;
  const card = listing.commerceConfig?.paymentPricing?.card;
  return <div>{pricing.promotionActive && pricing.basePrice != null && <div className="flex items-center gap-2"><span className="rounded-full bg-[#d45442] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-white">Oferta</span><span className="text-sm font-bold text-stone-400 line-through">{money(pricing.basePrice)}</span></div>}<p className={`mt-1 text-3xl font-black ${pricing.promotionActive ? 'text-[#b74435]' : 'text-stone-900'}`}>{classifiedPrice(listing)}</p>{pricing.promotionActive && pricing.promotionEndsAt && <p className="mt-1 text-[10px] font-bold text-rose-600">Oferta até {new Date(pricing.promotionEndsAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>}{pixEnabled && <div className="mt-3 rounded-2xl bg-emerald-50 p-3"><p className="text-[9px] font-black uppercase tracking-[.1em] text-emerald-600">Preço no Pix</p><p className="mt-0.5 text-lg font-black text-emerald-800">{money(pricing.pixPrice)}</p></div>}{card?.enabled && pricing.cardPrice != null && <div className="mt-2 flex gap-2 rounded-2xl bg-stone-50 p-3 text-stone-600"><CreditCard className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-xs font-black">{money(pricing.cardPrice)} no cartão</p><p className="mt-0.5 text-[10px]">até {pricing.maxInstallments}x{pricing.interestFreeInstallments > 0 ? ` · ${pricing.interestFreeInstallments}x sem juros` : ''}</p></div></div>}{listing.commerceConfig?.onlineCheckout?.enabled && <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-[10px] font-black text-blue-700">A empresa habilitou recebimento online para este produto.</p>}</div>;
}
function money(value: unknown) { const number = Number(value); return Number.isFinite(number) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number) : '—'; }
