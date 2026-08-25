import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { SettingsService } from '../admin/settings.service';

type Provider = 'GEMINI' | 'OPENAI' | 'ANTHROPIC';

type Runtime = { provider: Provider; model: string; apiKey: string };

export type WhatsAppConciergeDecision = {
  intent: string;
  reply: string;
  args?: Record<string, unknown>;
  statePatch?: Record<string, unknown>;
  requiresConfirmation?: boolean;
};

@Injectable()
export class WhatsAppAiService {
  constructor(private readonly settings: SettingsService) {}

  async decide(input: {
    actor: Record<string, unknown>;
    contextMode: string;
    activeFlow?: string | null;
    flowState?: Record<string, unknown>;
    messages: string[];
    history: Array<{ direction: string; body: string | null; createdAt?: unknown }>;
    availableContext?: Record<string, unknown>;
  }): Promise<WhatsAppConciergeDecision> {
    const runtime = await this.runtime();
    const system = `Você é o atendimento oficial do PiraNegócios pelo WhatsApp. Fale em português brasileiro de forma natural, curta e útil.
Você NÃO executa ações por conta própria: classifique a intenção para que o backend execute apenas ações autorizadas. Nunca invente resultado de consulta.
Quando houver uma ação destrutiva ou publicação definitiva, requiresConfirmation deve ser true.
Responda exclusivamente JSON válido no formato {"intent":"...","reply":"...","args":{},"statePatch":{},"requiresConfirmation":false}.

INTENTS DE CANDIDATO:
CHAT, LIST_APPLICATIONS, JOB_MATCHES, GET_RESUME, SET_RESUME_PHOTO, IMPORT_RESUME, START_RESUME_CREATE, CONTINUE_RESUME_CREATE, CONFIRM_RESUME_CREATE, CANCEL_FLOW.
INTENTS DE EMPRESA:
LIST_COMPANY_JOBS, JOB_APPLICATION_COUNTS, JOB_MATCH_CANDIDATES, START_JOB_CREATE, CONTINUE_JOB_CREATE, CONFIRM_JOB_CREATE, START_JOB_EDIT, CONTINUE_JOB_EDIT, CONFIRM_JOB_EDIT, CANCEL_FLOW.
INTENTS ADMINISTRATIVOS:
ADMIN_STATUS, CHAT.

REGRAS DO FLUXO DE CURRÍCULO:
- START_RESUME_CREATE inicia a coleta de dados quando a pessoa pede para montar/criar currículo do zero.
- Se FLUXO ATIVO for RESUME_CREATE, use CONTINUE_RESUME_CREATE enquanto estiver coletando/corrigindo informações.
- CONTINUE_RESUME_CREATE deve extrair SOMENTE dados que a pessoa realmente informou em args.patch.
- args.patch pode conter: fullName, city, state, bio, experiences, education, skills, courses, languages, phone, additionalPhones.
- experiences deve ser uma lista de objetos com company, role, startDate, endDate/current, description e skills quando esses dados forem informados.
- education deve ser uma lista de objetos com institution, degree, fieldOfStudy, startYear, endYear/current/status quando informados.
- skills é lista de strings. courses e languages são listas estruturadas somente quando houver informação suficiente.
- Não invente empresa, cargo, datas, formação, habilidade ou atividade profissional.
- CONFIRM_RESUME_CREATE somente quando a pessoa explicitamente disser para salvar/finalizar e os dados essenciais estiverem coletados.
- Documentos/fotos podem complementar o fluxo, mas IMPORT_RESUME deve ser usado quando a pessoa pede explicitamente para extrair/organizar os documentos.

REGRAS DO FLUXO DE VAGA:
- START_JOB_CREATE inicia coleta de dados.
- Se FLUXO ATIVO for JOB_CREATE, use CONTINUE_JOB_CREATE enquanto estiver coletando/corrigindo campos.
- CONTINUE_JOB_CREATE deve extrair do texto somente campos realmente informados em args.patch. Campos possíveis: title, description, requirements, skills, location, city, state, type, workModel, salary, pcdMode, deadlineDate, acceptsPlatformApplications.
- Nunca publique vaga sem CONFIRM_JOB_CREATE e confirmação explícita do usuário.
- Se FLUXO ATIVO for JOB_EDIT, use CONTINUE_JOB_EDIT até confirmação explícita.
- Para edição, informe jobId em args quando identificado e args.patch apenas com o que foi solicitado.
- CANCEL_FLOW quando a pessoa disser cancelar, parar, desistir ou equivalente.

REGRAS DE MÍDIA:
- SET_RESUME_PHOTO somente quando a pessoa disser que a imagem enviada deve ser a foto do currículo.
- IMPORT_RESUME somente quando houver documento/foto profissional e a pessoa pedir para extrair, organizar ou montar o currículo a partir dele.
- Não confunda imagem comum com foto de currículo ou documento.`;
    const prompt = `ATOR\n${JSON.stringify(input.actor).slice(0, 7000)}\n\nMODO\n${input.contextMode}\nFLUXO ATIVO\n${input.activeFlow || 'nenhum'}\nESTADO DO FLUXO\n${JSON.stringify(input.flowState || {}).slice(0, 9000)}\n\nCONTEXTO DISPONÍVEL\n${JSON.stringify(input.availableContext || {}).slice(0, 10000)}\n\nHISTÓRICO RECENTE\n${JSON.stringify(input.history.slice(-16)).slice(0, 12000)}\n\nNOVO BLOCO DE MENSAGENS\n${input.messages.join('\n')}\n\nClassifique a intenção e escreva uma resposta curta apropriada. Para consultas, apenas reconheça o pedido, porque o backend anexará o resultado real. Se houver fluxo ativo, preserve-o salvo se a pessoa cancelar ou mudar claramente de assunto.`;
    const text = await this.generate(runtime, prompt, system, true, 1800);
    return this.parseDecision(text);
  }

