import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, BriefcaseBusiness, Loader2, PackageOpen } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ClassifiedListingCard } from '../components/classifieds/ClassifiedListingCard';
import type { PublicCompanyLike, PublicJobLike } from '../components/company-page/CompanySiteRenderer';
import { Navbar } from '../components/Navbar';
import { SeoHead } from '../components/SeoHead';
import { api } from '../lib/api';
import type { ClassifiedListing } from '../types/classifieds';

type CollectionKind = 'products' | 'jobs';

export default function CompanyCollectionPage({ kind }: { kind: CollectionKind }) {
  const { companySlug } = useParams();
  const [company, setCompany] = useState<PublicCompanyLike | null>(null);
  const [jobs, setJobs] = useState<PublicJobLike[]>([]);
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companySlug) return;
    let active = true;
    setLoading(true);
    api.get(`/public/companies/${encodeURIComponent(companySlug)}`)
      .then(async (response) => {
        if (!active) return;
        const nextCompany = response.data.company as PublicCompanyLike;
        setCompany(nextCompany);
        setJobs(Array.isArray(response.data.jobs) ? response.data.jobs : []);
        if (kind === 'products') {
          const catalog = await api.get(`/classifieds/company/${nextCompany.id}/listings`);
          if (!active) return;
          const data = catalog.data;
          setListings(Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);
        }
      })
      .catch(() => { if (active) setCompany(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companySlug, kind]);

  const products = useMemo(() => listings.filter((item) => item.listingType !== 'SERVICE'), [listings]);
  const services = useMemo(() => listings.filter((item) => item.listingType === 'SERVICE'), [listings]);
  const title = kind === 'products' ? 'Produtos e serviços' : 'Vagas abertas';

  if (loading) return <div className="min-h-screen bg-[#f7f6f3]"><Navbar /><div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-stone-400" /></div></div>;
  if (!company) return <div className="min-h-screen bg-[#f7f6f3]"><Navbar /><main className="mx-auto max-w-3xl px-5 py-28 text-center"><h1 className="font-serif text-3xl font-black">Página não encontrada</h1><Link to="/" className="mt-6 inline-flex rounded-xl bg-stone-900 px-5 py-3 text-sm font-bold text-white">Ir para o início</Link></main></div>;

  return (
    <div className="min-h-screen bg-[#f7f6f3] text-stone-900">
      <SeoHead title={`${title} | ${company.name}`} description={`${title} da empresa ${company.name}.`} canonical={`${window.location.origin}/${company.slug}/${kind === 'products' ? 'produtos' : 'vagas'}`} />
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        <Link to={`/${company.slug}`} className="inline-flex items-center gap-2 text-xs font-black text-stone-500 transition hover:text-stone-950"><ArrowLeft className="h-4 w-4" /> Voltar para a loja</Link>
        <header className="mt-6 overflow-hidden rounded-[30px] bg-stone-950 px-6 py-8 text-white sm:px-10 sm:py-12">
          <div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white/10 text-xl font-black">{company.logoURL ? <img src={company.logoURL} alt="" className="h-full w-full object-contain" /> : company.name.slice(0, 1)}</div><div><div className="flex items-center gap-1.5"><p className="font-bold">{company.name}</p><BadgeCheck className="h-4 w-4 text-emerald-400" /></div><p className="mt-1 text-xs text-white/55">{company.cityState || [company.city, company.state].filter(Boolean).join(' · ') || 'PiraNegócios'}</p></div></div>
          <p className="mt-9 text-[10px] font-black uppercase tracking-[.2em] text-white/45">{kind === 'products' ? 'Catálogo da loja' : 'Trabalhe conosco'}</p>
          <h1 className="mt-3 font-serif text-4xl font-black tracking-[-.04em] sm:text-6xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/60">{kind === 'products' ? 'Todos os itens publicados por esta empresa, sem sair da sua vitrine.' : 'Todas as oportunidades ativas desta empresa em um único lugar.'}</p>
        </header>

        {kind === 'products' ? <div className="mt-10 space-y-12">{products.length > 0 && <Catalog title={services.length ? 'Produtos' : undefined} items={products} />}{services.length > 0 && <Catalog title={products.length ? 'Serviços' : undefined} items={services} />}{!listings.length && <Empty icon={<PackageOpen className="h-7 w-7" />} text="Esta loja ainda não possui itens publicados." />}</div> : <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{jobs.map((job) => <Link key={job.id || job.slug} to={job.slug ? `/vagas/${encodeURIComponent(job.slug)}` : '/vagas'} className="group min-h-52 rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[.16em] text-stone-400"><span>Oportunidade</span><ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></div><h2 className="mt-10 text-xl font-black tracking-[-.025em]">{job.title || 'Vaga aberta'}</h2><p className="mt-3 text-sm text-stone-500">{job.location || [job.city, job.state].filter(Boolean).join(' · ') || 'Local a combinar'}{job.workModel ? ` · ${job.workModel}` : ''}</p>{job.salary && <p className="mt-5 text-sm font-black text-stone-800">{job.salary}</p>}</Link>)}{!jobs.length && <div className="md:col-span-2 lg:col-span-3"><Empty icon={<BriefcaseBusiness className="h-7 w-7" />} text="Esta empresa não possui vagas abertas no momento." /></div>}</div>}
      </main>
    </div>
  );
}

function Catalog({ title, items }: { title?: string; items: ClassifiedListing[] }) {
  return <section>{title && <h2 className="mb-5 text-2xl font-black">{title}</h2>}<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">{items.map((item) => <ClassifiedListingCard key={item.id} listing={item} />)}</div></section>;
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="rounded-[24px] border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100">{icon}</div><p className="mt-4 text-sm font-bold">{text}</p></div>;
}
