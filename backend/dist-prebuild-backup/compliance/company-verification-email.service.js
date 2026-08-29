"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyVerificationEmailService = void 0;
const common_1 = require("@nestjs/common");
const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
let CompanyVerificationEmailService = class CompanyVerificationEmailService {
    async send(data) {
        const apiKey = String(process.env.RESEND_API_KEY || '').trim();
        const from = String(process.env.TRANSACTIONAL_EMAIL_FROM || '').trim();
        if (!apiKey || !from)
            return { status: 'NOT_CONFIGURED' };
        const subject = `${data.companyName} — autorização de cadastro no PiraNegócios`;
        const expires = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(data.expiresAt);
        const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f5f4;font-family:Arial,sans-serif;color:#292524"><div style="max-width:620px;margin:32px auto;background:#fff;border-radius:24px;overflow:hidden;border:1px solid #e7e5e4"><div style="background:#2b211c;color:white;padding:26px 30px"><div style="font-family:Georgia,serif;font-size:26px;font-weight:700">PiraNegócios</div><div style="margin-top:5px;color:#efb89c;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">Validação empresarial</div></div><div style="padding:32px 30px"><h1 style="font-family:Georgia,serif;font-size:27px;line-height:1.2;margin:0">Olá, ${esc(data.partnerName)}.</h1><p style="font-size:15px;line-height:1.65;color:#57534e">${esc(data.requestedByName)} iniciou o cadastro da empresa <strong>${esc(data.companyName)}</strong> no PiraNegócios e indicou você como sócio(a)/responsável para autorizar o uso da empresa na plataforma.</p><p style="font-size:15px;line-height:1.65;color:#57534e">A validação é simples: confira os dados, tire uma selfie e aceite a autorização. Você não precisa operar a conta depois disso, a menos que queira.</p><div style="text-align:center;margin:28px 0"><a href="${esc(data.inviteUrl)}" style="display:inline-block;background:#c66a4b;color:#fff;text-decoration:none;padding:14px 24px;border-radius:14px;font-weight:700">Revisar e autorizar</a></div><p style="font-size:12px;line-height:1.6;color:#78716c">O link expira em ${esc(expires)}. Se você não reconhece a empresa ou a solicitação, não autorize.</p></div></div></body></html>`;
        const text = `${data.partnerName},\n\n${data.requestedByName} iniciou o cadastro da empresa ${data.companyName} no PiraNegócios e indicou você como sócio(a)/responsável.\n\nConfira os dados, tire uma selfie e autorize pelo link:\n${data.inviteUrl}\n\nO link expira em ${expires}.`;
        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ from, to: [data.to], subject, html, text }),
                signal: AbortSignal.timeout(12_000),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok)
                return { status: 'FAILED', error: String(payload?.message || `HTTP ${response.status}`).slice(0, 500) };
            return { status: 'SENT', messageId: payload?.id || null };
        }
        catch (error) {
            return { status: 'FAILED', error: String(error instanceof Error ? error.message : error).slice(0, 500) };
        }
    }
};
exports.CompanyVerificationEmailService = CompanyVerificationEmailService;
exports.CompanyVerificationEmailService = CompanyVerificationEmailService = __decorate([
    (0, common_1.Injectable)()
], CompanyVerificationEmailService);
//# sourceMappingURL=company-verification-email.service.js.map