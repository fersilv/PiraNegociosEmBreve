import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Filter, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ClassifiedCategoryIcon } from '../components/classifieds/ClassifiedCategoryIcon';
import { ClassifiedListingCard } from '../components/classifieds/ClassifiedListingCard';
import { Navbar } from '../components/Navbar';
import { SeoHead } from '../components/SeoHead';
import { api } from '../lib/api';
import type { ClassifiedCategory, ClassifiedSearchResponse } from '../types/classifieds';

export default function ClassifiedsSearchPage() {
  const { categorySlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [result, setResult] = useState<ClassifiedSearchResponse>({ items: [], total: 0, page: 1, limit: 24, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [queryText, setQueryText] = useState(searchParams.get('q') || '');

  const activeCategory = categorySlug || searchParams.get('category') || '';
  const serializedParams = searchParams.toString();

  useEffect(() => {
    api.get('/classifieds/categories').then((response) => setCategories(Array.isArray(response.data) ? response.data : [])).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(serializedParams);
    if (categorySlug) params.set('category', categorySlug);
    params.set('limit', '24');
    setLoading(true);
    api.get(`/classifieds/listings?${params.toString()}`)
      .then((response) => { if (active) setResult(response.data as ClassifiedSearchResponse); })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [serializedParams, categorySlug]);

  useEffect(() => { setQueryText(searchParams.get('q') || ''); }, [serializedParams]);

  const category = useMemo(() => categories.find((item) => item.slug === activeCategory), [categories, activeCategory]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setParam('q', queryText.trim());
  };

  const clearFilters = () => {
    const q = searchParams.get('q');
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    setSearchParams(next);
  };

  return (
    <div className="min-h-screen bg-[#f6f4f1] text-[#2d211c]">
      <SeoHead title={`${category?.name || 'Classificados'} | PiraNegócios`} description="Encontre produtos e serviços anunciados na sua região." canonical={`${window.location.origin}${window.location.pathname}`} />
      <Navbar />

      <div className="sticky top-[72px] z-30 border-b border-[#4b3328]/10 bg-[#fffaf5]/96 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <form onSubmit={submitSearch} className="flex gap-2">
            <label className="relative min-w-0 flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9e8d84]" /><input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="O que você está procurando?" className="h-11 w-full rounded-2xl border-0 bg-white pl-11 pr-3 text-sm font-semibold outline-none ring-1 ring-[#4b3328]/10 focus:ring-2 focus:ring-[#c96847]/35" /></label>
            <button className="hidden h-11 rounded-2xl bg-[#2d211c] px-5 text-sm font-black text-white sm:block">Buscar</button>
            <button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#4f3b31] ring-1 ring-[#4b3328]/10 lg:hidden" aria-label="Abrir filtros"><SlidersHorizontal className="h-4.5 w-4.5" /></button>
          </form>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setParam('listingType', '')} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ring-1 ${!searchParams.get('listingType') ? 'bg-[#2d211c] text-white ring-[#2d211c]' : 'bg-white text-[#5a463c] ring-[#4b3328]/10'}`}>Tudo</button>
          <button onClick={() => setParam('listingType', 'PRODUCT')} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ring-1 ${searchParams.get('listingType') === 'PRODUCT' ? 'bg-[#2d211c] text-white ring-[#2d211c]' : 'bg-white text-[#5a463c] ring-[#4b3328]/10'}`}>Produtos</button>
          <button onClick={() => setParam('listingType', 'SERVICE')} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ring-1 ${searchParams.get('listingType') === 'SERVICE' ? 'bg-[#2d211c] text-white ring-[#2d211c]' : 'bg-white text-[#5a463c] ring-[#4b3328]/10'}`}>Serviços</button>
        </div>

        <div className="mb-5 flex snap-x gap-2 overflow-x-auto pb-1">
          <Link to={`/classificados/busca${serializedParams ? `?${serializedParams}` : ''}`} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ring-1 ${!activeCategory ? 'bg-[#2d211c] text-white ring-[#2d211c]' : 'bg-white text-[#5a463c] ring-[#4b3328]/10'}`}>Todas as categorias</Link>
          {categories.map((item) => <Link key={item.slug} to={`/classificados/categoria/${item.slug}?${searchParams.toString()}`} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold ring-1 ${activeCategory === item.slug ? 'bg-[#2d211c] text-white ring-[#2d211c]' : 'bg-white text-[#5a463c] ring-[#4b3328]/10'}`}><ClassifiedCategoryIcon name={item.icon} className="h-3.5 w-3.5" />{item.name}</Link>)}
        </div>

        <div className="grid gap-7 lg:grid-cols-[248px_minmax(0,1fr)]">
          <aside className="hidden lg:block"><div className="sticky top-[148px] rounded-[24px] bg-white p-5 ring-1 ring-[#4b3328]/10"><FilterPanel searchParams={searchParams} categories={categories} activeCategory={activeCategory} setParam={setParam} clearFilters={clearFilters} /></div></aside>

          <section className="min-w-0">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#b06448]">{searchParams.get('listingType') === 'SERVICE' ? 'Serviços' : searchParams.get('listingType') === 'PRODUCT' ? 'Produtos' : category ? category.name : 'Marketplace regional'}</p><h1 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">{searchParams.get('q') ? `Resultados para “${searchParams.get('q')}”` : category ? `Anúncios em ${category.name}` : 'Todos os classificados'}</h1><p className="mt-1 text-xs font-semibold text-[#8b756a]">{loading ? 'Buscando...' : `${result.total} ${result.total === 1 ? 'anúncio encontrado' : 'anúncios encontrados'}`}</p></div>
              <label className="relative shrink-0"><select value={searchParams.get('sort') || 'recent'} onChange={(event) => setParam('sort', event.target.value)} className="h-10 appearance-none rounded-xl border-0 bg-white pl-3 pr-9 text-xs font-bold text-[#5c473d] outline-none ring-1 ring-[#4b3328]/10"><option value="recent">Mais relevantes</option><option value="price_asc">Menor preço</option><option value="price_desc">Maior preço</option><option value="oldest">Mais antigos</option></select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9e8d84]" /></label>
            </div>

            {loading ? <SearchSkeleton /> : result.items.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">{result.items.map((listing) => <ClassifiedListingCard key={listing.id} listing={listing} />)}</div>
            ) : <div className="rounded-[24px] border border-dashed border-[#4b3328]/20 bg-white px-6 py-14 text-center"><p className="font-serif text-2xl font-bold">Nada por aqui com esses filtros.</p><p className="mt-2 text-sm text-[#806b60]">Tente ampliar a localização ou remover algum filtro.</p><button onClick={clearFilters} className="mt-5 rounded-xl bg-[#2d211c] px-4 py-2.5 text-xs font-black text-white">Limpar filtros</button></div>}

            {result.pages > 1 && <div className="mt-8 flex items-center justify-center gap-2"><button disabled={result.page <= 1} onClick={() => setParam('page', String(Math.max(1, result.page - 1)))} className="rounded-xl bg-white px-4 py-2 text-xs font-bold ring-1 ring-[#4b3328]/10 disabled:opacity-35">Anterior</button><span className="px-2 text-xs font-bold text-[#806b60]">{result.page} / {result.pages}</span><button disabled={result.page >= result.pages} onClick={() => setParam('page', String(Math.min(result.pages, result.page + 1)))} className="rounded-xl bg-white px-4 py-2 text-xs font-bold ring-1 ring-[#4b3328]/10 disabled:opacity-35">Próxima</button></div>}
          </section>
        </div>
      </main>

      {filtersOpen && <div className="fixed inset-0 z-[80] lg:hidden"><button aria-label="Fechar filtros" onClick={() => setFiltersOpen(false)} className="absolute inset-0 bg-black/35" /><div className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#b06448]">Refinar busca</p><h2 className="font-serif text-2xl font-bold">Filtros</h2></div><button onClick={() => setFiltersOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f0ec]"><X className="h-5 w-5" /></button></div><FilterPanel searchParams={searchParams} categories={categories} activeCategory={activeCategory} setParam={setParam} clearFilters={clearFilters} /><button onClick={() => setFiltersOpen(false)} className="sticky bottom-0 mt-5 h-12 w-full rounded-2xl bg-[#2d211c] text-sm font-black text-white">Ver {result.total} resultados</button></div></div>}
    </div>
  );
}

function FilterPanel({ searchParams, categories, activeCategory, setParam, clearFilters }: { searchParams: URLSearchParams; categories: ClassifiedCategory[]; activeCategory: string; setParam: (key: string, value: string) => void; clearFilters: () => void }) {
  return <div className="space-y-6"><div className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-sm font-black"><Filter className="h-4 w-4" /> Filtros</span><button onClick={clearFilters} className="text-[10px] font-black uppercase tracking-[.12em] text-[#b06448]">Limpar</button></div>
    <div><FilterLabel>Tipo</FilterLabel><select value={searchParams.get('listingType') || ''} onChange={(event) => setParam('listingType', event.target.value)} className="w-full rounded-xl border-0 bg-[#f7f4f1] px-3 py-3 text-sm font-semibold outline-none ring-1 ring-[#4b3328]/10"><option value="">Produtos e serviços</option><option value="PRODUCT">Produtos</option><option value="SERVICE">Serviços</option></select></div>
    <div><FilterLabel>Categoria</FilterLabel><select value={activeCategory} onChange={(event) => setParam('category', event.target.value)} disabled={Boolean(activeCategory && window.location.pathname.includes('/categoria/'))} className="w-full rounded-xl border-0 bg-[#f7f4f1] px-3 py-3 text-sm font-semibold outline-none ring-1 ring-[#4b3328]/10 disabled:opacity-60"><option value="">Todas</option>{categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></div>
    <div><FilterLabel>Localização</FilterLabel><div className="grid grid-cols-[1fr_72px] gap-2"><div className="relative"><MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9e8d84]" /><input value={searchParams.get('city') || ''} onChange={(event) => setParam('city', event.target.value)} placeholder="Cidade" className="w-full rounded-xl border-0 bg-[#f7f4f1] py-3 pl-9 pr-3 text-sm font-semibold outline-none ring-1 ring-[#4b3328]/10" /></div><input value={searchParams.get('state') || ''} onChange={(event) => setParam('state', event.target.value.toUpperCase().slice(0, 2))} placeholder="UF" className="w-full rounded-xl border-0 bg-[#f7f4f1] px-3 py-3 text-center text-sm font-bold uppercase outline-none ring-1 ring-[#4b3328]/10" /></div></div>
    <div><FilterLabel>Preço</FilterLabel><div className="grid grid-cols-2 gap-2"><input type="number" min="0" value={searchParams.get('minPrice') || ''} onChange={(event) => setParam('minPrice', event.target.value)} placeholder="Mínimo" className="w-full rounded-xl border-0 bg-[#f7f4f1] px-3 py-3 text-sm outline-none ring-1 ring-[#4b3328]/10" /><input type="number" min="0" value={searchParams.get('maxPrice') || ''} onChange={(event) => setParam('maxPrice', event.target.value)} placeholder="Máximo" className="w-full rounded-xl border-0 bg-[#f7f4f1] px-3 py-3 text-sm outline-none ring-1 ring-[#4b3328]/10" /></div></div>
    <div><FilterLabel>Condição</FilterLabel><select value={searchParams.get('condition') || ''} onChange={(event) => setParam('condition', event.target.value)} className="w-full rounded-xl border-0 bg-[#f7f4f1] px-3 py-3 text-sm font-semibold outline-none ring-1 ring-[#4b3328]/10"><option value="">Qualquer</option><option value="NEW">Novo</option><option value="USED">Usado</option><option value="REFURBISHED">Recondicionado</option><option value="NOT_APPLICABLE">Não se aplica / serviço</option></select></div>
    <div><FilterLabel>Anunciante</FilterLabel><select value={searchParams.get('sellerType') || ''} onChange={(event) => setParam('sellerType', event.target.value)} className="w-full rounded-xl border-0 bg-[#f7f4f1] px-3 py-3 text-sm font-semibold outline-none ring-1 ring-[#4b3328]/10"><option value="">Todos</option><option value="person">Particular</option><option value="company">Empresa</option></select></div>
  </div>;
}

function FilterLabel({ children }: { children: React.ReactNode }) { return <p className="mb-2 text-[10px] font-black uppercase tracking-[.14em] text-[#9b8275]">{children}</p>; }

function SearchSkeleton() { return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">{Array.from({ length: 12 }).map((_, index) => <div key={index} className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[#4b3328]/8"><div className="aspect-square animate-pulse bg-[#ebe6e1] sm:aspect-[4/3]" /><div className="space-y-2 p-3"><div className="h-4 w-2/3 animate-pulse rounded bg-[#ebe6e1]" /><div className="h-3 animate-pulse rounded bg-[#f0ece8]" /></div></div>)}</div>; }
