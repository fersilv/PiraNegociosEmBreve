import React, { useState, useEffect } from 'react';
import { useAuth, getGreetingName } from '../contexts/AuthContext';
import { api, asArray } from '../lib/api';
import { Plus, Briefcase, FileText, CheckCircle, BellRing, AlertTriangle, ArrowRight, EyeOff, User, Loader2, Clock, Building2, Users } from 'lucide-react';
import { sendNotificationToUser, notifyCandidatesOfNewJob } from '../lib/notifications';
import { Link, useNavigate } from 'react-router-dom';
import { openBase64InNewTab } from '../lib/fileViewer';
import { CandidateProfileModal } from '../components/CandidateProfileModal';
import { CityStateSelector } from '../components/CityStateSelector';

export function CompanyDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isPosting, setIsPosting] = useState(false);
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  
  // Job Form
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [salary, setSalary] = useState('');
  const [type, setType] = useState('CLT');
  const [workModel, setWorkModel] = useState('Presencial');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [isConfidential, setIsConfidential] = useState(false);
  const [isTalentPool, setIsTalentPool] = useState(false);
  const [acceptsPlatformApplications, setAcceptsPlatformApplications] = useState(true);
  const [externalApplicationInstructions, setExternalApplicationInstructions] = useState('');
  
  const [loadingJobs, setLoadingJobs] = useState(true);

  const toggleJobActive = async (jobId: string, currentActive: boolean) => {
    try {
      await api.put(`/jobs/${jobId}`, { active: !currentActive });
      fetchMyJobs();
    } catch (e) {
      console.error(e);
      alert('Erro ao atualizar status da vaga.');
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      if (confirm('Tem certeza que deseja excluir esta vaga?')) {
        await api.delete(`/jobs/${jobId}`);
        fetchMyJobs();
      }
    } catch (e: any) {
      console.error(e);
      alert(e.response?.data?.message || 'Erro ao excluir vaga.');
    }
  };

  const fetchMyJobs = async () => {
    setLoadingJobs(true);
    try {
      const res = await api.get('/jobs/me');
      setMyJobs(asArray(res.data));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingJobs(false);
    }
  };

  const fetchCompanyDetails = async () => {
    if (!user) return;
    try {
      const res = await api.get('/companies/mine');
      const comp = Array.isArray(res.data) ? res.data[0] : res.data;
      setCompany(comp);
    } catch (err) {
      console.error("Erro ao buscar detalhes da empresa:", err);
    } finally {
      setLoadingCompany(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMyJobs();
      fetchCompanyDetails();
    }
  }, [user, profile]);

  const hasBasicInfo = () => {
    if (loadingCompany) return true; // Keep button enabled while loading to avoid layout shifting
    if (!company) return false;
    return (
      company.name && company.name.trim() !== '' &&
      company.address && company.address.trim() !== '' &&
      company.phone && company.phone.trim() !== ''
    );
  };

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!hasBasicInfo()) {
      alert('Sua empresa precisa ter Nome, Endereço e Telefone cadastrados para poder anunciar vagas!');
      return;
    }
    
    try {
      const companyName = company?.name || profile?.companyName || profile?.name || 'Empresa';
      const isVerified = company?.verificationStatus === 'VERIFIED' || company?.isVerified === true;
      
      const res = await api.post('/jobs', {
        companyId: company?.id || profile?.companyId,
        title,
        location,
        salary,
        type,
        workModel: workModel || 'Presencial',
        description,
        requirements,
        isConfidential,
        isTalentPool,
        acceptsPlatformApplications,
        externalApplicationInstructions: acceptsPlatformApplications ? '' : externalApplicationInstructions,
      });
      
      // Notify all matching/active candidates of the new job
      try {
        await notifyCandidatesOfNewJob(res.data.id, title, isConfidential ? 'Empresa Confidencial' : companyName, location);
      } catch (notifErr) {
        console.error("Failed to trigger FCM notifications for new job:", notifErr);
      }

      setIsPosting(false);
      // Clean form
      setTitle('');
      setLocation('');
      setSalary('');
      setType('CLT');
      setWorkModel('Presencial');
      setDescription('');
      setRequirements('');
      setIsConfidential(false);
      setIsTalentPool(false);
      setAcceptsPlatformApplications(true);
      setExternalApplicationInstructions('');
      
      fetchMyJobs();
      alert('Vaga publicada com sucesso! Candidatos compatíveis estão sendo notificados.');
    } catch (err) {
      console.error(err);
      alert('Erro ao publicar vaga');
    }
  };

  if (loadingCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-terracotta-600" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-stone-200 text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-terracotta-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-terracotta-600">
            <Building2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-serif font-bold text-stone-900 mb-4">
            Módulo Empresa
          </h2>
          <p className="text-stone-500 text-lg leading-relaxed mb-8">
            Anuncie suas vagas, construa um banco de currículos exclusivo e gerencie todo o processo de atração de talentos de forma simples e profissional.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-left">
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100">
              <h4 className="font-bold text-stone-900 mb-1 flex items-center gap-2"><Briefcase className="w-4 h-4 text-terracotta-500" /> Vagas Ilimitadas</h4>
              <p className="text-sm text-stone-500">Publique quantas vagas quiser gratuitamente.</p>
            </div>
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100">
              <h4 className="font-bold text-stone-900 mb-1 flex items-center gap-2"><Users className="w-4 h-4 text-terracotta-500" /> Banco de Talentos</h4>
              <p className="text-sm text-stone-500">Acesso aos currículos recebidos e perfis salvos.</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/dashboard/empresa')}
            className="w-full sm:w-auto bg-terracotta-600 hover:bg-terracotta-700 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md mx-auto"
          >
            <Plus className="w-5 h-5" />
            Cadastrar Minha Empresa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Required basic info banner */}
      {!hasBasicInfo() && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex items-start gap-4 text-amber-900 animate-in fade-in duration-300">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm">Dados Básicos da Empresa Ausentes!</h4>
            <p className="text-amber-800 text-xs mt-1 leading-relaxed">
              Para garantir a segurança dos candidatos, a legislação exige que a empresa tenha pelo menos <strong>Nome, Endereço e Telefone</strong> cadastrados para poder publicar uma nova vaga de emprego.
            </p>
            <Link 
              to="/dashboard/empresa" 
              className="text-terracotta-700 hover:text-terracotta-900 font-bold text-xs underline mt-3 flex items-center gap-1.5"
            >
              Preencher dados no Perfil da Empresa
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Analysis pending banner */}
      {!loadingCompany && hasBasicInfo() && company?.verificationStatus === 'PENDING' && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex items-start gap-4 text-amber-900 animate-in fade-in duration-300">
          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm">Empresa em Processo de Análise</h4>
            <p className="text-amber-800 text-xs mt-1 leading-relaxed">
              O perfil da sua empresa foi enviado e está em análise pela nossa equipe. Você já pode criar suas vagas, mas elas ganharão o selo de <strong>"Empresa Verificada"</strong> assim que a análise for concluída!
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-stone-900">Visão Geral</h1>
          <p className="text-stone-500 mt-1">Bem-vindo, {company?.name || (profile as any)?.companyName || profile?.name}</p>
        </div>
        <button 
          onClick={() => {
            if (!hasBasicInfo()) {
              alert('Por favor, preencha o Nome, Endereço e Telefone da empresa nas configurações do Perfil da Empresa para poder publicar vagas.');
              return;
            }
            setIsPosting(true);
          }}
          disabled={!loadingCompany && !hasBasicInfo()}
          className="bg-terracotta-600 hover:bg-terracotta-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md"
        >
          <Plus className="w-5 h-5" />
          Publicar Vaga
        </button>
      </div>

      {isPosting && (
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-stone-200">
          <h2 className="text-xl font-bold mb-6">Nova Vaga</h2>
          <form onSubmit={handlePostJob} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Título da Vaga *</label>
                <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Localização *</label>
                <CityStateSelector onLocationChange={setLocation} initialValue={location} />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Salário</label>
                <input value={salary} onChange={(e) => setSalary(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500" placeholder="Ex: R$ 2.000 ou A combinar" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Tipo de Contrato</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white">
                  <option value="CLT">CLT</option>
                  <option value="PJ">PJ</option>
                  <option value="Estágio">Estágio</option>
                  <option value="Freelancer">Freelancer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Regime de Trabalho (Modelo)</label>
                <select value={workModel} onChange={(e) => setWorkModel(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white">
                  <option value="Presencial">Presencial</option>
                  <option value="Híbrido">Híbrido</option>
                  <option value="Remoto">Remoto</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Sobre a vaga / atividades *</label>
              <textarea required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva as responsabilidades, rotina, benefícios e o que torna esta oportunidade interessante." className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 min-h-[120px]" />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Requisitos</label>
              <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="Ex.: experiência, escolaridade, conhecimentos técnicos, disponibilidade e habilidades desejadas." className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 min-h-[120px]" />
            </div>

            <div className="pt-2 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer rounded-2xl border border-stone-200 p-4 bg-stone-50/60">
                <input type="checkbox" checked={acceptsPlatformApplications} onChange={(e) => setAcceptsPlatformApplications(e.target.checked)} className="w-5 h-5 mt-0.5 rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500" />
                <div className="text-sm text-stone-700">
                  <strong>Receber candidaturas pela plataforma</strong>
                  <p className="text-xs text-stone-500 mt-1">Desative se quiser receber currículos por e-mail, WhatsApp, site próprio ou entrega presencial.</p>
                </div>
              </label>
              {!acceptsPlatformApplications && (
                <div className="pl-0 sm:pl-8">
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Como o candidato deve enviar ou entregar o currículo *</label>
                  <textarea required value={externalApplicationInstructions} onChange={(e) => setExternalApplicationInstructions(e.target.value)} placeholder="Ex.: Envie para vagas@empresa.com.br com o assunto da vaga, ou entregue na recepção de segunda a sexta." className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 min-h-[96px]" />
                </div>
              )}
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={isConfidential}
                  onChange={(e) => setIsConfidential(e.target.checked)}
                  className="w-5 h-5 rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500"
                />
                <div className="text-sm text-stone-700 flex items-center gap-1.5 font-medium">
                  <EyeOff className="w-4 h-4 text-stone-400" />
                  Divulgar esta vaga como <strong>Empresa Confidencial</strong>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={isTalentPool}
                  onChange={(e) => setIsTalentPool(e.target.checked)}
                  className="w-5 h-5 rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500"
                />
                <div className="text-sm text-stone-700 flex items-center gap-1.5 font-medium">
                  <User className="w-4 h-4 text-stone-400" />
                  Vaga para <strong>Banco de Talentos</strong>
                </div>
              </label>
              <p className="text-xs text-stone-400 ml-8 mt-0.5">Essa opção serve apenas para captação contínua de currículos.</p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
              <button type="button" onClick={() => setIsPosting(false)} className="px-6 py-3 text-stone-500 font-bold hover:bg-stone-100 rounded-xl">Cancelar</button>
              <button type="submit" className="bg-stone-900 hover:bg-stone-800 text-white px-8 py-3 rounded-xl font-bold">Publicar Vaga</button>
            </div>
          </form>
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold mb-4">Suas Vagas Publicadas</h2>
        {loadingJobs ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-terracotta-500" />
          </div>
        ) : myJobs.length === 0 ? (
          <div className="bg-stone-100/50 border border-stone-200 border-dashed rounded-3xl p-12 text-center">
            <Briefcase className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-500">Nenhuma vaga publicada ainda.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/80">
                    <th className="px-5 py-3.5 text-xs font-bold text-stone-500 uppercase tracking-wider">Título da Vaga</th>
                    <th className="px-5 py-3.5 text-xs font-bold text-stone-500 uppercase tracking-wider">Localização / Tipo</th>
                    <th className="px-5 py-3.5 text-xs font-bold text-stone-500 uppercase tracking-wider">Status Captação</th>
                    <th className="px-5 py-3.5 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {myJobs.map(job => (
                    <tr key={job.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-stone-900 text-sm flex items-center gap-2">
                          {job.title}
                          {job.isTalentPool && (
                            <span className="bg-purple-100 text-purple-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded">Banco de Talentos</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-stone-600 font-medium">
                        {job.location} • {job.type} • {job.workModel || 'Presencial'}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                          job.active !== false 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {job.active !== false ? 'Captação Ativa' : 'Encerrada'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => navigate(`/dashboard/vaga/${job.id}`)}
                            className="text-terracotta-700 bg-terracotta-50 hover:bg-terracotta-100 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Gerenciar Vaga
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
