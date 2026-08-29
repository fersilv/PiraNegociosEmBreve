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
var WhatsAppAlertService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppAlertService = void 0;
const common_1 = require("@nestjs/common");
const whatsapp_ai_service_1 = require("./whatsapp-ai.service");
let WhatsAppAlertService = WhatsAppAlertService_1 = class WhatsAppAlertService {
    ai;
    logger = new common_1.Logger(WhatsAppAlertService_1.name);
    apiUrl = 'https://api.resend.com/emails';
    constructor(ai) {
        this.ai = ai;
    }
    async send(input) {
        const apiKey = String(process.env.RESEND_API_KEY || '').trim();
        const from = String(process.env.TRANSACTIONAL_EMAIL_FROM || '').trim();
        const to = String(process.env.WHATSAPP_ALERT_EMAIL || 'aviso@piranegocios.com.br').trim();
        if (!apiKey || !from || !to) {
            this.logger.warn(`Alerta WhatsApp não enviado por falta de configuração: ${input.title}`);
            return { status: 'NOT_CONFIGURED' };
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
            }
            catch (error) {
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
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                const error = String(payload?.message || payload?.error?.message || `HTTP ${response.status}`);
                this.logger.error(`Falha ao enviar alerta WhatsApp: ${error}`);
                return { status: 'FAILED', error };
            }
            return { status: 'SENT', messageId: payload?.id || null };
        }
        catch (error) {
            const message = this.errorText(error);
            this.logger.error(`Falha ao enviar alerta WhatsApp: ${message}`);
            return { status: 'FAILED', error: message };
        }
    }
    errorText(error) {
        if (!error)
            return '';
        if (error instanceof Error)
            return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`.slice(0, 12000);
        return String(error).slice(0, 12000);
    }
    escape(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};
exports.WhatsAppAlertService = WhatsAppAlertService;
exports.WhatsAppAlertService = WhatsAppAlertService = WhatsAppAlertService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [whatsapp_ai_service_1.WhatsAppAiService])
], WhatsAppAlertService);
//# sourceMappingURL=whatsapp-alert.service.js.map