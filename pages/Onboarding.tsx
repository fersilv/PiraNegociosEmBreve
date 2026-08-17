import React, { useEffect, useState } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { api, asArray } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Building2, CheckCircle2, Loader2, Search, UserCircle } from 'lucide-react';
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
  const [companyMatches, setCompanyMatches] = useState<Array<{ id: string; name: string; cityState?: string; verificationStatus?: string }>>([]);
  const [selectedCompany, setSelectedCompany] = useState<{ id: string; name: string } | null>(null);
  const [searchingCompanies, setSearchingCompanies] = useState(false);
  
  // Candidate fields
  const [bio, setBio] = useState('');
  const [resumeURL, setResumeURL] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Personal fields (For Google Users)
  const [name, setName] = useState(profile?.name || profile?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [socialName, setSocialName] = useState(profile?.socialName || '');
  const [treatment, setTreatment] = useState(profile?.treatment || 'ele/dele');

  useEffect(() => {
    if (step !== 2 || selectedType !== 'COMPANY' || selectedCompany || companyName.trim().length < 2) {
      if (companyName.trim().length < 2) setCompanyMatches([]);
      return;
    }
    const timeout = window.setTimeout(async () => {
      setSearchingCompanies(true);
      try {
        const response = await api.get(`/companies/search?q=${encodeURIComponent(companyName.trim())}`);
        setCompanyMatches(asArray(response.data));
      } catch {
        setCompanyMatches([]);
      } finally {
        setSearchingCompanies(false);
      }
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [companyName, selectedCompany, selectedType, step]);

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
        // The company link is granted only by the server, after ownership or approval.
      } else {
        updates.bio = bio;
        updates.resumeURL = resumeURL;
        updates.photoURL = photoURL;
      }

      if (!profile?.phone) {
        updates.name = name;
        updates.phone = phone;
        updates.socialName = socialName;
        updates.treatment = treatment;
        
        if (profile?.name && !profile?.displayName) {
          updates.displayName = profile.name;
        }
      }

      await api.post('/users/me', updates);
      if (selectedType === 'COMPANY') {
        if (selectedCompany) {
          await api.post(`/companies/${selectedCompany.id}/access-requests`);
        } else {
          await api.post('/companies/register', {
            name: companyName.trim(),
            description: companyDescription,
            logoURL: companyLogo,
            verificationStatus: 'DRAFT',
          });
        }
      }
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

        {step === 2 && !profile?.phone && (
          <div className="space-y-4 mb-8 pb-8 border-b border-stone-200">
            <h3 className="font-bold text-lg text-stone-900 mb-4">Informações Básicas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Nome Completo *</label>
                <input 
                  type="text" 
                  required 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none"
                  placeholder="Seu nome completo"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Telefone *</label>
                <input 
                  type="tel" 
                  required 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Nome Social (Opcional)</label>
                <input 
                  type="text" 
                  value={socialName}
                  onChange={(e) => setSocialName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none"
                  placeholder="Como prefere ser chamado"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Tratamento</label>
                <select 
                  value={treatment}
                  onChange={(e) => setTreatment(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none"
                >
                  <option value="ele/dele">Ele/Dele</option>
                  <option value="ela/dela">Ela/Dela</option>
                  <option value="elu/delu">Elu/Delu</option>
                  <option value="indiferente">Indiferente / Qualquer pronome</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && selectedType === 'COMPANY' && (
          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Busque sua empresa *</label>
              <input 
                type="text" 
                required 
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  setSelectedCompany(null);
                }}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-terracotta-500 outline-none"
                placeholder="Digite o nome da empresa"
              />
              {searchingCompanies && <p className="mt-2 text-xs text-stone-500 flex items-center gap-1"><Search className="w-3.5 h-3.5 animate-pulse" /> Buscando empresas cadastradas…</p>}
              {!selectedCompany && companyMatches.length > 0 && (
                <div className="mt-2 rounded-xl border border-stone-200 overflow-hidden bg-white">
                  <p className="px-3 py-2 text-xs font-bold text-stone-500 bg-stone-50">Encontramos empresas parecidas. Se for a sua, solicite vínculo:</p>
                  {companyMatches.map(company => (
                    <button type="button" key={company.id} onClick={() => { setSelectedCompany(company); setCompanyName(company.name); setCompanyMatches([]); }} className="w-full px-3 py-3 text-left hover:bg-terracotta-50 border-t border-stone-100">
                      <span className="font-bold text-sm text-stone-800">{company.name}</span>
                      <span className="block text-xs text-stone-500">{company.cityState || 'Localização não informada'}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedCompany && (
                <div className="mt-3 rounded-xl border border-terracotta-200 bg-terracotta-50 p-3">
                  <div className="flex gap-2 text-sm text-terracotta-900"><CheckCircle2 className="w-5 h-5 shrink-0" /><div><strong>{selectedCompany.name}</strong><p className="mt-1 text-xs">Você solicitará acesso. Se a empresa já tiver gestores, um deles precisará aprovar e definir seu cargo.</p></div></div>
                  <button type="button" onClick={() => { setSelectedCompany(null); setCompanyName(''); }} className="mt-2 text-xs font-bold text-terracotta-700 hover:underline">Escolher outra empresa</button>
                </div>
              )}
              {!selectedCompany && companyName.trim().length >= 2 && !searchingCompanies && companyMatches.length === 0 && (
                <p className="mt-2 text-xs text-stone-500">Não encontramos esta empresa. Ao finalizar, será criado um novo cadastro sob sua responsabilidade.</p>
              )}
            </div>
            {!selectedCompany && <>
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
            </>}
          </div>
        )}

        {step === 2 && selectedType === 'CANDIDATE' && (
          <div className="space-y-6 mb-8">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Resumo Profissional / Bio (Opcional)</label>
              <textarea 
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
                label="Upload do Currículo (Opcional por enquanto)" 
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
            disabled={
              !selectedType || 
              loading || 
              (step === 2 && !acceptedTerms) || 
              (step === 2 && selectedType === 'COMPANY' && !companyName) || 
              (step === 2 && !profile?.phone && (!name || !phone))
            }
            className="flex items-center justify-center gap-2 bg-terracotta-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-terracotta-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (step === 1 ? 'Continuar' : 'Finalizar Cadastro')}
          </button>
        </div>
      </div>
    </div>
  );
}
