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
exports.JobMatchAiService = void 0;
const common_1 = require("@nestjs/common");
const openai_1 = __importDefault(require("openai"));
const groq_anthropic_compat_1 = require("../ai/groq-anthropic-compat");
const settings_service_1 = require("../admin/settings.service");
const GENERIC_OCCUPATION_WORDS = new Set(['operador', 'operadora', 'auxiliar', 'assistente', 'analista', 'ajudante', 'tecnico', 'tecnica', 'profissional', 'colaborador', 'colaboradora']);
let JobMatchAiService = class JobMatchAiService {
    settings;
    constructor(settings) {
        this.settings = settings;
    }
    isProvider(value) {
        return ['GEMINI', 'OPENAI', 'GROQ'].includes(value);
    }
    async config() {
        const enabled = (await this.settings.getValue('AI_ENABLED', 'false')) === 'true';
        const provider = await this.settings.getValue('AI_PROVIDER');
        const model = await this.settings.getValue('AI_MODEL');
        if (!enabled || !this.isProvider(provider) || !model) {
            throw new common_1.ServiceUnavailableException('A IA está desabilitada e a vaga não pôde ser preparada para o Match Inteligente.');
        }
        const apiKey = ((await this.settings.getValue(`${provider}_API_KEY`)) || process.env[`${provider}_API_KEY`] || '').trim();
        if (!apiKey)
            throw new common_1.ServiceUnavailableException('O provedor de IA ativo não possui chave configurada.');
        return { provider, model, apiKey };
    }
    jsonCandidates(text) {
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
    parseJson(text) {
        let lastError = null;
        for (const candidate of this.jsonCandidates(text)) {
            try {
                return JSON.parse(candidate);
            }
            catch (error) {
                lastError = error;
            }
        }
        const detail = lastError instanceof Error ? lastError.message : 'JSON inválido';
        throw new Error(`A IA retornou uma ficha de vaga inválida: ${detail}`);
    }
    async rawGenerate(config, prompt, system, maxTokens = 3200) {
        if (config.provider === 'OPENAI') {
            const response = await new openai_1.default({ apiKey: config.apiKey }).responses.create({
                model: config.model,
                instructions: system,
                input: prompt,
                max_output_tokens: maxTokens,
            });
            return response.output_text || '';
        }
        if (config.provider === 'GROQ') {
            const response = await new groq_anthropic_compat_1.GroqCompat({ apiKey: config.apiKey }).messages.create({
                model: config.model,
                system,
                max_tokens: maxTokens,
                messages: [{ role: 'user', content: prompt }],
            });
            return response.content.filter((block) => block.type === 'text').map((block) => block.text).join('\n');
        }
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens },
            }),
        });
        const raw = await response.text();
        if (!response.ok)
            throw new Error(`Gemini respondeu HTTP ${response.status}: ${raw.slice(0, 400)}`);
        const data = JSON.parse(raw || '{}');
        return (data.candidates || []).flatMap((candidate) => candidate.content?.parts || []).map((part) => part.text || '').join('\n');
    }
    async generate(config, prompt, system) {
        const first = await this.rawGenerate(config, prompt, system);
        try {
            return this.parseJson(first);
        }
        catch (firstError) {
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
            }
            catch (repairError) {
                const original = firstError instanceof Error ? firstError.message : 'JSON inválido';
                const repairedDetail = repairError instanceof Error ? repairError.message : 'JSON inválido após reparo';
                throw new Error(`${original}. A tentativa automática de reparo também falhou: ${repairedDetail}`);
            }
        }
    }
    strings(value, limit, maxLength = 120) {
        if (!Array.isArray(value))
            return [];
        const seen = new Set();
        return value.map((item) => String(item || '').trim().replace(/\s+/g, ' ').slice(0, maxLength)).filter((item) => {
            const key = item.toLocaleLowerCase('pt-BR');
            if (!key || seen.has(key))
                return false;
            seen.add(key);
            return true;
        }).slice(0, limit);
    }
    specificOccupationKeywords(value) {
        return this.strings(value, 12).filter((item) => {
            const tokens = item.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean);
            return tokens.some((token) => !GENERIC_OCCUPATION_WORDS.has(token) && token.length > 2);
        });
    }
    weight(value, fallback = 1) {
        const n = Number(value);
        return Number.isFinite(n) ? Math.max(0.1, Math.min(5, n)) : fallback;
    }
    normalizeProfile(raw) {
        const technicalSkills = (Array.isArray(raw?.technicalSkills) ? raw.technicalSkills : []).map((item) => ({
            name: String(item?.name || '').trim().slice(0, 120),
            required: item?.required === true,
            weight: this.weight(item?.weight),
            evidenceTerms: this.strings(item?.evidenceTerms, 8),
        })).filter((item) => item.name).slice(0, 15);
        const validTypes = new Set(['SKILL', 'EXPERIENCE', 'EDUCATION', 'CERTIFICATION', 'LICENSE', 'OTHER']);
        const requirements = (Array.isArray(raw?.requirements) ? raw.requirements : []).map((item) => ({
            label: String(item?.label || '').trim().slice(0, 180),
            type: (validTypes.has(String(item?.type || '').toUpperCase()) ? String(item.type).toUpperCase() : 'OTHER'),
            required: item?.required === true,
            weight: this.weight(item?.weight),
            evidenceTerms: this.strings(item?.evidenceTerms, 10),
        })).filter((item) => item.label).slice(0, 20);
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
    normalizeProvidedProfile(raw) {
        const source = typeof raw === 'string' ? this.parseJson(raw) : raw;
        if (!source || typeof source !== 'object' || Array.isArray(source)) {
            throw new Error('matchProfile precisa ser um objeto JSON.');
        }
        const profile = this.normalizeProfile(source);
        if (!profile.canonicalRole)
            throw new Error('matchProfile.canonicalRole é obrigatório.');
        if (!profile.occupationalFamily)
            throw new Error('matchProfile.occupationalFamily é obrigatório.');
        return profile;
    }
    async analyze(job) {
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
};
exports.JobMatchAiService = JobMatchAiService;
exports.JobMatchAiService = JobMatchAiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [settings_service_1.SettingsService])
], JobMatchAiService);
//# sourceMappingURL=job-match-ai.service.js.map