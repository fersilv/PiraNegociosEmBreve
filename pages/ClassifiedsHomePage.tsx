import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ClassifiedCategoryIcon } from '../components/classifieds/ClassifiedCategoryIcon';
import { ClassifiedListingCard } from '../components/classifieds/ClassifiedListingCard';
import { Navbar } from '../components/Navbar';
import { SeoHead } from '../components/SeoHead';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { ClassifiedCategory, ClassifiedListing, ClassifiedSearchResponse } from '../types/classifieds';

export default function ClassifiedsHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [recent, setRecent] = useState<ClassifiedListing[]>([]);
  const [featured, setFeatured] = useState<ClassifiedListing[]>([]);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      api.get('/classifieds/categories'),
      api.get('/classifieds/listings?limit=20'),
      api.get('/classifieds/listings?featured=true&limit=8'),
    ]).then(([categoryResult, recentResult, featuredResult]) => {
      if (!active) return;
      if (categoryResult.status === 'fulfilled') setCategories(Array.isArray(categoryResult.value.data) ? categoryResult.value.data : []);
      if (recentResult.status === 'fulfilled') setRecent((recentResult.value.data as ClassifiedSearchResponse)?.items || []);
      if (featuredResult.status === 'fulfilled') setFeatured((featuredResult.value.data as ClassifiedSearchResponse)?.items || []);
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const cities = useMemo(() => Array.from(new Set(recent.map((item) => `${item.city} - ${item.state}`).filter(Boolean))).sort(), [recent]);
  const highlightItems = featured.length ? featured : recent.slice(0, 8);

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
      <SeoHead
        title="Classificados | PiraNegócios"
        description="Compre, venda e encontre produtos e serviços da sua região no Classificados PiraNegócios."
        canonical={`${window.location.origin}/classificados`}
      />
      <Navbar />

      <main>
        <section className="relative overflow-hidden border-b border-[#4b3328]/10 bg-[#fffaf5]">
          <div className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full bg-[#f0bf9f]/45 blur-3xl" />
          <div className="pointer-events-none absolute -left-24 bottom-[-100px] h-72 w-72 rounded-full bg-[#c96847]/15 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
            <div className="grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#c96847]/15 bg-[#fff1e9] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.17em] text-[#a84f34]"><Sparkles className="h-3.5 w-3.5" /> Marketplace da região</div>
                <h1 className="mt-5 max-w-4xl font-serif text-4xl font-bold leading-[.98] tracking-[-.04em] sm:text-6xl lg:text-7xl">Tem alguém perto procurando exatamente o que você anuncia.</h1>
                <p className="mt-5 max-w-2xl text-sm leading-6 text-[#725e53] sm:text-lg sm:leading-8">Produtos, veículos, imóveis e serviços locais em uma vitrine simples de buscar e rápida de anunciar.</p>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-bold text-[#725e53] ring-1 ring-[#4b3328]/10"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Anunciantes identificados</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-bold text-[#725e53] ring-1 ring-[#4b3328]/10"><MapPin className="h-4 w-4 text-[#c96847]" /> Foco regional</span>
              </div>
            </div>

            <form onSubmit={search} className="mt-7 rounded-[24px] bg-white p-2.5 shadow-[0_22px_60px_rgba(62,43,34,.10)] ring-1 ring-[#4b3328]/10 sm:mt-9">
              <div className="grid gap-2 md:grid-cols-[1.5fr_.8fr_auto]">
                <label className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9e8d84]" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="O que você está procurando?" className="h-12 w-full rounded-2xl border-0 bg-[#faf8f6] pl-11 pr-4 text-sm font-semibold outline-none ring-1 ring-[#4b3328]/10 focus:ring-2 focus:ring-[#c96847]/35" />
                </label>
                <label className="relative">
                  <MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9e8d84]" />
                  <select value={city} onChange={(event) => setCity(event.target.value)} className="h-12 w-full appearance-none rounded-2xl border-0 bg-[#faf8f6] pl-11 pr-4 text-sm font-bold text-[#5c473d] outline-none ring-1 ring-[#4b3328]/10 focus:ring-2 focus:ring-[#c96847]/35">
                    <option value="">Toda a região</option>
                    {cities.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <button className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#2d211c] px-6 text-sm font-black text-white transition hover:bg-black">Buscar <ArrowRight className="h-4 w-4" /></button>
              </div>
            </form>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-[10px] font-black uppercase tracking-[.17em] text-[#b06448]">Explore por categoria</p><h2 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">Encontre mais rápido</h2></div>
            <Link to="/classificados/busca" className="hidden text-xs font-black text-[#a84f34] sm:inline-flex">Ver todos</Link>
          </div>
          <div className="-mx-4 mt-5 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 md:grid-cols-5 lg:grid-cols-7">
            {categories.slice(0, 14).map((category) => (
              <Link key={category.slug} to={`/classificados/categoria/${encodeURIComponent(category.slug)}`} className="flex w-[112px] shrink-0 snap-start flex-col items-center gap-2.5 rounded-[20px] bg-white px-3 py-4 text-center ring-1 ring-[#4b3328]/10 transition hover:-translate-y-0.5 hover:shadow-md sm:w-auto">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f7e9df] text-[#b45e42]"><ClassifiedCategoryIcon name={category.icon} className="h-5 w-5" /></span>
                <span className="text-[11px] font-bold leading-tight text-[#4f3b31]">{category.name}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-[10px] font-black uppercase tracking-[.17em] text-[#b06448]">Em destaque</p><h2 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">Boas oportunidades para começar</h2></div>
            <Link to="/classificados/busca?sort=recent" className="text-xs font-black text-[#a84f34]">Ver mais</Link>
          </div>
          {loading ? <ListingSkeleton /> : highlightItems.length ? (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">{highlightItems.map((listing) => <ClassifiedListingCard key={listing.id} listing={listing} />)}</div>
          ) : <EmptyState />}
        </section>

        <section className="border-y border-[#4b3328]/10 bg-white">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-9 sm:px-6 md:grid-cols-[1fr_auto] md:items-center lg:px-8">
            <div><div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-[#b06448]"><Tag className="h-3.5 w-3.5" /> Tem algo para vender?</div><h2 className="mt-2 font-serif text-3xl font-bold tracking-[-.025em] sm:text-4xl">Crie seu anúncio pelo celular em poucos passos.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#806b60]">Fotos, preço, localização e pronto. O anúncio nasce responsivo e funciona igual no desktop e no telefone.</p></div>
            <Link to={user ? '/user/classificados/novo' : '/login?returnTo=%2Fuser%2Fclassificados%2Fnovo'} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#c96847] px-6 text-sm font-black text-white shadow-[0_14px_30px_rgba(201,104,71,.20)]">Publicar anúncio <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.17em] text-[#b06448]">Recém-publicados</p><h2 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">Chegaram agora</h2></div></div>
          {recent.length ? <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">{recent.slice(0, 10).map((listing) => <ClassifiedListingCard key={listing.id} listing={listing} compact />)}</div> : !loading && <EmptyState />}
        </section>
      </main>
    </div>
  );
}

function ListingSkeleton() {
  return <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">{Array.from({ length: 10 }).map((_, index) => <div key={index} className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[#4b3328]/8"><div className="aspect-square animate-pulse bg-[#ebe6e1] sm:aspect-[4/3]" /><div className="space-y-2 p-3"><div className="h-4 w-2/3 animate-pulse rounded bg-[#ebe6e1]" /><div className="h-3 animate-pulse rounded bg-[#f0ece8]" /><div className="h-3 w-1/2 animate-pulse rounded bg-[#f0ece8]" /></div></div>)}</div>;
}

function EmptyState() {
  return <div className="mt-5 rounded-[24px] border border-dashed border-[#4b3328]/20 bg-white px-6 py-12 text-center"><p className="font-serif text-2xl font-bold">A vitrine está sendo montada.</p><p className="mt-2 text-sm text-[#806b60]">Os primeiros anúncios publicados vão aparecer aqui.</p></div>;
}
