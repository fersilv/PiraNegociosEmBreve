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
exports.JobSkillsService = void 0;
const common_1 = require("@nestjs/common");
const openai_1 = __importDefault(require("openai"));
const groq_anthropic_compat_1 = require("./groq-anthropic-compat");
const settings_service_1 = require("../admin/settings.service");
let JobSkillsService = class JobSkillsService {
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
            throw new Error('O provedor retornou uma resposta fora do formato JSON.');
        }
    }
    async buildInstruction(taskContext) {
        const [behavior, memory] = await Promise.all([
            this.settingsService.getAiBehavior(),
            this.settingsService.findRelevantAiBrain(taskContext, 5, 3500),
        ]);
        return [
            'Você é um especialista em recrutamento, cargos e competências profissionais. Responda sempre em JSON válido e não invente requisitos que não estejam sustentados pelo cargo ou pela descrição fornecida.',
            behavior.name ? `Seu nome configurado é ${behavior.name}.` : '',
            behavior.tone ? `Tom de voz configurado: ${behavior.tone}` : '',
            behavior.instructions ? `Instruções do administrador:\n${behavior.instructions}` : '',
            behavior.negativePrompt
                ? `Regras que jamais podem ser violadas:\n${behavior.negativePrompt}`
                : '',
            memory ? `Memória relevante da plataforma:\n${memory}` : '',
        ]
            .filter(Boolean)
            .join('\n\n');
    }
    async generateJson(config, prompt, systemInstruction, maxOutputTokens = 1800) {
        if (config.provider === 'OPENAI') {
            const openai = new openai_1.default({ apiKey: config.apiKey });
            const response = await openai.responses.create({
                model: config.model,
                instructions: systemInstruction,
                input: prompt,
                max_output_tokens: maxOutputTokens,
            });
            return this.parseJson(response.output_text || '{}');
        }
        if (config.provider === 'GROQ') {
            const anthropic = new groq_anthropic_compat_1.GroqCompat({ apiKey: config.apiKey });
            const response = await anthropic.messages.create({
                model: config.model,
                system: systemInstruction,
                max_tokens: maxOutputTokens,
                messages: [{ role: 'user', content: prompt }],
            });
            const text = response.content
                .filter((block) => block.type === 'text')
                .map((block) => block.text)
                .join('\n');
            return this.parseJson(text || '{}');
        }
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: 'application/json',
                    maxOutputTokens,
                },
            }),
        });
        const raw = await response.text();
        if (!response.ok) {
            throw new Error(`Google Gemini respondeu HTTP ${response.status}${raw ? `: ${raw.slice(0, 400)}` : ''}`);
        }
        const data = JSON.parse(raw || '{}');
        const text = (data.candidates || [])
            .flatMap((candidate) => candidate.content?.parts || [])
            .map((part) => part.text || '')
            .filter(Boolean)
            .join('\n');
        return this.parseJson(text || '{}');
    }
    normalizeSkills(value, limit = 10) {
        if (!Array.isArray(value))
            return [];
        const seen = new Set();
        const skills = [];
        for (const item of value) {
            if (typeof item !== 'string')
                continue;
            const skill = item.trim().replace(/\s+/g, ' ').slice(0, 80);
            if (!skill)
                continue;
            const key = skill.toLocaleLowerCase('pt-BR');
            if (seen.has(key))
                continue;
            seen.add(key);
            skills.push(skill);
            if (skills.length === limit)
                break;
        }
        return skills;
    }
    collectCandidateSkills(profile) {
        const data = profile && typeof profile === 'object' ? profile : {};
        const direct = this.normalizeSkills(data.skills, 40);
        const fromExperiences = Array.isArray(data.experiences)
            ? data.experiences.flatMap((experience) => this.normalizeSkills(experience?.skills, 20))
            : [];
        return this.normalizeSkills([...direct, ...fromExperiences], 50);
    }
    normalizeMatches(value) {
        if (!Array.isArray(value))
            return [];
        return value
            .map((item) => ({
            jobSkill: String(item?.jobSkill || '').slice(0, 80),
            candidateSkill: String(item?.candidateSkill || '').slice(0, 80),
            score: Math.max(0, Math.min(100, Number(item?.score) || 0)),
        }))
            .filter((item) => Boolean(item.jobSkill))
            .slice(0, 10);
    }
    async suggestSkills(title, description, requirements) {
        const cleanTitle = String(title || '').trim().slice(0, 180);
        const cleanDescription = String(description || '').trim().slice(0, 7000);
        const cleanRequirements = String(requirements || '').trim().slice(0, 4000);
        if (!cleanTitle || !cleanDescription) {
            throw new common_1.BadRequestException('Informe o cargo e uma descrição da vaga antes de sugerir habilidades.');
        }
        const config = await this.getRuntimeConfig();
        const systemInstruction = await this.buildInstruction(`sugestão de habilidades para vaga cargo ${cleanTitle} ${cleanDescription.slice(0, 2500)} ${cleanRequirements.slice(0, 1200)}`);
        const prompt = `Sugira de 3 a 10 habilidades relevantes para esta vaga. Use nomes curtos e canônicos, adequados para comparação entre currículos e vagas. Misture competências técnicas e comportamentais somente quando forem realmente pertinentes. Não inclua escolaridade, disponibilidade, salário, benefícios ou tempo de experiência como habilidade.\n\nCARGO: ${cleanTitle}\nDESCRIÇÃO: ${cleanDescription}\nREQUISITOS: ${cleanRequirements || 'Não informado'}\n\nRetorne EXCLUSIVAMENTE:\n{"skills":["Habilidade 1","Habilidade 2"]}`;
        try {
            const result = await this.generateJson(config, prompt, systemInstruction);
            return { skills: this.normalizeSkills(result?.skills) };
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException ||
                error instanceof common_1.ServiceUnavailableException) {
                throw error;
            }
            console.error('AI job skill suggestion error:', error);
            throw new common_1.InternalServerErrorException(error?.message || 'Não foi possível sugerir habilidades agora.');
        }
    }
    async scoreCompatibility(candidateSkills, jobSkills) {
        const candidate = this.normalizeSkills(candidateSkills, 50);
        const job = this.normalizeSkills(jobSkills);
        if (candidate.length === 0 || job.length === 0) {
            return { score: 0, matches: [] };
        }
        const config = await this.getRuntimeConfig();
        const systemInstruction = await this.buildInstruction(`compatibilidade semântica entre habilidades candidato ${candidate.join(', ')} vaga ${job.join(', ')}`);
        const prompt = `Compare semanticamente as habilidades do candidato com as habilidades exigidas pela vaga. Não dependa de texto idêntico: traduções, sinônimos, tecnologias relacionadas e competências de mesma família podem ter compatibilidade parcial. Porém não trate conhecimentos apenas vagamente relacionados como equivalentes.\n\nHABILIDADES DO CANDIDATO: ${JSON.stringify(candidate)}\nHABILIDADES DA VAGA: ${JSON.stringify(job)}\n\nPara CADA habilidade da vaga, escolha no máximo uma habilidade do candidato que melhor corresponda e dê score de 0 a 100:\n100 = equivalente ou praticamente a mesma competência\n80-99 = fortemente equivalente\n50-79 = relacionada e parcialmente transferível\n20-49 = relação fraca\n0-19 = sem compatibilidade útil\n\nO score geral deve representar a cobertura das habilidades da vaga, dando peso igual para cada habilidade da vaga. Habilidades não cobertas contam como zero.\nRetorne EXCLUSIVAMENTE:\n{"score":0,"matches":[{"jobSkill":"","candidateSkill":"","score":0}]}`;
        try {
            const result = await this.generateJson(config, prompt, systemInstruction);
            return {
                score: Math.max(0, Math.min(100, Number(result?.score) || 0)),
                matches: this.normalizeMatches(result?.matches),
            };
        }
        catch (error) {
            if (error instanceof common_1.ServiceUnavailableException)
                throw error;
            console.error('AI skill compatibility error:', error);
            throw new common_1.InternalServerErrorException(error?.message || 'Não foi possível calcular compatibilidade de habilidades.');
        }
    }
    async scoreJobs(profile, jobs) {
        const candidateSkills = this.collectCandidateSkills(profile);
        const normalizedJobs = (Array.isArray(jobs) ? jobs : [])
            .slice(0, 100)
            .map((job) => ({
            jobId: String(job?.id || '').slice(0, 120),
            title: String(job?.title || '').slice(0, 180),
            skills: this.normalizeSkills(job?.skills),
        }))
            .filter((job) => job.jobId && job.skills.length > 0);
        if (candidateSkills.length === 0 || normalizedJobs.length === 0) {
            return { scores: [] };
        }
        const config = await this.getRuntimeConfig();
        const systemInstruction = await this.buildInstruction(`matching em lote de habilidades candidato ${candidateSkills.join(', ')} vagas ${normalizedJobs
            .map((job) => `${job.title}: ${job.skills.join(', ')}`)
            .join(' | ')
            .slice(0, 5000)}`);
        const prompt = `Calcule em UMA ÚNICA ANÁLISE a compatibilidade semântica das habilidades do candidato com cada vaga.\n\nHABILIDADES DO CANDIDATO: ${JSON.stringify(candidateSkills)}\nVAGAS: ${JSON.stringify(normalizedJobs)}\n\nPara cada habilidade de cada vaga, escolha a habilidade do candidato mais compatível e dê score de 0 a 100:\n100 = equivalente ou praticamente a mesma competência\n80-99 = fortemente equivalente, incluindo traduções e sinônimos\n50-79 = relacionada e parcialmente transferível\n20-49 = relação fraca\n0-19 = sem compatibilidade útil\n\nO score de cada vaga é a cobertura média das habilidades daquela vaga. Habilidade sem cobertura conta como zero. Não aumente a nota apenas porque o candidato possui muitas habilidades que a vaga não pediu.\n\nRetorne EXCLUSIVAMENTE:\n{"scores":[{"jobId":"id","score":0,"matches":[{"jobSkill":"","candidateSkill":"","score":0}]}]}`;
        try {
            const result = await this.generateJson(config, prompt, systemInstruction, Math.min(6000, Math.max(1800, normalizedJobs.length * 240)));
            const validIds = new Set(normalizedJobs.map((job) => job.jobId));
            const scores = Array.isArray(result?.scores)
                ? result.scores
                    .map((item) => ({
                    jobId: String(item?.jobId || ''),
                    score: Math.max(0, Math.min(100, Number(item?.score) || 0)),
                    matches: this.normalizeMatches(item?.matches),
                }))
                    .filter((item) => validIds.has(item.jobId))
                : [];
            return { scores };
        }
        catch (error) {
            if (error instanceof common_1.ServiceUnavailableException)
                throw error;
            console.error('AI batch skill compatibility error:', error);
            return { scores: [] };
        }
    }
};
exports.JobSkillsService = JobSkillsService;
exports.JobSkillsService = JobSkillsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [settings_service_1.SettingsService])
], JobSkillsService);
//# sourceMappingURL=job-skills.service.js.map