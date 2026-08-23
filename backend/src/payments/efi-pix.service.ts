import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Agent, request as httpsRequest } from 'https';
import { URL } from 'url';
import { DataSource } from 'typeorm';
import { PaymentsService } from './payments.service';
import {
  PaymentProviderConfigService,
  type EfiProviderConfig,
} from './payment-provider-config.service';

interface EfiTokenResponse {
  access_token: string;
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

type RecurrenceMetaRow = {
  row: any;
  metadata: Record<string, any>;
};

export interface EfiPayerInput {
  name?: string;
  document?: string;
  email?: string;
}

@Injectable()
export class EfiPixService {
  private token: { key: string; value: string; expiresAt: number } | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly payments: PaymentsService,
    private readonly providerConfig: PaymentProviderConfigService,
  ) {}

  private async config() {
    return this.providerConfig.getSecretConfig<EfiProviderConfig>('EFI');
  }

  private sandbox(config: EfiProviderConfig) {
    return config.sandbox === true;
  }

  private automaticEnabled(config: EfiProviderConfig) {
    return config.pixAutomaticEnabled === true;
  }

  private baseUrl(config: EfiProviderConfig) {
    return this.sandbox(config) ? 'https://pix-h.api.efipay.com.br' : 'https://pix.api.efipay.com.br';
  }

  private assertConfigured(config: EfiProviderConfig) {
    const missing: string[] = [];
    if (!config.clientId) missing.push('Client ID');
    if (!config.clientSecret) missing.push('Client Secret');
    if (!config.pixKey) missing.push('Chave Pix');
    if (!config.certificateBase64) missing.push('Certificado .p12/.pfx');
    if (missing.length) throw new ServiceUnavailableException(`Efí Bank não configurado: faltando ${missing.join(', ')}.`);
  }

  private certificate(config: EfiProviderConfig) {
    if (!config.certificateBase64) throw new ServiceUnavailableException('Certificado Pix da Efí não configurado.');
    const decoded = Buffer.from(String(config.certificateBase64), 'base64');
    if (!decoded.length) throw new ServiceUnavailableException('Certificado Pix da Efí inválido.');
    return decoded;
  }

  private agent(config: EfiProviderConfig) {
    return new Agent({
      pfx: this.certificate(config),
      passphrase: String(config.certificatePassphrase || '') || undefined,
      keepAlive: true,
    });
  }

  private receiverAccount(config: EfiProviderConfig) {
    const agencia = String(config.receiverAgency || '').trim();
    const conta = String(config.receiverAccount || '').trim();
    const tipoConta = String(config.receiverAccountType || 'PAGAMENTO').toUpperCase();
    if (!agencia || !conta || !['CORRENTE', 'POUPANCA', 'PAGAMENTO'].includes(tipoConta)) {
      throw new ServiceUnavailableException('Pix Automático da Efí precisa de agência, conta e tipo da conta recebedora configurados em Formas de pagamento.');
    }
    return { agencia, conta, tipoConta };
  }

  private async rawRequest<T>(
    config: EfiProviderConfig,
    method: string,
    path: string,
    body?: unknown,
    bearer?: string,
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    const url = new URL(path, this.baseUrl(config));
    const payload = body === undefined ? null : JSON.stringify(body);
    const headers: Record<string, string> = { Accept: 'application/json', ...extraHeaders };
    if (payload !== null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(payload));
    }
    if (bearer) headers.Authorization = `Bearer ${bearer}`;

