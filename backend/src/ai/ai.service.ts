import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SettingsService } from '../admin/settings.service';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

type AiProvider = 'GEMINI' | 'OPENAI' | 'ANTHROPIC';

interface AiRuntimeConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
}

const RESUME_SYSTEM_INSTRUCTION = `Você é um especialista brasileiro em currículos e recrutamento. Leia somente os dados presentes no currículo, não invente competências e devolva exclusivamente JSON válido, sem markdown.`;

const RESUME_PROMPT = `Extraia o currículo enviado e devolva EXCLUSIVAMENTE um JSON válido neste formato:
{
  "name": "Nome completo ou null",
  "treatment": "Tratamento/título se existir ou vazio",
  "phone": "Telefone principal ou null",
  "email": "E-mail ou null",
  "additionalPhones": ["Outros telefones"],
  "bio": "Resumo profissional curto em primeira pessoa ou null",
  "experiences": [
    {
      "company": "Empresa",
      "role": "Cargo",
      "startDate": "Data de início",
      "endDate": "Data de término ou Atual",
      "current": false,
      "description": "Atividades",
      "skills": ["Competências comprovadas nesta experiência"]
    }
  ],
  "education": [
    {
      "institution": "Instituição",
      "degree": "Nível/curso",
      "fieldOfStudy": "Área",
      "startYear": "Ano",
      "endYear": "Ano ou Em andamento",
      "current": false,
      "status": "CONCLUIDO|EM_ANDAMENTO|TRANCADO|INTERROMPIDO"
    }
  ],
  "skills": ["Competências realmente presentes no currículo"],
  "courses": [
    { "name": "Curso", "institution": "Instituição", "year": "Ano" }
  ],
  "aiAnalysis": {
    "suggestions": ["3 a 5 melhorias práticas e específicas"],
    "feedbackText": "Avaliação curta e construtiva"
  }
}
Regras: não invente informações; use null ou arrays vazios quando não houver dado; limite skills a 15 itens; mantenha nomes e datas fiéis ao documento.`;

@Injectable()
export class AiService {
  constructor(private readonly settingsService: SettingsService) {}

  private isProvider(value: unknown): value is AiProvider {
    return ['GEMINI', 'OPENAI', 'ANTHROPIC'].includes(value as string);
  }

