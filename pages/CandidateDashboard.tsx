import React, { useState, useEffect } from 'react';
import { useAuth, getGreetingName } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { Briefcase, FileText, Sparkles, Loader2, ArrowRight, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { openBase64InNewTab } from '../lib/fileViewer';
import { Link } from 'react-router-dom';

export function CandidateDashboard() {
  const { user, profile } = useAuth();
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [jobsMap, setJobsMap] = useState<Record<string, any>>({});
  
  const [loadingApps, setLoadingApps] = useState(true);
  
  const [matching, setMatching] = useState(false);
  const [matchResults, setMatchResults] = useState<any[] | null>(null);
  const [matchError, setMatchError] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    setLoadingApps(true);
    try {
      await fetchJobsMap();
      const res = await api.get('/applications/me');
      setMyApplications(res.data || []);
    } catch (err) {
      console.error('Error fetching applications:', err);
    } finally {
      setLoadingApps(false);
    }
  };

  const handleWithdraw = async (appId: string) => {
    if (confirm('Tem certeza que deseja desistir desta candidatura? Isso não pode ser desfeito.')) {
      try {
        await api.delete(`/applications/${appId}`);
        alert('Candidatura cancelada com sucesso.');
        fetchDashboardData();
      } catch (e) {
        console.error(e);
        alert('Erro ao cancelar candidatura.');
      }
    }
  };

  const fetchJobsMap = async () => {
    try {
      const res = await api.get('/jobs');
      const map: Record<string, any> = {};
      (res.data || []).forEach((job: any) => {
        map[job.id] = job;
      });
      setJobsMap(map);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMatchAI = async () => {
    if (!user) return;
    setMatching(true);
    setMatchError('');
    try {
      const activeJobs = Object.values(jobsMap);
      if (activeJobs.length === 0) {
        setMatchError('Nenhuma vaga disponível no momento para analisar.');
        return;
      }

      const response = await fetch('/api/gemini/job-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ profile, jobs: activeJobs, applications: myApplications }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível gerar recomendações.');
      setMatchResults(data.matches);

    } catch (err: any) {
      console.error(err);
      setMatchError(err.response?.data?.error || err.message || 'Erro ao processar as recomendações.');
    } finally {
      setMatching(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-stone-900">Meu Painel</h1>
        <p className="text-stone-500 mt-1">Bem-vindo, {getGreetingName(profile)}</p>
      </div>

      {/* PENDING DOCUMENTATION URGENT BANNER */}
      {myApplications.some(a => a.documentsRequested || a.status === 'Em Contratação' || a.status === 'Aguardando Exame Médico' || (a.status && (a.status.toLowerCase().includes('contrat') || a.status.toLowerCase().includes('documento') || a.status.toLowerCase().includes('exame') || a.status.toLowerCase().includes('admiss')))) && (
        <div className="bg-gradient-to-r from-blue-900 via-stone-900 to-blue-950 text-white p-6 md:p-8 rounded-3xl shadow-lg border border-blue-800 space-y-4 animate-in fade-in">
          {myApplications.filter(a => a.documentsRequested || a.status === 'Em Contratação' || a.status === 'Aguardando Exame Médico' || (a.status && (a.status.toLowerCase().includes('contrat') || a.status.toLowerCase().includes('documento') || a.status.toLowerCase().includes('exame') || a.status.toLowerCase().includes('admiss')))).map(app => (
            <div key={app.id} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-blue-800/50 last:border-0 pb-4 last:pb-0">
              <div className="space-y-1">
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-300" /> Ação Necessária: Envio de Documentos
                </span>
                <h2 className="text-xl md:text-2xl font-serif font-bold text-white mt-1">
                  {app.jobTitle}
                </h2>
                <p className="text-stone-300 text-sm">
                  A empresa <strong className="text-white">{app.companyName}</strong> iniciou seu processo de admissão e aguarda seus documentos.
                </p>
              </div>

              <Link
                to={`/dashboard/admissao/${app.id}`}
                className="bg-amber-400 hover:bg-amber-300 text-stone-900 font-bold px-6 py-3.5 rounded-xl shadow-md transition-all flex items-center gap-2 text-sm shrink-0"
              >
                Enviar Documentos de Admissão
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-terracotta-100 p-3 rounded-full text-terracotta-600">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Meu Currículo</h2>
              <p className="text-sm text-stone-500">Mantenha seu currículo atualizado</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => {
              if (profile?.resumeURL) {
                openBase64InNewTab(profile.resumeURL, `Meu_Currículo_${profile.socialName || profile.name || ''}`);
              } else {
                alert('Você ainda não fez o upload de seu currículo no seu perfil.');
              }
            }}
            className="w-full bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all"
          >
            <FileText className="w-4 h-4 text-terracotta-400" />
            Visualizar PDF do Meu Currículo
          </button>
        </div>
        
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-green-100 p-3 rounded-full text-green-600">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Candidaturas</h2>
              <p className="text-sm text-stone-500">Acompanhe seus processos</p>
            </div>
          </div>
          <div className="text-3xl font-serif font-bold text-stone-900">
            {myApplications.length}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Minhas Candidaturas</h2>
        {loadingApps ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-terracotta-500" />
          </div>
        ) : myApplications.length === 0 ? (
          <div className="bg-stone-100/50 border border-stone-200 border-dashed rounded-3xl p-12 text-center">
            <Briefcase className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-500">Você ainda não se candidatou a nenhuma vaga.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/80">
                    <th className="px-5 py-3.5 text-xs font-bold text-stone-500 uppercase tracking-wider">Vaga / Empresa</th>
                    <th className="px-5 py-3.5 text-xs font-bold text-stone-500 uppercase tracking-wider">Data de Inscrição</th>
                    <th className="px-5 py-3.5 text-xs font-bold text-stone-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3.5 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {myApplications.map(app => {
                    const statusText = app.status === 'Recusado' ? 'Não Classificado' : (app.status || 'Enviado');
                    const canWithdraw = statusText !== 'Não Classificado' && statusText !== 'Desistiu' && statusText !== 'Aprovado';
                    
                    const isDocStage = app.documentsRequested || app.status === 'Em Contratação' || app.status === 'Aguardando Exame Médico' || (app.status && (app.status.toLowerCase().includes('contrat') || app.status.toLowerCase().includes('documento') || app.status.toLowerCase().includes('exame') || app.status.toLowerCase().includes('admiss')));
                    const docs = app.onboardingDocs || {};
                    const uploadedDocCount = Object.values(docs).filter((d: any) => d.url).length;
                    const hasRejectedDoc = Object.values(docs).some((d: any) => d.status === 'rejected');
                    const isSubmitted = app.submittedForReview === true;

                    return (
                      <tr key={app.id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-bold text-stone-900">{app.jobTitle}</div>
                          <div className="text-xs text-stone-500">{app.companyName}</div>
                        </td>
                        <td className="px-5 py-4 text-xs text-stone-600 font-medium">
                          {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold inline-block ${
                              statusText === 'Aprovado' ? 'bg-green-100 text-green-800' :
                              statusText === 'Em Contratação' ? 'bg-blue-100 text-blue-800' :
                              statusText === 'Aguardando Exame Médico' ? 'bg-purple-100 text-purple-800' :
                              statusText === 'Não Classificado' ? 'bg-stone-200 text-stone-600' :
                              statusText === 'Entrevista' || statusText === 'Entrevista Agendada' ? 'bg-amber-100 text-amber-800' :
                              'bg-stone-100 text-stone-700'
                            }`}>
                              {statusText}
                            </span>

                            {isDocStage && (
                              <div className="text-[11px] font-semibold flex items-center gap-1.5 mt-1">
                                {hasRejectedDoc ? (
                                  <span className="text-red-600 flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded">
                                    <AlertTriangle className="w-3 h-3" /> Reenvio Solicitado
                                  </span>
                                ) : isSubmitted ? (
                                  <span className="text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded">
                                    <Clock className="w-3 h-3" /> Doc. Em Análise ({uploadedDocCount} anexados)
                                  </span>
                                ) : (
                                  <span className="text-amber-800 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded">
                                    <FileText className="w-3 h-3" /> Em Preenchimento ({uploadedDocCount} anexados)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {isDocStage && (
                              <Link 
                                to={`/dashboard/admissao/${app.id}`} 
                                className="bg-terracotta-600 text-white hover:bg-terracotta-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors animate-pulse flex items-center gap-1"
                              >
                                {isSubmitted && !hasRejectedDoc ? 'Ver Documentos' : 'Enviar Documentos'}
                              </Link>
                            )}
                            <Link 
                              to={`/dashboard/vaga-detalhes/${app.jobId}`} 
                              className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                            >
                              Ver Vaga
                            </Link>
                            {canWithdraw && (
                              <button
                                onClick={() => handleWithdraw(app.id)}
                                className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                              >
                                Desistir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-terracotta-50 to-orange-50 p-6 md:p-8 rounded-3xl border border-terracotta-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-serif font-bold text-stone-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-terracotta-600" />
              Recomendações Inteligentes
            </h2>
            <p className="text-stone-600 mt-1">
              Nossa Inteligência Artificial analisa seu currículo e sugere as melhores vagas para o seu perfil.
            </p>
          </div>
          <button
            onClick={handleMatchAI}
            disabled={matching}
            className="shrink-0 bg-terracotta-600 hover:bg-terracotta-700 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-all shadow-md disabled:opacity-70"
          >
            {matching ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                Descobrir Vagas Ideais
                <Sparkles className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {matchError && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 mb-6 text-sm">
            {matchError}
          </div>
        )}

        {matchResults && matchResults.length > 0 && (
          <div className="space-y-4 mt-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
            {matchResults.slice(0, 5).map((match, idx) => {
              const job = jobsMap[match.jobId];
              if (!job) return null;
              
              return (
                <div key={`${match.jobId}-${idx}`} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        {match.score}% Match
                      </span>
                      <h3 className="font-bold text-lg text-stone-900 line-clamp-1">{job.title}</h3>
                    </div>
                    <p className="text-terracotta-700 text-sm font-medium mb-3">{job.companyName}</p>
                    <p className="text-stone-600 text-sm leading-relaxed">
                      {match.reason}
                    </p>
                  </div>
                  <div className="flex items-center justify-end md:items-center shrink-0">
                    <Link 
                      to={`/?applyTo=${job.id}`}
                      className="group flex items-center gap-2 text-terracotta-600 font-bold hover:text-terracotta-800 transition-colors"
                    >
                      Ver Vaga
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
