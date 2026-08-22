import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { SettingsService } from '../admin/settings.service';
import { Job } from '../jobs/entities/job.entity';

type AiProvider = 'GEMINI' | 'OPENAI' | 'ANTHROPIC';
type RuntimeConfig = { provider: AiProvider; model: string; apiKey: string };

export type WeightedJobRequirement = {
  label: string;
  type: 'SKILL' | 'EXPERIENCE' | 'EDUCATION' | 'CERTIFICATION' | 'LICENSE' | 'OTHER';
  required: boolean;
  weight: number;
  evidenceTerms: string[];
};

export type WeightedTechnicalSkill = {
  name: string;
  required: boolean;
  weight: number;
  evidenceTerms: string[];
};

export type JobMatchProfile = {
  canonicalRole: string;
  occupationalFamily: string;
  occupationKeywords: string[];
  technicalSkills: WeightedTechnicalSkill[];
  requirements: WeightedJobRequirement[];
  softSkills: string[];
  summary: string;
};

@Injectable()
export class JobMatchAiService {
  constructor(private readonly settings: SettingsService) {}

  private isProvider(value: unknown): value is AiProvider {
    return ['GEMINI', 'OPENAI', 'ANTHROPIC'].includes(value as string);
  }

  private async config(): Promise<RuntimeConfig> {
    const enabled = (await this.settings.getValue('AI_ENABLED', 'false')) === 'true';
    const provider = await this.settings.getValue('AI_PROVIDER');
    const model = await this.settings.getValue('AI_MODEL');
    if (!enabled || !this.isProvider(provider) || !model) {
      throw new ServiceUnavailableException('A IA está desabilitada e a vaga não pôde ser preparada para o Match Inteligente.');
    }
    const apiKey = ((await this.settings.getValue(`${provider}_API_KEY`)) || process.env[`${provider}_API_KEY`] || '').trim();
    if (!apiKey) throw new ServiceUnavailableException('O provedor de IA ativo não possui chave configurada.');
    return { provider, model, apiKey };
  }

  private parseJson(text: string): any {
    const cleaned = String(text || '{}').replace(/```json/gi, '').replace(/```/g, '').trim();
    try { return JSON.parse(cleaned); } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
      throw new Error('A IA retornou uma ficha de vaga inválida.');
    }
  }

  private async generate(config: RuntimeConfig, prompt: string, system: string) {
    if (config.provider === 'OPENAI') {
      const response = await new OpenAI({ apiKey: config.apiKey }).responses.create({
        model: config.model,
        instructions: system,
        input: prompt,
        max_output_tokens: 3200,
      });
      return this.parseJson(response.output_text || '{}');
    }
    if (config.provider === 'ANTHROPIC') {
      const response = await new Anthropic({ apiKey: config.apiKey }).messages.create({
        model: config.model,
        system,
        max_tokens: 3200,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n');
      return this.parseJson(text || '{}');
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 3200 },
        }),
      },
    );
    const raw = await response.text();
    if (!response.ok) throw new Error(`Gemini respondeu HTTP ${response.status}: ${raw.slice(0, 400)}`);
    const data = JSON.parse(raw || '{}') as any;
    const text = (data.candidates || []).flatMap((candidate: any) => candidate.content?.parts || []).map((part: any) => part.text || '').join('\n');
    return this.parseJson(text || '{}');
  }

  private strings(value: unknown, limit: number, maxLength = 120): string[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.map((item) => String(item || '').trim().replace(/\s+/g, ' ').slice(0, maxLength)).filter((item) => {
      const key = item.toLocaleLowerCase('pt-BR');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);
  }

  private weight(value: unknown, fallback = 1) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0.1, Math.min(5, n)) : fallback;
  }

  private normalizeProfile(raw: any): JobMatchProfile {
    const technicalSkills = (Array.isArray(raw?.technicalSkills) ? raw.technicalSkills : []).map((item: any) => ({
      name: String(item?.name || '').trim().slice(0, 120),
      required: item?.required === true,
      weight: this.weight(item?.weight),
      evidenceTerms: this.strings(item?.evidenceTerms, 8),
    })).filter((item: WeightedTechnicalSkill) => item.name).slice(0, 15);

    const validTypes = new Set(['SKILL','EXPERIENCE','EDUCATION','CERTIFICATION','LICENSE','OTHER']);
    const requirements = (Array.isArray(raw?.requirements) ? raw.requirements : []).map((item: any) => ({
      label: String(item?.label || '').trim().slice(0, 180),
      type: (validTypes.has(String(item?.type || '').toUpperCase()) ? String(item.type).toUpperCase() : 'OTHER') as WeightedJobRequirement['type'],
      required: item?.required === true,
      weight: this.weight(item?.weight),
      evidenceTerms: this.strings(item?.evidenceTerms, 10),
    })).filter((item: WeightedJobRequirement) => item.label).slice(0, 20);

    return {
      canonicalRole: String(raw?.canonicalRole || '').trim().slice(0, 160),
      occupationalFamily: String(raw?.occupationalFamily || '').trim().slice(0, 180),
      occupationKeywords: this.strings(raw?.occupationKeywords, 12),
      technicalSkills,
      requirements,
      softSkills: this.strings(raw?.softSkills, 10),
      summary: String(raw?.summary || '').trim().slice(0, 700),
    };
  }

  async analyze(job: Job): Promise<JobMatchProfile> {
    const config = await this.config();
    const system = [
      'Você é um especialista brasileiro em classificação ocupacional e requisitos de vagas.',
      'Sua tarefa é estruturar a vaga para um motor de compatibilidade. Não avalie nenhum candidato.',
      'Não invente requisito, certificação, experiência, licença ou habilidade que não esteja sustentada pelo título, descrição, requisitos ou skills fornecidos.',
      'Palavras genéricas de cargo como operador, auxiliar, assistente, analista, ajudante e técnico NÃO definem família ocupacional sozinhas.',
      'Diferencie competências técnicas de soft skills. Requisitos obrigatórios devem ser marcados required=true apenas quando a fonte sustentar isso.',
      'evidenceTerms deve conter expressões profissionais específicas que poderiam aparecer num currículo como evidência real daquele item.',
      'Responda exclusivamente JSON válido.',
    ].join('\n');
    const prompt = `Analise a vaga e devolva esta estrutura:\n{
  "canonicalRole":"cargo canônico específico",
  "occupationalFamily":"família ocupacional específica",
  "occupationKeywords":["termos específicos da ocupação"],
  "technicalSkills":[{"name":"competência técnica","required":true,"weight":1,"evidenceTerms":["evidências equivalentes"]}],
  "requirements":[{"label":"requisito","type":"SKILL|EXPERIENCE|EDUCATION|CERTIFICATION|LICENSE|OTHER","required":true,"weight":1,"evidenceTerms":["evidências equivalentes"]}],
  "softSkills":["soft skill explicitamente pertinente"],
  "summary":"resumo curto do perfil profissional realmente procurado"
}\n\nVAGA:\n${JSON.stringify({
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      skills: job.skills,
      type: job.type,
      workModel: job.workModel,
    })}`;
    return this.normalizeProfile(await this.generate(config, prompt, system));
  }
}
