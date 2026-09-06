import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, History, Loader2, Lock, MessageCircle, RefreshCw, Settings2, ShieldCheck, UserCheck, Users, X } from "lucide-react";
import { api } from "../../lib/api";

type GroupAutomation = {
  id?: string | null;
  groupId: string;
  groupName: string;
  description?: string | null;
  monitored: boolean;
  approveMembers: boolean;
  saveContacts: boolean;
  sendWelcome: boolean;
  includeGroupDescription: boolean;
  rejectMembers: boolean;
  removeMembers: boolean;
  manageAdmins: boolean;
  editGroupInfo: boolean;
  sendGroupMessages: boolean;
  welcomeTemplate?: string | null;
  channelUrl?: string | null;
  live: boolean;
  isAdmin: boolean;
  canSendGroupMessages: boolean;
  participantCount?: number | null;
  pendingRequestCount?: number | null;
};

type GroupEvent = {
  id: string;
  memberCanonicalId?: string | null;
  actorWaId?: string | null;
  eventType: string;
  occurredAt: string;
  payload?: Record<string, unknown> | null;
};

const BOOLEAN_FIELDS = [
  "monitored", "approveMembers", "saveContacts", "sendWelcome", "includeGroupDescription",
  "rejectMembers", "removeMembers", "manageAdmins", "editGroupInfo", "sendGroupMessages",
] as const;

