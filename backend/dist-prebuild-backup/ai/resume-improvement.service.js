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
exports.ResumeImprovementService = void 0;
const common_1 = require("@nestjs/common");
const openai_1 = __importDefault(require("openai"));
const groq_anthropic_compat_1 = require("./groq-anthropic-compat");
const settings_service_1 = require("../admin/settings.service");
let ResumeImprovementService = class ResumeImprovementService {
    settingsService;
    constructor(settingsService) {
        this.settingsService = settingsService;
    }
    isProvider(value) {
        return ['GEMINI', 'OPENAI', 'GROQ'].includes(value);
    }
    async config() {
        const enabled = (await this.settingsService.getValue('AI_ENABLED', 'false')) === 'true';
        const provider = await this.settingsService.getValue('AI_PROVIDER');
        const model = await this.settingsService.getValue('AI_MODEL');
        if (!enabled || !this.isProvider(provider) || !model) {
            throw new common_1.ServiceUnavailableException('Os recursos de inteligência artificial estão desabilitados no momento.');
        }
        const apiKey = ((await this.settingsService.getValue(`${provider}_API_KEY`)) || process.env[`${provider}_API_KEY`] || '').trim();
        if (!apiKey)
            throw new common_1.ServiceUnavailableException('O provedor de inteligência artificial ativo não possui uma chave configurada.');
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
        let candidate = this.extractJsonObject(withoutFences).trim();
        candidate = this.normalizeJsonControls(candidate);
        let lastError = null;
        for (let attempt = 0; attempt < 8; attempt += 1) {
            try {
                return JSON.parse(candidate);
            }
            catch (error) {
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
    async systemInstruction(profile) {
        const [behavior, memory] = await Promise.all([
            this.settingsService.getAiBehavior(),
            this.settingsService.findRelevantAiBrain(`currículo otimização profissional palavras-chave ATS resumo experiência clareza ${JSON.stringify(profile || {}).slice(0, 3500)}`, 5, 3500),
        ]);
        return [
            'Você é um especialista em currículo e recrutamento. Sua função é PROPOR melhorias de redação e organização sem jamais inventar fatos. Você pode tornar a linguagem mais profissional, objetiva e compatível com buscas/ATS, mas toda competência, palavra-chave, responsabilidade, resultado, formação ou experiência precisa estar sustentada pelos dados fornecidos. Não crie números, resultados, tecnologias, ferramentas, cursos ou responsabilidades ausentes. O usuário escolherá individualmente quais alterações aceitar. Responda exclusivamente JSON válido. Não use Markdown, comentários, trailing commas nem texto fora do objeto JSON. Garanta vírgula entre todos os elementos de arrays e propriedades de objetos.',
            behavior.tone ? `Tom configurado: ${behavior.tone}` : '',
            behavior.instructions ? `Instruções do administrador:\n${behavior.instructions}` : '',
            behavior.negativePrompt ? `Regras inegociáveis:\n${behavior.negativePrompt}` : '',
            memory ? `Contexto recuperado:\n${memory}` : '',
        ].filter(Boolean).join('\n\n');
    }
    async generate(config, prompt, system) {
        if (config.provider === 'OPENAI') {
            const openai = new openai_1.default({ apiKey: config.apiKey });
            const response = await openai.responses.create({
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
            const anthropic = new groq_anthropic_compat_1.GroqCompat({ apiKey: config.apiKey });
            const response = await anthropic.messages.create({
                model: config.model,
                system,
                max_tokens: 8000,
                messages: [{ role: 'user', content: prompt }],
            });
            if (response?.stop_reason === 'max_tokens')
                throw new Error('AI_JSON_TRUNCATED:max_tokens');
            const text = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('\n');
            return this.parseJson(text || '{}');
        }
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8000 },
            }),
        });
        const raw = await response.text();
        if (!response.ok)
            throw new Error(`Google Gemini respondeu HTTP ${response.status}${raw ? `: ${raw.slice(0, 400)}` : ''}`);
        const data = JSON.parse(raw || '{}');
        const candidate = data.candidates?.[0];
        if (String(candidate?.finishReason || '').toUpperCase() === 'MAX_TOKENS') {
            throw new Error('AI_JSON_TRUNCATED:MAX_TOKENS');
        }
        const text = (data.candidates || []).flatMap((item) => item.content?.parts || []).map((part) => part.text || '').filter(Boolean).join('\n');
        return this.parseJson(text || '{}');
    }
    cleanText(value, max = 4000) {
        return String(value || '').trim().slice(0, max);
    }
    cleanSkills(value) {
        if (!Array.isArray(value))
            return [];
        return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 24);
    }
    normalize(raw, profile) {
        const validTypes = new Set([
            'BIO', 'HEADLINE', 'GLOBAL_SKILLS', 'EXPERIENCE_DESCRIPTION', 'STAGE_DESCRIPTION',
        ]);
        const experiences = Array.isArray(profile.experiences) ? profile.experiences : [];
        const changes = [];
        const inputChanges = Array.isArray(raw.changes) ? raw.changes : [];
        inputChanges.slice(0, 24).forEach((item, index) => {
            const type = String(item?.type || '');
            if (!validTypes.has(type))
                return;
            const experienceIndex = Number.isInteger(Number(item?.experienceIndex)) ? Number(item.experienceIndex) : undefined;
            const stageIndex = Number.isInteger(Number(item?.stageIndex)) ? Number(item.stageIndex) : undefined;
            if ((type === 'EXPERIENCE_DESCRIPTION' || type === 'STAGE_DESCRIPTION') && (experienceIndex === undefined || experienceIndex < 0 || experienceIndex >= experiences.length))
                return;
            if (type === 'STAGE_DESCRIPTION') {
                const timeline = Array.isArray(experiences[experienceIndex]?.timeline) ? experiences[experienceIndex].timeline : [];
                if (stageIndex === undefined || stageIndex < 0 || stageIndex >= timeline.length)
                    return;
            }
            const before = type === 'GLOBAL_SKILLS' ? this.cleanSkills(item?.before) : this.cleanText(item?.before);
            const after = type === 'GLOBAL_SKILLS' ? this.cleanSkills(item?.after) : this.cleanText(item?.after);
            if (JSON.stringify(before) === JSON.stringify(after))
                return;
            if ((Array.isArray(after) && after.length === 0) || (!Array.isArray(after) && !after))
                return;
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
    profileForPrompt(profile) {
        return {
            bio: profile.bio || '',
            skills: Array.isArray(profile.skills) ? profile.skills : [],
            resumePreferences: profile.resumePreferences || {},
            experiences: (Array.isArray(profile.experiences) ? profile.experiences : []).map((experience, experienceIndex) => ({
                experienceIndex,
                company: experience?.company || '',
                role: experience?.role || '',
                description: experience?.description || '',
                skills: Array.isArray(experience?.skills) ? experience.skills : [],
                timeline: (Array.isArray(experience?.timeline) ? experience.timeline : []).map((stage, stageIndex) => ({
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
    async propose(profile) {
        const config = await this.config();
        const input = this.profileForPrompt(profile);
        const system = await this.systemInstruction(input);
        const prompt = `Analise o currículo estruturado abaixo e proponha mudanças atômicas, para que o usuário possa aceitar uma por uma. Priorize clareza, objetividade, força do resumo, descrição profissional das experiências e palavras-chave relevantes que JÁ estejam sustentadas pelo conteúdo. Não invente nada.\n\nCURRÍCULO: ${JSON.stringify(input).slice(0, 42000)}\n\nRetorne EXCLUSIVAMENTE este JSON:\n{"summary":"resumo curto do que pode melhorar","changes":[{"id":"bio-1","type":"BIO|HEADLINE|GLOBAL_SKILLS|EXPERIENCE_DESCRIPTION|STAGE_DESCRIPTION","label":"nome amigável da mudança","experienceIndex":0,"stageIndex":0,"before":"texto atual ou array atual","after":"texto sugerido ou array sugerido","reason":"por que esta mudança ajuda"}]}\n\nRegras de alvo:\n- BIO não usa experienceIndex/stageIndex;\n- HEADLINE não usa índices;\n- GLOBAL_SKILLS usa arrays em before/after;\n- EXPERIENCE_DESCRIPTION usa experienceIndex;\n- STAGE_DESCRIPTION usa experienceIndex e stageIndex;\n- preserve fatos, datas, empresas e cargos;\n- não crie métricas ou conquistas não informadas;\n- no máximo 24 mudanças;\n- JSON estritamente válido, sem Markdown e sem texto antes ou depois do objeto.`;
        try {
            let generated;
            try {
                generated = await this.generate(config, prompt, system);
            }
            catch (firstError) {
                const firstMessage = firstError instanceof Error ? firstError.message : String(firstError || '');
                const retryable = firstMessage.includes('AI_JSON_TRUNCATED')
                    || firstMessage.includes('JSON inválido')
                    || firstMessage.includes('Unterminated string')
                    || firstMessage.includes('Expected');
                if (!retryable)
                    throw firstError;
                generated = await this.generate(config, `${prompt}\n\nIMPORTANTE: gere uma resposta mais compacta. Se necessário, reduza a quantidade de mudanças para concluir integralmente o JSON.`, `${system}\n\nA tentativa anterior veio truncada ou com JSON inválido. Gere novamente do zero e finalize obrigatoriamente todo o objeto JSON.`);
            }
            return this.normalize(generated, profile);
        }
        catch (error) {
            if (error instanceof common_1.ServiceUnavailableException)
                throw error;
            console.error('AI resume improvement error:', error);
            throw new common_1.InternalServerErrorException(error?.message || 'Não foi possível gerar as melhorias do currículo agora.');
        }
    }
    applySelected(profile, proposal, selectedIds) {
        const selected = new Set(selectedIds);
        let bio = profile.bio || '';
        let skills = Array.isArray(profile.skills) ? [...profile.skills] : [];
        let resumePreferences = { ...(profile.resumePreferences || {}) };
        const experiences = JSON.parse(JSON.stringify(Array.isArray(profile.experiences) ? profile.experiences : []));
        for (const change of proposal.changes || []) {
            if (!selected.has(change.id))
                continue;
            if (change.type === 'BIO' && typeof change.after === 'string')
                bio = change.after;
            if (change.type === 'HEADLINE' && typeof change.after === 'string') {
                resumePreferences = { ...resumePreferences, headline: change.after, showHeadline: true };
            }
            if (change.type === 'GLOBAL_SKILLS' && Array.isArray(change.after))
                skills = this.cleanSkills(change.after);
            if (change.type === 'EXPERIENCE_DESCRIPTION' && typeof change.after === 'string' && change.experienceIndex !== undefined && experiences[change.experienceIndex]) {
                experiences[change.experienceIndex].description = change.after;
            }
            if (change.type === 'STAGE_DESCRIPTION' && typeof change.after === 'string' && change.experienceIndex !== undefined && change.stageIndex !== undefined) {
                const timeline = experiences[change.experienceIndex]?.timeline;
                if (Array.isArray(timeline) && timeline[change.stageIndex])
                    timeline[change.stageIndex].description = change.after;
            }
        }
        return { bio, skills, resumePreferences, experiences };
    }
};
exports.ResumeImprovementService = ResumeImprovementService;
exports.ResumeImprovementService = ResumeImprovementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [settings_service_1.SettingsService])
], ResumeImprovementService);
//# sourceMappingURL=resume-improvement.service.js.map