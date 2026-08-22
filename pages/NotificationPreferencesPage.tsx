import React, { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, BriefcaseBusiness, Building2, Check, Loader2, MessageCircle, Send, ShieldAlert, SlidersHorizontal } from "lucide-react";
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

type Audience = "all" | "candidates" | "companies" | "admins" | "user";
type Category = "announcement" | "system" | "maintenance" | "important";

export function NotificationPreferencesPage() {
  const { profile } = useAuth();
  const { toast, confirm } = useFeedback();
  const [values, setValues] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [audience, setAudience] = useState<Audience>("all");
  const [category, setCategory] = useState<Category>("announcement");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [userQuery, setUserQuery] = useState("");

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

  const audienceLabel = audience === "all" ? "todos os usuários" : audience === "candidates" ? "todos os candidatos" : audience === "companies" ? "usuários vinculados a empresas" : audience === "admins" ? "administradores" : `o usuário ${userQuery || "informado"}`;

  const sendManualNotification = async () => {
    if (!title.trim() || !message.trim()) {
      toast("Preencha título e mensagem antes de enviar.", "warning");
      return;
    }
    if (audience === "user" && !userQuery.trim()) {
      toast("Informe o ID ou e-mail do usuário destinatário.", "warning");
      return;
    }

    const approved = await confirm({
      title: "Enviar notificação?",
      message: `A notificação será enviada para ${audienceLabel}. Ela ficará registrada no sininho e poderá gerar push conforme as preferências de cada destinatário.`,
      confirmText: "Enviar agora",
      cancelText: "Revisar",
    });
    if (!approved) return;

    setSending(true);
    try {
      const response = await api.post("/notifications/admin/broadcast", {
        audience,
        category,
        title: title.trim(),
        message: message.trim(),
        link: link.trim() || null,
        userQuery: audience === "user" ? userQuery.trim() : null,
      });
      const sent = Number(response.data?.sent || 0);
      const recipients = Number(response.data?.recipients || 0);
      toast(`Notificação enviada para ${sent} de ${recipients} destinatário${recipients === 1 ? "" : "s"}.`, sent === recipients ? "success" : "warning");
      if (sent > 0) {
        setTitle("");
        setMessage("");
        setLink("");
        if (audience === "user") setUserQuery("");
      }
    } catch (error) {
      console.error(error);
      toast("Não foi possível enviar a notificação manual.", "error");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="mx-auto max-w-5xl py-16 text-center text-sm text-stone-500">Carregando preferências...</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-terracotta-600">Notificações · Preferências</p>
        <h1 className="mt-1 flex items-center gap-3 font-serif text-3xl font-bold text-stone-950"><Bell className="h-7 w-7" /> Central de notificações</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">{mode === "admin" ? "Gerencie os alertas que você recebe e use a central administrativa para comunicar avisos importantes à plataforma." : "Escolha o que merece interromper seu dia. O sininho continua guardando os avisos internos; aqui você controla principalmente o que também vira push."}</p>
      </header>

      {mode === "admin" && (
        <section className="overflow-hidden rounded-[28px] border border-[#d8c7b9] bg-[#fffdfa] shadow-[0_18px_50px_rgba(66,43,28,.07)]">
          <div className="border-b border-[#eadfd6] bg-[#2b211c] px-5 py-5 text-white">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#f0b99d]"><Send className="h-5 w-5" /></span>
              <div>
                <h2 className="font-serif text-xl font-bold">Enviar notificação manual</h2>
                <p className="mt-1 text-xs leading-5 text-white/55">Dispare comunicados para toda a base, um grupo específico ou um único usuário.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <label>
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[.13em] text-stone-500">Público</span>
              <select value={audience} onChange={(event) => setAudience(event.target.value as Audience)} className="notification-admin-field">
                <option value="all">Todos os usuários</option>
                <option value="candidates">Somente candidatos</option>
                <option value="companies">Somente empresas</option>
                <option value="admins">Somente administradores</option>
                <option value="user">Um usuário específico</option>
              </select>
            </label>

            <label>
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[.13em] text-stone-500">Categoria</span>
              <select value={category} onChange={(event) => setCategory(event.target.value as Category)} className="notification-admin-field">
                <option value="announcement">Comunicado</option>
                <option value="important">Aviso importante</option>
                <option value="maintenance">Manutenção</option>
                <option value="system">Sistema</option>
              </select>
            </label>

            {audience === "user" && (
              <label className="lg:col-span-2">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[.13em] text-stone-500">Usuário</span>
                <input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="ID ou e-mail exato do usuário" className="notification-admin-field" />
              </label>
            )}

            <label className="lg:col-span-2">
              <span className="mb-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[.13em] text-stone-500"><span>Título</span><span>{title.length}/120</span></span>
              <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Novidade importante no PiraNegócios" className="notification-admin-field" />
            </label>

            <label className="lg:col-span-2">
              <span className="mb-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[.13em] text-stone-500"><span>Mensagem</span><span>{message.length}/800</span></span>
              <textarea value={message} maxLength={800} onChange={(event) => setMessage(event.target.value)} rows={5} placeholder="Escreva a mensagem que aparecerá no sininho e, quando permitido pelo usuário, também no push." className="notification-admin-field resize-y" />
            </label>

            <label className="lg:col-span-2">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[.13em] text-stone-500">Link ao tocar <span className="font-medium normal-case tracking-normal text-stone-400">(opcional)</span></span>
              <input value={link} maxLength={500} onChange={(event) => setLink(event.target.value)} placeholder="/vagas ou https://piranegocios.com.br/..." className="notification-admin-field" />
            </label>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#eadfd6] bg-[#fbf7f2] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-[11px] leading-5 text-stone-500">O envio sempre cria a notificação interna. O push respeita as preferências de cada usuário e só chega a dispositivos que já autorizaram notificações.</p>
            <button onClick={sendManualNotification} disabled={sending || !title.trim() || !message.trim()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-terracotta-600 px-5 py-3 text-sm font-bold text-white hover:bg-terracotta-700 disabled:cursor-not-allowed disabled:opacity-50">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar notificação
            </button>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-[28px] border border-[#ddcfc3] bg-[#fffdfa] shadow-[0_18px_50px_rgba(66,43,28,.06)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#eadfd6] bg-[#2b211c] px-5 py-5 text-white">
          <div>
            <h2 className="font-serif text-xl font-bold">Notificações push</h2>
            <p className="mt-1 text-xs text-white/55">Controle geral deste tipo de alerta.</p>
          </div>
          <Switch checked={enabled} onChange={(checked) => setValues((current) => ({ ...current, pushEnabled: checked }))} label="Ativar push" dark />
        </div>

        <div className={`divide-y divide-stone-100 ${enabled ? "" : "opacity-45"}`}>
          {options.map(([key, optionTitle, description, Icon]) => (
            <div key={key} className="flex items-center gap-4 px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-700"><Icon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-stone-900">{optionTitle}</h3>
                <p className="mt-1 text-xs leading-5 text-stone-500">{description}</p>
              </div>
              <Switch checked={isOn(key)} onChange={(checked) => setValues((current) => ({ ...current, [key]: checked }))} label={optionTitle} disabled={!enabled} />
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t border-[#eadfd6] bg-[#fbf7f2] px-5 py-4">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#2b211c] px-5 py-3 text-sm font-bold text-white hover:bg-[#3a2b24] disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar preferências
          </button>
        </div>
      </section>

      <style>{`.notification-admin-field{width:100%;border:1px solid #e7e5e4;border-radius:12px;background:#fff;padding:12px 13px;font-size:14px;outline:none;transition:.18s}.notification-admin-field:focus{border-color:#c96847;box-shadow:0 0 0 3px rgba(201,104,71,.08)}`}</style>
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
