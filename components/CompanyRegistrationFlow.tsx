import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Search, CheckCircle2, Loader2, FileText, ArrowRight } from 'lucide-react';
import { FileUpload } from './FileUpload';
import { useNavigate } from 'react-router-dom';

export function CompanyRegistrationFlow({ onComplete }: { onComplete: () => void }) {
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  
  const [searchingCompanies, setSearchingCompanies] = useState(false);
  const [companyMatches, setCompanyMatches] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);

  useEffect(() => {
    if (companyName.length >= 3 && !selectedCompany) {
      const timer = setTimeout(async () => {
        setSearchingCompanies(true);
        try {
          const res = await api.get(`/companies/search?q=${companyName}`);
          setCompanyMatches(res.data);
        } catch (e) {
          console.error(e);
        } finally {
          setSearchingCompanies(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setCompanyMatches([]);
    }
  }, [companyName, selectedCompany]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    setLoading(true);
    try {
      if (selectedCompany) {
        // Request access to existing company
        await api.post(`/companies/${selectedCompany.id}/access-requests`, {});
      } else {
        // Create new company
        await api.post('/companies/register', {
          name: companyName,
          description: companyDescription,
          logoURL: companyLogo
        });
      }
      await refreshProfile();
      onComplete();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Ocorreu um erro ao processar o cadastro da empresa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-200">
        <div className="mb-8">
          <div className="w-16 h-16 bg-terracotta-50 rounded-2xl flex items-center justify-center text-terracotta-600 mb-6">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-stone-900">
            Cadastrar ou Buscar Empresa
          </h2>
          <p className="text-stone-500 mt-2 leading-relaxed">
            Se a sua empresa já está na plataforma (talvez anunciamos vagas dela anteriormente), você pode solicitar o vínculo. Caso contrário, crie um novo cadastro.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Nome da Empresa *</label>
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
            {searchingCompanies && (
              <p className="mt-2 text-xs text-stone-500 flex items-center gap-1">
                <Search className="w-3.5 h-3.5 animate-pulse" /> Buscando empresas…
              </p>
            )}
            
            {!selectedCompany && companyMatches.length > 0 && (
              <div className="mt-2 rounded-xl border border-stone-200 overflow-hidden bg-white">
                <p className="px-3 py-2 text-xs font-bold text-stone-500 bg-stone-50">
                  Encontramos empresas parecidas. Se for a sua, clique para solicitar vínculo:
                </p>
                {companyMatches.map(company => (
                  <button 
                    type="button" 
                    key={company.id} 
                    onClick={() => { 
                      setSelectedCompany(company); 
                      setCompanyName(company.name); 
                      setCompanyMatches([]); 
                    }} 
                    className="w-full px-3 py-3 text-left hover:bg-terracotta-50 border-t border-stone-100 transition-colors"
                  >
                    <span className="font-bold text-sm text-stone-800">{company.name}</span>
                    <span className="block text-xs text-stone-500">{company.cityState || 'Localização não informada'}</span>
                  </button>
                ))}
              </div>
            )}

            {selectedCompany && (
              <div className="mt-3 rounded-xl border border-terracotta-200 bg-terracotta-50 p-4">
                <div className="flex gap-3 text-terracotta-900">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-sm">{selectedCompany.name}</strong>
                    <p className="mt-1 text-xs leading-relaxed text-terracotta-800">
                      Você solicitará vínculo com esta empresa. Se ela já tiver gestores, eles receberão seu pedido. Se não, um administrador da plataforma analisará sua solicitação.
                    </p>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => { setSelectedCompany(null); setCompanyName(''); }} 
                  className="mt-3 text-xs font-bold text-terracotta-700 hover:underline"
                >
                  Escolher outra empresa
                </button>
              </div>
            )}

            {!selectedCompany && companyName.trim().length >= 3 && !searchingCompanies && companyMatches.length === 0 && (
              <p className="mt-2 text-xs font-medium text-stone-500">
                Não encontramos nenhuma empresa com este nome. Um novo cadastro será criado.
              </p>
            )}
          </div>

          {!selectedCompany && (
            <>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Descrição Curta (Opcional)</label>
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
                  placeholder="Selecione ou arraste o logotipo"
                />
              </div>
            </>
          )}

          <div className="flex justify-end pt-4 border-t border-stone-100">
            <button 
              type="submit"
              disabled={loading || !companyName.trim()}
              className="flex items-center justify-center gap-2 bg-stone-900 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : selectedCompany ? (
                'Solicitar Vínculo'
              ) : (
                'Criar Nova Empresa'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
