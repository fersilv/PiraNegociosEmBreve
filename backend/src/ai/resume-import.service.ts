import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { SettingsService } from '../admin/settings.service';

const WordExtractor = require('word-extractor') as {
  new (): {
    extract(input: Buffer): Promise<{
      getBody(): string;
      getTextboxes?(options?: {
        includeHeadersAndFooters?: boolean;
        includeBody?: boolean;
      }): string;
    }>;
  };
};

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

type BinaryMimeType = 'application/pdf' | 'image/png' | 'image/jpeg';

type CleanDocument =
  | {
      kind: 'binary';
      data: string;
      mimeType: BinaryMimeType;
      fileName: string;
      sourceBytes: number;
    }
  | {
      kind: 'text';
      text: string;
      mimeType: 'text/plain';
      fileName: string;
      sourceBytes: number;
    };

const IMPORT_SYSTEM_INSTRUCTION = `Você organiza informações profissionais a partir de documentos enviados pelo próprio usuário. Sua tarefa é somente EXTRAIR, CRUZAR e ESTRUTURAR fatos presentes nas fontes. Não avalie a qualidade do currículo, não dê nota, não ofereça sugestões de melhoria e não invente atividades, competências, cargos, datas ou formações. Quando fontes divergirem, registre a divergência em conflicts em vez de escolher silenciosamente.`;

