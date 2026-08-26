import React, { useEffect, useState } from 'react';
import { Building2, Camera, CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

type AuthorizationInfo = {
  status: string;
  partnerName: string;
  partnerEmailMasked?: string;
  qsaQualification?: string | null;
  grantFullPowers: boolean;
  permissions: Record<string, boolean>;
  expiresAt: string;
  selfieUploaded: boolean;
  consentVersion: string;
  requestedByName?: string | null;
  company?: {
    name?: string | null;
    legalName?: string | null;
    cnpj?: string | null;
    registryTradeName?: string | null;
    legalAddress?: string | null;
    legalCity?: string | null;
    legalState?: string | null;
    cnpjSituation?: string | null;
  } | null;
};

const permissionLabels: Record<string, string> = {
  companyProfile: 'Editar perfil da empresa',
  recruitment: 'Recrutamento',
  marketplace: 'Marketplace',
  finance: 'Financeiro',
  team: 'Equipe e permissões',
};

export default function CompanyVerificationAuthorizationPage() {
  const { token = '' } = useParams();
  const [info, setInfo] = useState<AuthorizationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/company-verification/${encodeURIComponent(token)}`);
      setInfo(response.data);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Este link de autorização não é válido ou já expirou.');
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [token]);

  const upload = async (file: File | null) => {
    if (!file) return;
    setWorking('selfie'); setMessage('');
    try {
      const body = new FormData();
      body.append('file', file);
      await api.post(`/company-verification/${encodeURIComponent(token)}/selfie`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMessage('Selfie recebida com segurança.');
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível enviar a selfie.');
    } finally { setWorking(''); }
  };

  const submit = async () => {
    if (!info || !accepted) return;
    setWorking('submit'); setMessage('');
    try {
      await api.post(`/company-verification/${encodeURIComponent(token)}/accept`, {
        accepted: true,
        consentVersion: info.consentVersion,
      });
      setAccepted(false);
      setMessage('Autorização enviada. Agora ela seguirá para análise do PiraNegócios.');
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível concluir a autorização.');
    } finally { setWorking(''); }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#f5f3ef]"><Loader2 className="h-8 w-8 animate-spin text-stone-400" /></div>;

  if (!info) return <div className="flex min-h-screen items-center justify-center bg-[#f5f3ef] p-4"><div className="w-full max-w-lg rounded-[30px] bg-white p-7 text-center shadow-xl ring-1 ring-stone-200"><XCircle className="mx-auto h-12 w-12 text-red-500" /><h1 className="mt-4 font-serif text-3xl font-black">Link indisponível</h1><p className="mt-2 text-sm leading-6 text-stone-500">{message || 'Esta autorização não está mais disponível.'}</p><Link to="/" className="mt-6 inline-flex rounded-2xl bg-stone-950 px-5 py-3 text-sm font-black text-white">Ir para o PiraNegócios</Link></div></div>;

  const submitted = ['SUBMITTED','APPROVED'].includes(info.status);
  const ended = ['REJECTED','EXPIRED','REVOKED'].includes(info.status);

  return (
    <div className="min-h-screen bg-[#f5f3ef] px-4 py-8 text-stone-900 sm:py-12">
      <main className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-[30px] bg-[#2b211c] p-6 text-white shadow-xl sm:p-8">
          <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10"><Building2 className="h-6 w-6" /></span><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#efb89c]">Autorização empresarial</p><h1 className="mt-2 font-serif text-3xl font-black">{info.company?.name || info.company?.legalName || 'Empresa no PiraNegócios'}</h1><p className="mt-2 text-sm leading-6 text-white/60">{info.requestedByName || 'Um administrador'} indicou você como sócio(a)/responsável pela autorização deste cadastro.</p></div></div>
        </header>

        {message && <div className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-bold text-white">{message}</div>}

        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
          <p className="text-[9px] font-black uppercase tracking-[.14em] text-stone-400">Dados consultados do CNPJ</p>
          <h2 className="mt-2 text-xl font-black">{info.company?.legalName || info.company?.name}</h2>
          <p className="mt-1 text-xs text-stone-500">CNPJ {info.company?.cnpj || 'não informado'} · {info.company?.cnpjSituation || 'situação não informada'}</p>
          <div className="mt-4 rounded-2xl bg-stone-50 p-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">Endereço jurídico</p><p className="mt-1 text-sm font-bold">{info.company?.legalAddress || [info.company?.legalCity, info.company?.legalState].filter(Boolean).join('/') || 'Não informado'}</p></div>
          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs leading-5 text-blue-900"><strong>{info.partnerName}</strong>{info.qsaQualification ? ` · ${info.qsaQualification}` : ''}<br />Este é o nome indicado no quadro societário consultado para a autorização.</div>
        </section>

        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" /><div><h2 className="text-lg font-black">O que você está autorizando</h2><p className="mt-1 text-xs leading-5 text-stone-500">Você autoriza o cadastro e a operação da empresa no PiraNegócios. Isso não cria conta bancária, não transfere participação societária e não autoriza movimentação fora dos recursos da plataforma.</p></div></div>
          {info.grantFullPowers ? <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-xs leading-5 text-emerald-900"><strong>Plenos poderes na plataforma:</strong> o administrador indicado poderá operar perfil da empresa, Recrutamento, Marketplace, Financeiro e Equipe.</div> : <div className="mt-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-stone-400">Permissões solicitadas</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{Object.entries(info.permissions || {}).filter(([,enabled]) => enabled).map(([key]) => <div key={key} className="rounded-xl bg-stone-50 px-3 py-2 text-xs font-bold">{permissionLabels[key] || key}</div>)}</div></div>}
        </section>

        {!submitted && !ended && <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6">
          <div className={`rounded-[22px] border p-5 ${info.selfieUploaded ? 'border-emerald-200 bg-emerald-50' : 'border-stone-200 bg-stone-50'}`}><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm"><Camera className="h-5 w-5" /></span><div className="flex-1"><h2 className="text-sm font-black">Selfie atual</h2><p className="mt-1 text-xs text-stone-500">{info.selfieUploaded ? 'Selfie recebida. Ela fica armazenada de forma privada e criptografada.' : 'Tire uma foto frontal, atual e nítida. Não precisamos de RG ou contrato social neste fluxo.'}</p></div>{info.selfieUploaded && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}</div><label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-xs font-black text-white"><input type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="hidden" onChange={(event) => { void upload(event.target.files?.[0] || null); event.currentTarget.value = ''; }} />{working === 'selfie' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}{info.selfieUploaded ? 'Trocar selfie' : 'Tirar/enviar selfie'}</label></div>

          <label className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1" /><span className="text-xs leading-5 text-emerald-950">Confirmo que sou a pessoa indicada nesta autorização, que reconheço a empresa acima e concordo com os <Link to="/classificados/termos" target="_blank" className="font-black underline">termos do Marketplace e da verificação empresarial</Link>.</span></label>
          <button type="button" onClick={() => void submit()} disabled={!accepted || !info.selfieUploaded || working === 'submit'} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#c66a4b] px-5 text-sm font-black text-white disabled:opacity-40">{working === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Autorizar e enviar para análise</button>
        </section>}

        {submitted && <section className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-6 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-700" /><h2 className="mt-3 text-xl font-black text-emerald-950">{info.status === 'APPROVED' ? 'Empresa autorizada' : 'Autorização enviada'}</h2><p className="mt-2 text-sm leading-6 text-emerald-800">{info.status === 'APPROVED' ? 'A validação foi aprovada. Você não precisa acessar o PiraNegócios novamente, a menos que queira administrar a empresa.' : 'O PiraNegócios fará a análise manual. Não é necessário criar uma conta agora.'}</p></section>}

        {ended && <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-center"><XCircle className="mx-auto h-9 w-9 text-amber-700" /><h2 className="mt-3 text-xl font-black text-amber-950">Autorização encerrada</h2><p className="mt-2 text-sm text-amber-800">Status: {info.status}. Se ainda precisar autorizar a empresa, peça ao administrador para gerar um novo convite.</p></section>}
      </main>
    </div>
  );
}
