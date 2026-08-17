import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Users, Filter, User, FileText, CheckCircle, CheckCircle2, XCircle, Clock, Eye, Briefcase, MapPin, Building2, Search, Edit, Phone, Laptop, AlertTriangle } from 'lucide-react';
import { sendNotificationToUser } from '../lib/notifications';
import { openBase64InNewTab } from '../lib/fileViewer';
import { CandidateProfileModal } from '../components/CandidateProfileModal';
import { ApplicationManagerModal } from '../components/ApplicationManagerModal';
import { CityStateSelector } from '../components/CityStateSelector';

export function CompanyJobPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<any | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'active' | 'rejected' | 'edit'>('overview');

  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [managingApp, setManagingApp] = useState<any | null>(null);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editSalary, setEditSalary] = useState('');
  const [editType, setEditType] = useState('CLT');
  const [editDescription, setEditDescription] = useState('');
  const [editIsConfidential, setEditIsConfidential] = useState(false);
  const [editIsTalentPool, setEditIsTalentPool] = useState(false);
  const [editAcceptsPlatformApplications, setEditAcceptsPlatformApplications] = useState(true);
  const [editExternalApplicationInstructions, setEditExternalApplicationInstructions] = useState('');
  const [savingJob, setSavingJob] = useState(false);

  useEffect(() => {
    if (user && jobId) {
      fetchJobData();
      fetchApplications();
    }
  }, [user, jobId]);

  const fetchJobData = async () => {
    if (!jobId) return;
    try {
      const response = await api.get(`/jobs/${jobId}`);
      if (response.data) {
        const data = response.data;
        if (data.ownerId !== user?.uid) {
          navigate('/dashboard'); // Not the owner
          return;
        }
        setJob({ id: data.id, ...data });
        
        // Init edit form
        setEditTitle(data.title || '');
        setEditLocation(data.location || '');
        setEditSalary(data.salary || '');
        setEditType(data.type || 'CLT');
        setEditDescription(data.description || '');
        setEditIsConfidential(data.isConfidential || false);
        setEditIsTalentPool(data.isTalentPool || false);
        setEditAcceptsPlatformApplications(data.acceptsPlatformApplications !== false);
        setEditExternalApplicationInstructions(data.externalApplicationInstructions || '');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error(error);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchApplications = async () => {
    if (!jobId) return;
    setLoadingApps(true);
    try {
      const response = await api.get(`/applications/job/${jobId}`);
      const apps = response.data || [];
      setApplications(apps);

      // If managing app modal is currently open, keep its state synced
      if (managingApp) {
        const updatedCurrent = apps.find((a: any) => a.id === managingApp.id);
        if (updatedCurrent) {
          setManagingApp(updatedCurrent);
        }
      }
    } catch (err) {
      console.error("Erro ao buscar candidaturas:", err);
    } finally {
      setLoadingApps(false);
    }
  };

  const handleUpdateStatus = async (appId: string, candidateId: string, newStatus: string) => {
    try {
      await api.put(`/applications/${appId}/status`, { status: newStatus });

      sendNotificationToUser(
        candidateId,
        'Atualização na sua candidatura',
        `Sua candidatura para a vaga "${job?.title}" foi atualizada para o status: ${newStatus}.`,
        'status_update',
        { jobId: job?.id, jobTitle: job?.title, companyName: job?.companyName || 'Empresa' }
      );

      fetchApplications();
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar status');
    }
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId) return;
    setSavingJob(true);
    try {
      await api.put(`/jobs/${jobId}`, {
        title: editTitle,
        location: editLocation,
        salary: editSalary,
        type: editType,
        description: editDescription,
        isConfidential: editIsConfidential,
        isTalentPool: editIsTalentPool,
        acceptsPlatformApplications: editAcceptsPlatformApplications,
        externalApplicationInstructions: editAcceptsPlatformApplications ? '' : editExternalApplicationInstructions,
      });
      alert('Vaga atualizada com sucesso!');
      fetchJobData();
      setActiveTab('overview');
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar vaga.');
    } finally {
      setSavingJob(false);
    }
  };

  const handleToggleJobActive = async () => {
    const newActiveState = job.active === false ? true : false;
    let newDeadline = job.deadlineDate;

    if (newActiveState) {
      // Re-opening job
      const changeDeadline = confirm('Deseja atualizar a data limite para recebimento de novas candidaturas?');
      if (changeDeadline) {
        const inputDate = prompt('Informe a nova data limite (Formato: AAAA-MM-DD):', new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
        if (inputDate) {
          newDeadline = inputDate;
        }
      }
    }

    try {
      await api.put(`/jobs/${jobId}`, {
        active: newActiveState,
        deadlineDate: newDeadline || null,
      });
      fetchJobData();
      alert(newActiveState ? 'Vaga reaberta com sucesso!' : 'Processo de contratação encerrado.');
    } catch (e) {
      console.error(e);
      alert('Erro ao atualizar status da vaga.');
    }
  };

  const handleDeleteJob = async () => {
    if (applications.length > 0) {
      alert('Não é possível excluir esta vaga pois ela possui candidatos vinculados. Você pode apenas encerrar a contratação.');
      return;
    }
    if (confirm('Tem certeza que deseja excluir esta vaga permanentemente?')) {
      try {
        await api.delete(`/jobs/${jobId}`);
        alert('Vaga excluída com sucesso.');
        navigate('/dashboard');
      } catch (e) {
        console.error(e);
        alert('Erro ao excluir vaga.');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-terracotta-500" />
      </div>
    );
  }

  if (!job) return null;

  const activeApps = applications.filter(app => app.status !== 'Não Classificado' && app.status !== 'Recusado');
  const rejectedApps = applications.filter(app => app.status === 'Não Classificado' || app.status === 'Recusado');

  const isJobActive = job.active !== false;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="w-10 h-10 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-full flex items-center justify-center transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-serif font-bold text-stone-900 flex items-center gap-2">
              {job.title}
              {job.isTalentPool && (
                <span className="bg-purple-100 text-purple-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded">Banco de Talentos</span>
              )}
            </h1>
            <p className="text-stone-500 text-sm flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>
              <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {job.type}</span>
              <span className="flex items-center gap-1"><Laptop className="w-3.5 h-3.5" /> {job.workModel || 'Presencial'}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isJobActive ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                {isJobActive ? 'Captação Ativa' : 'Contratação Encerrada'}
              </span>
            </p>
          </div>
        </div>

        {/* Action Buttons inside Job Page */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleToggleJobActive}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              isJobActive 
                ? 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isJobActive ? 'Fechar Contratação' : 'Reabrir Processo Seletivo'}
          </button>

          <button
            onClick={handleDeleteJob}
            disabled={applications.length > 0}
            title={applications.length > 0 ? "Não é possível excluir vaga com candidatos" : "Excluir vaga"}
            className="bg-red-50 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed text-red-600 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
          >
            Excluir Vaga
          </button>
        </div>
      </div>

      <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
        {[
          { id: 'overview', label: 'Visão Geral', icon: Eye },
          { id: 'active', label: `Candidatos Ativos (${activeApps.length})`, icon: Users },
          { id: 'rejected', label: `Excluídos (${rejectedApps.length})`, icon: XCircle },
          { id: 'edit', label: 'Editar Vaga', icon: Edit }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
              activeTab === tab.id 
                ? 'bg-terracotta-600 text-white shadow-sm' 
                : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-stone-200 rounded-3xl p-6 md:p-8 min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100">
                <div className="text-stone-500 mb-2 flex items-center gap-2 font-medium">
                  <Users className="w-5 h-5" />
                  Total de Candidatos
                </div>
                <div className="text-4xl font-serif font-bold text-stone-900">{applications.length}</div>
              </div>
              <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
                <div className="text-green-700 mb-2 flex items-center gap-2 font-medium">
                  <CheckCircle className="w-5 h-5" />
                  Em Processo
                </div>
                <div className="text-4xl font-serif font-bold text-green-900">{activeApps.length}</div>
              </div>
              <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                <div className="text-red-700 mb-2 flex items-center gap-2 font-medium">
                  <XCircle className="w-5 h-5" />
                  Recusados
                </div>
                <div className="text-4xl font-serif font-bold text-red-900">{rejectedApps.length}</div>
              </div>
            </div>
            
            <div className="bg-stone-50 p-6 rounded-2xl">
              <h3 className="font-bold text-lg mb-4">Descrição da Vaga</h3>
              <div className="prose prose-sm text-stone-600 max-w-none whitespace-pre-wrap">
                {job.description}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'edit' && (
          <form onSubmit={handleSaveJob} className="space-y-6 animate-in fade-in max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Título da Vaga *</label>
                <input required value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white" placeholder="Ex: Desenvolvedor Front-end" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Localização *</label>
                <CityStateSelector onLocationChange={setEditLocation} initialValue={editLocation} />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Salário</label>
                <input value={editSalary} onChange={(e) => setEditSalary(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white" placeholder="Ex: R$ 2.000 ou A combinar" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Tipo de Contrato</label>
                <select value={editType} onChange={(e) => setEditType(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white">
                  <option value="CLT">CLT</option>
                  <option value="PJ">PJ</option>
                  <option value="Estágio">Estágio</option>
                  <option value="Freelance">Freelance</option>
                  <option value="Temporário">Temporário</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Descrição *</label>
                <textarea required value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={6} className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white" placeholder="Descreva as atividades, requisitos e benefícios da vaga..." />
              </div>
              <div className="md:col-span-2 flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={editIsConfidential} onChange={(e) => setEditIsConfidential(e.target.checked)} className="w-5 h-5 rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500" />
                  <span className="text-sm font-medium text-stone-700">Vaga Confidencial (Ocultar nome da empresa)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={editIsTalentPool} onChange={(e) => setEditIsTalentPool(e.target.checked)} className="w-5 h-5 rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500" />
                  <span className="text-sm font-medium text-stone-700">Banco de Talentos (Sem vaga específica no momento)</span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-stone-200 p-3 bg-stone-50">
                  <input type="checkbox" checked={editAcceptsPlatformApplications} onChange={(e) => setEditAcceptsPlatformApplications(e.target.checked)} className="w-5 h-5 mt-0.5 rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500" />
                  <span className="text-sm font-medium text-stone-700">Receber candidaturas pela plataforma</span>
                </label>
                {!editAcceptsPlatformApplications && (
                  <textarea required value={editExternalApplicationInstructions} onChange={(e) => setEditExternalApplicationInstructions(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white" placeholder="Informe e-mail, site, WhatsApp ou local para entrega do currículo." />
                )}
              </div>
            </div>
            <div className="pt-4 border-t border-stone-100 flex justify-end">
              <button 
                type="submit" 
                disabled={savingJob}
                className="bg-terracotta-600 hover:bg-terracotta-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center transition-all shadow-md"
              >
                {savingJob ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        )}

        {/* Candidatos Ativos Table */}
        {activeTab === 'active' && (
          <div className="animate-in fade-in">
            {loadingApps ? (
              <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-terracotta-500" /></div>
            ) : activeApps.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-6 h-6 text-stone-400" />
                </div>
                <h3 className="text-lg font-bold text-stone-800">Nenhum candidato em processo</h3>
                <p className="text-stone-500 mt-1">Os candidatos que se aplicarem aparecerão aqui.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200">
                      <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase tracking-wider">Candidato</th>
                      <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase tracking-wider">Data de Inscrição</th>
                      <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase tracking-wider">Status da Triagem</th>
                      <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {activeApps.map(app => (
                      <tr key={app.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-4">
                          <div className="font-bold text-stone-900">{app.candidateName}</div>
                          {app.candidateProfile?.email && <div className="text-xs text-stone-500">{app.candidateProfile.email}</div>}
                          {app.candidateProfile?.phone && (
                            <a href={`https://wa.me/${app.candidateProfile.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 mt-1 font-medium">
                               <Phone className="w-3 h-3" /> {app.candidateProfile.phone}
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-stone-600">
                          {new Date(app.appliedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              app.status === 'Aprovado' ? 'bg-green-50 text-green-700 border-green-200' :
                              app.status === 'Recusado' ? 'bg-red-50 text-red-700 border-red-200' :
                              app.status === 'Em Contratação' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              app.status === 'Aguardando Exame Médico' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              'bg-stone-100 text-stone-700 border-stone-200'
                            }`}>
                              {app.status || 'Enviado'}
                            </span>
                            
                            {app.priority && app.priority !== 'Normal' && (
                              <span className={`text-[10px] font-bold uppercase ${
                                app.priority === 'Alta' || app.priority === 'Urgente' ? 'text-red-600' : 'text-amber-600'
                              }`}>
                                Prioridade: {app.priority}
                              </span>
                            )}

                            {/* Document progress badge */}
                            {(() => {
                              const docs = app.onboardingDocs || {};
                              const docValues: any[] = Object.values(docs);
                              const uploadedCount = docValues.filter(d => d.url).length;
                              const approvedCount = docValues.filter(d => d.status === 'approved').length;
                              const rejectedCount = docValues.filter(d => d.status === 'rejected').length;
                              const isDocStage = app.documentsRequested || app.status === 'Em Contratação' || app.status === 'Aguardando Exame Médico' || (app.status && (app.status.toLowerCase().includes('contrat') || app.status.toLowerCase().includes('exame') || app.status.toLowerCase().includes('documento')));

                              if (!isDocStage && uploadedCount === 0) return null;

                              if (rejectedCount > 0) {
                                return (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md mt-1">
                                    <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                                    Docs: {rejectedCount} Rejeitado(s)
                                  </span>
                                );
                              }

                              if (approvedCount > 0 && approvedCount >= uploadedCount && uploadedCount > 0) {
                                return (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-800 bg-green-50 border border-green-200 px-2 py-0.5 rounded-md mt-1">
                                    <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0" />
                                    Docs: {approvedCount} Aprovado(s)
                                  </span>
                                );
                              }

                              if (app.submittedForReview) {
                                return (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md mt-1">
                                    <Clock className="w-3 h-3 text-blue-600 shrink-0" />
                                    Docs: Em Análise ({uploadedCount} enviados)
                                  </span>
                                );
                              }

                              if (uploadedCount > 0) {
                                return (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md mt-1">
                                    <FileText className="w-3 h-3 text-amber-600 shrink-0" />
                                    Docs: Preenchendo ({uploadedCount} anexados)
                                  </span>
                                );
                              }

                              return (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-stone-500 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-md mt-1">
                                  <Clock className="w-3 h-3 text-stone-400 shrink-0" />
                                  Docs: Aguardando envio
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-4 flex justify-end gap-2">
                          {app.candidateProfile && (
                            <button
                              onClick={() => {
                                setSelectedCandidate(app.candidateProfile);
                                setIsCandidateModalOpen(true);
                              }}
                              className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors"
                              title="Ver Perfil"
                            >
                              <User className="w-4 h-4" />
                            </button>
                          )}
                          {app.resumeURL && (
                            <button
                              onClick={() => openBase64InNewTab(app.resumeURL, `Currículo_${app.candidateName}`)}
                              className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors"
                              title="Ver Currículo (PDF)"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setManagingApp(app)}
                            className="px-3 py-1.5 rounded-lg bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-700 text-xs font-bold transition-colors"
                          >
                            Gerenciar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Candidatos Rejeitados Table */}
        {activeTab === 'rejected' && (
          <div className="animate-in fade-in">
            {loadingApps ? (
              <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-terracotta-500" /></div>
            ) : rejectedApps.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-6 h-6 text-stone-400" />
                </div>
                <h3 className="text-lg font-bold text-stone-800">Nenhum candidato excluído</h3>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200">
                      <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase tracking-wider">Candidato</th>
                      <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase tracking-wider">Data de Inscrição</th>
                      <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {rejectedApps.map(app => (
                      <tr key={app.id} className="hover:bg-red-50/30 transition-colors">
                        <td className="px-4 py-4 opacity-75">
                          <div className="font-bold text-stone-900">{app.candidateName}</div>
                          {app.candidateProfile?.email && <div className="text-xs text-stone-500">{app.candidateProfile.email}</div>}
                        </td>
                        <td className="px-4 py-4 text-sm text-stone-500">
                          {new Date(app.appliedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4 flex justify-end gap-2">
                          <button
                            onClick={() => handleUpdateStatus(app.id, app.candidateId, 'Enviado')}
                            className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" /> Recuperar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <CandidateProfileModal
        candidate={selectedCandidate}
        isOpen={isCandidateModalOpen}
        onClose={() => {
          setSelectedCandidate(null);
          setIsCandidateModalOpen(false);
        }}
      />
      
      {managingApp && (
        <ApplicationManagerModal 
          application={managingApp} 
          onClose={() => setManagingApp(null)} 
          onUpdated={() => {
             fetchApplications();
          }} 
        />
      )}
    </div>
  );
}
