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
  // Candidate fields
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Personal fields (For Google Users)
  const [name, setName] = useState(profile?.name || profile?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [socialName, setSocialName] = useState(profile?.socialName || '');
  const [treatment, setTreatment] = useState(profile?.treatment || 'ele/dele');

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (!user) throw new Error("No user");

      const updates: any = { acceptedTerms: true };
      
      if (!profile?.phone) {
        updates.displayName = name.trim();
        updates.fullName = name.trim();
        updates.phone = phone;
        updates.socialName = socialName;
        updates.treatment = treatment;
      }

      await api.post('/users/me', updates);
      await refreshProfile();
      navigate(returnTo || '/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      alert('Ocorreu um erro ao concluir o cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-200">
        <div className="mb-8">
          <h2 className="text-2xl font-serif font-bold text-stone-900">
            Complete seu perfil
          </h2>
          <p className="text-stone-500 mt-2">
            Precisamos de algumas informações básicas para finalizar a criação da sua conta.
          </p>
        </div>

        {!profile?.phone && (
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

        <div className="flex justify-end gap-3">
          <button 
            type="button"
            disabled={loading || !acceptedTerms || (!profile?.phone && (!name || !phone))}
            onClick={handleSubmit} 
            className="rounded-xl px-6 py-3 font-bold text-white bg-terracotta-600 hover:bg-terracotta-700 disabled:opacity-50 flex items-center justify-center min-w-[120px]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Finalizar Cadastro'}
          </button>
        </div>
      </div>
    </div>
  );
}
