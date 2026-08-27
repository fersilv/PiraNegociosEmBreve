import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  SlidersHorizontal,
  Wifi,
  WifiOff,
} from "lucide-react";
import { JobsMcpDocumentation } from "../components/JobsMcpDocumentation";
import { api } from "../lib/api";

type Kind = "v1" | "v2" | "mcp";
type Risk = "read" | "write" | "destructive";
type Capability = {
  scope: string;
  category: string;
  label: string;
  description: string;
  risk: Risk;
  legacy?: boolean;
  defaultMcp?: boolean;
};
type IntegrationKey = {
  id: string;
  name: string;
  sourceLabel: string;
  keyPrefix: string;
  scopes: string[];
  apiVersion: "v1" | "v2";
  audience: "api" | "mcp";
  active: boolean;
  lastUsedAt?: string | null;
  createdAt: string;
};

const JOB_AUDIT_SCOPES = [
  "jobs:list",
  "jobs:detail",
  "jobs:stats:read",
  "jobs:review:read",
  "jobs:update",
  "jobs:verify",
  "jobs:review:write",
  "jobs:activate",
  "jobs:deactivate",
  "jobs:flag",
  "jobs:unflag",
] as const;

const TAB_META: Record<Kind, { title: string; subtitle: string; endpoint: string }> = {
  v1: {
    title: "API V1",
    subtitle: "Compatibilidade com integrações existentes. Permissões amplas de leitura e escrita.",
    endpoint: "/api/v1/jobs",
  },
  v2: {
    title: "API V2",
    subtitle: "REST granular para automações administrativas e operações específicas de vagas.",
    endpoint: "/api/v2/jobs",
  },
  mcp: {
    title: "MCP",
    subtitle: "Ferramentas de IA com autorização função por função e defaults seguros.",
    endpoint: "/api/jobs/mcp",
  },
};

