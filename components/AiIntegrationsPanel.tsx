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
import { AiImageEnhancementPanel } from "./AiImageEnhancementPanel";

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

interface AiInstructionSettings {
  assistantName: string;
  tone: string;
  globalInstructions: string;
  negativePrompt: string;
  resumeAnalysis: string;
  jobMatch: string;
  skillSuggestion: string;
  skillCompatibility: string;
  supportChat: string;
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

const DEFAULT_INSTRUCTIONS: AiInstructionSettings = {
  assistantName: "Assistente PiraNegócios",
  tone: "Profissional, humano, claro, acolhedor e direto.",
  globalInstructions:
    "Use apenas informações verificáveis disponíveis no contexto. Quando faltar informação essencial, não invente.",
  negativePrompt:
    "Jamais invente dados de candidatos, empresas, vagas, qualificações, contatos ou fatos não presentes nas fontes fornecidas.",
  resumeAnalysis: "",
  jobMatch: "",
  skillSuggestion: "",
  skillCompatibility: "",
  supportChat: "",
};

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
  const [selectedModel, setSelectedModel] = useState("");
  const [instructions, setInstructions] =
    useState<AiInstructionSettings>(DEFAULT_INSTRUCTIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    void loadSettings();
  }, []);

  const errorMessage = (error: any, fallback: string) => {
    if (error?.code === "ECONNABORTED") {
      return "O teste do provedor excedeu o tempo limite. Tente novamente; se persistir, verifique a disponibilidade do provedor ou escolha outro modelo.";
    }
    return (
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      fallback
    );
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [settingsResponse, configResponse] = await Promise.all([
        api.get("/admin/settings"),
        api.get("/admin/ai/config"),
      ]);
      const settings = settingsResponse.data || {};
      const nextKeys = {
        GEMINI_API_KEY: settings.GEMINI_API_KEY || "",
        OPENAI_API_KEY: settings.OPENAI_API_KEY || "",
        ANTHROPIC_API_KEY: settings.ANTHROPIC_API_KEY || "",
      };
      setKeys(nextKeys);
      setInstructions({
        assistantName:
          settings.AI_ASSISTANT_NAME || DEFAULT_INSTRUCTIONS.assistantName,
        tone: settings.AI_TONE || DEFAULT_INSTRUCTIONS.tone,
        globalInstructions:
          settings.AI_SYSTEM_INSTRUCTIONS ||
          DEFAULT_INSTRUCTIONS.globalInstructions,
        negativePrompt:
          settings.AI_NEGATIVE_PROMPT || DEFAULT_INSTRUCTIONS.negativePrompt,
        resumeAnalysis: settings.AI_INSTRUCTION_RESUME_ANALYSIS || "",
        jobMatch: settings.AI_INSTRUCTION_JOB_MATCH || "",
        skillSuggestion: settings.AI_INSTRUCTION_SKILL_SUGGESTION || "",
        skillCompatibility:
          settings.AI_INSTRUCTION_SKILL_COMPATIBILITY || "",
        supportChat: settings.AI_INSTRUCTION_CHAT_SUPPORT || "",
      });

      const nextConfig: AiConfig = {
        enabled: Boolean(configResponse.data?.enabled),
        provider: configResponse.data?.provider || null,
        model: configResponse.data?.model || null,
      };
      setConfig(nextConfig);
      setSelectedModel(nextConfig.model || "");
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
          value: String(value).trim(),
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
      const nextConfig = {
        enabled: Boolean(configResponse.data?.enabled),
        provider: configResponse.data?.provider || null,
        model: configResponse.data?.model || null,
      };
      setConfig(nextConfig);
      if (nextConfig.model) setSelectedModel(nextConfig.model);
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

  const handleSaveInstructions = async () => {
    setSavingInstructions(true);
    setMessage({ type: "", text: "" });
    const entries = [
      [
        "AI_ASSISTANT_NAME",
        instructions.assistantName,
        "Nome/persona da assistente de IA",
      ],
      ["AI_TONE", instructions.tone, "Tom de voz global da IA"],
      [
        "AI_SYSTEM_INSTRUCTIONS",
        instructions.globalInstructions,
        "Instruções globais de comportamento da IA",
      ],
      [
        "AI_NEGATIVE_PROMPT",
        instructions.negativePrompt,
        "Regras negativas e proibições globais da IA",
      ],
      [
        "AI_INSTRUCTION_RESUME_ANALYSIS",
        instructions.resumeAnalysis,
        "Instruções específicas para análise e extração de currículos",
      ],
      [
        "AI_INSTRUCTION_JOB_MATCH",
        instructions.jobMatch,
        "Instruções específicas para matching de vagas",
      ],
      [
        "AI_INSTRUCTION_SKILL_SUGGESTION",
        instructions.skillSuggestion,
        "Instruções específicas para sugestão de habilidades de vagas",
      ],
      [
        "AI_INSTRUCTION_SKILL_COMPATIBILITY",
        instructions.skillCompatibility,
        "Instruções específicas para compatibilidade semântica de habilidades",
      ],
      [
        "AI_INSTRUCTION_CHAT_SUPPORT",
        instructions.supportChat,
        "Instruções específicas para o chat de suporte da plataforma",
      ],
    ] as const;

    try {
      await Promise.all(
        entries.map(([key, value, description]) =>
          api.post("/admin/settings", {
            key,
            value: String(value).trim(),
            description,
          }),
        ),
      );
      setMessage({
        type: "success",
        text: "Instruções salvas. Cada regra específica será aplicada somente ao recurso correspondente.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: errorMessage(error, "Erro ao salvar as instruções da IA."),
      });
    } finally {
      setSavingInstructions(false);
    }
  };

  const handleProviderChange = (provider: ProviderId) => {
    setSelectedProvider(provider);
    setModels([]);
    setSelectedModel(
      config.provider === provider && config.model ? config.model : "",
    );
    setMessage({ type: "", text: "" });
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage({ type: "", text: "" });
    try {
      await persistKeys();
      const selectedModelIsCurrent = models.some(
        (model) => model.id === selectedModel,
      );
      const response = await api.post(
        "/admin/ai/test",
        {
          provider: selectedProvider,
          ...(selectedModelIsCurrent ? { model: selectedModel } : {}),
        },
        { timeout: 60000 },
      );
      const nextModels: AiModelInfo[] = Array.isArray(response.data?.models)
        ? response.data.models
        : [];
      setModels(nextModels);
      const testedModel = String(response.data?.model || "");
      if (
        !selectedModel ||
        !nextModels.some((model) => model.id === selectedModel)
      ) {
        setSelectedModel(testedModel);
      }
      setMessage({
        type: "success",
        text: `Conexão com ${PROVIDERS.find((p) => p.id === selectedProvider)?.label} validada usando ${testedModel || "um modelo disponível"}. Agora você pode escolher outro modelo da lista e testar novamente.`,
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
      if (
        !selectedModel ||
        !models.some((model) => model.id === selectedModel)
      ) {
        setMessage({
          type: "error",
          text: "Teste a conexão, carregue os modelos atuais e selecione um modelo validado antes de habilitar a IA.",
        });
        return;
      }

      await persistKeys();
      const response = await api.post(
        "/admin/ai/config",
        {
          enabled: true,
          provider: selectedProvider,
          model: selectedModel,
        },
        { timeout: 60000 },
      );
      setConfig({
        enabled: true,
        provider: response.data.provider,
        model: response.data.model,
      });
      setSelectedModel(response.data.model || selectedModel);
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
  const selectedModelIsCurrent = models.some(
    (model) => model.id === selectedModel,
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">
          Automação e IA
        </p>
        <h1 className="mt-1 text-3xl font-serif font-bold text-stone-900">
          Inteligência Artificial
        </h1>
        <p className="mt-1 max-w-3xl text-stone-500">
          Escolha provedores e modelos, valide as conexões e controle como a IA
          deve agir em cada recurso da plataforma. Texto e imagem possuem
          configurações independentes.
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
              <div className="flex flex-wrap items-center gap-2">
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
                  ? `${activeProviderLabel || config.provider} está ativo com o modelo ${config.model} para recursos gerais de IA.`
                  : "Quando desabilitada, todos os recursos de IA, inclusive imagem, ficam indisponíveis aos usuários."}
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

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-4">
            <Key className="h-5 w-5 text-amber-500" />
            <div>
              <h3 className="font-bold text-stone-900">Credenciais</h3>
              <p className="text-xs text-stone-500">
                As mesmas chaves podem alimentar recursos gerais e de imagem,
                desde que o provedor possua um modelo compatível.
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

        <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-4">
            <Cpu className="h-5 w-5 text-indigo-500" />
            <div>
              <h3 className="font-bold text-stone-900">Provedor e modelo geral</h3>
              <p className="text-xs text-stone-500">
                Usado para currículo, matching, habilidades e demais tarefas de texto/raciocínio.
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
                      onChange={() => handleProviderChange(provider.id)}
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
            {selectedModelIsCurrent
              ? "Testar modelo selecionado"
              : "Testar conexão e carregar modelos"}
          </button>

          {models.length > 0 ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-500">
                Modelo utilizado pelo sistema
              </label>
              <select
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
                disabled={config.enabled}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm font-semibold text-stone-800 outline-none focus:border-terracotta-500 disabled:opacity-70"
              >
                <option value="">Selecione um modelo</option>
                {models.map((model) => (
                  <option key={`${model.providerId}-${model.id}`} value={model.id}>
                    {model.name} ({model.id})
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-stone-500">
                Troque o modelo e clique em testar novamente para validar aquele
                modelo antes de habilitar a IA.
              </p>
            </div>
          ) : selectedModel ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
              Modelo salvo: <strong>{selectedModel}</strong>. Teste a conexão
              para atualizar a lista disponível para esta chave.
            </div>
          ) : null}
        </section>
      </div>

      <AiImageEnhancementPanel globalAiEnabled={config.enabled} />

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-start gap-3 border-b border-stone-100 pb-4">
          <div className="rounded-xl bg-violet-50 p-2.5 text-violet-700">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900">Comportamento global</h3>
            <p className="mt-1 text-sm text-stone-500">
              Estas regras acompanham os recursos textuais de IA. As instruções
              específicas da próxima seção são adicionadas somente ao caso
              correspondente.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-stone-700">
              Nome / persona
            </label>
            <input
              value={instructions.assistantName}
              onChange={(event) =>
                setInstructions((current) => ({
                  ...current,
                  assistantName: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-stone-300 px-3 py-2.5 outline-none focus:border-terracotta-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-stone-700">
              Tom de voz
            </label>
            <input
              value={instructions.tone}
              onChange={(event) =>
                setInstructions((current) => ({
                  ...current,
                  tone: event.target.value,
                }))
              }
              placeholder="Ex.: profissional, humano, direto..."
              className="w-full rounded-xl border border-stone-300 px-3 py-2.5 outline-none focus:border-terracotta-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-stone-700">
              Instruções gerais
            </label>
            <textarea
              value={instructions.globalInstructions}
              onChange={(event) =>
                setInstructions((current) => ({
                  ...current,
                  globalInstructions: event.target.value,
                }))
              }
              rows={5}
              placeholder="Regras que a IA deve seguir em qualquer tarefa."
              className="w-full resize-y rounded-xl border border-stone-300 px-3 py-3 text-sm leading-relaxed outline-none focus:border-terracotta-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-stone-700">
              Nunca fazer / regras inegociáveis
            </label>
            <textarea
              value={instructions.negativePrompt}
              onChange={(event) =>
                setInstructions((current) => ({
                  ...current,
                  negativePrompt: event.target.value,
                }))
              }
              rows={5}
              placeholder="Ex.: não inventar dados, não alterar datas..."
              className="w-full resize-y rounded-xl border border-stone-300 px-3 py-3 text-sm leading-relaxed outline-none focus:border-terracotta-500"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="border-b border-stone-100 pb-4">
          <h3 className="font-bold text-stone-900">Instruções por recurso</h3>
          <p className="mt-1 text-sm text-stone-500">
            Use estes campos para orientar cada operação sem contaminar as
            demais. Deixe em branco quando as regras globais forem suficientes.
          </p>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <InstructionField
            title="Análise de currículo"
            description="Extração de dados, interpretação de experiência, formação, cursos, resumo e sugestões do currículo."
            value={instructions.resumeAnalysis}
            onChange={(value) =>
              setInstructions((current) => ({
                ...current,
                resumeAnalysis: value,
              }))
            }
            placeholder="Ex.: preserve fielmente cargos e datas; sugestões devem ser objetivas; não inferir competências não comprovadas..."
          />
          <InstructionField
            title="Match de vagas"
            description="Regras para comparar o perfil do usuário com vagas e gerar o score geral e a justificativa."
            value={instructions.jobMatch}
            onChange={(value) =>
              setInstructions((current) => ({ ...current, jobMatch: value }))
            }
            placeholder="Ex.: priorize experiência recente; não penalize ausência de requisito quando ele estiver marcado como desejável..."
          />
          <InstructionField
            title="Sugestão de habilidades da vaga"
            description="Usada ao sugerir até 10 habilidades a partir do cargo, descrição e requisitos da vaga."
            value={instructions.skillSuggestion}
            onChange={(value) =>
              setInstructions((current) => ({
                ...current,
                skillSuggestion: value,
              }))
            }
            placeholder="Ex.: prefira nomes curtos e canônicos; não transformar escolaridade ou benefícios em habilidade..."
          />
          <InstructionField
            title="Compatibilidade de habilidades"
            description="Define como equivalências, sinônimos e competências transferíveis devem influenciar a comparação semântica."
            value={instructions.skillCompatibility}
            onChange={(value) =>
              setInstructions((current) => ({
                ...current,
                skillCompatibility: value,
              }))
            }
            placeholder="Ex.: traduções exatas podem valer 100%; tecnologias da mesma família devem receber compatibilidade parcial..."
          />
          <InstructionField
            title="Chat e suporte"
            description="Orienta o atendimento contextual dentro do site para candidatos, empresas e administradores."
            value={instructions.supportChat}
            onChange={(value) =>
              setInstructions((current) => ({ ...current, supportChat: value }))
            }
            placeholder="Ex.: explique primeiro o caminho na interface; adapte a resposta ao tipo de perfil; quando não houver certeza, encaminhe ao suporte humano..."
          />
        </div>

        <div className="mt-6 flex justify-end border-t border-stone-100 pt-5">
          <button
            type="button"
            onClick={handleSaveInstructions}
            disabled={savingInstructions}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-stone-900 px-6 py-3 text-sm font-bold text-white hover:bg-stone-800 disabled:opacity-50"
          >
            {savingInstructions ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar comportamento e instruções
          </button>
        </div>
      </section>
    </div>
  );
}

function InstructionField({
  title,
  description,
  value,
  onChange,
  placeholder,
}: {
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
      <label className="block text-sm font-bold text-stone-900">{title}</label>
      <p className="mt-1 min-h-10 text-xs leading-relaxed text-stone-500">
        {description}
      </p>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={6}
        placeholder={placeholder}
        className="mt-3 w-full resize-y rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm leading-relaxed outline-none focus:border-terracotta-500"
      />
    </div>
  );
}
