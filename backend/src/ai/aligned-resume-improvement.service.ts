import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';
import { GroqCompat as Groq } from './groq-anthropic-compat';
import { SettingsService } from '../admin/settings.service';
import { User } from '../users/entities/user.entity';
import {
  ResumeReviewService,
  type ResumeReviewResult,
} from './resume-review.service';
import type {
  ResumeImprovementChange,
  ResumeImprovementProposal,
} from './resume-improvement.service';

type AiProvider = 'GEMINI' | 'OPENAI' | 'GROQ';
type RuntimeConfig = { provider: AiProvider; model: string; apiKey: string };

type ImprovementChangeType =
  | 'BIO'
  | 'HEADLINE'
  | 'GLOBAL_SKILLS'
  | 'EXPERIENCE_DESCRIPTION'
  | 'STAGE_DESCRIPTION';

type QualificationTarget = {
  id: string;
  text: string;
};

type NeedUserInput = {
  targetId: string;
  suggestion: string;
  reason: string;
};

type AlignedImprovementChange = ResumeImprovementChange & {
  targetIds: string[];
};

export type AlignedResumeImprovementProposal = ResumeImprovementProposal & {
  baselineAnalysis: ResumeReviewResult;
  qualificationTargets: QualificationTarget[];
  needsUserInput: NeedUserInput[];
  changes: AlignedImprovementChange[];
};

