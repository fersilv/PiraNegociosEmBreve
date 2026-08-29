"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResumeImportService = void 0;
const common_1 = require("@nestjs/common");
const openai_1 = __importDefault(require("openai"));
const groq_anthropic_compat_1 = require("./groq-anthropic-compat");
const settings_service_1 = require("../admin/settings.service");
const WordExtractor = require('word-extractor');
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
let ResumeImportService = class ResumeImportService {
    settingsService;
    constructor(settingsService) {
        this.settingsService = settingsService;
    }
    isProvider(value) {
        return ['GEMINI', 'OPENAI', 'GROQ'].includes(value);
    }
    async getRuntimeConfig() {
        const enabled = (await this.settingsService.getValue('AI_ENABLED', 'false')) === 'true';
        const provider = await this.settingsService.getValue('AI_PROVIDER');
        const model = await this.settingsService.getValue('AI_MODEL');
        if (!enabled || !this.isProvider(provider) || !model) {
            throw new common_1.ServiceUnavailableException('Os recursos de inteligência artificial estão desabilitados no momento.');
        }
        const apiKey = ((await this.settingsService.getValue(`${provider}_API_KEY`)) ||
            process.env[`${provider}_API_KEY`] ||
            '').trim();
        if (!apiKey) {
            throw new common_1.ServiceUnavailableException('O provedor de inteligência artificial ativo não possui uma chave configurada.');
        }
        return { provider, model, apiKey };
    }
    extension(fileName) {
        const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
        return match?.[1] || '';
    }
    normalizedMimeType(input) {
        const fileName = String(input?.fileName || '');
        const extension = this.extension(fileName);
        const mimeType = String(input?.mimeType || '').trim().toLowerCase();
        if (extension === 'doc')
            return 'application/msword';
        if (extension === 'docx') {
            return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        }
        if (extension === 'txt')
            return 'text/plain';
        if (extension === 'rtf')
            return 'application/rtf';
        if (extension === 'pdf')
            return 'application/pdf';
        if (extension === 'png')
            return 'image/png';
        if (extension === 'jpg' || extension === 'jpeg')
            return 'image/jpeg';
        return mimeType;
    }
    decodeRtf(buffer) {
        return buffer
            .toString('latin1')
            .replace(/\\par[d]?\b/g, '\n')
            .replace(/\\line\b/g, '\n')
            .replace(/\\tab\b/g, '\t')
            .replace(/\\'([0-9a-fA-F]{2})/g, (_match, hex) => Buffer.from([parseInt(hex, 16)]).toString('latin1'))
            .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
            .replace(/\\[{}\\]/g, '')
            .replace(/[{}]/g, '')
            .replace(/\r/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
    async extractWordText(buffer) {
        const extractor = new WordExtractor();
        const document = await extractor.extract(buffer);
        const body = String(document.getBody?.() || '');
        const textboxes = document.getTextboxes
            ? String(document.getTextboxes({
                includeHeadersAndFooters: true,
                includeBody: true,
            }) || '')
            : '';
        return [body, textboxes]
            .filter(Boolean)
            .join('\n')
            .replace(/\u0000/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
    async cleanDocument(input, index) {
        let data = String(input?.base64File || '');
        let mimeType = this.normalizedMimeType(input);
        if (data.startsWith('data:')) {
            const parts = data.split(';base64,');
            if (parts.length === 2) {
                if (!mimeType)
                    mimeType = parts[0].split(':')[1] || '';
                data = parts[1];
            }
        }
        if (!data) {
            throw new common_1.BadRequestException(`O arquivo ${index + 1} está vazio.`);
        }
        const fileName = String(input?.fileName || `documento-${index + 1}`).slice(0, 180);
        const buffer = Buffer.from(data, 'base64');
        const sourceBytes = buffer.length;
        if (sourceBytes > 20 * 1024 * 1024) {
            throw new common_1.BadRequestException(`O arquivo ${fileName} excede o limite de 20 MB.`);
        }
        const binaryAllowed = new Set([
            'application/pdf',
            'image/png',
            'image/jpeg',
        ]);
        if (binaryAllowed.has(mimeType)) {
            return {
                kind: 'binary',
                data,
                mimeType: mimeType,
                fileName,
                sourceBytes,
            };
        }
        const isWord = mimeType === 'application/msword' ||
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
            }
            catch (error) {
                throw new common_1.BadRequestException(`Não foi possível ler ${fileName} como documento Word: ${error?.message || 'arquivo inválido'}.`);
            }
        }
        if (mimeType === 'text/plain' || mimeType === 'application/rtf' || mimeType === 'text/rtf') {
            const text = mimeType === 'application/rtf' || mimeType === 'text/rtf'
                ? this.decodeRtf(buffer)
                : buffer.toString('utf8').replace(/\u0000/g, '').trim();
            if (!text) {
                throw new common_1.BadRequestException(`O arquivo ${fileName} não contém texto legível.`);
            }
            return {
                kind: 'text',
                text: text.slice(0, 300000),
                mimeType: 'text/plain',
                fileName,
                sourceBytes,
            };
        }
        throw new common_1.BadRequestException(`O arquivo ${fileName} precisa ser PDF, DOC, DOCX, TXT, RTF, PNG ou JPEG.`);
    }
    async prepareDocuments(inputs) {
        if (!Array.isArray(inputs) || inputs.length === 0) {
            throw new common_1.BadRequestException('Envie pelo menos um documento profissional.');
        }
        if (inputs.length > 8) {
            throw new common_1.BadRequestException('Envie no máximo 8 documentos por análise.');
        }
        const documents = await Promise.all(inputs.map((item, index) => this.cleanDocument(item, index)));
        const totalSize = documents.reduce((sum, item) => sum + item.sourceBytes, 0);
        if (totalSize > 36 * 1024 * 1024) {
            throw new common_1.BadRequestException('O conjunto de documentos excede 36 MB. Reduza a quantidade ou o tamanho dos arquivos.');
        }
        return documents;
    }
    parseJson(text) {
        const cleaned = String(text || '{}')
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .trim();
        try {
            return JSON.parse(cleaned);
        }
        catch {
            const start = cleaned.indexOf('{');
            const end = cleaned.lastIndexOf('}');
            if (start >= 0 && end > start) {
                return JSON.parse(cleaned.slice(start, end + 1));
            }
            throw new Error('O provedor retornou dados fora do formato esperado.');
        }
    }
    async buildSystemInstruction(documents) {
        const fileContext = documents
            .map((item) => item.fileName)
            .join(', ')
            .slice(0, 1200);
        const [behavior, memory] = await Promise.all([
            this.settingsService.getAiBehavior(),
            this.settingsService.findRelevantAiBrain(`currículo análise profissional extração documentos carteira de trabalho extrato CTPS certificados ${fileContext}`, 5, 3500),
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
    async withGemini(config, documents, systemInstruction) {
        const parts = [];
        documents.forEach((document, index) => {
            parts.push({ text: `FONTE ${index + 1}: ${document.fileName}` });
            if (document.kind === 'text') {
                parts.push({ text: document.text });
            }
            else {
                parts.push({
                    inlineData: { data: document.data, mimeType: document.mimeType },
                });
            }
        });
        parts.push({ text: IMPORT_PROMPT });
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
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
        });
        const raw = await response.text();
        if (!response.ok) {
            throw new Error(`Google Gemini respondeu HTTP ${response.status}${raw ? `: ${raw.slice(0, 400)}` : ''}`);
        }
        const payload = JSON.parse(raw || '{}');
        const text = (payload.candidates || [])
            .flatMap((candidate) => candidate.content?.parts || [])
            .map((part) => part.text || '')
            .filter(Boolean)
            .join('\n');
        return this.parseJson(text);
    }
    async withOpenAi(config, documents, systemInstruction) {
        const openai = new openai_1.default({ apiKey: config.apiKey });
        const content = [];
        documents.forEach((document) => {
            content.push({ type: 'input_text', text: `FONTE: ${document.fileName}` });
            if (document.kind === 'text') {
                content.push({ type: 'input_text', text: document.text });
                return;
            }
            const dataUrl = `data:${document.mimeType};base64,${document.data}`;
            content.push(document.mimeType === 'application/pdf'
                ? {
                    type: 'input_file',
                    filename: document.fileName.endsWith('.pdf')
                        ? document.fileName
                        : `${document.fileName}.pdf`,
                    file_data: dataUrl,
                }
                : { type: 'input_image', image_url: dataUrl, detail: 'auto' });
        });
        content.push({ type: 'input_text', text: IMPORT_PROMPT });
        const response = await openai.responses.create({
            model: config.model,
            instructions: systemInstruction,
            input: [{ role: 'user', content }],
            max_output_tokens: 7000,
        });
        return this.parseJson(response.output_text || '{}');
    }
    async withGroq(config, documents, systemInstruction) {
        const anthropic = new groq_anthropic_compat_1.GroqCompat({ apiKey: config.apiKey });
        const content = [];
        documents.forEach((document) => {
            content.push({ type: 'text', text: `FONTE: ${document.fileName}` });
            if (document.kind === 'text') {
                content.push({ type: 'text', text: document.text });
                return;
            }
            content.push(document.mimeType === 'application/pdf'
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
                });
        });
        content.push({ type: 'text', text: IMPORT_PROMPT });
        const response = await anthropic.messages.create({
            model: config.model,
            max_tokens: 7000,
            system: systemInstruction,
            messages: [{ role: 'user', content }],
        });
        const text = response.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('\n');
        return this.parseJson(text);
    }
    async importDocuments(inputs) {
        const documents = await this.prepareDocuments(inputs);
        const config = await this.getRuntimeConfig();
        const systemInstruction = await this.buildSystemInstruction(documents);
        try {
            const result = config.provider === 'OPENAI'
                ? await this.withOpenAi(config, documents, systemInstruction)
                : config.provider === 'GROQ'
                    ? await this.withGroq(config, documents, systemInstruction)
                    : await this.withGemini(config, documents, systemInstruction);
            return {
                ...result,
                documentsProcessed: documents.length,
            };
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException ||
                error instanceof common_1.ServiceUnavailableException) {
                throw error;
            }
            console.error('AI resume multi-document import error:', error);
            throw new common_1.InternalServerErrorException(error?.message || 'Não foi possível organizar os documentos profissionais.');
        }
    }
};
exports.ResumeImportService = ResumeImportService;
exports.ResumeImportService = ResumeImportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [settings_service_1.SettingsService])
], ResumeImportService);
//# sourceMappingURL=resume-import.service.js.map