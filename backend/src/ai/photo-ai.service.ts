import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SettingsService } from '../admin/settings.service';

type ImageAiProvider = 'GEMINI' | 'OPENAI';

interface PhotoRuntimeConfig {
  provider: ImageAiProvider;
  model: string;
  apiKey: string;
}

const PHOTO_PROMPT = `Transform this exact person into a realistic professional headshot suitable for a Brazilian résumé and LinkedIn profile.
Preserve the person's identity with high fidelity: facial structure, skin tone, age, body proportions, hairstyle and distinguishing traits. Do not beautify into a different person, do not change gender presentation, ethnicity or apparent age.
Improve only what a professional photographer or light retouch would reasonably improve: natural lighting, exposure, sharpness, framing and background. Use a clean neutral studio-like background, chest-up framing, natural skin texture and realistic photography. If the original clothing is visibly unsuitable for a professional portrait, replace only the clothing with simple neutral professional-casual attire while preserving the person.
No text, logos, watermarks, accessories that were not present, dramatic makeup or artificial-looking skin.`;

@Injectable()
export class PhotoAiService {
  constructor(private readonly settingsService: SettingsService) {}

  private isProvider(value: unknown): value is ImageAiProvider {
    return ['GEMINI', 'OPENAI'].includes(value as string);
  }

  private isOpenAiEditableImageModel(model: string): boolean {
    return /^(gpt-image-|chatgpt-image-)/i.test(model);
  }

  private isGeminiImageModel(model: string): boolean {
    return /^gemini-/i.test(model) && /image/i.test(model);
  }

  async getStatus() {
    const [globalEnabledRaw, imageEnabledRaw, rawProvider, rawModel] =
      await Promise.all([
        this.settingsService.getValue('AI_ENABLED', 'false'),
        this.settingsService.getValue('AI_IMAGE_ENABLED', 'false'),
        this.settingsService.getValue('AI_IMAGE_PROVIDER'),
        this.settingsService.getValue('AI_IMAGE_MODEL'),
      ]);

    const provider = this.isProvider(rawProvider) ? rawProvider : null;
    const model = String(rawModel || '').trim() || null;
    const settingKey = provider ? `${provider}_API_KEY` : '';
    const apiKey = provider
      ? String(
          (await this.settingsService.getValue(settingKey)) ||
            process.env[settingKey] ||
            '',
        ).trim()
      : '';
    const modelCompatible = Boolean(
      provider &&
        model &&
        (provider === 'OPENAI'
          ? this.isOpenAiEditableImageModel(model)
          : this.isGeminiImageModel(model)),
    );

    const enabled =
      globalEnabledRaw === 'true' &&
      imageEnabledRaw === 'true' &&
      Boolean(provider && model && apiKey && modelCompatible);

    return {
      enabled,
      provider: enabled ? provider : null,
      model: enabled ? model : null,
    };
  }