  async composeReply(input: {
    firstName?: string | null;
    request: string;
    result: unknown;
    contextMode: string;
  }) {
    const runtime = await this.runtime();
    const system = 'Você redige respostas curtas de atendimento do PiraNegócios no WhatsApp. Use somente o resultado fornecido. Não invente dados. Não use markdown pesado. Se houver links, preserve-os exatamente.';
    const prompt = `Nome: ${input.firstName || 'pessoa'}\nModo: ${input.contextMode}\nPedido: ${input.request}\nResultado real do sistema: ${JSON.stringify(input.result).slice(0, 16000)}\n\nResponda de forma direta e natural.`;
    return (await this.generate(runtime, prompt, system, false, 1000)).trim();
  }

  async explainOperationalError(input: { title: string; error: string; context: Record<string, unknown> }) {
    const runtime = await this.runtime();
    const system = 'Você é analista de operações. Interprete erros de uma integração WPPConnect/NestJS do PiraNegócios. Seja objetivo. Não invente certeza. Dê hipótese provável, impacto e próximos passos seguros. Nunca inclua segredos, tokens ou credenciais.';
    const prompt = `Ocorrência: ${input.title}\nErro: ${input.error.slice(0, 9000)}\nContexto: ${JSON.stringify(input.context).slice(0, 6000)}\n\nProduza uma análise curta com provável causa e resolução sugerida.`;
    return (await this.generate(runtime, prompt, system, false, 900)).trim();
  }

  private async runtime(): Promise<Runtime> {
    const enabled = (await this.settings.getValue('AI_ENABLED', 'false')) === 'true';
    const provider = String(await this.settings.getValue('AI_PROVIDER') || '') as Provider;
    const model = String(await this.settings.getValue('AI_MODEL') || '').trim();
    if (!enabled || !['GEMINI', 'OPENAI', 'ANTHROPIC'].includes(provider) || !model) {
      throw new ServiceUnavailableException('A inteligência artificial está desabilitada ou sem modelo configurado.');
    }
    const apiKey = String((await this.settings.getValue(`${provider}_API_KEY`)) || process.env[`${provider}_API_KEY`] || '').trim();
    if (!apiKey) throw new ServiceUnavailableException('O provedor de IA ativo não possui chave configurada.');
    return { provider, model, apiKey };
  }

  private async generate(runtime: Runtime, prompt: string, system: string, json: boolean, maxTokens: number) {
    if (runtime.provider === 'OPENAI') {
      const client = new OpenAI({ apiKey: runtime.apiKey });
      const response = await client.responses.create({
        model: runtime.model,
        instructions: system,
        input: prompt,
        max_output_tokens: maxTokens,
        ...(json ? { text: { format: { type: 'json_object' } } } : {}),
      } as any);
      return String(response.output_text || '');
    }
    if (runtime.provider === 'ANTHROPIC') {
      const client = new Anthropic({ apiKey: runtime.apiKey });
      const response = await client.messages.create({
        model: runtime.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      });
      return response.content.filter((part: any) => part.type === 'text').map((part: any) => part.text).join('\n');
    }
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(runtime.model)}:generateContent?key=${encodeURIComponent(runtime.apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { ...(json ? { responseMimeType: 'application/json' } : {}), maxOutputTokens: maxTokens },
      }),
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`Gemini HTTP ${response.status}: ${raw.slice(0, 500)}`);
    const payload = JSON.parse(raw || '{}') as any;
    return (payload.candidates || []).flatMap((item: any) => item.content?.parts || []).map((part: any) => part.text || '').join('\n');
  }

  private parseDecision(text: string): WhatsAppConciergeDecision {
    const cleaned = String(text || '{}').replace(/```json/gi, '').replace(/```/g, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      parsed = start >= 0 && end > start ? JSON.parse(cleaned.slice(start, end + 1)) : {};
    }
    return {
      intent: String(parsed.intent || 'CHAT').trim().toUpperCase(),
      reply: String(parsed.reply || '').trim(),
      args: parsed.args && typeof parsed.args === 'object' ? parsed.args : {},
      statePatch: parsed.statePatch && typeof parsed.statePatch === 'object' ? parsed.statePatch : {},
      requiresConfirmation: Boolean(parsed.requiresConfirmation),
    };
  }
}
