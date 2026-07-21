import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Briefcase, MapPin, DollarSign, Clock, ArrowRight, Star, X, PlusCircle, Loader2, CheckCircle2, Laptop } from 'lucide-react';
import { RevealText } from './RevealText';
import { collection, query, where, getDocs, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

interface Job {
  id: string;
  title: string;
  companyName: string;
  location: string;
  salary?: string;
  type: string;
  workModel?: string;
  isSponsored?: boolean;
  postedAt: string;
  description: string;
  ownerId?: string;
  isConfidential?: boolean;
  isCompanyVerified?: boolean;
  isTalentPool?: boolean;
  active?: boolean;
}

export function JobsSection({ region }: { region: 'PIRASSUNUNGA' }) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isAllJobsOpen, setIsAllJobsOpen] = useState(false);
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
    try {
      await addDoc(collection(db, 'applications'), {
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
        const q = query(collection(db, 'jobs'), orderBy('postedAt', 'desc'));
        const snap = await getDocs(q);
        const fetchedJobs = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Job))
          .filter(job => job.active !== false); // Filter out inactive jobs
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
        const q = query(collection(db, 'applications'), where('candidateId', '==', user.uid));
        const snap = await getDocs(q);
        setMyApplications(snap.docs.map(doc => doc.data().jobId));
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
                <JobCard key={job.id} job={job} onClick={() => setSelectedJob(job)} />
              ))}
            </div>
          </div>
        )}

        {/* Regular Jobs */}
        <div>
          <h3 className="text-xs font-bold tracking-widest text-stone-500 uppercase mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Últimas Vagas
          </h3>
          <AnimatedLatestJobs jobs={regularJobs} onSelect={setSelectedJob} />
        </div>

        {/* See more link */}
        <div className="flex justify-center mt-8">
          <button 
            onClick={() => setIsAllJobsOpen(true)}
            className="group flex items-center gap-2 text-terracotta-700 font-medium hover:text-terracotta-900 transition-colors"
          >
            Ver todas as vagas
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

      </div>

      {/* Job Details Modal */}
      {selectedJob && (
        <JobModal 
          job={selectedJob} 
          hasApplied={myApplications.includes(selectedJob.id)}
          onClose={() => setSelectedJob(null)} 
          onApply={() => handleApply(selectedJob)}
        />
      )}

      {/* All Jobs Modal */}
      {isAllJobsOpen && (
        <AllJobsModal 
          jobs={regionJobs} 
          region={region} 
          onClose={() => setIsAllJobsOpen(false)} 
          onSelectJob={(job) => {
            setIsAllJobsOpen(false);
            setSelectedJob(job);
          }}
        />
      )}

    </section>
  );
}

