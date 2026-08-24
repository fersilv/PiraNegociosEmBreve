import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { CompanyPageConfig, PublicCompanyLike } from '../components/company-page/CompanySiteRenderer';
import { SeoHead } from '../components/SeoHead';

export function CompanyLegalPage({ type }: { type: 'terms' | 'privacy' }) {
  const { companySlug } = useParams();
  const [company, setCompany] = useState<PublicCompanyLike | null>(null);
  const [page, setPage] = useState<CompanyPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!companySlug) return;
    let active = true;
    api.get(`/public/companies/${encodeURIComponent(companySlug)}`)
      .then(async (response) => {
        if (!active) return;
        const nextCompany = response.data.company;
        setCompany(nextCompany);
        const pageResponse = await api.get(`/public/company-pages/company/${nextCompany.id}`);
        if (active) setPage(pageResponse.data?.page || null);
      })
      .catch((requestError) => active && setError(requestError?.response?.data?.message || 'Página não encontrada.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [companySlug]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-terracotta-600" /></div>;

  const legal = page?.legal;
  const enabled = type === 'terms' ? legal?.termsEnabled : legal?.privacyEnabled;
  const title = type === 'terms' ? (legal?.termsTitle || 'Termos de uso') : (legal?.privacyTitle || 'Política de privacidade');
  const body = type === 'terms' ? legal?.termsBody : legal?.privacyBody;

  if (error || !company || !enabled) return <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-6 text-center"><h1 className="font-serif text-3xl font-black text-stone-900">Página não disponível</h1><p className="mt-3 text-stone-500">{error || 'A empresa não publicou este conteúdo.'}</p><Link to={`/${companySlug || ''}`} className="mt-5 font-black text-terracotta-700">Voltar para a empresa</Link></div>;

  const canonical = `${window.location.origin}/${company.slug}/${type === 'terms' ? 'termos' : 'privacidade'}`;
  return (
    <div className="min-h-screen bg-[#f7f4ef] text-stone-800">
      <SeoHead title={`${title} | ${company.name}`} description={`${title} de ${company.name}.`} canonical={canonical} />
      <main className="mx-auto max-w-4xl px-5 py-10 sm:py-16">
        <Link to={`/${company.slug}`} className="inline-flex items-center gap-2 text-sm font-black text-stone-500 hover:text-stone-900"><ArrowLeft className="h-4 w-4" /> Voltar para {company.name}</Link>
        <article className="mt-6 rounded-[30px] border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-terracotta-50 text-terracotta-700"><ShieldCheck className="h-5 w-5" /></div>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[.18em] text-terracotta-600">{company.name}</p>
          <h1 className="mt-2 font-serif text-4xl font-black text-stone-950">{title}</h1>
          <div className="mt-8 whitespace-pre-wrap text-sm leading-7 text-stone-600">{body || 'Conteúdo não informado.'}</div>
        </article>
        <p className="py-6 text-center text-[11px] font-semibold text-stone-400">Página empresarial integrada ao PiraNegócios</p>
      </main>
    </div>
  );
}
