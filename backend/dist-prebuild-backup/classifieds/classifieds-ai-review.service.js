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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassifiedsAiReviewService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const settings_service_1 = require("../admin/settings.service");
let ClassifiedsAiReviewService = class ClassifiedsAiReviewService {
    settings;
    constructor(settings) {
        this.settings = settings;
    }
    async review(input) {
        const enabled = (await this.settings.getValue('AI_ENABLED', 'false')) === 'true';
        const provider = String(await this.settings.getValue('AI_PROVIDER') || '').toUpperCase();
        const model = String(await this.settings.getValue('AI_MODEL') || '').trim();
        if (!enabled || !provider || !model) {
            return { checked: false, duplicate: false, duplicateListingId: null, confidence: 0, reason: 'AI_DISABLED' };
        }
        const keyName = `${provider}_API_KEY`;
        const apiKey = String((await this.settings.getValue(keyName)) || process.env[keyName] || '').trim();
        if (!apiKey) {
            return { checked: false, duplicate: false, duplicateListingId: null, confidence: 0, reason: 'AI_KEY_MISSING', provider, model };
        }
        const enriched = await this.enrichPhotoSignals(input);
        const prompt = [
            'Você revisa anúncios de um marketplace regional brasileiro para detectar DUPLICATAS do mesmo anunciante.',
            'Só marque duplicate=true quando o anúncio novo representar essencialmente o MESMO produto físico ou o MESMO serviço já anunciado.',
            'Produtos apenas parecidos, variantes legítimas, cores/tamanhos diferentes ou serviços distintos NÃO são duplicatas.',
            'photoHashMatches contém IDs de anúncios anteriores que reutilizam ao menos uma foto com bytes idênticos. É um sinal forte, mas avalie junto com título/descrição.',
            'Responda APENAS JSON válido no formato:',
            '{"duplicate":boolean,"duplicateListingId":string|null,"confidence":number,"reason":string}',
            'confidence deve ficar entre 0 e 1. Só use duplicate=true quando confidence >= 0.80.',
            JSON.stringify(enriched),
        ].join('\n');
        try {
            const raw = await this.generate(provider, model, apiKey, prompt);
            const parsed = this.parseJson(raw);
            const confidence = Math.max(0, Math.min(1, Number(parsed?.confidence) || 0));
            const duplicateListingId = typeof parsed?.duplicateListingId === 'string'
                && input.candidates.some((item) => item.id === parsed.duplicateListingId)
                ? parsed.duplicateListingId
                : null;
            const duplicate = Boolean(parsed?.duplicate && duplicateListingId && confidence >= 0.8);
            return {
                checked: true,
                duplicate,
                duplicateListingId: duplicate ? duplicateListingId : null,
                confidence,
                reason: String(parsed?.reason || (duplicate ? 'Possível anúncio duplicado.' : 'Nenhuma duplicidade forte identificada.')).slice(0, 1200),
                provider,
                model,
            };
        }
        catch (error) {
            return {
                checked: false,
                duplicate: false,
                duplicateListingId: null,
                confidence: 0,
                reason: `AI_ERROR: ${String(error?.message || error).slice(0, 700)}`,
                provider,
                model,
            };
        }
    }
    async enrichPhotoSignals(input) {
        const photoCandidates = input.candidates.slice(0, 8);
        const [currentHashes, candidatePairs] = await Promise.all([
            this.hashImages(input.listing.imageUrls.slice(0, 6)),
            Promise.all(photoCandidates.map(async (candidate) => [candidate.id, await this.hashImages(candidate.imageUrls.slice(0, 2))])),
        ]);
        const candidatePhotoHashes = Object.fromEntries(candidatePairs);
        const currentSet = new Set(currentHashes);
        const photoHashMatches = Object.entries(candidatePhotoHashes)
            .filter(([, hashes]) => hashes.some((hash) => currentSet.has(hash)))
            .map(([id]) => id);
        return {
            listing: {
                id: input.listing.id,
                title: input.listing.title,
                description: input.listing.description,
                categorySlug: input.listing.categorySlug,
                listingType: input.listing.listingType,
                price: input.listing.price,
                photoCount: input.listing.imageUrls.length,
            },
            candidates: input.candidates.slice(0, 20).map((candidate) => ({
                id: candidate.id,
                title: candidate.title,
                description: candidate.description,
                categorySlug: candidate.categorySlug,
                listingType: candidate.listingType,
                price: candidate.price,
                photoCount: candidate.imageUrls.length,
            })),
            photoHashMatches,
        };
    }
    async hashImages(urls) {
        const results = await Promise.all(urls.map(async (value) => {
            const url = this.absoluteUrl(value);
            if (!url)
                return null;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3500);
            try {
                const response = await fetch(url, { signal: controller.signal });
                if (!response.ok)
                    return null;
                const bytes = Buffer.from(await response.arrayBuffer());
                if (!bytes.length || bytes.length > 12 * 1024 * 1024)
                    return null;
                return (0, crypto_1.createHash)('sha256').update(bytes).digest('hex');
            }
            catch {
                return null;
            }
            finally {
                clearTimeout(timer);
            }
        }));
        return results.filter((hash) => Boolean(hash));
    }
    absoluteUrl(value) {
        const text = String(value || '').trim();
        if (!text)
            return null;
        if (/^https?:\/\//i.test(text))
            return text;
        const origin = String(process.env.PUBLIC_SITE_URL || 'https://piranegocios.com.br').replace(/\/$/, '');
        return `${origin}${text.startsWith('/') ? '' : '/'}${text}`;
    }
    parseJson(text) {
        const cleaned = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
        try {
            return JSON.parse(cleaned);
        }
        catch {
            const start = cleaned.indexOf('{');
            const end = cleaned.lastIndexOf('}');
            if (start >= 0 && end > start)
                return JSON.parse(cleaned.slice(start, end + 1));
            throw new Error('A IA não retornou JSON válido.');
        }
    }
    async generate(provider, model, apiKey, prompt) {
        if (provider === 'GROQ' || provider === 'OPENAI') {
            const base = provider === 'GROQ' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1';
            const response = await fetch(`${base}/chat/completions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model,
                    temperature: 0,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: 'Você é um moderador conservador de marketplace. Evite falsos positivos.' },
                        { role: 'user', content: prompt },
                    ],
                }),
            });
            const raw = await response.text();
            if (!response.ok)
                throw new Error(`${provider} HTTP ${response.status}: ${raw.slice(0, 400)}`);
            const data = JSON.parse(raw || '{}');
            return String(data?.choices?.[0]?.message?.content || '');
        }
        if (provider === 'GEMINI') {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
                }),
            });
            const raw = await response.text();
            if (!response.ok)
                throw new Error(`GEMINI HTTP ${response.status}: ${raw.slice(0, 400)}`);
            const data = JSON.parse(raw || '{}');
            return (data?.candidates?.[0]?.content?.parts || []).map((part) => part?.text || '').join('\n');
        }
        if (provider === 'ANTHROPIC') {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({ model, max_tokens: 1200, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
            });
            const raw = await response.text();
            if (!response.ok)
                throw new Error(`ANTHROPIC HTTP ${response.status}: ${raw.slice(0, 400)}`);
            const data = JSON.parse(raw || '{}');
            return (data?.content || []).filter((item) => item?.type === 'text').map((item) => item.text).join('\n');
        }
        throw new Error(`Provedor ${provider} não suportado pela revisão de classificados.`);
    }
};
exports.ClassifiedsAiReviewService = ClassifiedsAiReviewService;
exports.ClassifiedsAiReviewService = ClassifiedsAiReviewService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [settings_service_1.SettingsService])
], ClassifiedsAiReviewService);
//# sourceMappingURL=classifieds-ai-review.service.js.map