import { Injectable } from '@nestjs/common';
import { SettingsService } from '../admin/settings.service';

export type ReviewModerationResult = {
  checked: boolean;
  decision: 'APPROVE' | 'REJECT' | 'MANUAL';
  reason: string;
  provider?: string | null;
  model?: string | null;
};

@Injectable()
export class ClassifiedsReviewModerationService {
  constructor(private readonly settings: SettingsService) {}

  async moderate(input: { comment?: string | null; photoUrls?: string[]; ratings: Record<string, number | null> }): Promise<ReviewModerationResult> {
    const enabled = (await this.settings.getValue('AI_ENABLED', 'false')) === 'true';
    const provider = String(await this.settings.getValue('AI_PROVIDER') || '').toUpperCase();
    const model = String(await this.settings.getValue('AI_MODEL') || '').trim();
    if (!enabled || !provider || !model) {
      return { checked: false, decision: 'MANUAL', reason: 'A moderação por IA está indisponível; a avaliação não será publicada automaticamente.' };
    }
    const keyName = `${provider}_API_KEY`;
    const apiKey = String((await this.settings.getValue(keyName)) || process.env[keyName] || '').trim();
    if (!apiKey) return { checked: false, decision: 'MANUAL', reason: 'Chave do provedor de IA indisponível.', provider, model };

    const comment = String(input.comment || '').trim();
    const photos = Array.isArray(input.photoUrls) ? input.photoUrls.slice(0, 4) : [];
    const prompt = [
      'Você modera avaliações de compradores verificados de um marketplace regional brasileiro.',
      'Avaliações negativas e críticas objetivas DEVEM ser permitidas. Não proteja a empresa de críticas legítimas.',
      'REJEITE somente conteúdo claramente abusivo: insultos direcionados, humilhação, ameaça, discurso de ódio, assédio, exposição de dados pessoais, acusação criminosa apresentada como fato sem contexto, conteúdo sexual explícito ou incentivo a violência.',
      'Se houver linguagem ríspida mas ainda focada na experiência de compra, prefira APPROVE.',
      'Se houver dúvida séria, use MANUAL.',
      'Fotos são opcionais. Como você pode não ter acesso visual confiável às URLs, nunca declare uma foto segura sem vê-la. Quando photoCount > 0, use MANUAL salvo se o próprio conteúdo textual já exigir REJECT.',
      'Responda APENAS JSON válido: {"decision":"APPROVE|REJECT|MANUAL","reason":"texto curto"}.',
      JSON.stringify({ ratings: input.ratings, comment: comment || null, photoCount: photos.length, photoUrls: photos }),
    ].join('\n');

    try {
      const raw = await this.generate(provider, model, apiKey, prompt);
      const parsed = this.parseJson(raw);
      const requested = String(parsed?.decision || '').toUpperCase();
      let decision: 'APPROVE'|'REJECT'|'MANUAL' = requested === 'REJECT' ? 'REJECT' : requested === 'APPROVE' ? 'APPROVE' : 'MANUAL';
      if (photos.length && decision === 'APPROVE') decision = 'MANUAL';
      return {
        checked: true,
        decision,
        reason: String(parsed?.reason || (decision === 'APPROVE' ? 'Conteúdo adequado.' : 'Revisão necessária.')).slice(0, 1200),
        provider,
        model,
      };
    } catch (error: any) {
      return { checked: false, decision: 'MANUAL', reason: `Falha na moderação automática: ${String(error?.message || error).slice(0, 700)}`, provider, model };
    }
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
        body: JSON.stringify({ model, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Modere conteúdo sem censurar críticas legítimas.' }, { role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(20_000),
      });
      const raw = await response.text();
      if (!response.ok) throw new Error(`${provider} HTTP ${response.status}: ${raw.slice(0, 300)}`);
      const data = JSON.parse(raw || '{}');
      return String(data?.choices?.[0]?.message?.content || '');
    }
    if (provider === 'GEMINI') {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }),
        signal: AbortSignal.timeout(20_000),
      });
      const raw = await response.text();
      if (!response.ok) throw new Error(`GEMINI HTTP ${response.status}: ${raw.slice(0, 300)}`);
      const data = JSON.parse(raw || '{}');
      return (data?.candidates?.[0]?.content?.parts || []).map((part: any) => part?.text || '').join('\n');
    }
    if (provider === 'ANTHROPIC') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 700, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(20_000),
      });
      const raw = await response.text();
      if (!response.ok) throw new Error(`ANTHROPIC HTTP ${response.status}: ${raw.slice(0, 300)}`);
      const data = JSON.parse(raw || '{}');
      return (data?.content || []).filter((item: any) => item?.type === 'text').map((item: any) => item.text).join('\n');
    }
    throw new Error(`Provedor ${provider} não suportado.`);
  }
}
