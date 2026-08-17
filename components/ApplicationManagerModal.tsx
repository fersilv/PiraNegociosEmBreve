import React, { useState, useEffect } from 'react';
import { X, Save, Plus, MessageSquare, Clock, User, Link as LinkIcon, FileText, CheckCircle2, XCircle, Download, Eye, ExternalLink, AlertTriangle, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { openBase64InNewTab, downloadBase64File } from '../lib/fileViewer';
import { sendNotificationToUser } from '../lib/notifications';
import { ApplicationChat } from './ApplicationChat';

import { SYSTEM_DEFAULT_STATUSES, DEFAULT_HIRING_DOCUMENTS } from '../pages/CompanyHiringConfig';

export function ApplicationManagerModal({ application, onClose, onUpdated }: any) {
  const { user, profile } = useAuth();
  const initialStatus = application.status === 'Recusado' ? 'Não Classificado' : (application.status || 'Enviado');
  const [status, setStatus] = useState(initialStatus);
  const [isCustomInput, setIsCustomInput] = useState(false);
  const [priority, setPriority] = useState(application.priority || 'Normal');
  const [newObs, setNewObs] = useState('');
  const [saving, setSaving] = useState(false);
  const [companyConfig, setCompanyConfig] = useState<any>(null);

  const [localDocs, setLocalDocs] = useState<Record<string, any>>(application.onboardingDocs || {});
  const [previewDoc, setPreviewDoc] = useState<{ id: string; name: string; url: string; status?: string; feedback?: string } | null>(null);

  useEffect(() => {
    setLocalDocs(application.onboardingDocs || {});
    if (application?.status) {
      const current = application.status === 'Recusado' ? 'Não Classificado' : application.status;
      setStatus(current);
    }
  }, [application?.id, application?.status, application?.onboardingDocs]);

  const onboardingDocs = localDocs;
  const observations = application.observations || [];

  const allStatusOptions = Array.from(new Set([
    ...SYSTEM_DEFAULT_STATUSES,
    ...(companyConfig?.customStatuses || [])
  ]));

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const idsToTry = Array.from(new Set([
          application?.companyId,
          profile?.companyId,
          profile?.uid,
          user?.uid
        ].filter(Boolean)));

        for (const cid of idsToTry) {
          const res = await api.get(`/company-hiring-config/${cid}`).catch(() => null);
          if (res && res.data) {
            setCompanyConfig(res.data);
            return;
          }
        }
      } catch(e) {
        console.error(e);
      }
    };
    fetchConfig();
  }, [application?.companyId, profile?.companyId, profile?.uid, user?.uid]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: any = {
        status,
        priority
      };

      const isDocStageStatus = status === 'Em Contratação' || status === 'Aguardando Exame Médico' || status.toLowerCase().includes('documento') || status.toLowerCase().includes('exame');

      if (isDocStageStatus) {
        updates.documentsRequested = true;
        if (!application.documentsRequestedAt) {
          updates.documentsRequestedAt = new Date().toISOString();
        }
      }
      
      if (newObs.trim()) {
        const newObservation = {
          text: newObs.trim(),
          author: profile?.name || 'Empresa',
          date: new Date().toISOString()
        };
        updates.observations = [...(application.observations || []), newObservation];
      }
      
      await api.put(`/applications/${application.id}`, updates);
      application.status = status;
      if (updates.observations) {
        application.observations = updates.observations;
      }

      // Notify candidate if status changed
      if (status !== initialStatus && application.candidateId) {
        const notifyMessage = isDocStageStatus
          ? `A empresa ${application.companyName || 'Empresa'} atualizou sua candidatura para "${status}" e solicitou o envio de documentos/exame médico!`
          : `Sua candidatura para a vaga "${application.jobTitle}" foi atualizada para o status: ${status}.`;

        sendNotificationToUser(
          application.candidateId,
          isDocStageStatus ? `Status: ${status}` : 'Atualização na Candidatura',
          notifyMessage,
          'status_update',
          { jobId: application.jobId, appId: application.id, link: isDocStageStatus ? `/dashboard/admissao/${application.id}` : `/dashboard/vaga-detalhes/${application.jobId}` }
        );
      }

      onUpdated();
      if (!newObs.trim()) {
        onClose();
      } else {
        setNewObs('');
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDocAction = async (docId: string, action: 'approved' | 'rejected', feedback?: string) => {
    try {
      const updatedDocs = {
        ...localDocs,
        [docId]: {
          ...(localDocs[docId] || {}),
          status: action,
          feedback: feedback || ''
        }
      };

      // Instant UI reaction
      setLocalDocs(updatedDocs);
      application.onboardingDocs = updatedDocs;

      if (previewDoc && previewDoc.id === docId) {
        setPreviewDoc({
          ...previewDoc,
          status: action,
          feedback: feedback || ''
        });
      }

      await api.put(`/applications/${application.id}`, {
        onboardingDocs: updatedDocs
      });

      if (action === 'rejected' && application.candidateId) {
        sendNotificationToUser(
          application.candidateId,
          'Ajuste em Documento Solicitado',
          `A empresa solicitou a correção de um documento da vaga "${application.jobTitle}". Motivo: ${feedback || 'Documento precisa de reenvio'}.`,
          'status_update',
          { jobId: application.jobId, appId: application.id, link: `/dashboard/admissao/${application.id}` }
        );
      }

      onUpdated();
    } catch(e) {
      console.error(e);
      alert("Erro ao atualizar documento");
    }
  };


  const handleRequestDocuments = async () => {
    setSaving(true);
    try {
      const updates: any = {
        status: 'Em Contratação',
        documentsRequested: true,
        documentsRequestedAt: new Date().toISOString(),
        priority
      };

      if (newObs.trim()) {
        const newObservation = {
          text: newObs.trim(),
          author: profile?.name || 'Empresa',
          date: new Date().toISOString()
        };
        updates.observations = [...(application.observations || []), newObservation];
        setNewObs('');
      }

      await api.put(`/applications/${application.id}`, updates);
      setStatus('Em Contratação');
      application.status = 'Em Contratação';
      application.documentsRequested = true;
      if (updates.observations) {
        application.observations = updates.observations;
      }

      // Notify candidate
      if (application.candidateId) {
        await sendNotificationToUser(
          application.candidateId,
          'Documentos Solicitados para Admissão',
          `A empresa ${application.companyName || 'Empresa'} solicitou o envio dos seus documentos de admissão para a vaga "${application.jobTitle}".`,
          'status_update',
          { jobId: application.jobId, appId: application.id, link: `/dashboard/admissao/${application.id}` }
        );
      }

      onUpdated();
      alert('Documentos solicitados com sucesso! O candidato foi notificado.');
    } catch (e) {
      console.error(e);
      alert('Erro ao solicitar documentos');
    } finally {
      setSaving(false);
    }
  };

  const [showAddDocForm, setShowAddDocForm] = useState(false);
  const [selectedDocPreset, setSelectedDocPreset] = useState('');
  const [newDocName, setNewDocName] = useState('');
  const [newDocInstructions, setNewDocInstructions] = useState('');
  const [addingDoc, setAddingDoc] = useState(false);

  const DOC_PRESETS = [
    { id: 'doc-casamento', name: 'Certidão de Casamento ou Nascimento', instructions: 'Cópia legível' },
    { id: 'doc-eleitor', name: 'Título de Eleitor', instructions: 'Frente e verso ou e-Título' },
    { id: 'doc-reservista', name: 'Certificado de Reservista (CAM/CDI)', instructions: 'Para candidatos do sexo masculino' },
    { id: 'doc-aso', name: 'Atestado de Saúde Ocupacional (ASO)', instructions: 'Exame admissional emitido pela clínica médica' },
    { id: 'doc-foto3x4', name: 'Foto 3x4 Recente', instructions: 'Foto nítida em fundo neutro' },
    { id: 'doc-banco', name: 'Comprovante de Conta Bancária / Chave PIX', instructions: 'Para depósito do salário' },
    { id: 'doc-ctps', name: 'Carteira de Trabalho (CTPS Digital)', instructions: 'PDF da CTPS Digital ou cópia da física' },
    { id: 'doc-filhos', name: 'Certidão de Nascimento dos Filhos / Dependentes', instructions: 'Para cadastro de dependentes' },
    { id: 'doc-vacinacao', name: 'Comprovante ou Caderneta de Vacinação', instructions: 'Cópia legível' },
    { id: 'doc-escolaridade', name: 'Comprovante de Escolaridade / Diploma', instructions: 'Última formação concluída' },
    { id: 'doc-antecedentes', name: 'Atestado de Antecedentes Criminais', instructions: 'Emitido pela Polícia Civil ou Federal' },
    { id: 'CUSTOM', name: '+ Outro Documento Personalizado...', instructions: '' }
  ];

  const handleSelectPreset = (val: string) => {
    setSelectedDocPreset(val);
    if (val === 'CUSTOM' || !val) {
      setNewDocName('');
      setNewDocInstructions('');
    } else {
      const found = DOC_PRESETS.find(p => p.id === val) || (companyConfig?.documents || []).find((d: any) => d.id === val);
      if (found) {
        setNewDocName(found.name);
        setNewDocInstructions(found.instructions || '');
      }
    }
  };

  const handleAddCustomDocument = async () => {
    if (!newDocName.trim()) {
      alert("Por favor, informe o nome do documento.");
      return;
    }
    setAddingDoc(true);
    try {
      const docId = `custom-doc-${Date.now()}`;
      const newDocItem = {
        id: docId,
        name: newDocName.trim(),
        instructions: newDocInstructions.trim(),
        required: true,
        requestedAt: new Date().toISOString()
      };

      const targetStatus = status || application.status || 'Em Contratação';
      const updatedCustomDocs = [...(application.customDocs || []), newDocItem];

      await api.put(`/applications/${application.id}`, {
        customDocs: updatedCustomDocs,
        documentsRequested: true,
        status: targetStatus
      });

      application.customDocs = updatedCustomDocs;
      application.documentsRequested = true;
      application.status = targetStatus;
      setStatus(targetStatus);

      if (application.candidateId) {
        await sendNotificationToUser(
          application.candidateId,
          'Novo Documento Solicitado',
          `A empresa ${application.companyName || profile?.name || 'Empresa'} solicitou o envio do documento "${newDocName.trim()}" para o seu processo de admissão.`,
          'status_update',
          { jobId: application.jobId, appId: application.id, link: `/dashboard/admissao/${application.id}` }
        );
      }

      setNewDocName('');
      setNewDocInstructions('');
      setSelectedDocPreset('');
      setShowAddDocForm(false);
      onUpdated();
      alert(`Documento "${newDocItem.name}" solicitado com sucesso! O candidato foi notificado.`);
    } catch (e) {
      console.error(e);
      alert("Erro ao solicitar documento extra.");
    } finally {
      setAddingDoc(false);
    }
  };

  const handleCompanyFileUpload = async (docId: string, file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("O arquivo é muito grande (máximo 10MB).");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      if (!base64) return;

      try {
        const updatedDocs = {
          ...localDocs,
          [docId]: {
            url: base64,
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
            status: 'approved',
            uploadedBy: 'company'
          }
        };

        setLocalDocs(updatedDocs);
        application.onboardingDocs = updatedDocs;

        await api.put(`/applications/${application.id}`, {
          onboardingDocs: updatedDocs
        });

        if (application.candidateId) {
          sendNotificationToUser(
            application.candidateId,
            'Documento Anexado pela Empresa',
            `A empresa anexou/aprovou o documento para o seu processo na vaga "${application.jobTitle}".`,
            'status_update',
            { jobId: application.jobId, appId: application.id, link: `/dashboard/admissao/${application.id}` }
          );
        }

        onUpdated();
      } catch (err) {
        console.error(err);
        alert("Erro ao enviar o documento pela empresa.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomDocument = async (docId: string) => {
    if (!confirm("Tem certeza que deseja remover esta solicitação de documento extra?")) return;
    try {
      const updatedCustomDocs = (application.customDocs || []).filter((d: any) => d.id !== docId);
      await api.put(`/applications/${application.id}`, {
        customDocs: updatedCustomDocs
      });
      application.customDocs = updatedCustomDocs;
      onUpdated();
    } catch (e) {
      console.error(e);
      alert("Erro ao remover documento.");
    }
  };

  const baseDocs = (companyConfig?.documents && companyConfig.documents.length > 0) 
    ? companyConfig.documents 
    : DEFAULT_HIRING_DOCUMENTS;

  const extraDocs = application?.customDocs || [];
  const allDocsMap = new Map();

  baseDocs.forEach((d: any) => allDocsMap.set(d.id, d));
  extraDocs.forEach((d: any) => allDocsMap.set(d.id, d));

  const requiredDocs = Array.from(allDocsMap.values());

  if (!application) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-serif font-bold text-stone-900">Gerenciar Candidato</h2>
            <p className="text-sm text-stone-500 mt-1">{application.candidateName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Status do Candidato</label>
            <select 
              value={isCustomInput ? 'CUSTOM' : status} 
              onChange={(e) => {
                if (e.target.value === 'CUSTOM') {
                  setIsCustomInput(true);
                  setStatus('');
                } else {
                  setIsCustomInput(false);
                  setStatus(e.target.value);
                }
              }} 
              className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white text-stone-800 text-sm font-medium" 
            >
              <optgroup label="Etapas do Sistema">
                {SYSTEM_DEFAULT_STATUSES.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </optgroup>
              {companyConfig?.customStatuses && companyConfig.customStatuses.length > 0 && (
                <optgroup label="Status Personalizados da Empresa">
                  {companyConfig.customStatuses.map((st: string) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </optgroup>
              )}
              {status && !allStatusOptions.includes(status) && !isCustomInput && (
                <option value={status}>{status}</option>
              )}
              <option value="CUSTOM">+ Outro Status Personalizado (digitar...)</option>
            </select>

            {isCustomInput && (
              <input 
                type="text"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="Digite o novo status personalizado..."
                className="mt-2.5 w-full px-4 py-2.5 rounded-xl border border-stone-300 outline-none focus:border-terracotta-500 bg-white text-sm"
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Prioridade</label>
            <select 
              value={priority} 
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white text-stone-800 text-sm font-medium"
            >
              <option value="Baixa">Baixa</option>
              <option value="Normal">Normal</option>
              <option value="Alta">Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-stone-400" /> Observações Internas
          </h3>
          <div className="space-y-4 mb-4">
            {observations.length === 0 ? (
              <p className="text-stone-500 text-sm">Nenhuma observação ainda. (O candidato não vê isso)</p>
            ) : (
              observations.map((obs: any, i: number) => (
                <div key={i} className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                  <p className="text-stone-700 text-sm whitespace-pre-wrap">{obs.text}</p>
                  <div className="flex justify-between items-center mt-2 text-xs text-stone-400 font-medium">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {obs.author}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(obs.date).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="flex gap-2">
            <input 
              value={newObs}
              onChange={(e) => setNewObs(e.target.value)}
              placeholder="Adicionar nova observação..."
              className="flex-1 px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 text-sm"
              onKeyDown={(e) => { if(e.key === 'Enter') handleSave() }}
            />
            <button 
              onClick={handleSave}
              disabled={saving}
              className="bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Iniciar Contratação - Link for onboarding */}
        <div className="border-t border-stone-200 pt-6">
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
             <div>
               <h3 className="font-bold text-lg">Processo de Contratação & Documentos</h3>
               <p className="text-stone-500 text-xs mt-0.5">Gerencie e solicite documentos de admissão para este candidato.</p>
             </div>
             <button 
               onClick={() => setShowAddDocForm(!showAddDocForm)}
               className="bg-stone-900 hover:bg-stone-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
             >
               <Plus className="w-4 h-4" /> {showAddDocForm ? 'Cancelar' : 'Solicitar Documento Extra'}
             </button>
           </div>

           {/* FORM TO REQUEST EXTRA / SPECIFIC DOCUMENT */}
           {showAddDocForm && (
             <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 md:p-5 mb-5 space-y-3.5 animate-in fade-in">
               <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                 <FileText className="w-4 h-4 text-amber-600" />
                 <span>Solicitar Novo Documento ao Candidato</span>
               </div>

               <div>
                 <label className="block text-xs font-semibold text-stone-600 mb-1">Escolher da lista de sugestões ou digitar:</label>
                 <select 
                   value={selectedDocPreset} 
                   onChange={(e) => handleSelectPreset(e.target.value)}
                   className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs font-medium bg-white text-stone-800 outline-none focus:border-terracotta-500"
                 >
                   <option value="">-- Selecione uma sugestão de documento --</option>
                   {DOC_PRESETS.map((preset) => (
                     <option key={preset.id} value={preset.id}>{preset.name}</option>
                   ))}
                 </select>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 <div>
                   <label className="block text-xs font-semibold text-stone-600 mb-1">Nome do Documento *</label>
                   <input 
                     type="text"
                     value={newDocName}
                     onChange={(e) => setNewDocName(e.target.value)}
                     placeholder="Ex: Atestado de Saúde Ocupacional (ASO)"
                     className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs bg-white text-stone-800 outline-none focus:border-terracotta-500"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-stone-600 mb-1">Instruções / Observação (Opcional)</label>
                   <input 
                     type="text"
                     value={newDocInstructions}
                     onChange={(e) => setNewDocInstructions(e.target.value)}
                     placeholder="Ex: Emitido no máximo há 30 dias"
                     className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs bg-white text-stone-800 outline-none focus:border-terracotta-500"
                   />
                 </div>
               </div>

               <div className="flex justify-end gap-2 pt-1">
                 <button 
                   type="button" 
                   onClick={() => setShowAddDocForm(false)}
                   className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-bold rounded-xl transition-colors"
                 >
                   Cancelar
                 </button>
                 <button 
                   type="button" 
                   onClick={handleAddCustomDocument}
                   disabled={addingDoc}
                   className="px-4 py-2 bg-terracotta-600 hover:bg-terracotta-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                 >
                   {addingDoc ? 'Solicitando...' : 'Enviar Solicitação e Notificar Candidato'}
                 </button>
               </div>
             </div>
           )}

           {status !== 'Em Contratação' && (
             <div className="bg-stone-50 border border-stone-200 p-4 rounded-2xl mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
               <div>
                 <p className="font-bold text-stone-800 text-sm">Status Atual: {status || 'Enviado'}</p>
                 <p className="text-stone-500 text-xs">Mova o candidato para "Em Contratação" para disparar a solicitação completa de documentos.</p>
               </div>
               <button 
                 onClick={handleRequestDocuments} 
                 disabled={saving} 
                 className="bg-terracotta-600 hover:bg-terracotta-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50 shrink-0"
               >
                  <FileText className="w-4 h-4" /> Iniciar Contratação & Solicitar Todos
               </button>
             </div>
           )}

           <div className="space-y-3 mt-4">
              <p className="text-stone-500 text-xs font-medium mb-2">Lista de documentos solicitados para este candidato ({requiredDocs.length}):</p>
              {requiredDocs.length === 0 && <p className="text-stone-400 text-xs italic">Nenhum documento configurado.</p>}
              
              {requiredDocs.map((docItem: any) => {
                 const candDoc = onboardingDocs[docItem.id];
                 const isCustom = extraDocs.some((ed: any) => ed.id === docItem.id);

                 return (
                   <div key={docItem.id} className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-stone-900 text-sm">{docItem.name} {docItem.required && '*'}</p>
                          {isCustom && (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Extra Solicitado
                            </span>
                          )}
                        </div>
                        {docItem.instructions && (
                          <p className="text-xs text-stone-500 mt-0.5">{docItem.instructions}</p>
                        )}
                        {candDoc ? (
                           <div className="flex items-center gap-2 mt-1.5">
                             <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                               candDoc.status === 'approved' ? 'bg-green-100 text-green-700' :
                               candDoc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                               'bg-amber-100 text-amber-700'
                             }`}>
                               {candDoc.status === 'approved' ? 'Aprovado' : candDoc.status === 'rejected' ? 'Reprovado' : 'Em Análise'}
                             </span>
                             <span className="text-xs text-stone-500">{new Date(candDoc.uploadedAt).toLocaleDateString()}</span>
                           </div>
                        ) : (
                           <span className="text-xs text-stone-400 font-medium inline-block mt-1">Aguardando envio pelo candidato...</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {candDoc?.url && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button 
                              type="button"
                              onClick={() => setPreviewDoc({ id: docItem.id, name: docItem.name, url: candDoc.url, status: candDoc.status, feedback: candDoc.feedback })}
                              className="px-3 py-1.5 bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Visualizar documento na tela"
                            >
                              <Eye className="w-3.5 h-3.5" /> Visualizar
                            </button>

                            <button 
                              type="button"
                              onClick={() => downloadBase64File(candDoc.url, `Doc_${docItem.name}`)}
                              className="px-2.5 py-1.5 bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Baixar arquivo diretamente"
                            >
                              <Download className="w-3.5 h-3.5" /> Baixar
                            </button>
                            
                            {candDoc.status !== 'approved' && (
                              <button 
                                type="button"
                                onClick={() => handleDocAction(docItem.id, 'approved')}
                                className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              >
                                Aprovar
                              </button>
                            )}

                            {candDoc.status !== 'rejected' && (
                              <button 
                                type="button"
                                onClick={() => {
                                   const reason = prompt("Motivo da reprovação (enviado ao candidato):", candDoc.feedback || "");
                                   if (reason !== null) handleDocAction(docItem.id, 'rejected', reason);
                                }}
                                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              >
                                Reprovar
                              </button>
                            )}
                          </div>
                        )}

                        <label 
                          className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Anexar arquivo diretamente como empresa"
                        >
                          <Upload className="w-3.5 h-3.5 text-stone-600" />
                          <span>{candDoc?.url ? 'Reanexar' : 'Anexar (Empresa)'}</span>
                          <input 
                            type="file" 
                            accept="image/*,.pdf,.doc,.docx"
                            className="hidden" 
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleCompanyFileUpload(docItem.id, e.target.files[0]);
                              }
                            }} 
                          />
                        </label>

                        {isCustom && !candDoc?.url && (
                          <button
                            onClick={() => handleRemoveCustomDocument(docItem.id)}
                            title="Remover este documento extra"
                            className="p-1.5 hover:bg-red-100 text-red-500 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                   </div>
                 );
              })}
           </div>
        </div>
        
        {(application.documentsRequested || ['DOCUMENTS_REQUESTED', 'DOCUMENTS_SUBMITTED', 'HIRED'].includes(application.status)) && (
          <div className="mt-8">
            <ApplicationChat
              applicationId={application.id}
              canRequestDocuments
              onApplicationUpdated={onUpdated}
            />
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            {saving ? 'Salvando...' : 'Fechar e Salvar Tudo'}
          </button>
        </div>
      </div>

      {/* IN-APP DOCUMENT PREVIEWER OVERLAY MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 md:p-6 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 bg-stone-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-terracotta-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">{previewDoc.name}</h3>
                  <p className="text-xs text-stone-400">{application.candidateName}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {previewDoc.status === 'approved' ? (
                  <span className="px-2.5 py-1 bg-green-500/20 text-green-300 text-xs font-bold rounded-lg border border-green-500/30">
                    ✓ Aprovado
                  </span>
                ) : previewDoc.status === 'rejected' ? (
                  <span className="px-2.5 py-1 bg-red-500/20 text-red-300 text-xs font-bold rounded-lg border border-red-500/30">
                    ✕ Reprovado
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 text-xs font-bold rounded-lg border border-amber-500/30">
                    ⏳ Em Análise
                  </span>
                )}

                <button 
                  onClick={() => downloadBase64File(previewDoc.url, previewDoc.name)}
                  className="p-2 hover:bg-stone-800 rounded-lg transition-colors text-stone-300 hover:text-white cursor-pointer"
                  title="Baixar Arquivo"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button 
                  onClick={() => openBase64InNewTab(previewDoc.url, previewDoc.name)}
                  className="p-2 hover:bg-stone-800 rounded-lg transition-colors text-stone-300 hover:text-white cursor-pointer"
                  title="Abrir em Nova Aba"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>

                <button 
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 hover:bg-stone-800 rounded-lg transition-colors text-stone-300 hover:text-white ml-2 cursor-pointer"
                  title="Fechar Visualizador"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PREVIEW CONTAINER */}
            <div className="flex-1 bg-stone-100 p-2 md:p-4 overflow-auto flex items-center justify-center relative">
              {previewDoc.url.startsWith('data:image/') || previewDoc.url.endsWith('.png') || previewDoc.url.endsWith('.jpg') || previewDoc.url.endsWith('.jpeg') ? (
                <img 
                  src={previewDoc.url} 
                  alt={previewDoc.name} 
                  className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                />
              ) : (
                <iframe 
                  src={previewDoc.url} 
                  title={previewDoc.name}
                  className="w-full h-full rounded-lg border border-stone-200 bg-white"
                />
              )}
            </div>

            {/* FOOTER ACTIONS INSIDE PREVIEW MODAL */}
            <div className="p-4 bg-white border-t border-stone-200 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
              <div className="text-xs text-stone-500 font-medium">
                {previewDoc.status === 'rejected' && previewDoc.feedback && (
                  <span className="text-red-600 font-bold">Motivo da recusa: {previewDoc.feedback}</span>
                )}
              </div>
              <div className="flex gap-2">
                {previewDoc.status !== 'approved' && (
                  <button 
                    onClick={() => handleDocAction(previewDoc.id, 'approved')}
                    className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-800 text-xs font-bold rounded-xl transition-colors"
                  >
                    Aprovar Documento
                  </button>
                )}
                {previewDoc.status !== 'rejected' && (
                  <button 
                    onClick={() => {
                      const reason = prompt("Motivo da reprovação (enviado ao candidato):", previewDoc.feedback || "");
                      if (reason !== null) handleDocAction(previewDoc.id, 'rejected', reason);
                    }}
                    className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold rounded-xl transition-colors"
                  >
                    Reprovar Documento
                  </button>
                )}
                <button 
                  onClick={() => setPreviewDoc(null)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
