import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BellRing, BriefcaseBusiness, CheckCircle2, Eye, EyeOff, FileText, Loader2, MapPin, Sparkles } from "lucide-react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  getAdditionalUserInfo,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { CityStateSelector } from "../components/CityStateSelector";
import type { VisitorLocationHint } from "../lib/locationPersonalization";
import { getInviteTokenFromLocation } from "../lib/inviteToken";

type Mode = "login" | "register";

function firebaseMessage(error: any): string {
  const code = String(error?.code || "");
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "E-mail ou senha incorretos.";
  if (code.includes("email-already-in-use")) return "Este e-mail já possui uma conta. Tente entrar.";
  if (code.includes("weak-password")) return "Escolha uma senha com pelo menos 6 caracteres.";
  if (code.includes("invalid-email")) return "Informe um e-mail válido.";
  if (code.includes("popup-closed-by-user")) return "A entrada com Google foi cancelada.";
  if (code.includes("too-many-requests")) return "Muitas tentativas seguidas. Aguarde um pouco e tente novamente.";
  return error?.response?.data?.message || error?.message || "Não foi possível concluir agora. Tente novamente.";
}

function parseLocation(value: string) {
  const [city = "", state = ""] = value.split(",").map((item) => item.trim());
  return { city, state: state.toUpperCase().slice(0, 2) };
}

