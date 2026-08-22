import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { SettingsService } from '../admin/settings.service';
import { User } from '../users/entities/user.entity';

type AiProvider = 'GEMINI' | 'OPENAI' | 'ANTHROPIC';
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
    return ['GEMINI', 'OPENAI', 'ANTHROPIC'].includes(value as string);
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

  private parseJson(text: string): Record<string, unknown> {
    const cleaned = String(text || '{}').replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      throw new Error('O provedor retornou uma proposta fora do formato JSON.');
    }
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
      'Você é um especialista em currículo e recrutamento. Sua função é PROPOR melhorias de redação e organização sem jamais inventar fatos. Você pode tornar a linguagem mais profissional, objetiva e compatível com buscas/ATS, mas toda competência, palavra-chave, responsabilidade, resultado, formação ou experiência precisa estar sustentada pelos dados fornecidos. Não crie números, resultados, tecnologias, ferramentas, cursos ou responsabilidades ausentes. O usuário escolherá individualmente quais alterações aceitar. Responda exclusivamente JSON válido.',
      behavior.tone ? `Tom configurado: ${behavior.tone}` : '',
      behavior.instructions ? `Instruções do administrador:\n${behavior.instructions}` : '',
      behavior.negativePrompt ? `Regras inegociáveis:\n${behavior.negativePrompt}` : '',
      memory ? `Contexto recuperado:\n${memory}` : '',
    ].filter(Boolean).join('\n\n');
  }

  private async generate(config: RuntimeConfig, prompt: string, system: string) {
    if (config.provider === 'OPENAI') {
      const openai = new OpenAI({ apiKey: config.apiKey });
      const response = await openai.responses.create({
        model: config.model,
        instructions: system,
        input: prompt,
        max_output_tokens: 5000,
      });
      return this.parseJson(response.output_text || '{}');
    }
    if (config.provider === 'ANTHROPIC') {
      const anthropic = new Anthropic({ apiKey: config.apiKey });
      const response = await anthropic.messages.create({
        model: config.model,
        system,
        max_tokens: 5000,
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
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 5000 },
        }),
      },
    );
    const raw = await response.text();
    if (!response.ok) throw new Error(`Google Gemini respondeu HTTP ${response.status}${raw ? `: ${raw.slice(0, 400)}` : ''}`);
    const data = JSON.parse(raw || '{}') as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = (data.candidates || []).flatMap((candidate) => candidate.content?.parts || []).map((part) => part.text || '').filter(Boolean).join('\n');
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
    const prompt = `Analise o currículo estruturado abaixo e proponha mudanças atômicas, para que o usuário possa aceitar uma por uma. Priorize clareza, objetividade, força do resumo, descrição profissional das experiências e palavras-chave relevantes que JÁ estejam sustentadas pelo conteúdo. Não invente nada.\n\nCURRÍCULO: ${JSON.stringify(input).slice(0, 42000)}\n\nRetorne EXCLUSIVAMENTE este JSON:\n{"summary":"resumo curto do que pode melhorar","changes":[{"id":"bio-1","type":"BIO|HEADLINE|GLOBAL_SKILLS|EXPERIENCE_DESCRIPTION|STAGE_DESCRIPTION","label":"nome amigável da mudança","experienceIndex":0,"stageIndex":0,"before":"texto atual ou array atual","after":"texto sugerido ou array sugerido","reason":"por que esta mudança ajuda"}]}\n\nRegras de alvo:\n- BIO não usa experienceIndex/stageIndex;\n- HEADLINE não usa índices;\n- GLOBAL_SKILLS usa arrays em before/after;\n- EXPERIENCE_DESCRIPTION usa experienceIndex;\n- STAGE_DESCRIPTION usa experienceIndex e stageIndex;\n- preserve fatos, datas, empresas e cargos;\n- não crie métricas ou conquistas não informadas;\n- no máximo 24 mudanças.`;
    try {
      return this.normalize(await this.generate(config, prompt, system), profile);
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
