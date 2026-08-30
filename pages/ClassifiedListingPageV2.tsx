import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, Eye, Heart, ImageIcon, Loader2, MapPin, MessageCircle, Phone, Share2, ShieldCheck, ShoppingCart, Smartphone } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ClassifiedCommercePriceHero } from '../components/classifieds/ClassifiedCommercePriceHero';
import { ClassifiedFreightCalculator } from '../components/classifieds/ClassifiedFreightCalculator';
import { ClassifiedListingCard } from '../components/classifieds/ClassifiedListingCard';
import { ClassifiedMediaFrame } from '../components/classifieds/ClassifiedMediaFrame';
import { Navbar } from '../components/Navbar';
import { SeoHead } from '../components/SeoHead';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { ClassifiedCatalogOptionGroup, ClassifiedListing } from '../types/classifieds';

export default function ClassifiedListingPageV2() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [listing, setListing] = useState<ClassifiedListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [startingConversation, setStartingConversation] = useState(false);
  const [conversationError, setConversationError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/classifieds/listings/${encodeURIComponent(slug || '')}`)
      .then((response) => {
        if (!active) return;
        setListing(response.data as ClassifiedListing);
        setFavorited(Boolean(response.data?.isFavorite));
        setSelected(0);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [slug]);

  const whatsapp = useMemo(() => digits(listing?.contactWhatsapp || ''), [listing?.contactWhatsapp]);
  const phone = String(listing?.contactPhone || '').trim();

  const toggleFavorite = async () => {
    if (!listing) return;
    if (!user) { navigate(`/login?returnTo=${encodeURIComponent(location.pathname)}`); return; }
    if (savingFavorite) return;
    setSavingFavorite(true);
    try { const response = await api.post(`/classifieds/listings/${listing.id}/favorite`); setFavorited(Boolean(response.data?.favorited)); }
    finally { setSavingFavorite(false); }
  };

  const startConversation = async () => {
    if (!listing || startingConversation) return;
    if (!user) { navigate(`/login?returnTo=${encodeURIComponent(`/classificados/explorar/${listing.slug}`)}`); return; }
    setStartingConversation(true); setConversationError('');
    try {
      const response = await api.post(`/classifieds/listings/${listing.id}/conversations`);
      if (!response.data?.id) throw new Error('Conversa não identificada.');
      navigate(`/classificados/conversas/${response.data.id}`);
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message || requestError?.message || 'Não foi possível abrir a conversa.';
      const params = new URLSearchParams({ startConversation: listing.id, returnTo: location.pathname });
      if (/workspace|identidade|termos|classificados/i.test(message)) navigate(`/classificados/painel?${params.toString()}`);
      else setConversationError(message);
    } finally { setStartingConversation(false); }
  };

  const enterBuyFlow = () => {
    if (!listing) return;
    const target = `/classificados/explorar/${encodeURIComponent(listing.slug)}`;
    if (!user) navigate(`/login?returnTo=${encodeURIComponent(target)}`);
    else navigate(target);
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: listing?.title || 'Classificado', url }).catch(() => undefined);
    else await navigator.clipboard?.writeText(url).catch(() => undefined);
  };

  if (loading) return <div className="min-h-screen bg-[#f6f4f1]"><Navbar /><div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div></div>;
  if (!listing) return <div className="min-h-screen bg-[#f6f4f1]"><Navbar /><div className="mx-auto max-w-3xl px-4 py-20 text-center"><h1 className="font-serif text-3xl font-bold">Anúncio não encontrado</h1><Link to="/classificados" className="mt-5 inline-flex rounded-xl bg-[#2d211c] px-4 py-3 text-sm font-bold text-white">Voltar aos classificados</Link></div></div>;

  const images = listing.images || [];
  const canBuy = listing.listingType === 'PRODUCT' && listing.commerceConfig?.onlineCheckout?.enabled === true;

  return <div className="min-h-screen bg-[#f6f4f1] pb-24 text-[#2d211c] md:pb-0">
    <SeoHead title={`${listing.title} | Classificados PiraNegócios`} description={listing.description.slice(0, 155)} canonical={`${window.location.origin}/classificados/anuncio/${listing.slug}`} />
    <Navbar />
    <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <div className="mb-4 flex items-center justify-between gap-3 text-xs font-semibold text-[#806b60]"><div className="min-w-0 truncate"><Link to="/classificados" className="hover:text-[#2d211c]">Classificados</Link><span className="mx-2">/</span>{listing.categorySlug.replace(/-/g, ' ')}</div><div className="flex shrink-0 gap-2"><button onClick={() => void share()} className="flex h-9 w-9 items-center justify-center rounded-full bg-white ring-1 ring-[#4b3328]/10"><Share2 className="h-4 w-4" /></button><button onClick={() => void toggleFavorite()} disabled={savingFavorite} className="flex h-9 w-9 items-center justify-center rounded-full bg-white ring-1 ring-[#4b3328]/10 disabled:opacity-50"><Heart className={`h-4 w-4 ${favorited ? 'fill-[#c96847] text-[#c96847]' : ''}`} /></button></div></div>
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="min-w-0">
          <Gallery images={images} title={listing.title} selected={selected} setSelected={setSelected} />
          <section className="mt-5 rounded-[26px] bg-white p-5 ring-1 ring-[#4b3328]/10 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#b06448]">{conditionLabel(listing.condition)}</p><h1 className="mt-1 text-2xl font-black tracking-[-.025em] sm:text-3xl">{listing.title}</h1></div><div className="flex flex-col gap-2 text-xs font-semibold text-[#806b60]"><span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-[#c96847]" />{listing.neighborhood ? `${listing.neighborhood}, ` : ''}{listing.city} - {listing.state}</span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{relativeDate(listing.publishedAt || listing.createdAt)}</span><span className="inline-flex items-center gap-1.5"><Eye className="h-4 w-4" />{listing.viewsCount || 0} visualizações</span></div></div></section>
          {listing.attributes && Object.keys(listing.attributes).length > 0 && <section className="mt-5 rounded-[26px] bg-white p-5 ring-1 ring-[#4b3328]/10 sm:p-7"><SectionTitle>Características</SectionTitle><div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">{Object.entries(listing.attributes).map(([key, value]) => <div key={key}><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#9b8275]">{key.replace(/_/g, ' ')}</p><p className="mt-1 text-sm font-bold text-[#4e3b32]">{String(value ?? 'Não informado')}</p></div>)}</div></section>}
          {(listing.catalogConfig?.optionGroups || []).length > 0 && <CatalogOptions groups={listing.catalogConfig?.optionGroups || []} />}
          <section className="mt-5 rounded-[26px] bg-white p-5 ring-1 ring-[#4b3328]/10 sm:p-7"><SectionTitle>Descrição</SectionTitle><p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[#604c42] sm:text-base sm:leading-8">{listing.description}</p></section>
        </section>
        <aside className="lg:sticky lg:top-24 lg:self-start"><div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-[#4b3328]/10"><ClassifiedCommercePriceHero listing={listing} />{canBuy && <button type="button" onClick={enterBuyFlow} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#009ee3] text-sm font-black text-white shadow-[0_12px_28px_rgba(0,158,227,.22)]"><ShoppingCart className="h-4 w-4" /> Comprar agora</button>}<ClassifiedFreightCalculator listing={listing} embedded />{listing.seller && <div className="mt-5 flex items-center gap-3 rounded-2xl bg-stone-50 p-3"><ClassifiedMediaFrame src={listing.seller.photoURL} alt="" className="h-12 w-12 rounded-full" /><div className="min-w-0"><div className="flex items-center gap-1"><p className="truncate text-sm font-black">{listing.seller.name}</p>{listing.seller.verified && <ShieldCheck className="h-4 w-4 text-emerald-600" />}</div><p className="text-[10px] text-stone-400">{listing.seller.type === 'COMPANY' ? 'Empresa' : 'Particular'}</p></div></div>}<button type="button" onClick={() => void startConversation()} disabled={startingConversation} className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#2d211c] text-sm font-black text-white disabled:opacity-50 ${canBuy ? 'mt-3' : 'mt-4'}`}>{startingConversation ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Conversar pelo PiraNegócios</button>{conversationError && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{conversationError}</p>}<div className="mt-3 grid grid-cols-2 gap-2">{whatsapp ? <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Olá! Vi seu anúncio “${listing.title}” no PiraNegócios.`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-50 text-[10px] font-black text-emerald-700"><Smartphone className="h-4 w-4" /> WhatsApp</a> : null}{phone ? <a href={`tel:${digits(phone)}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-stone-100 text-[10px] font-black text-stone-700"><Phone className="h-4 w-4" /> Ligar</a> : null}</div></div></aside>
      </div>
      {listing.related?.length ? <section className="mt-12"><div className="flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#b06448]">Você também pode gostar</p><h2 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">Anúncios relacionados</h2></div></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{listing.related.slice(0, 10).map((item) => <ClassifiedListingCard key={item.id} listing={item} compact />)}</div></section> : null}
    </main>
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#4b3328]/10 bg-white/96 p-3 backdrop-blur-xl md:hidden"><div className="mx-auto flex max-w-lg gap-2">{canBuy ? <button onClick={enterBuyFlow} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#009ee3] px-4 text-sm font-black text-white"><ShoppingCart className="h-4 w-4" /> Comprar</button> : <button onClick={() => void startConversation()} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#2d211c] px-4 text-sm font-black text-white"><MessageCircle className="h-4 w-4" /> Conversar</button>}</div></div>
  </div>;
}

function Gallery({ images, title, selected, setSelected }: { images: Array<{ url: string }>; title: string; selected: number; setSelected: (index: number) => void }) {
  if (!images.length) return <div className="flex aspect-[4/3] items-center justify-center rounded-[26px] bg-[#e9e4df] text-[#9e8d84]"><ImageIcon className="h-12 w-12" /></div>;
  return <><div className="sm:hidden"><ClassifiedMediaFrame src={images[selected]?.url || images[0].url} alt={title} className="aspect-[4/3] w-full rounded-[24px]" />{images.length > 1 && <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{images.map((image, index) => <button key={`${image.url}-${index}`} onClick={() => setSelected(index)} className={`shrink-0 overflow-hidden rounded-lg ring-2 ${selected === index ? 'ring-[#c96847]' : 'ring-transparent'}`}><ClassifiedMediaFrame src={image.url} alt="" className="h-16 w-20" /></button>)}</div>}</div><div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_104px] sm:gap-3"><div className="relative"><ClassifiedMediaFrame src={images[selected]?.url || images[0].url} alt={title} className="aspect-[16/10] w-full rounded-[26px]" />{images.length > 1 && <><button onClick={() => setSelected((selected - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow"><ChevronLeft className="h-5 w-5" /></button><button onClick={() => setSelected((selected + 1) % images.length)} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow"><ChevronRight className="h-5 w-5" /></button></>}</div><div className="grid content-start gap-2 overflow-y-auto">{images.slice(0, 8).map((image, index) => <button key={`${image.url}-${index}`} onClick={() => setSelected(index)} className={`aspect-square overflow-hidden rounded-xl ring-2 ${selected === index ? 'ring-[#c96847]' : 'ring-transparent'}`}><ClassifiedMediaFrame src={image.url} alt="" className="h-full w-full" /></button>)}</div></div></>;
}

function CatalogOptions({ groups }: { groups: ClassifiedCatalogOptionGroup[] }) { return <section className="mt-5 rounded-[26px] bg-white p-5 ring-1 ring-[#4b3328]/10 sm:p-7"><SectionTitle>Opções disponíveis</SectionTitle><div className="mt-5 space-y-4">{groups.map((group) => <div key={group.id} className="rounded-[20px] bg-[#f8f5f2] p-4"><h3 className="text-sm font-black text-[#4e3b32]">{group.name}</h3><div className="mt-3 flex flex-wrap gap-2">{group.options.filter((option) => option.active !== false).map((option) => <span key={option.id} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-[#604c42] ring-1 ring-[#4b3328]/10">{option.label}{typeof option.priceDelta === 'number' && option.priceDelta !== 0 ? ` · ${option.priceDelta > 0 ? '+' : '-'} ${money(Math.abs(option.priceDelta))}` : ''}</span>)}</div></div>)}</div></section>; }
function SectionTitle({ children }: { children: React.ReactNode }) { return <h2 className="font-serif text-2xl font-bold">{children}</h2>; }
function conditionLabel(value: string) { return value === 'NEW' ? 'Novo' : value === 'REFURBISHED' ? 'Recondicionado' : value === 'NOT_APPLICABLE' ? 'Serviço' : 'Usado'; }
function relativeDate(value?: string | null) { if (!value) return 'Publicado recentemente'; const diff = Date.now() - new Date(value).getTime(); const hours = Math.max(0, Math.floor(diff / 3_600_000)); if (hours < 1) return 'Publicado agora'; if (hours < 24) return `Há ${hours}h`; const days = Math.floor(hours / 24); return days === 1 ? 'Há 1 dia' : `Há ${days} dias`; }
function digits(value: string) { return String(value || '').replace(/\D/g, ''); }
function money(value: unknown) { const number = Number(value); return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(number) ? number : 0); }
