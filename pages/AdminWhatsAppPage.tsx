import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
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
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { api } from "../lib/api";

type Instance = {
  id: string;
  name: string;
  purpose?: string | null;
  phoneNumber?: string | null;
  provider: string;
  status: "DISCONNECTED" | "CONNECTING" | "QR_REQUIRED" | "CONNECTED" | "ERROR";
  allowedScopes: string[];
  active: boolean;
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

const scopes = [
  ["connection:read", "Conexão", "Consultar saúde e estado da sessão"],
  ["messages:read", "Ler mensagens", "Consultar mensagens recebidas e enviadas"],
  ["messages:send", "Enviar mensagens", "Enviar texto e mídia para conversas individuais"],
  ["contacts:read", "Ler contatos", "Listar contatos visíveis na conta"],
  ["contacts:write", "Salvar contatos", "Salvar contatos no diretório interno do PiraNegócios"],
  ["groups:read", "Ler grupos", "Listar grupos em que o número participa"],
  ["groups:send", "Publicar em grupos", "Enviar mensagens para grupos"],
  ["channels:read", "Ler canais", "Localizar canais/newsletters visíveis"],
  ["channels:publish", "Publicar em canais", "Experimental: publicar em canal administrado"],
  ["status:publish", "Publicar status", "Publicar story/status de texto, imagem ou vídeo"],
] as const;

const defaultScopes = ["connection:read", "messages:read", "messages:send", "contacts:read", "groups:read"];

export function AdminWhatsAppPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
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
  const [testTarget, setTestTarget] = useState("");
  const [testText, setTestText] = useState("");

  const selected = useMemo(
    () => instances.find((item) => item.id === selectedId) || null,
    [instances, selectedId],
  );

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await api.get("/admin/whatsapp/instances");
      const data = Array.isArray(response.data) ? response.data : [];
      setInstances(data);
      setSelectedId((current) => current && data.some((item: Instance) => item.id === current) ? current : data[0]?.id || null);
    } catch (error: any) {
      if (!quiet) setNotice(error?.response?.data?.message || "Não foi possível carregar os números do WhatsApp.");
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
  useEffect(() => { if (selectedId) void loadKeys(selectedId); else setKeys([]); }, [selectedId]);
  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setInterval(() => void load(true), 2500);
    return () => window.clearInterval(timer);
  }, [selectedId]);

  useEffect(() => {
    if (!selected) return;
    setKeyScopes((current) => current.filter((scope) => selected.allowedScopes.includes(scope)));
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
    const next = enabled
      ? Array.from(new Set([...selected.allowedScopes, scope]))
      : selected.allowedScopes.filter((item) => item !== scope);
    await run(`scope:${scope}`, () => api.put(`/admin/whatsapp/instances/${selected.id}`, { allowedScopes: next }));
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
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">Conecte vários números, defina a função de cada um e entregue somente as permissões que cada integração realmente precisa.</p>
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
            </section>

            <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="font-black text-stone-950">Funções liberadas para este número</h2><p className="mt-1 text-sm text-stone-500">É o teto de segurança. Nenhuma chave consegue receber uma permissão que esteja desligada aqui.</p></div></div>
              <div className="mt-5 grid gap-2 lg:grid-cols-2">{scopes.map(([scope, label, description]) => { const enabled = selected.allowedScopes.includes(scope); return <label key={scope} className={`flex cursor-pointer gap-3 rounded-2xl border p-3.5 ${enabled ? "border-violet-200 bg-violet-50/60" : "border-stone-200 bg-stone-50/50"}`}><input type="checkbox" checked={enabled} disabled={busy === `scope:${scope}`} onChange={(e) => void updateAllowedScope(scope, e.target.checked)} className="mt-1 h-4 w-4 accent-violet-700" /><span><span className="flex items-center gap-2 text-sm font-black text-stone-800">{label}{scope === "channels:publish" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] uppercase text-amber-700">experimental</span>}</span><span className="mt-0.5 block text-xs leading-5 text-stone-500">{description}</span></span></label>; })}</div>
            </section>

            <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-stone-400">MCP + API</p><h2 className="mt-1 text-lg font-black text-stone-950">Credenciais desta instância</h2><p className="mt-1 text-sm text-stone-500">Cada chave é exclusiva deste número e enxerga somente os tools selecionados.</p></div><KeyRound className="h-5 w-5 text-stone-300" /></div>
              <div className="mt-4 grid gap-3 rounded-2xl bg-stone-950 p-4 text-white md:grid-cols-2"><Endpoint label="MCP Streamable HTTP" value={mcpUrl} copy={() => void copy(mcpUrl)} /><Endpoint label="REST v1" value={restUrl} copy={() => void copy(restUrl)} /></div>
              {revealedKey && <div className="mt-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4"><div className="flex items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-800">Copie agora · não será exibida novamente</p><button onClick={() => void copy(revealedKey)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-2.5 py-1.5 text-xs font-black text-white"><Copy className="h-3.5 w-3.5" /> Copiar</button></div><code className="mt-3 block break-all rounded-xl bg-white p-3 text-xs text-stone-800">{revealedKey}</code></div>}
              <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-2xl border border-stone-200 p-4"><h3 className="text-sm font-black text-stone-900">Gerar nova chave</h3><input value={keyName} onChange={(e) => setKeyName(e.target.value)} className="mt-3 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" placeholder="Nome da integração" /><div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto pr-1">{scopes.filter(([scope]) => selected.allowedScopes.includes(scope)).map(([scope, label]) => <label key={scope} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-50"><input type="checkbox" checked={keyScopes.includes(scope)} onChange={(e) => setKeyScopes((current) => e.target.checked ? Array.from(new Set([...current, scope])) : current.filter((item) => item !== scope))} className="accent-stone-900" /> {label}</label>)}</div><button disabled={!keyName.trim() || keyScopes.length === 0 || busy === "key:create"} onClick={() => void createKey()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-950 px-3 py-2.5 text-sm font-black text-white disabled:opacity-40">{busy === "key:create" && <Loader2 className="h-4 w-4 animate-spin" />} Gerar chave</button></div>
                <div className="space-y-2">{keys.length === 0 ? <div className="flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-stone-300 text-sm text-stone-400">Nenhuma chave criada para este número.</div> : keys.map((key) => <div key={key.id} className="rounded-2xl border border-stone-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><p className="text-sm font-black text-stone-900">{key.name}</p><span className={`h-2 w-2 rounded-full ${key.active ? "bg-emerald-500" : "bg-stone-300"}`} /></div><code className="mt-1 block text-[11px] text-stone-400">{key.keyPrefix}••••••••</code></div><div className="flex gap-1"><button title="Rotacionar chave" onClick={() => void rotateKey(key)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500"><RotateCw className={`h-3.5 w-3.5 ${busy === `rotate:${key.id}` ? "animate-spin" : ""}`} /></button><button title={key.active ? "Desativar chave" : "Ativar chave"} onClick={() => void run(`key:${key.id}`, () => api.put(`/admin/whatsapp/keys/${key.id}`, { active: !key.active }))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500">{key.active ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}</button></div></div><div className="mt-3 flex flex-wrap gap-1">{key.scopes.map((scope) => <span key={scope} className="rounded-full bg-stone-100 px-2 py-1 text-[9px] font-bold text-stone-500">{scope}</span>)}</div><p className="mt-3 text-[10px] text-stone-400">Último uso: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString("pt-BR") : "ainda não utilizada"}</p></div>)}</div>
              </div>
            </section>

            <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><Send className="h-5 w-5 text-stone-400" /><div><h2 className="font-black text-stone-950">Teste rápido de envio</h2><p className="text-sm text-stone-500">Valide a sessão antes de entregar a chave para outra automação.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-[260px_1fr_auto]"><input value={testTarget} onChange={(e) => setTestTarget(e.target.value)} placeholder="5519999999999 ou id@g.us" className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm" /><input value={testText} onChange={(e) => setTestText(e.target.value)} placeholder="Mensagem de teste" className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm" /><button disabled={!selected.connected || !testTarget.trim() || !testText.trim() || busy === "test"} onClick={() => void run("test", () => api.post(`/admin/whatsapp/instances/${selected.id}/test-message`, { target: testTarget, text: testText }), "Mensagem enviada.")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"><Send className="h-4 w-4" /> Enviar</button></div></section>
            <section className="flex flex-col gap-3 rounded-3xl border border-red-100 bg-red-50/60 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-red-900">Zona de manutenção</p><p className="mt-1 text-xs leading-5 text-red-700">Desvincular encerra a sessão no WhatsApp. Excluir remove a instância, chaves, histórico e contatos salvos do sistema.</p></div><div className="flex gap-2"><button onClick={() => void run("logout", () => api.post(`/admin/whatsapp/instances/${selected.id}/disconnect`, { logout: true }), "Aparelho desvinculado.")} className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-700">Desvincular aparelho</button><button onClick={() => { if (window.confirm(`Excluir definitivamente “${selected.name}”?`)) void run("delete", () => api.delete(`/admin/whatsapp/instances/${selected.id}`), "Instância excluída.").then(() => setSelectedId(null)); }} className="inline-flex items-center gap-1.5 rounded-xl bg-red-700 px-3 py-2 text-xs font-black text-white"><Trash2 className="h-3.5 w-3.5" /> Excluir</button></div></section>
          </main>
        )}
      </div>
    </div>
  );
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
