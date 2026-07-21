import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc, onSnapshot, addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Loader2, ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Save, Smartphone, QrCode, FileText, Check, Lock, Send, Clock } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { FileUpload } from '../components/FileUpload';
import { DEFAULT_HIRING_DOCUMENTS } from './CompanyHiringConfig';
import { openBase64InNewTab } from '../lib/fileViewer';

export function CandidateOnboardingPage() {
  const { appId } = useParams<{ appId: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<any>(null);
  const [companyConfig, setCompanyConfig] = useState<any>(null);
  const [is404, setIs404] = useState(false);
  
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [consentStorage, setConsentStorage] = useState(true);
  const [showMainQrModal, setShowMainQrModal] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (appId && user) {
        setIs404(false);
        setLoading(true);

        // Real-time synchronization across devices (Mobile & Desktop)
        const unsubscribe = onSnapshot(doc(db, 'applications', appId), async (appSnap) => {
          if (appSnap.exists()) {
            const appData = appSnap.data();
            let companyOwnerId = appData.companyId;

            if (appData.jobId) {
              try {
                const jobRef = await getDoc(doc(db, 'jobs', appData.jobId));
                if (jobRef.exists()) {
                  companyOwnerId = companyOwnerId || jobRef.data().ownerId || jobRef.data().companyId;
                }
              } catch (e) {}
            }

            // Sync candidateId if missing or different
            if (user?.uid && (profile?.type === 'CANDIDATE' || !appData.candidateId || appData.candidateId !== user.uid)) {
              if (!appData.candidateId || (user.email && appData.candidateEmail && appData.candidateEmail.toLowerCase() === user.email.toLowerCase())) {
                try {
                  await updateDoc(doc(db, 'applications', appSnap.id), { 
                    candidateId: user.uid,
                    candidateEmail: user.email || appData.candidateEmail || ''
                  });
                  appData.candidateId = user.uid;
                } catch (e) {
                  console.error('Failed to sync candidateId:', e);
                }
              }
            }

            setApplication({ id: appSnap.id, ...appData });
            if (appData.onboardingDocs) {
              setUploadedDocs(appData.onboardingDocs);
            }

            // Load company hiring config
            const idsToTry = Array.from(new Set([appData.companyId, companyOwnerId, profile?.companyId, profile?.uid].filter(Boolean)));
            for (const cid of idsToTry) {
              const compRef = await getDoc(doc(db, 'company_hiring_config', cid as string));
              if (compRef.exists()) {
                setCompanyConfig(compRef.data());
                break;
              }
            }
            setLoading(false);
          } else {
            setIs404(true);
            setLoading(false);
          }
        }, (error) => {
          console.error("onSnapshot error:", error);
          setIs404(true);
          setLoading(false);
        });

        return () => unsubscribe();
      } else if (!user) {
        navigate(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`, { replace: true });
      }
    }
  }, [appId, user, authLoading]);

  const handleUpload = async (docId: string, base64: string) => {
    const currentDoc = uploadedDocs[docId];
    const newDocs = { 
      ...uploadedDocs, 
      [docId]: { 
        url: base64, 
        status: 'pending', // reset status to pending when re-uploaded
        uploadedAt: new Date().toISOString(),
        feedback: ''
      } 
    };
    setUploadedDocs(newDocs);
    await saveDocs(newDocs);
  };

  const saveDocs = async (docs: any) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'applications', appId!), {
        onboardingDocs: docs,
        submittedForReview: true,
        onboardingStatus: 'under_review',
        updatedAt: new Date().toISOString()
      });

      if (consentStorage && user) {
        const profileRef = doc(db, 'users', user.uid);
        const pSnap = await getDoc(profileRef);
        if (pSnap.exists()) {
          const currentSaved = pSnap.data().savedDocs || {};
          const docsToSave: any = { ...currentSaved };
          const activeDocsList = (companyConfig?.documents && companyConfig.documents.length > 0)
            ? companyConfig.documents
            : DEFAULT_HIRING_DOCUMENTS;
          const allActiveDocs = [...activeDocsList, ...(application?.customDocs || [])];
          for (const d of allActiveDocs) {
            if (docs[d.id] && docs[d.id].url) {
              docsToSave[d.name] = docs[d.id].url;
            }
          }
          await updateDoc(profileRef, { savedDocs: docsToSave });
        }
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar o documento.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmAndSubmit = async () => {
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'applications', appId!), {
        submittedForReview: true,
        onboardingStatus: 'under_review',
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Notify company
      if (application?.companyId) {
        try {
          await addDoc(collection(db, 'notifications'), {
            userId: application.companyId,
            type: 'ONBOARDING_SUBMITTED',
            title: 'Documentos Recebidos para Análise',
            message: `O candidato ${profile?.socialName || profile?.name || 'Candidato'} enviou a documentação de admissão da vaga ${application.jobTitle}.`,
            jobId: application.jobId,
            appId: application.id,
            read: false,
            createdAt: new Date().toISOString()
          });
        } catch (e) {}
      }

      alert('Documentação enviada para análise da empresa com sucesso! Seus documentos estão agora bloqueados aguardando validação.');
    } catch (e) {
      console.error(e);
      alert('Erro ao confirmar envio.');
    } finally {
      setSubmitting(false);
    }
  };

  const autofillFromProfile = async () => {
    if (!profile?.savedDocs) {
       alert("Você não possui documentos salvos anteriormente no seu perfil.");
       return;
    }
    const newDocs = { ...uploadedDocs };
    const activeDocsList = (companyConfig?.documents && companyConfig.documents.length > 0)
      ? companyConfig.documents
      : DEFAULT_HIRING_DOCUMENTS;
    const requiredDocs = [...activeDocsList, ...(application?.customDocs || [])];

    let filled = 0;
    for (const docItem of requiredDocs) {
      if (profile.savedDocs[docItem.name] && (!newDocs[docItem.id] || newDocs[docItem.id].status === 'rejected')) {
        newDocs[docItem.id] = {
           url: profile.savedDocs[docItem.name],
           status: 'pending',
           uploadedAt: new Date().toISOString()
        };
        filled++;
      }
    }
    
    if (filled > 0) {
       setUploadedDocs(newDocs);
       await saveDocs(newDocs);
       alert(`${filled} documento(s) preenchidos automaticamente com base no seu perfil!`);
    } else {
       alert("Nenhum documento salvo correspondente foi encontrado.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-terracotta-500" />
      </div>
    );
  }

  if (is404 || !application) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-xs space-y-4">
          <div className="text-6xl font-serif font-bold text-stone-300">404</div>
          <h2 className="text-xl font-bold text-stone-900">Página Não Encontrada</h2>
          <p className="text-stone-500 text-xs leading-relaxed">
            O conteúdo que você está procurando não existe, foi removido ou não está disponível para o seu perfil.
          </p>
          <Link to="/dashboard" className="bg-stone-900 hover:bg-stone-800 text-white font-bold px-6 py-2.5 rounded-xl transition-colors inline-block text-xs">
            Voltar ao Painel
          </Link>
        </div>
      </div>
    );
  }

  // Base docs from company config + custom docs for this specific candidate application
  const baseDocs = (companyConfig?.documents && companyConfig.documents.length > 0)
    ? companyConfig.documents
    : DEFAULT_HIRING_DOCUMENTS;

  const extraDocs = application?.customDocs || [];
  const allDocsMap = new Map();

  baseDocs.forEach((d: any) => allDocsMap.set(d.id, d));
  extraDocs.forEach((d: any) => allDocsMap.set(d.id, d));

  const requiredDocs = Array.from(allDocsMap.values());

  const sentCount = requiredDocs.filter((d: any) => uploadedDocs[d.id]?.url).length;
  const progress = requiredDocs.length === 0 ? 0 : Math.round((sentCount / requiredDocs.length) * 100);

  const isSubmitted = application?.submittedForReview === true;
  const hasRejectedDocs = requiredDocs.some((d: any) => uploadedDocs[d.id]?.status === 'rejected');
  const allApproved = requiredDocs.length > 0 && requiredDocs.every((d: any) => uploadedDocs[d.id]?.status === 'approved');

  const mainQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.location.href)}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button & Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-stone-200 pb-4">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="w-10 h-10 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-full flex items-center justify-center transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Admissão & Documentação
            </span>
            <h1 className="text-2xl font-serif font-bold text-stone-900 mt-1">
              Envio de Documentos para Admissão
            </h1>
            <p className="text-stone-500 text-xs mt-0.5">
              Vaga: <strong>{application.jobTitle}</strong> • Empresa: <strong>{application.companyName}</strong>
            </p>
          </div>
        </div>

        {/* Mobile QR Button - Visible on Desktop only */}
        <button
          type="button"
          onClick={() => setShowMainQrModal(true)}
          className="hidden md:flex bg-stone-900 hover:bg-stone-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold items-center gap-2 transition-colors cursor-pointer shadow-xs shrink-0"
        >
          <Smartphone className="w-4 h-4 text-amber-300" />
          Tirar Fotos pelo Celular (QR)
        </button>
      </div>

      {/* OVERALL STATUS BANNER */}
      {allApproved ? (
        <div className="bg-green-50 border border-green-200 p-5 rounded-2xl flex items-center gap-3.5 text-green-900 animate-in fade-in">
          <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
          <div>
            <p className="font-bold text-sm">Todos os Documentos Aprovados!</p>
            <p className="text-xs text-green-700 mt-0.5">
              A empresa validou com sucesso toda a sua documentação de admissão. Você não precisa realizar mais nenhuma ação.
            </p>
          </div>
        </div>
      ) : hasRejectedDocs ? (
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-start gap-3.5 text-amber-900 animate-in fade-in">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Atenção: Necessário Corrigir Documento(s)</p>
            <p className="text-xs text-amber-800 mt-0.5">
              A empresa solicitou o reenvio dos documentos assinalados em vermelho abaixo. Faça o upload do novo arquivo correto e clique em <strong>"Reenviar Correções para Análise"</strong>.
            </p>
          </div>
        </div>
      ) : isSubmitted ? (
        <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl flex items-center gap-3.5 text-blue-900 animate-in fade-in">
          <Clock className="w-6 h-6 text-blue-600 shrink-0 animate-pulse" />
          <div>
            <p className="font-bold text-sm">Documentação em Análise pela Empresa</p>
            <p className="text-xs text-blue-800 mt-0.5">
              Seus documentos foram confirmados e enviados com sucesso! Enquanto a empresa analisa, os arquivos estão bloqueados para alteração. Caso algum documento precise de correção, você será notificado.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-stone-50 border border-stone-200 p-5 rounded-2xl flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-terracotta-600 shrink-0" />
            <div>
              <p className="font-bold text-stone-900 text-sm">Em Preenchimento</p>
              <p className="text-xs text-stone-500">
                Anexe os arquivos solicitados abaixo. Após conferir todos os documentos, clique em <strong>"Confirmar e Enviar para Análise"</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Progress & Quick Actions Card */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-stone-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h2 className="font-bold text-stone-900 text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-terracotta-600" />
              Progresso de Envio dos Documentos
            </h2>
            <p className="text-xs text-stone-500">
              Você anexou {sentCount} de {requiredDocs.length} documentos solicitados.
            </p>
          </div>
          <span className="text-2xl font-serif font-bold text-terracotta-600">
            {progress}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-stone-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-stone-200/50">
          <div 
            className="bg-gradient-to-r from-terracotta-500 to-amber-500 h-2.5 rounded-full transition-all duration-500" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {saving && (
          <div className="text-xs text-stone-500 flex items-center gap-2 italic">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-terracotta-600" />
            Sincronizando em tempo real...
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-4 border-t border-stone-100">
          <label className="flex items-start gap-3 cursor-pointer max-w-xl">
            <input 
              type="checkbox" 
              checked={consentStorage}
              onChange={(e) => setConsentStorage(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500" 
            />
            <span className="text-xs text-stone-600 leading-relaxed">
              Salvar automaticamente uma cópia destes documentos no meu perfil para reutilizar em futuras candidaturas.
            </span>
          </label>

          {profile?.savedDocs && Object.keys(profile.savedDocs).length > 0 && !isSubmitted && (
            <button 
              type="button"
              onClick={autofillFromProfile} 
              className="bg-stone-100 hover:bg-stone-200 text-stone-800 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shrink-0 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-terracotta-600" /> Auto-preencher Documentos Salvos
            </button>
          )}
        </div>
      </div>

      {/* Document Upload List */}
      <div className="space-y-4">
        {requiredDocs.map((docItem: any) => {
          const currentDoc = uploadedDocs[docItem.id];
          const isUploaded = !!currentDoc?.url;
          const isApproved = currentDoc?.status === 'approved';
          const isRejected = currentDoc?.status === 'rejected';

          // Editable if not yet approved by company (allows uploading new files like ASO or replacing pending/rejected ones)
          const canEdit = !isApproved;

          return (
            <div 
              key={docItem.id} 
              className={`bg-white p-6 rounded-3xl border transition-all ${
                isApproved ? 'border-green-200 bg-green-50/20' :
                isRejected ? 'border-red-300 bg-red-50/30' :
                isUploaded ? 'border-blue-200 bg-blue-50/10' :
                'border-stone-200'
              }`}
            >
              <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-stone-900 text-base">{docItem.name}</h3>
                    {docItem.required && (
                      <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded uppercase">
                        Obrigatório
                      </span>
                    )}
                    {isApproved && (
                      <span className="text-[10px] bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1">
                        <Check className="w-3 h-3" /> Aprovado pela Empresa
                      </span>
                    )}
                    {isRejected && (
                      <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Necessário Reenviar
                      </span>
                    )}
                    {isUploaded && !isApproved && !isRejected && (
                      <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1">
                        <Lock className="w-3 h-3 text-blue-600" /> Enviado • Em Análise
                      </span>
                    )}
                  </div>

                  {docItem.instructions && (
                    <p className="text-xs text-stone-500 leading-relaxed">
                      {docItem.instructions}
                    </p>
                  )}

                  {isRejected && currentDoc.feedback && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Motivo do reenvio:</strong> {currentDoc.feedback}
                      </div>
                    </div>
                  )}
                </div>

                <div className="w-full md:w-80 shrink-0">
                  {/* LOCKED STATE FOR APPROVED DOCUMENTS */}
                  {!canEdit && isUploaded ? (
                    <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-center space-y-2.5">
                      <div className="flex items-center justify-center gap-2 text-xs font-bold text-stone-700">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span>Documento Validado</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openBase64InNewTab(currentDoc.url, `Doc_${docItem.name}`)}
                        className="w-full bg-white hover:bg-stone-100 text-stone-800 border border-stone-200 font-bold text-xs py-2 px-3 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5 text-stone-500" /> Ver Arquivo Anexado
                      </button>
                    </div>
                  ) : (
                    <FileUpload 
                      label={currentDoc?.url ? `Substituir ${docItem.name}` : `Anexar ${docItem.name}`}
                      accept=".pdf,.png,.jpg,.jpeg"
                      value={currentDoc?.url || ''}
                      onChange={(base64) => handleUpload(docItem.id, base64)}
                      type="document"
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FINAL SUBMIT / CONFIRMATION BAR */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="font-bold text-stone-900 text-sm">
            {isSubmitted && !hasRejectedDocs ? 'Documentação Enviada para Análise' : 'Conclusão do Envio de Documentos'}
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            {isSubmitted && !hasRejectedDocs
              ? 'Seus arquivos estão salvos e sincronizados com a equipe de RH.'
              : 'Clique no botão ao lado para confirmar o envio e notificar o RH.'}
          </p>
        </div>

        {allApproved ? (
          <div className="bg-green-50 text-green-800 border border-green-200 px-5 py-3 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            Todos os Documentos Aprovados
          </div>
        ) : (
          <button
            type="button"
            onClick={handleConfirmAndSubmit}
            disabled={submitting || sentCount === 0}
            className="w-full sm:w-auto bg-terracotta-600 hover:bg-terracotta-700 text-white font-bold text-xs px-6 py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
              </>
            ) : hasRejectedDocs ? (
              <>
                <Send className="w-4 h-4" /> Reenviar Correções para Análise
              </>
            ) : isSubmitted ? (
              <>
                <Send className="w-4 h-4" /> Notificar Empresa sobre Novos Anexos
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Confirmar e Enviar para Análise
              </>
            )}
          </button>
        )}
      </div>

      {/* QR CODE MODAL FOR MOBILE SCANNING */}
      {showMainQrModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative border border-stone-200">
            <button
              onClick={() => setShowMainQrModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1 rounded-full hover:bg-stone-100 transition-colors"
            >
              ✕
            </button>

            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-700">
              <QrCode className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-stone-900">Continuar no Celular</h3>
              <p className="text-xs text-stone-500 mt-1">
                Aponte a câmera do seu smartphone para o QR Code abaixo para abrir esta mesma página no celular e fotografar seus documentos instantaneamente.
              </p>
            </div>

            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 inline-block">
              <img 
                referrerPolicy="no-referrer"
                src={mainQrUrl} 
                alt="QR Code para abrir no celular"
                className="w-48 h-48 mx-auto rounded-lg"
              />
            </div>

            <p className="text-[11px] text-stone-400">
              Sua sessão sincroniza em tempo real entre o computador e o celular.
            </p>

            <button
              onClick={() => setShowMainQrModal(false)}
              className="w-full bg-stone-900 text-white font-bold text-xs py-3 rounded-xl hover:bg-stone-800 transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

