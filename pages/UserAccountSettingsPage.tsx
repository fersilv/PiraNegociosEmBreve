import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Mail, Phone, Settings2, ShieldCheck, User } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { FileUpload } from "../components/FileUpload";
import { api } from "../lib/api";

export function UserAccountSettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [socialName, setSocialName] = useState("");
  const [treatment, setTreatment] = useState("");
  const [phone, setPhone] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || profile.fullName || profile.name || "");
    setSocialName(profile.socialName || "");
    setTreatment(profile.treatment || "");
    setPhone(profile.phone || "");
    setPhotoURL(profile.photoURL || "");
  }, [profile]);

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
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.19em] text-terracotta-600">Conta · Configurações</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-stone-950 sm:text-4xl">Configurações do perfil</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            Dados de identificação e contato da sua conta. Seu histórico profissional e suas preferências de trabalho ficam em áreas separadas.
          </p>
        </div>
        <div className="rounded-2xl border border-[#5b4030]/10 bg-white/70 px-4 py-3 text-xs text-stone-500 shadow-sm">
          <span className="inline-flex items-center gap-2 font-bold text-stone-700"><ShieldCheck className="h-4 w-4 text-terracotta-600" /> Conta protegida</span>
        </div>
      </header>

      <form onSubmit={save} className="overflow-hidden rounded-[30px] border border-[#ddcfc3] bg-[#fffdfa] shadow-[0_22px_60px_rgba(66,43,28,.07)]">
        <div className="border-b border-[#eadfd6] bg-[#2b211c] px-5 py-5 text-white sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[#f0b99d]"><Settings2 className="h-5 w-5" /></span>
            <div><h2 className="font-serif text-2xl font-bold">Sua conta</h2><p className="mt-1 text-xs text-white/45">Identificação, foto e canais de contato.</p></div>
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
            <FileUpload label="Foto do perfil" accept="image/*" value={photoURL} onChange={setPhotoURL} type="avatar" placeholder="Selecione ou arraste sua foto" />
            <p className="mt-3 text-xs leading-5 text-stone-500">Essa imagem representa sua conta e pode aparecer nas áreas profissionais do sistema.</p>
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
              <input required value={phone} onChange={(event) => setPhone(event.target.value)} className="account-field" placeholder="(19) 99999-9999" />
            </Field>
            <Field label="E-mail da conta" icon={<Mail className="h-4 w-4" />} full>
              <input disabled value={profile?.email || user?.email || ""} className="account-field cursor-not-allowed bg-stone-50 text-stone-400" />
              <p className="mt-1.5 text-[11px] text-stone-400">O e-mail de autenticação não é alterado por esta tela.</p>
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#eadfd6] bg-[#fbf7f2] px-5 py-4 sm:px-6">
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
