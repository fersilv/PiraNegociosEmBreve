import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Mail, MessageCircle, Phone, Settings2, ShieldCheck, User } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { FileUpload } from "../components/FileUpload";
import { api } from "../lib/api";

type WhatsAppVerification = {
  verified: boolean;
  phoneE164?: string | null;
  whatsappId?: string | null;
  verifiedAt?: string | null;
};

export function UserAccountSettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [socialName, setSocialName] = useState("");
  const [treatment, setTreatment] = useState("");
  const [phone, setPhone] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [waStatus, setWaStatus] = useState<WhatsAppVerification | null>(null);
  const [waBusy, setWaBusy] = useState<"request" | "verify" | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [waNotice, setWaNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || profile.fullName || profile.name || "");
    setSocialName(profile.socialName || "");
    setTreatment(profile.treatment || "");
    setPhone(profile.phone || "");
    setPhotoURL(profile.photoURL || "");
  }, [profile]);

  const loadWhatsAppStatus = async () => {
    try {
      const response = await api.get("/whatsapp/phone/status");
      setWaStatus(response.data || { verified: false });
    } catch {
      setWaStatus({ verified: false });
    }
  };

  useEffect(() => { void loadWhatsAppStatus(); }, []);

  const normalizedPhone = (value: string) => String(value || "").replace(/\D+/g, "");
  const verifiedMatchesCurrent = Boolean(
    waStatus?.verified &&
    waStatus.phoneE164 &&
    (() => {
      const current = normalizedPhone(phone);
      const verified = normalizedPhone(waStatus.phoneE164 || "");
      return current === verified || `55${current}` === verified || current === verified.replace(/^55/, "");
    })(),
  );

  const requestOtp = async () => {
    if (!phone.trim()) return;
    setWaBusy("request");
    setWaNotice(null);
    try {
      const response = await api.post("/whatsapp/phone/request-otp", { phone: phone.trim() });
      setOtpSent(true);
      setOtpCode("");
      setWaNotice(response.data?.message || "Código enviado pelo WhatsApp.");
    } catch (error: any) {
      setWaNotice(error?.response?.data?.message || "Não foi possível enviar o código agora.");
    } finally {
      setWaBusy(null);
    }
  };

  const verifyOtp = async () => {
    if (!phone.trim() || otpCode.replace(/\D/g, "").length !== 6) return;
    setWaBusy("verify");
    setWaNotice(null);
    try {
      await api.post("/whatsapp/phone/verify-otp", { phone: phone.trim(), code: otpCode });
      await Promise.all([loadWhatsAppStatus(), refreshProfile()]);
      setOtpSent(false);
      setOtpCode("");
      setWaNotice("WhatsApp confirmado e vinculado à sua conta.");
    } catch (error: any) {
      setWaNotice(error?.response?.data?.message || "Não foi possível confirmar o código.");
    } finally {
      setWaBusy(null);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!displayName.trim() || !phone.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.post("/users/me", {
        displayName: displayName.trim(),
        fullName: displayName.trim(),
        socialName: socialName.trim(),
        treatment: treatment.trim(),
        phone: phone.trim(),
        photoURL,
      });
      await refreshProfile();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2400);
    } catch (error) {
      console.error("Erro ao salvar configurações da conta:", error);
      alert("Não foi possível salvar suas configurações agora.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
      <header className="grid gap-3 sm:gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-terracotta-600 sm:text-[10px]">Conta · Configurações</p>
          <h1 className="mt-1 font-serif text-[32px] font-bold leading-[1.02] tracking-[-.025em] text-stone-950 sm:text-4xl">Configurações do perfil</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Identificação, foto e canais de contato da sua conta.</p>
        </div>
        <div className="hidden rounded-2xl border border-[#5b4030]/10 bg-white/70 px-4 py-3 text-xs text-stone-500 shadow-sm sm:block">
          <span className="inline-flex items-center gap-2 font-bold text-stone-700"><ShieldCheck className="h-4 w-4 text-terracotta-600" /> Conta protegida</span>
        </div>
      </header>

      <form onSubmit={save} className="overflow-hidden rounded-[26px] border border-[#ddcfc3] bg-[#fffdfa] shadow-[0_18px_50px_rgba(66,43,28,.06)] sm:rounded-[30px]">
        <div className="border-b border-[#eadfd6] bg-[#2b211c] px-4 py-4 text-white sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-[#f0b99d] sm:h-11 sm:w-11"><Settings2 className="h-5 w-5" /></span>
            <div><h2 className="font-serif text-xl font-bold sm:text-2xl">Sua conta</h2><p className="mt-1 text-[11px] text-white/45 sm:text-xs">Dados pessoais separados do seu perfil profissional.</p></div>
          </div>
        </div>

        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
            <FileUpload label="Foto do perfil" accept="image/*" value={photoURL} onChange={setPhotoURL} type="avatar" maxSizeKB={20480} placeholder="Selecione ou arraste sua foto" />
            <p className="mt-3 text-xs leading-5 text-stone-500">Essa imagem representa sua conta nas áreas profissionais do sistema. Limite: 20 MB.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome completo *" icon={<User className="h-4 w-4" />}>
              <input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="account-field" />
            </Field>
            <Field label="Nome social" icon={<User className="h-4 w-4" />}>
              <input value={socialName} onChange={(event) => setSocialName(event.target.value)} className="account-field" placeholder="Opcional" />
            </Field>
            <Field label="Tratamento" icon={<User className="h-4 w-4" />}>
              <input value={treatment} onChange={(event) => setTreatment(event.target.value)} className="account-field" placeholder="Ex.: Sra., Sr., Dra." />
            </Field>
            <Field label="Telefone / WhatsApp *" icon={<Phone className="h-4 w-4" />}>
              <input required value={phone} onChange={(event) => { setPhone(event.target.value); setOtpSent(false); setOtpCode(""); setWaNotice(null); }} className="account-field" placeholder="(19) 99999-9999" />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {verifiedMatchesCurrent ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> WhatsApp verificado</span>
                ) : (
                  <button type="button" disabled={!phone.trim() || waBusy !== null} onClick={() => void requestOtp()} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black text-emerald-800 disabled:opacity-50">{waBusy === "request" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />} Enviar código pelo WhatsApp</button>
                )}
              </div>
            </Field>
            <Field label="E-mail da conta" icon={<Mail className="h-4 w-4" />} full>
              <input disabled value={profile?.email || user?.email || ""} className="account-field cursor-not-allowed bg-stone-50 text-stone-400" />
              <p className="mt-1.5 text-[11px] text-stone-400">O e-mail de autenticação não é alterado por esta tela.</p>
            </Field>
          </div>
        </div>

        {(otpSent || waNotice) && !verifiedMatchesCurrent && (
          <div className="mx-4 mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 sm:mx-6">
            <div className="flex items-start gap-3"><MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><div className="min-w-0 flex-1"><p className="text-sm font-black text-emerald-950">Confirmar WhatsApp</p>{waNotice && <p className="mt-1 text-xs leading-5 text-emerald-800">{waNotice}</p>}{otpSent && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Código de 6 dígitos" className="account-field max-w-[230px]" /><button type="button" disabled={otpCode.length !== 6 || waBusy !== null} onClick={() => void verifyOtp()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{waBusy === "verify" && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar código</button></div>}</div></div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-[#eadfd6] bg-[#fbf7f2] px-4 py-4 sm:px-6">
          {saved && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Salvo</span>}
          <button disabled={saving || !displayName.trim() || !phone.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#2b211c] px-5 py-3 text-sm font-bold text-white hover:bg-[#3a2b24] disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar configurações
          </button>
        </div>
      </form>

      <style>{`.account-field{width:100%;border:1px solid #e7e5e4;border-radius:12px;background:white;padding:12px 13px;font-size:14px;outline:none;transition:.18s}.account-field:focus{border-color:#c96847;box-shadow:0 0 0 3px rgba(201,104,71,.08)}`}</style>
    </div>
  );
}

function Field({ label, icon, children, full = false }: { label: string; icon: React.ReactNode; children: React.ReactNode; full?: boolean }) {
  return <label className={full ? "sm:col-span-2" : ""}><span className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.13em] text-stone-500">{icon}{label}</span>{children}</label>;
}
