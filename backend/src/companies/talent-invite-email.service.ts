import { Injectable } from '@nestjs/common';

export type TalentInviteEmailResult = {
  status: 'SENT' | 'NOT_CONFIGURED' | 'FAILED';
  messageId?: string;
  error?: string;
};

type InvitationEmailData = {
  to: string;
  candidateName?: string | null;
  companyName: string;
  jobTitle: string;
  jobLocation?: string | null;
  inviteUrl: string;
  expiresAt: Date;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

@Injectable()
export class TalentInviteEmailService {
  private readonly apiUrl = 'https://api.resend.com/emails';

  async sendInvitation(
    data: InvitationEmailData,
  ): Promise<TalentInviteEmailResult> {
    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    const from = (process.env.TRANSACTIONAL_EMAIL_FROM || '').trim();
    if (!apiKey || !from) return { status: 'NOT_CONFIGURED' };

    const expiresLabel = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'long',
      timeZone: 'America/Sao_Paulo',
    }).format(data.expiresAt);
    const companyName = escapeHtml(data.companyName);
    const jobTitle = escapeHtml(data.jobTitle);
    const siteOrigin = (
      process.env.PUBLIC_SITE_URL || 'https://piranegocios.com.br'
    ).replace(/\/$/, '');
    const symbolUrl = escapeHtml(
      `${siteOrigin}/brand/symbol-white-textured.png`,
    );
    const footerLogoUrl = escapeHtml(
      `${siteOrigin}/brand/logo-horizontal-terracotta.png`,
    );
    const jobLocation = data.jobLocation
      ? `<p style="margin:8px 0 0;color:#78716c;font-size:14px;">${escapeHtml(data.jobLocation)}</p>`
      : '';
    const inviteUrl = escapeHtml(data.inviteUrl);
    const subject = `${data.companyName} — convite para o processo seletivo de ${data.jobTitle}`;
    const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f5f5f4;color:#292524;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Convite para o processo seletivo da vaga ${jobTitle}.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f4;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e7e5e4;border-radius:24px;overflow:hidden;">
          <tr><td style="background:#2b211c;padding:24px 30px;color:#fff;">
            <table role="presentation" cellspacing="0" cellpadding="0"><tr>
              <td style="padding-right:13px;vertical-align:middle;"><img src="${symbolUrl}" width="42" height="42" alt="" style="display:block;border:0;width:42px;height:42px;" /></td>
              <td style="vertical-align:middle;">
                <div style="font-family:Georgia,serif;font-size:25px;font-weight:700;">PiraNegócios</div>
                <div style="margin-top:5px;color:#efb89c;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Convite especial</div>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:34px 30px;">
            <h1 style="margin:0;font-family:Georgia,serif;font-size:29px;line-height:1.2;color:#251a15;">${companyName} quer conhecer você.</h1>
            <p style="margin:18px 0 0;color:#57534e;font-size:15px;line-height:1.65;">Olá, estamos te convidando a participar do processo seletivo para a vaga de:</p>
            <div style="margin:24px 0;padding:20px;border:1px solid #eadfd6;border-radius:16px;background:#faf7f3;">
              <div style="color:#c66a4b;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">Oportunidade</div>
              <div style="margin-top:8px;font-family:Georgia,serif;font-size:21px;font-weight:700;color:#292524;">${jobTitle}</div>
              ${jobLocation}
            </div>
            <p style="margin:0 0 12px;color:#57534e;font-size:15px;line-height:1.65;">Acesse o link abaixo e confira a vaga.</p>
            <p style="margin:0;color:#57534e;font-size:14px;line-height:1.6;">Você poderá ler a vaga completa antes de aceitar. Se ainda não tiver conta, cadastre-se com o mesmo e-mail que recebeu este convite — inclusive usando o Google.</p>
            <div style="margin:28px 0;text-align:center;">
              <a href="${inviteUrl}" style="display:inline-block;border-radius:14px;background:#c66a4b;color:#fff;padding:14px 24px;text-decoration:none;font-size:14px;font-weight:700;">Conhecer a vaga</a>
            </div>
            <p style="margin:0;color:#78716c;font-size:12px;line-height:1.6;">Este convite é pessoal, expira em ${escapeHtml(expiresLabel)} e só pode ser vinculado ao e-mail ${escapeHtml(data.to)}. Se você não esperava esta mensagem, basta ignorá-la.</p>
          </td></tr>
          <tr><td align="center" style="border-top:1px solid #eadfd6;padding:22px 30px;color:#a8a29e;font-size:11px;line-height:1.5;">
            <img src="${footerLogoUrl}" width="180" alt="PiraNegócios" style="display:block;border:0;width:180px;max-width:100%;height:auto;" />
            <div style="margin-top:10px;">Aproximando pessoas e oportunidades em Pirassununga e região.</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
    const text = `${data.companyName} quer conhecer você.

Olá, estamos te convidando a participar do processo seletivo para a vaga de “${data.jobTitle}”.
${data.jobLocation ? `Local: ${data.jobLocation}\n` : ''}
Acesse o link abaixo e confira a vaga:
${data.inviteUrl}

Se ainda não tiver conta, cadastre-se com o mesmo e-mail que recebeu este convite, inclusive usando o Google.
O convite expira em ${expiresLabel}.`;

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [data.to], subject, html, text }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        error?: { message?: string };
      };
      if (!response.ok) {
        const message =
          payload.message || payload.error?.message || `HTTP ${response.status}`;
        return { status: 'FAILED', error: message.slice(0, 500) };
      }
      return { status: 'SENT', messageId: payload.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 'FAILED', error: message.slice(0, 500) };
    }
  }
}
