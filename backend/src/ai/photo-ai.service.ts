import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SettingsService } from '../admin/settings.service';

const PHOTO_PROMPT = `Transform this exact person into a realistic professional headshot suitable for a Brazilian résumé and LinkedIn profile.
Preserve the person's identity with high fidelity: facial structure, skin tone, age, body proportions, hairstyle and distinguishing traits. Do not beautify into a different person, do not change gender presentation, ethnicity or apparent age.
Improve only what a professional photographer or light retouch would reasonably improve: natural lighting, exposure, sharpness, framing and background. Use a clean neutral studio-like background, chest-up framing, natural skin texture and realistic photography. If the original clothing is visibly unsuitable for a professional portrait, replace only the clothing with simple neutral professional-casual attire while preserving the person.
No text, logos, watermarks, accessories that were not present, dramatic makeup or artificial-looking skin.`;

@Injectable()
export class PhotoAiService {
  constructor(private readonly settingsService: SettingsService) {}

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

    const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    return { mimeType, buffer, extension };
  }

  async professionalize(image: string) {
    const enabled =
      (await this.settingsService.getValue('AI_ENABLED', 'false')) === 'true';
    if (!enabled) {
      throw new ServiceUnavailableException(
        'Os recursos de inteligência artificial estão desabilitados no momento.',
      );
    }

    const apiKey = String(
      (await this.settingsService.getValue('OPENAI_API_KEY')) ||
        process.env.OPENAI_API_KEY ||
        '',
    ).trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'O aprimoramento de foto ainda não possui uma chave OpenAI configurada.',
      );
    }

    const model = String(
      (await this.settingsService.getValue('PHOTO_AI_MODEL', 'gpt-image-1')) ||
        'gpt-image-1',
    ).trim();
    const { mimeType, buffer, extension } = this.parseImageDataUrl(image);

    try {
      const form = new FormData();
      form.append('model', model);
      form.append('prompt', PHOTO_PROMPT);
      form.append('size', '1024x1024');
      form.append('n', '1');
      form.append(
        'image',
        new Blob([buffer], { type: mimeType }),
        `portrait.${extension}`,
      );

      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
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

      const data = JSON.parse(raw || '{}') as {
        data?: Array<{ b64_json?: string; url?: string }>;
      };
      const generated = data.data?.[0];
      if (generated?.b64_json) {
        return {
          image: `data:image/png;base64,${generated.b64_json}`,
          model,
        };
      }
      if (generated?.url) {
        const imageResponse = await fetch(generated.url);
        if (!imageResponse.ok) throw new Error('Não foi possível baixar a foto gerada.');
        const arrayBuffer = await imageResponse.arrayBuffer();
        const contentType = imageResponse.headers.get('content-type') || 'image/png';
        return {
          image: `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`,
          model,
        };
      }

      throw new Error('O provedor não devolveu uma imagem aprimorada.');
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