    return new Promise<T>((resolve, reject) => {
      const req = httpsRequest(url, { method, headers, agent: this.agent(config), timeout: 30000 }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed: any = {};
          try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { message: text }; }
          const status = Number(res.statusCode || 500);
          if (status >= 200 && status < 300) return resolve(parsed as T);
          const detail = parsed?.detail || parsed?.mensagem || parsed?.message || `HTTP ${status}`;
          reject(new ServiceUnavailableException({
            code: 'EFI_PIX_ERROR', provider: 'EFI', status, message: `Efí Bank: ${detail}`, providerResponse: parsed,
          }));
        });
      });
      req.on('timeout', () => req.destroy(new Error('Timeout na comunicação com a Efí.')));
      req.on('error', (error) => reject(new ServiceUnavailableException(`Falha de comunicação com a Efí: ${error.message}`)));
      if (payload !== null) req.write(payload);
      req.end();
    });
  }

  private async accessToken(config: EfiProviderConfig) {
    this.assertConfigured(config);
    const tokenKey = createHash('sha256').update(`${config.clientId}|${this.sandbox(config)}|${config.certificateFileName || ''}`).digest('hex');
    if (this.token && this.token.key === tokenKey && this.token.expiresAt > Date.now() + 60000) return this.token.value;
    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    const response = await this.rawRequest<EfiTokenResponse>(config, 'POST', '/oauth/token', { grant_type: 'client_credentials' }, undefined, { Authorization: `Basic ${basic}` });
    if (!response.access_token) throw new ServiceUnavailableException('A Efí não retornou access_token.');
    const ttl = Math.max(60, Number(response.expires_in || 3600));
    this.token = { key: tokenKey, value: response.access_token, expiresAt: Date.now() + ttl * 1000 };
    return response.access_token;
  }

  private async api<T>(config: EfiProviderConfig, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const token = await this.accessToken(config);
    return this.rawRequest<T>(config, method, path, body, token, headers);
  }

  async healthCheck() {
    const config = await this.config();
    const token = await this.accessToken(config);
    return {
      operational: Boolean(token),
      message: this.sandbox(config) ? 'Efí respondeu ao OAuth mTLS em Homologação.' : 'Efí respondeu ao OAuth mTLS em Produção.',
      details: {
        environment: this.sandbox(config) ? 'HOMOLOGATION' : 'PRODUCTION',
        certificateFileName: config.certificateFileName || null,
        pixAutomaticEnabled: this.automaticEnabled(config),
        webhookReady: Boolean(config.publicApiBaseUrl),
      },
    };
  }

  private amount(cents: number) { return (Math.max(0, Math.round(cents)) / 100).toFixed(2); }
  private cleanDocument(value?: string) { return String(value || '').replace(/\D/g, ''); }
  private expirationSeconds(config: EfiProviderConfig) {
    const configured = Number(config.expirationSeconds || 3600);
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
  private initialRecurringDate() { return this.addCalendarMonths(new Date().toISOString().slice(0, 10), 1); }
  private automaticTxid(idRec: string, dueDate: string) {
    return createHash('sha256').update(`piranegocios:${idRec}:${dueDate}`).digest('hex').slice(0, 32);
  }

  async createImmediateCharge(amountCents: number, paymentId: string, productName: string) {
    const config = await this.config();
    this.assertConfigured(config);
    const expiration = this.expirationSeconds(config);
    const charge = await this.api<EfiChargeResponse>(config, 'POST', '/v2/cob', {
      calendario: { expiracao: expiration },
      valor: { original: this.amount(amountCents) },
      chave: config.pixKey,
      solicitacaoPagador: `PiraNegócios · ${String(productName || 'Pagamento').slice(0, 90)}`,
      infoAdicionais: [{ nome: 'Pagamento', valor: paymentId }],
    });
    if (!charge.txid) throw new ServiceUnavailableException('A Efí criou a cobrança sem retornar txid.');
    let qr: EfiQrResponse = {};
    const locationId = Number(charge.loc?.id || 0);
    if (locationId > 0) qr = await this.api<EfiQrResponse>(config, 'GET', `/v2/loc/${locationId}/qrcode`).catch(() => ({}));
    return {
      provider: 'EFI', providerPaymentId: charge.txid,
      pixCopyPaste: qr.qrcode || charge.pixCopiaECola || null,
      qrCodeBase64: qr.imagemQrcode || null,
      expiresAt: new Date(Date.now() + expiration * 1000),
      metadata: {
        efiStatus: charge.status || null, efiLocationId: locationId || null,
        efiLocation: charge.loc?.location || charge.location || null,
        efiPaymentLink: qr.linkVisualizacao || null, efiSandbox: this.sandbox(config),
      },
    };
  }

  async createMonthlyAutomaticCharge(amountCents: number, paymentId: string, productName: string, payer: EfiPayerInput) {
    const config = await this.config();
    if (!this.automaticEnabled(config)) throw new ServiceUnavailableException('Pix Automático da Efí está desativado nesta forma de pagamento.');
    this.receiverAccount(config);
    const cpf = this.cleanDocument(payer.document);
    const name = String(payer.name || '').trim();
    if (cpf.length !== 11 || name.length < 3) throw new BadRequestException('Para assinar com Pix Automático, informe nome completo e CPF válido.');
    const loc = await this.api<{ id: number; location?: string }>(config, 'POST', '/v2/locrec');
    if (!loc?.id) throw new ServiceUnavailableException('A Efí não retornou o location da recorrência.');
    const expiration = this.expirationSeconds(config);
    const firstCharge = await this.api<EfiChargeResponse>(config, 'POST', '/v2/cob', {
      calendario: { expiracao: expiration }, valor: { original: this.amount(amountCents) }, chave: config.pixKey,
      solicitacaoPagador: `PiraNegócios · ${String(productName || 'Plano mensal').slice(0, 90)}`,
      infoAdicionais: [{ nome: 'Pagamento', valor: paymentId }],
    });
    if (!firstCharge.txid) throw new ServiceUnavailableException('A Efí não retornou o txid do primeiro pagamento.');
    const dataInicial = this.initialRecurringDate();
    const recurrence = await this.api<EfiRecurrenceResponse>(config, 'POST', '/v2/rec', {
      vinculo: { contrato: paymentId.replace(/-/g, '').slice(0, 35), devedor: { cpf, nome: name }, objeto: 'Plano Destaque mensal PiraNegócios' },
      calendario: { dataInicial, periodicidade: 'MENSAL' }, valor: { valorRec: this.amount(amountCents) },
      politicaRetentativa: 'PERMITE_3R_7D', loc: loc.id, ativacao: { dadosJornada: { txid: firstCharge.txid } },
    });
    if (!recurrence.idRec) throw new ServiceUnavailableException('A Efí não retornou o identificador da recorrência.');
    const detail = await this.api<EfiRecurrenceResponse>(config, 'GET', `/v2/rec/${encodeURIComponent(recurrence.idRec)}?txid=${encodeURIComponent(firstCharge.txid)}`).catch(() => recurrence);
    return {
      provider: 'EFI', providerPaymentId: firstCharge.txid,
      pixCopyPaste: detail.dadosQR?.pixCopiaECola || firstCharge.pixCopiaECola || null,
      qrCodeBase64: null, expiresAt: new Date(Date.now() + expiration * 1000),
      metadata: {
        efiAutomaticPix: true, efiRecurrenceId: recurrence.idRec,
        efiRecurrenceStatus: detail.status || recurrence.status || 'CRIADA',
        efiRecurrenceLocationId: loc.id, efiRecurrenceLocation: loc.location || null,
        efiNextChargeDate: dataInicial, efiSandbox: this.sandbox(config),
      },
    };
  }

  private webhookUrl(config: EfiProviderConfig) {
    const base = String(config.publicApiBaseUrl || '').trim().replace(/\/$/, '');
    if (!base) throw new ServiceUnavailableException('Informe a URL pública da API para registrar os webhooks da Efí.');
    const url = new URL(`${base}/payments/webhooks/efi`);
    if (config.webhookSecret) url.searchParams.set('hmac', String(config.webhookSecret));
    url.searchParams.set('ignorar', '');
    return url.toString();
  }

  async configureWebhooks() {
    const config = await this.config();
    this.assertConfigured(config);
    const webhookUrl = this.webhookUrl(config);
    const headers: Record<string, string> = config.skipMtlsChecking === true
      ? { 'x-skip-mtls-checking': 'true' }
      : {};
    const encodedKey = encodeURIComponent(String(config.pixKey));
    const pix = await this.api<any>(config, 'PUT', `/v2/webhook/${encodedKey}`, { webhookUrl }, headers);
    let recurrence: any = null;
    let recurringCharges: any = null;
    if (this.automaticEnabled(config)) {
      recurrence = await this.api<any>(config, 'PUT', '/v2/webhookrec', { webhookUrl }, headers);
      recurringCharges = await this.api<any>(config, 'PUT', '/v2/webhookcobr', { webhookUrl }, headers);
    }
    return { webhookUrl, pix, recurrence, recurringCharges, automaticEnabled: this.automaticEnabled(config) };
  }

  private validateWebhookSecret(config: EfiProviderConfig, received?: string) {
    const expected = String(config.webhookSecret || '');
    if (expected && received !== expected) throw new UnauthorizedException('Webhook Efí inválido.');
  }
  private decimalToCents(value: unknown) {
    const parsed = Number(String(value || '').replace(',', '.'));
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : -1;
  }

  private async syncSubscriptionForRecurrence(idRec: string, status?: string) {
    const normalized = String(status || '').toUpperCase();
    const statusSql = normalized === 'EXPIRADA' ? 'EXPIRED' : ['CANCELADA', 'REJEITADA'].includes(normalized) ? 'CANCELED' : null;
    const paymentRows = await this.dataSource.query(`SELECT * FROM payments WHERE provider = 'EFI' AND metadata->>'efiRecurrenceId' = $1 ORDER BY "createdAt" ASC LIMIT 1`, [idRec]);
    const first = paymentRows[0];
    if (!first) return null;
    const rows = await this.dataSource.query(
      `UPDATE subscriptions SET provider = 'EFI', "providerSubscriptionId" = $1,
         status = CASE WHEN $4::varchar IS NULL THEN status ELSE $4::varchar END,
         metadata = coalesce(metadata,'{}'::jsonb) || $5::jsonb, "updatedAt" = now()
       WHERE id = coalesce((SELECT "subscriptionId" FROM payments WHERE id = $2),
         (SELECT id FROM subscriptions WHERE "userId" = $3 AND "productCode" = 'PREMIUM_MONTHLY' ORDER BY "updatedAt" DESC LIMIT 1)) RETURNING *`,
      [idRec, first.id, first.userId, statusSql, JSON.stringify({ efiRecurrenceStatus: normalized || null })],
    );
    return rows[0] || null;
  }

  private async markRecurrenceStatus(idRec: string, status: string) {
    await this.dataSource.query(`UPDATE payments SET metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb, "updatedAt" = now() WHERE provider = 'EFI' AND metadata->>'efiRecurrenceId' = $1`, [idRec, JSON.stringify({ efiRecurrenceStatus: status })]);
    return this.syncSubscriptionForRecurrence(idRec, status);
  }

  private async createAutomaticProviderCharge(config: EfiProviderConfig, payment: any, idRec: string, dueDate: string) {
    const txid = this.automaticTxid(idRec, dueDate);
    const body = {
      idRec, infoAdicional: `PiraNegócios · ${String(payment.productName || 'Plano Destaque mensal').slice(0, 90)}`,
      calendario: { dataDeVencimento: dueDate }, valor: { original: this.amount(Number(payment.amountCents)) },
      ajusteDiaUtil: true, recebedor: this.receiverAccount(config),
    };
    let charge: EfiChargeResponse;
    try { charge = await this.api<EfiChargeResponse>(config, 'PUT', `/v2/cobr/${txid}`, body); }
    catch (error) {
      try { charge = await this.api<EfiChargeResponse>(config, 'GET', `/v2/cobr/${txid}`); }
      catch { throw error; }
    }
    if (!charge.txid) throw new ServiceUnavailableException('A Efí não retornou txid para a cobrança recorrente.');
    return charge;
  }

  private async ensureNextAutomaticCharge(idRec: string) {
    const config = await this.config();
    if (!this.automaticEnabled(config)) return { created: false, reason: 'automatic_disabled' };
    const prepared = await this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`efi-rec:${idRec}`]);
      const rows = await manager.query(
        `SELECT p.*, pp.name AS "productName" FROM payments p LEFT JOIN payment_products pp ON pp.code = p."productCode"
         WHERE p.provider = 'EFI' AND p.metadata->>'efiRecurrenceId' = $1 ORDER BY p."createdAt" ASC`, [idRec]);
      if (!rows.length) return { created: false, reason: 'payment_not_found' } as any;
      const metaRows: RecurrenceMetaRow[] = rows.map((row: any) => ({ row, metadata: this.parseMetadata(row.metadata) }));
      const first = metaRows.find((item) => !item.metadata.efiAutomaticRenewal)?.row || rows[0];
      if (first.status !== 'PAID') return { created: false, reason: 'initial_payment_pending' } as any;
      const recurrenceStatus = String([...metaRows].reverse().find((item) => item.metadata.efiRecurrenceStatus)?.metadata.efiRecurrenceStatus || '').toUpperCase();
      if (recurrenceStatus !== 'APROVADA') return { created: false, reason: `recurrence_${recurrenceStatus || 'unknown'}` } as any;
      const renewals = metaRows.filter((item) => item.metadata.efiAutomaticRenewal);
      const pending = renewals.find((item) => item.row.status === 'PENDING');
      if (pending) return { created: false, reason: 'charge_pending', payment: pending.row } as any;
      const paid = renewals.filter((item) => item.row.status === 'PAID' && item.metadata.automaticCycleDueDate)
        .sort((a, b) => String(a.metadata.automaticCycleDueDate).localeCompare(String(b.metadata.automaticCycleDueDate)));
      const latest = paid.at(-1);
      const firstMeta = this.parseMetadata(first.metadata);
      const dueDate = latest ? this.addCalendarMonths(String(latest.metadata.automaticCycleDueDate), 1) : String(firstMeta.efiNextChargeDate || '');
      if (!dueDate) return { created: false, reason: 'next_due_date_missing' } as any;
      const same = renewals.find((item) => String(item.metadata.automaticCycleDueDate || '') === dueDate && ['PENDING', 'PAID'].includes(item.row.status));
      if (same) return { created: false, reason: 'cycle_exists', payment: same.row } as any;
      const inserted = await manager.query(
        `INSERT INTO payments ("userId","productCode",method,status,"originalAmountCents","amountCents","discountCents",provider,metadata)
         VALUES ($1,$2,'PIX','PENDING',$3,$4,$5,'EFI',$6::jsonb) RETURNING *`,
        [first.userId, first.productCode, Number(first.originalAmountCents), Number(first.amountCents), Number(first.discountCents || 0), JSON.stringify({
          efiAutomaticPix: true, efiAutomaticRenewal: true, efiRecurrenceId: idRec, efiRecurrenceStatus: 'APROVADA',
          automaticCycleDueDate: dueDate, parentPaymentId: first.id,
        })],
      );
      return { created: true, dueDate, payment: { ...inserted[0], productName: first.productName || 'Plano Destaque mensal' } } as any;
    });
    if (!prepared.created) return prepared;
    try {
      const charge = await this.createAutomaticProviderCharge(config, prepared.payment, idRec, prepared.dueDate);
      const stored = await this.payments.attachProviderCheckout(prepared.payment.id, {
        provider: 'EFI', providerPaymentId: charge.txid, expiresAt: null,
        metadata: { efiAutomaticChargeStatus: charge.status || 'CRIADA', efiRecurrenceId: idRec, efiAutomaticRenewal: true, automaticCycleDueDate: prepared.dueDate },
      });
      return { created: true, dueDate: prepared.dueDate, payment: stored, providerStatus: charge.status || null };
    } catch (error) {
      await this.payments.cancelProviderCheckout(prepared.payment.id, error).catch(() => undefined);
      throw error;
    }
  }

  async handlePixWebhook(body: any, hmac?: string) {
    const config = await this.config();
    this.validateWebhookSecret(config, hmac);
    const events = Array.isArray(body?.pix) ? body.pix : [];
    const results: any[] = [];
    for (const event of events) {
      const txid = String(event?.txid || '').trim();
      if (!txid) continue;
      const rows = await this.dataSource.query(`SELECT * FROM payments WHERE provider = 'EFI' AND "providerPaymentId" = $1 LIMIT 1`, [txid]);
      const payment = rows[0];
      if (!payment) { results.push({ txid, ignored: true, reason: 'payment_not_found' }); continue; }
      const receivedCents = this.decimalToCents(event?.valor);
      if (receivedCents !== Number(payment.amountCents)) { results.push({ txid, ignored: true, reason: 'amount_mismatch' }); continue; }
      const settled = await this.payments.confirmProviderPayment(payment.id, {
        provider: 'EFI', efiEndToEndId: event?.endToEndId || null, efiPaidAt: event?.horario || null, confirmationMode: 'EFI_WEBHOOK',
      });
      const metadata = this.parseMetadata(payment.metadata);
      if (metadata.efiRecurrenceId) await this.ensureNextAutomaticCharge(String(metadata.efiRecurrenceId)).catch(() => undefined);
      results.push({ txid, paymentId: payment.id, status: settled.status });
    }
    return { ok: true, processed: results.length, results };
  }

  async handleAutomaticRecurrenceWebhook(body: any, hmac?: string) {
    const config = await this.config();
    this.validateWebhookSecret(config, hmac);
    const recurrences = Array.isArray(body?.recs) ? body.recs : Array.isArray(body?.rec) ? body.rec : [];
    const updated: any[] = [];
    for (const event of recurrences) {
      const idRec = String(event?.idRec || '').trim();
      if (!idRec) continue;
      const status = String(event?.status || '').toUpperCase();
      const subscription = await this.markRecurrenceStatus(idRec, status);
      const nextCharge = status === 'APROVADA' ? await this.ensureNextAutomaticCharge(idRec).catch((error) => ({ created: false, error: error instanceof Error ? error.message : String(error) })) : null;
      updated.push({ idRec, status, subscription, nextCharge });
    }
    return { ok: true, processed: updated.length, updated };
  }

  async handleAutomaticChargeWebhook(body: any, hmac?: string) {
    const config = await this.config();
    this.validateWebhookSecret(config, hmac);
    const events = Array.isArray(body?.cobsr) ? body.cobsr : [];
    const results: any[] = [];
    for (const event of events) {
      const txid = String(event?.txid || '').trim();
      const status = String(event?.status || '').toUpperCase();
      if (!txid) continue;
      const rows = await this.dataSource.query(`SELECT * FROM payments WHERE provider = 'EFI' AND "providerPaymentId" = $1 LIMIT 1`, [txid]);
      const payment = rows[0];
      if (!payment) { results.push({ txid, ignored: true }); continue; }
      await this.dataSource.query(`UPDATE payments SET metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb, "updatedAt" = now() WHERE id = $1`, [payment.id, JSON.stringify({ efiAutomaticChargeStatus: status })]);
      if (status === 'CONCLUIDA' && payment.status === 'PENDING') {
        const detail = await this.api<EfiChargeResponse>(config, 'GET', `/v2/cobr/${encodeURIComponent(txid)}`);
        const paidPix = Array.isArray(detail.pix) ? detail.pix[0] : null;
        const receivedCents = this.decimalToCents(paidPix?.valor || detail.valor?.original);
        if (receivedCents === Number(payment.amountCents)) {
          await this.payments.confirmProviderPayment(payment.id, {
            provider: 'EFI', efiEndToEndId: paidPix?.endToEndId || null, confirmationMode: 'EFI_AUTOMATIC_WEBHOOK',
            automaticCycleDueDate: this.parseMetadata(payment.metadata).automaticCycleDueDate || null,
          });
          const idRec = String(this.parseMetadata(payment.metadata).efiRecurrenceId || event?.idRec || '');
          if (idRec) await this.ensureNextAutomaticCharge(idRec).catch(() => undefined);
        }
      }
      results.push({ txid, status });
    }
    return { ok: true, processed: results.length, results };
  }
}