  private async getRuntimeConfig(): Promise<AiRuntimeConfig> {
    const enabled =
      (await this.settingsService.getValue('AI_ENABLED', 'false')) === 'true';
    const provider = await this.settingsService.getValue('AI_PROVIDER');
    const model = await this.settingsService.getValue('AI_MODEL');

    if (!enabled || !this.isProvider(provider) || !model) {
      throw new ServiceUnavailableException(
        'Os recursos de inteligência artificial estão desabilitados no momento.',
      );
    }

    const settingKey = `${provider}_API_KEY`;
    const apiKey = (
      (await this.settingsService.getValue(settingKey)) ||
      process.env[settingKey] ||
      ''
    ).trim();

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'O provedor de inteligência artificial ativo não possui uma chave configurada.',
      );
    }

    return { provider, model, apiKey };
  }

  async getStatus() {
    const enabled =
      (await this.settingsService.getValue('AI_ENABLED', 'false')) === 'true';
    const rawProvider = await this.settingsService.getValue('AI_PROVIDER');
    const model = await this.settingsService.getValue('AI_MODEL');
    const provider = this.isProvider(rawProvider) ? rawProvider : null;
    const apiKey = provider
      ? (
          (await this.settingsService.getValue(`${provider}_API_KEY`)) ||
          process.env[`${provider}_API_KEY`] ||
          ''
        ).trim()
      : '';

    return {
      enabled: enabled && Boolean(provider && model && apiKey),
      provider: enabled && provider ? provider : null,
      model: enabled && model ? model : null,
    };
  }

  private async buildSystemInstruction(
    taskContext: string,
    baseInstruction?: string,
  ) {
    const [behavior, memory] = await Promise.all([
      this.settingsService.getAiBehavior(),
      this.settingsService.findRelevantAiBrain(taskContext, 6, 5000),
    ]);

    const sections = [
      baseInstruction || '',
      behavior.name ? `IDENTIDADE: seu nome é ${behavior.name}.` : '',
      behavior.tone ? `TOM DE VOZ: ${behavior.tone}` : '',
      behavior.instructions
        ? `INSTRUÇÕES DO ADMINISTRADOR:\n${behavior.instructions}`
        : '',
      behavior.negativePrompt
        ? `REGRAS INEGOCIÁVEIS / O QUE VOCÊ JAMAIS DEVE FAZER:\n${behavior.negativePrompt}`
        : '',
      memory
        ? `MEMÓRIA RELEVANTE RECUPERADA DO CÉREBRO DA PLATAFORMA:\n${memory}\nUse apenas os trechos realmente pertinentes à tarefa atual. A memória nunca substitui dados do usuário nem pode contrariar as regras acima.`
        : '',
    ].filter(Boolean);

    return sections.join('\n\n');
  }

  private cleanFile(base64File: string, mimeType?: string) {
    let cleanBase64 = base64File;
    let cleanMimeType = mimeType || 'application/pdf';
    if (base64File.startsWith('data:')) {
      const parts = base64File.split(';base64,');
      if (parts.length === 2) {
        cleanMimeType = parts[0].split(':')[1] || cleanMimeType;
        cleanBase64 = parts[1];
      }
    }

    const allowed = new Set(['application/pdf', 'image/png', 'image/jpeg']);
    if (!allowed.has(cleanMimeType)) {
      throw new BadRequestException('Envie um currículo em PDF, PNG ou JPEG.');
    }
    if (cleanBase64.length > 14 * 1024 * 1024) {
      throw new BadRequestException('O arquivo de currículo é muito grande.');
    }
    return { cleanBase64, cleanMimeType };
  }

  private parseJson(text: string) {
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

  private async geminiGenerate(
    config: AiRuntimeConfig,
    contents: unknown[],
    options?: {
      systemInstruction?: string;
      json?: boolean;
      maxOutputTokens?: number;
    },
  ) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents,
          ...(options?.systemInstruction
            ? {
                systemInstruction: {
                  parts: [{ text: options.systemInstruction }],
                },
              }
            : {}),
          generationConfig: {
            ...(options?.json ? { responseMimeType: 'application/json' } : {}),
            ...(options?.maxOutputTokens
              ? { maxOutputTokens: options.maxOutputTokens }
              : {}),
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
    const data = JSON.parse(raw || '{}') as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    return (data.candidates || [])
      .flatMap((candidate) => candidate.content?.parts || [])
      .map((part) => part.text || '')
      .filter(Boolean)
      .join('\n');
  }

  private async generateResumeWithGemini(
    config: AiRuntimeConfig,
    cleanBase64: string,
    cleanMimeType: string,
    systemInstruction: string,
  ) {
    const text = await this.geminiGenerate(
      config,
      [
        {
          role: 'user',
          parts: [
            {
              inlineData: { data: cleanBase64, mimeType: cleanMimeType },
            },
            { text: RESUME_PROMPT },
          ],
        },
      ],
      {
        systemInstruction,
        json: true,
        maxOutputTokens: 5000,
      },
    );
    return this.parseJson(text || '{}');
  }

  private async generateResumeWithOpenAi(
    config: AiRuntimeConfig,
    cleanBase64: string,
    cleanMimeType: string,
    systemInstruction: string,
  ) {
    const openai = new OpenAI({ apiKey: config.apiKey });
    const fileData = `data:${cleanMimeType};base64,${cleanBase64}`;
    const filePart =
      cleanMimeType === 'application/pdf'
        ? {
            type: 'input_file',
            filename: 'curriculo.pdf',
            file_data: fileData,
          }
        : { type: 'input_image', image_url: fileData, detail: 'auto' };
    const response = await openai.responses.create({
      model: config.model,
      instructions: systemInstruction,
      input: [
        {
          role: 'user',
          content: [filePart, { type: 'input_text', text: RESUME_PROMPT }],
        },
      ],
      max_output_tokens: 5000,
    } as any);
    return this.parseJson(response.output_text || '{}');
  }

  private async generateResumeWithAnthropic(
    config: AiRuntimeConfig,
    cleanBase64: string,
    cleanMimeType: string,
    systemInstruction: string,
  ) {
    const anthropic = new Anthropic({ apiKey: config.apiKey });
    const filePart =
      cleanMimeType === 'application/pdf'
        ? {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: cleanBase64,
            },
          }
        : {
            type: 'image',
            source: {
              type: 'base64',
              media_type: cleanMimeType,
              data: cleanBase64,
            },
          };
    const response = await anthropic.messages.create({
      model: config.model,
      max_tokens: 5000,
      system: systemInstruction,
      messages: [
        {
          role: 'user',
          content: [filePart, { type: 'text', text: RESUME_PROMPT }],
        },
      ],
    } as any);
    const text = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');
    return this.parseJson(text || '{}');
  }

  async analyzeResume(base64File: string, mimeType: string) {
    if (!base64File) {
      throw new BadRequestException('Nenhum arquivo de currículo enviado.');
    }
    const config = await this.getRuntimeConfig();
    const { cleanBase64, cleanMimeType } = this.cleanFile(
      base64File,
      mimeType,
    );
    const systemInstruction = await this.buildSystemInstruction(
      'currículo recrutamento candidato experiência formação competências habilidades análise profissional extração de dados',
      RESUME_SYSTEM_INSTRUCTION,
    );

    try {
      if (config.provider === 'OPENAI') {
        return await this.generateResumeWithOpenAi(
          config,
          cleanBase64,
          cleanMimeType,
          systemInstruction,
        );
      }
      if (config.provider === 'ANTHROPIC') {
        return await this.generateResumeWithAnthropic(
          config,
          cleanBase64,
          cleanMimeType,
          systemInstruction,
        );
      }
      return await this.generateResumeWithGemini(
        config,
        cleanBase64,
        cleanMimeType,
        systemInstruction,
      );
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      console.error('AI resume analysis error:', error);
      throw new InternalServerErrorException(
        error?.message ||
          'Erro ao processar currículo com a inteligência artificial.',
      );
    }
  }

  private async generateText(
    config: AiRuntimeConfig,
    prompt: string,
    systemInstruction?: string,
    options?: { json?: boolean; maxOutputTokens?: number },
  ) {
    const maxOutputTokens = options?.maxOutputTokens || 3500;
    if (config.provider === 'OPENAI') {
      const openai = new OpenAI({ apiKey: config.apiKey });
      const response = await openai.responses.create({
        model: config.model,
        ...(systemInstruction ? { instructions: systemInstruction } : {}),
        input: prompt,
        max_output_tokens: maxOutputTokens,
      });
      return response.output_text || '';
    }
    if (config.provider === 'ANTHROPIC') {
      const anthropic = new Anthropic({ apiKey: config.apiKey });
      const response = await anthropic.messages.create({
        model: config.model,
        max_tokens: maxOutputTokens,
        ...(systemInstruction ? { system: systemInstruction } : {}),
        messages: [{ role: 'user', content: prompt }],
      });
      return response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
    }
    return this.geminiGenerate(
      config,
      [{ role: 'user', parts: [{ text: prompt }] }],
      {
        systemInstruction,
        json: options?.json !== false,
        maxOutputTokens,
      },
    );
  }

  async supportChatReply(input: {
    message: string;
    pagePath: string;
    process: string;
    profile: Record<string, unknown>;
    history?: Array<{ role: string; text: string }>;
    screenshot?: { data: string; mimeType: string } | null;
  }) {
    const config = await this.getRuntimeConfig();
    const customInstruction = await this.settingsService.getValue(
      'AI_INSTRUCTION_CHAT_SUPPORT',
      '',
    );
    const systemInstruction = await this.buildSystemInstruction(
      `suporte ajuda navegação página ${input.pagePath} processo ${input.process} perfil ${String(input.profile.type || '')}`,
      `Você atende usuários do PiraNegócios dentro da própria plataforma. Explique caminhos reais e ações seguras com linguagem curta e acolhedora. Use somente o contexto fornecido e a memória aprovada. Se não tiver certeza, admita e oriente o usuário a encaminhar a conversa ao suporte humano. Nunca afirme que executou ações, alterou cadastros ou consultou dados que não estejam no contexto.${customInstruction ? `\n\nINSTRUÇÕES ESPECÍFICAS DE CHAT E SUPORTE:\n${customInstruction}` : ''}`,
    );
    const history = (input.history || [])
      .slice(-10)
      .map((item) => `${item.role}: ${String(item.text || '').slice(0, 1200)}`)
      .join('\n');
    const prompt = `CONTEXTO DA TELA\nPágina: ${input.pagePath}\nProcesso: ${input.process}\nPerfil: ${JSON.stringify(input.profile).slice(0, 5000)}\n\nCONVERSA ANTERIOR\n${history || 'Sem mensagens anteriores.'}\n\nMENSAGEM ATUAL\n${input.message}\n\nResponda diretamente ao usuário em português brasileiro, sem markdown excessivo.`;
    const screenshotMatch = input.screenshot?.data.match(
      /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/,
    );

    try {
      if (config.provider === 'OPENAI' && screenshotMatch) {
        const openai = new OpenAI({ apiKey: config.apiKey });
        const response = await openai.responses.create({
          model: config.model,
          instructions: systemInstruction,
          input: [{
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_image', image_url: input.screenshot!.data, detail: 'auto' },
            ],
          }],
          max_output_tokens: 900,
        } as any);
        return String(response.output_text || '').trim();
      }
      if (config.provider === 'ANTHROPIC' && screenshotMatch) {
        const anthropic = new Anthropic({ apiKey: config.apiKey });
        const response = await anthropic.messages.create({
          model: config.model,
          max_tokens: 900,
          system: systemInstruction,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: screenshotMatch[1],
                  data: screenshotMatch[2],
                },
              },
              { type: 'text', text: prompt },
            ],
          }],
        } as any);
        return response.content
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join('\n')
          .trim();
      }
      if (config.provider === 'GEMINI' && screenshotMatch) {
        return (await this.geminiGenerate(
          config,
          [{ role: 'user', parts: [
            { text: prompt },
            { inlineData: { mimeType: screenshotMatch[1], data: screenshotMatch[2] } },
          ] }],
          { systemInstruction, json: false, maxOutputTokens: 900 },
        )).trim();
      }
      return (await this.generateText(config, prompt, systemInstruction, {
        json: false,
        maxOutputTokens: 900,
      })).trim();
    } catch (error: any) {
      if (error instanceof ServiceUnavailableException) throw error;
      console.error('AI support chat error:', error);
      throw new InternalServerErrorException(
        error?.message || 'Não foi possível responder pelo suporte inteligente.',
      );
    }
  }

  async analyzeProductFeedback(
    items: Array<{
      id: string;
      message: string;
      pagePath: string;
      process: string;
      profileType: string;
      createdAt: string;
    }>,
  ) {
    const config = await this.getRuntimeConfig();
    const systemInstruction = await this.buildSystemInstruction(
      'feedback solicitações produto melhorias experiência usuário priorização',
      'Você é analista de produto do PiraNegócios. Agrupe pedidos que descrevem a mesma necessidade, preserve os IDs recebidos e priorize por frequência, impacto no fluxo, gravidade e recência. Não invente pedidos.',
    );
    const prompt = `Analise as solicitações abaixo e devolva EXCLUSIVAMENTE JSON válido no formato {"clusters":[{"title":"tema curto","summary":"necessidade consolidada","feedbackIds":["uuid"],"score":0,"reason":"justificativa curta"}]}. O score vai de 0 a 100. Cada ID deve aparecer no máximo uma vez.\n\nSOLICITAÇÕES:\n${JSON.stringify(items.slice(0, 250))}`;
    const text = await this.generateText(config, prompt, systemInstruction, {
      json: true,
      maxOutputTokens: 5000,
    });
    const parsed = this.parseJson(text);
    return {
      clusters: Array.isArray(parsed.clusters) ? parsed.clusters : [],
    };
  }

  async matchJobs(profile: unknown, jobs: unknown[], applications: unknown[]) {
    const config = await this.getRuntimeConfig();
    const taskContext = `matching de vagas recrutamento carreira competências ${JSON.stringify(
      {
        profile,
        jobs: (jobs || []).slice(0, 20).map((job: any) => ({
          title: job?.title,
          companyName: job?.companyName,
        })),
      },
    ).slice(0, 4500)}`;
    const systemInstruction = await this.buildSystemInstruction(
      taskContext,
      'Você é um assistente de carreira e recrutamento. Faça comparações criteriosas, não invente qualificações e respeite integralmente os dados fornecidos.',
    );
    const prompt = `Compare o perfil do candidato com as vagas abaixo e devolva EXCLUSIVAMENTE JSON válido no formato {"matches":[{"jobId":"id","score":0,"reason":"motivo curto"}]}.
Regras: score de 0 a 100; use apenas os IDs de vagas fornecidos; não invente qualificações; ordene do melhor para o pior; retorne no máximo 10 resultados.
PERFIL: ${JSON.stringify(profile || {})}
VAGAS: ${JSON.stringify(jobs || [])}
CANDIDATURAS JÁ FEITAS: ${JSON.stringify(applications || [])}`;
    try {
      const text = await this.generateText(config, prompt, systemInstruction);
      const parsed = this.parseJson(text);
      return { matches: Array.isArray(parsed.matches) ? parsed.matches : [] };
    } catch (error: any) {
      if (error instanceof ServiceUnavailableException) throw error;
      console.error('AI job match error:', error);
      throw new InternalServerErrorException(
        error?.message || 'Erro ao gerar recomendações de vagas.',
      );
    }
  }
}
