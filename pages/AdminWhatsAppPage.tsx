import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronRight,
  Copy,
  KeyRound,
  Loader2,
  MessageCircle,
  Plug,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  RotateCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Star,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { api } from "../lib/api";
import { WhatsAppGroupAutomationPanel } from "../components/admin/WhatsAppGroupAutomationPanel";

type Instance = {
  id: string;
  name: string;
  purpose?: string | null;
  phoneNumber?: string | null;
  provider: string;
  status: "DISCONNECTED" | "CONNECTING" | "QR_REQUIRED" | "CONNECTED" | "ERROR";
  allowedScopes: string[];
  active: boolean;
  isPrimarySupport?: boolean;
  conciergeEnabled?: boolean;
  lastError?: string | null;
  lastConnectedAt?: string | null;
  connected: boolean;
  qrCode?: string | null;
  runtimeDetail?: string | null;
  keyCount?: number;
  messageCount?: number;
};

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  active: boolean;
  lastUsedAt?: string | null;
};

type Capability = {
  scope: string;
  category: string;
  label: string;
  description: string;
  risk: "read" | "write" | "destructive";
  experimental?: boolean;
  method?: string;
  signature?: string;
  legacy?: boolean;
};

const defaultScopes = ["connection:read", "messages:read", "contacts:read", "groups:read"];

function toggleMany(current: string[], scopes: string[], enabled: boolean) {
  if (enabled) return Array.from(new Set([...current, ...scopes]));
  const removing = new Set(scopes);
  return current.filter((scope) => !removing.has(scope));
}

