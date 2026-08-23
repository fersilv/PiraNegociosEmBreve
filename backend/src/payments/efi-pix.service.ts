import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
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
  calendario?: { criacao?: string; expiracao?: number; dataDeVencimento?: string };
  loc?: { id?: number; location?: string; tipoCob?: string };
  location?: string;
  valor?: { original?: string };
  pix?: Array<{ endToEndId?: string; txid?: string; valor?: string; horario?: string }>;
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
  calendario?: { dataInicial?: string; dataFinal?: string; periodicidade?: string };
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

  private get automaticEnabled() {
    return this.env('EFI_PIX_AUTOMATIC_ENABLED').toLowerCase() === 'true';
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

  private receiverAccount() {
    const agencia = this.env('EFI_PIX_RECEIVER_AGENCY');
    const conta = this.env('EFI_PIX_RECEIVER_ACCOUNT');
    const tipoConta = (this.env('EFI_PIX_RECEIVER_ACCOUNT_TYPE') || 'PAGAMENTO').toUpperCase();
    if (!agencia || !conta || !['CORRENTE', 'POUPANCA', 'PAGAMENTO'].includes(tipoConta)) {
      throw new ServiceUnavailableException(
        'Pix Automático da Efí precisa de EFI_PIX_RECEIVER_AGENCY, EFI_PIX_RECEIVER_ACCOUNT e EFI_PIX_RECEIVER_ACCOUNT_TYPE.',
      );
    }
    return { agencia, conta, tipoConta };
  }

  getConfigurationStatus() {
    const missing = [
      ['EFI_PIX_CLIENT_ID', this.env('EFI_PIX_CLIENT_ID')],
      ['EFI_PIX_CLIENT_SECRET', this.env('EFI_PIX_CLIENT_SECRET')],
      ['EFI_PIX_KEY', this.env('EFI_PIX_KEY')],
      ['EFI_PIX_CERTIFICATE', this.env('EFI_PIX_CERTIFICATE_PATH') || this.env('EFI_PIX_CERTIFICATE_BASE64')],
    ].filter(([, value]) => !value).map(([key]) => key);
    const automaticMissing = this.automaticEnabled
      ? [
          ['EFI_PIX_RECEIVER_AGENCY', this.env('EFI_PIX_RECEIVER_AGENCY')],
          ['EFI_PIX_RECEIVER_ACCOUNT', this.env('EFI_PIX_RECEIVER_ACCOUNT')],
          ['EFI_PIX_RECEIVER_ACCOUNT_TYPE', this.env('EFI_PIX_RECEIVER_ACCOUNT_TYPE') || 'PAGAMENTO'],
        ].filter(([, value]) => !value).map(([key]) => key)
      : [];
    return {
      provider: 'EFI',
      configured: missing.length === 0,
      sandbox: this.sandbox,
      missing,
      webhookConfigured: Boolean(this.env('EFI_PIX_WEBHOOK_URL')),
      pixAutomaticEnabled: this.automaticEnabled,
      pixAutomaticConfigured: this.automaticEnabled && automaticMissing.length === 0,
      automaticMissing,
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

  private parseMetadata(value: any): Record<string, any> {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try { return JSON.parse(String(value)); } catch { return {}; }
  }

  private addCalendarMonths(dateValue: string, months = 1) {
    const match = String(dateValue || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) throw new BadRequestException('Data de ciclo inválida para o Pix Automático.');
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    const targetMonth = monthIndex + months;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    const safeDay = Math.min(day, lastDay);
    return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
  }

  private initialRecurringDate() {
    return this.addCalendarMonths(new Date().toISOString().slice(0, 10), 1);
  }

  private automaticTxid(idRec: string, dueDate: string) {
    return createHash('sha256').update(`piranegocios:${idRec}:${dueDate}`).digest('hex').slice(0, 32);
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
    if (!this.automaticEnabled) {
      throw new ServiceUnavailableException('Pix Automático da Efí ainda não foi habilitado neste ambiente.');
    }
    this.receiverAccount();
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

    const dataInicial = this.initialRecurringDate();
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
        efiNextChargeDate: dataInicial,
        efiSandbox: this.sandbox,
      },
    };
  }

  private async syncSubscriptionForRecurrence(idRec: string, status?: string) {
    const normalized = String(status || '').toUpperCase();
    const statusSql = normalized === 'EXPIRADA'
      ? 'EXPIRED'
      : ['CANCELADA', 'REJEITADA'].includes(normalized)
        ? 'CANCELED'
        : null;
    const paymentRows = await this.dataSource.query(
      `SELECT * FROM payments
       WHERE provider = 'EFI' AND metadata->>'efiRecurrenceId' = $1
       ORDER BY "createdAt" ASC LIMIT 1`,
      [idRec],
    );
    const first = paymentRows[0];
    if (!first) return null;
    const rows = await this.dataSource.query(
      `UPDATE subscriptions SET
         provider = 'EFI',
         "providerSubscriptionId" = $1,
         status = CASE WHEN $4::varchar IS NULL THEN status ELSE $4::varchar END,
         metadata = coalesce(metadata,'{}'::jsonb) || $5::jsonb,
         "updatedAt" = now()
       WHERE id = coalesce(
         (SELECT "subscriptionId" FROM payments WHERE id = $2),
         (SELECT id FROM subscriptions
          WHERE "userId" = $3 AND "productCode" = 'PREMIUM_MONTHLY'
          ORDER BY "updatedAt" DESC LIMIT 1)
       )
       RETURNING *`,
      [idRec, first.id, first.userId, statusSql, JSON.stringify({ efiRecurrenceStatus: normalized || null })],
    );
    return rows[0] || null;
  }

  private async markRecurrenceStatus(idRec: string, status: string) {
    await this.dataSource.query(
      `UPDATE payments SET
         metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb,
         "updatedAt" = now()
       WHERE provider = 'EFI' AND metadata->>'efiRecurrenceId' = $1`,
      [idRec, JSON.stringify({ efiRecurrenceStatus: status })],
    );
    return this.syncSubscriptionForRecurrence(idRec, status);
  }

  private async createAutomaticProviderCharge(payment: any, idRec: string, dueDate: string) {
    const receiver = this.receiverAccount();
    const txid = this.automaticTxid(idRec, dueDate);
    const body = {
      idRec,
      infoAdicional: `PiraNegócios · ${String(payment.productName || 'Plano Destaque mensal').slice(0, 90)}`,
      calendario: { dataDeVencimento: dueDate },
      valor: { original: this.amount(Number(payment.amountCents)) },
      ajusteDiaUtil: true,
      recebedor: receiver,
    };

    let charge: EfiChargeResponse;
    try {
      charge = await this.api<EfiChargeResponse>('PUT', `/v2/cobr/${txid}`, body);
    } catch (error) {
      try {
        charge = await this.api<EfiChargeResponse>('GET', `/v2/cobr/${txid}`);
      } catch {
        throw error;
      }
    }
    if (!charge.txid) throw new ServiceUnavailableException('A Efí não retornou txid para a cobrança recorrente.');
    return { charge, txid };
  }

  private async ensureNextAutomaticCharge(idRec: string) {
    if (!this.automaticEnabled) return { created: false, reason: 'automatic_disabled' };

    const prepared = await this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`efi-rec:${idRec}`]);
      const rows = await manager.query(
        `SELECT p.*, pp.name AS "productName"
         FROM payments p
         LEFT JOIN payment_products pp ON pp.code = p."productCode"
         WHERE p.provider = 'EFI' AND p.metadata->>'efiRecurrenceId' = $1
         ORDER BY p."createdAt" ASC`,
        [idRec],
      );
      if (!rows.length) return { created: false, reason: 'payment_not_found' } as any;
      const first = rows.find((row: any) => !this.parseMetadata(row.metadata).efiAutomaticRenewal) || rows[0];
      if (first.status !== 'PAID') return { created: false, reason: 'initial_payment_pending' } as any;

      const metadataRows = rows.map((row: any) => ({ row, metadata: this.parseMetadata(row.metadata) }));
      const recurrenceStatus = String(
        [...metadataRows].reverse().find((item) => item.metadata.efiRecurrenceStatus)?.metadata.efiRecurrenceStatus || '',
      ).toUpperCase();
      if (recurrenceStatus !== 'APROVADA') {
        return { created: false, reason: `recurrence_${recurrenceStatus || 'unknown'}` } as any;
      }

      const renewals = metadataRows.filter((item) => item.metadata.efiAutomaticRenewal);
      const activePending = renewals.find((item) => item.row.status === 'PENDING');
      if (activePending) {
        return { created: false, reason: 'charge_pending', payment: activePending.row } as any;
      }

      const paidRenewals = renewals.filter((item) => item.row.status === 'PAID' && item.metadata.automaticCycleDueDate);
      paidRenewals.sort((a, b) => String(a.metadata.automaticCycleDueDate).localeCompare(String(b.metadata.automaticCycleDueDate)));
      const latestPaid = paidRenewals.at(-1);
      const firstMetadata = this.parseMetadata(first.metadata);
      const dueDate = latestPaid
        ? this.addCalendarMonths(String(latestPaid.metadata.automaticCycleDueDate), 1)
        : String(firstMetadata.efiNextChargeDate || '');
      if (!dueDate) return { created: false, reason: 'next_due_date_missing' } as any;

      const existingSameCycle = renewals.find((item) => String(item.metadata.automaticCycleDueDate || '') === dueDate && ['PENDING', 'PAID'].includes(item.row.status));
      if (existingSameCycle) return { created: false, reason: 'cycle_exists', payment: existingSameCycle.row } as any;

      const inserted = await manager.query(
        `INSERT INTO payments
          ("userId", "productCode", method, status, "originalAmountCents", "amountCents", "discountCents", provider, metadata)
         VALUES ($1,$2,'PIX','PENDING',$3,$4,$5,'EFI',$6::jsonb)
         RETURNING *`,
        [
          first.userId,
          first.productCode,
          Number(first.originalAmountCents),
          Number(first.amountCents),
          Number(first.discountCents || 0),
          JSON.stringify({
            efiAutomaticPix: true,
            efiAutomaticRenewal: true,
            efiRecurrenceId: idRec,
            efiRecurrenceStatus: 'APROVADA',
            automaticCycleDueDate: dueDate,
            parentPaymentId: first.id,
          }),
        ],
      );
      return {
        created: true,
        dueDate,
        payment: { ...inserted[0], productName: first.productName || 'Plano Destaque mensal' },
      } as any;
    });

    if (!prepared.created) return prepared;
    try {
      const { charge } = await this.createAutomaticProviderCharge(prepared.payment, idRec, prepared.dueDate);
      const stored = await this.payments.attachProviderCheckout(prepared.payment.id, {
        provider: 'EFI',
        providerPaymentId: charge.txid,
        expiresAt: null,
        metadata: {
          efiAutomaticChargeStatus: charge.status || 'CRIADA',
          efiRecurrenceId: idRec,
          efiAutomaticRenewal: true,
          automaticCycleDueDate: prepared.dueDate,
        },
      });
      return { created: true, dueDate: prepared.dueDate, payment: stored, providerStatus: charge.status || null };
    } catch (error) {
      await this.payments.cancelProviderCheckout(prepared.payment.id, error).catch(() => undefined);
      throw error;
    }
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
    const automaticEnabled = this.automaticEnabled;
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
      const metadata = this.parseMetadata(payment.metadata);
      const idRec = String(metadata.efiRecurrenceId || '');
      if (idRec) {
        await this.syncSubscriptionForRecurrence(idRec, metadata.efiRecurrenceStatus).catch(() => undefined);
        if (String(metadata.efiRecurrenceStatus || '').toUpperCase() === 'APROVADA') {
          await this.ensureNextAutomaticCharge(idRec).catch((error) => console.error('Efí next automatic charge:', error));
        }
      }
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
      const subscription = await this.markRecurrenceStatus(idRec, status);
      let nextCharge: any = null;
      if (status === 'APROVADA') {
        nextCharge = await this.ensureNextAutomaticCharge(idRec).catch((error) => ({ created: false, error: String(error?.message || error) }));
      }
      updated.push({ idRec, status, subscription, nextCharge });
    }
    return { ok: true, processed: updated.length, updated };
  }

  async handleAutomaticChargeWebhook(body: any, hmac?: string) {
    this.validateWebhookSecret(hmac);
    const events = Array.isArray(body?.cobsr) ? body.cobsr : [];
    const results: any[] = [];
    for (const event of events) {
      const txid = String(event?.txid || '').trim();
      if (!txid) continue;
      const status = String(event?.status || '').toUpperCase();
      const rows = await this.dataSource.query(
        `UPDATE payments SET
           metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb,
           status = CASE
             WHEN status <> 'PENDING' THEN status
             WHEN $3 = 'EXPIRADA' THEN 'EXPIRED'
             WHEN $3 IN ('CANCELADA','REJEITADA') THEN 'CANCELED'
             ELSE status
           END,
           "updatedAt" = now()
         WHERE provider = 'EFI' AND "providerPaymentId" = $1
         RETURNING *`,
        [txid, JSON.stringify({ efiAutomaticChargeStatus: status }), status],
      );
      const payment = rows[0];
      if (!payment) {
        results.push({ txid, status, ignored: true, reason: 'payment_not_found' });
        continue;
      }
      const metadata = this.parseMetadata(payment.metadata);
      const idRec = String(metadata.efiRecurrenceId || '');

      if (status === 'CONCLUIDA' && payment.status === 'PENDING') {
        try {
          const detail = await this.api<EfiChargeResponse>('GET', `/v2/cobr/${encodeURIComponent(txid)}`);
          const received = Array.isArray(detail.pix) ? detail.pix[0] : null;
          const receivedCents = this.decimalToCents(received?.valor);
          if (receivedCents !== Number(payment.amountCents)) {
            results.push({ txid, status, ignored: true, reason: 'amount_mismatch' });
            continue;
          }
          const settled = await this.payments.confirmProviderPayment(payment.id, {
            provider: 'EFI',
            efiEndToEndId: received?.endToEndId || null,
            efiPaidAt: received?.horario || null,
            confirmationMode: 'EFI_AUTOMATIC_CHARGE_WEBHOOK',
          });
          if (idRec) {
            await this.syncSubscriptionForRecurrence(idRec, 'APROVADA').catch(() => undefined);
            await this.ensureNextAutomaticCharge(idRec).catch((error) => console.error('Efí next automatic charge:', error));
          }
          results.push({ txid, status: settled.status, paymentId: payment.id });
          continue;
        } catch (error: any) {
          results.push({ txid, status, ignored: true, reason: error?.message || 'verification_failed' });
          continue;
        }
      }

      if (['EXPIRADA', 'CANCELADA', 'REJEITADA'].includes(status) && idRec) {
        await this.dataSource.query(
          `UPDATE subscriptions SET status = 'PAST_DUE', "updatedAt" = now()
           WHERE provider = 'EFI' AND "providerSubscriptionId" = $1 AND status = 'ACTIVE'`,
          [idRec],
        ).catch(() => undefined);
      }
      results.push({ txid, status, paymentId: payment.id });
    }
    return { ok: true, processed: results.length, results };
  }
}
