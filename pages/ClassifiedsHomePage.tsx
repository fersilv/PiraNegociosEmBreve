import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Clock3,
  Gavel,
  MapPin,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ClassifiedCategoryIcon } from '../components/classifieds/ClassifiedCategoryIcon';
import { ClassifiedListingCard } from '../components/classifieds/ClassifiedListingCard';
import { Navbar } from '../components/Navbar';
import { SeoHead } from '../components/SeoHead';
import { useAuth } from '../contexts/AuthContext';
import { auctionCurrentValue, loadPublicAuctions, type PublicClassifiedAuction } from '../lib/classifiedsAuctions';
import { api } from '../lib/api';
import type { ClassifiedCategory, ClassifiedListing, ClassifiedSearchResponse } from '../types/classifieds';

export default function ClassifiedsHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [recent, setRecent] = useState<ClassifiedListing[]>([]);
  const [featured, setFeatured] = useState<ClassifiedListing[]>([]);
  const [auctions, setAuctions] = useState<PublicClassifiedAuction[]>([]);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      api.get('/classifieds/categories'),
      api.get('/classifieds/listings?limit=24'),
      api.get('/classifieds/listings?featured=true&limit=8'),
      loadPublicAuctions(),
    ]).then(([categoryResult, recentResult, featuredResult, auctionResult]) => {
      if (!active) return;
      if (categoryResult.status === 'fulfilled') setCategories(Array.isArray(categoryResult.value.data) ? categoryResult.value.data : []);
      if (recentResult.status === 'fulfilled') setRecent((recentResult.value.data as ClassifiedSearchResponse)?.items || []);
      if (featuredResult.status === 'fulfilled') setFeatured((featuredResult.value.data as ClassifiedSearchResponse)?.items || []);
      if (auctionResult.status === 'fulfilled') setAuctions(auctionResult.value.filter((row) => row.live));
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!auctions.length) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [auctions.length]);

  const cities = useMemo(() => Array.from(new Set(recent.map((item) => `${item.city} - ${item.state}`).filter(Boolean))).sort(), [recent]);
  const highlightItems = featured.length ? featured : recent.slice(0, 10);
  const liveAuctions = auctions.filter((auction) => new Date(auction.endsAt).getTime() > now);

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (city) {
      const [cityName, state] = city.split(' - ');
      params.set('city', cityName);
      if (state) params.set('state', state);
    }
    navigate(`/classificados/busca${params.size ? `?${params.toString()}` : ''}`);
  };

  return (
    <div className="min-h-screen bg-[#f6f4f1] text-[#2d211c]">
      <SeoHead title="Classificados | PiraNegócios" description="Compre, venda, encontre produtos e acompanhe leilões da sua região no Classificados PiraNegócios." canonical={`${window.location.origin}/classificados`} />
      <Navbar />

      <main>
        <section className="relative overflow-hidden border-b border-[#4b3328]/10 bg-[#fffaf5]">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#f0bf9f]/40 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-[#c96847]/15 bg-[#fff1e9] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.17em] text-[#a84f34]"><Sparkles className="h-3.5 w-3.5" /> Classificados da região</span>{liveAuctions.length > 0 && <Link to="/classificados/leiloes" className="inline-flex items-center gap-2 rounded-full bg-[#2d211c] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.15em] text-white"><Radio className="h-3.5 w-3.5 animate-pulse text-[#ff7b55] motion-reduce:animate-none" /> {liveAuctions.length} leilão{liveAuctions.length === 1 ? '' : 'ões'} ao vivo</Link>}</div>
                <h1 className="mt-3 font-serif text-3xl font-bold leading-[.98] tracking-[-.035em] sm:text-4xl lg:text-5xl">Encontre. Negocie. Leve.</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#725e53]">A vitrine já começa aqui: produtos e serviços locais, sem uma página de apresentação no caminho.</p>
              </div>
              <Link to={user ? '/classificados/publicar' : '/login?returnTo=%2Fclassificados%2Fpublicar'} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#c96847] px-5 text-xs font-black text-white shadow-[0_12px_28px_rgba(201,104,71,.18)]">Anunciar agora <ArrowRight className="h-4 w-4" /></Link>
            </div>

            <form onSubmit={search} className="mt-5 rounded-[22px] bg-white p-2.5 shadow-[0_16px_45px_rgba(62,43,34,.08)] ring-1 ring-[#4b3328]/10">
              <div className="grid gap-2 md:grid-cols-[1.5fr_.8fr_auto]">
                <label className="relative"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9e8d84]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto, serviço, veículo..." className="h-12 w-full rounded-2xl border-0 bg-[#faf8f6] pl-11 pr-4 text-sm font-semibold outline-none ring-1 ring-[#4b3328]/10 focus:ring-2 focus:ring-[#c96847]/35" /></label>
                <label className="relative"><MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9e8d84]" /><select value={city} onChange={(event) => setCity(event.target.value)} className="h-12 w-full appearance-none rounded-2xl border-0 bg-[#faf8f6] pl-11 pr-4 text-sm font-bold text-[#5c473d] outline-none ring-1 ring-[#4b3328]/10 focus:ring-2 focus:ring-[#c96847]/35"><option value="">Toda a região</option>{cities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <button className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#2d211c] px-6 text-sm font-black text-white transition hover:bg-black">Buscar <ArrowRight className="h-4 w-4" /></button>
              </div>
            </form>
          </div>
        </section>

        {liveAuctions.length > 0 && <section className="relative overflow-hidden bg-[#17100e] text-white">
          <div className="pointer-events-none absolute right-[-100px] top-[-150px] h-80 w-80 rounded-full bg-[#ff7049]/15 blur-[80px]" />
          <div className="relative mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.17em] text-[#ff8d6b]"><Radio className="h-3.5 w-3.5 animate-pulse motion-reduce:animate-none" /> acontecendo agora</p><h2 className="mt-1 font-serif text-2xl font-black sm:text-3xl">Tem martelo batendo na vitrine.</h2></div><Link to="/classificados/leiloes" className="inline-flex items-center gap-1 text-xs font-black text-white/60 hover:text-white">Ver arena <ArrowRight className="h-4 w-4" /></Link></div>
            <div className="-mx-4 mt-5 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:px-0">{liveAuctions.slice(0, 8).map((auction) => <Link key={auction.id} to={`/classificados/leiloes/${auction.id}`} className="group relative w-[280px] shrink-0 snap-start overflow-hidden rounded-[24px] border border-white/10 bg-white/[.055] sm:w-[330px]"><div className="relative aspect-[1.55/1] overflow-hidden bg-black/20">{auction.image ? <img src={auction.image} alt={auction.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" /> : <div className="flex h-full items-center justify-center text-white/20"><Gavel className="h-10 w-10" /></div>}<div className="absolute inset-0 bg-gradient-to-t from-[#120a08]/95 via-transparent to-black/10" /><span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-[#ff633c] px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[.12em]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" /> ao vivo</span><div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3"><div><p className="text-[8px] font-black uppercase tracking-[.13em] text-white/45">Lance atual</p><p className="mt-0.5 text-xl font-black">{money(auctionCurrentValue(auction))}</p></div><span className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 text-[9px] font-black backdrop-blur"><Clock3 className="mr-1 inline h-3 w-3 text-[#ff8b69]" /> {countdown(new Date(auction.endsAt).getTime() - now)}</span></div></div><div className="p-3.5"><h3 className="line-clamp-1 text-sm font-black">{auction.title}</h3><div className="mt-2 flex items-center justify-between text-[9px] font-bold text-white/35"><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {auction.bidCount} lance{auction.bidCount === 1 ? '' : 's'}</span><span>{auction.city}/{auction.state}</span></div></div></Link>)}</div>
          </div>
        </section>}

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.17em] text-[#b06448]">Vitrine</p><h2 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">O que está rolando por perto</h2></div><Link to="/classificados/busca?sort=recent" className="text-xs font-black text-[#a84f34]">Ver tudo</Link></div>
          {loading ? <ListingSkeleton /> : highlightItems.length ? <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">{highlightItems.map((listing) => <ClassifiedListingCard key={listing.id} listing={listing} />)}</div> : <EmptyState />}
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.17em] text-[#b06448]">Explore por categoria</p><h2 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">Encontre mais rápido</h2></div><Link to="/classificados/busca" className="hidden text-xs font-black text-[#a84f34] sm:inline-flex">Ver todos</Link></div>
          <div className="-mx-4 mt-5 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 md:grid-cols-5 lg:grid-cols-7">{categories.slice(0, 14).map((category) => <Link key={category.slug} to={`/classificados/categoria/${encodeURIComponent(category.slug)}`} className="flex w-[112px] shrink-0 snap-start flex-col items-center gap-2.5 rounded-[20px] bg-white px-3 py-4 text-center ring-1 ring-[#4b3328]/10 transition hover:-translate-y-0.5 hover:shadow-md sm:w-auto"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f7e9df] text-[#b45e42]"><ClassifiedCategoryIcon name={category.icon} className="h-5 w-5" /></span><span className="text-[11px] font-bold leading-tight text-[#4f3b31]">{category.name}</span></Link>)}</div>
        </section>

        <section className="border-y border-[#4b3328]/10 bg-white"><div className="mx-auto grid max-w-7xl gap-6 px-4 py-9 sm:px-6 md:grid-cols-[1fr_auto] md:items-center lg:px-8"><div><div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-[#b06448]"><Tag className="h-3.5 w-3.5" /> Tem algo para vender?</div><h2 className="mt-2 font-serif text-3xl font-bold tracking-[-.025em] sm:text-4xl">Seu anúncio entra na mesma vitrine que você acabou de explorar.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#806b60]">Fotos, preço, localização e pronto. Empresas Elite ainda podem transformar produtos publicados em leilões ao vivo.</p></div><Link to={user ? '/classificados/publicar' : '/login?returnTo=%2Fclassificados%2Fpublicar'} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#c96847] px-6 text-sm font-black text-white shadow-[0_14px_30px_rgba(201,104,71,.20)]">Publicar anúncio <ArrowRight className="h-4 w-4" /></Link></div></section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><div className="flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.17em] text-[#b06448]">Recém-publicados</p><h2 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">Chegaram agora</h2></div></div>{recent.length ? <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">{recent.slice(0, 10).map((listing) => <ClassifiedListingCard key={listing.id} listing={listing} compact />)}</div> : !loading && <EmptyState />}</section>

        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8"><div className="grid gap-3 rounded-[26px] bg-[#2d211c] p-5 text-white sm:grid-cols-2 sm:p-6"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" /><div><p className="text-xs font-black">Anunciantes identificados</p><p className="mt-1 text-[10px] leading-5 text-white/45">Sinais de verificação aparecem nos anúncios e nas salas de leilão.</p></div></div><div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#ff9a78]" /><div><p className="text-xs font-black">Feito para a região</p><p className="mt-1 text-[10px] leading-5 text-white/45">Busca por cidade e localização para negociação realmente próxima.</p></div></div></div></section>
      </main>
    </div>
  );
}

function ListingSkeleton() { return <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">{Array.from({ length: 10 }).map((_, index) => <div key={index} className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[#4b3328]/8"><div className="aspect-square animate-pulse bg-[#ebe6e1] sm:aspect-[4/3]" /><div className="space-y-2 p-3"><div className="h-4 w-2/3 animate-pulse rounded bg-[#ebe6e1]" /><div className="h-3 animate-pulse rounded bg-[#f0ece8]" /><div className="h-3 w-1/2 animate-pulse rounded bg-[#f0ece8]" /></div></div>)}</div>; }
function EmptyState() { return <div className="mt-5 rounded-[24px] border border-dashed border-[#4b3328]/20 bg-white px-6 py-12 text-center"><p className="font-serif text-2xl font-bold">A vitrine está sendo montada.</p><p className="mt-2 text-sm text-[#806b60]">Os primeiros anúncios publicados vão aparecer aqui.</p></div>; }
function countdown(ms: number) { const total = Math.max(0, Math.floor(ms / 1000)); const days = Math.floor(total / 86400); const hours = Math.floor((total % 86400) / 3600); const minutes = Math.floor((total % 3600) / 60); const seconds = total % 60; if (days) return `${days}d ${hours}h`; if (hours) return `${hours}h ${minutes}m`; return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; }
function money(value: unknown) { const numeric = Number(value); return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: numeric % 1 === 0 ? 0 : 2 }).format(Number.isFinite(numeric) ? numeric : 0); }
