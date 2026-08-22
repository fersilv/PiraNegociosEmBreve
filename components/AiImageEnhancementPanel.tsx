import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Power,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';

type ImageProviderId = 'GEMINI' | 'OPENAI';

interface ImageModelInfo {
  id: string;
  name: string;
  provider: string;
  providerId: ImageProviderId;
}

interface ImageAiConfig {
  enabled: boolean;
  configured: boolean;
  globalEnabled: boolean;
  provider: ImageProviderId | null;
  model: string | null;
  configuredProviders: Record<ImageProviderId, boolean>;
}

const IMAGE_PROVIDERS: Array<{
  id: ImageProviderId;
  label: string;
  description: string;
}> = [
  {
    id: 'OPENAI',
    label: 'OpenAI',
    description: 'Modelos GPT Image compatíveis com edição de fotos.',
  },
  {
    id: 'GEMINI',
    label: 'Google Gemini',
    description: 'Modelos Gemini capazes de devolver imagem gerada.',
  },
];

const EMPTY_CONFIG: ImageAiConfig = {
  enabled: false,
  configured: false,
  globalEnabled: false,
  provider: null,
  model: null,
  configuredProviders: { GEMINI: false, OPENAI: false },
};

export function AiImageEnhancementPanel({
  globalAiEnabled,
}: {
  globalAiEnabled: boolean;
}) {
  const [config, setConfig] = useState<ImageAiConfig>(EMPTY_CONFIG);
  const [provider, setProvider] = useState<ImageProviderId>('OPENAI');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<ImageModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | ''; text: string }>({
    type: '',
    text: '',
  });

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/ai/image-config');
      const next: ImageAiConfig = {
        enabled: Boolean(response.data?.enabled),
        configured: Boolean(response.data?.configured),
        globalEnabled: Boolean(response.data?.globalEnabled),
        provider: response.data?.provider || null,
        model: response.data?.model || null,
        configuredProviders: {
          GEMINI: Boolean(response.data?.configuredProviders?.GEMINI),
          OPENAI: Boolean(response.data?.configuredProviders?.OPENAI),
        },
      };
      setConfig(next);
      setModel(next.model || '');
      if (next.provider) {
        setProvider(next.provider);
      } else if (next.configuredProviders.OPENAI) {
        setProvider('OPENAI');
      } else if (next.configuredProviders.GEMINI) {
        setProvider('GEMINI');
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text:
          error?.response?.data?.message ||
          'Não foi possível carregar a configuração de aprimoramento de imagem.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, [globalAiEnabled]);

  const providerMeta = useMemo(
    () => IMAGE_PROVIDERS.find((item) => item.id === provider),
    [provider],
  );

  const handleProviderChange = (nextProvider: ImageProviderId) => {
    if (config.enabled) return;
    setProvider(nextProvider);
    setModels([]);
    setModel(config.provider === nextProvider ? config.model || '' : '');
    setMessage({ type: '', text: '' });
  };

  const loadCompatibleModels = async () => {
    setLoadingModels(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await api.post(
        '/admin/ai/image-models',
        { provider },
        { timeout: 60000 },
      );
      const nextModels = Array.isArray(response.data?.models)
        ? (response.data.models as ImageModelInfo[])
        : [];
      setModels(nextModels);
      if (!nextModels.some((item) => item.id === model)) {
        setModel(nextModels[0]?.id || '');
      }
      setMessage({
        type: 'success',
        text: `${nextModels.length} modelo${nextModels.length === 1 ? '' : 's'} compatível${nextModels.length === 1 ? '' : 'is'} com imagem encontrado${nextModels.length === 1 ? '' : 's'} em ${providerMeta?.label || provider}.`,
      });
    } catch (error: any) {
      setModels([]);
      setMessage({
        type: 'error',
        text:
          error?.response?.data?.message ||
          error?.message ||
          'Não foi possível consultar os modelos de imagem.',
      });
    } finally {
      setLoadingModels(false);
    }
  };

  const toggleImageEnhancement = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      if (config.enabled) {
        const response = await api.post('/admin/ai/image-config', {
          enabled: false,
        });
        setConfig((current) => ({
          ...current,
          enabled: false,
          configured: false,
          provider: response.data?.provider || current.provider,
          model: response.data?.model || current.model,
        }));
        setMessage({
          type: 'success',
          text: 'Aprimoramento de imagem desabilitado. Os controles de foto por IA deixam de aparecer para os usuários.',
        });
        return;
      }

      if (!globalAiEnabled) {
        setMessage({
          type: 'error',
          text: 'Habilite primeiro a IA geral do sistema.',
        });
        return;
      }

      if (!config.configuredProviders[provider]) {
        setMessage({
          type: 'error',
          text: `Salve primeiro a chave da ${providerMeta?.label || provider} na seção de credenciais.`,
        });
        return;
      }

      if (!model || !models.some((item) => item.id === model)) {
        setMessage({
          type: 'error',
          text: 'Carregue a lista de modelos compatíveis e selecione um modelo de imagem antes de habilitar.',
        });
        return;
      }

      const response = await api.post(
        '/admin/ai/image-config',
        { enabled: true, provider, model },
        { timeout: 60000 },
      );
      setConfig((current) => ({
        ...current,
        enabled: true,
        configured: true,
        globalEnabled: true,
        provider: response.data?.provider || provider,
        model: response.data?.model || model,
      }));
      setMessage({
        type: 'success',
        text: `Aprimoramento de imagem habilitado com ${providerMeta?.label || provider} usando ${response.data?.model || model}.`,
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text:
          error?.response?.data?.message ||
          error?.message ||
          'Não foi possível salvar a configuração de imagem.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando aprimoramento de imagem...
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-stone-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`rounded-xl p-2.5 ${
              config.enabled
                ? 'bg-violet-100 text-violet-700'
                : 'bg-stone-100 text-stone-500'
            }`}
          >
            <ImageIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-stone-900">Aprimoramento de imagem</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                  config.enabled
                    ? 'bg-violet-600 text-white'
                    : 'bg-stone-200 text-stone-600'
                }`}
              >
                {config.enabled ? 'Habilitado' : 'Desabilitado'}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">
              Controla todos os recursos que criam ou aprimoram imagens com IA,
              incluindo a foto profissional do perfil e do currículo. O modelo
              de imagem é independente do modelo usado para texto.
            </p>
            {config.enabled && config.provider && config.model && (
              <p className="mt-2 text-xs font-semibold text-violet-700">
                Em uso: {IMAGE_PROVIDERS.find((item) => item.id === config.provider)?.label} · {config.model}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void toggleImageEnhancement()}
          disabled={saving || (!globalAiEnabled && !config.enabled)}
          className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45 ${
            config.enabled
              ? 'bg-stone-800 hover:bg-stone-900'
              : 'bg-violet-600 hover:bg-violet-700'
          }`}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Power className="h-4 w-4" />
          )}
          {config.enabled ? 'Desabilitar' : 'Habilitar'}
        </button>
      </div>

      {!globalAiEnabled && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>A IA geral está desligada. O aprimoramento de imagem só pode ser ativado quando a IA do sistema estiver habilitada.</span>
        </div>
      )}

      {message.text && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-[.14em] text-stone-500">
            Provedor de imagem
          </p>
          <div className="space-y-2">
            {IMAGE_PROVIDERS.map((item) => {
              const selected = item.id === provider;
              const configured = config.configuredProviders[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleProviderChange(item.id)}
                  disabled={config.enabled}
                  className={`w-full rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected
                      ? 'border-violet-300 bg-violet-50'
                      : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm text-stone-900">{item.label}</strong>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        configured
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {configured ? 'Chave pronta' : 'Sem chave'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-stone-500">{item.description}</p>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-stone-400">
            Anthropic não é listado aqui porque seus modelos não geram uma nova imagem de saída.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-stone-500">
                Modelo compatível
              </p>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                A lista é filtrada pelo backend. Modelos somente de texto não aparecem.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadCompatibleModels()}
              disabled={loadingModels || config.enabled || !config.configuredProviders[provider]}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loadingModels ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Carregar modelos
            </button>
          </div>

          <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
            {models.length > 0 ? (
              <>
                <select
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  disabled={config.enabled}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm font-semibold text-stone-800 outline-none focus:border-violet-500 disabled:opacity-70"
                >
                  <option value="">Selecione um modelo de imagem</option>
                  {models.map((item) => (
                    <option key={`${item.providerId}-${item.id}`} value={item.id}>
                      {item.name} ({item.id})
                    </option>
                  ))}
                </select>
                <div className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-stone-500">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                  <span>Somente modelos capazes de receber uma foto e devolver uma imagem aprimorada entram nesta lista.</span>
                </div>
              </>
            ) : config.model && config.provider === provider ? (
              <div className="text-sm text-stone-600">
                Modelo salvo: <strong>{config.model}</strong>. Carregue a lista para validar os modelos atualmente disponíveis para a chave.
              </div>
            ) : (
              <div className="text-sm leading-6 text-stone-500">
                {config.configuredProviders[provider]
                  ? 'Clique em “Carregar modelos” para consultar somente os modelos com capacidade de imagem.'
                  : `Salve primeiro a chave da ${providerMeta?.label || provider} em Credenciais.`}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
