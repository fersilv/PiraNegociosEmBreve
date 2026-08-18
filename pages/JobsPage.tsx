import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, MapPin, Briefcase, ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import { api, asArray } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Job } from '../types/job';
import { JobCard } from '../components/JobCard';
import { JobModal } from '../components/JobModal';
import { Navbar } from '../components/Navbar';

const ITEMS_PER_PAGE = 10;

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [myApplications, setMyApplications] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [workModelFilter, setWorkModelFilter] = useState<'TODOS' | 'Presencial' | 'Híbrido' | 'Remoto'>('TODOS');
  const [typeFilter, setTypeFilter] = useState<'TODOS' | 'CLT' | 'PJ' | 'Estágio' | 'Freelancer' | 'Temporário'>('TODOS');
  const [sortBy, setSortBy] = useState<'recentes' | 'antigas'>('recentes');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await api.get('/jobs');
        const fetchedJobs = asArray<Job>(res.data).filter(job => job.active !== false);
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
          window.history.replaceState({}, '', location.pathname);
        }
      }
    }
  }, [loading, user, profile, jobs, location.search, location.pathname]);

  const handleApply = async (job: Job) => {
    if (!user) {
      navigate(`/login?returnTo=${encodeURIComponent('/vagas?applyTo=' + job.id)}`);
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

  const filteredAndSortedJobs = useMemo(() => {
    let result = [...jobs];

    // Filter by search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(job => 
        job.title.toLowerCase().includes(term) ||
        (!job.isConfidential && job.companyName.toLowerCase().includes(term)) ||
        job.description.toLowerCase().includes(term) ||
        job.location.toLowerCase().includes(term)
      );
    }

    // Filter by work model
    if (workModelFilter !== 'TODOS') {
      result = result.filter(job => {
        const model = job.workModel || 'Presencial';
        return model.toLowerCase() === workModelFilter.toLowerCase();
      });
    }

    // Filter by job type
    if (typeFilter !== 'TODOS') {
      result = result.filter(job => job.type.toLowerCase() === typeFilter.toLowerCase());
    }

    // Sort by date
    result.sort((a, b) => {
      const dateA = new Date(a.postedAt).getTime();
      const dateB = new Date(b.postedAt).getTime();
      return sortBy === 'recentes' ? dateB - dateA : dateA - dateB;
    });

    // Sort sponsored jobs to the top
    result.sort((a, b) => {
      if (a.isSponsored && !b.isSponsored) return -1;
      if (!a.isSponsored && b.isSponsored) return 1;
      return 0;
    });

    return result;
  }, [jobs, searchTerm, workModelFilter, typeFilter, sortBy]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, workModelFilter, typeFilter, sortBy]);

  const totalPages = Math.ceil(filteredAndSortedJobs.length / ITEMS_PER_PAGE) || 1;
  const currentJobs = filteredAndSortedJobs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 py-8 md:py-12 mt-16">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="font-serif text-3xl md:text-5xl font-bold text-stone-900 mb-2">Todas as Vagas</h1>
            <p className="text-stone-600">Encontre a sua próxima oportunidade em Pirassununga e Região.</p>
          </div>
        </div>

        {/* Filters and Search Section */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200 mb-8 space-y-6">
          
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Buscar por cargo, empresa, localização ou palavra-chave..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold tracking-widest text-stone-500 uppercase">Regime</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {(['TODOS', 'Presencial', 'Híbrido', 'Remoto'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setWorkModelFilter(m)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                      workModelFilter === m 
                        ? 'bg-terracotta-100 text-terracotta-800 shadow-sm' 
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {m === 'TODOS' ? 'Todos' : m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold tracking-widest text-stone-500 uppercase">Contrato</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {(['TODOS', 'CLT', 'PJ', 'Estágio', 'Freelancer', 'Temporário'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setTypeFilter(m)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                      typeFilter === m 
                        ? 'bg-terracotta-100 text-terracotta-800 shadow-sm' 
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {m === 'TODOS' ? 'Todos' : m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 ml-auto">
              <span className="text-xs font-bold tracking-widest text-stone-500 uppercase">Ordenar por</span>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recentes' | 'antigas')}
                className="bg-stone-100 border-none rounded-xl px-4 py-1.5 text-sm font-medium text-stone-700 focus:ring-2 focus:ring-terracotta-500 cursor-pointer"
              >
                <option value="recentes">Mais Recentes</option>
                <option value="antigas">Mais Antigas</option>
              </select>
            </div>

          </div>
        </div>

        {/* Results Section */}
        <div className="mb-4">
          <h2 className="text-sm font-bold text-stone-500">
            {filteredAndSortedJobs.length} {filteredAndSortedJobs.length === 1 ? 'vaga encontrada' : 'vagas encontradas'}
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-terracotta-600" />
          </div>
        ) : filteredAndSortedJobs.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-stone-200">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-stone-400" />
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-2">Nenhuma vaga encontrada</h3>
            <p className="text-stone-500">
              Não encontramos vagas que correspondam aos seus filtros. Tente remover alguns filtros ou buscar por termos diferentes.
            </p>
            <button 
              onClick={() => {
                setSearchTerm('');
                setWorkModelFilter('TODOS');
                setTypeFilter('TODOS');
              }}
              className="mt-6 text-terracotta-600 font-bold hover:text-terracotta-700"
            >
              Limpar todos os filtros
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {currentJobs.map(job => (
              <JobCard key={job.id} job={job} hasApplied={myApplications.includes(job.id)} onClick={() => job.slug ? navigate(`/vagas/${job.slug}`) : setSelectedJob(job)} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {filteredAndSortedJobs.length > 0 && (
          <div className="flex items-center justify-between mt-8 bg-white p-4 rounded-2xl border border-stone-200">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <span className="text-sm font-bold text-stone-600">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Próxima <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </main>

      {/* Job Details Modal */}
      {selectedJob && (
        <JobModal 
          job={selectedJob} 
          hasApplied={myApplications.includes(selectedJob.id)}
          onClose={() => setSelectedJob(null)} 
          onApply={() => handleApply(selectedJob)}
        />
      )}
    </div>
  );
}