export function Login() {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [socialName, setSocialName] = useState("");
  const [treatment, setTreatment] = useState("ela/dela");
  const [phone, setPhone] = useState("");
  const [registrationLocation, setRegistrationLocation] = useState("");
  const [locationWasSuggested, setLocationWasSuggested] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [registrationStatusLoaded, setRegistrationStatusLoaded] = useState(false);
  const [waitlisted, setWaitlisted] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [passwordResetError, setPasswordResetError] = useState("");
  const [passwordResetSentTo, setPasswordResetSentTo] = useState("");
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const isRegister = mode === "register";
  const inviteToken = getInviteTokenFromLocation();
  const isInviteFlow = Boolean(inviteToken);
  const waitlistMode = isRegister && registrationStatusLoaded && !registrationOpen && !isInviteFlow;

  useEffect(() => {
    let active = true;
    Promise.allSettled([api.get("/public/location-hint"), api.get("/public/registration")])
      .then(([locationResult, registrationResult]) => {
        if (!active) return;
        if (locationResult.status === "fulfilled") {
          const hint = locationResult.value.data as VisitorLocationHint;
          if (hint?.city && hint?.state) {
            setRegistrationLocation((current) => current || `${hint.city}, ${hint.state}`);
            setLocationWasSuggested(true);
          }
        }
        if (registrationResult.status === "fulfilled") {
          setRegistrationOpen(registrationResult.value.data?.open !== false);
        }
        setRegistrationStatusLoaded(true);
      });
    return () => { active = false; };
  }, []);

  const destinationFor = (profile: any) => {
    if (returnTo) return returnTo;
    if (profile?.type === "ADMIN") return "/admin";
    if (profile?.companyId && profile?.isCompanyAdmin) return "/company";
    return "/user";
  };

  const loadRuntimeProfile = async () => {
    const response = await api.get("/users/me", {
      headers: inviteToken ? { "X-Talent-Invite-Token": inviteToken } : undefined,
    });
    await refreshProfile();
    return response.data;
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    setError("");
    setWaitlisted(false);
    if (next === "login") setAcceptedTerms(false);
  };

  const locationPayload = () => {
    const parsed = parseLocation(registrationLocation);
    return parsed.city && parsed.state
      ? { city: parsed.city, state: parsed.state, address: `${parsed.city}, ${parsed.state}` }
      : {};
  };

  const joinWaitlist = async (waitlistName: string, waitlistAddress: string, source: "EMAIL" | "GOOGLE") => {
    const response = await api.post("/public/registration/waitlist", {
      name: waitlistName.trim(),
      email: waitlistAddress.trim().toLowerCase(),
      source,
    });
    setWaitlistEmail(response.data?.interest?.email || waitlistAddress.trim().toLowerCase());
    setWaitlisted(true);
  };

  const handleGoogle = async () => {
    if (isRegister && !waitlistMode && !acceptedTerms) {
      setError("Para criar sua conta, confirme que leu os Termos de Uso e a Política de Privacidade.");
      return;
    }
    setLoading(true);
    setError("");
    let result: Awaited<ReturnType<typeof signInWithPopup>> | null = null;
    try {
      result = await signInWithPopup(auth, new GoogleAuthProvider());
      const isNewGoogleAccount = Boolean(getAdditionalUserInfo(result)?.isNewUser);

      if (!registrationOpen && isNewGoogleAccount && !isInviteFlow) {
        const googleName = result.user.displayName?.trim() || result.user.email?.split("@")[0] || "Novo interessado";
        const googleEmail = result.user.email || "";
        await joinWaitlist(googleName, googleEmail, "GOOGLE");
        await deleteUser(result.user).catch((deleteError) => console.warn("Não foi possível remover a identidade temporária do Firebase:", deleteError));
        return;
      }

      let runtime = await loadRuntimeProfile();
      if (isRegister && !runtime?.acceptedTerms) {
        await api.patch("/users/me", {
          acceptedTerms: true,
          displayName: runtime?.displayName || result.user.displayName || undefined,
          fullName: runtime?.fullName || result.user.displayName || undefined,
          ...locationPayload(),
        }, { headers: inviteToken ? { "X-Talent-Invite-Token": inviteToken } : undefined });
        runtime = await loadRuntimeProfile();
      }
      navigate(destinationFor(runtime));
    } catch (loginError: any) {
      console.error(loginError);
      if (isInviteFlow && auth.currentUser) {
        const isNewGoogleAccount = Boolean(result && getAdditionalUserInfo(result)?.isNewUser);
        if (isNewGoogleAccount) await deleteUser(auth.currentUser).catch(() => undefined);
        else await signOut(auth).catch(() => undefined);
      }
      setError(firebaseMessage(loginError));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (waitlistMode) {
      if (!name.trim() || !email.trim()) {
        setError("Informe seu nome e e-mail para entrar na lista de espera.");
        return;
      }
      setLoading(true);
      try {
        await joinWaitlist(name, email, "EMAIL");
      } catch (submitError: any) {
        console.error(submitError);
        setError(firebaseMessage(submitError));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isRegister && !acceptedTerms) {
      setError("Para criar sua conta, confirme que leu os Termos de Uso e a Política de Privacidade.");
      return;
    }
    setLoading(true);
    let createdAccount = false;
    try {
      if (!isRegister) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        const runtime = await loadRuntimeProfile();
        navigate(destinationFor(runtime));
        return;
      }

      const credential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      createdAccount = true;
      void sendEmailVerification(credential.user).catch((verifyError) => console.warn("Não foi possível enviar a verificação de e-mail:", verifyError));
      await api.post("/users/me", {
        displayName: socialName.trim() || name.trim(),
        fullName: name.trim(),
        socialName: socialName.trim(),
        treatment,
        phone: phone.trim(),
        acceptedTerms: true,
        ...locationPayload(),
      }, { headers: inviteToken ? { "X-Talent-Invite-Token": inviteToken } : undefined });
      const runtime = await loadRuntimeProfile();
      navigate(destinationFor(runtime));
    } catch (submitError: any) {
      console.error(submitError);
      if (isInviteFlow && auth.currentUser) {
        if (createdAccount) await deleteUser(auth.currentUser).catch(() => undefined);
        else await signOut(auth).catch(() => undefined);
      }
      setError(firebaseMessage(submitError));
    } finally {
      setLoading(false);
    }
  };

  const openPasswordReset = () => {
    setPasswordResetError("");
    setPasswordResetSentTo("");
    setPasswordResetOpen(true);
  };

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setPasswordResetError("Informe o e-mail usado no cadastro.");
      return;
    }
    setPasswordResetLoading(true);
    setPasswordResetError("");
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setPasswordResetSentTo(normalizedEmail);
    } catch (resetError: any) {
      // Não revela se uma conta existe ou não para evitar enumeração de e-mails.
      if (String(resetError?.code || "").includes("user-not-found")) {
        setPasswordResetSentTo(normalizedEmail);
      } else {
        setPasswordResetError(firebaseMessage(resetError));
      }
    } finally {
      setPasswordResetLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5efe8] text-[#251a15] lg:grid lg:grid-cols-[.92fr_1.08fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#2b211c] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-[#d98765]/20 blur-3xl" />
        <div className="absolute -bottom-20 right-0 h-80 w-80 rounded-full bg-[#f0c2a9]/10 blur-3xl" />
        <Link to="/" className="relative inline-flex items-center"><img src="/brand/logo-horizontal-white.png" alt="PiraNegócios" className="h-10 w-auto max-w-[230px] object-contain object-left" /></Link>
        <div className="relative max-w-xl py-12">
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#efb89c]">Seu espaço profissional</p>
          <h1 className="mt-4 font-serif text-5xl font-bold leading-[1.05] xl:text-6xl">Sua próxima oportunidade começa antes do botão “candidatar”.</h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/55">Monte um currículo que trabalha junto com você, diga onde realmente pode trabalhar e acompanhe cada etapa sem perder solicitação no caminho.</p>
          <div className="mt-9 grid gap-3">
            <Benefit icon={<MapPin className="h-4 w-4" />} title="Vagas da sua região" text="Busca local e cidades onde você realmente aceita trabalhar." />
            <Benefit icon={<FileText className="h-4 w-4" />} title="Currículo vivo" text="Importe, organize, revise e publique sua versão profissional." />
            <Benefit icon={<BriefcaseBusiness className="h-4 w-4" />} title="Processo acompanhado" text="Candidaturas, documentos e atualizações em um único lugar." />
          </div>
        </div>
        <p className="relative text-[11px] leading-5 text-white/30">PiraNegócios · Pirassununga e região · tecnologia para aproximar pessoas e oportunidades.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-7 lg:px-12">
        <div className="w-full max-w-[540px]">
          <div className="mb-7 flex items-center justify-between"><Link to="/" className="inline-flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-stone-900"><ArrowLeft className="h-4 w-4" /> Voltar</Link><img src="/brand/logo-horizontal-terracotta.png" alt="PiraNegócios" className="h-7 w-auto max-w-[180px] object-contain lg:hidden" /></div>
          <div className="rounded-[32px] border border-[#ddcfc3] bg-[#fffdfa] p-5 shadow-[0_30px_90px_rgba(73,45,28,.10)] sm:p-8">
            <div className="grid grid-cols-2 rounded-2xl bg-[#f2ebe4] p-1"><button type="button" onClick={() => changeMode("login")} className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${!isRegister ? "bg-[#2b211c] text-white shadow-sm" : "text-stone-500"}`}>Entrar</button><button type="button" onClick={() => changeMode("register")} className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${isRegister ? "bg-[#2b211c] text-white shadow-sm" : "text-stone-500"}`}>{registrationStatusLoaded && !registrationOpen && !isInviteFlow ? "Lista de espera" : "Criar conta"}</button></div>

            {waitlisted ? (
              <div className="py-10 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-7 w-7" /></span>
                <p className="mt-5 text-[10px] font-black uppercase tracking-[.18em] text-terracotta-600">Pré-cadastro confirmado</p>
                <h2 className="mt-2 font-serif text-3xl font-bold text-stone-950">Você está na lista. 💌</h2>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-stone-500">Guardamos apenas seu nome e <strong>{waitlistEmail}</strong>. Assim que novos membros forem aceitos, avisaremos por e-mail.</p>
                <button type="button" onClick={() => changeMode("login")} className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-[#2b211c] px-5 py-3 text-sm font-black text-white">Já tenho conta, entrar <ArrowRight className="h-4 w-4" /></button>
              </div>
            ) : (
              <>
                <div className="mt-7">
                  <p className="text-[10px] font-black uppercase tracking-[.16em] text-terracotta-600">{waitlistMode ? "Acesso em preparação" : isInviteFlow ? "Convite para processo seletivo" : isRegister ? "Comece seu perfil" : "Bem-vindo de volta"}</p>
                  <h2 className="mt-1 font-serif text-3xl font-bold text-stone-950">{waitlistMode ? "Novos cadastros estão temporariamente pausados." : isInviteFlow ? (isRegister ? "Crie sua conta para conhecer a vaga." : "Entre para conhecer a vaga.") : isRegister ? "Crie sua conta profissional." : "Entre no seu espaço."}</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-500">{waitlistMode ? "Estamos preparando a próxima etapa da plataforma. Deixe apenas seu nome e e-mail e avisaremos assim que a entrada for reaberta." : isInviteFlow ? "Use exatamente o mesmo e-mail que recebeu o convite. Depois do cadastro você poderá ler a vaga completa antes de aceitar." : isRegister ? "Leva poucos minutos. Seu currículo pode continuar depois como rascunho." : "Suas vagas, currículo, processos e empresa continuam exatamente de onde você parou."}</p>
                </div>

                {waitlistMode && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><BellRing className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><p className="text-xs leading-5 text-amber-900">O pré-cadastro <strong>não cria uma conta</strong> e não pede senha, telefone ou outros dados. Ele serve somente para avisar quando novos membros forem aceitos.</p></div>}
                {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm font-semibold text-red-700">{error}</div>}

                <button type="button" onClick={() => void handleGoogle()} disabled={loading || (isRegister && !waitlistMode && !acceptedTerms)} className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-stone-200 bg-white text-sm font-bold text-stone-800 transition hover:bg-stone-50 disabled:opacity-45"><GoogleIcon /> {waitlistMode ? "Entrar na lista com Google" : "Continuar com Google"}</button>
                <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-stone-200" /><span className="text-[9px] font-black uppercase tracking-[.16em] text-stone-400">ou use seu e-mail</span><span className="h-px flex-1 bg-stone-200" /></div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {waitlistMode ? (
                    <>
                      <Field label="Nome *"><input required value={name} onChange={(event) => setName(event.target.value)} className="auth-field" autoComplete="name" placeholder="Como podemos chamar você?" /></Field>
                      <Field label="E-mail *"><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="auth-field" autoComplete="email" placeholder="voce@email.com" /></Field>
                    </>
                  ) : (
                    <>
                      {isRegister && <><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome completo *"><input required value={name} onChange={(event) => setName(event.target.value)} className="auth-field" autoComplete="name" placeholder="Seu nome" /></Field><Field label="Telefone / WhatsApp *"><input required value={phone} onChange={(event) => setPhone(event.target.value)} className="auth-field" autoComplete="tel" placeholder="(19) 99999-9999" /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome social"><input value={socialName} onChange={(event) => setSocialName(event.target.value)} className="auth-field" placeholder="Opcional" /></Field><Field label="Como prefere ser tratado"><select value={treatment} onChange={(event) => setTreatment(event.target.value)} className="auth-field"><option value="ela/dela">Ela/Dela</option><option value="ele/dele">Ele/Dele</option><option value="elu/delu">Elu/Delu</option></select></Field></div><Field label="Cidade onde você mora *"><CityStateSelector initialValue={registrationLocation} onLocationChange={(value) => { setRegistrationLocation(value); setLocationWasSuggested(false); }} /><p className="mt-1.5 flex items-center gap-1.5 text-[10px] leading-4 text-stone-400"><MapPin className="h-3 w-3 text-terracotta-500" />{locationWasSuggested ? "Sugerimos esta cidade pela sua região de acesso. Confira e altere se necessário." : "Usamos sua cidade para priorizar vagas e matches realmente viáveis."}</p></Field></>}
                      <Field label="E-mail *"><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="auth-field" autoComplete="email" placeholder="voce@email.com" /></Field>
                      <Field label="Senha *"><div className="relative"><input required type={showPassword ? "text" : "password"} minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="auth-field pr-12" autoComplete={isRegister ? "new-password" : "current-password"} placeholder={isRegister ? "Mínimo 6 caracteres" : "Sua senha"} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></Field>
                      {!isRegister && <div className="-mt-2 text-right"><button type="button" onClick={openPasswordReset} className="text-xs font-black text-terracotta-700 hover:underline">Esqueci minha senha</button></div>}
                      {isRegister && <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50/60 p-3.5"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500" /><span className="text-xs leading-5 text-stone-600">Li e concordo com os <Link to="/termos" target="_blank" className="font-bold text-terracotta-700 hover:underline">Termos de Uso e Política de Privacidade</Link>.</span></label>}
                    </>
                  )}
                  <button type="submit" disabled={loading || (!waitlistMode && isRegister && !acceptedTerms)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-terracotta-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-terracotta-600/15 transition hover:bg-terracotta-700 disabled:opacity-45">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{waitlistMode ? "Quero ser avisado" : isRegister ? "Criar minha conta" : "Entrar"}<ArrowRight className="h-4 w-4" /></>}</button>
                </form>
                <p className="mt-6 text-center text-xs text-stone-400">{isRegister ? "Já tem conta?" : "Ainda não tem conta?"} <button type="button" onClick={() => changeMode(isRegister ? "login" : "register")} className="font-black text-terracotta-700">{isRegister ? "Entrar" : registrationStatusLoaded && !registrationOpen && !isInviteFlow ? "Entrar na lista" : "Criar agora"}</button></p>
              </>
            )}
          </div>
          <div className="mt-5 flex items-center justify-center gap-2 text-[10px] font-bold text-stone-400"><Sparkles className="h-3.5 w-3.5 text-terracotta-500" /> Um cadastro para carreira e, quando precisar, para o workspace da sua empresa.</div>
        </div>
      </section>
      {passwordResetOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !passwordResetLoading)
              setPasswordResetOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-reset-title"
            className="w-full max-w-md rounded-[28px] border border-[#ddcfc3] bg-[#fffdfa] p-6 shadow-2xl sm:p-8"
          >
            {passwordResetSentTo ? (
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-7 w-7" />
                </span>
                <h2 id="password-reset-title" className="mt-5 font-serif text-3xl font-bold text-stone-950">
                  Confira seu e-mail
                </h2>
                <p className="mt-3 text-sm leading-6 text-stone-500">
                  Se existir uma conta para <strong>{passwordResetSentTo}</strong>, você receberá um link para criar uma nova senha. Confira também a caixa de spam.
                </p>
                <button
                  type="button"
                  onClick={() => setPasswordResetOpen(false)}
                  className="mt-6 w-full rounded-2xl bg-[#2b211c] px-5 py-3 text-sm font-black text-white"
                >
                  Voltar para entrar
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPasswordResetOpen(false)}
                  disabled={passwordResetLoading}
                  className="inline-flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-stone-900 disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
                <h2 id="password-reset-title" className="mt-5 font-serif text-3xl font-bold text-stone-950">
                  Recupere sua senha
                </h2>
                <p className="mt-2 text-sm leading-6 text-stone-500">
                  Informe o e-mail usado no cadastro. Enviaremos um link seguro para você definir uma nova senha.
                </p>
                {passwordResetError && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm font-semibold text-red-700">
                    {passwordResetError}
                  </div>
                )}
                <form onSubmit={handlePasswordReset} className="mt-5 space-y-4">
                  <Field label="E-mail cadastrado">
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="auth-field"
                      autoComplete="email"
                      autoFocus
                      placeholder="voce@email.com"
                    />
                  </Field>
                  <button
                    type="submit"
                    disabled={passwordResetLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-terracotta-600 px-5 py-3.5 text-sm font-black text-white disabled:opacity-50"
                  >
                    {passwordResetLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "Enviar link de recuperação"
                    )}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
      <style>{`.auth-field{width:100%;border:1px solid #ddd6d0;border-radius:14px;background:#fff;padding:12px 14px;font-size:14px;color:#292524;outline:none;transition:.2s}.auth-field:focus{border-color:#c66a4b;box-shadow:0 0 0 3px rgba(198,106,75,.10)}`}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[.12em] text-stone-500">{label}</span>{children}</label>; }
function Benefit({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex items-start gap-3 rounded-[20px] border border-white/[.08] bg-white/[.045] p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#efb89c]/12 text-[#efb89c]">{icon}</span><span><strong className="block text-sm text-white">{title}</strong><span className="mt-1 block text-xs leading-5 text-white/42">{text}</span></span></div>; }
function GoogleIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>; }