  private async getRuntimeConfig(): Promise<PhotoRuntimeConfig> {
    const globalEnabled =
      (await this.settingsService.getValue('AI_ENABLED', 'false')) === 'true';
    const imageEnabled =
      (await this.settingsService.getValue('AI_IMAGE_ENABLED', 'false')) ===
      'true';
    const provider = await this.settingsService.getValue('AI_IMAGE_PROVIDER');
    const model = String(
      (await this.settingsService.getValue('AI_IMAGE_MODEL')) || '',
    ).trim();

    if (!globalEnabled) {
      throw new ServiceUnavailableException(
        'Os recursos de inteligência artificial estão desabilitados no momento.',
      );
    }

    if (!imageEnabled || !this.isProvider(provider) || !model) {
      throw new ServiceUnavailableException(
        'O aprimoramento de imagem está desabilitado no momento.',
      );
    }

    const compatible =
      provider === 'OPENAI'
        ? this.isOpenAiEditableImageModel(model)
        : this.isGeminiImageModel(model);
    if (!compatible) {
      throw new ServiceUnavailableException(
        'O modelo configurado para aprimoramento não oferece edição/geração de imagem. Selecione outro modelo no administrador.',
      );
    }

    const settingKey = `${provider}_API_KEY`;
    const apiKey = String(
      (await this.settingsService.getValue(settingKey)) ||
        process.env[settingKey] ||
        '',
    ).trim();

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'O provedor de imagem ativo não possui uma chave configurada.',
      );
    }

    return { provider, model, apiKey };
  }

  private parseImageDataUrl(value: string) {
    const match = String(value || '').match(
      /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i,
    );
    if (!match) {
      throw new BadRequestException(
        'A foto precisa estar carregada no sistema antes de ser aprimorada.',
      );
    }

    const mimeType = match[1].toLowerCase().replace('image/jpg', 'image/jpeg');
    const base64 = match[2].replace(/\s+/g, '');
    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length) throw new BadRequestException('A foto enviada está vazia.');
    if (buffer.length > 8 * 1024 * 1024) {
      throw new BadRequestException(
        'Para aprimorar com IA, use uma foto com até 8 MB.',
      );
    }

    return { mimeType, base64 };
  }

  private findBase64Image(value: unknown): { data: string; mimeType: string } | null {
    if (!value || typeof value !== 'object') return null;

    const record = value as Record<string, unknown>;
    const inlineData =
      (record.inlineData as Record<string, unknown> | undefined) ||
      (record.inline_data as Record<string, unknown> | undefined);

    if (inlineData) {
      const data = String(inlineData.data || '').trim();
      const mimeType = String(
        inlineData.mimeType || inlineData.mime_type || 'image/png',
      ).trim();
      if (data && mimeType.startsWith('image/')) return { data, mimeType };
    }

    if (record.type === 'image_generation_call' && typeof record.result === 'string') {
      return { data: record.result, mimeType: 'image/png' };
    }

    if (typeof record.b64_json === 'string' && record.b64_json) {
      return { data: record.b64_json, mimeType: 'image/png' };
    }

    for (const child of Object.values(record)) {
      if (Array.isArray(child)) {
        for (const item of child) {
          const found = this.findBase64Image(item);
          if (found) return found;
        }
      } else if (child && typeof child === 'object') {
        const found = this.findBase64Image(child);
        if (found) return found;
      }
    }

    return null;
  }

  private async professionalizeWithGemini(
    config: PhotoRuntimeConfig,
    mimeType: string,
    base64: string,
  ) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: base64 } },
                { text: PHOTO_PROMPT },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      },
    );

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(
        `Google Gemini respondeu HTTP ${response.status}${raw ? `: ${raw.slice(0, 500)}` : ''}`,
      );
    }

    const data = JSON.parse(raw || '{}');
    const generated = this.findBase64Image(data);
    if (!generated) {
      throw new ServiceUnavailableException(
        `O modelo ${config.model} não devolveu uma imagem. Escolha no administrador outro modelo Gemini compatível com geração de imagem.`,
      );
    }

    return {
      image: `data:${generated.mimeType};base64,${generated.data}`,
      provider: config.provider,
      model: config.model,
    };
  }

  private async professionalizeWithOpenAi(
    config: PhotoRuntimeConfig,
    mimeType: string,
    base64: string,
  ) {
    const bytes = new Uint8Array(Buffer.from(base64, 'base64'));
    const form = new FormData();
    form.append('model', config.model);
    form.append('prompt', PHOTO_PROMPT);
    form.append('size', '1024x1024');
    form.append('image', new Blob([bytes], { type: mimeType }), 'photo.png');

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: form,
    });

    const raw = await response.text();
    if (!response.ok) {
      let detail = '';
      try {
        const parsed = JSON.parse(raw || '{}');
        detail = parsed?.error?.message || '';
      } catch {
        detail = raw.slice(0, 500);
      }
      throw new Error(
        `OpenAI respondeu HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
      );
    }

    const data = JSON.parse(raw || '{}');
    const generated = this.findBase64Image(data);
    if (!generated) {
      throw new ServiceUnavailableException(
        `O modelo ${config.model} não devolveu uma imagem editada. Escolha no administrador outro modelo OpenAI compatível com edição de imagem.`,
      );
    }

    return {
      image: `data:${generated.mimeType};base64,${generated.data}`,
      provider: config.provider,
      model: config.model,
    };
  }

  async professionalize(image: string) {
    const config = await this.getRuntimeConfig();
    const { mimeType, base64 } = this.parseImageDataUrl(image);

    try {
      if (config.provider === 'GEMINI') {
        return await this.professionalizeWithGemini(config, mimeType, base64);
      }

      return await this.professionalizeWithOpenAi(config, mimeType, base64);
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      console.error('AI professional photo error:', error);
      throw new InternalServerErrorException(
        error?.message || 'Não foi possível aprimorar a foto agora.',
      );
    }
  }
}