const IMPORT_PROMPT = `Analise em conjunto todos os documentos anexados. Eles podem ser currículo, arquivo Word, texto, RTF, foto/print de currículo, páginas ou prints da Carteira de Trabalho, extrato da Carteira de Trabalho Digital, certificados, comprovantes de curso ou outros documentos profissionais.

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

  private extension(fileName: string): string {
    const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
    return match?.[1] || '';
  }

  private normalizedMimeType(input: ResumeSourceDocumentInput): string {
    const fileName = String(input?.fileName || '');
    const extension = this.extension(fileName);
    const mimeType = String(input?.mimeType || '').trim().toLowerCase();
    if (extension === 'doc') return 'application/msword';
    if (extension === 'docx') {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    if (extension === 'txt') return 'text/plain';
    if (extension === 'rtf') return 'application/rtf';
    if (extension === 'pdf') return 'application/pdf';
    if (extension === 'png') return 'image/png';
    if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
    return mimeType;
  }

  private decodeRtf(buffer: Buffer): string {
    return buffer
      .toString('latin1')
      .replace(/\\par[d]?\b/g, '\n')
      .replace(/\\line\b/g, '\n')
      .replace(/\\tab\b/g, '\t')
      .replace(/\\'([0-9a-fA-F]{2})/g, (_match, hex: string) =>
        Buffer.from([parseInt(hex, 16)]).toString('latin1'),
      )
      .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
      .replace(/\\[{}\\]/g, '')
      .replace(/[{}]/g, '')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private async extractWordText(buffer: Buffer): Promise<string> {
    const extractor = new WordExtractor();
    const document = await extractor.extract(buffer);
    const body = String(document.getBody?.() || '');
    const textboxes = document.getTextboxes
      ? String(
          document.getTextboxes({
            includeHeadersAndFooters: true,
            includeBody: true,
          }) || '',
        )
      : '';
    return [body, textboxes]
      .filter(Boolean)
      .join('\n')
      .replace(/\u0000/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private async cleanDocument(
    input: ResumeSourceDocumentInput,
    index: number,
  ): Promise<CleanDocument> {
    let data = String(input?.base64File || '');
    let mimeType = this.normalizedMimeType(input);
    if (data.startsWith('data:')) {
      const parts = data.split(';base64,');
      if (parts.length === 2) {
        if (!mimeType) mimeType = parts[0].split(':')[1] || '';
        data = parts[1];
      }
    }

    if (!data) {
      throw new BadRequestException(`O arquivo ${index + 1} está vazio.`);
    }

    const fileName = String(input?.fileName || `documento-${index + 1}`).slice(
      0,
      180,
    );
    const buffer = Buffer.from(data, 'base64');
    const sourceBytes = buffer.length;
    if (sourceBytes > 20 * 1024 * 1024) {
      throw new BadRequestException(
        `O arquivo ${fileName} excede o limite de 20 MB.`,
      );
    }

    const binaryAllowed = new Set<BinaryMimeType>([
      'application/pdf',
      'image/png',
      'image/jpeg',
    ]);
    if (binaryAllowed.has(mimeType as BinaryMimeType)) {
      return {
        kind: 'binary',
        data,
        mimeType: mimeType as BinaryMimeType,
        fileName,
        sourceBytes,
      };
    }

    const isWord =
      mimeType === 'application/msword' ||
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (isWord) {
      try {
        const text = await this.extractWordText(buffer);
        if (!text) {
          throw new Error('Nenhum texto foi encontrado no arquivo Word.');
        }
        return {
          kind: 'text',
          text: text.slice(0, 300000),
          mimeType: 'text/plain',
          fileName,
          sourceBytes,
        };
      } catch (error: any) {
        throw new BadRequestException(
          `Não foi possível ler ${fileName} como documento Word: ${error?.message || 'arquivo inválido'}.`,
        );
      }
    }

    if (mimeType === 'text/plain' || mimeType === 'application/rtf' || mimeType === 'text/rtf') {
      const text =
        mimeType === 'application/rtf' || mimeType === 'text/rtf'
          ? this.decodeRtf(buffer)
          : buffer.toString('utf8').replace(/\u0000/g, '').trim();
      if (!text) {
        throw new BadRequestException(`O arquivo ${fileName} não contém texto legível.`);
      }
      return {
        kind: 'text',
        text: text.slice(0, 300000),
        mimeType: 'text/plain',
        fileName,
        sourceBytes,
      };
    }

    throw new BadRequestException(
      `O arquivo ${fileName} precisa ser PDF, DOC, DOCX, TXT, RTF, PNG ou JPEG.`,
    );
  }

  private async prepareDocuments(
    inputs: ResumeSourceDocumentInput[],
  ): Promise<CleanDocument[]> {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new BadRequestException('Envie pelo menos um documento profissional.');
    }
    if (inputs.length > 8) {
      throw new BadRequestException('Envie no máximo 8 documentos por análise.');
    }
    const documents = await Promise.all(
      inputs.map((item, index) => this.cleanDocument(item, index)),
    );
    const totalSize = documents.reduce(
      (sum, item) => sum + item.sourceBytes,
      0,
    );
    if (totalSize > 36 * 1024 * 1024) {
      throw new BadRequestException(
        'O conjunto de documentos excede 36 MB. Reduza a quantidade ou o tamanho dos arquivos.',
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
    const parts: any[] = [];
    documents.forEach((document, index) => {
      parts.push({ text: `FONTE ${index + 1}: ${document.fileName}` });
      if (document.kind === 'text') {
        parts.push({ text: document.text });
      } else {
        parts.push({
          inlineData: { data: document.data, mimeType: document.mimeType },
        });
      }
    });
    parts.push({ text: IMPORT_PROMPT });

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
    const content: any[] = [];
    documents.forEach((document) => {
      content.push({ type: 'input_text', text: `FONTE: ${document.fileName}` });
      if (document.kind === 'text') {
        content.push({ type: 'input_text', text: document.text });
        return;
      }
      const dataUrl = `data:${document.mimeType};base64,${document.data}`;
      content.push(
        document.mimeType === 'application/pdf'
          ? {
              type: 'input_file',
              filename: document.fileName.endsWith('.pdf')
                ? document.fileName
                : `${document.fileName}.pdf`,
              file_data: dataUrl,
            }
          : { type: 'input_image', image_url: dataUrl, detail: 'auto' },
      );
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
    const content: any[] = [];
    documents.forEach((document) => {
      content.push({ type: 'text', text: `FONTE: ${document.fileName}` });
      if (document.kind === 'text') {
        content.push({ type: 'text', text: document.text });
        return;
      }
      content.push(
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
            },
      );
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
    const documents = await this.prepareDocuments(inputs);
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
