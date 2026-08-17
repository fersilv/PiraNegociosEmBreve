import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Briefcase, MapPin, DollarSign, Calendar, Building2, ArrowLeft, CheckCircle2, Loader2, AlertCircle, Clock, Laptop } from 'lucide-react';
import { ApplicationChat } from '../components/ApplicationChat';

export function CandidateJobViewPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [job, setJob] = useState<any | null>(null);
  const [application, setApplication] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const statusLabel: Record<string, string> = {
    PENDING: 'Candidatura enviada',
    REVIEWING: 'Em análise',
    DOCUMENTS_REQUESTED: 'Documentos solicitados',
    DOCUMENTS_SUBMITTED: 'Documentos em análise',
    HIRED: 'Contratado(a)',
    REJECTED: 'Encerrada',
    WITHDRAWN: 'Desistência confirmada',
  };

  useEffect(() => {
    loadJobAndApplication();
  }, [jobId, user]);

  const loadJobAndApplication = async () => {
    if (!jobId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      // Fetch Job
      const jobRes = await api.get(`/jobs/${jobId}`).catch(() => null);
      if (!jobRes || !jobRes.data) {
        setErrorMsg('Vaga não encontrada.');
        setLoading(false);
        return;
      }
      setJob(jobRes.data);

      // Fetch candidate application if logged in
      if (user) {
        const appRes = await api.get('/applications/me').catch(() => null);
        if (appRes && Array.isArray(appRes.data)) {
          setApplication(appRes.data.find((item: any) => item.jobId === jobId) || null);
        }
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg('Erro ao carregar detalhes da vaga.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!user) {
      navigate(`/login?returnTo=${encodeURIComponent(`/dashboard/vaga-detalhes/${jobId}`)}`);
      return;
    }

    if (profile?.type !== 'CANDIDATE') {
      alert('Apenas candidatos podem se candidatar a vagas.');
      return;
    }

    if (!profile.resumeURL?.trim()) {
      alert('Para se candidatar, envie seu currículo no perfil. Você será direcionado agora.');
      navigate('/dashboard/perfil');
      return;
    }

    setApplying(true);
    try {
      const response = await api.post('/applications', {
        jobId: job.id,
        resumeURL: profile.resumeURL || ''
      });

      setApplication(response.data);
      alert('Candidatura realizada com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao realizar candidatura. Tente novamente.');
    } finally {
      setApplying(false);
    }
  };

  const handleWithdraw = async () => {
    if (!application) return;
    if (confirm('Tem certeza que deseja desistir desta vaga?')) {
      try {
        await api.delete(`/applications/${application.id}`);
        setApplication(null);
        alert('Candidatura cancelada com sucesso.');
      } catch (e) {
        console.error(e);
        alert('Erro ao cancelar candidatura.');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-terracotta-500" />
      </div>
    );
  }

  if (errorMsg || !job) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-xs space-y-4">
          <div className="text-6xl font-serif font-bold text-stone-300">404</div>
          <h2 className="text-xl font-bold text-stone-900">Página Não Encontrada</h2>
          <p className="text-stone-500 text-xs leading-relaxed">
            A vaga solicitada não existe ou foi removida.
          </p>
          <Link to="/dashboard" className="bg-stone-900 hover:bg-stone-800 text-white font-bold px-6 py-2.5 rounded-xl transition-colors inline-block text-xs">
            Voltar ao Painel
          </Link>
        </div>
      </div>
    );
  }

  // Access control for inactive jobs:
  // If job is inactive, candidate MUST have an active application to view it.
  const isJobActive = job.active !== false;
  const isCandidateActive = application && application.status !== 'Não Classificado' && application.status !== 'Desistiu';

  if (!isJobActive && !isCandidateActive) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-xs space-y-4">
          <div className="text-6xl font-serif font-bold text-stone-300">404</div>
          <h2 className="text-xl font-bold text-stone-900">Página Não Encontrada</h2>
          <p className="text-stone-500 text-xs leading-relaxed">
            Esta vaga foi encerrada para novas candidaturas e não está mais disponível.
          </p>
          <Link to="/dashboard" className="bg-stone-900 hover:bg-stone-800 text-white font-bold px-6 py-2.5 rounded-xl transition-colors inline-block text-xs">
            Voltar ao Painel
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="w-10 h-10 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-full flex items-center justify-center transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="text-stone-500 text-sm font-medium">Voltar para candidaturas</span>
      </div>

      {/* HIRING / DOCUMENTATION CALLOUT BANNER */}
      {(application?.status === 'Em Contratação' || application?.status === 'Aguardando Exame Médico' || (application?.status && (application.status.toLowerCase().includes('contrat') || application.status.toLowerCase().includes('exame') || application.status.toLowerCase().includes('documento')))) && (
        <div className="bg-gradient-to-r from-blue-900 via-stone-900 to-blue-950 text-white p-6 md:p-8 rounded-3xl shadow-lg border border-blue-800 space-y-4 animate-in fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" /> Fase de Admissão / Exame Médico
              </span>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-white mt-1">
                {application?.status === 'Aguardando Exame Médico' ? 'Aguardando Exame Médico / ASO' : 'A empresa solicitou sua documentação!'}
              </h2>
              <p className="text-stone-300 text-sm">
                Envie seus documentos de admissão e o Atestado de Saúde Ocupacional (ASO) para finalizar sua contratação.
              </p>
            </div>

            <Link
              to={`/dashboard/admissao/${application.id}`}
              className="bg-amber-400 hover:bg-amber-300 text-stone-900 font-bold px-6 py-3.5 rounded-xl shadow-md transition-all flex items-center gap-2 text-sm shrink-0"
            >
              Acessar Área de Documentos / ASO
            </Link>
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-stone-100 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-stone-100 text-stone-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                {job.type || 'CLT'}
              </span>
              <span className="bg-terracotta-50 text-terracotta-800 border border-terracotta-200 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Laptop className="w-3.5 h-3.5" />
                {job.workModel || 'Presencial'}
              </span>
              {!isJobActive && (
                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Seleção Encerrada
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-stone-900">{job.title}</h1>
            <p className="text-terracotta-700 font-bold text-lg mt-1 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-stone-400" />
              {job.isConfidential ? 'Empresa Confidencial' : job.companyName}
            </p>
          </div>

          {/* Action button */}
          <div className="w-full md:w-auto">
            {application ? (
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-bold text-stone-900">Você já se candidatou</span>
                </div>
                <div className="text-xs text-stone-500 font-medium">
                  Status atual: <span className="font-bold text-stone-800">{statusLabel[application.status] || application.status || 'Candidatura enviada'}</span>
                </div>
                {(application.documentsRequested || ['DOCUMENTS_REQUESTED', 'DOCUMENTS_SUBMITTED'].includes(application.status)) && (
                  <Link
                    to={`/dashboard/admissao/${application.id}`}
                    className="mt-2 bg-terracotta-600 hover:bg-terracotta-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl text-center transition-colors shadow-sm animate-pulse"
                  >
                    Enviar Documentos / ASO
                  </Link>
                )}
                {!['REJECTED', 'WITHDRAWN', 'HIRED'].includes(application.status) && (
                  <button
                    onClick={handleWithdraw}
                    className="mt-1 text-red-600 hover:text-red-700 font-bold text-xs text-center transition-colors"
                  >
                    Desistir da Candidatura
                  </button>
                )}
              </div>
            ) : isJobActive && job.acceptsPlatformApplications !== false ? (
              <button
                onClick={handleApply}
                disabled={applying}
                className="w-full md:w-auto bg-terracotta-600 hover:bg-terracotta-700 text-white font-bold py-3.5 px-8 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {applying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Briefcase className="w-5 h-5" />
                    Candidatar-se Agora
                  </>
                )}
              </button>
            ) : isJobActive ? (
              <div className="w-full md:w-auto bg-amber-50 border border-amber-200 text-amber-900 font-medium py-3.5 px-5 rounded-xl text-sm max-w-xl">
                <p className="font-bold">Esta empresa recebe currículos fora da plataforma.</p>
                <p className="mt-1 whitespace-pre-wrap">{job.externalApplicationInstructions || 'Consulte a empresa para saber como enviar o currículo.'}</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-100">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-stone-400 shrink-0" />
            <div>
              <p className="text-[10px] font-bold uppercase text-stone-400">Localização</p>
              <p className="text-sm font-bold text-stone-800">{job.location || 'Não informada'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Laptop className="w-5 h-5 text-stone-400 shrink-0" />
            <div>
              <p className="text-[10px] font-bold uppercase text-stone-400">Regime / Modelo</p>
              <p className="text-sm font-bold text-stone-800">{job.workModel || 'Presencial'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-stone-400 shrink-0" />
            <div>
              <p className="text-[10px] font-bold uppercase text-stone-400">Salário / Remuneração</p>
              <p className="text-sm font-bold text-stone-800">{job.salary || 'A combinar'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-stone-400 shrink-0" />
            <div>
              <p className="text-[10px] font-bold uppercase text-stone-400">Publicado Em</p>
              <p className="text-sm font-bold text-stone-800">
                {job.postedAt ? new Date(job.postedAt).toLocaleDateString() : 'Recente'}
              </p>
            </div>
          </div>
        </div>

        {/* Job Deadline if present */}
        {job.deadlineDate && (
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200/60 flex items-center gap-3 text-amber-900 text-sm">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Prazo limite para recebimento de candidaturas: <strong>{new Date(job.deadlineDate).toLocaleDateString()}</strong></span>
          </div>
        )}

        {/* Description */}
        <div>
          <h2 className="text-lg font-bold text-stone-900 mb-3">Descrição da Vaga</h2>
          <div className="text-stone-700 leading-relaxed whitespace-pre-wrap text-sm md:text-base">
            {job.description || 'Nenhuma descrição fornecida.'}
          </div>
        </div>

        {application && (application.documentsRequested || ['DOCUMENTS_REQUESTED', 'DOCUMENTS_SUBMITTED', 'HIRED'].includes(application.status)) && (
          <ApplicationChat
            applicationId={application.id}
            documentOptions={(application.customDocs || []).map((document: any) => ({ id: document.id, name: document.name }))}
            onApplicationUpdated={loadJobAndApplication}
          />
        )}
      </div>
    </div>
  );
}
