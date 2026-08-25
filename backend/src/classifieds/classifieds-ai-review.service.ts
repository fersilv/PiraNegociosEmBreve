import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { SettingsService } from '../admin/settings.service';

type ReviewCandidate = {
  id: string;
  title: string;
  description: string;
  categorySlug: string;
  listingType: string;
  price: string | null;
  imageUrls: string[];
};

type ReviewInput = {
  listing: ReviewCandidate;
  candidates: ReviewCandidate[];
};

type ReviewResult = {
  checked: boolean;
  duplicate: boolean;
  duplicateListingId: string | null;
  confidence: number;
  reason: string;
  provider?: string | null;
  model?: string | null;
};

@Injectable()
export class ClassifiedsAiReviewService {
  constructor(private readonly settings: SettingsService) {}

  async review(input: ReviewInput): Promise<ReviewResult> {
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
    } catch (error: any) {
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

  private async enrichPhotoSignals(input: ReviewInput) {
    const currentHashes = await this.hashImages(input.listing.imageUrls);
    const candidatePhotoHashes: Record<string, string[]> = {};
    for (const candidate of input.candidates.slice(0, 20)) {
      candidatePhotoHashes[candidate.id] = await this.hashImages(candidate.imageUrls);
    }
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

  private async hashImages(urls: string[]) {
    const hashes: string[] = [];
    for (const value of urls.slice(0, 6)) {
      const url = this.absoluteUrl(value);
      if (!url) continue;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!response.ok) continue;
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!bytes.length || bytes.length > 12 * 1024 * 1024) continue;
        hashes.push(createHash('sha256').update(bytes).digest('hex'));
      } catch {
        // A foto é apenas um sinal adicional. Falha de download nunca bloqueia publicação.
      }
    }
    return hashes;
  }

  private absoluteUrl(value: string) {
    const text = String(value || '').trim();
    if (!text) return null;
    if (/^https?:\/\//i.test(text)) return text;
    const origin = String(process.env.PUBLIC_SITE_URL || 'https://piranegocios.com.br').replace(/\/$/, '');
    return `${origin}${text.startsWith('/') ? '' : '/'}${text}`;
  }

  private parseJson(text: string) {
    const cleaned = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
    try { return JSON.parse(cleaned); } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
      throw new Error('A IA não retornou JSON válido.');
    }
  }

  private async generate(provider: string, model: string, apiKey: string, prompt: string) {
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
      if (!response.ok) throw new Error(`${provider} HTTP ${response.status}: ${raw.slice(0, 400)}`);
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
      if (!response.ok) throw new Error(`GEMINI HTTP ${response.status}: ${raw.slice(0, 400)}`);
      const data = JSON.parse(raw || '{}');
      return (data?.candidates?.[0]?.content?.parts || []).map((part: any) => part?.text || '').join('\n');
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
      if (!response.ok) throw new Error(`ANTHROPIC HTTP ${response.status}: ${raw.slice(0, 400)}`);
      const data = JSON.parse(raw || '{}');
      return (data?.content || []).filter((item: any) => item?.type === 'text').map((item: any) => item.text).join('\n');
    }

    throw new Error(`Provedor ${provider} não suportado pela revisão de classificados.`);
  }
}
