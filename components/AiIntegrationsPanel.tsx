import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Key,
  Loader2,
  Power,
  Save,
  Sparkles,
} from "lucide-react";
import { api } from "../lib/api";

type ProviderId = "GEMINI" | "OPENAI" | "ANTHROPIC";

interface AiModelInfo {
  id: string;
  name: string;
  provider: string;
  providerId: ProviderId;
  inputCostPer1M: number;
  outputCostPer1M: number;
}

interface AiConfig {
  enabled: boolean;
  provider: ProviderId | null;
  model: string | null;
}

const PROVIDERS: Array<{
  id: ProviderId;
  label: string;
  key: "GEMINI_API_KEY" | "OPENAI_API_KEY" | "ANTHROPIC_API_KEY";
  placeholder: string;
}> = [
  {
    id: "GEMINI",
    label: "Google Gemini",
    key: "GEMINI_API_KEY",
    placeholder: "AIzaSy...",
  },
  {
    id: "OPENAI",
    label: "OpenAI",
    key: "OPENAI_API_KEY",
    placeholder: "sk-proj-...",
  },
  {
    id: "ANTHROPIC",
    label: "Anthropic",
    key: "ANTHROPIC_API_KEY",
    placeholder: "sk-ant-...",
  },
];

export function AiIntegrationsPanel() {
  const [keys, setKeys] = useState({
    GEMINI_API_KEY: "",
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
  });
  const [config, setConfig] = useState<AiConfig>({
    enabled: false,
    provider: null,
    model: null,
  });
  const [selectedProvider, setSelectedProvider] =
    useState<ProviderId>("GEMINI");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    loadSettings();
  }, []);

  const errorMessage = (error: any, fallback: string) =>
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback;

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [settingsResponse, configResponse] = await Promise.all([
        api.get("/admin/settings"),
        api.get("/admin/ai/config"),
      ]);
      const nextKeys = {
        GEMINI_API_KEY: settingsResponse.data.GEMINI_API_KEY || "",
        OPENAI_API_KEY: settingsResponse.data.OPENAI_API_KEY || "",
        ANTHROPIC_API_KEY: settingsResponse.data.ANTHROPIC_API_KEY || "",
      };
      setKeys(nextKeys);
      const nextConfig: AiConfig = {
        enabled: Boolean(configResponse.data?.enabled),
        provider: configResponse.data?.provider || null,
        model: configResponse.data?.model || null,
      };
      setConfig(nextConfig);
      if (nextConfig.provider) {
        setSelectedProvider(nextConfig.provider);
      } else {
        const firstConfigured = PROVIDERS.find((provider) =>
          Boolean(nextKeys[provider.key]?.trim()),
        );
        if (firstConfigured) setSelectedProvider(firstConfigured.id);
      }
    } catch (error) {
      console.error("Erro ao carregar configurações de IA", error);
      setMessage({
        type: "error",
        text: "Não foi possível carregar as configurações de IA.",
      });
    } finally {
      setLoading(false);
    }
  };

  const persistKeys = async () => {
    await Promise.all(
      Object.entries(keys).map(([key, value]) =>
        api.post("/admin/settings", {
          key,
          value: value.trim(),
          description: `Chave para ${key}`,
        }),
      ),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      await persistKeys();
      const configResponse = await api.get("/admin/ai/config");
      setConfig({
        enabled: Boolean(configResponse.data?.enabled),
        provider: configResponse.data?.provider || null,
        model: configResponse.data?.model || null,
      });
      setMessage({
        type: "success",
        text: configResponse.data?.enabled
          ? "Chaves salvas. A configuração ativa continua válida."
          : "Chaves salvas. Se a chave do provedor ativo foi alterada, a IA permanece desligada até um novo teste.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: errorMessage(error, "Erro ao salvar as chaves."),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage({ type: "", text: "" });
    try {
      await persistKeys();
      const response = await api.post("/admin/ai/test", {
        provider: selectedProvider,
      });
      setModels(response.data?.models || []);
      setMessage({
        type: "success",
        text: `Conexão com ${PROVIDERS.find((p) => p.id === selectedProvider)?.label} validada. Modelo sugerido: ${response.data?.model || "disponível"}.`,
      });
    } catch (error) {
      setModels([]);
      setMessage({
        type: "error",
        text: errorMessage(error, "Falha no teste de conexão."),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    setMessage({ type: "", text: "" });
    try {
      if (config.enabled) {
        const response = await api.post("/admin/ai/config", { enabled: false });
        setConfig({
          enabled: false,
          provider: response.data?.provider || config.provider,
          model: response.data?.model || config.model,
        });
        setMessage({
          type: "success",
          text: "Recursos de IA desabilitados no sistema.",
        });
        return;
      }

      const providerMeta = PROVIDERS.find(
        (provider) => provider.id === selectedProvider,
      );
      if (!providerMeta || !keys[providerMeta.key].trim()) {
        setMessage({
          type: "error",
          text: "Informe a chave do provedor selecionado antes de habilitar a IA.",
        });
        return;
      }

      // Salva a credencial e, em seguida, o backend testa a conexão.
      // AI_ENABLED só vira true se esse teste terminar com sucesso.
      await persistKeys();
      const response = await api.post("/admin/ai/config", {
        enabled: true,
        provider: selectedProvider,
      });
      setConfig({
        enabled: true,
        provider: response.data.provider,
        model: response.data.model,
      });
      setMessage({
        type: "success",
        text: `IA habilitada com ${providerMeta.label} usando ${response.data.model}.`,
      });
    } catch (error) {
      setConfig((current) => ({ ...current, enabled: false }));
      setMessage({
        type: "error",
        text: errorMessage(
          error,
          "A IA não foi habilitada porque o teste de conexão falhou.",
        ),
      });
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <Loader2 className="h-5 w-5 animate-spin text-stone-500" />
      </div>
    );
  }

  const activeProviderLabel = PROVIDERS.find(
    (provider) => provider.id === config.provider,
  )?.label;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">
          Automação e IA
        </p>
        <h1 className="mt-1 text-3xl font-serif font-bold text-stone-900">
          Integrações de Inteligência Artificial
        </h1>
        <p className="mt-1 text-stone-500">
          Configure as credenciais e escolha um único provedor ativo para os
          recursos de IA do sistema.
        </p>
      </header>

      <section
        className={`rounded-2xl border p-5 ${
          config.enabled
            ? "border-emerald-200 bg-emerald-50"
            : "border-stone-200 bg-white"
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`rounded-xl p-2.5 ${
                config.enabled
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-stone-100 text-stone-500"
              }`}
            >
              <Power className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-stone-900">IA no sistema</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    config.enabled
                      ? "bg-emerald-600 text-white"
                      : "bg-stone-200 text-stone-600"
                  }`}
                >
                  {config.enabled ? "Habilitada" : "Desabilitada"}
                </span>
              </div>
              <p className="mt-1 text-sm text-stone-600">
                {config.enabled
                  ? `${activeProviderLabel || config.provider} está ativo com o modelo ${config.model}.`
                  : "Quando desabilitada, o site não oferece nem exibe recursos de IA aos usuários."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={toggling}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-50 ${
              config.enabled
                ? "bg-stone-800 hover:bg-stone-900"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {toggling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Power className="h-4 w-4" />
            )}
            {config.enabled ? "Desabilitar IA" : "Habilitar IA"}
          </button>
        </div>
      </section>

      {message.text && (
        <div
          className={`flex items-start gap-2 rounded-xl p-4 text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-4">
            <Key className="h-5 w-5 text-amber-500" />
            <div>
              <h3 className="font-bold text-stone-900">Credenciais</h3>
              <p className="text-xs text-stone-500">
                Você pode guardar mais de uma chave, mas somente um provedor
                fica ativo por vez.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {PROVIDERS.map((provider) => (
              <div key={provider.id}>
                <label className="mb-1 block text-sm font-bold text-stone-700">
                  {provider.label} API Key
                </label>
                <input
                  type="password"
                  value={keys[provider.key]}
                  onChange={(event) =>
                    setKeys((current) => ({
                      ...current,
                      [provider.key]: event.target.value,
                    }))
                  }
                  placeholder={provider.placeholder}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2.5 shadow-sm outline-none focus:border-terracotta-500"
                />
              </div>
            ))}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta-600 px-4 py-3 font-bold text-white hover:bg-terracotta-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              Salvar chaves
            </button>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-4">
            <Cpu className="h-5 w-5 text-indigo-500" />
            <div>
              <h3 className="font-bold text-stone-900">Provedor ativo</h3>
              <p className="text-xs text-stone-500">
                Escolha exatamente um. Ao habilitar, a conexão é testada antes
                de qualquer alteração da flag global.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {PROVIDERS.map((provider) => {
              const configured = Boolean(keys[provider.key].trim());
              const selected = selectedProvider === provider.id;
              return (
                <label
                  key={provider.id}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors ${
                    selected
                      ? "border-terracotta-300 bg-terracotta-50"
                      : "border-stone-200 hover:bg-stone-50"
                  } ${config.enabled ? "cursor-not-allowed opacity-70" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="ai-provider"
                      value={provider.id}
                      checked={selected}
                      disabled={config.enabled}
                      onChange={() => setSelectedProvider(provider.id)}
                    />
                    <div>
                      <strong className="text-sm text-stone-900">
                        {provider.label}
                      </strong>
                      <div className="text-xs text-stone-500">
                        {configured ? "Chave preenchida" : "Sem chave"}
                      </div>
                    </div>
                  </div>
                  {config.enabled && config.provider === provider.id && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  )}
                </label>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleTest}
            disabled={testing || config.enabled}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-stone-200 bg-white px-4 py-3 font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {testing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
            Testar conexão
          </button>

          {models.length > 0 && (
            <div className="rounded-xl bg-stone-50 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">
                Modelos encontrados
              </p>
              <div className="max-h-48 space-y-1 overflow-auto">
                {models.map((model) => (
                  <div
                    key={`${model.providerId}-${model.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-stone-700">
                      {model.name}
                    </span>
                    <code className="text-[10px] text-stone-400">
                      {model.id}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