export function AdminJobIntegrationsPage() {
  const [kind, setKind] = useState<Kind>("v1");
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [defaults, setDefaults] = useState<Record<Kind, string[]>>({ v1: [], v2: [], mcp: [] });
  const [keys, setKeys] = useState<IntegrationKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingSource, setEditingSource] = useState("");
  const [editingScopes, setEditingScopes] = useState<string[]>([]);

  const nonLegacyCapabilities = useMemo(
    () => capabilities.filter((item) => !item.legacy),
    [capabilities],
  );
  const groups = useMemo(() => groupCapabilities(nonLegacyCapabilities), [nonLegacyCapabilities]);

  const loadCapabilities = async () => {
    const response = await api.get("/admin/job-integrations/capabilities");
    setCapabilities(Array.isArray(response.data?.capabilities) ? response.data.capabilities : []);
    setDefaults({
      v1: response.data?.defaults?.v1 || [],
      v2: response.data?.defaults?.v2 || [],
      mcp: response.data?.defaults?.mcp || [],
    });
    return response.data?.defaults || {};
  };

  const loadKeys = async (target: Kind = kind) => {
    const response = await api.get(`/admin/job-integrations/clients?kind=${target}`);
    setKeys(Array.isArray(response.data) ? response.data : []);
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const loadedDefaults = await loadCapabilities();
        setScopes(loadedDefaults?.v1 || []);
        await loadKeys("v1");
      } catch (error: any) {
        setNotice(error?.response?.data?.message || "Não foi possível carregar as integrações de vagas.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    setEditingId(null);
    setRevealedKey(null);
    setScopes(defaults[kind] || []);
    void loadKeys(kind).catch((error: any) => setNotice(error?.response?.data?.message || "Não foi possível carregar as chaves."));
  }, [kind]);

  const run = async (id: string, action: () => Promise<unknown>, success?: string) => {
    setBusy(id);
    setNotice(null);
    try {
      await action();
      if (success) setNotice(success);
      await loadKeys();
    } catch (error: any) {
      setNotice(error?.response?.data?.message || error?.message || "A operação não pôde ser concluída.");
    } finally {
      setBusy(null);
    }
  };

  const createKey = async () => {
    if (!name.trim()) return;
    setBusy("create");
    setNotice(null);
    try {
      const response = await api.post("/admin/job-integrations/clients", {
        kind,
        name: name.trim(),
        sourceLabel: sourceLabel.trim() || name.trim(),
        scopes: kind === "v1" ? undefined : scopes,
      });
      setRevealedKey(response.data?.apiKey || null);
      setNotice("Chave criada. Copie a credencial completa agora.");
      setName("");
      setSourceLabel("");
      setScopes(defaults[kind] || []);
      await loadKeys();
    } catch (error: any) {
      setNotice(error?.response?.data?.message || "Não foi possível criar a chave.");
    } finally {
      setBusy(null);
    }
  };

  const startEdit = (key: IntegrationKey) => {
    setEditingId(key.id);
    setEditingName(key.name);
    setEditingSource(key.sourceLabel);
    setEditingScopes(key.scopes.filter((scope) => !["jobs:read", "jobs:write"].includes(scope)));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await run(
      `edit:${editingId}`,
      () => api.put(`/admin/job-integrations/clients/${editingId}`, {
        name: editingName,
        sourceLabel: editingSource,
        scopes: kind === "v1" ? undefined : editingScopes,
      }),
      "Chave atualizada. Reconecte a integração se o catálogo de permissões mudou.",
    );
    setEditingId(null);
  };

  const toggleGroup = (current: string[], groupScopes: string[], enabled: boolean) =>
    enabled
      ? Array.from(new Set([...current, ...groupScopes]))
      : current.filter((scope) => !groupScopes.includes(scope));

  const meta = TAB_META[kind];

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando integrações...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 admin-standalone-page">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">Infraestrutura · Integrações</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-stone-900">APIs & MCP de Vagas</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">V1 fica isolada para compatibilidade. V2 e MCP usam permissões granulares, inclusive ativar/desativar vaga e a nova fila operacional de revisão.</p>
      </header>

      {notice && <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700 shadow-sm">{notice}</div>}

      <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-stone-200 bg-white p-1 shadow-sm">
        {(["v1", "v2", "mcp"] as Kind[]).map((tab) => (
          <button key={tab} type="button" onClick={() => setKind(tab)} className={`rounded-xl px-3 py-3 text-sm font-black transition ${kind === tab ? "bg-stone-950 text-white shadow-sm" : "text-stone-500 hover:bg-stone-50"}`}>
            {TAB_META[tab].title}
          </button>
        ))}
      </div>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-violet-600" /><h2 className="text-xl font-black text-stone-950">{meta.title}</h2></div>
            <p className="mt-1 text-sm text-stone-500">{meta.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-stone-950 px-3 py-2 text-white"><code className="text-xs text-white/75">{window.location.origin}{meta.endpoint}</code><button onClick={() => void navigator.clipboard.writeText(`${window.location.origin}${meta.endpoint}`)}><Copy className="h-4 w-4" /></button></div>
        </div>
      </section>

      {kind === "mcp" && <JobsMcpDocumentation />}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><KeyRound className="h-5 w-5" /></span><div><h2 className="font-black text-stone-950">Nova chave {meta.title}</h2><p className="mt-1 text-xs leading-5 text-stone-500">{kind === "v1" ? "A V1 mantém jobs:read + jobs:write para não quebrar clientes antigos." : "Escolha exatamente o que esta credencial poderá fazer."}</p></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da integração" className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm" /><input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="Origem / identificação" className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm" /></div>

          {kind === "mcp" && <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/50 p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black text-violet-900">Auditoria de vagas por IA</p><p className="mt-0.5 text-[10px] leading-4 text-violet-700">Libera consulta, correção, verificação, aprovação/publicação, desativação e sinalização. Não inclui exclusão definitiva.</p></div><button type="button" onClick={() => setScopes((current) => Array.from(new Set([...current, ...JOB_AUDIT_SCOPES])))} className="shrink-0 rounded-xl bg-violet-700 px-3 py-2 text-[10px] font-black text-white">Liberar auditoria completa</button></div></div>}
          {kind !== "v1" && <ScopeGroups groups={groups} selected={scopes} setSelected={setScopes} toggleGroup={toggleGroup} />}
          {kind === "v1" && <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900"><div className="flex items-center gap-2 font-black"><ShieldCheck className="h-4 w-4" /> Compatibilidade fixa</div><p className="mt-1 text-xs leading-5 text-sky-800">Esta versão usa os dois scopes históricos. Para autorização fina, crie a chave na aba API V2 ou MCP.</p></div>}

          <button disabled={!name.trim() || busy === "create" || (kind !== "v1" && scopes.length === 0)} onClick={() => void createKey()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40">{busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Criar chave</button>

          {revealedKey && <div className="mt-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">Copie agora · não aparece novamente</p><div className="mt-2 flex gap-2"><code className="min-w-0 flex-1 break-all rounded-xl bg-white p-3 text-xs text-stone-800">{revealedKey}</code><button onClick={() => void navigator.clipboard.writeText(revealedKey)} className="h-10 w-10 rounded-xl bg-emerald-800 text-white"><Copy className="mx-auto h-4 w-4" /></button></div></div>}
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between"><div><h2 className="font-black text-stone-950">Chaves {meta.title}</h2><p className="mt-1 text-xs text-stone-500">{keys.length} credencial(is)</p></div><button onClick={() => void loadKeys()} className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 text-stone-500"><RefreshCw className="h-4 w-4" /></button></div>
          <div className="mt-4 space-y-3">
            {keys.length === 0 && <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-400">Nenhuma chave nesta aba.</div>}
            {keys.map((key) => {
              const editing = editingId === key.id;
              const visibleScopes = key.scopes.filter((scope) => !["jobs:read", "jobs:write"].includes(scope));
              return <div key={key.id} className={`rounded-2xl border p-4 ${editing ? "border-violet-200 bg-violet-50/30" : "border-stone-200"}`}>
                {!editing ? <>
                  <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><p className="text-sm font-black text-stone-900">{key.name}</p><span className={`h-2 w-2 rounded-full ${key.active ? "bg-emerald-500" : "bg-stone-300"}`} /></div><p className="mt-0.5 text-xs text-stone-500">{key.sourceLabel}</p><code className="mt-1 block text-[10px] text-stone-400">{key.keyPrefix}••••••</code></div><button onClick={() => startEdit(key)} className="rounded-lg border border-violet-200 px-2.5 py-1.5 text-[10px] font-black text-violet-700">Editar</button></div>
                  <div className="mt-3 flex flex-wrap gap-1">{(kind === "v1" ? key.scopes : visibleScopes).slice(0, 12).map((scope) => <span key={scope} className="rounded-full bg-stone-100 px-2 py-1 text-[9px] font-bold text-stone-500">{scope}</span>)}{visibleScopes.length > 12 && <span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-bold text-violet-700">+{visibleScopes.length - 12}</span>}</div>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-stone-400"><span>Último uso: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString("pt-BR") : "ainda não usada"}</span><div className="flex gap-1"><button title="Rotacionar" onClick={() => void run(`rotate:${key.id}`, async () => { const response = await api.post(`/admin/job-integrations/clients/${key.id}/rotate`); setRevealedKey(response.data?.apiKey || null); }, "Chave rotacionada. Copie a nova credencial.")} className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200"><RotateCw className={`h-3.5 w-3.5 ${busy === `rotate:${key.id}` ? "animate-spin" : ""}`} /></button><button title={key.active ? "Desativar" : "Ativar"} onClick={() => void run(`active:${key.id}`, () => api.put(`/admin/job-integrations/clients/${key.id}`, { active: !key.active }))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200">{key.active ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}</button></div></div>
                </> : <>
                  <div className="grid gap-2 sm:grid-cols-2"><input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-bold" /><input value={editingSource} onChange={(e) => setEditingSource(e.target.value)} className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm" /></div>
                  {kind === "mcp" && <div className="mt-4 rounded-xl border border-violet-100 bg-white p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-[10px] font-bold leading-4 text-violet-800">Auditoria completa sem permissão de exclusão definitiva.</p><button type="button" onClick={() => setEditingScopes((current) => Array.from(new Set([...current, ...JOB_AUDIT_SCOPES])))} className="shrink-0 rounded-lg bg-violet-700 px-2.5 py-1.5 text-[9px] font-black text-white">Liberar auditoria</button></div></div>}
                  {kind !== "v1" && <ScopeGroups groups={groups} selected={editingScopes} setSelected={setEditingScopes} toggleGroup={toggleGroup} compact />}
                  <div className="mt-4 flex gap-2"><button disabled={busy === `edit:${key.id}` || !editingName.trim() || (kind !== "v1" && editingScopes.length === 0)} onClick={() => void saveEdit()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-700 px-3 py-2.5 text-xs font-black text-white disabled:opacity-40">{busy === `edit:${key.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Salvar</button><button onClick={() => setEditingId(null)} className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs font-black text-stone-600">Cancelar</button></div>
                </>}
              </div>;
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function ScopeGroups({ groups, selected, setSelected, toggleGroup, compact = false }: { groups: Array<[string, Capability[]]>; selected: string[]; setSelected: React.Dispatch<React.SetStateAction<string[]>>; toggleGroup: (current: string[], scopes: string[], enabled: boolean) => string[]; compact?: boolean }) {
  return <div className={`${compact ? "mt-4 max-h-[420px]" : "mt-5 max-h-[560px]"} space-y-2 overflow-y-auto pr-1`}>
    {groups.map(([category, items]) => {
      const groupScopes = items.map((item) => item.scope);
      const all = groupScopes.every((scope) => selected.includes(scope));
      return <div key={category} className="rounded-2xl border border-stone-100 p-3">
        <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-wide text-stone-500">{category}</p><label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-black uppercase text-violet-700"><input type="checkbox" checked={all} onChange={(e) => setSelected((current) => toggleGroup(current, groupScopes, e.target.checked))} className="accent-violet-700" /> Tudo</label></div>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">{items.map((item) => <label key={item.scope} className={`flex cursor-pointer gap-2 rounded-xl border p-2 ${selected.includes(item.scope) ? "border-violet-100 bg-violet-50/60" : "border-transparent hover:bg-stone-50"}`}><input type="checkbox" checked={selected.includes(item.scope)} onChange={(e) => setSelected((current) => toggleGroup(current, [item.scope], e.target.checked))} className="mt-0.5 accent-violet-700" /><span className="min-w-0"><span className="block text-xs font-black text-stone-700">{item.label}</span><span className="mt-0.5 block text-[10px] leading-4 text-stone-400">{item.description}</span><Risk risk={item.risk} /></span></label>)}</div>
      </div>;
    })}
  </div>;
}

function Risk({ risk }: { risk: Risk }) {
  const label = risk === "read" ? "leitura" : risk === "write" ? "alteração" : "destrutiva";
  const cls = risk === "read" ? "bg-sky-50 text-sky-700" : risk === "write" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${cls}`}>{label}</span>;
}

function groupCapabilities(items: Capability[]): Array<[string, Capability[]]> {
  const map = new Map<string, Capability[]>();
  for (const item of items) map.set(item.category, [...(map.get(item.category) || []), item]);
  return Array.from(map.entries());
}
