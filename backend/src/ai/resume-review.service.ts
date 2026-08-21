import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { SettingsService } from '../admin/settings.service';

type AiProvider = 'GEMINI' | 'OPENAI' | 'ANTHROPIC';

type RuntimeConfig = {
  provider: AiProvider;
  model: string;
  apiKey: string;
};

export interface ResumeReviewResult {
  score: number;
  strengths: string[];
  suggestions: string[];
  feedbackText: string;
  missingSections: string[];
  parsedAt: string;
}

@Injectable()
export class ResumeReviewService {
  constructor(private readonly settingsService: SettingsService) {}

  private isProvider(value: unknown): value is AiProvider {
    return ['GEMINI', 'OPENAI', 'ANTHROPIC'].includes(value as string);
  }

  private async getRuntimeConfig(): Promise<RuntimeConfig> {
    const enabled =
      (await this.settingsService.getValue('AI_ENABLED', 'false')) === 'true';
    const provider = await this.settingsService.getValue('AI_PROVIDER');
    const model = await this.settingsService.getValue('AI_MODEL');
    if (!enabled || !this.isProvider(provider) || !model) {
      throw new ServiceUnavailableException(
        'Os recursos de inteligência artificial estão desabilitados no momento.',
      );
    }
    const apiKey = (
      (await this.settingsService.getValue(`${provider}_API_KEY`)) ||
      process.env[`${provider}_API_KEY`] ||
      ''
    ).trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'O provedor de inteligência artificial ativo não possui uma chave configurada.',
      );
    }
    return { provider, model, apiKey };
  }

  private parseJson(text: string): Record<string, unknown> {
    const cleaned = String(text || '{}')
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    try {
      return JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      }
      throw new Error('O provedor retornou uma avaliação fora do formato JSON.');
    }
  }

  private stringArray(value: unknown, limit: number): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, limit);
  }

  private normalize(result: Record<string, unknown>): ResumeReviewResult {
    return {
      score: Math.max(0, Math.min(100, Math.round(Number(result.score) || 0))),
      strengths: this.stringArray(result.strengths, 6),
      suggestions: this.stringArray(result.suggestions, 8),
      feedbackText: String(result.feedbackText || '').trim().slice(0, 3000),
      missingSections: this.stringArray(result.missingSections, 8),
      parsedAt: new Date().toISOString(),
    };
  }

  private serialize(value: unknown, limit: number): string {
    return String(JSON.stringify(value ?? {}) || '{}').slice(0, limit);
  }

  private async buildSystemInstruction(profile: unknown) {
    const [behavior, memory] = await Promise.all([
      this.settingsService.getAiBehavior(),
      this.settingsService.findRelevantAiBrain(
        `currículo análise profissional extração qualidade clareza experiência formação habilidades ${this.serialize(profile, 3500)}`,
        5,
        3500,
      ),
    ]);
    return [
      'Você avalia a QUALIDADE DO CURRÍCULO, nunca o valor, potencial ou empregabilidade da pessoa. A nota mede apenas clareza, completude, consistência, evidências profissionais, organização e utilidade do documento para recrutamento. Não invente informações ausentes. Responda exclusivamente JSON válido.',
      behavior.name ? `Identidade configurada: ${behavior.name}.` : '',
      behavior.tone ? `Tom configurado: ${behavior.tone}` : '',
      behavior.instructions ? `Instruções gerais do administrador:\n${behavior.instructions}` : '',
      behavior.negativePrompt ? `Regras inegociáveis:\n${behavior.negativePrompt}` : '',
      memory ? `Contexto e instruções específicas recuperadas:\n${memory}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private async generate(
    config: RuntimeConfig,
    prompt: string,
    systemInstruction: string,
  ) {
    if (config.provider === 'OPENAI') {
      const openai = new OpenAI({ apiKey: config.apiKey });
      const response = await openai.responses.create({
        model: config.model,
        instructions: systemInstruction,
        input: prompt,
        max_output_tokens: 1800,
      });
      return this.parseJson(response.output_text || '{}');
    }

    if (config.provider === 'ANTHROPIC') {
      const anthropic = new Anthropic({ apiKey: config.apiKey });
      const response = await anthropic.messages.create({
        model: config.model,
        system: systemInstruction,
        max_tokens: 1800,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
      return this.parseJson(text || '{}');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 1800,
          },
        }),
      },
    );
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(
        `Google Gemini respondeu HTTP ${response.status}${raw ? `: ${raw.slice(0, 400)}` : ''}`,
      );
    }
    const data = JSON.parse(raw || '{}') as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = (data.candidates || [])
      .flatMap((candidate) => candidate.content?.parts || [])
      .map((part) => part.text || '')
      .filter(Boolean)
      .join('\n');
    return this.parseJson(text || '{}');
  }

  async review(profile: unknown): Promise<ResumeReviewResult> {
    const config = await this.getRuntimeConfig();
    const systemInstruction = await this.buildSystemInstruction(profile);
    const prompt = `Avalie o currículo estruturado abaixo.\n\nCURRÍCULO: ${this.serialize(profile, 30000)}\n\nCritérios da nota (0 a 100): completude das seções relevantes, clareza das descrições, coerência de datas e progressão, evidências de atividades/conquistas, organização das habilidades e qualidade do resumo. Não penalize a pessoa por ser iniciante ou ter pouca experiência; avalie se o documento representa bem o que ela realmente possui.\n\nRetorne EXCLUSIVAMENTE:\n{"score":0,"strengths":[""],"suggestions":[""],"feedbackText":"","missingSections":[""]}`;

    try {
      return this.normalize(await this.generate(config, prompt, systemInstruction));
    } catch (error: any) {
      if (error instanceof ServiceUnavailableException) throw error;
      console.error('AI resume review error:', error);
      throw new InternalServerErrorException(
        error?.message || 'Não foi possível avaliar o currículo agora.',
      );
    }
  }
}