import React, { useState, useEffect } from 'react';
import { Job } from '../types/job';
import { api, asArray } from '../lib/api';
import { MapPin, Briefcase, DollarSign, ArrowRight } from 'lucide-react';

export default function EmbedJobsWidget() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Inject a transparent background to the body for embedding
    document.body.style.background = 'transparent';
    const fetchJobs = async () => {
      try {
        const res = await api.get('/jobs');
        const fetchedJobs = asArray<Job>(res.data).filter(job => job.active !== false);
        fetchedJobs.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
        setJobs(fetchedJobs.slice(0, 5)); // show latest 5
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();

    return () => {
      document.body.style.background = '';
    };
  }, []);

  if (loading) {
    return <div className="p-4 text-center text-stone-500 font-sans">Carregando vagas...</div>;
  }

  if (jobs.length === 0) {
    return <div className="p-4 text-center text-stone-500 font-sans">Nenhuma vaga disponível no momento.</div>;
  }

  const siteUrl = window.location.origin;

  return (
    <div className="font-sans bg-transparent p-4 w-full h-full max-w-lg mx-auto">
      <div className="mb-4 pb-2 border-b border-stone-200 flex justify-between items-center">
        <h3 className="font-serif font-bold text-lg text-terracotta-900">Últimas Vagas - PiraNegócios</h3>
      </div>
      <div className="flex flex-col gap-3">
        {jobs.map(job => (
          <a
            key={job.id}
            href={`${siteUrl}/vagas/${job.slug || ''}`}
            target="_top"
            className="block p-4 border border-stone-200 rounded-xl bg-white hover:border-terracotta-300 transition-colors shadow-sm hover:shadow"
          >
            <h4 className="font-bold text-stone-900 line-clamp-1">{job.title}</h4>
            <p className="text-sm font-medium text-terracotta-700">{job.isConfidential ? 'Empresa Confidencial' : job.companyName}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-stone-500">
              {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {job.location}</span>}
              {job.type && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3"/> {job.type}</span>}
              {job.salary && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3"/> {job.salary}</span>}
            </div>
          </a>
        ))}
      </div>
      <a 
        href={`${siteUrl}/vagas`} 
        target="_top" 
        className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-lg text-sm transition-colors"
      >
        Ver todas as vagas
        <ArrowRight className="w-4 h-4" />
      </a>
    </div>
  );
}
