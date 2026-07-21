import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Plus, Trash2, Save, FileText, Loader2, ArrowLeft, Tag, Layers, Settings, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const SYSTEM_DEFAULT_STATUSES = [
  'Enviado',
  'Em Análise',
  'Entrevista Agendada',
  'Teste Técnico',
  'Em Contratação',
  'Aguardando Exame Médico',
  'Aprovado',
  'Não Classificado'
];

export const DEFAULT_HIRING_DOCUMENTS = [
  { id: 'doc-rg', name: 'RG ou CNH', required: true, instructions: 'Frente e verso' },
  { id: 'doc-cpf', name: 'CPF', required: true, instructions: 'Caso não conste no RG' },
  { id: 'doc-residencia', name: 'Comprovante de Residência', required: true, instructions: 'Máximo 3 meses' }
];

export function CompanyHiringConfig() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const lastDocRef = useRef<HTMLDivElement>(null);
  
  const [documents, setDocuments] = useState<any[]>(DEFAULT_HIRING_DOCUMENTS);

  const [customStatuses, setCustomStatuses] = useState<string[]>([
    'Entrevista com Gestor',
    'Banco de Reserva'
  ]);
  const [newStatusInput, setNewStatusInput] = useState('');

  const [defaultJobDurationDays, setDefaultJobDurationDays] = useState('30');
  const [notifyOnNewCandidate, setNotifyOnNewCandidate] = useState(true);

  useEffect(() => {
    if (user) {
      loadConfig();
    }
  }, [user]);

  const loadConfig = async () => {
    try {
      let docRef = await getDoc(doc(db, 'company_hiring_config', user!.uid));
      if (!docRef.exists() && profile?.companyId) {
        docRef = await getDoc(doc(db, 'company_hiring_config', profile.companyId));
      }
      if (docRef.exists()) {
        const data = docRef.data();
        if (data.documents && Array.isArray(data.documents)) {
          setDocuments(data.documents);
        }
        if (data.customStatuses && Array.isArray(data.customStatuses)) {
          setCustomStatuses(data.customStatuses);
        }
        if (data.defaultJobDurationDays) {
          setDefaultJobDurationDays(String(data.defaultJobDurationDays));
        }
        if (data.notifyOnNewCandidate !== undefined) {
          setNotifyOnNewCandidate(data.notifyOnNewCandidate);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        documents,
        customStatuses,
        defaultJobDurationDays: Number(defaultJobDurationDays) || 30,
        notifyOnNewCandidate,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'company_hiring_config', user!.uid), payload, { merge: true });
      if (profile?.companyId) {
        await setDoc(doc(db, 'company_hiring_config', profile.companyId), payload, { merge: true });
      }
      alert('Configurações salvas com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const addDocument = () => {
    const newDocId = 'doc-' + Date.now();
    setDocuments(prev => [...prev, { id: newDocId, name: '', required: true, instructions: '' }]);
    
    // Auto scroll down to the newly created document
    setTimeout(() => {
      lastDocRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const removeDocument = (id: string) => {
    setDocuments(documents.filter(d => d.id !== id));
  };

  const updateDocument = (id: string, field: string, value: any) => {
    setDocuments(documents.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const handleAddCustomStatus = () => {
    const trimmed = newStatusInput.trim();
    if (!trimmed) return;
    if (SYSTEM_DEFAULT_STATUSES.includes(trimmed) || customStatuses.includes(trimmed)) {
      alert('Este status já existe.');
      return;
    }
    setCustomStatuses([...customStatuses, trimmed]);
    setNewStatusInput('');
  };

  const handleRemoveCustomStatus = (statusName: string) => {
    setCustomStatuses(customStatuses.filter(s => s !== statusName));
  };

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-terracotta-500" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="w-10 h-10 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-full flex items-center justify-center transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-bold text-stone-900">Configurações do Processo Seletivo</h1>
          <p className="text-stone-500 text-sm">Personalize documentos exigidos, etapas de status e preferências das vagas.</p>
        </div>
      </div>

      {/* SECTION 1: Documentos Exigidos */}
      <div className="bg-white border border-stone-200 rounded-3xl p-6 md:p-8 space-y-6">
        <div className="flex justify-between items-center border-b border-stone-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-terracotta-600" />
              Documentos Exigidos para Admissão
            </h2>
            <p className="text-xs text-stone-500">Documentos que serão solicitados ao candidato ao mover para a fase "Em Contratação".</p>
          </div>
          <button 
            type="button"
            onClick={addDocument}
            className="bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Novo Documento
          </button>
        </div>

        <div className="space-y-4">
          {documents.map((doc, idx) => (
            <div 
              key={doc.id} 
              ref={idx === documents.length - 1 ? lastDocRef : null}
              className="bg-stone-50 p-5 rounded-2xl border border-stone-200/80 flex gap-4 items-start animate-in fade-in"
            >
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Nome do Documento *</label>
                    <input 
                      value={doc.name}
                      onChange={(e) => updateDocument(doc.id, 'name', e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white text-sm"
                      placeholder="Ex: Título de Eleitor, Comprovante de Residência"
                    />
                  </div>
                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={doc.required}
                        onChange={(e) => updateDocument(doc.id, 'required', e.target.checked)}
                        className="w-5 h-5 rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500" 
                      />
                      <span className="text-sm font-medium text-stone-700">Obrigatório</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Instruções / Ajuda para o Candidato</label>
                  <input 
                    value={doc.instructions}
                    onChange={(e) => updateDocument(doc.id, 'instructions', e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white text-sm"
                    placeholder="Ex: Enviar imagem em alta resolução frente e verso."
                  />
                </div>
              </div>
              <button 
                type="button"
                onClick={() => removeDocument(doc.id)}
                className="text-stone-400 hover:text-red-600 p-2 transition-colors cursor-pointer"
                title="Remover Documento"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>

        {/* Button at the end of document list */}
        <div className="pt-2 flex justify-center">
          <button 
            type="button"
            onClick={addDocument}
            className="w-full py-3.5 border-2 border-dashed border-terracotta-300 hover:border-terracotta-500 hover:bg-terracotta-50/50 text-terracotta-700 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer text-sm"
          >
            <Plus className="w-5 h-5" />
            Adicionar Mais Um Documento Exigido
          </button>
        </div>
      </div>

      {/* SECTION 2: Status Personalizados do Funil de Seleção */}
      <div className="bg-white border border-stone-200 rounded-3xl p-6 md:p-8 space-y-6">
        <div className="border-b border-stone-100 pb-4">
          <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-terracotta-600" />
            Status das Candidaturas (Pipeline)
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Você pode usar os status padrão do sistema e cadastrar etapas personalizadas para o processo da sua empresa.
          </p>
        </div>

        {/* System defaults preview */}
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">
            Status Padrões do Sistema (Fixos)
          </label>
          <div className="flex flex-wrap gap-2">
            {SYSTEM_DEFAULT_STATUSES.map(st => (
              <span key={st} className="bg-stone-100 border border-stone-200 text-stone-700 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-stone-400" />
                {st}
              </span>
            ))}
          </div>
        </div>

        {/* Custom Statuses */}
        <div className="pt-4 border-t border-stone-100">
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">
            Status Personalizados da Sua Empresa
          </label>
          
          <div className="flex gap-2 mb-4">
            <input 
              value={newStatusInput}
              onChange={(e) => setNewStatusInput(e.target.value)}
              placeholder="Ex: Entrevista com Diretoria, Teste Prático, Checagem de Referências"
              className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 text-sm"
              onKeyDown={(e) => { if(e.key === 'Enter') handleAddCustomStatus(); }}
            />
            <button 
              type="button"
              onClick={handleAddCustomStatus}
              className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Cadastrar Status
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {customStatuses.length === 0 ? (
              <p className="text-xs text-stone-400 italic">Nenhum status personalizado cadastrado.</p>
            ) : (
              customStatuses.map(st => (
                <span key={st} className="bg-terracotta-50 border border-terracotta-200 text-terracotta-800 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-terracotta-500" />
                  {st}
                  <button 
                    type="button"
                    onClick={() => handleRemoveCustomStatus(st)}
                    className="hover:text-red-600 ml-1 text-stone-400"
                    title="Remover este status personalizado"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: Opções Gerais de Vagas */}
      <div className="bg-white border border-stone-200 rounded-3xl p-6 md:p-8 space-y-6">
        <div className="border-b border-stone-100 pb-4">
          <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-terracotta-600" />
            Opções Gerais de Vagas e Candidatos
          </h2>
          <p className="text-xs text-stone-500 mt-1">Configurações padrão para novas vagas cadastradas.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">
              Prazo Padrão para Captação de Currículos (Dias)
            </label>
            <input 
              type="number"
              value={defaultJobDurationDays}
              onChange={(e) => setDefaultJobDurationDays(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 text-sm"
              placeholder="30"
            />
            <p className="text-[11px] text-stone-400 mt-1">
              Defina a duração padrão das vagas antes de entrarem em fase de encerramento.
            </p>
          </div>

          <div className="flex items-center pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={notifyOnNewCandidate}
                onChange={(e) => setNotifyOnNewCandidate(e.target.checked)}
                className="w-5 h-5 rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500" 
              />
              <div>
                <span className="text-sm font-bold text-stone-800">Notificação Interna</span>
                <p className="text-xs text-stone-500">Destacar no painel quando novos candidatos se inscreverem.</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Bottom Save Bar */}
      <div className="flex justify-end pt-4">
        <button 
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-stone-900 hover:bg-stone-800 text-white px-8 py-3.5 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
        >
          <Save className="w-5 h-5" /> {saving ? 'Salvando...' : 'Salvar Todas as Configurações'}
        </button>
      </div>
    </div>
  );
}