@Injectable()
export class AlignedResumeImprovementService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly resumeReviewService: ResumeReviewService,
  ) {}

  private isProvider(value: unknown): value is AiProvider {
    return ['GEMINI', 'OPENAI', 'GROQ'].includes(value as string);
  }

  private async config(): Promise<RuntimeConfig> {
    const enabled = (await this.settingsService.getValue('AI_ENABLED', 'false')) === 'true';
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
    if (
      /Expected ',' or '[}\]]' after/i.test(message) ||
      /Expected ',' or '}' after property value/i.test(message)
    ) {
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
    let candidate = this.normalizeJsonControls(
      this.extractJsonObject(withoutFences).trim(),
    );
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return JSON.parse(candidate) as Record<string, unknown>;
      } catch (error) {
        lastError = error;
        const withoutTrailing = this.removeTrailingJsonCommas(candidate);
        if (withoutTrailing !== candidate) {
          candidate = withoutTrailing;
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
    throw new Error(
      `O provedor retornou uma proposta em JSON inválido e ela não pôde ser recuperada (${detail}).`,
    );
  }

  private async systemInstruction(input: unknown, baseline: ResumeReviewResult) {
    const [behavior, memory] = await Promise.all([
      this.settingsService.getAiBehavior(),
      this.settingsService.findRelevantAiBrain(
        `currículo otimização profissional qualificação ATS resumo experiência clareza ${JSON.stringify({ input, baseline }).slice(0, 3500)}`,
        5,
        3500,
      ),
    ]);
    return [
      'Você é um especialista em currículo e recrutamento. A QUALIFICAÇÃO fornecida é o contrato de trabalho da melhoria. Você não deve ignorar as sugestões dela nem inventar um diagnóstico paralelo.',
      'Para cada alvo T1, T2, T3... da qualificação, faça exatamente uma destas duas coisas: (1) proponha uma ou mais alterações concretas que o atendam, marcando targetIds; ou (2) coloque o alvo em needsUserInput somente quando a correção depender de um fato que não existe nos dados fornecidos. Todo alvo precisa ficar coberto por uma dessas rotas.',
      'Não use needsUserInput como desculpa para problemas de redação, clareza, organização, resumo, palavras-chave sustentadas, descrições de experiências ou organização de habilidades. Esses problemas devem gerar mudanças aplicáveis pela IA.',
      'Nunca invente fatos. Toda competência, palavra-chave, responsabilidade, resultado, formação, ferramenta ou experiência precisa estar sustentada pelos dados fornecidos. Não crie números ou conquistas ausentes.',
      'O objetivo é melhorar as dimensões mais fracas do breakdown da qualificação, sem maquiar a nota. O usuário escolherá individualmente quais alterações aceitar.',
      'Responda exclusivamente JSON válido, sem Markdown, comentários, trailing commas nem texto fora do objeto.',
      behavior.tone ? `Tom configurado: ${behavior.tone}` : '',
      behavior.instructions ? `Instruções do administrador:\n${behavior.instructions}` : '',
      behavior.negativePrompt ? `Regras inegociáveis:\n${behavior.negativePrompt}` : '',
      memory ? `Contexto recuperado:\n${memory}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private async generateRaw(
    config: RuntimeConfig,
    prompt: string,
    system: string,
    maxTokens: number,
  ) {
    if (config.provider === 'OPENAI') {
      const openai = new OpenAI({ apiKey: config.apiKey });
      const response: any = await openai.responses.create({
        model: config.model,
        instructions: system,
        input: prompt,
        max_output_tokens: maxTokens,
      });
      if (response?.status === 'incomplete') {
        throw new Error(
          `AI_JSON_TRUNCATED:${response?.incomplete_details?.reason || 'incomplete'}`,
        );
      }
      return String(response?.output_text || '{}');
    }

    if (config.provider === 'GROQ') {
      const anthropic = new Groq({ apiKey: config.apiKey });
      const response: any = await anthropic.messages.create({
        model: config.model,
        system,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });
      if (response?.stop_reason === 'max_tokens') {
        throw new Error('AI_JSON_TRUNCATED:max_tokens');
      }
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
          systemInstruction: { parts: [{ text: system }] },
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

  private cleanText(value: unknown, max = 4000) {
    return String(value || '').trim().slice(0, max);
  }

  private cleanSkills(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return Array.from(
      new Set(value.map((item) => String(item || '').trim()).filter(Boolean)),
    ).slice(0, 24);
  }

  private targetIds(value: unknown, allowed: Set<string>) {
    if (!Array.isArray(value)) return [];
    return Array.from(
      new Set(
        value
          .map((item) => String(item || '').trim())
          .filter((item) => allowed.has(item)),
      ),
    );
  }

  private buildTargets(baseline: ResumeReviewResult): QualificationTarget[] {
    const suggestions = Array.isArray(baseline.suggestions)
      ? baseline.suggestions.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    return suggestions.slice(0, 8).map((text, index) => ({
      id: `T${index + 1}`,
      text,
    }));
  }

  private normalize(
    raw: Record<string, unknown>,
    profile: User,
    baseline: ResumeReviewResult,
    targets: QualificationTarget[],
  ): AlignedResumeImprovementProposal {
    const validTypes = new Set<ImprovementChangeType>([
      'BIO',
      'HEADLINE',
      'GLOBAL_SKILLS',
      'EXPERIENCE_DESCRIPTION',
      'STAGE_DESCRIPTION',
    ]);
    const allowedTargetIds = new Set(targets.map((target) => target.id));
    const experiences = Array.isArray(profile.experiences) ? profile.experiences : [];
    const changes: AlignedImprovementChange[] = [];
    const inputChanges = Array.isArray(raw.changes) ? raw.changes : [];

    inputChanges.slice(0, 24).forEach((item: any, index) => {
      const type = String(item?.type || '') as ImprovementChangeType;
      if (!validTypes.has(type)) return;
      const experienceIndex = Number.isInteger(Number(item?.experienceIndex))
        ? Number(item.experienceIndex)
        : undefined;
      const stageIndex = Number.isInteger(Number(item?.stageIndex))
        ? Number(item.stageIndex)
        : undefined;
      if (
        (type === 'EXPERIENCE_DESCRIPTION' || type === 'STAGE_DESCRIPTION') &&
        (experienceIndex === undefined ||
          experienceIndex < 0 ||
          experienceIndex >= experiences.length)
      ) {
        return;
      }
      if (type === 'STAGE_DESCRIPTION') {
        const timeline = Array.isArray((experiences[experienceIndex!] as any)?.timeline)
          ? (experiences[experienceIndex!] as any).timeline
          : [];
        if (stageIndex === undefined || stageIndex < 0 || stageIndex >= timeline.length) {
          return;
        }
      }

      const before =
        type === 'GLOBAL_SKILLS'
          ? this.cleanSkills(item?.before)
          : this.cleanText(item?.before);
      const after =
        type === 'GLOBAL_SKILLS'
          ? this.cleanSkills(item?.after)
          : this.cleanText(item?.after);
      if (JSON.stringify(before) === JSON.stringify(after)) return;
      if ((Array.isArray(after) && after.length === 0) || (!Array.isArray(after) && !after)) {
        return;
      }
      const changeTargetIds = this.targetIds(item?.targetIds, allowedTargetIds);
      changes.push({
        id: this.cleanText(item?.id, 80) || `change-${index + 1}`,
        type,
        label: this.cleanText(item?.label, 160) || 'Melhoria sugerida',
        before,
        after,
        reason: this.cleanText(item?.reason, 600),
        targetIds: changeTargetIds,
        ...(experienceIndex !== undefined ? { experienceIndex } : {}),
        ...(stageIndex !== undefined ? { stageIndex } : {}),
      });
    });

    const needsUserInput: NeedUserInput[] = [];
    const rawNeeds = Array.isArray(raw.needsUserInput) ? raw.needsUserInput : [];
    for (const item of rawNeeds.slice(0, targets.length)) {
      const targetId = this.cleanText((item as any)?.targetId, 20);
      if (!allowedTargetIds.has(targetId)) continue;
      if (needsUserInput.some((entry) => entry.targetId === targetId)) continue;
      const target = targets.find((entry) => entry.id === targetId);
      needsUserInput.push({
        targetId,
        suggestion: target?.text || this.cleanText((item as any)?.suggestion, 600),
        reason:
          this.cleanText((item as any)?.reason, 700) ||
          'Esta melhoria depende de informação factual que não está cadastrada no currículo.',
      });
    }

    const covered = new Set<string>();
    changes.forEach((change) => change.targetIds.forEach((id) => covered.add(id)));
    needsUserInput.forEach((item) => covered.add(item.targetId));
    const uncovered = targets.filter((target) => !covered.has(target.id));
    if (uncovered.length > 0) {
      throw new Error(
        `AI_IMPROVEMENT_TARGETS_UNCOVERED:${uncovered.map((item) => item.id).join(',')}`,
      );
    }

    return {
      summary: this.cleanText(raw.summary, 1200),
      changes,
      baselineAnalysis: baseline,
      qualificationTargets: targets,
      needsUserInput,
      createdAt: new Date().toISOString(),
    };
  }

  private profileForPrompt(profile: User) {
    return {
      bio: profile.bio || '',
      skills: Array.isArray(profile.skills) ? profile.skills : [],
      resumePreferences: profile.resumePreferences || {},
      experiences: (Array.isArray(profile.experiences) ? profile.experiences : []).map(
        (experience: any, experienceIndex) => ({
          experienceIndex,
          company: experience?.company || '',
          role: experience?.role || '',
          description: experience?.description || '',
          skills: Array.isArray(experience?.skills) ? experience.skills : [],
          timeline: (Array.isArray(experience?.timeline) ? experience.timeline : []).map(
            (stage: any, stageIndex: number) => ({
              stageIndex,
              role: stage?.role || '',
              startDate: stage?.startDate || '',
              endDate: stage?.endDate || '',
              description: stage?.description || '',
              skills: Array.isArray(stage?.skills) ? stage.skills : [],
            }),
          ),
        }),
      ),
      education: profile.education || [],
      courses: profile.courses || [],
      languages: profile.languages || [],
    };
  }

  private makePrompt(
    input: ReturnType<AlignedResumeImprovementService['profileForPrompt']>,
    baseline: ResumeReviewResult,
    targets: QualificationTarget[],
    retryNote = '',
  ) {
    const targetText = targets.length
      ? targets.map((target) => `${target.id}: ${target.text}`).join('\n')
      : 'Nenhum alvo textual específico. Priorize as dimensões mais fracas do breakdown.';
    return `Você vai melhorar o currículo a partir da MESMA qualificação usada pelo produto de análise.\n\nCURRÍCULO ESTRUTURADO:\n${JSON.stringify(input)}\n\nQUALIFICAÇÃO BASE:\n${JSON.stringify({
      score: baseline.score,
      breakdown: baseline.breakdown,
      strengths: baseline.strengths,
      suggestions: baseline.suggestions,
      feedbackText: baseline.feedbackText,
      missingSections: baseline.missingSections,
    })}\n\nALVOS OBRIGATÓRIOS DA QUALIFICAÇÃO:\n${targetText}\n\nRetorne EXCLUSIVAMENTE este JSON:\n{"summary":"como a proposta responde à qualificação","changes":[{"id":"bio-1","type":"BIO|HEADLINE|GLOBAL_SKILLS|EXPERIENCE_DESCRIPTION|STAGE_DESCRIPTION","targetIds":["T1"],"label":"nome amigável","experienceIndex":0,"stageIndex":0,"before":"texto atual ou array atual","after":"texto sugerido ou array sugerido","reason":"qual alvo da qualificação esta mudança resolve e por quê"}],"needsUserInput":[{"targetId":"T2","suggestion":"texto do alvo","reason":"qual informação factual falta para que isso possa ser melhorado sem inventar"}]}\n\nREGRAS OBRIGATÓRIAS:\n- cada T# deve aparecer em targetIds de ao menos uma mudança OU em needsUserInput;\n- um alvo de redação, clareza, resumo, descrição, organização ou palavras-chave sustentadas deve gerar mudança, não needsUserInput;\n- needsUserInput é somente para fato ausente que a IA não pode criar com segurança;\n- preserve fatos, datas, empresas e cargos;\n- não crie métricas, resultados, cursos, ferramentas ou responsabilidades não informadas;\n- GLOBAL_SKILLS só pode reorganizar/adicionar skills sustentadas pela trajetória já fornecida;\n- no máximo 24 mudanças;\n- use prioritariamente os critérios mais fracos do breakdown;\n- JSON estritamente válido e completo.${retryNote ? `\n\n${retryNote}` : ''}`;
  }

  async propose(profile: User): Promise<AlignedResumeImprovementProposal> {
    const config = await this.config();
    const input = this.profileForPrompt(profile);

    // O produto de melhoria inclui uma qualificação interna. Ela não consome
    // crédito de reanálise porque o controller cobra apenas RESUME_AI_IMPROVEMENT.
    const baseline = await this.resumeReviewService.review(profile);
    const targets = this.buildTargets(baseline);
    const system = await this.systemInstruction(input, baseline);

    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const retryNote = attempt === 0
          ? ''
          : 'A tentativa anterior deixou algum alvo da qualificação sem cobertura ou produziu JSON inválido. Gere novamente do zero e confira T1, T2, T3... um por um antes de finalizar.';
        const raw = await this.generateRaw(
          config,
          this.makePrompt(input, baseline, targets, retryNote),
          system,
          attempt === 0 ? 8000 : 10000,
        );
        return this.normalize(this.parseJson(raw || '{}'), profile, baseline, targets);
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error || '');
        const retryable =
          message.includes('AI_JSON_TRUNCATED') ||
          message.includes('JSON inválido') ||
          message.includes('Unterminated string') ||
          message.includes('Expected') ||
          message.includes('AI_IMPROVEMENT_TARGETS_UNCOVERED');
        if (!retryable || attempt === 1) throw error;
      }
    }
    throw lastError;
  }

  applySelected(
    profile: User,
    proposal: ResumeImprovementProposal,
    selectedIds: string[],
  ) {
    const selected = new Set(selectedIds);
    let bio = profile.bio || '';
    let skills = Array.isArray(profile.skills) ? [...profile.skills] : [];
    let resumePreferences: Record<string, unknown> = {
      ...(profile.resumePreferences || {}),
    };
    const experiences: any[] = JSON.parse(
      JSON.stringify(Array.isArray(profile.experiences) ? profile.experiences : []),
    );

    for (const change of proposal.changes || []) {
      if (!selected.has(change.id)) continue;
      if (change.type === 'BIO' && typeof change.after === 'string') {
        bio = change.after;
      }
      if (change.type === 'HEADLINE' && typeof change.after === 'string') {
        resumePreferences = {
          ...resumePreferences,
          headline: change.after,
          showHeadline: true,
        };
      }
      if (change.type === 'GLOBAL_SKILLS' && Array.isArray(change.after)) {
        skills = this.cleanSkills(change.after);
      }
      if (
        change.type === 'EXPERIENCE_DESCRIPTION' &&
        typeof change.after === 'string' &&
        change.experienceIndex !== undefined &&
        experiences[change.experienceIndex]
      ) {
        experiences[change.experienceIndex].description = change.after;
      }
      if (
        change.type === 'STAGE_DESCRIPTION' &&
        typeof change.after === 'string' &&
        change.experienceIndex !== undefined &&
        change.stageIndex !== undefined
      ) {
        const timeline = experiences[change.experienceIndex]?.timeline;
        if (Array.isArray(timeline) && timeline[change.stageIndex]) {
          timeline[change.stageIndex].description = change.after;
        }
      }
    }

    return { bio, skills, resumePreferences, experiences };
  }
}
