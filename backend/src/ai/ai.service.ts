import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SettingsService } from '../admin/settings.service';
import { GoogleGenAI } from '@google/genai';
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

  private async generateResumeWithGemini(
    config: AiRuntimeConfig,
    cleanBase64: string,
    cleanMimeType: string,
  ) {
    const ai = new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: { headers: { 'User-Agent': 'piranegocios' } },
    });
    const response = await ai.models.generateContent({
      model: config.model,
      contents: [
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
      config: { systemInstruction: RESUME_SYSTEM_INSTRUCTION },
    });
    return this.parseJson(response.text || '{}');
  }

  private async generateResumeWithOpenAi(
    config: AiRuntimeConfig,
    cleanBase64: string,
    cleanMimeType: string,
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
      instructions: RESUME_SYSTEM_INSTRUCTION,
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
      system: RESUME_SYSTEM_INSTRUCTION,
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

    try {
      if (config.provider === 'OPENAI') {
        return await this.generateResumeWithOpenAi(
          config,
          cleanBase64,
          cleanMimeType,
        );
      }
      if (config.provider === 'ANTHROPIC') {
        return await this.generateResumeWithAnthropic(
          config,
          cleanBase64,
          cleanMimeType,
        );
      }
      return await this.generateResumeWithGemini(
        config,
        cleanBase64,
        cleanMimeType,
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

  private async generateText(config: AiRuntimeConfig, prompt: string) {
    if (config.provider === 'OPENAI') {
      const openai = new OpenAI({ apiKey: config.apiKey });
      const response = await openai.responses.create({
        model: config.model,
        input: prompt,
        max_output_tokens: 3500,
      });
      return response.output_text || '';
    }
    if (config.provider === 'ANTHROPIC') {
      const anthropic = new Anthropic({ apiKey: config.apiKey });
      const response = await anthropic.messages.create({
        model: config.model,
        max_tokens: 3500,
        messages: [{ role: 'user', content: prompt }],
      });
      return response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
    }
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const response = await ai.models.generateContent({
      model: config.model,
      contents: prompt,
    });
    return response.text || '';
  }

  async matchJobs(profile: unknown, jobs: unknown[], applications: unknown[]) {
    const config = await this.getRuntimeConfig();
    const prompt = `Você é um assistente de carreira. Compare o perfil do candidato com as vagas abaixo e devolva EXCLUSIVAMENTE JSON válido no formato {"matches":[{"jobId":"id","score":0,"reason":"motivo curto"}]}.
Regras: score de 0 a 100; use apenas os IDs de vagas fornecidos; não invente qualificações; ordene do melhor para o pior; retorne no máximo 10 resultados.
PERFIL: ${JSON.stringify(profile || {})}
VAGAS: ${JSON.stringify(jobs || [])}
CANDIDATURAS JÁ FEITAS: ${JSON.stringify(applications || [])}`;
    try {
      const text = await this.generateText(config, prompt);
      const parsed = this.parseJson(text);
      return { matches: Array.isArray(parsed.matches) ? parsed.matches : [] };
    } catch (error: any) {
      console.error('AI job match error:', error);
      throw new InternalServerErrorException(
        error?.message || 'Erro ao gerar recomendações de vagas.',
      );
    }
  }
}
