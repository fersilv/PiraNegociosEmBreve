import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Briefcase, MapPin, DollarSign, Clock, ArrowRight, Star, X, PlusCircle, Loader2, CheckCircle2, Laptop } from 'lucide-react';
import { RevealText } from './RevealText';
import { api, asArray } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

import { JobCard } from './JobCard';
import { JobModal } from './JobModal';
import { Job } from '../types/job';

export function JobsSection({ region }: { region: 'PIRASSUNUNGA' }) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [myApplications, setMyApplications] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleApply = async (job: Job) => {
    if (!user) {
      navigate(`/login?returnTo=${encodeURIComponent('/?applyTo=' + job.id)}`);
      return;
    }
    if (profile?.type !== 'CANDIDATE') {
      alert('Apenas candidatos podem se candidatar às vagas. Mude seu perfil ou crie uma conta de candidato.');
      return;
    }
    if (myApplications.includes(job.id)) {
      alert('Você já se candidatou a esta vaga.');
      return;
    }
    if (!profile.resumeURL?.trim()) {
      alert('Para se candidatar, envie seu currículo no perfil. Você será direcionado agora.');
      navigate('/dashboard/perfil');
      return;
    }
    try {
      await api.post('/applications', {
        jobId: job.id,
        jobTitle: job.title,
        companyName: job.isConfidential ? 'Empresa Confidencial' : job.companyName,
        candidateId: user.uid,
        companyId: job.ownerId,
        status: 'Enviado',
        appliedAt: new Date().toISOString(),
        resumeURL: profile.resumeURL
      });
      alert('Candidatura enviada com sucesso!');
      setMyApplications(prev => [...prev, job.id]);
      setSelectedJob(null);
    } catch (e) {
      console.error(e);
      alert('Erro ao enviar candidatura');
    }
  };

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await api.get('/jobs');
        const fetchedJobs = asArray<Job>(res.data).filter(job => job.active !== false); // Filter out inactive jobs
        // Sort by postedAt desc
        fetchedJobs.sort((a: Job, b: Job) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
        setJobs(fetchedJobs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  useEffect(() => {
    if (user && profile?.type === 'CANDIDATE') {
      const fetchMyApps = async () => {
        try {
          const res = await api.get('/applications/me');
          setMyApplications(asArray<any>(res.data).map(app => app.jobId));
        } catch (e) {
          console.error(e);
        }
      };
      fetchMyApps();
    }
  }, [user, profile]);

  useEffect(() => {
    if (!loading && user && profile?.type === 'CANDIDATE') {
      const applyTo = new URLSearchParams(location.search).get('applyTo');
      if (applyTo) {
        const job = jobs.find(j => j.id === applyTo);
        if (job) {
          setSelectedJob(job);
          // Clean up the URL without triggering a re-render/reload
          window.history.replaceState({}, '', location.pathname);
        }
      }
    }
  }, [loading, user, profile, jobs, location.search, location.pathname]);

  const regionJobs = jobs.filter(job => job.location.toUpperCase().includes(region) || true); // fallback for now
  const sponsoredJobs = regionJobs.filter(job => job.isSponsored);
  const regularJobs = regionJobs.filter(job => !job.isSponsored);

  return (
    <section className="w-full max-w-4xl mx-auto py-16 px-4" id="vagas">
      
      <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
        <div className="flex flex-col items-center md:items-start">
          <RevealText 
            tag="h2" 
            text="Oportunidades" 
            delay={100} 
            className="font-serif text-3xl md:text-5xl font-bold text-terracotta-900 mb-4"
          />
          <div className="w-16 h-[1px] bg-terracotta-800/20 mb-4" />
          <p className="text-stone-600 text-center md:text-left font-light">
            Confira as vagas de emprego em destaque na região de Pirassununga.
          </p>
        </div>
        <Link 
          to="/login"
          className="flex items-center gap-2 bg-terracotta-600 hover:bg-terracotta-700 text-white py-3 px-6 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
        >
          <PlusCircle className="w-5 h-5" />
          Anunciar Vaga
        </Link>
      </div>

      <div className="space-y-8">
        
        {/* Sponsored Jobs */}
        {sponsoredJobs.length > 0 && (
          <div>
            <h3 className="text-xs font-bold tracking-widest text-terracotta-600 uppercase mb-4 flex items-center gap-2">
              <Star className="w-4 h-4" /> VAGAS EM DESTAQUE
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sponsoredJobs.map(job => (
                <JobCard key={job.id} job={job} hasApplied={myApplications.includes(job.id)} onClick={() => job.slug ? navigate(`/vagas/${job.slug}`) : setSelectedJob(job)} />
              ))}
            </div>
          </div>
        )}

        {/* Regular Jobs */}
        <div>
          <h3 className="text-xs font-bold tracking-widest text-stone-500 uppercase mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Últimas Vagas
          </h3>
          <AnimatedLatestJobs jobs={regularJobs} appliedJobIds={myApplications} onSelect={(job) => job.slug ? navigate(`/vagas/${job.slug}`) : setSelectedJob(job)} />
        </div>

        {/* See more link */}
        <div className="flex justify-center mt-8">
          <Link 
            to="/vagas"
            className="group flex items-center gap-2 text-terracotta-700 font-medium hover:text-terracotta-900 transition-colors"
          >
            Ver todas as vagas
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

      </div>

      {selectedJob && (
        <JobModal 
          job={selectedJob} 
          hasApplied={myApplications.includes(selectedJob.id)}
          onClose={() => setSelectedJob(null)} 
          onApply={() => handleApply(selectedJob)}
        />
      )}

    </section>
  );
}

function AnimatedLatestJobs({ jobs, appliedJobIds, onSelect }: { jobs: Job[], appliedJobIds: string[], onSelect: (job: Job) => void }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const pageSize = 3;
  const totalPages = Math.ceil(jobs.length / pageSize);

  React.useEffect(() => {
    if (totalPages <= 1) return;
    const interval = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setCurrentPage((prev) => (prev + 1) % totalPages);
        setIsFading(false);
      }, 500); // 500ms fade out duration
    }, 6000); // Change every 6 seconds

    return () => clearInterval(interval);
  }, [totalPages]);

  if (jobs.length === 0) return <p className="text-stone-500 text-sm text-center py-4">Nenhuma vaga recente encontrada para esta região.</p>;

  const currentJobs = jobs.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  return (
    <div className="relative min-h-[140px] flex items-center justify-center overflow-visible">
      <div 
        className={`w-full flex flex-col gap-3 transition-all duration-500 ease-in-out ${
          isFading ? 'opacity-0 blur-sm scale-95' : 'opacity-100 blur-0 scale-100'
        }`}
      >
        {currentJobs.map((job) => (
          <JobCard key={job.id} job={job} hasApplied={appliedJobIds.includes(job.id)} onClick={() => onSelect(job)} />
        ))}
      </div>
    </div>
  );
}
