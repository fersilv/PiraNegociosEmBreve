import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppAiService } from './whatsapp-ai.service';

export type WhatsAppAlertSeverity = 'INFO' | 'ATTENTION' | 'CRITICAL';

@Injectable()
export class WhatsAppAlertService {
  private readonly logger = new Logger(WhatsAppAlertService.name);
  private readonly apiUrl = 'https://api.resend.com/emails';

  constructor(private readonly ai: WhatsAppAiService) {}

  async send(input: {
    severity: WhatsAppAlertSeverity;
    title: string;
    instanceName?: string | null;
    instanceId?: string | null;
    error?: unknown;
    context?: Record<string, unknown>;
  }) {
    const apiKey = String(process.env.RESEND_API_KEY || '').trim();
    const from = String(process.env.TRANSACTIONAL_EMAIL_FROM || '').trim();
    const to = String(process.env.WHATSAPP_ALERT_EMAIL || 'aviso@piranegocios.com.br').trim();
    if (!apiKey || !from || !to) {
      this.logger.warn(`Alerta WhatsApp não enviado por falta de configuração: ${input.title}`);
      return { status: 'NOT_CONFIGURED' as const };
    }

    const rawError = this.errorText(input.error);
    let diagnosis = '';
    if (rawError) {
      try {
        diagnosis = await this.ai.explainOperationalError({
          title: input.title,
          error: rawError,
          context: input.context || {},
        });
      } catch (error) {
        this.logger.warn(`Não foi possível interpretar erro WhatsApp com IA: ${this.errorText(error)}`);
      }
    }

    const subject = `[${input.severity}] WhatsApp PiraNegócios — ${input.title}`;
    const instance = input.instanceName
      ? `${input.instanceName}${input.instanceId ? ` (${input.instanceId})` : ''}`
      : input.instanceId || 'não informada';
    const context = input.context && Object.keys(input.context).length
      ? JSON.stringify(input.context, null, 2).slice(0, 12000)
      : 'Sem contexto adicional.';
    const text = [
      `Nível: ${input.severity}`,
      `Ocorrência: ${input.title}`,
      `Instância: ${instance}`,
      `Horário: ${new Date().toISOString()}`,
      rawError ? `\nErro técnico:\n${rawError}` : '',
      diagnosis ? `\nAnálise automática / possível resolução:\n${diagnosis}` : '',
      `\nContexto:\n${context}`,
    ].filter(Boolean).join('\n');

    const html = `<!doctype html><html lang="pt-BR"><body style="font-family:Arial,Helvetica,sans-serif;background:#f5f5f4;padding:28px;color:#292524"><div style="max-width:720px;margin:auto;background:#fff;border:1px solid #e7e5e4;border-radius:18px;padding:28px"><div style="font-size:12px;font-weight:800;color:${input.severity === 'CRITICAL' ? '#b91c1c' : input.severity === 'ATTENTION' ? '#b45309' : '#0369a1'}">${this.escape(input.severity)}</div><h1 style="font-size:24px;margin:8px 0 20px">${this.escape(input.title)}</h1><p><strong>Instância:</strong> ${this.escape(instance)}</p><p><strong>Horário:</strong> ${this.escape(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }))}</p>${rawError ? `<h2 style="font-size:16px;margin-top:24px">Erro técnico</h2><pre style="white-space:pre-wrap;background:#fafaf9;padding:14px;border-radius:10px">${this.escape(rawError)}</pre>` : ''}${diagnosis ? `<h2 style="font-size:16px;margin-top:24px">Análise automática / possível resolução</h2><div style="white-space:pre-wrap;line-height:1.6">${this.escape(diagnosis)}</div>` : ''}<h2 style="font-size:16px;margin-top:24px">Contexto</h2><pre style="white-space:pre-wrap;background:#fafaf9;padding:14px;border-radius:10px">${this.escape(context)}</pre></div></body></html>`;

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, text, html }),
      });
      const payload = await response.json().catch(() => ({})) as any;
      if (!response.ok) {
        const error = String(payload?.message || payload?.error?.message || `HTTP ${response.status}`);
        this.logger.error(`Falha ao enviar alerta WhatsApp: ${error}`);
        return { status: 'FAILED' as const, error };
      }
      return { status: 'SENT' as const, messageId: payload?.id || null };
    } catch (error) {
      const message = this.errorText(error);
      this.logger.error(`Falha ao enviar alerta WhatsApp: ${message}`);
      return { status: 'FAILED' as const, error: message };
    }
  }

  private errorText(error: unknown) {
    if (!error) return '';
    if (error instanceof Error) return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`.slice(0, 12000);
    return String(error).slice(0, 12000);
  }

  private escape(value: unknown) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
