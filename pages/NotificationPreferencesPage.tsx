import React, { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, BriefcaseBusiness, Building2, Check, Loader2, MessageCircle, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useFeedback } from "../contexts/FeedbackContext";

const candidateOptions = [
  ["newJobs", "Novas vagas", "Oportunidades novas compatíveis com sua região e perfil", BriefcaseBusiness],
  ["applicationUpdates", "Atualizações de candidatura", "Mudanças de etapa, retorno da empresa e andamento do processo", BellRing],
  ["messages", "Mensagens", "Novas mensagens de empresas e recrutadores", MessageCircle],
  ["documents", "Documentos e admissão", "Solicitações, pendências e atualizações de documentos", ShieldAlert],
] as const;

const companyOptions = [
  ["applications", "Novas candidaturas", "Avisar quando alguém se candidatar a uma vaga", BriefcaseBusiness],
  ["candidateMessages", "Mensagens de candidatos", "Conversas e respostas recebidas", MessageCircle],
  ["hiringUpdates", "Processos e contratação", "Pendências, documentos e movimentações de contratação", BellRing],
  ["system", "Avisos do sistema", "Alertas operacionais e informações importantes da plataforma", ShieldAlert],
] as const;

const adminOptions = [
  ["moderation", "Moderação", "Vagas sinalizadas, denúncias e itens que precisam de revisão", ShieldAlert],
  ["companies", "Empresas e acessos", "Solicitações, vínculos e eventos importantes de empresas", Building2],
  ["api", "API e integrações", "Alertas relevantes de integrações e API externa", SlidersHorizontal],
  ["system", "Sistema", "Eventos operacionais e avisos administrativos", BellRing],
] as const;

export function NotificationPreferencesPage() {
  const { profile } = useAuth();
  const { toast } = useFeedback();
  const [values, setValues] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const mode = profile?.type === "ADMIN" ? "admin" : profile?.companyId ? "company" : "candidate";
  const options = useMemo(() => mode === "admin" ? adminOptions : mode === "company" ? companyOptions : candidateOptions, [mode]);

  useEffect(() => {
    let alive = true;
    api.get("/notifications/preferences")
      .then((response) => { if (alive) setValues(response.data || {}); })
      .catch(() => { if (alive) toast("Não foi possível carregar suas preferências de notificação.", "error"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [toast]);

  const enabled = values.pushEnabled !== false;
  const isOn = (key: string) => values[key] !== false;

  const save = async () => {
    setSaving(true);
    try {
      const response = await api.put("/notifications/preferences", values);
      setValues(response.data || values);
      toast("Preferências de notificação salvas.", "success");
    } catch (error) {
      console.error(error);
      toast("Não foi possível salvar suas preferências agora.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="mx-auto max-w-4xl py-16 text-center text-sm text-stone-500">Carregando preferências...</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta-600">Notificações · Preferências</p>
        <h1 className="mt-1 flex items-center gap-3 font-serif text-3xl font-bold text-stone-950"><Bell className="h-7 w-7" /> Central de notificações</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Escolha o que merece interromper seu dia. O sininho continua guardando os avisos internos; aqui você controla principalmente o que também vira push.</p>
      </header>

      <section className="overflow-hidden rounded-[28px] border border-[#ddcfc3] bg-[#fffdfa] shadow-[0_18px_50px_rgba(66,43,28,.06)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#eadfd6] bg-[#2b211c] px-5 py-5 text-white">
          <div>
            <h2 className="font-serif text-xl font-bold">Notificações push</h2>
            <p className="mt-1 text-xs text-white/55">Controle geral deste tipo de alerta.</p>
          </div>
          <Switch checked={enabled} onChange={(checked) => setValues((current) => ({ ...current, pushEnabled: checked }))} label="Ativar push" dark />
        </div>

        <div className={`divide-y divide-stone-100 ${enabled ? "" : "opacity-45"}`}>
          {options.map(([key, title, description, Icon]) => (
            <div key={key} className="flex items-center gap-4 px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-700"><Icon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-stone-900">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-stone-500">{description}</p>
              </div>
              <Switch checked={isOn(key)} onChange={(checked) => setValues((current) => ({ ...current, [key]: checked }))} label={title} disabled={!enabled} />
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t border-[#eadfd6] bg-[#fbf7f2] px-5 py-4">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#2b211c] px-5 py-3 text-sm font-bold text-white hover:bg-[#3a2b24] disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar preferências
          </button>
        </div>
      </section>
    </div>
  );
}

function Switch({ checked, onChange, label, disabled = false, dark = false }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean; dark?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? (dark ? "bg-[#e68d65]" : "bg-terracotta-600") : dark ? "bg-white/20" : "bg-stone-300"} disabled:cursor-not-allowed`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}
