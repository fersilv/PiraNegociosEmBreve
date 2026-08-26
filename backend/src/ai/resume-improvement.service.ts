import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';
import { GroqCompat as Groq } from './groq-anthropic-compat';
import { SettingsService } from '../admin/settings.service';
import { User } from '../users/entities/user.entity';

type AiProvider = 'GEMINI' | 'OPENAI' | 'GROQ';
type RuntimeConfig = { provider: AiProvider; model: string; apiKey: string };

type ImprovementChangeType =
  | 'BIO'
  | 'HEADLINE'
  | 'GLOBAL_SKILLS'
  | 'EXPERIENCE_DESCRIPTION'
  | 'STAGE_DESCRIPTION';

export interface ResumeImprovementChange {
  id: string;
  type: ImprovementChangeType;
  label: string;
  before: string | string[];
  after: string | string[];
  reason: string;
  experienceIndex?: number;
  stageIndex?: number;
}

export interface ResumeImprovementProposal {
  summary: string;
  changes: ResumeImprovementChange[];
  createdAt: string;
}

@Injectable()
export class ResumeImprovementService {
  constructor(private readonly settingsService: SettingsService) {}

  private isProvider(value: unknown): value is AiProvider {
    return ['GEMINI', 'OPENAI', 'GROQ'].includes(value as string);
  }

