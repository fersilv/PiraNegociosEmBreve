import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCw,
  Search,
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
  section: string;
  category: string;
  label: string;
  description: string;
  risk: Risk;
  channels: Kind[];
  toolName?: string;
  endpoint?: string;
  legacy?: boolean;
  defaultV2?: boolean;
  defaultMcp?: boolean;
};
type IntegrationKey = {
  id: string;
  name: string;
  sourceLabel: string;
  keyPrefix: string;
  scopes: string[];
  effectiveScopes?: string[];
  usesLegacyScopes?: boolean;
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

const CLASSIFIEDS_AUTOMATION_SCOPES = [
  "automation:status:read",
  "automation:classifieds:listings:queue:read",
  "automation:classifieds:listings:context:read",
  "automation:classifieds:listings:moderation:write",
  "automation:classifieds:reviews:queue:read",
  "automation:classifieds:reviews:moderation:write",
] as const;

const FEEDBACK_AUTOMATION_SCOPES = [
  "automation:feedback:queue:read",
  "automation:feedback:insights:write",
  "automation:feedback:faq-source:read",
  "automation:feedback:faqs:write",
] as const;

const TAB_META: Record<Kind, { title: string; subtitle: string; endpoint: string }> = {
  v1: {
    title: "API V1",
    subtitle: "Compatibilidade com integrações antigas. A V1 mantém permissões amplas e não recebe as funções gerenciais novas.",
    endpoint: "/api/v1/jobs",
  },
  v2: {
    title: "API V2",
    subtitle: "REST de vagas com autorização granular por operação. Só aparecem aqui permissões que possuem rota na V2.",
    endpoint: "/api/v2/jobs",
  },
  mcp: {
    title: "MCP",
    subtitle: "Catálogo gerencial completo com uma permissão por ferramenta. Você decide exatamente o que cada agente pode consultar ou alterar.",
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

  const availableCapabilities = useMemo(
    () => capabilities.filter((item) => !item.legacy && item.channels?.includes(kind)),
    [capabilities, kind],
  );
  const capabilityByScope = useMemo(
    () => new Map(capabilities.map((item) => [item.scope, item])),
    [capabilities],
  );

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
        setNotice(error?.response?.data?.message || "Não foi possível carregar as integrações.");
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
    void loadKeys(kind).catch((error: any) =>
      setNotice(error?.response?.data?.message || "Não foi possível carregar as chaves."),
    );
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
    const effective = key.effectiveScopes || key.scopes || [];
    const allowed = new Set(availableCapabilities.map((item) => item.scope));
    setEditingId(key.id);
    setEditingName(key.name);
    setEditingSource(key.sourceLabel);
    setEditingScopes(effective.filter((scope) => allowed.has(scope)));
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
      "Chave atualizada. As permissões passam a valer também para os próximos tokens OAuth.",
    );
    setEditingId(null);
  };

  const toggleScopes = (current: string[], targetScopes: readonly string[], enabled = true) => {
    const valid = new Set(availableCapabilities.map((item) => item.scope));
    const safeTargets = targetScopes.filter((scope) => valid.has(scope));
    return enabled
      ? Array.from(new Set([...current, ...safeTargets]))
      : current.filter((scope) => !safeTargets.includes(scope));
  };

  const applyPreset = (preset: readonly string[]) =>
    setScopes((current) => toggleScopes(current, preset, true));

  const meta = TAB_META[kind];

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-stone-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando integrações...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 admin-standalone-page">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">
          Infraestrutura · Integrações
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-stone-900">APIs & MCP</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-500">
          Controle as credenciais externas e o limite de atuação de cada integração. No MCP,
          cada ferramenta gerencial pode ser liberada ou bloqueada individualmente.
        </p>
      </header>

      {notice && (
        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700 shadow-sm">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-stone-200 bg-white p-1 shadow-sm">
        {(["v1", "v2", "mcp"] as Kind[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setKind(tab)}
            className={`rounded-xl px-3 py-3 text-sm font-black transition ${
              kind === tab ? "bg-stone-950 text-white shadow-sm" : "text-stone-500 hover:bg-stone-50"
            }`}
          >
            {TAB_META[tab].title}
          </button>
        ))}
      </div>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-violet-600" />
              <h2 className="text-xl font-black text-stone-950">{meta.title}</h2>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-500">{meta.subtitle}</p>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-stone-950 px-3 py-2 text-white">
            <code className="min-w-0 overflow-x-auto text-xs text-white/75">
              {window.location.origin}{meta.endpoint}
            </code>
            <button
              type="button"
              title="Copiar endpoint"
              onClick={() => void navigator.clipboard.writeText(`${window.location.origin}${meta.endpoint}`)}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {kind === "mcp" && <JobsMcpDocumentation capabilities={capabilities} />}

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-black text-stone-950">Nova chave {meta.title}</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-stone-500">
                {kind === "v1"
                  ? "A V1 mantém jobs:read + jobs:write para não quebrar clientes antigos."
                  : `Esta credencial terá ${scopes.length} de ${availableCapabilities.length} permissões disponíveis neste canal.`}
              </p>
            </div>
          </div>
          {kind !== "v1" && (
            <PermissionSummary selected={scopes} capabilities={availableCapabilities} />
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-wide text-stone-500">Nome da chave</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Agente de auditoria"
              className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-wide text-stone-500">Origem / identificação</span>
            <input
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              placeholder="Ex.: ChatGPT · Auditoria horária"
              className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
            />
          </label>
        </div>

        {kind === "mcp" && (
          <div className="mt-5 grid gap-2 md:grid-cols-3">
            <PresetCard
              title="Auditoria de vagas"
              description="Consulta, corrige, verifica, aprova, desativa e sinaliza."
              onClick={() => applyPreset(JOB_AUDIT_SCOPES)}
            />
            <PresetCard
              title="Moderação dos Classificados"
              description="Fila, contexto e aplicação de decisões em anúncios e avaliações."
              onClick={() => applyPreset(CLASSIFIEDS_AUTOMATION_SCOPES)}
            />
            <PresetCard
              title="Feedback & FAQ externos"
              description="Lê fontes e recebe insights e rascunhos produzidos fora do backend."
              onClick={() => applyPreset(FEEDBACK_AUTOMATION_SCOPES)}
            />
          </div>
        )}

        {kind !== "v1" ? (
          <ScopeMatrix
            capabilities={availableCapabilities}
            selected={scopes}
            setSelected={setScopes}
            defaults={defaults[kind] || []}
          />
        ) : (
          <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
            <div className="flex items-center gap-2 font-black">
              <ShieldCheck className="h-4 w-4" /> Compatibilidade fixa
            </div>
            <p className="mt-1 text-xs leading-5 text-sky-800">
              Para autorização fina use API V2 ou MCP. A V1 continua isolada com os dois scopes históricos.
            </p>
          </div>
        )}

        <button
          disabled={!name.trim() || busy === "create" || (kind !== "v1" && scopes.length === 0)}
          onClick={() => void createKey()}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
        >
          {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Criar chave com estas permissões
        </button>

        {revealedKey && (
          <div className="mt-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">
              Copie agora · não aparece novamente
            </p>
            <div className="mt-2 flex gap-2">
              <code className="min-w-0 flex-1 break-all rounded-xl bg-white p-3 text-xs text-stone-800">
                {revealedKey}
              </code>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(revealedKey)}
                className="h-10 w-10 rounded-xl bg-emerald-800 text-white"
              >
                <Copy className="mx-auto h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-black text-stone-950">Chaves {meta.title}</h2>
            <p className="mt-1 text-xs text-stone-500">{keys.length} credencial(is) cadastrada(s)</p>
          </div>
          <button
            type="button"
            title="Atualizar lista"
            onClick={() => void loadKeys()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 text-stone-500"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {keys.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-400">
              Nenhuma chave nesta aba.
            </div>
          )}

          {keys.map((key) => {
            const editing = editingId === key.id;
            const effective = key.effectiveScopes || key.scopes || [];
            const visibleScopes = effective.filter((scope) => capabilityByScope.get(scope)?.channels?.includes(kind));
            return (
              <div
                key={key.id}
                className={`rounded-2xl border p-4 ${editing ? "border-violet-200 bg-violet-50/30 xl:col-span-2" : "border-stone-200"}`}
              >
                {!editing ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-black text-stone-900">{key.name}</p>
                          <span className={`h-2 w-2 rounded-full ${key.active ? "bg-emerald-500" : "bg-stone-300"}`} />
                          {key.usesLegacyScopes && kind === "mcp" && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[8px] font-black uppercase text-amber-700">
                              scopes antigos
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-stone-500">{key.sourceLabel}</p>
                        <code className="mt-1 block text-[10px] text-stone-400">{key.keyPrefix}••••••</code>
                      </div>
                      <button
                        type="button"
                        onClick={() => startEdit(key)}
                        className="rounded-lg border border-violet-200 px-2.5 py-1.5 text-[10px] font-black text-violet-700"
                      >
                        Editar permissões
                      </button>
                    </div>

                    {kind !== "v1" && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {visibleScopes.slice(0, 8).map((scope) => {
                          const capability = capabilityByScope.get(scope);
                          return (
                            <span key={scope} className="rounded-full bg-stone-100 px-2 py-1 text-[9px] font-bold text-stone-600">
                              {capability?.label || scope}
                            </span>
                          );
                        })}
                        {visibleScopes.length > 8 && (
                          <span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-bold text-violet-700">
                            +{visibleScopes.length - 8} funções
                          </span>
                        )}
                      </div>
                    )}

                    {key.usesLegacyScopes && kind === "mcp" && (
                      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800">
                        Esta chave ainda usa scopes agrupados antigos. Ao editar e salvar, eles serão migrados para permissões individuais.
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-stone-400">
                      <span>
                        Último uso: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString("pt-BR") : "ainda não usada"}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          title="Rotacionar chave"
                          onClick={() => void run(`rotate:${key.id}`, async () => {
                            const response = await api.post(`/admin/job-integrations/clients/${key.id}/rotate`);
                            setRevealedKey(response.data?.apiKey || null);
                          }, "Chave rotacionada. Copie a nova credencial.")}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200"
                        >
                          <RotateCw className={`h-3.5 w-3.5 ${busy === `rotate:${key.id}` ? "animate-spin" : ""}`} />
                        </button>
                        <button
                          type="button"
                          title={key.active ? "Desativar chave" : "Ativar chave"}
                          onClick={() => void run(
                            `active:${key.id}`,
                            () => api.put(`/admin/job-integrations/clients/${key.id}`, { active: !key.active }),
                          )}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200"
                        >
                          {key.active ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-bold"
                      />
                      <input
                        value={editingSource}
                        onChange={(e) => setEditingSource(e.target.value)}
                        className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    {kind !== "v1" && (
                      <ScopeMatrix
                        capabilities={availableCapabilities}
                        selected={editingScopes}
                        setSelected={setEditingScopes}
                        defaults={defaults[kind] || []}
                        compact
                      />
                    )}

                    <div className="mt-4 flex gap-2">
                      <button
                        disabled={busy === `edit:${key.id}` || !editingName.trim() || (kind !== "v1" && editingScopes.length === 0)}
                        onClick={() => void saveEdit()}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-700 px-3 py-2.5 text-xs font-black text-white disabled:opacity-40"
                      >
                        {busy === `edit:${key.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Salvar permissões
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs font-black text-stone-600"
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PresetCard({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-violet-100 bg-violet-50/50 p-3 text-left transition hover:border-violet-200 hover:bg-violet-50"
    >
      <span className="block text-xs font-black text-violet-950">{title}</span>
      <span className="mt-1 block text-[10px] leading-4 text-violet-700">{description}</span>
      <span className="mt-2 block text-[9px] font-black uppercase tracking-wide text-violet-600">Adicionar permissões</span>
    </button>
  );
}

function PermissionSummary({ selected, capabilities }: { selected: string[]; capabilities: Capability[] }) {
  const selectedItems = capabilities.filter((item) => selected.includes(item.scope));
  const reads = selectedItems.filter((item) => item.risk === "read").length;
  const writes = selectedItems.filter((item) => item.risk === "write").length;
  const destructive = selectedItems.filter((item) => item.risk === "destructive").length;
  return (
    <div className="flex flex-wrap gap-1.5 text-[9px] font-black uppercase">
      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">{selectedItems.length} selecionadas</span>
      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">{reads} leitura</span>
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{writes} alteração</span>
      {destructive > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">{destructive} destrutiva</span>}
    </div>
  );
}

function ScopeMatrix({
  capabilities,
  selected,
  setSelected,
  defaults,
  compact = false,
}: {
  capabilities: Capability[];
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  defaults: string[];
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () => capabilities.filter((item) => {
      if (!normalizedQuery) return true;
      return [item.section, item.category, item.label, item.description, item.scope, item.toolName, item.endpoint]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    }),
    [capabilities, normalizedQuery],
  );
  const sections = useMemo(() => groupBySection(filtered), [filtered]);
  const validScopes = useMemo(() => new Set(capabilities.map((item) => item.scope)), [capabilities]);

  const toggle = (targetScopes: string[], enabled: boolean) => {
    const safe = targetScopes.filter((scope) => validScopes.has(scope));
    setSelected((current) =>
      enabled
        ? Array.from(new Set([...current, ...safe]))
        : current.filter((scope) => !safe.includes(scope)),
    );
  };

  const onlyReads = capabilities.filter((item) => item.risk === "read").map((item) => item.scope);
  const allScopes = capabilities.map((item) => item.scope);

  return (
    <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50/60 p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black text-stone-900">Permissões</p>
          <p className="mt-0.5 text-[10px] leading-4 text-stone-500">
            Cada checkbox corresponde a uma operação real. Desmarcar uma função impede que ela seja exposta para esta credencial.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setSelected(defaults.filter((scope) => validScopes.has(scope)))} className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[9px] font-black text-stone-600">Recomendadas</button>
          <button type="button" onClick={() => setSelected(onlyReads)} className="rounded-lg border border-sky-100 bg-sky-50 px-2.5 py-1.5 text-[9px] font-black text-sky-700">Só leitura</button>
          <button type="button" onClick={() => setSelected(allScopes)} className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-[9px] font-black text-red-700">Todas, inclusive destrutivas</button>
          <button type="button" onClick={() => setSelected([])} className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[9px] font-black text-stone-500">Limpar</button>
        </div>
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar função, scope, ferramenta ou categoria..."
          className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-9 pr-3 text-xs outline-none focus:border-violet-300"
        />
      </div>

      <div className={`${compact ? "max-h-[520px]" : "max-h-[680px]"} mt-3 space-y-3 overflow-y-auto pr-1`}>
        {sections.map(([section, categories]) => {
          const sectionItems = categories.flatMap(([, items]) => items);
          const sectionScopes = sectionItems.map((item) => item.scope);
          const sectionAll = sectionScopes.length > 0 && sectionScopes.every((scope) => selected.includes(scope));
          return (
            <div key={section} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-stone-100 bg-stone-50 px-3 py-2.5 sm:px-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-stone-700">{section}</p>
                  <p className="mt-0.5 text-[9px] text-stone-400">{sectionItems.length} função(ões)</p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[9px] font-black uppercase text-violet-700">
                  <input
                    type="checkbox"
                    checked={sectionAll}
                    onChange={(event) => toggle(sectionScopes, event.target.checked)}
                    className="h-4 w-4 accent-violet-700"
                  />
                  Seção inteira
                </label>
              </div>

              <div className="space-y-3 p-3 sm:p-4">
                {categories.map(([category, items]) => {
                  const categoryScopes = items.map((item) => item.scope);
                  const categoryAll = categoryScopes.every((scope) => selected.includes(scope));
                  return (
                    <div key={`${section}:${category}`}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black text-stone-500">{category}</p>
                        <label className="flex cursor-pointer items-center gap-1.5 text-[9px] font-bold text-stone-500">
                          <input
                            type="checkbox"
                            checked={categoryAll}
                            onChange={(event) => toggle(categoryScopes, event.target.checked)}
                            className="accent-violet-700"
                          />
                          selecionar subcategoria
                        </label>
                      </div>

                      <div className="grid gap-2 lg:grid-cols-2">
                        {items.map((item) => {
                          const checked = selected.includes(item.scope);
                          return (
                            <label
                              key={item.scope}
                              className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                                checked
                                  ? "border-violet-200 bg-violet-50/60"
                                  : "border-stone-100 bg-white hover:border-stone-200"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => toggle([item.scope], event.target.checked)}
                                className="mt-0.5 h-4 w-4 shrink-0 accent-violet-700"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-xs font-black text-stone-800">{item.label}</span>
                                  <RiskBadge risk={item.risk} />
                                </span>
                                <span className="mt-1 block text-[10px] leading-4 text-stone-500">{item.description}</span>
                                <span className="mt-2 block space-y-1">
                                  {item.toolName && (
                                    <code className="block break-all text-[9px] font-bold text-violet-700">{item.toolName}</code>
                                  )}
                                  {item.endpoint && (
                                    <code className="block break-all text-[9px] text-sky-700">{item.endpoint}</code>
                                  )}
                                  <code className="block break-all text-[8px] text-stone-400">scope: {item.scope}</code>
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-xs text-stone-400">
            Nenhuma permissão encontrada para esta busca.
          </div>
        )}
      </div>
    </div>
  );
}

function RiskBadge({ risk }: { risk: Risk }) {
  const label = risk === "read" ? "leitura" : risk === "write" ? "alteração" : "destrutiva";
  const cls = risk === "read"
    ? "bg-sky-50 text-sky-700"
    : risk === "write"
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";
  return <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${cls}`}>{label}</span>;
}

function groupBySection(items: Capability[]): Array<[string, Array<[string, Capability[]]>]> {
  const sections = new Map<string, Map<string, Capability[]>>();
  for (const item of items) {
    if (!sections.has(item.section)) sections.set(item.section, new Map());
    const categories = sections.get(item.section)!;
    categories.set(item.category, [...(categories.get(item.category) || []), item]);
  }
  return Array.from(sections.entries()).map(([section, categories]) => [section, Array.from(categories.entries())]);
}
