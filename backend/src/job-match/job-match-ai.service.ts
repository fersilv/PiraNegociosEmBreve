import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { GroqCompat as Groq } from '../ai/groq-anthropic-compat';
import { SettingsService } from '../admin/settings.service';
import { Job } from '../jobs/entities/job.entity';

type AiProvider = 'GEMINI' | 'OPENAI' | 'GROQ';
type RuntimeConfig = { provider: AiProvider; model: string; apiKey: string };
const GENERIC_OCCUPATION_WORDS = new Set(['operador','operadora','auxiliar','assistente','analista','ajudante','tecnico','tecnica','profissional','colaborador','colaboradora']);

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
    return ['GEMINI', 'OPENAI', 'GROQ'].includes(value as string);
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

  private jsonCandidates(text: string) {
    const cleaned = String(text || '{}')
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    const sliced = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    const withoutTrailingCommas = sliced.replace(/,\s*([}\]])/g, '$1');
    return Array.from(new Set([cleaned, sliced, withoutTrailingCommas])).filter(Boolean);
  }

  private parseJson(text: string): any {
    let lastError: unknown = null;
    for (const candidate of this.jsonCandidates(text)) {
      try {
        return JSON.parse(candidate);
      } catch (error) {
        lastError = error;
      }
    }
    const detail = lastError instanceof Error ? lastError.message : 'JSON inválido';
    throw new Error(`A IA retornou uma ficha de vaga inválida: ${detail}`);
  }

  private async rawGenerate(config: RuntimeConfig, prompt: string, system: string, maxTokens = 3200) {
    if (config.provider === 'OPENAI') {
      const response = await new OpenAI({ apiKey: config.apiKey }).responses.create({
        model: config.model,
        instructions: system,
        input: prompt,
        max_output_tokens: maxTokens,
      });
      return response.output_text || '';
    }
    if (config.provider === 'GROQ') {
      const response = await new Groq({ apiKey: config.apiKey }).messages.create({
        model: config.model,
        system,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });
      return response.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n');
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens },
        }),
      },
    );
    const raw = await response.text();
    if (!response.ok) throw new Error(`Gemini respondeu HTTP ${response.status}: ${raw.slice(0, 400)}`);
    const data = JSON.parse(raw || '{}') as any;
    return (data.candidates || []).flatMap((candidate: any) => candidate.content?.parts || []).map((part: any) => part.text || '').join('\n');
  }

  private async generate(config: RuntimeConfig, prompt: string, system: string) {
    const first = await this.rawGenerate(config, prompt, system);
    try {
      return this.parseJson(first);
    } catch (firstError) {
      const repairSystem = [
        'Você é um reparador estrito de JSON.',
        'Receberá uma resposta que deveria ser JSON, mas está sintaticamente inválida.',
        'Corrija somente a sintaxe necessária para produzir JSON válido.',
        'Não acrescente fatos, requisitos, habilidades ou conteúdo novo.',
        'Responda exclusivamente com o JSON corrigido, sem markdown ou explicações.',
      ].join('\n');
      const repairPrompt = `Corrija o JSON abaixo sem alterar seu significado:\n\n${String(first).slice(0, 14000)}`;
      const repaired = await this.rawGenerate(config, repairPrompt, repairSystem);
      try {
        return this.parseJson(repaired);
      } catch (repairError) {
        const original = firstError instanceof Error ? firstError.message : 'JSON inválido';
        const repairedDetail = repairError instanceof Error ? repairError.message : 'JSON inválido após reparo';
        throw new Error(`${original}. A tentativa automática de reparo também falhou: ${repairedDetail}`);
      }
    }
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

  private specificOccupationKeywords(value: unknown) {
    return this.strings(value, 12).filter((item) => {
      const tokens = item.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean);
      return tokens.some((token) => !GENERIC_OCCUPATION_WORDS.has(token) && token.length > 2);
    });
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
      occupationKeywords: this.specificOccupationKeywords(raw?.occupationKeywords),
      technicalSkills,
      requirements,
      softSkills: this.strings(raw?.softSkills, 10),
      summary: String(raw?.summary || '').trim().slice(0, 700),
    };
  }

  normalizeProvidedProfile(raw: unknown): JobMatchProfile {
    const source = typeof raw === 'string' ? this.parseJson(raw) : raw;
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new Error('matchProfile precisa ser um objeto JSON.');
    }
    const profile = this.normalizeProfile(source);
    if (!profile.canonicalRole) throw new Error('matchProfile.canonicalRole é obrigatório.');
    if (!profile.occupationalFamily) throw new Error('matchProfile.occupationalFamily é obrigatório.');
    return profile;
  }

  async analyze(job: Job): Promise<JobMatchProfile> {
    const config = await this.config();
    const system = [
      'Você é um especialista brasileiro em classificação ocupacional e requisitos de vagas.',
      'Sua tarefa é estruturar a vaga para um motor de compatibilidade. Não avalie nenhum candidato.',
      'Não invente requisito, certificação, experiência, licença ou habilidade que não esteja sustentada pelo título, descrição, requisitos ou skills fornecidos.',
      'Palavras genéricas de cargo como operador, auxiliar, assistente, analista, ajudante e técnico NÃO definem família ocupacional sozinhas e nunca devem aparecer isoladas em occupationKeywords.',
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
    return this.normalizeProvidedProfile(await this.generate(config, prompt, system));
  }
}