  private async config(): Promise<RuntimeConfig> {
    const enabled = (await this.settingsService.getValue('AI_ENABLED', 'false')) === 'true';
    const provider = await this.settingsService.getValue('AI_PROVIDER');
    const model = await this.settingsService.getValue('AI_MODEL');
    if (!enabled || !this.isProvider(provider) || !model) {
      throw new ServiceUnavailableException('Os recursos de inteligência artificial estão desabilitados no momento.');
    }
    const apiKey = ((await this.settingsService.getValue(`${provider}_API_KEY`)) || process.env[`${provider}_API_KEY`] || '').trim();
    if (!apiKey) throw new ServiceUnavailableException('O provedor de inteligência artificial ativo não possui uma chave configurada.');
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
    let candidate = this.extractJsonObject(withoutFences).trim();
    candidate = this.normalizeJsonControls(candidate);

    let lastError: unknown = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return JSON.parse(candidate) as Record<string, unknown>;
      } catch (error) {
        lastError = error;
        const withoutTrailingCommas = this.removeTrailingJsonCommas(candidate);
        if (withoutTrailingCommas !== candidate) {
          candidate = withoutTrailingCommas;
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
    throw new Error(`O provedor retornou uma proposta em JSON inválido e ela não pôde ser recuperada (${detail}).`);
  }

  private async systemInstruction(profile: unknown) {
    const [behavior, memory] = await Promise.all([
      this.settingsService.getAiBehavior(),
      this.settingsService.findRelevantAiBrain(
        `currículo otimização profissional palavras-chave ATS resumo experiência clareza ${JSON.stringify(profile || {}).slice(0, 3500)}`,
        5,
        3500,
      ),
    ]);
    return [
      'Você é um especialista em currículo e recrutamento. Sua função é PROPOR melhorias de redação e organização sem jamais inventar fatos. Você pode tornar a linguagem mais profissional, objetiva e compatível com buscas/ATS, mas toda competência, palavra-chave, responsabilidade, resultado, formação ou experiência precisa estar sustentada pelos dados fornecidos. Não crie números, resultados, tecnologias, ferramentas, cursos ou responsabilidades ausentes. O usuário escolherá individualmente quais alterações aceitar. Responda exclusivamente JSON válido. Não use Markdown, comentários, trailing commas nem texto fora do objeto JSON. Garanta vírgula entre todos os elementos de arrays e propriedades de objetos.',
      behavior.tone ? `Tom configurado: ${behavior.tone}` : '',
      behavior.instructions ? `Instruções do administrador:\n${behavior.instructions}` : '',
      behavior.negativePrompt ? `Regras inegociáveis:\n${behavior.negativePrompt}` : '',
      memory ? `Contexto recuperado:\n${memory}` : '',
    ].filter(Boolean).join('\n\n');
  }

  private async generate(config: RuntimeConfig, prompt: string, system: string) {
    if (config.provider === 'OPENAI') {
      const openai = new OpenAI({ apiKey: config.apiKey });
      const response: any = await openai.responses.create({
        model: config.model,
        instructions: system,
        input: prompt,
        max_output_tokens: 8000,
      });
      if (response?.status === 'incomplete') {
        throw new Error(`AI_JSON_TRUNCATED:${response?.incomplete_details?.reason || 'incomplete'}`);
      }
      return this.parseJson(response.output_text || '{}');
    }
    if (config.provider === 'GROQ') {
      const anthropic = new Groq({ apiKey: config.apiKey });
      const response: any = await anthropic.messages.create({
        model: config.model,
        system,
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      });
      if (response?.stop_reason === 'max_tokens') throw new Error('AI_JSON_TRUNCATED:max_tokens');
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
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8000 },
        }),
      },
    );
    const raw = await response.text();
    if (!response.ok) throw new Error(`Google Gemini respondeu HTTP ${response.status}${raw ? `: ${raw.slice(0, 400)}` : ''}`);
    const data = JSON.parse(raw || '{}') as {
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
    };
    const candidate = data.candidates?.[0];
    if (String(candidate?.finishReason || '').toUpperCase() === 'MAX_TOKENS') {
      throw new Error('AI_JSON_TRUNCATED:MAX_TOKENS');
    }
    const text = (data.candidates || []).flatMap((item) => item.content?.parts || []).map((part) => part.text || '').filter(Boolean).join('\n');
    return this.parseJson(text || '{}');
  }

  private cleanText(value: unknown, max = 4000) {
    return String(value || '').trim().slice(0, max);
  }

  private cleanSkills(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 24);
  }

  private normalize(raw: Record<string, unknown>, profile: User): ResumeImprovementProposal {
    const validTypes = new Set<ImprovementChangeType>([
      'BIO', 'HEADLINE', 'GLOBAL_SKILLS', 'EXPERIENCE_DESCRIPTION', 'STAGE_DESCRIPTION',
    ]);
    const experiences = Array.isArray(profile.experiences) ? profile.experiences : [];
    const changes: ResumeImprovementChange[] = [];
    const inputChanges = Array.isArray(raw.changes) ? raw.changes : [];

    inputChanges.slice(0, 24).forEach((item: any, index) => {
      const type = String(item?.type || '') as ImprovementChangeType;
      if (!validTypes.has(type)) return;
      const experienceIndex = Number.isInteger(Number(item?.experienceIndex)) ? Number(item.experienceIndex) : undefined;
      const stageIndex = Number.isInteger(Number(item?.stageIndex)) ? Number(item.stageIndex) : undefined;
      if ((type === 'EXPERIENCE_DESCRIPTION' || type === 'STAGE_DESCRIPTION') && (experienceIndex === undefined || experienceIndex < 0 || experienceIndex >= experiences.length)) return;
      if (type === 'STAGE_DESCRIPTION') {
        const timeline = Array.isArray((experiences[experienceIndex!] as any)?.timeline) ? (experiences[experienceIndex!] as any).timeline : [];
        if (stageIndex === undefined || stageIndex < 0 || stageIndex >= timeline.length) return;
      }

      const before = type === 'GLOBAL_SKILLS' ? this.cleanSkills(item?.before) : this.cleanText(item?.before);
      const after = type === 'GLOBAL_SKILLS' ? this.cleanSkills(item?.after) : this.cleanText(item?.after);
      if (JSON.stringify(before) === JSON.stringify(after)) return;
      if ((Array.isArray(after) && after.length === 0) || (!Array.isArray(after) && !after)) return;
      changes.push({
        id: this.cleanText(item?.id, 80) || `change-${index + 1}`,
        type,
        label: this.cleanText(item?.label, 160) || 'Melhoria sugerida',
        before,
        after,
        reason: this.cleanText(item?.reason, 600),
        ...(experienceIndex !== undefined ? { experienceIndex } : {}),
        ...(stageIndex !== undefined ? { stageIndex } : {}),
      });
    });

    return {
      summary: this.cleanText(raw.summary, 1200),
      changes,
      createdAt: new Date().toISOString(),
    };
  }

  private profileForPrompt(profile: User) {
    return {
      bio: profile.bio || '',
      skills: Array.isArray(profile.skills) ? profile.skills : [],
      resumePreferences: profile.resumePreferences || {},
      experiences: (Array.isArray(profile.experiences) ? profile.experiences : []).map((experience: any, experienceIndex) => ({
        experienceIndex,
        company: experience?.company || '',
        role: experience?.role || '',
        description: experience?.description || '',
        skills: Array.isArray(experience?.skills) ? experience.skills : [],
        timeline: (Array.isArray(experience?.timeline) ? experience.timeline : []).map((stage: any, stageIndex: number) => ({
          stageIndex,
          role: stage?.role || '',
          startDate: stage?.startDate || '',
          endDate: stage?.endDate || '',
          description: stage?.description || '',
          skills: Array.isArray(stage?.skills) ? stage.skills : [],
        })),
      })),
      education: profile.education || [],
      courses: profile.courses || [],
      languages: profile.languages || [],
    };
  }

  async propose(profile: User): Promise<ResumeImprovementProposal> {
    const config = await this.config();
    const input = this.profileForPrompt(profile);
    const system = await this.systemInstruction(input);
    const prompt = `Analise o currículo estruturado abaixo e proponha mudanças atômicas, para que o usuário possa aceitar uma por uma. Priorize clareza, objetividade, força do resumo, descrição profissional das experiências e palavras-chave relevantes que JÁ estejam sustentadas pelo conteúdo. Não invente nada.\n\nCURRÍCULO: ${JSON.stringify(input).slice(0, 42000)}\n\nRetorne EXCLUSIVAMENTE este JSON:\n{"summary":"resumo curto do que pode melhorar","changes":[{"id":"bio-1","type":"BIO|HEADLINE|GLOBAL_SKILLS|EXPERIENCE_DESCRIPTION|STAGE_DESCRIPTION","label":"nome amigável da mudança","experienceIndex":0,"stageIndex":0,"before":"texto atual ou array atual","after":"texto sugerido ou array sugerido","reason":"por que esta mudança ajuda"}]}\n\nRegras de alvo:\n- BIO não usa experienceIndex/stageIndex;\n- HEADLINE não usa índices;\n- GLOBAL_SKILLS usa arrays em before/after;\n- EXPERIENCE_DESCRIPTION usa experienceIndex;\n- STAGE_DESCRIPTION usa experienceIndex e stageIndex;\n- preserve fatos, datas, empresas e cargos;\n- não crie métricas ou conquistas não informadas;\n- no máximo 24 mudanças;\n- JSON estritamente válido, sem Markdown e sem texto antes ou depois do objeto.`;
    try {
      let generated: Record<string, unknown>;
      try {
        generated = await this.generate(config, prompt, system);
      } catch (firstError) {
        const firstMessage = firstError instanceof Error ? firstError.message : String(firstError || '');
        const retryable = firstMessage.includes('AI_JSON_TRUNCATED')
          || firstMessage.includes('JSON inválido')
          || firstMessage.includes('Unterminated string')
          || firstMessage.includes('Expected');
        if (!retryable) throw firstError;
        generated = await this.generate(
          config,
          `${prompt}\n\nIMPORTANTE: gere uma resposta mais compacta. Se necessário, reduza a quantidade de mudanças para concluir integralmente o JSON.`,
          `${system}\n\nA tentativa anterior veio truncada ou com JSON inválido. Gere novamente do zero e finalize obrigatoriamente todo o objeto JSON.`,
        );
      }
      return this.normalize(generated, profile);
    } catch (error: any) {
      if (error instanceof ServiceUnavailableException) throw error;
      console.error('AI resume improvement error:', error);
      throw new InternalServerErrorException(error?.message || 'Não foi possível gerar as melhorias do currículo agora.');
    }
  }

  applySelected(profile: User, proposal: ResumeImprovementProposal, selectedIds: string[]) {
    const selected = new Set(selectedIds);
    let bio = profile.bio || '';
    let skills = Array.isArray(profile.skills) ? [...profile.skills] : [];
    let resumePreferences: Record<string, unknown> = { ...(profile.resumePreferences || {}) };
    const experiences: any[] = JSON.parse(JSON.stringify(Array.isArray(profile.experiences) ? profile.experiences : []));

    for (const change of proposal.changes || []) {
      if (!selected.has(change.id)) continue;
      if (change.type === 'BIO' && typeof change.after === 'string') bio = change.after;
      if (change.type === 'HEADLINE' && typeof change.after === 'string') {
        resumePreferences = { ...resumePreferences, headline: change.after, showHeadline: true };
      }
      if (change.type === 'GLOBAL_SKILLS' && Array.isArray(change.after)) skills = this.cleanSkills(change.after);
      if (change.type === 'EXPERIENCE_DESCRIPTION' && typeof change.after === 'string' && change.experienceIndex !== undefined && experiences[change.experienceIndex]) {
        experiences[change.experienceIndex].description = change.after;
      }
      if (change.type === 'STAGE_DESCRIPTION' && typeof change.after === 'string' && change.experienceIndex !== undefined && change.stageIndex !== undefined) {
        const timeline = experiences[change.experienceIndex]?.timeline;
        if (Array.isArray(timeline) && timeline[change.stageIndex]) timeline[change.stageIndex].description = change.after;
      }
    }

    return { bio, skills, resumePreferences, experiences };
  }
}
