import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { readFileSync } from 'fs';
import { Agent, request as httpsRequest } from 'https';
import { URL } from 'url';
import { DataSource } from 'typeorm';
import { PaymentsService } from './payments.service';

interface EfiTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

interface EfiChargeResponse {
  txid: string;
  status?: string;
  pixCopiaECola?: string;
  calendario?: { criacao?: string; expiracao?: number };
  loc?: { id?: number; location?: string; tipoCob?: string };
  location?: string;
}

interface EfiQrResponse {
  qrcode?: string;
  imagemQrcode?: string;
  linkVisualizacao?: string;
}

interface EfiRecurrenceResponse {
  idRec: string;
  status?: string;
  dadosQR?: { jornada?: string; pixCopiaECola?: string };
  loc?: { id?: number; location?: string; idRec?: string };
}

export interface EfiPayerInput {
  name?: string;
  document?: string;
}

@Injectable()
export class EfiPixService {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly payments: PaymentsService,
  ) {}

  private env(name: string) {
    return String(process.env[name] || '').trim();
  }

  private get sandbox() {
    return ['1', 'true', 'yes', 'on'].includes(this.env('EFI_PIX_SANDBOX').toLowerCase());
  }

  private get baseUrl() {
    return this.sandbox ? 'https://pix-h.api.efipay.com.br' : 'https://pix.api.efipay.com.br';
  }

  private certificate(): Buffer {
    const base64 = this.env('EFI_PIX_CERTIFICATE_BASE64');
    if (base64) return Buffer.from(base64.replace(/\s+/g, ''), 'base64');
    const path = this.env('EFI_PIX_CERTIFICATE_PATH');
    if (!path) throw new ServiceUnavailableException('Certificado Pix da Efí não configurado.');
    try {
      return readFileSync(path);
    } catch {
      throw new ServiceUnavailableException('Não foi possível ler o certificado Pix da Efí.');
    }
  }

  private agent() {
    return new Agent({
      pfx: this.certificate(),
      passphrase: this.env('EFI_PIX_CERTIFICATE_PASSPHRASE') || undefined,
      keepAlive: true,
    });
  }

  getConfigurationStatus() {
    const missing = [
      ['EFI_PIX_CLIENT_ID', this.env('EFI_PIX_CLIENT_ID')],
      ['EFI_PIX_CLIENT_SECRET', this.env('EFI_PIX_CLIENT_SECRET')],
      ['EFI_PIX_KEY', this.env('EFI_PIX_KEY')],
      ['EFI_PIX_CERTIFICATE', this.env('EFI_PIX_CERTIFICATE_PATH') || this.env('EFI_PIX_CERTIFICATE_BASE64')],
    ].filter(([, value]) => !value).map(([key]) => key);
    return {
      provider: 'EFI',
      configured: missing.length === 0,
      sandbox: this.sandbox,
      missing,
      webhookConfigured: Boolean(this.env('EFI_PIX_WEBHOOK_URL')),
      pixAutomaticEnabled: this.env('EFI_PIX_AUTOMATIC_ENABLED').toLowerCase() === 'true',
    };
  }

  private assertConfigured() {
    const status = this.getConfigurationStatus();
    if (!status.configured) {
      throw new ServiceUnavailableException(`Efí Bank não configurado: faltando ${status.missing.join(', ')}.`);
    }
  }

  private async rawRequest<T>(
    method: string,
    path: string,
    body?: unknown,
    bearer?: string,
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    const payload = body === undefined ? null : JSON.stringify(body);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...extraHeaders,
    };
    if (payload !== null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(payload));
    }
    if (bearer) headers.Authorization = `Bearer ${bearer}`;

    return new Promise<T>((resolve, reject) => {
      const req = httpsRequest(
        url,
        {
          method,
          headers,
          agent: this.agent(),
          timeout: 30000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let parsed: any = null;
            try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { message: text }; }
            const status = Number(res.statusCode || 500);
            if (status >= 200 && status < 300) return resolve(parsed as T);
            const detail = parsed?.detail || parsed?.mensagem || parsed?.message || `HTTP ${status}`;
            reject(new ServiceUnavailableException({
              code: 'EFI_PIX_ERROR',
              provider: 'EFI',
              status,
              message: `Efí Bank: ${detail}`,
              providerResponse: parsed,
            }));
          });
        },
      );
      req.on('timeout', () => req.destroy(new Error('Timeout na comunicação com a Efí.')));
      req.on('error', (error) => reject(new ServiceUnavailableException(`Falha de comunicação com a Efí: ${error.message}`)));
      if (payload !== null) req.write(payload);
      req.end();
    });
  }

  private async accessToken() {
    this.assertConfigured();
    if (this.token && this.token.expiresAt > Date.now() + 60000) return this.token.value;
    const clientId = this.env('EFI_PIX_CLIENT_ID');
    const clientSecret = this.env('EFI_PIX_CLIENT_SECRET');
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await this.rawRequest<EfiTokenResponse>(
      'POST',
      '/oauth/token',
      { grant_type: 'client_credentials' },
      undefined,
      { Authorization: `Basic ${basic}` },
    );
    if (!response.access_token) throw new ServiceUnavailableException('A Efí não retornou access_token.');
    const ttl = Math.max(60, Number(response.expires_in || 3600));
    this.token = { value: response.access_token, expiresAt: Date.now() + ttl * 1000 };
    return response.access_token;
  }

  private async api<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const token = await this.accessToken();
    return this.rawRequest<T>(method, path, body, token, headers);
  }

  private amount(cents: number) {
    return (Math.max(0, Math.round(cents)) / 100).toFixed(2);
  }

  private cleanDocument(value?: string) {
    return String(value || '').replace(/\D/g, '');
  }

  private expirationSeconds() {
    const configured = Number(this.env('EFI_PIX_EXPIRATION_SECONDS') || 3600);
    return Math.min(86400, Math.max(300, Math.round(configured || 3600)));
  }

  async createImmediateCharge(amountCents: number, paymentId: string, productName: string) {
    this.assertConfigured();
    const expiration = this.expirationSeconds();
    const charge = await this.api<EfiChargeResponse>('POST', '/v2/cob', {
      calendario: { expiracao: expiration },
      valor: { original: this.amount(amountCents) },
      chave: this.env('EFI_PIX_KEY'),
      solicitacaoPagador: `PiraNegócios · ${String(productName || 'Pagamento').slice(0, 90)}`,
      infoAdicionais: [
        { nome: 'Pagamento', valor: paymentId },
      ],
    });
    if (!charge.txid) throw new ServiceUnavailableException('A Efí criou a cobrança sem retornar txid.');

    let qr: EfiQrResponse = {};
    const locationId = Number(charge.loc?.id || 0);
    if (locationId > 0) {
      qr = await this.api<EfiQrResponse>('GET', `/v2/loc/${locationId}/qrcode`).catch(() => ({}));
    }

    return {
      provider: 'EFI',
      providerPaymentId: charge.txid,
      pixCopyPaste: qr.qrcode || charge.pixCopiaECola || null,
      qrCodeBase64: qr.imagemQrcode || null,
      expiresAt: new Date(Date.now() + expiration * 1000),
      metadata: {
        efiStatus: charge.status || null,
        efiLocationId: locationId || null,
        efiLocation: charge.loc?.location || charge.location || null,
        efiPaymentLink: qr.linkVisualizacao || null,
        efiSandbox: this.sandbox,
      },
    };
  }

  async createMonthlyAutomaticCharge(
    amountCents: number,
    paymentId: string,
    productName: string,
    payer: EfiPayerInput,
  ) {
    if (this.env('EFI_PIX_AUTOMATIC_ENABLED').toLowerCase() !== 'true') {
      throw new ServiceUnavailableException('Pix Automático da Efí ainda não foi habilitado neste ambiente.');
    }
    const cpf = this.cleanDocument(payer.document);
    const name = String(payer.name || '').trim();
    if (cpf.length !== 11 || name.length < 3) {
      throw new BadRequestException('Para assinar com Pix Automático, informe nome completo e CPF válido.');
    }

    const loc = await this.api<{ id: number; location?: string }>('POST', '/v2/locrec');
    if (!loc?.id) throw new ServiceUnavailableException('A Efí não retornou o location da recorrência.');

    const firstCharge = await this.api<EfiChargeResponse>('POST', '/v2/cob', {
      calendario: { expiracao: this.expirationSeconds() },
      valor: { original: this.amount(amountCents) },
      chave: this.env('EFI_PIX_KEY'),
      solicitacaoPagador: `PiraNegócios · ${String(productName || 'Plano mensal').slice(0, 90)}`,
      infoAdicionais: [{ nome: 'Pagamento', valor: paymentId }],
    });
    if (!firstCharge.txid) throw new ServiceUnavailableException('A Efí não retornou o txid do primeiro pagamento.');

    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 30);
    const dataInicial = start.toISOString().slice(0, 10);
    const recurrence = await this.api<EfiRecurrenceResponse>('POST', '/v2/rec', {
      vinculo: {
        contrato: paymentId.replace(/-/g, '').slice(0, 35),
        devedor: { cpf, nome: name },
        objeto: 'Plano Destaque mensal PiraNegócios',
      },
      calendario: {
        dataInicial,
        periodicidade: 'MENSAL',
      },
      valor: { valorRec: this.amount(amountCents) },
      politicaRetentativa: 'PERMITE_3R_7D',
      loc: loc.id,
      ativacao: { dadosJornada: { txid: firstCharge.txid } },
    });
    if (!recurrence.idRec) throw new ServiceUnavailableException('A Efí não retornou o identificador da recorrência.');

    const detail = await this.api<EfiRecurrenceResponse>(
      'GET',
      `/v2/rec/${encodeURIComponent(recurrence.idRec)}?txid=${encodeURIComponent(firstCharge.txid)}`,
    ).catch(() => recurrence);

    return {
      provider: 'EFI',
      providerPaymentId: firstCharge.txid,
      pixCopyPaste: detail.dadosQR?.pixCopiaECola || firstCharge.pixCopiaECola || null,
      qrCodeBase64: null,
      expiresAt: new Date(Date.now() + this.expirationSeconds() * 1000),
      metadata: {
        efiAutomaticPix: true,
        efiRecurrenceId: recurrence.idRec,
        efiRecurrenceStatus: detail.status || recurrence.status || 'CRIADA',
        efiRecurrenceLocationId: loc.id,
        efiRecurrenceLocation: loc.location || null,
        efiSandbox: this.sandbox,
      },
    };
  }

  private buildWebhookUrl() {
    const configured = this.env('EFI_PIX_WEBHOOK_URL');
    if (!configured) throw new ServiceUnavailableException('EFI_PIX_WEBHOOK_URL não configurada.');
    const url = new URL(configured);
    const secret = this.env('EFI_PIX_WEBHOOK_SECRET');
    if (secret && !url.searchParams.has('hmac')) url.searchParams.set('hmac', secret);
    if (!url.searchParams.has('ignorar')) url.searchParams.set('ignorar', '');
    return url.toString();
  }

  async configureWebhooks() {
    this.assertConfigured();
    const webhookUrl = this.buildWebhookUrl();
    const skipMtls = this.env('EFI_PIX_WEBHOOK_SKIP_MTLS_CHECKING').toLowerCase() === 'true';
    const headers = skipMtls ? { 'x-skip-mtls-checking': 'true' } : {};
    const encodedKey = encodeURIComponent(this.env('EFI_PIX_KEY'));
    const pix = await this.api<any>('PUT', `/v2/webhook/${encodedKey}`, { webhookUrl }, headers);
    const automaticEnabled = this.env('EFI_PIX_AUTOMATIC_ENABLED').toLowerCase() === 'true';
    let recurrence: any = null;
    let recurringCharges: any = null;
    if (automaticEnabled) {
      recurrence = await this.api<any>('PUT', '/v2/webhookrec', { webhookUrl }, headers);
      recurringCharges = await this.api<any>('PUT', '/v2/webhookcobr', { webhookUrl }, headers);
    }
    return { provider: 'EFI', webhookUrl, pix, recurrence, recurringCharges, automaticEnabled };
  }

  private validateWebhookSecret(received?: string) {
    const expected = this.env('EFI_PIX_WEBHOOK_SECRET');
    if (expected && received !== expected) throw new UnauthorizedException('Webhook Efí inválido.');
  }

  private decimalToCents(value: unknown) {
    const parsed = Number(String(value || '').replace(',', '.'));
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : -1;
  }

  async handlePixWebhook(body: any, hmac?: string) {
    this.validateWebhookSecret(hmac);
    const events = Array.isArray(body?.pix) ? body.pix : [];
    const results: any[] = [];
    for (const event of events) {
      const txid = String(event?.txid || '').trim();
      if (!txid) continue;
      const rows = await this.dataSource.query(
        `SELECT * FROM payments WHERE provider = 'EFI' AND "providerPaymentId" = $1 LIMIT 1`,
        [txid],
      );
      const payment = rows[0];
      if (!payment) {
        results.push({ txid, ignored: true, reason: 'payment_not_found' });
        continue;
      }
      const receivedCents = this.decimalToCents(event?.valor);
      if (receivedCents !== Number(payment.amountCents)) {
        results.push({ txid, ignored: true, reason: 'amount_mismatch' });
        continue;
      }
      const settled = await this.payments.confirmProviderPayment(payment.id, {
        provider: 'EFI',
        efiEndToEndId: event?.endToEndId || null,
        efiPaidAt: event?.horario || null,
        confirmationMode: 'EFI_WEBHOOK',
      });
      results.push({ txid, paymentId: payment.id, status: settled.status });
    }
    return { ok: true, processed: results.length, results };
  }

  async handleAutomaticRecurrenceWebhook(body: any, hmac?: string) {
    this.validateWebhookSecret(hmac);
    const recurrences = Array.isArray(body?.recs) ? body.recs : Array.isArray(body?.rec) ? body.rec : [];
    const updated: any[] = [];
    for (const event of recurrences) {
      const idRec = String(event?.idRec || '').trim();
      if (!idRec) continue;
      const status = String(event?.status || '').toUpperCase();
      const rows = await this.dataSource.query(
        `UPDATE subscriptions
         SET provider = 'EFI', "providerSubscriptionId" = $1,
             status = CASE WHEN $2 IN ('CANCELADA','CANCELADO','REJEITADA','REJEITADO') THEN 'CANCELED' ELSE status END,
             metadata = coalesce(metadata,'{}'::jsonb) || $3::jsonb,
             "updatedAt" = now()
         WHERE id = (
           SELECT s.id FROM subscriptions s
           JOIN payments p ON p."subscriptionId" = s.id OR (p."userId" = s."userId" AND p."productCode" = s."productCode")
           WHERE p.provider = 'EFI' AND p.metadata->>'efiRecurrenceId' = $1
           ORDER BY p."createdAt" DESC LIMIT 1
         )
         RETURNING id, status`,
        [idRec, status, JSON.stringify({ efiRecurrenceStatus: status })],
      );
      updated.push({ idRec, status, subscription: rows[0] || null });
    }
    return { ok: true, processed: updated.length, updated };
  }

  async handleAutomaticChargeWebhook(body: any, hmac?: string) {
    this.validateWebhookSecret(hmac);
    return { ok: true, received: Array.isArray(body?.cobsr) ? body.cobsr.length : 0 };
  }
}