export function AdminWhatsAppPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newNumber, setNewNumber] = useState({ name: "", purpose: "", phoneNumber: "" });
  const [keyName, setKeyName] = useState("Integração MCP");
  const [keyScopes, setKeyScopes] = useState<string[]>(defaultScopes);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [editingKeyName, setEditingKeyName] = useState("");
  const [editingKeyScopes, setEditingKeyScopes] = useState<string[]>([]);
  const [capabilitySearch, setCapabilitySearch] = useState("");
  const [showLegacy, setShowLegacy] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [testTarget, setTestTarget] = useState("");
  const [testText, setTestText] = useState("");

  const selected = useMemo(
    () => instances.find((item) => item.id === selectedId) || null,
    [instances, selectedId],
  );

  const visibleCapabilities = useMemo(() => {
    const search = capabilitySearch.trim().toLocaleLowerCase("pt-BR");
    return capabilities.filter((capability) => {
      if (!showLegacy && capability.legacy) return false;
      if (!search) return true;
      return [
        capability.label,
        capability.description,
        capability.category,
        capability.scope,
        capability.method,
        capability.signature,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(search));
    });
  }, [capabilities, capabilitySearch, showLegacy]);

  const capabilityGroups = useMemo(() => {
    const grouped = new Map<string, Capability[]>();
    for (const capability of visibleCapabilities) {
      const current = grouped.get(capability.category) || [];
      current.push(capability);
      grouped.set(capability.category, current);
    }
    return Array.from(grouped.entries());
  }, [visibleCapabilities]);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [instancesResponse, capabilitiesResponse] = await Promise.all([
        api.get("/admin/whatsapp/instances"),
        api.get("/admin/whatsapp/capabilities"),
      ]);
      const data = Array.isArray(instancesResponse.data) ? instancesResponse.data : [];
      setInstances(data);
      setCapabilities(Array.isArray(capabilitiesResponse.data) ? capabilitiesResponse.data : []);
      setSelectedId((current) => current && data.some((item: Instance) => item.id === current) ? current : data[0]?.id || null);
    } catch (error: any) {
      if (!quiet) setNotice(error?.response?.data?.message || "Não foi possível carregar a central do WhatsApp.");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  const loadKeys = async (id: string) => {
    try {
      const response = await api.get(`/admin/whatsapp/instances/${id}/keys`);
      setKeys(Array.isArray(response.data) ? response.data : []);
    } catch {
      setKeys([]);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (selectedId) void loadKeys(selectedId);
    else setKeys([]);
    setEditingKeyId(null);
  }, [selectedId]);
  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(timer);
  }, [selectedId]);

  useEffect(() => {
    if (!selected) return;
    setKeyScopes((current) => current.filter((scope) => selected.allowedScopes.includes(scope)));
    setEditingKeyScopes((current) => current.filter((scope) => selected.allowedScopes.includes(scope)));
  }, [selected?.id, selected?.allowedScopes.join("|")]);

  const run = async (name: string, action: () => Promise<unknown>, success?: string) => {
    setBusy(name);
    setNotice(null);
    try {
      await action();
      if (success) setNotice(success);
      await load(true);
      if (selectedId) await loadKeys(selectedId);
    } catch (error: any) {
      setNotice(error?.response?.data?.message || error?.message || "A operação não pôde ser concluída.");
    } finally {
      setBusy(null);
    }
  };

  const createInstance = async () => {
    await run("create", async () => {
      const response = await api.post("/admin/whatsapp/instances", {
        ...newNumber,
        allowedScopes: defaultScopes,
      });
      setShowCreate(false);
      setNewNumber({ name: "", purpose: "", phoneNumber: "" });
      if (response.data?.id) setSelectedId(response.data.id);
    }, "Número criado. Agora conecte pelo QR Code.");
  };

  const updateAllowedScope = async (scope: string, enabled: boolean) => {
    if (!selected) return;
    const next = toggleMany(selected.allowedScopes, [scope], enabled);
    await run(`scope:${scope}`, () => api.put(`/admin/whatsapp/instances/${selected.id}`, { allowedScopes: next }));
  };

  const updateAllowedGroup = async (category: string, items: Capability[], enabled: boolean) => {
    if (!selected) return;
    const scopes = items.map((item) => item.scope);
    const next = toggleMany(selected.allowedScopes, scopes, enabled);
    await run(
      `scope-group:${category}`,
      () => api.put(`/admin/whatsapp/instances/${selected.id}`, { allowedScopes: next }),
      enabled ? `Todas as permissões de “${category}” foram habilitadas.` : `As permissões de “${category}” foram desabilitadas.`,
    );
  };

  const createKey = async () => {
    if (!selected) return;
    setBusy("key:create");
    setNotice(null);
    try {
      const response = await api.post(`/admin/whatsapp/instances/${selected.id}/keys`, {
        name: keyName,
        scopes: keyScopes,
      });
      setRevealedKey(response.data?.apiKey || null);
      setNotice("Chave criada. Ela só será exibida completa agora.");
      await loadKeys(selected.id);
      await load(true);
    } catch (error: any) {
      setNotice(error?.response?.data?.message || "Não foi possível criar a chave.");
    } finally {
      setBusy(null);
    }
  };

  const beginEditKey = (key: ApiKeyRow) => {
    setEditingKeyId(key.id);
    setEditingKeyName(key.name);
    setEditingKeyScopes(selected ? key.scopes.filter((scope) => selected.allowedScopes.includes(scope)) : [...key.scopes]);
  };

  const saveEditedKey = async () => {
    if (!editingKeyId || !editingKeyName.trim() || !editingKeyScopes.length) return;
    setBusy(`edit-key:${editingKeyId}`);
    setNotice(null);
    try {
      await api.put(`/admin/whatsapp/keys/${editingKeyId}`, {
        name: editingKeyName,
        scopes: editingKeyScopes,
      });
      setNotice("Permissões da chave atualizadas. Reconecte/reautorize o MCP para ele refazer o catálogo de tools.");
      setEditingKeyId(null);
      if (selectedId) await loadKeys(selectedId);
    } catch (error: any) {
      setNotice(error?.response?.data?.message || "Não foi possível atualizar a chave.");
    } finally {
      setBusy(null);
    }
  };

  const rotateKey = async (key: ApiKeyRow) => {
    if (!window.confirm(`Rotacionar a chave “${key.name}”? A chave atual deixará de funcionar imediatamente.`)) return;
    setBusy(`rotate:${key.id}`);
    try {
      const response = await api.post(`/admin/whatsapp/keys/${key.id}/rotate`);
      setRevealedKey(response.data?.apiKey || null);
      setNotice("Chave rotacionada. Copie a nova credencial agora.");
      if (selectedId) await loadKeys(selectedId);
    } catch (error: any) {
      setNotice(error?.response?.data?.message || "Não foi possível rotacionar a chave.");
    } finally {
      setBusy(null);
    }
  };

  const deleteKey = async (key: ApiKeyRow) => {
    if (!window.confirm(`Excluir definitivamente a chave “${key.name}”? Ela não poderá ser recuperada.`)) return;
    await run(
      `delete-key:${key.id}`,
      () => api.delete(`/admin/whatsapp/keys/${key.id}`),
      `Chave “${key.name}” excluída.`,
    );
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setNotice("Copiado para a área de transferência.");
  };

  const mcpUrl = selected ? `${window.location.origin}/api/whatsapp/mcp/${selected.id}` : "";
  const restUrl = selected ? `${window.location.origin}/api/whatsapp/v1/${selected.id}` : "";

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando central do WhatsApp...</div>;
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Comunicação · Integrações</p>
          <h1 className="mt-1 font-serif text-3xl font-black text-stone-950">Central WhatsApp</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Controle atendimento automático e cada função do WPPConnect individualmente. O número define o teto de acesso; cada chave OAuth/MCP recebe apenas o subconjunto que você autorizar.</p>
        </div>
        <button type="button" onClick={() => setShowCreate((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-950 px-4 py-3 text-sm font-black text-white shadow-sm"><Plus className="h-4 w-4" /> Adicionar número</button>
      </header>

      {notice && <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700 shadow-sm">{notice}</div>}

      {showCreate && (
        <section className="grid gap-3 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm md:grid-cols-3">
          <label className="space-y-1.5 text-xs font-bold text-stone-600">Nome do número<input value={newNumber.name} onChange={(e) => setNewNumber({ ...newNumber, name: e.target.value })} placeholder="Ex.: Recrutamento" className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-stone-400" /></label>
          <label className="space-y-1.5 text-xs font-bold text-stone-600">Função / finalidade<input value={newNumber.purpose} onChange={(e) => setNewNumber({ ...newNumber, purpose: e.target.value })} placeholder="Atendimento de candidatos" className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-stone-400" /></label>
          <label className="space-y-1.5 text-xs font-bold text-stone-600">Telefone esperado <span className="font-medium text-stone-400">(opcional)</span><input value={newNumber.phoneNumber} onChange={(e) => setNewNumber({ ...newNumber, phoneNumber: e.target.value })} placeholder="5519999999999" className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-stone-400" /></label>
          <div className="flex justify-end md:col-span-3"><button disabled={!newNumber.name.trim() || busy === "create"} onClick={() => void createInstance()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40">{busy === "create" && <Loader2 className="h-4 w-4 animate-spin" />} Criar conexão</button></div>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-3">
          {instances.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-stone-300 bg-white/60 p-7 text-center"><Smartphone className="mx-auto h-8 w-8 text-stone-300" /><p className="mt-3 font-black text-stone-800">Nenhum número conectado ainda</p><p className="mt-1 text-sm text-stone-500">Crie a primeira instância e leia o QR Code pelo aparelho.</p></div>
          ) : instances.map((item) => (
            <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === item.id ? "border-stone-900 bg-stone-950 text-white shadow-lg" : "border-stone-200 bg-white text-stone-800 hover:border-stone-300"}`}>
              <div className="flex items-start justify-between gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${selectedId === item.id ? "bg-white/10" : "bg-emerald-50 text-emerald-700"}`}><Smartphone className="h-5 w-5" /></span><ConnectionPill status={item.status} dark={selectedId === item.id} /></div>
              <p className="mt-3 font-black">{item.name}</p><p className={`mt-0.5 text-xs ${selectedId === item.id ? "text-white/50" : "text-stone-500"}`}>{item.phoneNumber ? `+${item.phoneNumber}` : "Número será identificado após conectar"}</p>
              {item.purpose && <p className={`mt-2 line-clamp-2 text-xs leading-5 ${selectedId === item.id ? "text-white/65" : "text-stone-500"}`}>{item.purpose}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">{item.isPrimarySupport && <span className={`rounded-full px-2 py-1 text-[9px] font-black ${selectedId === item.id ? "bg-amber-400/15 text-amber-200" : "bg-amber-50 text-amber-700"}`}>OFICIAL</span>}{item.conciergeEnabled && <span className={`rounded-full px-2 py-1 text-[9px] font-black ${selectedId === item.id ? "bg-violet-400/15 text-violet-200" : "bg-violet-50 text-violet-700"}`}>IA ATIVA</span>}</div>
              <div className={`mt-3 flex gap-3 text-[10px] font-bold ${selectedId === item.id ? "text-white/40" : "text-stone-400"}`}><span>{item.keyCount || 0} chaves</span><span>{item.messageCount || 0} mensagens</span></div>
            </button>
          ))}
        </aside>

        {selected && (
          <main className="min-w-0 space-y-5">
            <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><MessageCircle className="h-5 w-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black text-stone-950">{selected.name}</h2><ConnectionPill status={selected.status} /></div><p className="mt-1 text-sm text-stone-500">{selected.purpose || "Sem finalidade descrita"}</p></div></div>
                <div className="flex flex-wrap gap-2">
                  {selected.connected ? <button disabled={busy === "disconnect"} onClick={() => void run("disconnect", () => api.post(`/admin/whatsapp/instances/${selected.id}/disconnect`, { logout: false }), "Sessão parada sem desvincular o aparelho.")} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-700"><Power className="h-4 w-4" /> Parar</button> : <button disabled={busy === "connect"} onClick={() => void run("connect", () => api.post(`/admin/whatsapp/instances/${selected.id}/connect`))} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white">{busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />} Conectar</button>}
                  <button onClick={() => void load(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 text-stone-500"><RefreshCw className="h-4 w-4" /></button>
                </div>
              </div>

              {(selected.status === "QR_REQUIRED" || selected.qrCode) && <div className="mt-5 grid gap-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 md:grid-cols-[220px_1fr] md:items-center"><div className="rounded-2xl bg-white p-3 shadow-sm">{selected.qrCode ? <img src={selected.qrCode} alt="QR Code do WhatsApp" className="aspect-square w-full object-contain" /> : <div className="flex aspect-square items-center justify-center"><QrCode className="h-16 w-16 text-stone-300" /></div>}</div><div><p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Pareamento</p><h3 className="mt-1 text-lg font-black text-stone-900">Leia o QR Code no WhatsApp</h3><p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">No telefone: Aparelhos conectados → Conectar aparelho. O QR é mantido somente em memória e some da interface assim que a sessão autentica.</p><p className="mt-3 text-xs font-bold text-stone-500">{selected.runtimeDetail || "Aguardando QR..."}</p></div></div>}
              {selected.lastError && <div className="mt-4 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{selected.lastError}</span></div>}
              <div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric icon={<Wifi className="h-4 w-4" />} label="Sessão" value={selected.connected ? "Online" : "Offline"} /><Metric icon={<KeyRound className="h-4 w-4" />} label="Chaves ativas" value={String(selected.keyCount || 0)} /><Metric icon={<MessageCircle className="h-4 w-4" />} label="Mensagens registradas" value={String(selected.messageCount || 0)} /></div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                <RuntimeToggle icon={<Star className="h-4 w-4" />} title="Número oficial do PiraNegócios" description="Usado para OTP de telefone e como referência do atendimento oficial. Apenas uma conexão pode ser oficial por vez." checked={Boolean(selected.isPrimarySupport)} disabled={busy === "primary"} tone="amber" onChange={(enabled) => void run("primary", () => api.put(`/admin/whatsapp/instances/${selected.id}`, { isPrimarySupport: enabled }), enabled ? "Número definido como atendimento oficial." : "Número deixou de ser o atendimento oficial.")} />
                <RuntimeToggle icon={<Bot className="h-4 w-4" />} title="Concierge automático por IA" description="Quando ligado, somente mensagens diretas de pessoas entram no buffer de 15s e podem receber atendimento integrado ao site. Grupos, canais, status e notificações ficam fora." checked={Boolean(selected.conciergeEnabled)} disabled={busy === "concierge"} tone="violet" onChange={(enabled) => void run("concierge", () => api.put(`/admin/whatsapp/instances/${selected.id}`, { conciergeEnabled: enabled }), enabled ? "Atendimento automático ativado." : "Atendimento automático pausado.")} />
              </div>
            </section>

            <WhatsAppGroupAutomationPanel instanceId={selected.id} connected={selected.connected} />

            <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="font-black text-stone-950">Matriz de capacidades</h2><p className="mt-1 max-w-3xl text-sm text-stone-500">Cada chave só consegue receber funções habilitadas aqui. O checkbox “Tudo” liga ou desliga a categoria inteira de uma vez.</p></div></div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="relative min-w-[260px] flex-1 xl:w-[360px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input value={capabilitySearch} onChange={(e) => setCapabilitySearch(e.target.value)} placeholder="Buscar função, método, scope..." className="w-full rounded-xl border border-stone-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet-300" /></label>
                  <label className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2.5 text-xs font-bold text-stone-600"><input type="checkbox" checked={showLegacy} onChange={(e) => setShowLegacy(e.target.checked)} className="accent-violet-700" /> Compatibilidade antiga</label>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wide"><RiskBadge risk="read" /><RiskBadge risk="write" /><RiskBadge risk="destructive" /><span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-500">{capabilities.filter((c) => !c.legacy).length} funções operacionais catalogadas</span></div>

              <div className="mt-5 space-y-3">
                {capabilityGroups.map(([category, items]) => {
                  const isOpen = capabilitySearch.trim() ? true : expandedCategories[category] ?? category.startsWith("Grupos");
                  const enabledCount = items.filter((item) => selected.allowedScopes.includes(item.scope)).length;
                  const allEnabled = items.length > 0 && enabledCount === items.length;
                  const groupBusy = busy === `scope-group:${category}`;
                  return <div key={category} className="overflow-hidden rounded-2xl border border-stone-200">
                    <div className="flex items-center gap-3 bg-stone-50/80 px-4 py-3">
                      <button type="button" onClick={() => setExpandedCategories((current) => ({ ...current, [category]: !isOpen }))} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                        <div><p className="text-sm font-black text-stone-900">{category}</p><p className="mt-0.5 text-[10px] font-bold text-stone-400">{enabledCount}/{items.length} habilitadas</p></div>
                        {isOpen ? <ChevronDown className="h-4 w-4 text-stone-400" /> : <ChevronRight className="h-4 w-4 text-stone-400" />}
                      </button>
                      <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase text-stone-600">
                        <input type="checkbox" checked={allEnabled} disabled={groupBusy} onChange={(e) => void updateAllowedGroup(category, items, e.target.checked)} className="accent-violet-700" />
                        {groupBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Tudo"}
                      </label>
                    </div>
                    {isOpen && <div className="grid gap-2 border-t border-stone-200 p-3 lg:grid-cols-2">{items.map((capability) => <CapabilityToggle key={capability.scope} capability={capability} checked={selected.allowedScopes.includes(capability.scope)} disabled={busy === `scope:${capability.scope}` || groupBusy} onChange={(enabled) => void updateAllowedScope(capability.scope, enabled)} />)}</div>}
                  </div>;
                })}
                {capabilityGroups.length === 0 && <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-400">Nenhuma função corresponde à busca.</div>}
              </div>
            </section>

            <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-stone-400">MCP + API</p><h2 className="mt-1 text-lg font-black text-stone-950">Credenciais desta instância</h2><p className="mt-1 text-sm text-stone-500">Você pode criar ou editar uma chave e marcar categorias inteiras. Scopes novos não entram automaticamente em chaves antigas.</p></div><KeyRound className="h-5 w-5 text-stone-300" /></div>
              <div className="mt-4 grid gap-3 rounded-2xl bg-stone-950 p-4 text-white md:grid-cols-2"><Endpoint label="MCP Streamable HTTP" value={mcpUrl} copy={() => void copy(mcpUrl)} /><Endpoint label="REST v1" value={restUrl} copy={() => void copy(restUrl)} /></div>
              {revealedKey && <div className="mt-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4"><div className="flex items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-800">Copie agora · não será exibida novamente</p><button onClick={() => void copy(revealedKey)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-2.5 py-1.5 text-xs font-black text-white"><Copy className="h-3.5 w-3.5" /> Copiar</button></div><code className="mt-3 block break-all rounded-xl bg-white p-3 text-xs text-stone-800">{revealedKey}</code></div>}

              <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-stone-200 p-4">
                  <h3 className="text-sm font-black text-stone-900">Gerar nova chave</h3>
                  <input value={keyName} onChange={(e) => setKeyName(e.target.value)} className="mt-3 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" placeholder="Nome da integração" />
                  <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                    {capabilityGroups.map(([category, items]) => {
                      const available = items.filter((item) => selected.allowedScopes.includes(item.scope));
                      if (!available.length) return null;
                      const groupScopes = available.map((item) => item.scope);
                      const allChecked = groupScopes.every((scope) => keyScopes.includes(scope));
                      return <div key={category} className="rounded-xl border border-stone-100 p-3">
                        <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-wide text-stone-400">{category}</p><label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-black uppercase text-stone-500"><input type="checkbox" checked={allChecked} onChange={(e) => setKeyScopes((current) => toggleMany(current, groupScopes, e.target.checked))} className="accent-stone-900" /> Tudo</label></div>
                        <div className="mt-2 space-y-1">{available.map((capability) => <label key={capability.scope} className="flex cursor-pointer items-start gap-2 rounded-lg p-1.5 hover:bg-stone-50"><input type="checkbox" checked={keyScopes.includes(capability.scope)} onChange={(e) => setKeyScopes((current) => toggleMany(current, [capability.scope], e.target.checked))} className="mt-0.5 accent-stone-900" /><span><span className="block text-xs font-bold text-stone-700">{capability.label}</span><span className="block text-[10px] text-stone-400">{capability.scope}</span></span></label>)}</div>
                      </div>;
                    })}
                  </div>
                  <button disabled={!keyName.trim() || keyScopes.length === 0 || busy === "key:create"} onClick={() => void createKey()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-950 px-3 py-2.5 text-sm font-black text-white disabled:opacity-40">{busy === "key:create" && <Loader2 className="h-4 w-4 animate-spin" />} Gerar chave com {keyScopes.length} permissões</button>
                </div>

                <div className="space-y-2">
                  {keys.length === 0 ? <div className="flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-stone-300 text-sm text-stone-400">Nenhuma chave criada para este número.</div> : keys.map((key) => {
                    const editing = editingKeyId === key.id;
                    return <div key={key.id} className={`rounded-2xl border p-4 ${editing ? "border-violet-200 bg-violet-50/30" : "border-stone-200"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {editing ? <input value={editingKeyName} onChange={(e) => setEditingKeyName(e.target.value)} className="w-full rounded-lg border border-violet-200 bg-white px-2.5 py-2 text-sm font-bold text-stone-800" /> : <div className="flex items-center gap-2"><p className="text-sm font-black text-stone-900">{key.name}</p><span className={`h-2 w-2 rounded-full ${key.active ? "bg-emerald-500" : "bg-stone-300"}`} /></div>}
                          <code className="mt-1 block text-[11px] text-stone-400">{key.keyPrefix}••••••••</code>
                        </div>
                        {!editing && <div className="flex flex-wrap justify-end gap-1">
                          <button title="Editar nome e permissões" onClick={() => beginEditKey(key)} className="rounded-lg border border-violet-200 px-2.5 py-1.5 text-[10px] font-black text-violet-700">Editar</button>
                          <button title="Rotacionar chave" onClick={() => void rotateKey(key)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500"><RotateCw className={`h-3.5 w-3.5 ${busy === `rotate:${key.id}` ? "animate-spin" : ""}`} /></button>
                          <button title={key.active ? "Desativar chave" : "Ativar chave"} onClick={() => void run(`key:${key.id}`, () => api.put(`/admin/whatsapp/keys/${key.id}`, { active: !key.active }))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500">{key.active ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}</button>
                          <button title="Excluir chave" disabled={busy === `delete-key:${key.id}`} onClick={() => void deleteKey(key)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50 disabled:opacity-50">{busy === `delete-key:${key.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</button>
                        </div>}
                      </div>

                      {editing ? <div className="mt-4 space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-wide text-violet-700">Permissões da chave</p>
                        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">{capabilityGroups.map(([category, items]) => {
                          const available = items.filter((item) => selected.allowedScopes.includes(item.scope));
                          if (!available.length) return null;
                          const groupScopes = available.map((item) => item.scope);
                          const allChecked = groupScopes.every((scope) => editingKeyScopes.includes(scope));
                          return <div key={category} className="rounded-xl border border-violet-100 bg-white p-3">
                            <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-wide text-stone-500">{category}</p><label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-black uppercase text-violet-700"><input type="checkbox" checked={allChecked} onChange={(e) => setEditingKeyScopes((current) => toggleMany(current, groupScopes, e.target.checked))} className="accent-violet-700" /> Tudo</label></div>
                            <div className="mt-2 grid gap-1 sm:grid-cols-2">{available.map((capability) => <label key={capability.scope} className="flex cursor-pointer items-start gap-2 rounded-lg p-1.5 hover:bg-violet-50"><input type="checkbox" checked={editingKeyScopes.includes(capability.scope)} onChange={(e) => setEditingKeyScopes((current) => toggleMany(current, [capability.scope], e.target.checked))} className="mt-0.5 accent-violet-700" /><span className="text-xs font-bold text-stone-700">{capability.label}</span></label>)}</div>
                          </div>;
                        })}</div>
                        <div className="flex gap-2 pt-2"><button disabled={!editingKeyName.trim() || !editingKeyScopes.length || busy === `edit-key:${key.id}`} onClick={() => void saveEditedKey()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40">{busy === `edit-key:${key.id}` && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar {editingKeyScopes.length} permissões</button><button onClick={() => setEditingKeyId(null)} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-600">Cancelar</button></div>
                      </div> : <>
                        <div className="mt-3 flex flex-wrap gap-1">{key.scopes.slice(0, 18).map((scope) => <span key={scope} className="rounded-full bg-stone-100 px-2 py-1 text-[9px] font-bold text-stone-500">{scope}</span>)}{key.scopes.length > 18 && <span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-bold text-violet-600">+{key.scopes.length - 18}</span>}</div>
                        <p className="mt-3 text-[10px] text-stone-400">Último uso: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString("pt-BR") : "ainda não utilizada"}</p>
                      </>}
                    </div>;
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><Send className="h-5 w-5 text-stone-400" /><div><h2 className="font-black text-stone-950">Teste rápido de envio</h2><p className="text-sm text-stone-500">Esse teste é administrativo e não representa as permissões concedidas ao MCP.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-[260px_1fr_auto]"><input value={testTarget} onChange={(e) => setTestTarget(e.target.value)} placeholder="5519999999999 ou id@g.us" className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm" /><input value={testText} onChange={(e) => setTestText(e.target.value)} placeholder="Mensagem de teste" className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm" /><button disabled={!selected.connected || !testTarget.trim() || !testText.trim() || busy === "test"} onClick={() => void run("test", () => api.post(`/admin/whatsapp/instances/${selected.id}/test-message`, { target: testTarget, text: testText }), "Mensagem enviada.")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"><Send className="h-4 w-4" /> Enviar</button></div></section>

            <section className="flex flex-col gap-3 rounded-3xl border border-red-100 bg-red-50/60 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-red-900">Zona de manutenção</p><p className="mt-1 text-xs leading-5 text-red-700">Desvincular encerra a sessão no WhatsApp. Excluir remove a instância, chaves, histórico e contatos salvos do sistema.</p></div><div className="flex gap-2"><button onClick={() => void run("logout", () => api.post(`/admin/whatsapp/instances/${selected.id}/disconnect`, { logout: true }), "Aparelho desvinculado.")} className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-700">Desvincular aparelho</button><button onClick={() => { if (window.confirm(`Excluir definitivamente “${selected.name}”?`)) void run("delete", () => api.delete(`/admin/whatsapp/instances/${selected.id}`), "Instância excluída.").then(() => setSelectedId(null)); }} className="inline-flex items-center gap-1.5 rounded-xl bg-red-700 px-3 py-2 text-xs font-black text-white"><Trash2 className="h-3.5 w-3.5" /> Excluir</button></div></section>
          </main>
        )}
      </div>
    </div>
  );
}

function RuntimeToggle({ icon, title, description, checked, disabled, onChange, tone }: { icon: React.ReactNode; title: string; description: string; checked: boolean; disabled?: boolean; onChange: (enabled: boolean) => void; tone: "amber" | "violet" }) {
  const activeClass = tone === "amber" ? "border-amber-200 bg-amber-50/60" : "border-violet-200 bg-violet-50/60";
  const iconClass = tone === "amber" ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700";
  return <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${checked ? activeClass : "border-stone-200 bg-stone-50/50"}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-stone-900" /><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>{disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}</span><span><span className="text-sm font-black text-stone-900">{title}</span><span className="mt-1 block text-xs leading-5 text-stone-500">{description}</span></span></label>;
}

function CapabilityToggle({ capability, checked, disabled, onChange }: { capability: Capability; checked: boolean; disabled?: boolean; onChange: (enabled: boolean) => void }) {
  return <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${checked ? "border-violet-200 bg-violet-50/60" : "border-stone-100 bg-white hover:border-stone-200"}`}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-violet-700" />
    <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5"><span className="text-sm font-black text-stone-800">{capability.label}</span><RiskBadge risk={capability.risk} />{capability.experimental && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[8px] font-black uppercase text-amber-700">experimental</span>}</span><span className="mt-1 block text-xs leading-5 text-stone-500">{capability.description}</span>{capability.signature && <code className="mt-2 block break-all rounded-lg bg-stone-950 px-2 py-1.5 text-[10px] text-white/70">{capability.signature}</code>}<span className="mt-1.5 block break-all text-[9px] font-bold text-stone-300">{capability.scope}</span></span>
  </label>;
}

function RiskBadge({ risk }: { risk: Capability["risk"] }) {
  const config = risk === "read" ? ["Só leitura", "bg-sky-50 text-sky-700"] : risk === "write" ? ["Altera", "bg-amber-50 text-amber-700"] : ["Sensível", "bg-red-50 text-red-700"];
  return <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wide ${config[1]}`}>{config[0]}</span>;
}

function ConnectionPill({ status, dark = false }: { status: Instance["status"]; dark?: boolean }) {
  const connected = status === "CONNECTED";
  const label = status === "CONNECTED" ? "Conectado" : status === "QR_REQUIRED" ? "QR pendente" : status === "CONNECTING" ? "Conectando" : status === "ERROR" ? "Erro" : "Desconectado";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${dark ? "bg-white/10 text-white/70" : connected ? "bg-emerald-100 text-emerald-700" : status === "ERROR" ? "bg-red-100 text-red-700" : status === "QR_REQUIRED" ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-500"}`}>{connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}{label}</span>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-3"><div className="flex items-center gap-2 text-stone-400">{icon}<span className="text-[10px] font-black uppercase tracking-wide">{label}</span></div><p className="mt-2 text-base font-black text-stone-900">{value}</p></div>;
}

function Endpoint({ label, value, copy }: { label: string; value: string; copy: () => void }) {
  return <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/35">{label}</p><div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 truncate text-[11px] text-white/75">{value}</code><button onClick={copy} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/60"><Copy className="h-3.5 w-3.5" /></button></div></div>;
}
