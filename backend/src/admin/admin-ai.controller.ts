import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AdminGuard } from './admin.guard';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

type AiProvider = 'GEMINI' | 'OPENAI' | 'ANTHROPIC';

interface AiModelInfo {
  id: string;
  name: string;
  provider: string;
  providerId: AiProvider;
  inputCostPer1M: number;
  outputCostPer1M: number;
  contextWindow?: number;
}

const PROVIDERS: AiProvider[] = ['GEMINI', 'OPENAI', 'ANTHROPIC'];
const PROVIDER_REQUEST_TIMEOUT_MS = 25_000;

const COST_DATABASE: Record<
  string,
  { input: number; output: number; name: string }
> = {
  'gpt-5.6': { input: 0, output: 0, name: 'GPT-5.6' },
  'gpt-5.6-sol': { input: 2.5, output: 15, name: 'GPT-5.6 Sol' },
  'gpt-5.6-terra': { input: 1.25, output: 7.5, name: 'GPT-5.6 Terra' },
  'gpt-5.6-luna': { input: 0.5, output: 3, name: 'GPT-5.6 Luna' },
  'gpt-5.5': { input: 2.5, output: 15, name: 'GPT-5.5' },
  'gpt-5.4-mini': { input: 0.375, output: 2.25, name: 'GPT-5.4 Mini' },
  'gpt-4o': { input: 5.0, output: 15.0, name: 'GPT-4o' },
  'gpt-4o-mini': { input: 0.15, output: 0.6, name: 'GPT-4o Mini' },
  'claude-sonnet-5': { input: 3, output: 15, name: 'Claude Sonnet 5' },
  'claude-opus-5': { input: 0, output: 0, name: 'Claude Opus 5' },
  'claude-3-5-sonnet-20241022': {
    input: 3.0,
    output: 15.0,
    name: 'Claude 3.5 Sonnet',
  },
  'claude-3-5-haiku-20241022': {
    input: 1.0,
    output: 5.0,
    name: 'Claude 3.5 Haiku',
  },
  'gemini-3.7-flash': {
    input: 0,
    output: 0,
    name: 'Gemini 3.7 Flash',
  },
  'gemini-3.6-flash': {
    input: 1.5,
    output: 7.5,
    name: 'Gemini 3.6 Flash',
  },
  'gemini-3.5-flash': {
    input: 0,
    output: 0,
    name: 'Gemini 3.5 Flash',
  },
  'gemini-3.5-flash-lite': {
    input: 0.3,
    output: 2.5,
    name: 'Gemini 3.5 Flash-Lite',
  },
  'gemini-2.5-flash': {
    input: 0.075,
    output: 0.3,
    name: 'Gemini 2.5 Flash',
  },
};

