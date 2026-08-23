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

  private extractJsonObject(text: string) {
    const start = text.indexOf('{');
    if (start < 0) return text;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) return text.slice(start, index + 1);
      }
    }
    return text.slice(start);
  }

  private normalizeJsonControls(text: string) {
    let result = '';
    let inString = false;
    let escaped = false;
    for (const char of text) {
      if (inString) {
        if (escaped) {
          result += char;
          escaped = false;
          continue;
        }
        if (char === '\\') {
          result += char;
          escaped = true;
          continue;
        }
        if (char === '"') {
          result += char;
          inString = false;
          continue;
        }
        if (char === '\n') {
          result += '\\n';
          continue;
        }
        if (char === '\r') {
          result += '\\r';
          continue;
        }
        if (char === '\t') {
          result += '\\t';
          continue;
        }
        result += char;
        continue;
      }
      if (char === '"') inString = true;
      result += char;
    }
    return result;
  }

  private removeTrailingJsonCommas(text: string) {
    let result = '';
    let inString = false;
    let escaped = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        result += char;
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        result += char;
        continue;
      }
      if (char === ',') {
        let next = index + 1;
        while (next < text.length && /\s/.test(text[next])) next += 1;
        if (text[next] === ']' || text[next] === '}') continue;
      }
      result += char;
    }
    return result;
  }

  private repairJsonAtParsePosition(text: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error || '');
    const match = message.match(/position\s+(\d+)/i);
    if (!match) return null;
    const position = Number(match[1]);
    if (!Number.isInteger(position) || position < 0 || position > text.length) return null;
    if (/Expected ',' or '[}\]]' after/i.test(message) || /Expected ',' or '}' after property value/i.test(message)) {
      let cursor = position;
      while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1;
      const next = text[cursor];
      if (!next || next === ']' || next === '}' || next === ',') return null;
      return `${text.slice(0, cursor)},${text.slice(cursor)}`;
    }
    return null;
  }

  private parseJson(text: string): Record<string, unknown> {
    const withoutFences = String(text || '{}')
      .replace(/^\s*```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .replace(/^\uFEFF/, '')
      .trim();
    let candidate = this.normalizeJsonControls(this.extractJsonObject(withoutFences).trim());
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        return JSON.parse(candidate) as Record<string, unknown>;
      } catch (error) {
        lastError = error;
        const noTrailing = this.removeTrailingJsonCommas(candidate);
        if (noTrailing !== candidate) {
          candidate = noTrailing;
          continue;
        }
        const repaired = this.repairJsonAtParsePosition(candidate, error);
        if (repaired && repaired !== candidate) {
          candidate = repaired;
          continue;
        }
        break;
      }
    }
    const detail = lastError instanceof Error ? lastError.message : 'JSON inválido';
    throw new Error(`O provedor retornou uma avaliação em JSON inválido (${detail}).`);
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
      'Você avalia a QUALIDADE DO CURRÍCULO, nunca o valor, potencial ou empregabilidade da pessoa. A nota mede apenas clareza, completude, consistência, evidências profissionais, organização e utilidade do documento para recrutamento. Não invente informações ausentes. Responda exclusivamente JSON válido, compacto, sem Markdown e sem texto fora do objeto.',
      behavior.name ? `Identidade configurada: ${behavior.name}.` : '',
      behavior.tone ? `Tom configurado: ${behavior.tone}` : '',
      behavior.instructions ? `Instruções gerais do administrador:\n${behavior.instructions}` : '',
      behavior.negativePrompt ? `Regras inegociáveis:\n${behavior.negativePrompt}` : '',
      memory ? `Contexto e instruções específicas recuperadas:\n${memory}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private async generateRaw(
    config: RuntimeConfig,
    prompt: string,
    systemInstruction: string,
    maxTokens: number,
  ): Promise<string> {
    if (config.provider === 'OPENAI') {
      const openai = new OpenAI({ apiKey: config.apiKey });
      const response: any = await openai.responses.create({
        model: config.model,
        instructions: systemInstruction,
        input: prompt,
        max_output_tokens: maxTokens,
      });
      if (response?.status === 'incomplete') {
        throw new Error(`AI_JSON_TRUNCATED:${response?.incomplete_details?.reason || 'incomplete'}`);
      }
      return String(response?.output_text || '{}');
    }

    if (config.provider === 'ANTHROPIC') {
      const anthropic = new Anthropic({ apiKey: config.apiKey });
      const response: any = await anthropic.messages.create({
        model: config.model,
        system: systemInstruction,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });
      if (response?.stop_reason === 'max_tokens') throw new Error('AI_JSON_TRUNCATED:max_tokens');
      return (response.content || [])
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
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
            maxOutputTokens: maxTokens,
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
      candidates?: Array<{
        finishReason?: string;
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const candidate = data.candidates?.[0];
    if (String(candidate?.finishReason || '').toUpperCase() === 'MAX_TOKENS') {
      throw new Error('AI_JSON_TRUNCATED:MAX_TOKENS');
    }
    return (data.candidates || [])
      .flatMap((item) => item.content?.parts || [])
      .map((part) => part.text || '')
      .filter(Boolean)
      .join('\n');
  }

  private async generate(
    config: RuntimeConfig,
    prompt: string,
    systemInstruction: string,
  ) {
    let lastError: unknown = null;
    const budgets = [3200, 8000];
    for (let attempt = 0; attempt < budgets.length; attempt += 1) {
      try {
        const retryInstruction = attempt === 0
          ? systemInstruction
          : `${systemInstruction}\n\nA resposta anterior falhou por JSON inválido ou truncado. Gere novamente do zero, de forma mais compacta, e finalize obrigatoriamente todo o objeto JSON.`;
        const text = await this.generateRaw(config, prompt, retryInstruction, budgets[attempt]);
        return this.parseJson(text || '{}');
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error || '');
        const retryable = message.includes('AI_JSON_TRUNCATED')
          || message.includes('JSON inválido')
          || message.includes('Unterminated string')
          || message.includes('Expected');
        if (!retryable || attempt === budgets.length - 1) throw error;
      }
    }
    throw lastError;
  }

  async review(profile: unknown): Promise<ResumeReviewResult> {
    const config = await this.getRuntimeConfig();
    const systemInstruction = await this.buildSystemInstruction(profile);
    const prompt = `Avalie o currículo estruturado abaixo.\n\nCURRÍCULO: ${this.serialize(profile, 30000)}\n\nCritérios da nota (0 a 100): completude das seções relevantes, clareza das descrições, coerência de datas e progressão, evidências de atividades/conquistas, organização das habilidades e qualidade do resumo. Não penalize a pessoa por ser iniciante ou ter pouca experiência; avalie se o documento representa bem o que ela realmente possui.\n\nRetorne EXCLUSIVAMENTE:\n{"score":0,"strengths":[""],"suggestions":[""],"feedbackText":"","missingSections":[""]}\n\nUse textos objetivos e mantenha o JSON compacto para garantir que a resposta seja concluída.`;

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
