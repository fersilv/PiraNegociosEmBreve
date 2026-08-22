import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import OpenAI from 'openai';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { AdminGuard } from './admin.guard';
import { SettingsService } from './settings.service';

type ImageAiProvider = 'GEMINI' | 'OPENAI';

interface ImageModelInfo {
  id: string;
  name: string;
  provider: string;
  providerId: ImageAiProvider;
}

const IMAGE_PROVIDERS: ImageAiProvider[] = ['GEMINI', 'OPENAI'];
const REQUEST_TIMEOUT_MS = 25_000;

@Controller('admin/ai')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminImageAiController {
  constructor(private readonly settingsService: SettingsService) {}

  private isProvider(value: unknown): value is ImageAiProvider {
    return IMAGE_PROVIDERS.includes(value as ImageAiProvider);
  }

  private async getProviderKey(provider: ImageAiProvider): Promise<string> {
    const settingKey = `${provider}_API_KEY`;
    return String(
      (await this.settingsService.getValue(settingKey)) ||
        process.env[settingKey] ||
        '',
    ).trim();
  }

  private isOpenAiEditableImageModel(id: string): boolean {
    return /^(gpt-image-|chatgpt-image-)/i.test(id);
  }

  private isGeminiImageModel(id: string): boolean {
    return /^gemini-/i.test(id) && /image/i.test(id);
  }

  private async listOpenAiModels(apiKey: string): Promise<ImageModelInfo[]> {
    const client = new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS });
    const list = await client.models.list();
    return list.data
      .filter((item) => this.isOpenAiEditableImageModel(item.id))
      .map((item) => ({
        id: item.id,
        name: item.id,
        provider: 'OpenAI',
        providerId: 'OPENAI' as const,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private async listGeminiModels(apiKey: string): Promise<ImageModelInfo[]> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
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

    return (data.models || [])
      .filter((item) =>
        item.supportedGenerationMethods?.includes('generateContent'),
      )
      .map((item) => ({
        id: String(item.name || '').replace(/^models\//, ''),
        name: String(item.displayName || item.name || ''),
      }))
      .filter((item) => this.isGeminiImageModel(item.id))
      .map((item) => ({
        id: item.id,
        name: item.name || item.id,
        provider: 'Google Gemini',
        providerId: 'GEMINI' as const,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private async listModels(provider: ImageAiProvider): Promise<ImageModelInfo[]> {
    const apiKey = await this.getProviderKey(provider);
    if (!apiKey) {
      throw new BadRequestException(
        `Nenhuma chave de API foi configurada para ${provider}.`,
      );
    }

    try {
      return provider === 'OPENAI'
        ? await this.listOpenAiModels(apiKey)
        : await this.listGeminiModels(apiKey);
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
          : error?.message || 'Não foi possível consultar os modelos de imagem.';
      throw new BadRequestException(
        `Falha ao consultar modelos de imagem em ${provider}: ${message}`,
      );
    }
  }

  @Get('image-config')
  async getConfig() {
    const globalEnabled =
      (await this.settingsService.getValue('AI_ENABLED', 'false')) === 'true';
    const imageEnabledSetting =
      (await this.settingsService.getValue('AI_IMAGE_ENABLED', 'false')) ===
      'true';
    const rawProvider = await this.settingsService.getValue('AI_IMAGE_PROVIDER');
    const provider = this.isProvider(rawProvider) ? rawProvider : null;
    const model =
      String((await this.settingsService.getValue('AI_IMAGE_MODEL')) || '').trim() ||
      null;
    const configuredProviders = {
      GEMINI: Boolean(await this.getProviderKey('GEMINI')),
      OPENAI: Boolean(await this.getProviderKey('OPENAI')),
    };

    return {
      enabled:
        globalEnabled &&
        imageEnabledSetting &&
        Boolean(provider && model && configuredProviders[provider]),
      configured: imageEnabledSetting,
      globalEnabled,
      provider,
      model,
      configuredProviders,
    };
  }

  @Post('image-models')
  async getModels(@Body() body: { provider?: string }) {
    if (!this.isProvider(body.provider)) {
      throw new BadRequestException(
        'Selecione um provedor compatível com geração de imagem.',
      );
    }

    const models = await this.listModels(body.provider);
    if (!models.length) {
      throw new BadRequestException(
        'Nenhum modelo compatível com edição/geração de imagem foi encontrado para esta chave.',
      );
    }

    return { provider: body.provider, models };
  }

  @Post('image-config')
  async updateConfig(
    @Body() body: { enabled?: boolean; provider?: string; model?: string },
  ) {
    if (body.enabled === false) {
      await this.settingsService.createOrUpdate(
        'AI_IMAGE_ENABLED',
        'false',
        'Habilita o aprimoramento de imagens por inteligência artificial',
      );
      return {
        enabled: false,
        provider: await this.settingsService.getValue('AI_IMAGE_PROVIDER'),
        model: await this.settingsService.getValue('AI_IMAGE_MODEL'),
      };
    }

    const globalEnabled =
      (await this.settingsService.getValue('AI_ENABLED', 'false')) === 'true';
    if (!globalEnabled) {
      throw new BadRequestException(
        'Habilite a IA geral do sistema antes de ativar o aprimoramento de imagem.',
      );
    }

    if (body.enabled !== true || !this.isProvider(body.provider)) {
      throw new BadRequestException(
        'Selecione um provedor de imagem válido antes de habilitar o recurso.',
      );
    }

    const requestedModel = String(body.model || '').trim().slice(0, 180);
    if (!requestedModel) {
      throw new BadRequestException('Selecione um modelo de imagem.');
    }

    const models = await this.listModels(body.provider);
    if (!models.some((item) => item.id === requestedModel)) {
      throw new BadRequestException(
        'O modelo selecionado não está disponível ou não oferece geração/edição de imagem para este provedor.',
      );
    }

    await this.settingsService.createOrUpdate(
      'AI_IMAGE_PROVIDER',
      body.provider,
      'Provedor usado exclusivamente para aprimoramento de imagens',
    );
    await this.settingsService.createOrUpdate(
      'AI_IMAGE_MODEL',
      requestedModel,
      'Modelo usado exclusivamente para aprimoramento de imagens',
    );
    await this.settingsService.createOrUpdate(
      'AI_IMAGE_ENABLED',
      'true',
      'Habilita o aprimoramento de imagens por inteligência artificial',
    );

    return {
      enabled: true,
      provider: body.provider,
      model: requestedModel,
    };
  }
}
