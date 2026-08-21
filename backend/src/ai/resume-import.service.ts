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

export interface ResumeSourceDocumentInput {
  base64File: string;
  mimeType?: string;
  fileName?: string;
}

type CleanDocument = {
  data: string;
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg';
  fileName: string;
};

const IMPORT_SYSTEM_INSTRUCTION = `Você organiza informações profissionais a partir de documentos enviados pelo próprio usuário. Sua tarefa é somente EXTRAIR, CRUZAR e ESTRUTURAR fatos presentes nas fontes. Não avalie a qualidade do currículo, não dê nota, não ofereça sugestões de melhoria e não invente atividades, competências, cargos, datas ou formações. Quando fontes divergirem, registre a divergência em conflicts em vez de escolher silenciosamente.`;

const IMPORT_PROMPT = `Analise em conjunto todos os documentos anexados. Eles podem ser currículo, foto/print de currículo, páginas ou prints da Carteira de Trabalho, extrato da Carteira de Trabalho Digital, certificados, comprovantes de curso ou outros documentos profissionais.

Cruze as fontes e consolide a trajetória. Quando houver vários cargos na mesma empresa, prefira UMA experiência com timeline de evolução de cargos. Preserve datas e nomes como aparecem nas fontes. Não gere resumo profissional novo: só preencha bio se existir texto equivalente em algum documento. Não faça avaliação do currículo e não gere sugestões.

Retorne EXCLUSIVAMENTE JSON válido:
{
  "name": "Nome completo encontrado ou null",
  "treatment": "Tratamento se existir ou vazio",
  "phone": "Telefone principal ou null",
  "email": "E-mail principal ou null",
  "additionalPhones": [],
  "bio": "Resumo/objetivo já existente nas fontes ou null",
  "experiences": [
    {
      "company": "Empresa",
      "role": "Cargo mais recente encontrado",
      "startDate": "MM/AAAA, AAAA ou formato fiel disponível",
      "endDate": "MM/AAAA, AAAA ou Atual",
      "current": false,
      "description": "Descrição geral somente se sustentada pelas fontes",
      "skills": ["Competências explicitamente sustentadas pelas fontes"],
      "timeline": [
        {
          "role": "Cargo/função",
          "startDate": "MM/AAAA, AAAA ou formato disponível",
          "endDate": "MM/AAAA, AAAA ou Atual",
          "current": false,
          "description": "Atividades desta etapa somente quando presentes",
          "skills": ["Competências comprovadas nesta etapa"]
        }
      ]
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
      "status": "CONCLUIDO|EM_ANDAMENTO|TRANCADO|INTERROMPIDO",
      "description": "Descrição somente se presente",
      "skills": []
    }
  ],
  "skills": [],
  "courses": [
    {
      "name": "Curso ou certificação",
      "institution": "Instituição",
      "year": "Ano",
      "type": "COURSE|CERTIFICATION",
      "description": "Descrição somente se presente",
      "skills": []
    }
  ],
  "languages": [{"name":"Idioma","level":"Nível"}],
  "sourceSummary": [
    {"fileName":"arquivo.ext","documentType":"CURRICULO|CARTEIRA_TRABALHO|EXTRATO_CTPS|CERTIFICADO|OUTRO","summary":"O que foi aproveitado desta fonte"}
  ],
  "conflicts": [
    {"field":"Campo em conflito","message":"Explique objetivamente a divergência","options":["valor 1","valor 2"],"sources":["arquivo1","arquivo2"]}
  ]
}

Regras adicionais:
- no máximo 20 habilidades globais;
- não trate benefícios, salário, disponibilidade ou escolaridade como habilidade;
- uma mesma empresa não deve virar várias experiências apenas porque houve promoção;
- documento oficial ajuda a confirmar vínculo e datas, mas não autoriza inventar atividades que não aparecem em nenhuma fonte;
- se um dado estiver ilegível ou incerto, omita ou registre em conflicts;
- não inclua CPF, PIS, CTPS, RG, endereço residencial completo ou outros identificadores sensíveis no JSON final.`;

@Injectable()
export class ResumeImportService {
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

  private cleanDocument(
    input: ResumeSourceDocumentInput,
    index: number,
  ): CleanDocument {
    let data = String(input?.base64File || '');
    let mimeType = String(input?.mimeType || '').trim();
    if (data.startsWith('data:')) {
      const parts = data.split(';base64,');
      if (parts.length === 2) {
        mimeType = parts[0].split(':')[1] || mimeType;
        data = parts[1];
      }
    }

    const allowed = new Set(['application/pdf', 'image/png', 'image/jpeg']);
    if (!allowed.has(mimeType)) {
      throw new BadRequestException(
        `O arquivo ${input?.fileName || index + 1} precisa ser PDF, PNG ou JPEG.`,
      );
    }
    if (!data) {
      throw new BadRequestException(`O arquivo ${index + 1} está vazio.`);
    }
    if (data.length > 14 * 1024 * 1024) {
      throw new BadRequestException(
        `O arquivo ${input?.fileName || index + 1} é muito grande.`,
      );
    }

    return {
      data,
      mimeType: mimeType as CleanDocument['mimeType'],
      fileName: String(input?.fileName || `documento-${index + 1}`).slice(0, 180),
    };
  }

