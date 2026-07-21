import React, { useState } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Building2, UserCircle, Loader2 } from 'lucide-react';
import { FileUpload } from '../components/FileUpload';

export function Onboarding() {
  const { user, profile, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<'COMPANY' | 'CANDIDATE' | null>(null);

  // Company fields
  const [companyName, setCompanyName] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  
  // Candidate fields
  const [bio, setBio] = useState('');
  const [resumeURL, setResumeURL] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  if (profile?.type) {
    // If they somehow got here but already have a type
    return <Navigate to="/dashboard" replace />;
  }

  const handleNext = async () => {
    if (step === 1 && selectedType) {
      setStep(2);
      return;
    }

    setLoading(true);
    try {
      if (!user) throw new Error("No user");

      const updates: any = { type: selectedType, acceptedTerms: true };
      
      if (selectedType === 'COMPANY') {
        // TODO: Actually create a company document and link it, but for simplicity let's store basics on user or separate collection
        updates.companyName = companyName;
        updates.companyDescription = companyDescription;
        updates.companyLogo = companyLogo;
        updates.isVerified = false;
      } else {
        updates.bio = bio;
        updates.resumeURL = resumeURL;
        updates.photoURL = photoURL;
      }

      await updateDoc(doc(db, 'users', user.uid), updates);
      await refreshProfile();
      navigate(returnTo || '/dashboard');
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-200">
        <div className="mb-8">
          <h2 className="text-2xl font-serif font-bold text-stone-900">
            {step === 1 ? 'Como você deseja usar o portal?' : 'Complete seu perfil'}
          </h2>
          <p className="text-stone-500 mt-2">
            {step === 1 ? 'Escolha o tipo de conta que melhor se adapta às suas necessidades.' : 'Precisamos de mais algumas informações para continuar.'}
          </p>
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <button
              onClick={() => setSelectedType('CANDIDATE')}
              className={`p-6 rounded-2xl border-2 text-left transition-all ${
                selectedType === 'CANDIDATE' 
                  ? 'border-terracotta-500 bg-terracotta-50' 
                  : 'border-stone-200 hover:border-terracotta-300 bg-white'
              }`}
            >
              <UserCircle className={`w-8 h-8 mb-4 ${selectedType === 'CANDIDATE' ? 'text-terracotta-600' : 'text-stone-400'}`} />
              <h3 className="font-bold text-lg text-stone-900 mb-2">Sou Candidato</h3>
              <p className="text-sm text-stone-500">Quero buscar vagas, cadastrar meu currículo e acompanhar processos seletivos.</p>
            </button>

            <button
              onClick={() => setSelectedType('COMPANY')}
              className={`p-6 rounded-2xl border-2 text-left transition-all ${
                selectedType === 'COMPANY' 
                  ? 'border-terracotta-500 bg-terracotta-50' 
                  : 'border-stone-200 hover:border-terracotta-300 bg-white'
              }`}
            >
              <Building2 className={`w-8 h-8 mb-4 ${selectedType === 'COMPANY' ? 'text-terracotta-600' : 'text-stone-400'}`} />
              <h3 className="font-bold text-lg text-stone-900 mb-2">Sou Anunciante / Empresa</h3>
              <p className="text-sm text-stone-500">Quero divulgar vagas e buscar currículos na base de dados.</p>
            </button>
          </div>
        )}

        {step === 2 && selectedType === 'COMPANY' && (
          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Nome da Empresa *</label>
              <input 
                type="text" 
                required 
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Descrição da Empresa</label>
              <textarea 
                value={companyDescription}
                onChange={(e) => setCompanyDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none min-h-[100px]"
                placeholder="Conte um pouco sobre a empresa..."
              />
            </div>
            <div>
              <FileUpload 
                label="Logotipo da Empresa (Opcional)" 
                accept="image/*" 
                value={companyLogo} 
                onChange={(base64) => setCompanyLogo(base64)} 
                type="avatar"
                placeholder="Selecione ou arraste o logotipo da empresa"
              />
            </div>
          </div>
        )}

        {step === 2 && selectedType === 'CANDIDATE' && (
          <div className="space-y-6 mb-8">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Resumo Profissional / Bio *</label>
              <textarea 
                required
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none min-h-[100px]"
                placeholder="Fale um pouco sobre sua experiência e objetivos..."
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FileUpload 
                label="Foto de Perfil (Opcional)" 
                accept="image/*" 
                value={photoURL} 
                onChange={(base64) => setPhotoURL(base64)} 
                type="avatar"
                placeholder="Selecione ou arraste sua foto de perfil"
              />
              
              <FileUpload 
                label="Upload do Currículo * (PDF ou Imagem)" 
                accept=".pdf,.png,.jpg,.jpeg" 
                value={resumeURL} 
                onChange={(base64) => setResumeURL(base64)} 
                type="resume"
                placeholder="Arraste seu currículo ou clique para buscar"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mb-8">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="flex items-center h-5 mt-0.5">
                <input 
                  type="checkbox"
                  required
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="w-5 h-5 rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500"
                />
              </div>
              <span className="text-sm text-stone-600 leading-relaxed">
                Eu li e concordo com os <a href="/termos" target="_blank" className="text-terracotta-600 hover:underline font-bold">Termos de Uso e Política de Privacidade (LGPD)</a>.
              </span>
            </label>
          </div>
        )}

        <div className="flex justify-end gap-4">
          {step === 2 && (
            <button 
              onClick={() => setStep(1)}
              className="px-6 py-3 text-stone-500 font-bold hover:bg-stone-100 rounded-xl transition-colors"
            >
              Voltar
            </button>
          )}
          <button 
            onClick={handleNext}
            disabled={!selectedType || loading || (step === 2 && !acceptedTerms) || (step === 2 && selectedType === 'COMPANY' && !companyName) || (step === 2 && selectedType === 'CANDIDATE' && (!bio || !resumeURL))}
            className="flex items-center justify-center gap-2 bg-terracotta-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-terracotta-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (step === 1 ? 'Continuar' : 'Finalizar Cadastro')}
          </button>
        </div>
      </div>
    </div>
  );
}
