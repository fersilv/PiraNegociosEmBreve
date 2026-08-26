import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Loader2, Search, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { FileUpload } from './FileUpload';

type CnpjSnapshot = {
  cnpj: string;
  legalName: string;
  tradeName?: string | null;
  situation?: string | null;
  legalAddress: string;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  qsa?: Array<{ name: string; qualification?: string | null }>;
  source?: string;
};

export function CompanyRegistrationFlow({ onComplete }: { onComplete: () => void }) {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  const [hasCnpj, setHasCnpj] = useState<boolean | null>(null);
  const [cnpj, setCnpj] = useState('');
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjSnapshot, setCnpjSnapshot] = useState<CnpjSnapshot | null>(null);
  const [searchingCompanies, setSearchingCompanies] = useState(false);
  const [companyMatches, setCompanyMatches] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);

  useEffect(() => {
    if (companyName.trim().length < 3 || selectedCompany) {
      setCompanyMatches([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearchingCompanies(true);
      try {
        const response = await api.get(`/companies/search?q=${encodeURIComponent(companyName.trim())}`);
        setCompanyMatches(Array.isArray(response.data) ? response.data : []);
      } catch {
        setCompanyMatches([]);
      } finally {
        setSearchingCompanies(false);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [companyName, selectedCompany]);

  const lookupCnpj = async () => {
    if (!cnpj.trim()) return;
    setCnpjLoading(true);
    setMessage('');
    try {
      const response = await api.get(`/compliance/company/cnpj-preview/${encodeURIComponent(cnpj.trim())}`);
      const snapshot = response.data as CnpjSnapshot;
      setCnpjSnapshot(snapshot);
      const suggestedName = snapshot.tradeName || snapshot.legalName;
      if (suggestedName) setCompanyName(suggestedName);
      setMessage('CNPJ localizado. Confira os dados públicos abaixo.');
    } catch (error: any) {
      setCnpjSnapshot(null);
      setMessage(error?.response?.data?.message || 'Não foi possível consultar esse CNPJ agora.');
    } finally {
      setCnpjLoading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedCompany) {
      setLoading(true);
      setMessage('');
      try {
        await api.post(`/companies/${selectedCompany.id}/access-requests`, {});
        await refreshProfile();
        onComplete();
      } catch (error: any) {
        setMessage(error?.response?.data?.message || 'Não foi possível solicitar o vínculo.');
      } finally { setLoading(false); }
      return;
    }

    if (hasCnpj === null) {
      setMessage('Informe se a empresa possui CNPJ.');
      return;
    }
    if (!companyName.trim()) {
      setMessage('Informe o nome comercial da empresa.');
      return;
    }
    if (hasCnpj && !cnpjSnapshot) {
      setMessage('Consulte o CNPJ antes de criar a empresa.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      await api.post('/companies/register', {
        name: companyName.trim(),
        description: companyDescription.trim() || null,
        logoURL: companyLogo || null,
        documentType: hasCnpj ? 'CNPJ' : 'NONE',
        cnpj: hasCnpj ? cnpjSnapshot?.cnpj || cnpj.trim() : null,
        hasCnpj,
      });
      await refreshProfile();
      if (hasCnpj && cnpjSnapshot?.cnpj) {
        await api.get(`/compliance/company/cnpj/${encodeURIComponent(cnpjSnapshot.cnpj)}`).catch(() => undefined);
        await refreshProfile();
      }
      onComplete();
      navigate(hasCnpj ? '/company/verificacao' : '/company/perfil', { replace: true });
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível criar a empresa.');
    } finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-3xl py-8 sm:py-12">
      <div className="rounded-[30px] border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-7 flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-terracotta-50 text-terracotta-600"><Building2 className="h-7 w-7" /></span>
          <div><h2 className="font-serif text-3xl font-black text-stone-900">Sua empresa no PiraNegócios</h2><p className="mt-2 text-sm leading-6 text-stone-500">Se ela já existe na plataforma, solicite acesso. Se for nova, o cadastro com CNPJ pode ser preenchido automaticamente pela consulta pública.</p></div>
        </div>

        {message && <div className="mb-5 rounded-2xl bg-stone-950 px-4 py-3 text-sm font-bold text-white">{message}</div>}

        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className={labelClass}>Buscar empresa já cadastrada</label>
            <div className="relative"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input value={companyName} onChange={(event) => { setCompanyName(event.target.value); setSelectedCompany(null); }} placeholder="Nome comercial ou razão social" className={`${inputClass} pl-11`} /></div>
            {searchingCompanies && <p className="mt-2 text-xs text-stone-400">Buscando empresas parecidas...</p>}
            {!selectedCompany && companyMatches.length > 0 && <div className="mt-2 overflow-hidden rounded-2xl border border-stone-200">{companyMatches.map((company) => <button key={company.id} type="button" onClick={() => { setSelectedCompany(company); setCompanyName(company.name); setCompanyMatches([]); }} className="block w-full border-t border-stone-100 bg-white px-4 py-3 text-left first:border-t-0 hover:bg-stone-50"><strong className="text-sm text-stone-900">{company.name}</strong><span className="mt-0.5 block text-xs text-stone-500">{company.cityState || company.city || 'Localização não informada'}</span></button>)}</div>}
            {selectedCompany && <div className="mt-3 rounded-2xl border border-terracotta-200 bg-terracotta-50 p-4"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-terracotta-700" /><div><strong className="text-sm text-terracotta-950">{selectedCompany.name}</strong><p className="mt-1 text-xs leading-5 text-terracotta-800">Você vai solicitar acesso a esta empresa, em vez de criar um cadastro duplicado.</p></div></div><button type="button" onClick={() => { setSelectedCompany(null); setCompanyName(''); }} className="mt-3 text-xs font-black text-terracotta-700">Não é esta empresa</button></div>}
          </div>

          {!selectedCompany && <>
            <div className="border-t border-stone-100 pt-6"><p className={labelClass}>A empresa tem CNPJ?</p><div className="mt-2 grid gap-3 sm:grid-cols-2"><Choice selected={hasCnpj === true} title="Sim, tem CNPJ" text="Buscamos razão social, endereço jurídico e QSA automaticamente." onClick={() => setHasCnpj(true)} /><Choice selected={hasCnpj === false} title="Não tenho CNPJ" text="Pode criar normalmente, mas a empresa ficará não verificada e com recursos limitados." onClick={() => { setHasCnpj(false); setCnpjSnapshot(null); }} /></div></div>

            {hasCnpj === true && <section className="rounded-[24px] bg-[#f6f8f7] p-4 ring-1 ring-stone-200 sm:p-5"><label className={labelClass}>CNPJ</label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input value={cnpj} onChange={(event) => { setCnpj(event.target.value.toUpperCase()); setCnpjSnapshot(null); }} placeholder="00.000.000/0000-00" className={`${inputClass} flex-1`} /><button type="button" disabled={cnpjLoading || !cnpj.trim()} onClick={() => void lookupCnpj()} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-stone-950 px-5 text-sm font-black text-white disabled:opacity-40">{cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Consultar</button></div>{cnpjSnapshot && <div className="mt-4 space-y-3"><div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200"><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">Razão social</p><p className="mt-1 text-base font-black">{cnpjSnapshot.legalName}</p>{cnpjSnapshot.situation && <p className="mt-1 text-xs text-stone-500">Situação: {cnpjSnapshot.situation}</p>}</div><div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200"><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">Endereço jurídico</p><p className="mt-1 text-sm font-bold">{cnpjSnapshot.legalAddress}</p></div>{Boolean(cnpjSnapshot.qsa?.length) && <div><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">QSA encontrado</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{cnpjSnapshot.qsa!.slice(0, 12).map((partner) => <div key={`${partner.name}-${partner.qualification || ''}`} className="rounded-xl bg-white p-3 ring-1 ring-stone-200"><p className="text-xs font-black">{partner.name}</p><p className="mt-1 text-[10px] text-stone-500">{partner.qualification || 'Sócio/administrador'}</p></div>)}</div></div>}</div>}</section>}

            <div><label className={labelClass}>Nome comercial</label><input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className={inputClass} placeholder={cnpjSnapshot?.tradeName || cnpjSnapshot?.legalName || 'Como a empresa será exibida'} /><p className="mt-2 text-[10px] leading-4 text-stone-400">Pode ser diferente da razão social. A razão social e o endereço jurídico ficam vinculados à consulta do CNPJ.</p></div>
            <div><label className={labelClass}>Descrição curta <span className="normal-case tracking-normal text-stone-300">opcional</span></label><textarea value={companyDescription} onChange={(event) => setCompanyDescription(event.target.value)} rows={4} className={`${inputClass} h-auto py-3`} placeholder="O que a empresa faz?" /></div>
            <FileUpload label="Logotipo da empresa (opcional)" accept="image/*" value={companyLogo} onChange={setCompanyLogo} type="avatar" placeholder="Selecione ou arraste o logotipo" />

            {hasCnpj === true && <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-5 text-emerald-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>Depois de criar, você vai para uma verificação simples: confirmar quem é o sócio responsável, validar contatos, selfie e aceite. Sem contrato social obrigatório.</span></div>}
          </>}

          <div className="flex justify-end border-t border-stone-100 pt-5"><button type="submit" disabled={loading || (selectedCompany ? false : !companyName.trim())} className="inline-flex min-w-44 items-center justify-center gap-2 rounded-2xl bg-stone-950 px-6 py-3.5 text-sm font-black text-white disabled:opacity-40">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{selectedCompany ? 'Solicitar vínculo' : 'Criar empresa'}</button></div>
        </form>
      </div>
    </div>
  );
}

function Choice({ selected, title, text, onClick }: { selected: boolean; title: string; text: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${selected ? 'border-terracotta-500 bg-terracotta-50 ring-2 ring-terracotta-500/10' : 'border-stone-200 bg-white hover:bg-stone-50'}`}><div className="flex items-center justify-between gap-3"><strong className="text-sm">{title}</strong><span className={`h-4 w-4 rounded-full border-4 ${selected ? 'border-terracotta-500' : 'border-stone-300'}`} /></div><p className="mt-2 text-xs leading-5 text-stone-500">{text}</p></button>;
}

const inputClass = 'h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm outline-none focus:border-terracotta-500 focus:ring-2 focus:ring-terracotta-500/10';
const labelClass = 'block text-[10px] font-black uppercase tracking-[.12em] text-stone-500';
