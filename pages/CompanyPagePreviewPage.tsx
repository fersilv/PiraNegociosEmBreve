import React, { useEffect, useState } from 'react';
import { Clock3, Loader2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { CompanyPageConfig, CompanySiteRenderer, PublicCompanyLike, PublicJobLike } from '../components/company-page/CompanySiteRenderer';

export default function CompanyPagePreviewPage() {
  const { token } = useParams();
  const [company, setCompany] = useState<PublicCompanyLike | null>(null);
  const [jobs, setJobs] = useState<PublicJobLike[]>([]);
  const [page, setPage] = useState<CompanyPageConfig | null>(null);
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    api.get(`/public/company-pages/preview/${encodeURIComponent(token)}`)
      .then((response) => {
        setCompany(response.data.company || null);
        setJobs(Array.isArray(response.data.jobs) ? response.data.jobs : []);
        setPage(response.data.page || null);
        setExpiresAt(response.data.expiresAt || '');
      })
      .catch((requestError) => setError(requestError?.response?.data?.message || 'Esta prévia expirou ou não está mais disponível.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-stone-100 text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Preparando prévia...</div>;
  if (error || !company) return <div className="flex min-h-screen flex-col items-center justify-center bg-stone-100 px-6 text-center"><h1 className="font-serif text-3xl font-black text-stone-900">Prévia indisponível</h1><p className="mt-3 max-w-md text-stone-500">{error}</p><Link to="/company/pagina" className="mt-5 font-bold text-terracotta-700">Voltar para Minha Página</Link></div>;

  return (
    <div className="min-h-screen bg-stone-100">
      <div className="sticky top-0 z-[80] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-violet-200 bg-violet-950 px-4 py-2.5 text-center text-[11px] font-bold text-violet-100 shadow-lg">
        <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> Prévia privada e temporária</span>
        {expiresAt && <span className="text-violet-300">expira às {new Date(expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>
      <CompanySiteRenderer company={company} jobs={jobs} page={page} preview />
    </div>
  );
}
