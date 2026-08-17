import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { 
  Shield, 
  Briefcase, 
  User, 
  Image, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Mail, 
  Building2, 
  AlertTriangle, 
  Cpu, 
  Check, 
  X, 
  Globe, 
  MapPin, 
  Phone,
  FileText,
  Loader2
} from 'lucide-react';
import { FileUpload } from '../components/FileUpload';

export function AdminDashboard() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'jobs' | 'users' | 'ads' | 'emails' | 'ai'>('jobs');
  const [jobs, setJobs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // AI limit config state
  const [aiLimitInput, setAiLimitInput] = useState(1);
  const [savingAiLimit, setSavingAiLimit] = useState(false);
  const [aiConfigSuccess, setAiConfigSuccess] = useState(false);
  
  // Ad Form State
  const [isAdFormOpen, setIsAdFormOpen] = useState(false);
  const [adTitle, setAdTitle] = useState('');
  const [adImageUrl, setAdImageUrl] = useState('');
  const [adLink, setAdLink] = useState('');
  const [adType, setAdType] = useState('carousel');
  const [editingAdId, setEditingAdId] = useState<string | null>(null);

  // Google Ads & AdMob State
  const [googleAdsEnabled, setGoogleAdsEnabled] = useState(false);
  const [googleAdsClient, setGoogleAdsClient] = useState('');
  const [googleAdsSlotLeaderboard, setGoogleAdsSlotLeaderboard] = useState('');
  const [googleAdsSlotRectangle, setGoogleAdsSlotRectangle] = useState('');
  const [adMobEnabled, setAdMobEnabled] = useState(false);
  const [adMobAppId, setAdMobAppId] = useState('');
  const [adMobUnitIdBanner, setAdMobUnitIdBanner] = useState('');
  const [adMobUnitIdInterstitial, setAdMobUnitIdInterstitial] = useState('');

  // Review Company Modal State
  const [reviewingUser, setReviewingUser] = useState<any | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'jobs') {
        const res = await api.get('/admin/jobs');
        setJobs(res.data || []);
      } else if (activeTab === 'users') {
        const res = await api.get('/admin/users');
        setUsers(res.data || []);
      } else if (activeTab === 'ads') {
        const adsRes = await api.get('/admin/ads');
        setAds(adsRes.data || []);

        const configRes = await api.get('/admin/configs/advertising').catch(() => null);
        if (configRes && configRes.data) {
          const configData = configRes.data;
          setGoogleAdsEnabled(configData.googleAdsEnabled ?? false);
          setGoogleAdsClient(configData.googleAdsClient ?? '');
          setGoogleAdsSlotLeaderboard(configData.googleAdsSlotLeaderboard ?? '');
          setGoogleAdsSlotRectangle(configData.googleAdsSlotRectangle ?? '');
          setAdMobEnabled(configData.adMobEnabled ?? false);
          setAdMobAppId(configData.adMobAppId ?? '');
          setAdMobUnitIdBanner(configData.adMobUnitIdBanner ?? '');
          setAdMobUnitIdInterstitial(configData.adMobUnitIdInterstitial ?? '');
        }
      } else if (activeTab === 'emails') {
        const res = await api.get('/admin/email-templates');
        setEmailTemplates(res.data || []);
      } else if (activeTab === 'ai') {
        const res = await api.get('/admin/configs/ai').catch(() => null);
        if (res && res.data) {
          setAiLimitInput(res.data.limit ?? 1);
        } else {
          setAiLimitInput(1);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleSaveAiLimit = async () => {
    setSavingAiLimit(true);
    setAiConfigSuccess(false);
    try {
      await api.put('/admin/configs/ai', { limit: Number(aiLimitInput) || 1 });
      setAiConfigSuccess(true);
      setTimeout(() => setAiConfigSuccess(false), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingAiLimit(false);
    }
  };

  const toggleJobStatus = async (jobId: string, currentStatus: boolean) => {
    await api.put(`/admin/jobs/${jobId}/status`, { active: !currentStatus });
    fetchData();
  };

  const toggleJobSponsor = async (jobId: string, currentSponsor: boolean) => {
    await api.put(`/admin/jobs/${jobId}/sponsor`, { isSponsored: !currentSponsor });
    fetchData();
  };

  const deleteJob = async (jobId: string) => {
    if (confirm('Tem certeza que deseja excluir esta vaga?')) {
      await api.delete(`/admin/jobs/${jobId}`);
      fetchData();
    }
  };

  const deleteUser = async (userId: string) => {
    if (confirm('Tem certeza que deseja excluir este usuário?')) {
      await api.delete(`/admin/users/${userId}`);
      fetchData();
    }
  };

  const promoteToAdmin = async (userId: string) => {
    if (confirm('Tornar este usuário um Administrador?')) {
      await api.put(`/admin/users/${userId}/promote`);
      fetchData();
    }
  };

  const toggleVerification = async (userId: string, currentStatus: boolean) => {
    await api.put(`/admin/users/${userId}/verify`, { isVerified: !currentStatus });
    fetchData();
  };

  const handleSaveAdvertisingConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/admin/configs/advertising', {
        googleAdsEnabled,
        googleAdsClient,
        googleAdsSlotLeaderboard,
        googleAdsSlotRectangle,
        adMobEnabled,
        adMobAppId,
        adMobUnitIdBanner,
        adMobUnitIdInterstitial
      });
      alert('Configurações de publicidade Google Ads e AdMob salvas com sucesso!');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar configurações de publicidade.');
    }
  };

  const handleApproveCompany = async (companyId: string, companyUserId: string) => {
    setSubmittingReview(true);
    try {
      await api.post(`/admin/companies/${companyId}/approve`, { userId: companyUserId });
      alert('Empresa aprovada e certificada com sucesso!');
      setReviewingUser(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Erro ao aprovar cadastro de empresa.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleRejectCompany = async (companyId: string, companyUserId: string) => {
    if (!rejectionReasonInput.trim()) {
      alert('Insira o motivo da recusa antes de prosseguir.');
      return;
    }
    setSubmittingReview(true);
    try {
      await api.post(`/admin/companies/${companyId}/reject`, { 
        userId: companyUserId,
        reason: rejectionReasonInput 
      });
      alert('Cadastro recusado com sucesso. O usuário foi notificado para realizar as correções.');
      setReviewingUser(null);
      setRejectionReasonInput('');
      setShowRejectionForm(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Erro ao recusar cadastro de empresa.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSaveAd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const adData = {
        title: adTitle,
        imageURL: adImageUrl,
        link: adLink,
        type: adType,
        active: true
      };
      
      if (editingAdId) {
        await api.put(`/admin/ads/${editingAdId}`, adData);
      } else {
        await api.post('/admin/ads', adData);
      }
      setIsAdFormOpen(false);
      fetchData();
    } catch(err) {
      console.error(err);
      alert('Erro ao salvar anúncio');
    }
  };

  const deleteAd = async (adId: string) => {
    if (confirm('Excluir este anúncio?')) {
      await api.delete(`/admin/ads/${adId}`);
      fetchData();
    }
  };

  const toggleAdStatus = async (adId: string, currentStatus: boolean) => {
    await api.put(`/admin/ads/${adId}/status`, { active: !currentStatus });
    fetchData();
  };

  const editAd = (ad: any) => {
    setEditingAdId(ad.id);
    setAdTitle(ad.title);
    setAdImageUrl(ad.imageURL);
    setAdLink(ad.link);
    setAdType(ad.type);
    setIsAdFormOpen(true);
  };

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateHtml, setTemplateHtml] = useState('');

  const editTemplate = (t: any) => {
    setEditingTemplateId(t.id);
    setTemplateSubject(t.subject);
    setTemplateHtml(t.html);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplateId) return;
    try {
      await api.put(`/admin/email-templates/${editingTemplateId}`, {
        subject: templateSubject,
        html: templateHtml
      });
      setEditingTemplateId(null);
      fetchData();
      alert('Template salvo com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar template');
    }
  };

  const openNewAdForm = () => {
    setEditingAdId(null);
    setAdTitle('');
    setAdImageUrl('');
    setAdLink('');
    setAdType('carousel');
    setIsAdFormOpen(true);
  };

  if (profile?.type !== 'ADMIN') {
    return <div className="p-8 text-center text-red-600 font-bold">Acesso Negado. Você não é um administrador.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-stone-900 flex items-center gap-3">
          <Shield className="text-terracotta-600" />
          Painel de Administração
        </h1>
        <p className="text-stone-500 mt-1">Modere o conteúdo, usuários e publicidade.</p>
      </div>

      <div className="flex gap-4 border-b border-stone-200">
        <button 
          onClick={() => setActiveTab('jobs')}
          className={`pb-4 px-4 font-bold transition-colors ${activeTab === 'jobs' ? 'border-b-2 border-terracotta-600 text-terracotta-600' : 'text-stone-500 hover:text-stone-800'}`}
        >
          <div className="flex items-center gap-2"><Briefcase className="w-4 h-4"/> Vagas</div>
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`pb-4 px-4 font-bold transition-colors ${activeTab === 'users' ? 'border-b-2 border-terracotta-600 text-terracotta-600' : 'text-stone-500 hover:text-stone-800'}`}
        >
          <div className="flex items-center gap-2"><User className="w-4 h-4"/> Usuários</div>
        </button>
        <button 
          onClick={() => setActiveTab('ads')}
          className={`pb-4 px-4 font-bold transition-colors ${activeTab === 'ads' ? 'border-b-2 border-terracotta-600 text-terracotta-600' : 'text-stone-500 hover:text-stone-800'}`}
        >
          <div className="flex items-center gap-2"><Image className="w-4 h-4"/> Publicidade</div>
        </button>
        <button 
          onClick={() => setActiveTab('emails')}
          className={`pb-4 px-4 font-bold transition-colors ${activeTab === 'emails' ? 'border-b-2 border-terracotta-600 text-terracotta-600' : 'text-stone-500 hover:text-stone-800'}`}
        >
          <div className="flex items-center gap-2"><Mail className="w-4 h-4"/> Templates de E-mail</div>
        </button>
        <button 
          onClick={() => setActiveTab('ai')}
          className={`pb-4 px-4 font-bold transition-colors ${activeTab === 'ai' ? 'border-b-2 border-terracotta-600 text-terracotta-600' : 'text-stone-500 hover:text-stone-800'}`}
        >
          <div className="flex items-center gap-2"><Cpu className="w-4 h-4"/> Assistente de IA</div>
        </button>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-terracotta-500" />
          </div>
        ) : (
          <>
            {activeTab === 'jobs' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-stone-200 text-sm text-stone-500 uppercase tracking-wider">
                      <th className="pb-3 font-bold">Vaga</th>
                      <th className="pb-3 font-bold">Empresa</th>
                      <th className="pb-3 font-bold">Status</th>
                      <th className="pb-3 font-bold">Patrocinada</th>
                      <th className="pb-3 font-bold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(job => (
                      <tr key={job.id} className="border-b border-stone-100 last:border-0">
                        <td className="py-4 font-medium">{job.title}</td>
                        <td className="py-4 text-stone-600">{job.companyName}</td>
                        <td className="py-4">
                          <button onClick={() => toggleJobStatus(job.id, job.active)} className={`px-3 py-1 rounded-full text-xs font-bold ${job.active ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-600'}`}>
                            {job.active ? 'Ativa' : 'Inativa'}
                          </button>
                        </td>
                        <td className="py-4">
                          <button onClick={() => toggleJobSponsor(job.id, job.isSponsored)} className={`px-3 py-1 rounded-full text-xs font-bold ${job.isSponsored ? 'bg-yellow-100 text-yellow-700' : 'bg-stone-100 text-stone-600'}`}>
                            {job.isSponsored ? 'Sim' : 'Não'}
                          </button>
                        </td>
                        <td className="py-4 text-right">
                          <button onClick={() => deleteJob(job.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-stone-200 text-sm text-stone-500 uppercase tracking-wider">
                      <th className="pb-3 font-bold">Nome / Empresa</th>
                      <th className="pb-3 font-bold">Email</th>
                      <th className="pb-3 font-bold">Tipo / LGPD</th>
                      <th className="pb-3 font-bold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-stone-100 last:border-0">
                        <td className="py-4 font-medium">
                          {u.type === 'COMPANY' ? u.linkedCompany?.name || u.companyName || u.name : u.name}
                          {u.type === 'COMPANY' && u.linkedCompany && (
                            <span className="block text-xs font-normal text-stone-400 mt-0.5">
                              CNPJ: {u.linkedCompany.cnpj || 'Não Informado'}
                            </span>
                          )}
                        </td>
                        <td className="py-4 text-stone-600">
                          {u.email}
                          <span className="block text-xs text-stone-400 mt-0.5">{u.phone || 'Sem telefone'}</span>
                        </td>
                        <td className="py-4 flex flex-col items-start gap-1.5">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-stone-100 text-stone-600">
                            {u.type === 'COMPANY' ? '🏢 Empresa' : u.type === 'CANDIDATE' ? '👤 Candidato' : '👑 Admin'}
                          </span>
                          
                          {u.type === 'COMPANY' && (
                            <div className="flex flex-col gap-1 items-start">
                              {u.linkedCompany?.verificationStatus === 'VERIFIED' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                                  Aprovada & Ativa
                                </span>
                              ) : u.linkedCompany?.verificationStatus === 'PENDING' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                                  Pendente Análise
                                </span>
                              ) : u.linkedCompany?.verificationStatus === 'REJECTED' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                                  Recusada
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600">
                                  Rascunho / Incompleto
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex justify-end items-center gap-3">
                            {u.type === 'COMPANY' && u.linkedCompany && (
                              <button 
                                onClick={() => {
                                  setReviewingUser(u);
                                  setRejectionReasonInput(u.linkedCompany.rejectionReason || '');
                                  setShowRejectionForm(false);
                                }}
                                className="text-xs bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-700 px-3 py-1.5 rounded-lg font-bold transition-all"
                              >
                                Revisar Cadastro
                              </button>
                            )}
                            
                            <button onClick={() => promoteToAdmin(u.id)} className="text-stone-400 hover:text-stone-700 text-xs font-bold transition-colors">Promover</button>
                            
                            <button onClick={() => deleteUser(u.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'ads' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">Gerenciar Anúncios</h2>
                  <button onClick={openNewAdForm} className="bg-terracotta-600 hover:bg-terracotta-700 text-white px-4 py-2 rounded-xl font-bold transition-colors">
                    + Novo Anúncio
                  </button>
                </div>

                {isAdFormOpen && (
                  <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 mb-8">
                    <h3 className="font-bold text-lg mb-4">{editingAdId ? 'Editar Anúncio' : 'Novo Anúncio'}</h3>
                    <form onSubmit={handleSaveAd} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Título do Anúncio *</label>
                        <input required value={adTitle} onChange={(e) => setAdTitle(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500" />
                      </div>
                      <div>
                        <FileUpload
                          label="Imagem do Anúncio * (Recomendado: 1080x1080)"
                          accept="image/*"
                          value={adImageUrl}
                          onChange={(base64) => setAdImageUrl(base64)}
                          type="document"
                          placeholder="Arraste a imagem ou clique para selecionar"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Link de Destino</label>
                        <input value={adLink} onChange={(e) => setAdLink(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500" placeholder="https://..." />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Tipo de Espaço *</label>
                        <select value={adType} onChange={(e) => setAdType(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white">
                          <option value="carousel">Carrossel (Quadrado/Retângulo)</option>
                          <option value="leaderboard">Leaderboard (Topo, Retângulo Horizontal)</option>
                          <option value="sidebar">Sidebar (Lateral)</option>
                        </select>
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsAdFormOpen(false)} className="px-6 py-3 text-stone-500 font-bold hover:bg-stone-100 rounded-xl">Cancelar</button>
                        <button type="submit" className="bg-stone-900 hover:bg-stone-800 text-white px-8 py-3 rounded-xl font-bold">Salvar</button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-stone-200 text-sm text-stone-500 uppercase tracking-wider">
                        <th className="pb-3 font-bold">Anúncio</th>
                        <th className="pb-3 font-bold">Tipo</th>
                        <th className="pb-3 font-bold">Status</th>
                        <th className="pb-3 font-bold text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ads.map(ad => (
                        <tr key={ad.id} className="border-b border-stone-100 last:border-0">
                          <td className="py-4 font-medium flex items-center gap-3">
                            <img src={ad.imageURL} alt={ad.title} className="w-12 h-12 object-cover rounded-lg border border-stone-200 bg-stone-100" />
                            {ad.title}
                          </td>
                          <td className="py-4 text-stone-600 capitalize">{ad.type}</td>
                          <td className="py-4">
                            <button onClick={() => toggleAdStatus(ad.id, ad.active)} className={`px-3 py-1 rounded-full text-xs font-bold ${ad.active ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-600'}`}>
                              {ad.active ? 'Ativo' : 'Inativo'}
                            </button>
                          </td>
                          <td className="py-4 text-right flex justify-end gap-2 items-center">
                            <button onClick={() => editAd(ad)} className="text-stone-500 text-sm font-bold hover:text-terracotta-600 transition-colors">Editar</button>
                            <button onClick={() => deleteAd(ad.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {ads.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-stone-500">Nenhum anúncio cadastrado.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Google Ads & AdMob Config Panel */}
                <div className="mt-12 pt-10 border-t border-stone-200">
                  <div className="flex items-center gap-3.5 mb-6">
                    <div className="p-3 bg-stone-100 rounded-2xl text-stone-800">
                      <Cpu className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-stone-900">Integração com Google Ads e AdMob</h2>
                      <p className="text-sm text-stone-500 mt-0.5">Configure os blocos de publicidade global e banners monetizados do portal.</p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveAdvertisingConfig} className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-stone-50/50 p-6 rounded-3xl border border-stone-200">
                    
                    {/* Google Ads Column */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                        <h3 className="font-serif font-bold text-stone-900 flex items-center gap-2">
                          <Globe className="w-4 h-4 text-terracotta-600" />
                          Configurações Google Adsense / Web Ads
                        </h3>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={googleAdsEnabled} 
                            onChange={(e) => setGoogleAdsEnabled(e.target.checked)} 
                            className="sr-only peer" 
                          />
                          <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-terracotta-600"></div>
                          <span className="ml-2 text-xs font-bold text-stone-600">Habilitar</span>
                        </label>
                      </div>

                      <div className={`space-y-4 transition-all duration-300 ${googleAdsEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <div>
                          <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Publisher ID (ID do Editor) *</label>
                          <input 
                            required={googleAdsEnabled}
                            value={googleAdsClient} 
                            onChange={(e) => setGoogleAdsClient(e.target.value)} 
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white" 
                            placeholder="Ex: ca-pub-XXXXXXXXXXXXXXXX" 
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Slot ID - Leaderboard (Topo/Geral) *</label>
                          <input 
                            required={googleAdsEnabled}
                            value={googleAdsSlotLeaderboard} 
                            onChange={(e) => setGoogleAdsSlotLeaderboard(e.target.value)} 
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white" 
                            placeholder="Ex: XXXXXXXXXX" 
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Slot ID - Medium Rectangle (Carrossel/Vagas) *</label>
                          <input 
                            required={googleAdsEnabled}
                            value={googleAdsSlotRectangle} 
                            onChange={(e) => setGoogleAdsSlotRectangle(e.target.value)} 
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white" 
                            placeholder="Ex: XXXXXXXXXX" 
                          />
                        </div>
                      </div>
                    </div>

                    {/* AdMob Column */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                        <h3 className="font-serif font-bold text-stone-900 flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-terracotta-600" />
                          Configurações Google AdMob (Apps)
                        </h3>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={adMobEnabled} 
                            onChange={(e) => setAdMobEnabled(e.target.checked)} 
                            className="sr-only peer" 
                          />
                          <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-terracotta-600"></div>
                          <span className="ml-2 text-xs font-bold text-stone-600">Habilitar</span>
                        </label>
                      </div>

                      <div className={`space-y-4 transition-all duration-300 ${adMobEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <div>
                          <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">ID do Aplicativo AdMob *</label>
                          <input 
                            required={adMobEnabled}
                            value={adMobAppId} 
                            onChange={(e) => setAdMobAppId(e.target.value)} 
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white" 
                            placeholder="Ex: ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXXXXXXXX" 
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">ID do Bloco - Banner Integrado *</label>
                          <input 
                            required={adMobEnabled}
                            value={adMobUnitIdBanner} 
                            onChange={(e) => setAdMobUnitIdBanner(e.target.value)} 
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white" 
                            placeholder="Ex: ca-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX" 
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">ID do Bloco - Interstitial *</label>
                          <input 
                            required={adMobEnabled}
                            value={adMobUnitIdInterstitial} 
                            onChange={(e) => setAdMobUnitIdInterstitial(e.target.value)} 
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white" 
                            placeholder="Ex: ca-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX" 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2 flex justify-end pt-4 border-t border-stone-200">
                      <button type="submit" className="bg-stone-900 hover:bg-stone-800 text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-md">
                        Salvar Configurações de Integração
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            {activeTab === 'emails' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">Templates de E-mail do Sistema</h2>
                  <p className="text-sm text-stone-500">Editáveis com variáveis {'{{variavel}}'}</p>
                </div>
                {editingTemplateId ? (
                  <form onSubmit={handleSaveTemplate} className="space-y-4 bg-stone-50 p-6 rounded-2xl border border-stone-200">
                    <h3 className="font-bold text-lg mb-4">Editar Template</h3>
                    <div>
                      <label className="block text-sm font-bold text-stone-700 mb-2">Assunto do E-mail</label>
                      <input 
                        type="text" 
                        required
                        className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:ring-2 focus:ring-terracotta-500 outline-none"
                        value={templateSubject}
                        onChange={e => setTemplateSubject(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-stone-700 mb-2">Corpo do E-mail (HTML permitido)</label>
                      <textarea 
                        required
                        rows={6}
                        className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:ring-2 focus:ring-terracotta-500 outline-none font-mono text-sm"
                        value={templateHtml}
                        onChange={e => setTemplateHtml(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button type="button" onClick={() => setEditingTemplateId(null)} className="px-6 py-2 rounded-xl font-bold text-stone-500 hover:bg-stone-200 transition-colors">Cancelar</button>
                      <button type="submit" className="px-6 py-2 rounded-xl font-bold bg-terracotta-600 text-white hover:bg-terracotta-700 transition-colors">Salvar Template</button>
                    </div>
                  </form>
                ) : (
                  <div className="grid gap-4">
                    {emailTemplates.map(t => (
                      <div key={t.id} className="border border-stone-200 rounded-xl p-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                        <div>
                          <h3 className="font-bold text-stone-900 mb-1">{t.subject} <span className="text-xs font-mono bg-stone-100 px-2 py-1 rounded text-stone-500 ml-2">{t.id}</span></h3>
                          <p className="text-sm text-stone-500">Variáveis disponíveis: <span className="font-mono text-xs">{t.variables}</span></p>
                        </div>
                        <button onClick={() => editTemplate(t)} className="px-4 py-2 font-bold text-sm bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition-colors shrink-0">
                          Editar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-terracotta-600" />
                    Configurações do Assistente de IA
                  </h2>
                  <p className="text-sm text-stone-500 mt-1">
                    Defina o limite global de análises e preenchimento automático de currículo por candidato.
                  </p>
                </div>

                <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 max-w-lg space-y-4 font-sans text-stone-700">
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">
                      Limite de Análises por Usuário (Grátis)
                    </label>
                    <input 
                      type="number" 
                      min={1}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white outline-none focus:border-terracotta-500 text-sm"
                      value={aiLimitInput}
                      onChange={e => setAiLimitInput(Number(e.target.value) || 1)}
                    />
                    <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">
                      Quantidade máxima de vezes que cada candidato cadastrado poderá usar a inteligência artificial para ler e estruturar seu currículo.
                    </p>
                  </div>

                  {aiConfigSuccess && (
                    <div className="bg-green-50 text-green-800 text-xs font-bold p-3.5 rounded-xl border border-green-150 animate-in fade-in">
                      Configurações do Assistente de IA salvas com sucesso!
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button 
                      type="button" 
                      onClick={handleSaveAiLimit}
                      disabled={savingAiLimit}
                      className="bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      {savingAiLimit ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Review Company Modal */}
      {reviewingUser && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl border border-stone-200 overflow-hidden shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="px-6 py-5 bg-stone-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-terracotta-400" />
                <h3 className="font-serif font-bold text-lg">Revisar Perfil de Empresa</h3>
              </div>
              <button 
                onClick={() => setReviewingUser(null)} 
                className="p-1.5 hover:bg-white/10 rounded-lg text-stone-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              
              {/* Alert status */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-amber-900 text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Verificação Pendente</p>
                  <p className="text-stone-600 mt-0.5">Analise cuidadosamente as informações da empresa abaixo. Apenas aprove se o CNPJ e o Nome Fantasia estiverem corretos.</p>
                </div>
              </div>

              {/* User Account */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-1">Conta do Usuário</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-stone-500 block">Nome do Responsável:</span>
                    <strong className="text-stone-800">{reviewingUser.name || 'Não Informado'}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500 block">E-mail de Contato:</span>
                    <strong className="text-stone-800">{reviewingUser.email}</strong>
                  </div>
                </div>
              </div>

              {/* Company Details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-1">Dados Cadastrais da Empresa</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-stone-500 block">Nome / Razão Social:</span>
                    <strong className="text-stone-800">{reviewingUser.linkedCompany?.name || 'Não Informado'}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Nome Fantasia:</span>
                    <strong className="text-stone-800">{reviewingUser.linkedCompany?.tradingName || 'Não Informado'}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500 block">CNPJ:</span>
                    <strong className="text-stone-800 font-mono">{reviewingUser.linkedCompany?.cnpj || 'Não Informado'}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Cidade / Atuação:</span>
                    <strong className="text-stone-800">{reviewingUser.linkedCompany?.city || 'Não Informado'}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Website:</span>
                    {reviewingUser.linkedCompany?.website ? (
                      <a 
                        href={reviewingUser.linkedCompany.website} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-terracotta-600 hover:underline font-medium break-all flex items-center gap-1 mt-0.5"
                      >
                        <Globe className="w-3.5 h-3.5 inline" />
                        {reviewingUser.linkedCompany.website}
                      </a>
                    ) : (
                      <span className="text-stone-400">Não Informado</span>
                    )}
                  </div>
                  <div>
                    <span className="text-stone-500 block">Telefone:</span>
                    <strong className="text-stone-800">{reviewingUser.linkedCompany?.phone || reviewingUser.phone || 'Não Informado'}</strong>
                  </div>
                </div>

                <div className="text-sm">
                  <span className="text-stone-500 block">Sobre a Empresa:</span>
                  <p className="text-stone-700 bg-stone-50 p-3.5 rounded-xl border border-stone-200 mt-1 whitespace-pre-wrap">
                    {reviewingUser.linkedCompany?.description || 'Nenhuma descrição inserida.'}
                  </p>
                </div>

                {/* Documents & Logo */}
                <div className="space-y-4 pt-2 border-t border-stone-100">
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-1">Documentos e Mídias</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    {/* Logo column */}
                    <div>
                      <span className="text-stone-500 block text-xs font-bold uppercase tracking-wider mb-1.5">Logotipo da Empresa:</span>
                      {reviewingUser.linkedCompany?.logoURL || reviewingUser.companyLogo ? (
                        <img 
                          src={reviewingUser.linkedCompany.logoURL || reviewingUser.companyLogo} 
                          alt="Logotipo da Empresa" 
                          referrerPolicy="no-referrer"
                          className="w-24 h-24 object-cover rounded-xl border border-stone-200 shadow-xs"
                        />
                      ) : (
                        <span className="text-sm text-stone-400 italic">Nenhum logotipo enviado</span>
                      )}
                    </div>
                    {/* Verification doc column */}
                    <div>
                      <span className="text-stone-500 block text-xs font-bold uppercase tracking-wider mb-1.5">Documento Comprovante CNPJ/CPF:</span>
                      {reviewingUser.linkedCompany?.documentURL || reviewingUser.linkedCompany?.companyDocumentFile ? (
                        <a 
                          href={reviewingUser.linkedCompany.documentURL || reviewingUser.linkedCompany.companyDocumentFile} 
                          download={`documento_${reviewingUser.linkedCompany?.name || 'empresa'}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl border border-stone-200 transition-all shadow-xs"
                        >
                          <FileText className="w-4 h-4 text-stone-500" />
                          Visualizar / Baixar Documento
                        </a>
                      ) : (
                        <span className="text-sm text-stone-400 italic">Nenhum comprovante enviado</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action rejection reason */}
              {showRejectionForm && (
                <div className="bg-red-50 p-4 rounded-2xl border border-red-200 space-y-3">
                  <label className="block text-xs font-bold text-red-700 uppercase tracking-widest">Motivo de Recusa / Ajustes necessários *</label>
                  <textarea 
                    value={rejectionReasonInput} 
                    onChange={(e) => setRejectionReasonInput(e.target.value)} 
                    rows={3} 
                    className="w-full px-4 py-3 rounded-xl border border-red-200 bg-white outline-none focus:border-red-500 text-sm text-stone-800"
                    placeholder="Especifique o que a empresa precisa ajustar para ser aprovada..."
                  />
                  <div className="flex justify-end gap-2">
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowRejectionForm(false);
                        setRejectionReasonInput('');
                      }} 
                      className="px-4 py-2 text-stone-500 hover:bg-stone-100 rounded-lg text-xs font-bold"
                    >
                      Cancelar Recusa
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleRejectCompany(reviewingUser.linkedCompany?.id, reviewingUser.id)} 
                      disabled={submittingReview}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
                    >
                      Confirmar Recusa e Enviar Motivo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            {!showRejectionForm && (
              <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex justify-between items-center">
                <button 
                  type="button" 
                  onClick={() => setShowRejectionForm(true)} 
                  disabled={submittingReview}
                  className="px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  Recusar Cadastro
                </button>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setReviewingUser(null)} 
                    disabled={submittingReview}
                    className="px-5 py-2.5 text-stone-500 font-bold text-sm hover:bg-stone-200 rounded-xl"
                  >
                    Fechar
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleApproveCompany(reviewingUser.linkedCompany?.id, reviewingUser.id)} 
                    disabled={submittingReview}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Aprovar e Ativar Empresa
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
