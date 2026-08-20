import {
  BadRequestException,
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

@Injectable()
export class JobSkillsService {
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

  private parseJson(text: string): any {
    const cleaned = String(text || '{}')
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1));
      }
      throw new Error('O provedor retornou uma resposta fora do formato JSON.');
    }
  }

  private async buildInstruction(taskContext: string) {
    const [behavior, memory] = await Promise.all([
      this.settingsService.getAiBehavior(),
      this.settingsService.findRelevantAiBrain(taskContext, 5, 3500),
    ]);
    return [
      'Você é um especialista em recrutamento, cargos e competências profissionais. Responda sempre em JSON válido e não invente requisitos que não estejam sustentados pelo cargo ou pela descrição fornecida.',
      behavior.name ? `Seu nome configurado é ${behavior.name}.` : '',
      behavior.tone ? `Tom de voz configurado: ${behavior.tone}` : '',
      behavior.instructions ? `Instruções do administrador:\n${behavior.instructions}` : '',
      behavior.negativePrompt
        ? `Regras que jamais podem ser violadas:\n${behavior.negativePrompt}`
        : '',
      memory ? `Memória relevante da plataforma:\n${memory}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private async generateJson(
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
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = (data.candidates || [])
      .flatMap((candidate) => candidate.content?.parts || [])
      .map((part) => part.text || '')
      .filter(Boolean)
      .join('\n');
    return this.parseJson(text || '{}');
  }

  private normalizeSkills(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const skills: string[] = [];
    for (const item of value) {
      if (typeof item !== 'string') continue;
      const skill = item.trim().replace(/\s+/g, ' ').slice(0, 80);
      if (!skill) continue;
      const key = skill.toLocaleLowerCase('pt-BR');
      if (seen.has(key)) continue;
      seen.add(key);
      skills.push(skill);
      if (skills.length === 10) break;
    }
    return skills;
  }

  async suggestSkills(title: string, description: string, requirements?: string) {
    const cleanTitle = String(title || '').trim().slice(0, 180);
    const cleanDescription = String(description || '').trim().slice(0, 7000);
    const cleanRequirements = String(requirements || '').trim().slice(0, 4000);
    if (!cleanTitle || !cleanDescription) {
      throw new BadRequestException(
        'Informe o cargo e uma descrição da vaga antes de sugerir habilidades.',
      );
    }

    const config = await this.getRuntimeConfig();
    const systemInstruction = await this.buildInstruction(
      `sugestão de habilidades para vaga cargo ${cleanTitle} ${cleanDescription.slice(0, 2500)} ${cleanRequirements.slice(0, 1200)}`,
    );
    const prompt = `Sugira de 3 a 10 habilidades relevantes para esta vaga. Use nomes curtos e canônicos, adequados para comparação entre currículos e vagas. Misture competências técnicas e comportamentais somente quando forem realmente pertinentes. Não inclua escolaridade, disponibilidade, salário, benefícios ou tempo de experiência como habilidade.

CARGO: ${cleanTitle}
DESCRIÇÃO: ${cleanDescription}
REQUISITOS: ${cleanRequirements || 'Não informado'}

Retorne EXCLUSIVAMENTE:
{"skills":["Habilidade 1","Habilidade 2"]}`;

    try {
      const result = await this.generateJson(config, prompt, systemInstruction);
      return { skills: this.normalizeSkills(result?.skills) };
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      console.error('AI job skill suggestion error:', error);
      throw new InternalServerErrorException(
        error?.message || 'Não foi possível sugerir habilidades agora.',
      );
    }
  }

  async scoreCompatibility(candidateSkills: unknown, jobSkills: unknown) {
    const candidate = this.normalizeSkills(candidateSkills);
    const job = this.normalizeSkills(jobSkills);
    if (candidate.length === 0 || job.length === 0) {
      return { score: 0, matches: [] };
    }

    const config = await this.getRuntimeConfig();
    const systemInstruction = await this.buildInstruction(
      `compatibilidade semântica entre habilidades candidato ${candidate.join(', ')} vaga ${job.join(', ')}`,
    );
    const prompt = `Compare semanticamente as habilidades do candidato com as habilidades exigidas pela vaga. Não dependa de texto idêntico: traduções, sinônimos, tecnologias relacionadas e competências de mesma família podem ter compatibilidade parcial. Porém não trate conhecimentos apenas vagamente relacionados como equivalentes.

HABILIDADES DO CANDIDATO: ${JSON.stringify(candidate)}
HABILIDADES DA VAGA: ${JSON.stringify(job)}

Para CADA habilidade da vaga, escolha no máximo uma habilidade do candidato que melhor corresponda e dê score de 0 a 100:
100 = equivalente ou praticamente a mesma competência
80-99 = fortemente equivalente
50-79 = relacionada e parcialmente transferível
20-49 = relação fraca
0-19 = sem compatibilidade útil

O score geral deve representar a cobertura das habilidades da vaga, dando peso igual para cada habilidade da vaga. Habilidades não cobertas contam como zero.
Retorne EXCLUSIVAMENTE:
{"score":0,"matches":[{"jobSkill":"","candidateSkill":"","score":0}]}`;

    try {
      const result = await this.generateJson(config, prompt, systemInstruction);
      const matches = Array.isArray(result?.matches)
        ? result.matches
            .map((item: any) => ({
              jobSkill: String(item?.jobSkill || '').slice(0, 80),
              candidateSkill: String(item?.candidateSkill || '').slice(0, 80),
              score: Math.max(0, Math.min(100, Number(item?.score) || 0)),
            }))
            .filter((item: any) => item.jobSkill)
            .slice(0, 10)
        : [];
      const score = Math.max(0, Math.min(100, Number(result?.score) || 0));
      return { score, matches };
    } catch (error: any) {
      if (error instanceof ServiceUnavailableException) throw error;
      console.error('AI skill compatibility error:', error);
      throw new InternalServerErrorException(
        error?.message || 'Não foi possível calcular compatibilidade de habilidades.',
      );
    }
  }
}