export function WhatsAppGroupAutomationPanel({ instanceId, connected }: { instanceId: string; connected: boolean }) {
  const [groups, setGroups] = useState<GroupAutomation[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<GroupAutomation | null>(null);
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await api.get(`/admin/whatsapp/instances/${instanceId}/group-automations`);
      const rows = Array.isArray(response.data) ? response.data : [];
      setGroups(rows);
      setEditing((current) => current ? rows.find((row: GroupAutomation) => row.groupId === current.groupId) || current : null);
    } catch (error: any) {
      if (!quiet) setNotice(error?.response?.data?.message || "Não foi possível carregar os grupos.");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [instanceId, connected]);
  useEffect(() => {
    if (!connected) return;
    const timer = window.setInterval(() => void load(true), 15000);
    return () => window.clearInterval(timer);
  }, [instanceId, connected]);

  const monitoredCount = groups.filter((group) => group.monitored).length;
  const allMonitored = groups.length > 0 && monitoredCount === groups.length;

  const update = async (group: GroupAutomation, patch: Partial<GroupAutomation>, closeNotice = false) => {
    const key = `${group.groupId}:${Object.keys(patch).join(",")}`;
    setBusy(key);
    if (closeNotice) setNotice(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const field of BOOLEAN_FIELDS) if (field in patch) payload[field] = patch[field];
      if ("channelUrl" in patch) payload.channelUrl = patch.channelUrl ?? "";
      if ("welcomeTemplate" in patch) payload.welcomeTemplate = patch.welcomeTemplate ?? null;
      const response = await api.put(`/admin/whatsapp/instances/${instanceId}/group-automations/${encodeURIComponent(group.groupId)}`, payload);
      const saved = response.data as GroupAutomation;
      setGroups((current) => current.map((item) => item.groupId === group.groupId ? { ...item, ...saved } : item));
      setEditing((current) => current?.groupId === group.groupId ? { ...current, ...saved } : current);
      return saved;
    } catch (error: any) {
      setNotice(error?.response?.data?.message || "Não foi possível salvar a configuração do grupo.");
      throw error;
    } finally {
      setBusy(null);
    }
  };

  const setAllMonitored = async (enabled: boolean) => {
    if (!connected) return;
    setBusy("all");
    setNotice(null);
    try {
      for (const group of groups) {
        if (group.monitored === enabled) continue;
        await api.put(`/admin/whatsapp/instances/${instanceId}/group-automations/${encodeURIComponent(group.groupId)}`, { monitored: enabled });
      }
      await load(true);
      setNotice(enabled ? "Todos os grupos foram marcados para monitoramento. As ações continuam respeitando seus próprios toggles." : "Monitoramento desligado para todos os grupos.");
    } catch (error: any) {
      setNotice(error?.response?.data?.message || "Não foi possível atualizar todos os grupos.");
      await load(true);
    } finally {
      setBusy(null);
    }
  };

  const openGroup = async (group: GroupAutomation) => {
    setEditing(group);
    setEvents([]);
    setEventsLoading(true);
    try {
      const response = await api.get(`/admin/whatsapp/instances/${instanceId}/group-automations/${encodeURIComponent(group.groupId)}/events?limit=60`);
      setEvents(Array.isArray(response.data) ? response.data : []);
    } catch { setEvents([]); }
    finally { setEventsLoading(false); }
  };

  const defaultPreview = useMemo(() => {
    if (!editing) return "";
    const parts = [
      `👋 Bem-vindo(a) ao ${editing.groupName}!`,
      editing.includeGroupDescription && editing.description ? `Para facilitar, seguem as regras e informações do grupo:\n\n${editing.description}` : null,
      "💼 Além das vagas compartilhadas por aqui, você encontra oportunidades atualizadas no PiraNegócios:\nhttps://piranegocios.com.br",
      "📄 Cadastre gratuitamente seu currículo no nosso banco de talentos para também poder ser encontrado por empresas.",
      editing.channelUrl ? `📢 Acompanhe nosso canal no WhatsApp para novas oportunidades:\n${editing.channelUrl}` : null,
      "📱 Salve o contato do PiraNegócios para conseguir visualizar nossos Status com novas vagas.",
    ];
    return parts.filter(Boolean).join("\n\n");
  }, [editing]);

  return <>
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><Users className="h-5 w-5" /></span>
          <div><p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">Automação de grupos</p><h2 className="mt-1 text-lg font-black text-stone-950">Monitoramento e boas-vindas</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-stone-500">Somente grupos marcados são monitorados. Marcar um grupo não autoriza ações por si só: aprovação, contato, mensagem privada e qualquer função administrativa têm controles próprios.</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-stone-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-stone-500">{monitoredCount}/{groups.length} monitorados</span>
          <label className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${connected ? "cursor-pointer border-stone-200 text-stone-700" : "cursor-not-allowed border-stone-100 text-stone-300"}`}><input type="checkbox" checked={allMonitored} disabled={!connected || busy === "all" || groups.length === 0} onChange={(e) => void setAllMonitored(e.target.checked)} className="accent-sky-700" />{busy === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Todos os grupos"}</label>
          <button type="button" disabled={!connected || loading} onClick={() => void load()} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 text-stone-500 disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
      </div>

      {notice && <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-900">{notice}</div>}
      {!connected && <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Conecte esta sessão para ler grupos e verificar compatibilidade de permissões administrativas.</div>}

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {loading && groups.length === 0 ? <div className="col-span-full flex min-h-28 items-center justify-center text-sm text-stone-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando grupos...</div> : groups.map((group) => <div key={group.groupId} className={`rounded-2xl border p-4 transition ${group.monitored ? "border-sky-200 bg-sky-50/30" : "border-stone-200"}`}>
          <div className="flex items-start gap-3">
            <label className="mt-1 flex cursor-pointer"><input type="checkbox" checked={group.monitored} disabled={!connected || busy?.startsWith(group.groupId)} onChange={(e) => void update(group, { monitored: e.target.checked })} className="h-4 w-4 accent-sky-700" /></label>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-stone-900">{group.groupName}</p><code className="mt-0.5 block truncate text-[10px] text-stone-400">{group.groupId}</code><div className="mt-2 flex flex-wrap gap-1.5"><Badge ok={group.isAdmin} text={group.isAdmin ? "ADMIN" : "NÃO ADMIN"} /><Badge ok={group.sendWelcome} text={group.sendWelcome ? "BOAS-VINDAS ON" : "BOAS-VINDAS OFF"} /><Badge ok={false} neutral text={group.sendGroupMessages ? "MENSAGEM NO GRUPO ON" : "MENSAGEM NO GRUPO OFF"} />{Number(group.pendingRequestCount || 0) > 0 && <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black text-amber-800">{group.pendingRequestCount} PENDENTE(S)</span>}</div></div>
            <button type="button" onClick={() => void openGroup(group)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600"><Settings2 className="h-4 w-4" /></button>
          </div>
          <div className="mt-3 flex gap-4 border-t border-stone-100 pt-3 text-[10px] font-bold text-stone-400"><span>{group.participantCount ?? "?"} membros</span><span>{group.approveMembers ? "aprovação automática ligada" : "aprovação manual"}</span></div>
        </div>)}
        {!loading && groups.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-400">Nenhum grupo visível nesta sessão.</div>}
      </div>
    </section>

    {editing && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-stone-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
      <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-stone-200 bg-white/95 p-5 backdrop-blur sm:p-6"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-black text-stone-950">{editing.groupName}</h3><Badge ok={editing.isAdmin} text={editing.isAdmin ? "ADMIN" : "NÃO ADMIN"} /></div><code className="mt-1 block text-[10px] text-stone-400">{editing.groupId}</code></div><button onClick={() => setEditing(null)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 text-stone-500"><X className="h-4 w-4" /></button></div>
        <div className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-3 md:grid-cols-2">
            <Toggle title="Monitorar este grupo" description="Habilita o observador de entradas, saídas e solicitações para este grupo." checked={editing.monitored} onChange={(v) => void update(editing, { monitored: v })} />
            <Toggle title="Aprovar membros pendentes" description={editing.isAdmin ? "Aprova automaticamente pedidos sem histórico de remoção administrativa." : "Incompatível: este número não é administrador."} checked={editing.approveMembers} locked={!editing.isAdmin} onChange={(v) => void update(editing, { approveMembers: v })} />
            <Toggle title="Salvar novo membro no WhatsApp" description="Salva na agenda interna do WhatsApp sem forçar sincronização com a agenda do celular." checked={editing.saveContacts} onChange={(v) => void update(editing, { saveContacts: v })} />
            <Toggle title="Enviar boas-vindas no privado" description="Uma pessoa recebe essa abordagem uma única vez no total, mesmo que entre em outros grupos." checked={editing.sendWelcome} onChange={(v) => void update(editing, { sendWelcome: v })} />
            <Toggle title="Copiar descrição/regras do grupo" description="Inclui literalmente a descrição atual do grupo na mensagem. A descrição nunca é alterada." checked={editing.includeGroupDescription} onChange={(v) => void update(editing, { includeGroupDescription: v })} />
            <Toggle danger title="Enviar mensagem no grupo" description="Permite automações publicarem no grupo. Fica desligado por padrão para evitar disparos acidentais." checked={editing.sendGroupMessages} locked={!editing.canSendGroupMessages} onChange={(v) => void update(editing, { sendGroupMessages: v })} />
          </div>

          <div className="rounded-2xl border border-stone-200 p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-stone-400" /><h4 className="text-sm font-black text-stone-900">Permissões administrativas</h4></div><p className="mt-1 text-xs text-stone-500">Todas ficam desligadas por padrão. Sem cargo de administrador, permanecem bloqueadas por incompatibilidade.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><Toggle compact title="Rejeitar solicitações" checked={editing.rejectMembers} locked={!editing.isAdmin} onChange={(v) => void update(editing, { rejectMembers: v })} /><Toggle compact title="Remover membros" checked={editing.removeMembers} locked={!editing.isAdmin} onChange={(v) => void update(editing, { removeMembers: v })} /><Toggle compact title="Promover/rebaixar admins" checked={editing.manageAdmins} locked={!editing.isAdmin} onChange={(v) => void update(editing, { manageAdmins: v })} /><Toggle compact title="Alterar dados do grupo" checked={editing.editGroupInfo} locked={!editing.isAdmin} onChange={(v) => void update(editing, { editGroupInfo: v })} /></div></div>

          <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-stone-200 p-4"><h4 className="text-sm font-black text-stone-900">Descrição atual do grupo</h4><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-stone-400">Somente leitura</p><div className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl bg-stone-50 p-3 text-xs leading-5 text-stone-600">{editing.description || "Este grupo não possui descrição."}</div></div><div className="rounded-2xl border border-stone-200 p-4"><h4 className="text-sm font-black text-stone-900">Canal do PiraNegócios</h4><p className="mt-1 text-xs text-stone-500">Link usado na mensagem privada. Deixe vazio até informar o link oficial.</p><input value={editing.channelUrl || ""} onChange={(e) => setEditing({ ...editing, channelUrl: e.target.value })} onBlur={() => void update(editing, { channelUrl: editing.channelUrl || "" })} placeholder="https://whatsapp.com/channel/..." className="mt-3 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-sky-300" /></div></div>

          <div className="rounded-2xl border border-stone-200 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h4 className="text-sm font-black text-stone-900">Mensagem de boas-vindas</h4><p className="mt-1 text-xs text-stone-500">Se o campo personalizado ficar vazio, usamos o texto padrão abaixo. O bloqueio é global: já enviou uma vez, nunca envia de novo.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-[9px] font-black text-emerald-700">1 PESSOA = 1 MENSAGEM</span></div><textarea value={editing.welcomeTemplate || ""} onChange={(e) => setEditing({ ...editing, welcomeTemplate: e.target.value })} onBlur={() => void update(editing, { welcomeTemplate: editing.welcomeTemplate || null })} placeholder="Personalização opcional. Variáveis: {{groupName}}, {{groupDescription}}, {{siteUrl}}, {{channelUrl}}" className="mt-4 min-h-28 w-full rounded-xl border border-stone-200 p-3 text-xs leading-5 outline-none focus:border-sky-300" /><div className="mt-3"><p className="text-[10px] font-black uppercase tracking-wide text-stone-400">Prévia do padrão</p><div className="mt-2 whitespace-pre-wrap rounded-xl bg-stone-950 p-4 text-xs leading-5 text-stone-100">{editing.welcomeTemplate || defaultPreview}</div></div></div>

          <div className="rounded-2xl border border-stone-200 p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><History className="h-4 w-4 text-stone-400" /><h4 className="text-sm font-black text-stone-900">Histórico recente da automação</h4></div>{eventsLoading && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}</div><div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{events.map((event) => <div key={event.id} className="flex items-start justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2.5"><div className="min-w-0"><p className="text-xs font-black text-stone-700">{eventLabel(event.eventType)}</p><p className="mt-0.5 truncate text-[10px] text-stone-400">{event.memberCanonicalId || "sem identificador"}</p></div><time className="shrink-0 text-[10px] font-bold text-stone-400">{new Date(event.occurredAt).toLocaleString("pt-BR")}</time></div>)}{!eventsLoading && events.length === 0 && <p className="py-6 text-center text-xs text-stone-400">Nenhum evento registrado para este grupo ainda.</p>}</div></div>
        </div>
      </div>
    </div>}
  </>;
}

function Badge({ ok, text, neutral = false }: { ok: boolean; text: string; neutral?: boolean }) {
  const cls = neutral ? "bg-stone-100 text-stone-500" : ok ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500";
  return <span className={`rounded-full px-2 py-1 text-[9px] font-black ${cls}`}>{text}</span>;
}

function Toggle({ title, description, checked, onChange, locked = false, danger = false, compact = false }: { title: string; description?: string; checked: boolean; onChange: (value: boolean) => void; locked?: boolean; danger?: boolean; compact?: boolean }) {
  return <label className={`flex gap-3 rounded-2xl border ${compact ? "p-3" : "p-4"} ${locked ? "cursor-not-allowed border-stone-100 bg-stone-50 opacity-60" : checked ? danger ? "cursor-pointer border-red-200 bg-red-50/60" : "cursor-pointer border-sky-200 bg-sky-50/40" : "cursor-pointer border-stone-200 bg-white"}`}><input type="checkbox" checked={checked} disabled={locked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-sky-700" /><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-sm font-black text-stone-900">{locked && <Lock className="h-3.5 w-3.5 text-stone-400" />}{title}</span>{description && <span className="mt-1 block text-xs leading-5 text-stone-500">{description}</span>}</span>{checked && !locked && <Check className="mt-1 h-4 w-4 shrink-0 text-sky-700" />}</label>;
}

function eventLabel(type: string) {
  const labels: Record<string, string> = {
    JOINED: "Membro entrou", READMITTED_BY_ADMIN: "Membro readmitido por administrador", LEFT_VOLUNTARILY: "Membro saiu voluntariamente",
    REMOVED_BY_ADMIN: "Removido por administrador", REMOVAL_UNCERTAIN: "Remoção aguardando decisão humana", AUTO_APPROVED_REQUEST: "Solicitação aprovada automaticamente",
    AUTO_APPROVAL_SKIPPED_REMOVED: "Solicitação preservada por histórico de remoção", AUTO_APPROVAL_FAILED: "Falha na aprovação automática",
    WELCOME_SENT: "Boas-vindas enviada", WELCOME_SKIPPED_ALREADY_SENT: "Mensagem ignorada: pessoa já recebeu", CONTACT_SAVE_FAILED: "Falha ao salvar contato",
    PROMOTED_ADMIN: "Promovido a administrador", DEMOTED_ADMIN: "Rebaixado de administrador",
  };
  return labels[type] || type.replace(/_/g, " ");
}