  private prepareDocuments(inputs: ResumeSourceDocumentInput[]): CleanDocument[] {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new BadRequestException('Envie pelo menos um documento profissional.');
    }
    if (inputs.length > 8) {
      throw new BadRequestException('Envie no máximo 8 documentos por análise.');
    }
    const documents = inputs.map((item, index) => this.cleanDocument(item, index));
    const totalSize = documents.reduce((sum, item) => sum + item.data.length, 0);
    if (totalSize > 36 * 1024 * 1024) {
      throw new BadRequestException(
        'O conjunto de documentos é muito grande. Reduza a quantidade ou o tamanho das imagens.',
      );
    }
    return documents;
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
      throw new Error('O provedor retornou dados fora do formato esperado.');
    }
  }

  private async buildSystemInstruction(documents: CleanDocument[]) {
    const fileContext = documents
      .map((item) => item.fileName)
      .join(', ')
      .slice(0, 1200);
    const [behavior, memory] = await Promise.all([
      this.settingsService.getAiBehavior(),
      this.settingsService.findRelevantAiBrain(
        `currículo análise profissional extração documentos carteira de trabalho extrato CTPS certificados ${fileContext}`,
        5,
        3500,
      ),
    ]);
    return [
      IMPORT_SYSTEM_INSTRUCTION,
      behavior.instructions
        ? `Instruções gerais do administrador:\n${behavior.instructions}`
        : '',
      behavior.negativePrompt
        ? `Regras inegociáveis:\n${behavior.negativePrompt}`
        : '',
      memory ? `Contexto relevante da plataforma:\n${memory}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private async withGemini(
    config: RuntimeConfig,
    documents: CleanDocument[],
    systemInstruction: string,
  ) {
    const parts = documents.flatMap((document, index) => [
      { text: `FONTE ${index + 1}: ${document.fileName}` },
      { inlineData: { data: document.data, mimeType: document.mimeType } },
    ]);
    parts.push({ text: IMPORT_PROMPT } as never);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 7000,
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
    const payload = JSON.parse(raw || '{}') as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = (payload.candidates || [])
      .flatMap((candidate) => candidate.content?.parts || [])
      .map((part) => part.text || '')
      .filter(Boolean)
      .join('\n');
    return this.parseJson(text);
  }

  private async withOpenAi(
    config: RuntimeConfig,
    documents: CleanDocument[],
    systemInstruction: string,
  ) {
    const openai = new OpenAI({ apiKey: config.apiKey });
    const content = documents.flatMap((document) => {
      const dataUrl = `data:${document.mimeType};base64,${document.data}`;
      const part =
        document.mimeType === 'application/pdf'
          ? {
              type: 'input_file',
              filename: document.fileName.endsWith('.pdf')
                ? document.fileName
                : `${document.fileName}.pdf`,
              file_data: dataUrl,
            }
          : { type: 'input_image', image_url: dataUrl, detail: 'auto' };
      return [
        { type: 'input_text', text: `FONTE: ${document.fileName}` },
        part,
      ];
    });
    content.push({ type: 'input_text', text: IMPORT_PROMPT });
    const response = await openai.responses.create({
      model: config.model,
      instructions: systemInstruction,
      input: [{ role: 'user', content }],
      max_output_tokens: 7000,
    } as any);
    return this.parseJson(response.output_text || '{}');
  }

  private async withAnthropic(
    config: RuntimeConfig,
    documents: CleanDocument[],
    systemInstruction: string,
  ) {
    const anthropic = new Anthropic({ apiKey: config.apiKey });
    const content = documents.flatMap((document) => {
      const part =
        document.mimeType === 'application/pdf'
          ? {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: document.data,
              },
            }
          : {
              type: 'image',
              source: {
                type: 'base64',
                media_type: document.mimeType,
                data: document.data,
              },
            };
      return [
        { type: 'text', text: `FONTE: ${document.fileName}` },
        part,
      ];
    });
    content.push({ type: 'text', text: IMPORT_PROMPT });
    const response = await anthropic.messages.create({
      model: config.model,
      max_tokens: 7000,
      system: systemInstruction,
      messages: [{ role: 'user', content }],
    } as any);
    const text = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');
    return this.parseJson(text);
  }

  async importDocuments(inputs: ResumeSourceDocumentInput[]) {
    const documents = this.prepareDocuments(inputs);
    const config = await this.getRuntimeConfig();
    const systemInstruction = await this.buildSystemInstruction(documents);
    try {
      const result =
        config.provider === 'OPENAI'
          ? await this.withOpenAi(config, documents, systemInstruction)
          : config.provider === 'ANTHROPIC'
            ? await this.withAnthropic(config, documents, systemInstruction)
            : await this.withGemini(config, documents, systemInstruction);
      return {
        ...result,
        documentsProcessed: documents.length,
      };
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      console.error('AI resume multi-document import error:', error);
      throw new InternalServerErrorException(
        error?.message || 'Não foi possível organizar os documentos profissionais.',
      );
    }
  }
}
