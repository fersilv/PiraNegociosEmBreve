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

const COST_DATABASE: Record<
  string,
  { input: number; output: number; name: string }
> = {
  'gpt-4o': { input: 5.0, output: 15.0, name: 'GPT-4o' },
  'gpt-4o-mini': { input: 0.15, output: 0.6, name: 'GPT-4o Mini' },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5, name: 'GPT-3.5 Turbo' },
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
  'gemini-2.5-flash': {
    input: 0.075,
    output: 0.3,
    name: 'Gemini 2.5 Flash',
  },
  'gemini-2.0-flash': {
    input: 0.1,
    output: 0.4,
    name: 'Gemini 2.0 Flash',
  },
  'gemini-1.5-pro': {
    input: 1.25,
    output: 5.0,
    name: 'Gemini 1.5 Pro',
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

  private chooseOpenAiModel(ids: string[]): string | null {
    const priorities = [
      'gpt-5.6-luna',
      'gpt-5.4-mini',
      'gpt-4o-mini',
      'gpt-4o',
    ];
    return (
      priorities.find((id) => ids.includes(id)) ||
      ids.find((id) => /^gpt-/i.test(id) && /mini|luna|nano/i.test(id)) ||
      ids.find((id) => /^gpt-/i.test(id)) ||
      null
    );
  }

  private chooseAnthropicModel(ids: string[]): string | null {
    return (
      ids.find((id) => /haiku/i.test(id)) ||
      ids.find((id) => /sonnet/i.test(id)) ||
      ids[0] ||
      null
    );
  }

  private chooseGeminiModel(ids: string[]): string | null {
    const priorities = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    return (
      priorities.find((id) => ids.includes(id)) ||
      ids.find((id) => /flash/i.test(id)) ||
      ids[0] ||
      null
    );
  }

  private async testProvider(provider: AiProvider): Promise<{
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
        const openai = new OpenAI({ apiKey });
        const list = await openai.models.list();
        const ids = list.data
          .map((model) => model.id)
          .filter((id) => /^gpt-/i.test(id));
        const model = this.chooseOpenAiModel(ids);
        if (!model)
          throw new Error('Nenhum modelo de linguagem compatível foi encontrado.');
        return {
          model,
          models: ids.map((id) => this.modelInfo(id, 'OPENAI', 'OpenAI')),
        };
      }

      if (provider === 'ANTHROPIC') {
        const anthropic = new Anthropic({ apiKey });
        const list = await anthropic.models.list();
        const ids = list.data.map((model) => model.id);
        const model = this.chooseAnthropicModel(ids);
        if (!model)
          throw new Error('Nenhum modelo de linguagem compatível foi encontrado.');
        return {
          model,
          models: list.data.map((item) =>
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
        .filter((item) => item.id.startsWith('gemini-'));
      const ids = available.map((item) => item.id);
      const model = this.chooseGeminiModel(ids);
      if (!model)
        throw new Error('Nenhum modelo Gemini compatível foi encontrado.');
      return {
        model,
        models: available.map((item) =>
          this.modelInfo(item.id, 'GEMINI', 'Google Gemini', item.name),
        ),
      };
    } catch (error: any) {
      const message =
        error?.status === 401 || error?.status === 403
          ? 'A chave foi recusada pelo provedor.'
          : error?.message || 'Não foi possível conectar ao provedor.';
      throw new BadRequestException(
        `Falha ao testar ${provider}: ${message}`,
      );
    }
  }

  @Get('config')
  async getConfig() {
    const enabled =
      (await this.settingsService.getValue('AI_ENABLED', 'false')) === 'true';
    const rawProvider = await this.settingsService.getValue('AI_PROVIDER');
    const provider = this.isProvider(rawProvider) ? rawProvider : null;
    const model = (await this.settingsService.getValue('AI_MODEL')) || null;
    return { enabled: enabled && Boolean(provider && model), provider, model };
  }

  @Post('test')
  async test(@Body() body: { provider?: string }) {
    if (!this.isProvider(body.provider)) {
      throw new BadRequestException('Selecione um provedor de IA válido.');
    }
    const result = await this.testProvider(body.provider);
    return {
      success: true,
      provider: body.provider,
      model: result.model,
      models: result.models,
    };
  }

  @Post('config')
  async updateConfig(
    @Body() body: { enabled?: boolean; provider?: string },
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

    // A flag só é ativada depois que o provedor responde com sucesso.
    const tested = await this.testProvider(body.provider);
    await this.settingsService.createOrUpdate(
      'AI_PROVIDER',
      body.provider,
      'Provedor de IA ativo no sistema',
    );
    await this.settingsService.createOrUpdate(
      'AI_MODEL',
      tested.model,
      'Modelo de IA selecionado automaticamente após teste de conexão',
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
        // O endpoint de modelos é diagnóstico. Falhas individuais não derrubam os demais.
      }
    }
    return models;
  }
}
