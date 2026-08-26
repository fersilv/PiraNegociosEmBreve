import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, Eye, EyeOff, Gavel, Loader2, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  getAdditionalUserInfo,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { AuctionBidderSetup } from '../components/classifieds/AuctionBidderSetup';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { auth } from '../lib/firebase';

type Mode = 'login' | 'register';

export default function AuctionAccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const returnToRaw = String(searchParams.get('returnTo') || '/classificados/leiloes');
  const returnTo = returnToRaw.startsWith('/classificados/leiloes') ? returnToRaw : '/classificados/leiloes';
  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'register' ? 'register' : 'login');
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/public/registration')
      .then((response) => setRegistrationOpen(response.data?.open !== false))
      .catch(() => setRegistrationOpen(true));
  }, []);

  const runtimeProfile = async () => {
    const response = await api.get('/users/me');
    await refreshProfile();
    return response.data;
  };

  const handleGoogle = async () => {
    setLoading(true); setError('');
    let result: Awaited<ReturnType<typeof signInWithPopup>> | null = null;
    try {
      result = await signInWithPopup(auth, new GoogleAuthProvider());
      const isNew = Boolean(getAdditionalUserInfo(result)?.isNewUser);
      if (isNew && !registrationOpen) {
        await deleteUser(result.user).catch(() => undefined);
        throw new Error('Novos cadastros estão temporariamente pausados.');
      }
      let profile = await runtimeProfile();
      if (isNew || mode === 'register') {
        if (!acceptedTerms && mode === 'register') throw new Error('Confirme os Termos de Uso para criar sua conta.');
        await api.patch('/users/me', {
          acceptedTerms: true,
          displayName: profile?.displayName || result.user.displayName || result.user.email?.split('@')[0],
          fullName: profile?.fullName || result.user.displayName || result.user.email?.split('@')[0],
          phone: phone.trim() || profile?.phone || undefined,
        });
        profile = await runtimeProfile();
      }
      if (isNew || mode === 'register') setAccountCreated(true);
      else navigate(returnTo);
    } catch (requestError: any) {
      setError(authMessage(requestError));
    } finally { setLoading(false); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (mode === 'register' && !registrationOpen) { setError('Novos cadastros estão temporariamente pausados.'); return; }
    if (mode === 'register' && !acceptedTerms) { setError('Confirme os Termos de Uso para criar sua conta.'); return; }
    setLoading(true);
    let created = false;
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        await runtimeProfile();
        navigate(returnTo);
        return;
      }
      const credential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      created = true;
      void sendEmailVerification(credential.user).catch(() => undefined);
      await api.post('/users/me', {
        displayName: name.trim(),
        fullName: name.trim(),
        phone: phone.trim(),
        acceptedTerms: true,
      });
      await runtimeProfile();
      setAccountCreated(true);
    } catch (requestError: any) {
      if (created && /cadastros.*pausados/i.test(String(requestError?.response?.data?.message || requestError?.message || ''))) {
        await deleteUser(auth.currentUser!).catch(() => undefined);
      }
      setError(authMessage(requestError));
    } finally { setLoading(false); }
  };

  if (accountCreated) {
    return <main className="min-h-screen bg-[#0d0908] px-4 py-8 text-white sm:py-12">
      <div className="pointer-events-none fixed inset-0 overflow-hidden"><div className="absolute -left-32 top-[-80px] h-96 w-96 rounded-full bg-[#ff633c]/12 blur-[100px]" /><div className="absolute -right-32 bottom-[-120px] h-[460px] w-[460px] rounded-full bg-[#ffb35b]/8 blur-[120px]" /></div>
      <div className="relative mx-auto max-w-3xl">
        <Link to={returnTo} className="inline-flex items-center gap-2 text-xs font-black text-white/45 hover:text-white"><ArrowLeft className="h-4 w-4" /> Voltar ao leilão</Link>
        <div className="mb-5 mt-7 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-emerald-400/10 text-emerald-300"><CheckCircle2 className="h-7 w-7" /></span><p className="mt-4 text-[9px] font-black uppercase tracking-[.18em] text-[#ff8e6c]">Conta criada</p><h1 className="mt-2 font-serif text-4xl font-black">Falta só liberar seu passe.</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/45">Valide o WhatsApp e adicione sua foto agora. Quando os três requisitos estiverem completos, você volta automaticamente para a disputa.</p></div>
        <AuctionBidderSetup onReady={() => navigate(returnTo)} />
      </div>
    </main>;
  }

  return <main className="min-h-screen bg-[#0d0908] text-white lg:grid lg:grid-cols-[1.02fr_.98fr]">
    <section className="relative hidden min-h-screen overflow-hidden border-r border-white/[.07] bg-[#15100e] p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
      <div className="absolute -left-28 top-20 h-96 w-96 rounded-full bg-[#ff633c]/12 blur-[100px]" /><div className="absolute -bottom-28 right-[-80px] h-[440px] w-[440px] rounded-full bg-[#ffb35b]/8 blur-[120px]" />
      <Link to="/classificados/leiloes" className="relative inline-flex w-fit items-center gap-2 text-xs font-black text-white/55 hover:text-white"><Gavel className="h-4 w-4 text-[#ff8060]" /> PiraNegócios · Arena de Leilões</Link>
      <div className="relative max-w-xl py-10"><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#ff8f6d]">Sua cadeira está reservada</p><h1 className="mt-4 font-serif text-5xl font-black leading-[.94] tracking-[-.04em] xl:text-6xl">Entre na arena.<br /><span className="bg-gradient-to-r from-white via-[#ffab8e] to-[#ffd18d] bg-clip-text text-transparent">O próximo lance pode ser seu.</span></h1><p className="mt-6 max-w-lg text-sm leading-7 text-white/43">Assistir é aberto. Para disputar, a plataforma confirma três sinais simples de identidade antes do primeiro lance.</p><div className="mt-8 grid gap-3"><Feature icon={<CheckCircle2 className="h-4 w-4" />} title="E-mail da conta" text="Mantém sua participação vinculada a uma identidade de acesso." /><Feature icon={<MessageCircle className="h-4 w-4" />} title="WhatsApp com OTP" text="Você recebe um código de 6 dígitos no número informado." /><Feature icon={<Camera className="h-4 w-4" />} title="Foto de perfil" text="A foto precisa estar no perfil para liberar os lances. Não fazemos reconhecimento facial nesta versão." /></div></div>
      <p className="relative text-[10px] leading-5 text-white/25">Leilões PiraNegócios · participação identificada · pagamento e entrega combinados diretamente após o encerramento.</p>
    </section>

    <section className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-7 lg:px-12">
      <div className="pointer-events-none absolute right-[-140px] top-[-120px] h-80 w-80 rounded-full bg-[#ff633c]/8 blur-[90px] lg:hidden" />
      <div className="relative w-full max-w-[530px]">
        <div className="mb-6 flex items-center justify-between"><Link to={returnTo} className="inline-flex items-center gap-2 text-xs font-black text-white/45 hover:text-white"><ArrowLeft className="h-4 w-4" /> Voltar à arena</Link><span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.045] px-3 py-1.5 text-[8px] font-black uppercase tracking-[.13em] text-[#ff8d6b]"><Sparkles className="h-3.5 w-3.5" /> acesso ao leilão</span></div>
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[.055] p-5 shadow-[0_35px_110px_rgba(0,0,0,.28)] backdrop-blur-xl sm:p-7">
          <div className="grid grid-cols-2 rounded-2xl bg-black/20 p-1"><button type="button" onClick={() => { setMode('login'); setError(''); }} className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${mode === 'login' ? 'bg-white text-[#21130f]' : 'text-white/45'}`}>Já tenho conta</button><button type="button" onClick={() => { setMode('register'); setError(''); }} className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${mode === 'register' ? 'bg-[#ff633c] text-white' : 'text-white/45'}`}>Criar conta</button></div>
          <div className="mt-6"><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#ff8d6b]">{mode === 'login' ? 'Bem-vindo de volta' : 'Seu passe para a arena'}</p><h2 className="mt-1 font-serif text-3xl font-black">{mode === 'login' ? 'Entre e volte para a disputa.' : 'Crie a conta e valide tudo aqui.'}</h2><p className="mt-2 text-xs leading-5 text-white/40">{mode === 'login' ? 'Depois do acesso você retorna exatamente para o leilão que estava vendo.' : 'Primeiro criamos sua conta. Em seguida, sem sair desta tela, você recebe o OTP do WhatsApp e envia sua foto.'}</p></div>

          {error && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs font-bold text-red-200">{error}</div>}
          {!registrationOpen && mode === 'register' && <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[.07] px-4 py-3 text-xs font-bold text-amber-100">Novas contas estão temporariamente pausadas. Você ainda pode entrar em uma conta existente.</div>}

          <button type="button" onClick={() => void handleGoogle()} disabled={loading || (mode === 'register' && (!acceptedTerms || !registrationOpen))} className="mt-5 flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white text-sm font-black text-[#21130f] disabled:opacity-40"><GoogleIcon /> Continuar com Google</button>
          <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-white/10" /><span className="text-[8px] font-black uppercase tracking-[.15em] text-white/25">ou use seu e-mail</span><span className="h-px flex-1 bg-white/10" /></div>

          <form onSubmit={submit} className="space-y-3.5">
            {mode === 'register' && <><Field label="Nome completo"><input required value={name} onChange={(event) => setName(event.target.value)} className="auction-auth-field" autoComplete="name" placeholder="Seu nome" /></Field><Field label="WhatsApp"><input required value={phone} onChange={(event) => setPhone(event.target.value)} className="auction-auth-field" autoComplete="tel" placeholder="(19) 99999-9999" /><p className="mt-1 text-[9px] leading-4 text-white/28">Depois de criar a conta, enviaremos o OTP para este número.</p></Field></>}
            <Field label="E-mail"><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="auction-auth-field" autoComplete="email" placeholder="voce@email.com" /></Field>
            <Field label="Senha"><div className="relative"><input required minLength={6} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className="auction-auth-field pr-12" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : 'Sua senha'} /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/30 hover:bg-white/[.06]" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></Field>
            {mode === 'register' && <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/15 p-3.5"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-0.5 h-4 w-4" /><span className="text-[10px] leading-5 text-white/45">Li e concordo com os <Link to="/termos" target="_blank" className="font-black text-[#ff9a78] hover:underline">Termos de Uso e Política de Privacidade</Link>.</span></label>}
            <button type="submit" disabled={loading || (mode === 'register' && (!acceptedTerms || !registrationOpen))} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff5d37] to-[#ff8a55] text-sm font-black text-white shadow-[0_14px_35px_rgba(255,93,55,.18)] disabled:opacity-40">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{mode === 'login' ? 'Entrar na arena' : 'Criar meu passe'}<ArrowRight className="h-4 w-4" /></>}</button>
          </form>
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-300/10 bg-emerald-300/[.04] px-3 py-2.5 text-[9px] leading-4 text-emerald-100/55"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300/70" /> WhatsApp e foto só são exigidos para registrar lances, não para navegar pelos Classificados.</div>
        </div>
      </div>
      <style>{`.auction-auth-field{width:100%;height:46px;border:1px solid rgba(255,255,255,.10);border-radius:14px;background:rgba(0,0,0,.18);padding:0 13px;color:white;font-size:13px;font-weight:750;outline:none;transition:.2s}.auction-auth-field::placeholder{color:rgba(255,255,255,.20)}.auction-auth-field:focus{border-color:rgba(255,112,73,.55);box-shadow:0 0 0 3px rgba(255,112,73,.08)}`}</style>
    </section>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.12em] text-white/35">{label}</span>{children}</label>; }
function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex items-start gap-3 rounded-[20px] border border-white/[.07] bg-white/[.035] p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ff633c]/10 text-[#ff8b69]">{icon}</span><span><strong className="block text-xs text-white">{title}</strong><span className="mt-1 block text-[10px] leading-5 text-white/35">{text}</span></span></div>; }
function GoogleIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>; }
function authMessage(error: any) { const code = String(error?.code || ''); if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'E-mail ou senha incorretos.'; if (code.includes('email-already-in-use')) return 'Este e-mail já possui uma conta. Entre na aba “Já tenho conta”.'; if (code.includes('weak-password')) return 'Escolha uma senha com pelo menos 6 caracteres.'; if (code.includes('invalid-email')) return 'Informe um e-mail válido.'; if (code.includes('popup-closed-by-user')) return 'A entrada com Google foi cancelada.'; return error?.response?.data?.message || error?.message || 'Não foi possível concluir agora.'; }