function AllJobsModal({ jobs, region, onClose, onSelectJob }: { jobs: Job[], region: string, onClose: () => void, onSelectJob: (job: Job) => void }) {
  const [modelFilter, setModelFilter] = useState<'TODOS' | 'Presencial' | 'Híbrido' | 'Remoto'>('TODOS');

  const filteredJobs = jobs.filter(j => {
    if (modelFilter === 'TODOS') return true;
    const model = j.workModel || 'Presencial';
    return model.toLowerCase() === modelFilter.toLowerCase();
  });

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-offwhite animate-in slide-in-from-bottom-full duration-300">
      <div className="sticky top-0 bg-offwhite/90 backdrop-blur-md p-4 flex justify-between items-center border-b border-stone-200/50 z-10 shadow-sm">
        <div className="flex flex-col">
          <span className="text-xs font-bold tracking-widest text-terracotta-600 uppercase">
            Portal de Vagas
          </span>
          <span className="text-stone-500 text-sm">Pirassununga e Região</span>
        </div>
        <button 
          onClick={onClose}
          className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-200/50 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto flex flex-col gap-4 pb-20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-stone-900">Todas as Vagas Disponíveis</h2>
            
            {/* Work Model Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-stone-100 p-1 rounded-2xl border border-stone-200 text-xs font-bold">
              {(['TODOS', 'Presencial', 'Híbrido', 'Remoto'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setModelFilter(m)}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    modelFilter === m 
                      ? 'bg-white text-stone-900 shadow-xs' 
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {m === 'TODOS' ? 'Todos os Regimes' : m}
                </button>
              ))}
            </div>
          </div>

          {filteredJobs.length === 0 ? (
             <p className="text-stone-500 text-center py-12 bg-white rounded-3xl border border-stone-200">
               Nenhuma vaga encontrada para o regime de trabalho selecionado.
             </p>
          ) : (
            filteredJobs.map((job) => (
              <JobCard key={job.id} job={job} onClick={() => onSelectJob(job)} />
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function JobCard({ job, onClick }: { job: Job, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`text-left p-5 rounded-2xl transition-all duration-300 hover:shadow-lg w-full flex flex-col gap-3
        ${job.isSponsored 
          ? 'bg-terracotta-50/80 border border-terracotta-200 hover:border-terracotta-400' 
          : 'bg-white border border-stone-200 hover:border-terracotta-300'
        }`}
    >
      <div className="flex justify-between items-start gap-4">
        <div>
          <h4 className="font-semibold text-stone-900 text-lg line-clamp-1 flex items-center gap-2">
            {job.title}
            {job.isTalentPool && (
              <span className="bg-purple-100 text-purple-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded shrink-0">Banco de Talentos</span>
            )}
          </h4>
          <p className="text-terracotta-700 text-sm font-medium flex items-center gap-1.5">
            {job.isConfidential ? 'Empresa Confidencial' : job.companyName}
            {!job.isConfidential && job.isCompanyVerified && (
              <span 
                className="inline-flex items-center justify-center bg-blue-50 border border-blue-200 text-blue-600 p-0.5 rounded-full cursor-help hover:bg-blue-100 transition-colors shrink-0" 
                title="Esta empresa passou por verificação documental"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            )}
          </p>
        </div>
        {job.isSponsored && (
          <span className="bg-terracotta-100 text-terracotta-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider shrink-0">
            Destaque
          </span>
        )}
      </div>
      
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-auto pt-2">
        <span className="flex items-center gap-1.5 text-xs text-stone-500">
          <MapPin className="w-3.5 h-3.5" />
          {job.location}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-stone-500">
          <Briefcase className="w-3.5 h-3.5" />
          {job.type}
        </span>
        <span className="flex items-center gap-1 text-[11px] font-bold text-stone-700 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-md">
          <Laptop className="w-3 h-3 text-terracotta-600" />
          {job.workModel || 'Presencial'}
        </span>
        {job.salary && (
          <span className="flex items-center gap-1.5 text-xs text-stone-500">
            <DollarSign className="w-3.5 h-3.5" />
            {job.salary}
          </span>
        )}
      </div>
    </button>
  );
}

function JobModal({ job, hasApplied, onClose, onApply }: { job: Job, hasApplied?: boolean, onClose: () => void, onApply: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-offwhite w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-offwhite/90 backdrop-blur-md p-4 flex justify-between items-center border-b border-stone-200/50 z-10">
          <span className="text-xs font-bold tracking-widest text-terracotta-600 uppercase">
            Detalhes da Vaga
          </span>
          <button 
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-200/50 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          
          <div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-stone-900 mb-2 flex items-center gap-3">
              {job.title}
              {job.isTalentPool && (
                <span className="bg-purple-100 text-purple-700 text-xs uppercase font-bold px-3 py-1 rounded-lg shrink-0">Banco de Talentos</span>
              )}
            </h2>
            <p className="text-terracotta-700 text-lg font-medium flex items-center gap-1.5">
              {job.isConfidential ? 'Empresa Confidencial' : job.companyName}
              {!job.isConfidential && job.isCompanyVerified && (
                <span 
                  className="inline-flex items-center justify-center bg-blue-50 border border-blue-200 text-blue-600 p-0.5 rounded-full cursor-help hover:bg-blue-100 transition-colors shrink-0" 
                  title="Esta empresa passou por verificação documental"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 py-4 border-y border-stone-200/50">
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <div className="bg-white p-2 rounded-lg shadow-sm">
                <MapPin className="w-4 h-4 text-terracotta-500" />
              </div>
              {job.location}
            </div>
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <div className="bg-white p-2 rounded-lg shadow-sm">
                <Briefcase className="w-4 h-4 text-terracotta-500" />
              </div>
              {job.type}
            </div>
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <div className="bg-white p-2 rounded-lg shadow-sm">
                <Laptop className="w-4 h-4 text-terracotta-500" />
              </div>
              {job.workModel || 'Presencial'}
            </div>
            {job.salary && (
              <div className="flex items-center gap-2 text-sm text-stone-600">
                <div className="bg-white p-2 rounded-lg shadow-sm">
                  <DollarSign className="w-4 h-4 text-terracotta-500" />
                </div>
                {job.salary}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <div className="bg-white p-2 rounded-lg shadow-sm">
                <Clock className="w-4 h-4 text-terracotta-500" />
              </div>
              {job.postedAt}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-stone-900 mb-3">Descrição</h3>
            <p className="text-stone-600 whitespace-pre-line leading-relaxed">
              {job.description}
            </p>
          </div>

          <div className="pt-6 border-t border-stone-200/50 flex flex-col sm:flex-row gap-4">
            {hasApplied ? (
              <button 
                disabled
                className="flex-1 bg-green-100 text-green-700 py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 opacity-100 cursor-default"
              >
                <CheckCircle2 className="w-5 h-5" />
                Candidatura Enviada
              </button>
            ) : (
              <button 
                onClick={onApply}
                className="flex-1 bg-terracotta-600 hover:bg-terracotta-700 text-white py-3 px-6 rounded-xl font-medium transition-colors shadow-lg shadow-terracotta-600/20"
              >
                {job.isTalentPool ? 'Enviar Currículo' : 'Candidatar-se à vaga'}
              </button>
            )}
            <button 
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-medium text-stone-600 hover:bg-stone-200/50 transition-colors"
            >
              Voltar
            </button>
          </div>

        </div>
      </div>
      
      {/* Click outside to close */}
      <div className="fixed inset-0 -z-10" onClick={onClose} />
    </div>,
    document.body
  );
}

function AnimatedLatestJobs({ jobs, onSelect }: { jobs: Job[], onSelect: (job: Job) => void }) {
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
          <JobCard key={job.id} job={job} onClick={() => onSelect(job)} />
        ))}
      </div>
    </div>
  );
}