@Controller('admin/ai')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminAiController {
  constructor(private readonly settingsService: SettingsService) {}

  private isProvider(value: unknown): value is AiProvider {
    return PROVIDERS.includes(value as AiProvider);
  }

  private async getProviderKey(provider: AiProvider): Promise<string> {
    const settingKey = `${provider}_API_KEY`;
    const saved = await this.settingsService.getValue(settingKey);
    const environment = process.env[settingKey];
    return (saved || environment || '').trim();
  }

  private modelInfo(
    id: string,
    providerId: AiProvider,
    provider: string,
    name?: string,
  ): AiModelInfo {
    const cost = COST_DATABASE[id];
    return {
      id,
      name: cost?.name || name || id,
      provider,
      providerId,
      inputCostPer1M: cost?.input || 0,
      outputCostPer1M: cost?.output || 0,
    };
  }

  private normalizeRequestedModel(value: unknown): string {
    return typeof value === 'string' ? value.trim().slice(0, 180) : '';
  }

  private selectRequestedOrSuggested(
    ids: string[],
    requestedModel: string,
    suggestedModel: string | null,
  ): string {
    if (requestedModel) {
      if (!ids.includes(requestedModel)) {
        throw new Error(
          `O modelo ${requestedModel} não está disponível para esta chave/provedor. Atualize a lista e selecione outro modelo.`,
        );
      }
      return requestedModel;
    }
    if (!suggestedModel) {
      throw new Error('Nenhum modelo de linguagem compatível foi encontrado.');
    }
    return suggestedModel;
  }

  private chooseOpenAiModel(ids: string[]): string | null {
    const compatible = ids.filter(
      (id) =>
        /^gpt-/i.test(id) &&
        !/(audio|realtime|transcribe|tts|search|image|codex|chat)/i.test(id),
    );
    const priorities = [
      'gpt-5.6',
      'gpt-5.6-luna',
      'gpt-5.6-terra',
      'gpt-5.6-sol',
      'gpt-5.5',
      'gpt-5.4-mini',
      'gpt-5.4',
      'gpt-5-mini',
      'gpt-5',
      'gpt-4.1-mini',
      'gpt-4.1',
      'gpt-4o-mini',
      'gpt-4o',
    ];
    return (
      priorities.find((id) => compatible.includes(id)) ||
      compatible.find((id) => /luna|mini|nano/i.test(id)) ||
      compatible[0] ||
      null
    );
  }

  private chooseAnthropicModel(ids: string[]): string | null {
    const compatible = ids.filter((id) => /^claude-/i.test(id));
    const priorities = [
      'claude-sonnet-5',
      'claude-opus-5',
      'claude-sonnet-4-6',
      'claude-opus-4-8',
      'claude-haiku-4-5',
    ];
    return (
      priorities.find((id) => compatible.includes(id)) ||
      compatible.find((id) => /sonnet-5/i.test(id)) ||
      compatible.find((id) => /sonnet/i.test(id)) ||
      compatible.find((id) => /opus/i.test(id)) ||
      compatible.find((id) => /haiku/i.test(id)) ||
      compatible[0] ||
      null
    );
  }

  private chooseGeminiModel(ids: string[]): string | null {
    const compatible = ids.filter(
      (id) =>
        /^gemini-/i.test(id) &&
        !/(image|embedding|tts|live|robotics|omni)/i.test(id),
    );
    const priorities = [
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.1-pro-preview',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
    ];
    return (
      priorities.find((id) => compatible.includes(id)) ||
      compatible.find((id) => /flash/i.test(id)) ||
      compatible.find((id) => /pro/i.test(id)) ||
      compatible[0] ||
      null
    );
  }

  private async testGeminiGeneration(apiKey: string, model: string) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Responda apenas OK.' }] }],
          generationConfig: { maxOutputTokens: 16 },
        }),
      },
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Google Gemini respondeu HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
      );
    }
  }

  private async testProvider(
    provider: AiProvider,
    requestedModel = '',
  ): Promise<{
    model: string;
    models: AiModelInfo[];
  }> {
    const apiKey = await this.getProviderKey(provider);
    if (!apiKey) {
      throw new BadRequestException(
        `Nenhuma chave de API foi configurada para ${provider}.`,
      );
    }

    try {
      if (provider === 'OPENAI') {
        const openai = new OpenAI({
          apiKey,
          timeout: PROVIDER_REQUEST_TIMEOUT_MS,
        });
        const list = await openai.models.list();
        const ids = list.data.map((item) => item.id);
        const compatibleIds = ids.filter(
          (id) =>
            /^gpt-/i.test(id) &&
            !/(audio|realtime|transcribe|tts|search|image|codex|chat)/i.test(id),
        );
        const model = this.selectRequestedOrSuggested(
          compatibleIds,
          requestedModel,
          this.chooseOpenAiModel(compatibleIds),
        );

        await openai.responses.create({
          model,
          input: 'Responda apenas OK.',
          max_output_tokens: 16,
        });

        return {
          model,
          models: compatibleIds.map((id) =>
            this.modelInfo(id, 'OPENAI', 'OpenAI'),
          ),
        };
      }

      if (provider === 'ANTHROPIC') {
        const anthropic = new Anthropic({
          apiKey,
          timeout: PROVIDER_REQUEST_TIMEOUT_MS,
        });
        const list = await anthropic.models.list();
        const ids = list.data.map((item) => item.id);
        const compatibleIds = ids.filter((id) => /^claude-/i.test(id));
        const model = this.selectRequestedOrSuggested(
          compatibleIds,
          requestedModel,
          this.chooseAnthropicModel(compatibleIds),
        );

        await anthropic.messages.create({
          model,
          max_tokens: 16,
          messages: [{ role: 'user', content: 'Responda apenas OK.' }],
        });

        return {
          model,
          models: list.data
            .filter((item) => compatibleIds.includes(item.id))
            .map((item) =>
              this.modelInfo(
                item.id,
                'ANTHROPIC',
                'Anthropic',
                item.display_name,
              ),
            ),
        };
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS) },
      );
      if (!response.ok) {
        throw new Error(`Google Gemini respondeu HTTP ${response.status}.`);
      }
      const data = (await response.json()) as {
        models?: Array<{
          name?: string;
          displayName?: string;
          supportedGenerationMethods?: string[];
        }>;
      };
      const available = (data.models || [])
        .filter((item) =>
          item.supportedGenerationMethods?.includes('generateContent'),
        )
        .map((item) => ({
          id: String(item.name || '').replace(/^models\//, ''),
          name: item.displayName,
        }))
        .filter(
          (item) =>
            item.id.startsWith('gemini-') &&
            !/(image|embedding|tts|live|robotics|omni)/i.test(item.id),
        );
      const ids = available.map((item) => item.id);
      const model = this.selectRequestedOrSuggested(
        ids,
        requestedModel,
        this.chooseGeminiModel(ids),
      );

      await this.testGeminiGeneration(apiKey, model);

      return {
        model,
        models: available.map((item) =>
          this.modelInfo(item.id, 'GEMINI', 'Google Gemini', item.name),
        ),
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      const status = error?.status || error?.statusCode;
      const timedOut =
        error?.name === 'TimeoutError' ||
        error?.name === 'AbortError' ||
        /timed out|timeout/i.test(String(error?.message || ''));
      const message = timedOut
        ? 'O provedor não respondeu dentro de 25 segundos.'
        : status === 401 || status === 403
          ? 'A chave foi recusada pelo provedor.'
          : error?.message || 'Não foi possível conectar ao provedor.';
      throw new BadRequestException(`Falha ao testar ${provider}: ${message}`);
    }
  }

  @Get('config')
  async getConfig() {
    const enabledSetting =
      (await this.settingsService.getValue('AI_ENABLED', 'false')) === 'true';
    const rawProvider = await this.settingsService.getValue('AI_PROVIDER');
    const provider = this.isProvider(rawProvider) ? rawProvider : null;
    const model = (await this.settingsService.getValue('AI_MODEL')) || null;
    const configuredEntries = await Promise.all(
      PROVIDERS.map(
        async (item) => [item, Boolean(await this.getProviderKey(item))] as const,
      ),
    );
    const configuredProviders = Object.fromEntries(configuredEntries) as Record<
      AiProvider,
      boolean
    >;
    return {
      enabled:
        enabledSetting &&
        Boolean(provider && model && configuredProviders[provider]),
      provider,
      model,
      configuredProviders,
    };
  }

  @Post('test')
  async test(@Body() body: { provider?: string; model?: string }) {
    if (!this.isProvider(body.provider)) {
      throw new BadRequestException('Selecione um provedor de IA válido.');
    }
    const requestedModel = this.normalizeRequestedModel(body.model);
    const result = await this.testProvider(body.provider, requestedModel);
    return {
      success: true,
      provider: body.provider,
      model: result.model,
      models: result.models,
    };
  }

  @Post('config')
  async updateConfig(
    @Body() body: { enabled?: boolean; provider?: string; model?: string },
  ) {
    if (body.enabled === false) {
      await this.settingsService.createOrUpdate(
        'AI_ENABLED',
        'false',
        'Habilita os recursos de inteligência artificial no sistema',
      );
      return {
        enabled: false,
        provider: await this.settingsService.getValue('AI_PROVIDER'),
        model: await this.settingsService.getValue('AI_MODEL'),
      };
    }

    if (body.enabled !== true || !this.isProvider(body.provider)) {
      throw new BadRequestException(
        'Para habilitar a IA, selecione exatamente um provedor válido.',
      );
    }

    await this.settingsService.createOrUpdate(
      'AI_ENABLED',
      'false',
      'Habilita os recursos de inteligência artificial no sistema',
    );

    const requestedModel = this.normalizeRequestedModel(body.model);
    const tested = await this.testProvider(body.provider, requestedModel);
    await this.settingsService.createOrUpdate(
      'AI_PROVIDER',
      body.provider,
      'Provedor de IA ativo no sistema',
    );
    await this.settingsService.createOrUpdate(
      'AI_MODEL',
      tested.model,
      'Modelo de IA escolhido pelo administrador e validado no provedor',
    );
    await this.settingsService.createOrUpdate(
      'AI_ENABLED',
      'true',
      'Habilita os recursos de inteligência artificial no sistema',
    );

    return {
      enabled: true,
      provider: body.provider,
      model: tested.model,
      tested: true,
    };
  }

  @Get('models')
  async getAvailableModels() {
    const models: AiModelInfo[] = [];
    for (const provider of PROVIDERS) {
      const key = await this.getProviderKey(provider);
      if (!key) continue;
      try {
        const result = await this.testProvider(provider);
        models.push(...result.models);
      } catch {
        // Uma chave inválida não impede mostrar os outros provedores.
      }
    }
    return models;
  }
}
