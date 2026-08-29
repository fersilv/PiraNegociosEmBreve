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
exports.ResumeReviewService = void 0;
const common_1 = require("@nestjs/common");
const openai_1 = __importDefault(require("openai"));
const groq_anthropic_compat_1 = require("./groq-anthropic-compat");
const settings_service_1 = require("../admin/settings.service");
let ResumeReviewService = class ResumeReviewService {
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
    extractJsonObject(text) {
        const start = text.indexOf('{');
        if (start < 0)
            return text;
        let depth = 0;
        let inString = false;
        let escaped = false;
        for (let index = start; index < text.length; index += 1) {
            const char = text[index];
            if (inString) {
                if (escaped)
                    escaped = false;
                else if (char === '\\')
                    escaped = true;
                else if (char === '"')
                    inString = false;
                continue;
            }
            if (char === '"') {
                inString = true;
                continue;
            }
            if (char === '{')
                depth += 1;
            if (char === '}') {
                depth -= 1;
                if (depth === 0)
                    return text.slice(start, index + 1);
            }
        }
        return text.slice(start);
    }
    normalizeJsonControls(text) {
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
            if (char === '"')
                inString = true;
            result += char;
        }
        return result;
    }
    removeTrailingJsonCommas(text) {
        let result = '';
        let inString = false;
        let escaped = false;
        for (let index = 0; index < text.length; index += 1) {
            const char = text[index];
            if (inString) {
                result += char;
                if (escaped)
                    escaped = false;
                else if (char === '\\')
                    escaped = true;
                else if (char === '"')
                    inString = false;
                continue;
            }
            if (char === '"') {
                inString = true;
                result += char;
                continue;
            }
            if (char === ',') {
                let next = index + 1;
                while (next < text.length && /\s/.test(text[next]))
                    next += 1;
                if (text[next] === ']' || text[next] === '}')
                    continue;
            }
            result += char;
        }
        return result;
    }
    repairJsonAtParsePosition(text, error) {
        const message = error instanceof Error ? error.message : String(error || '');
        const match = message.match(/position\s+(\d+)/i);
        if (!match)
            return null;
        const position = Number(match[1]);
        if (!Number.isInteger(position) || position < 0 || position > text.length)
            return null;
        if (/Expected ',' or '[}\]]' after/i.test(message) || /Expected ',' or '}' after property value/i.test(message)) {
            let cursor = position;
            while (cursor < text.length && /\s/.test(text[cursor]))
                cursor += 1;
            const next = text[cursor];
            if (!next || next === ']' || next === '}' || next === ',')
                return null;
            return `${text.slice(0, cursor)},${text.slice(cursor)}`;
        }
        return null;
    }
    parseJson(text) {
        const withoutFences = String(text || '{}')
            .replace(/^\s*```(?:json)?\s*/i, '')
            .replace(/\s*```\s*$/i, '')
            .replace(/^\uFEFF/, '')
            .trim();
        let candidate = this.normalizeJsonControls(this.extractJsonObject(withoutFences).trim());
        let lastError = null;
        for (let attempt = 0; attempt < 6; attempt += 1) {
            try {
                return JSON.parse(candidate);
            }
            catch (error) {
                lastError = error;
                const noTrailing = this.removeTrailingJsonCommas(candidate);
                if (noTrailing !== candidate) {
                    candidate = noTrailing;
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
        throw new Error(`O provedor retornou uma avaliação em JSON inválido (${detail}).`);
    }
    stringArray(value, limit) {
        if (!Array.isArray(value))
            return [];
        return value
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .slice(0, limit);
    }
    clampDimension(value, max) {
        const numeric = Math.round(Number(value) || 0);
        return Math.max(0, Math.min(max, numeric));
    }
    normalize(result) {
        const rawBreakdown = result.breakdown && typeof result.breakdown === 'object'
            ? result.breakdown
            : null;
        const breakdown = {
            summaryPositioning: this.clampDimension(rawBreakdown?.summaryPositioning, 15),
            experienceStructure: this.clampDimension(rawBreakdown?.experienceStructure, 20),
            experienceEvidence: this.clampDimension(rawBreakdown?.experienceEvidence, 20),
            skills: this.clampDimension(rawBreakdown?.skills, 15),
            educationCourses: this.clampDimension(rawBreakdown?.educationCourses, 10),
            consistency: this.clampDimension(rawBreakdown?.consistency, 10),
            readabilityAts: this.clampDimension(rawBreakdown?.readabilityAts, 10),
        };
        const rubricScore = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
        const score = rawBreakdown
            ? rubricScore
            : Math.max(0, Math.min(100, Math.round(Number(result.score) || 0)));
        return {
            score,
            breakdown,
            strengths: this.stringArray(result.strengths, 6),
            suggestions: this.stringArray(result.suggestions, 8),
            feedbackText: String(result.feedbackText || '').trim().slice(0, 3000),
            missingSections: this.stringArray(result.missingSections, 8),
            parsedAt: new Date().toISOString(),
        };
    }
    cleanText(value, max = 3500) {
        return String(value || '').trim().slice(0, max);
    }
    cleanSkills(value, limit = 40) {
        if (!Array.isArray(value))
            return [];
        return Array.from(new Set(value.map((item) => this.cleanText(item, 160)).filter(Boolean))).slice(0, limit);
    }
    profileForReview(value) {
        const profile = value && typeof value === 'object'
            ? value
            : {};
        const preferences = profile.resumePreferences && typeof profile.resumePreferences === 'object'
            ? profile.resumePreferences
            : {};
        const experiences = Array.isArray(profile.experiences)
            ? profile.experiences.slice(0, 30).map((experience) => ({
                company: this.cleanText(experience?.company, 240),
                role: this.cleanText(experience?.role, 240),
                startDate: this.cleanText(experience?.startDate, 80),
                endDate: this.cleanText(experience?.endDate, 80),
                current: Boolean(experience?.current),
                description: this.cleanText(experience?.description, 3500),
                skills: this.cleanSkills(experience?.skills, 30),
                timeline: Array.isArray(experience?.timeline)
                    ? experience.timeline.slice(0, 20).map((stage) => ({
                        role: this.cleanText(stage?.role, 240),
                        startDate: this.cleanText(stage?.startDate, 80),
                        endDate: this.cleanText(stage?.endDate, 80),
                        current: Boolean(stage?.current),
                        description: this.cleanText(stage?.description, 3000),
                        skills: this.cleanSkills(stage?.skills, 24),
                    }))
                    : [],
            }))
            : [];
        const education = Array.isArray(profile.education)
            ? profile.education.slice(0, 20).map((item) => ({
                institution: this.cleanText(item?.institution, 240),
                degree: this.cleanText(item?.degree, 240),
                fieldOfStudy: this.cleanText(item?.fieldOfStudy, 240),
                startYear: this.cleanText(item?.startYear, 40),
                endYear: this.cleanText(item?.endYear, 40),
                current: Boolean(item?.current),
                status: this.cleanText(item?.status, 80),
                description: this.cleanText(item?.description, 1800),
                skills: this.cleanSkills(item?.skills, 20),
            }))
            : [];
        const courses = Array.isArray(profile.courses)
            ? profile.courses.slice(0, 30).map((item) => ({
                name: this.cleanText(item?.name, 240),
                institution: this.cleanText(item?.institution, 240),
                year: this.cleanText(item?.year, 40),
                type: this.cleanText(item?.type, 80),
                description: this.cleanText(item?.description, 1200),
                skills: this.cleanSkills(item?.skills, 20),
            }))
            : [];
        const languages = Array.isArray(profile.languages)
            ? profile.languages.slice(0, 20).map((item) => ({
                name: this.cleanText(item?.name, 120),
                level: this.cleanText(item?.level, 120),
            }))
            : [];
        return {
            headline: this.cleanText(preferences.headline, 320),
            bio: this.cleanText(profile.bio, 4000),
            experiences,
            education,
            skills: this.cleanSkills(profile.skills, 60),
            courses,
            languages,
        };
    }
    serialize(value) {
        return String(JSON.stringify(value ?? {}) || '{}');
    }
    fnv1a(value) {
        let hash = 0x811c9dc5;
        for (let index = 0; index < value.length; index += 1) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }
    async buildSystemInstruction(profile) {
        const [behavior, memory] = await Promise.all([
            this.settingsService.getAiBehavior(),
            this.settingsService.findRelevantAiBrain(`currículo análise profissional qualidade clareza experiência formação habilidades ${this.serialize(profile).slice(0, 3500)}`, 5, 3500),
        ]);
        return [
            'Você avalia exclusivamente a QUALIDADE DO CURRÍCULO estruturado fornecido, nunca o valor, potencial ou empregabilidade da pessoa. Você NÃO recebe foto, arquivo, base64, documento-base, contato técnico, snapshot ou metadados de transporte. Portanto nunca critique, mencione ou recomende remover base64, imagens, arquivos, URLs internas ou campos que não estejam explicitamente no currículo estruturado.',
            'Use uma rubrica fixa e consistente. Cada dimensão tem um máximo e a soma obrigatória forma a nota final: summaryPositioning 0-15 (clareza e força do resumo/título), experienceStructure 0-20 (empresas, cargos, datas, progressão e organização), experienceEvidence 0-20 (qualidade das responsabilidades, escopo, resultados/evidências sem exigir números inexistentes), skills 0-15 (habilidades relevantes, organizadas e coerentes com a trajetória), educationCourses 0-10 (formação, cursos e certificações realmente informados), consistency 0-10 (coerência entre cargos, datas, descrições e habilidades), readabilityAts 0-10 (clareza textual, palavras-chave sustentadas, objetividade e leitura por recrutadores/ATS).',
            'Não trate formação acadêmica, cursos ou qualquer seção como universalmente obrigatória. Se estiver ausente, apenas atribua a pontuação correspondente ao que de fato existe e sugira inclusão quando isso puder fortalecer o documento. Nunca diga que Experiência Profissional ou Habilidades estão ausentes quando os arrays correspondentes tiverem conteúdo. Não invente informações ausentes.',
            'As sugestões devem apontar somente lacunas reais da versão recebida. Se uma melhoria anterior já resolveu um problema, não repita a mesma recomendação. Responda exclusivamente JSON válido, compacto, sem Markdown e sem texto fora do objeto.',
            behavior.name ? `Identidade configurada: ${behavior.name}.` : '',
            behavior.tone ? `Tom configurado: ${behavior.tone}` : '',
            behavior.instructions ? `Instruções gerais do administrador:\n${behavior.instructions}` : '',
            behavior.negativePrompt ? `Regras inegociáveis:\n${behavior.negativePrompt}` : '',
            memory ? `Contexto e instruções específicas recuperadas:\n${memory}` : '',
        ]
            .filter(Boolean)
            .join('\n\n');
    }
    async generateRaw(config, prompt, systemInstruction, maxTokens) {
        if (config.provider === 'OPENAI') {
            const openai = new openai_1.default({ apiKey: config.apiKey });
            const response = await openai.responses.create({
                model: config.model,
                instructions: systemInstruction,
                input: prompt,
                max_output_tokens: maxTokens,
            });
            if (response?.status === 'incomplete') {
                throw new Error(`AI_JSON_TRUNCATED:${response?.incomplete_details?.reason || 'incomplete'}`);
            }
            return String(response?.output_text || '{}');
        }
        if (config.provider === 'GROQ') {
            const anthropic = new groq_anthropic_compat_1.GroqCompat({ apiKey: config.apiKey });
            const response = await anthropic.messages.create({
                model: config.model,
                system: systemInstruction,
                max_tokens: maxTokens,
                messages: [{ role: 'user', content: prompt }],
            });
            if (response?.stop_reason === 'max_tokens')
                throw new Error('AI_JSON_TRUNCATED:max_tokens');
            return (response.content || [])
                .filter((block) => block.type === 'text')
                .map((block) => block.text)
                .join('\n');
        }
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: 'application/json',
                    maxOutputTokens: maxTokens,
                },
            }),
        });
        const raw = await response.text();
        if (!response.ok) {
            throw new Error(`Google Gemini respondeu HTTP ${response.status}${raw ? `: ${raw.slice(0, 400)}` : ''}`);
        }
        const data = JSON.parse(raw || '{}');
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
    async generate(config, prompt, systemInstruction) {
        let lastError = null;
        const budgets = [3200, 8000];
        for (let attempt = 0; attempt < budgets.length; attempt += 1) {
            try {
                const retryInstruction = attempt === 0
                    ? systemInstruction
                    : `${systemInstruction}\n\nA resposta anterior falhou por JSON inválido ou truncado. Gere novamente do zero, de forma mais compacta, e finalize obrigatoriamente todo o objeto JSON.`;
                const text = await this.generateRaw(config, prompt, retryInstruction, budgets[attempt]);
                return this.parseJson(text || '{}');
            }
            catch (error) {
                lastError = error;
                const message = error instanceof Error ? error.message : String(error || '');
                const retryable = message.includes('AI_JSON_TRUNCATED')
                    || message.includes('JSON inválido')
                    || message.includes('Unterminated string')
                    || message.includes('Expected');
                if (!retryable || attempt === budgets.length - 1)
                    throw error;
            }
        }
        throw lastError;
    }
    async review(profile) {
        const config = await this.getRuntimeConfig();
        const reviewProfile = this.profileForReview(profile);
        const resumeSignature = `resume-v1-${this.fnv1a(this.serialize(reviewProfile))}`;
        const systemInstruction = await this.buildSystemInstruction(reviewProfile);
        const prompt = `Avalie o currículo estruturado abaixo usando EXATAMENTE a rubrica definida nas instruções.\n\nCURRÍCULO ESTRUTURADO:\n${this.serialize(reviewProfile)}\n\nRetorne EXCLUSIVAMENTE este JSON:\n{"breakdown":{"summaryPositioning":0,"experienceStructure":0,"experienceEvidence":0,"skills":0,"educationCourses":0,"consistency":0,"readabilityAts":0},"strengths":[""],"suggestions":[""],"feedbackText":"","missingSections":[""]}\n\nRegras finais:\n- respeite os máximos 15,20,20,15,10,10,10;\n- não devolva score separado, o backend calcula a soma da rubrica;\n- sugestões somente sobre problemas realmente presentes nesta versão;\n- se experiences tiver itens, jamais diga que Experiência Profissional está ausente;\n- se skills tiver itens, jamais diga que Habilidades estão ausentes;\n- nunca mencione base64, imagem, arquivo ou PDF porque esses dados não fazem parte desta avaliação;\n- mantenha o JSON compacto e completo.`;
        try {
            return {
                ...this.normalize(await this.generate(config, prompt, systemInstruction)),
                resumeSignature,
            };
        }
        catch (error) {
            if (error instanceof common_1.ServiceUnavailableException)
                throw error;
            console.error('AI resume review error:', error);
            throw new common_1.InternalServerErrorException(error?.message || 'Não foi possível avaliar o currículo agora.');
        }
    }
};
exports.ResumeReviewService = ResumeReviewService;
exports.ResumeReviewService = ResumeReviewService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [settings_service_1.SettingsService])
], ResumeReviewService);
//# sourceMappingURL=resume-review.service.js.map