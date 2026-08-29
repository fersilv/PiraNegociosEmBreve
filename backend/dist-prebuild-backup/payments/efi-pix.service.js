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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EfiPixService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const https_1 = require("https");
const url_1 = require("url");
const typeorm_1 = require("typeorm");
const payments_service_1 = require("./payments.service");
const payment_provider_config_service_1 = require("./payment-provider-config.service");
let EfiPixService = class EfiPixService {
    dataSource;
    payments;
    providerConfig;
    token = null;
    constructor(dataSource, payments, providerConfig) {
        this.dataSource = dataSource;
        this.payments = payments;
        this.providerConfig = providerConfig;
    }
    async config() {
        return this.providerConfig.getSecretConfig('EFI');
    }
    sandbox(config) {
        return config.sandbox === true;
    }
    automaticEnabled(config) {
        return config.pixAutomaticEnabled === true;
    }
    baseUrl(config) {
        return this.sandbox(config) ? 'https://pix-h.api.efipay.com.br' : 'https://pix.api.efipay.com.br';
    }
    assertConfigured(config) {
        const missing = [];
        if (!config.clientId)
            missing.push('Client ID');
        if (!config.clientSecret)
            missing.push('Client Secret');
        if (!config.pixKey)
            missing.push('Chave Pix');
        if (!config.certificateBase64)
            missing.push('Certificado .p12/.pfx');
        if (missing.length)
            throw new common_1.ServiceUnavailableException(`Efí Bank não configurado: faltando ${missing.join(', ')}.`);
    }
    certificate(config) {
        if (!config.certificateBase64)
            throw new common_1.ServiceUnavailableException('Certificado Pix da Efí não configurado.');
        const decoded = Buffer.from(String(config.certificateBase64), 'base64');
        if (!decoded.length)
            throw new common_1.ServiceUnavailableException('Certificado Pix da Efí inválido.');
        return decoded;
    }
    agent(config) {
        return new https_1.Agent({
            pfx: this.certificate(config),
            passphrase: String(config.certificatePassphrase || '') || undefined,
            keepAlive: true,
        });
    }
    receiverAccount(config) {
        const agencia = String(config.receiverAgency || '').trim();
        const conta = String(config.receiverAccount || '').trim();
        const tipoConta = String(config.receiverAccountType || 'PAGAMENTO').toUpperCase();
        if (!agencia || !conta || !['CORRENTE', 'POUPANCA', 'PAGAMENTO'].includes(tipoConta)) {
            throw new common_1.ServiceUnavailableException('Pix Automático da Efí precisa de agência, conta e tipo da conta recebedora configurados em Formas de pagamento.');
        }
        return { agencia, conta, tipoConta };
    }
    async rawRequest(config, method, path, body, bearer, extraHeaders = {}) {
        const url = new url_1.URL(path, this.baseUrl(config));
        const payload = body === undefined ? null : JSON.stringify(body);
        const headers = { Accept: 'application/json', ...extraHeaders };
        if (payload !== null) {
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = String(Buffer.byteLength(payload));
        }
        if (bearer)
            headers.Authorization = `Bearer ${bearer}`;
        return new Promise((resolve, reject) => {
            const req = (0, https_1.request)(url, { method, headers, agent: this.agent(config), timeout: 30000 }, (res) => {
                const chunks = [];
                res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
                res.on('end', () => {
                    const text = Buffer.concat(chunks).toString('utf8');
                    let parsed = {};
                    try {
                        parsed = text ? JSON.parse(text) : {};
                    }
                    catch {
                        parsed = { message: text };
                    }
                    const status = Number(res.statusCode || 500);
                    if (status >= 200 && status < 300)
                        return resolve(parsed);
                    const detail = parsed?.detail || parsed?.mensagem || parsed?.message || `HTTP ${status}`;
                    reject(new common_1.ServiceUnavailableException({
                        code: 'EFI_PIX_ERROR', provider: 'EFI', status, message: `Efí Bank: ${detail}`, providerResponse: parsed,
                    }));
                });
            });
            req.on('timeout', () => req.destroy(new Error('Timeout na comunicação com a Efí.')));
            req.on('error', (error) => reject(new common_1.ServiceUnavailableException(`Falha de comunicação com a Efí: ${error.message}`)));
            if (payload !== null)
                req.write(payload);
            req.end();
        });
    }
    async accessToken(config) {
        this.assertConfigured(config);
        const tokenKey = (0, crypto_1.createHash)('sha256').update(`${config.clientId}|${this.sandbox(config)}|${config.certificateFileName || ''}`).digest('hex');
        if (this.token && this.token.key === tokenKey && this.token.expiresAt > Date.now() + 60000)
            return this.token.value;
        const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
        const response = await this.rawRequest(config, 'POST', '/oauth/token', { grant_type: 'client_credentials' }, undefined, { Authorization: `Basic ${basic}` });
        if (!response.access_token)
            throw new common_1.ServiceUnavailableException('A Efí não retornou access_token.');
        const ttl = Math.max(60, Number(response.expires_in || 3600));
        this.token = { key: tokenKey, value: response.access_token, expiresAt: Date.now() + ttl * 1000 };
        return response.access_token;
    }
    async api(config, method, path, body, headers = {}) {
        const token = await this.accessToken(config);
        return this.rawRequest(config, method, path, body, token, headers);
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
    amount(cents) { return (Math.max(0, Math.round(cents)) / 100).toFixed(2); }
    cleanDocument(value) { return String(value || '').replace(/\D/g, ''); }
    expirationSeconds(config) {
        const configured = Number(config.expirationSeconds || 3600);
        return Math.min(86400, Math.max(300, Math.round(configured || 3600)));
    }
    parseMetadata(value) {
        if (!value)
            return {};
        if (typeof value === 'object')
            return value;
        try {
            return JSON.parse(String(value));
        }
        catch {
            return {};
        }
    }
    addCalendarDays(dateValue, days) {
        const match = String(dateValue || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match)
            throw new common_1.BadRequestException('Data inválida para o Pix Automático.');
        const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
        date.setUTCDate(date.getUTCDate() + Math.max(0, Math.round(days)));
        return date.toISOString().slice(0, 10);
    }
    addCalendarMonths(dateValue, months = 1) {
        const match = String(dateValue || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match)
            throw new common_1.BadRequestException('Data de ciclo inválida para o Pix Automático.');
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
    initialRecurringDate() { return this.addCalendarMonths(new Date().toISOString().slice(0, 10), 1); }
    automaticTxid(idRec, dueDate) {
        return (0, crypto_1.createHash)('sha256').update(`piranegocios:${idRec}:${dueDate}`).digest('hex').slice(0, 32);
    }
    async createImmediateCharge(amountCents, paymentId, productName) {
        const config = await this.config();
        this.assertConfigured(config);
        const expiration = this.expirationSeconds(config);
        const charge = await this.api(config, 'POST', '/v2/cob', {
            calendario: { expiracao: expiration },
            valor: { original: this.amount(amountCents) },
            chave: config.pixKey,
            solicitacaoPagador: `PiraNegócios · ${String(productName || 'Pagamento').slice(0, 90)}`,
            infoAdicionais: [{ nome: 'Pagamento', valor: paymentId }],
        });
        if (!charge.txid)
            throw new common_1.ServiceUnavailableException('A Efí criou a cobrança sem retornar txid.');
        let qr = {};
        const locationId = Number(charge.loc?.id || 0);
        if (locationId > 0)
            qr = await this.api(config, 'GET', `/v2/loc/${locationId}/qrcode`).catch(() => ({}));
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
    async createMonthlyAutomaticCharge(amountCents, paymentId, productName, payer, trialDays = 0) {
        const config = await this.config();
        if (!this.automaticEnabled(config))
            throw new common_1.ServiceUnavailableException('Pix Automático da Efí está desativado nesta forma de pagamento.');
        this.receiverAccount(config);
        const cpf = this.cleanDocument(payer.document);
        const name = String(payer.name || '').trim();
        if (cpf.length !== 11 || name.length < 3)
            throw new common_1.BadRequestException('Para assinar com Pix Automático, informe nome completo e CPF válido.');
        const loc = await this.api(config, 'POST', '/v2/locrec');
        if (!loc?.id)
            throw new common_1.ServiceUnavailableException('A Efí não retornou o location da recorrência.');
        const safeTrialDays = Math.max(0, Math.min(30, Math.round(Number(trialDays || 0))));
        if (safeTrialDays > 0) {
            const dataInicial = this.addCalendarDays(new Date().toISOString().slice(0, 10), safeTrialDays);
            const recurrence = await this.api(config, 'POST', '/v2/rec', {
                vinculo: { contrato: paymentId.replace(/-/g, '').slice(0, 35), devedor: { cpf, nome: name }, objeto: 'Plano empresarial PiraNegócios' },
                calendario: { dataInicial, periodicidade: 'MENSAL' },
                valor: { valorRec: this.amount(amountCents) },
                politicaRetentativa: 'PERMITE_3R_7D', loc: loc.id,
            });
            if (!recurrence.idRec)
                throw new common_1.ServiceUnavailableException('A Efí não retornou o identificador da recorrência.');
            const detail = await this.api(config, 'GET', `/v2/rec/${encodeURIComponent(recurrence.idRec)}`).catch(() => recurrence);
            return {
                provider: 'EFI', providerPaymentId: recurrence.idRec,
                pixCopyPaste: detail.dadosQR?.pixCopiaECola || null, qrCodeBase64: null, expiresAt: null,
                metadata: {
                    efiAutomaticPix: true, efiJourney: 'JORNADA_2', efiRecurrenceId: recurrence.idRec,
                    efiRecurrenceStatus: detail.status || recurrence.status || 'CRIADA', efiRecurrenceLocationId: loc.id,
                    efiRecurrenceLocation: loc.location || null, efiNextChargeDate: dataInicial, efiTrialDays: safeTrialDays,
                    requiresAuthorization: true, efiSandbox: this.sandbox(config),
                },
            };
        }
        const expiration = this.expirationSeconds(config);
        const firstCharge = await this.api(config, 'POST', '/v2/cob', {
            calendario: { expiracao: expiration }, valor: { original: this.amount(amountCents) }, chave: config.pixKey,
            solicitacaoPagador: `PiraNegócios · ${String(productName || 'Plano mensal').slice(0, 90)}`,
            infoAdicionais: [{ nome: 'Pagamento', valor: paymentId }],
        });
        if (!firstCharge.txid)
            throw new common_1.ServiceUnavailableException('A Efí não retornou o txid do primeiro pagamento.');
        const dataInicial = this.initialRecurringDate();
        const recurrence = await this.api(config, 'POST', '/v2/rec', {
            vinculo: { contrato: paymentId.replace(/-/g, '').slice(0, 35), devedor: { cpf, nome: name }, objeto: 'Plano Destaque mensal PiraNegócios' },
            calendario: { dataInicial, periodicidade: 'MENSAL' }, valor: { valorRec: this.amount(amountCents) },
            politicaRetentativa: 'PERMITE_3R_7D', loc: loc.id, ativacao: { dadosJornada: { txid: firstCharge.txid } },
        });
        if (!recurrence.idRec)
            throw new common_1.ServiceUnavailableException('A Efí não retornou o identificador da recorrência.');
        const detail = await this.api(config, 'GET', `/v2/rec/${encodeURIComponent(recurrence.idRec)}?txid=${encodeURIComponent(firstCharge.txid)}`).catch(() => recurrence);
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
    webhookUrl(config) {
        const base = String(config.publicApiBaseUrl || '').trim().replace(/\/$/, '');
        if (!base)
            throw new common_1.ServiceUnavailableException('Informe a URL pública da API para registrar os webhooks da Efí.');
        const url = new url_1.URL(`${base}/payments/webhooks/efi`);
        if (config.webhookSecret)
            url.searchParams.set('hmac', String(config.webhookSecret));
        url.searchParams.set('ignorar', '');
        return url.toString();
    }
    webhookError(error, label, requiredScope) {
        const response = error?.response;
        const payload = response?.providerResponse || response?.message || response;
        const status = Number(payload?.status || response?.status || 0);
        const detail = payload?.detail || payload?.message || error?.message || 'Falha desconhecida.';
        if (status === 403 || String(detail).includes('403')) {
            throw new common_1.ServiceUnavailableException(`${label} recusado pela Efí (403). Verifique se a aplicação possui o escopo ${requiredScope} no ambiente selecionado e se a conta está habilitada para esse recurso.`);
        }
        throw error;
    }
    async configureWebhooks(paymentType = 'PIX_AUTOMATICO') {
        const config = await this.config();
        this.assertConfigured(config);
        const webhookUrl = this.webhookUrl(config);
        const headers = config.skipMtlsChecking === true
            ? { 'x-skip-mtls-checking': 'true' }
            : {};
        const encodedKey = encodeURIComponent(String(config.pixKey));
        let pix = null;
        try {
            pix = await this.api(config, 'PUT', `/v2/webhook/${encodedKey}`, { webhookUrl }, headers);
        }
        catch (error) {
            this.webhookError(error, 'Webhook do Pix', 'webhook.write');
        }
        let recurrence = null;
        let recurringCharges = null;
        if (paymentType === 'PIX_AUTOMATICO') {
            if (!this.automaticEnabled(config)) {
                throw new common_1.ServiceUnavailableException('Pix Automático da Efí está desativado na configuração deste provedor.');
            }
            try {
                recurrence = await this.api(config, 'PUT', '/v2/webhookrec', { webhookUrl }, headers);
            }
            catch (error) {
                this.webhookError(error, 'Webhook de recorrência do Pix Automático', 'webhookrec.write');
            }
            try {
                recurringCharges = await this.api(config, 'PUT', '/v2/webhookcobr', { webhookUrl }, headers);
            }
            catch (error) {
                this.webhookError(error, 'Webhook de cobrança do Pix Automático', 'webhookcobr.write');
            }
        }
        return { webhookUrl, pix, recurrence, recurringCharges, automaticEnabled: this.automaticEnabled(config), paymentType };
    }
    validateWebhookSecret(config, received) {
        const expected = String(config.webhookSecret || '');
        if (expected && received !== expected)
            throw new common_1.UnauthorizedException('Webhook Efí inválido.');
    }
    decimalToCents(value) {
        const parsed = Number(String(value || '').replace(',', '.'));
        return Number.isFinite(parsed) ? Math.round(parsed * 100) : -1;
    }
    async syncSubscriptionForRecurrence(idRec, status) {
        const normalized = String(status || '').toUpperCase();
        const statusSql = normalized === 'EXPIRADA' ? 'EXPIRED' : ['CANCELADA', 'REJEITADA'].includes(normalized) ? 'CANCELED' : null;
        const paymentRows = await this.dataSource.query(`SELECT * FROM payments WHERE provider = 'EFI' AND metadata->>'efiRecurrenceId' = $1 ORDER BY "createdAt" ASC LIMIT 1`, [idRec]);
        const first = paymentRows[0];
        if (!first)
            return null;
        const rows = await this.dataSource.query(`UPDATE subscriptions SET provider = 'EFI', "providerSubscriptionId" = $1,
         status = CASE WHEN $4::varchar IS NULL THEN status ELSE $4::varchar END,
         metadata = coalesce(metadata,'{}'::jsonb) || $5::jsonb, "updatedAt" = now()
       WHERE id = coalesce((SELECT "subscriptionId" FROM payments WHERE id = $2),
         (SELECT id FROM subscriptions WHERE "userId" = $3 AND "productCode" = 'PREMIUM_MONTHLY' ORDER BY "updatedAt" DESC LIMIT 1)) RETURNING *`, [idRec, first.id, first.userId, statusSql, JSON.stringify({ efiRecurrenceStatus: normalized || null })]);
        return rows[0] || null;
    }
    async markRecurrenceStatus(idRec, status) {
        await this.dataSource.query(`UPDATE payments SET metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb, "updatedAt" = now() WHERE provider = 'EFI' AND metadata->>'efiRecurrenceId' = $1`, [idRec, JSON.stringify({ efiRecurrenceStatus: status })]);
        return this.syncSubscriptionForRecurrence(idRec, status);
    }
    async createAutomaticProviderCharge(config, payment, idRec, dueDate) {
        const txid = this.automaticTxid(idRec, dueDate);
        const body = {
            idRec, infoAdicional: `PiraNegócios · ${String(payment.productName || 'Plano Destaque mensal').slice(0, 90)}`,
            calendario: { dataDeVencimento: dueDate }, valor: { original: this.amount(Number(payment.amountCents)) },
            ajusteDiaUtil: true, recebedor: this.receiverAccount(config),
        };
        let charge;
        try {
            charge = await this.api(config, 'PUT', `/v2/cobr/${txid}`, body);
        }
        catch (error) {
            try {
                charge = await this.api(config, 'GET', `/v2/cobr/${txid}`);
            }
            catch {
                throw error;
            }
        }
        if (!charge.txid)
            throw new common_1.ServiceUnavailableException('A Efí não retornou txid para a cobrança recorrente.');
        return charge;
    }
    async ensureNextAutomaticCharge(idRec) {
        const config = await this.config();
        if (!this.automaticEnabled(config))
            return { created: false, reason: 'automatic_disabled' };
        const prepared = await this.dataSource.transaction(async (manager) => {
            await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`efi-rec:${idRec}`]);
            const rows = await manager.query(`SELECT p.*, pp.name AS "productName" FROM payments p LEFT JOIN payment_products pp ON pp.code = p."productCode"
         WHERE p.provider = 'EFI' AND p.metadata->>'efiRecurrenceId' = $1 ORDER BY p."createdAt" ASC`, [idRec]);
            if (!rows.length)
                return { created: false, reason: 'payment_not_found' };
            const metaRows = rows.map((row) => ({ row, metadata: this.parseMetadata(row.metadata) }));
            const first = metaRows.find((item) => !item.metadata.efiAutomaticRenewal)?.row || rows[0];
            const recurrenceStatus = String([...metaRows].reverse().find((item) => item.metadata.efiRecurrenceStatus)?.metadata.efiRecurrenceStatus || '').toUpperCase();
            if (recurrenceStatus !== 'APROVADA')
                return { created: false, reason: `recurrence_${recurrenceStatus || 'unknown'}` };
            if (first.status !== 'PAID') {
                const firstMeta = this.parseMetadata(first.metadata);
                const trialDays = Math.max(0, Number(firstMeta.companyEliteTrialDays || firstMeta.efiTrialDays || 0));
                const dueDate = String(firstMeta.efiNextChargeDate || '');
                if (first.status === 'PENDING' && trialDays > 0 && dueDate) {
                    const currentProviderId = String(first.providerPaymentId || '');
                    if (currentProviderId && currentProviderId !== idRec)
                        return { created: false, reason: 'trial_first_charge_exists', payment: first };
                    const charge = await this.createAutomaticProviderCharge(config, first, idRec, dueDate);
                    const stored = await this.payments.attachProviderCheckout(first.id, {
                        provider: 'EFI', providerPaymentId: charge.txid, expiresAt: null,
                        metadata: { efiAutomaticChargeStatus: charge.status || 'CRIADA', efiRecurrenceId: idRec, efiTrialFirstCharge: true, automaticCycleDueDate: dueDate },
                    });
                    return { created: true, reason: 'trial_first_charge_created', dueDate, payment: stored, providerStatus: charge.status || null };
                }
                return { created: false, reason: 'initial_payment_pending' };
            }
            const renewals = metaRows.filter((item) => item.metadata.efiAutomaticRenewal);
            const pending = renewals.find((item) => item.row.status === 'PENDING');
            if (pending)
                return { created: false, reason: 'charge_pending', payment: pending.row };
            const paid = renewals.filter((item) => item.row.status === 'PAID' && item.metadata.automaticCycleDueDate)
                .sort((a, b) => String(a.metadata.automaticCycleDueDate).localeCompare(String(b.metadata.automaticCycleDueDate)));
            const latest = paid.at(-1);
            const firstMeta = this.parseMetadata(first.metadata);
            const dueDate = latest ? this.addCalendarMonths(String(latest.metadata.automaticCycleDueDate), 1) : String(firstMeta.efiNextChargeDate || '');
            if (!dueDate)
                return { created: false, reason: 'next_due_date_missing' };
            const same = renewals.find((item) => String(item.metadata.automaticCycleDueDate || '') === dueDate && ['PENDING', 'PAID'].includes(item.row.status));
            if (same)
                return { created: false, reason: 'cycle_exists', payment: same.row };
            const inserted = await manager.query(`INSERT INTO payments ("userId","productCode",method,status,"originalAmountCents","amountCents","discountCents",provider,metadata)
         VALUES ($1,$2,'PIX','PENDING',$3,$4,$5,'EFI',$6::jsonb) RETURNING *`, [first.userId, first.productCode, Number(first.originalAmountCents), Number(first.amountCents), Number(first.discountCents || 0), JSON.stringify({
                    efiAutomaticPix: true, efiAutomaticRenewal: true, efiRecurrenceId: idRec, efiRecurrenceStatus: 'APROVADA',
                    automaticCycleDueDate: dueDate, parentPaymentId: first.id,
                })]);
            return { created: true, dueDate, payment: { ...inserted[0], productName: first.productName || 'Plano Destaque mensal' } };
        });
        if (!prepared.created)
            return prepared;
        try {
            const charge = await this.createAutomaticProviderCharge(config, prepared.payment, idRec, prepared.dueDate);
            const stored = await this.payments.attachProviderCheckout(prepared.payment.id, {
                provider: 'EFI', providerPaymentId: charge.txid, expiresAt: null,
                metadata: { efiAutomaticChargeStatus: charge.status || 'CRIADA', efiRecurrenceId: idRec, efiAutomaticRenewal: true, automaticCycleDueDate: prepared.dueDate },
            });
            return { created: true, dueDate: prepared.dueDate, payment: stored, providerStatus: charge.status || null };
        }
        catch (error) {
            await this.payments.cancelProviderCheckout(prepared.payment.id, error).catch(() => undefined);
            throw error;
        }
    }
    async handlePixWebhook(body, hmac) {
        const config = await this.config();
        this.validateWebhookSecret(config, hmac);
        const events = Array.isArray(body?.pix) ? body.pix : [];
        const results = [];
        for (const event of events) {
            const txid = String(event?.txid || '').trim();
            if (!txid)
                continue;
            const rows = await this.dataSource.query(`SELECT * FROM payments WHERE provider = 'EFI' AND "providerPaymentId" = $1 LIMIT 1`, [txid]);
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
                provider: 'EFI', efiEndToEndId: event?.endToEndId || null, efiPaidAt: event?.horario || null, confirmationMode: 'EFI_WEBHOOK',
            });
            const metadata = this.parseMetadata(payment.metadata);
            if (metadata.efiRecurrenceId)
                await this.ensureNextAutomaticCharge(String(metadata.efiRecurrenceId)).catch(() => undefined);
            results.push({ txid, paymentId: payment.id, status: settled.status });
        }
        return { ok: true, processed: results.length, results };
    }
    async handleAutomaticRecurrenceWebhook(body, hmac) {
        const config = await this.config();
        this.validateWebhookSecret(config, hmac);
        const recurrences = Array.isArray(body?.recs) ? body.recs : Array.isArray(body?.rec) ? body.rec : [];
        const updated = [];
        for (const event of recurrences) {
            const idRec = String(event?.idRec || '').trim();
            if (!idRec)
                continue;
            const status = String(event?.status || '').toUpperCase();
            const subscription = await this.markRecurrenceStatus(idRec, status);
            let trial = null;
            if (status === 'APROVADA') {
                const paymentRows = await this.dataSource.query(`SELECT * FROM payments WHERE provider = 'EFI' AND metadata->>'efiRecurrenceId' = $1 ORDER BY "createdAt" ASC LIMIT 1`, [idRec]);
                const firstPayment = paymentRows[0];
                const firstMeta = this.parseMetadata(firstPayment?.metadata);
                const trialDays = Math.max(0, Math.min(30, Math.round(Number(firstMeta.companyEliteTrialDays || firstMeta.efiTrialDays || 0))));
                if (firstPayment && trialDays > 0) {
                    const dueDate = this.addCalendarDays(new Date().toISOString().slice(0, 10), trialDays);
                    await this.api(config, 'PATCH', `/v2/rec/${encodeURIComponent(idRec)}`, { calendario: { dataInicial: dueDate } }).catch(() => undefined);
                    await this.dataSource.query(`UPDATE payments SET metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb, "updatedAt" = now() WHERE id = $1`, [firstPayment.id, JSON.stringify({ efiNextChargeDate: dueDate, companyEliteTrialAuthorizedAt: new Date().toISOString() })]);
                    trial = await this.payments.activateCompanyPlanTrial(firstPayment.id, { provider: 'EFI', providerSubscriptionId: idRec });
                }
            }
            const nextCharge = status === 'APROVADA' ? await this.ensureNextAutomaticCharge(idRec).catch((error) => ({ created: false, error: error instanceof Error ? error.message : String(error) })) : null;
            updated.push({ idRec, status, subscription, trial, nextCharge });
        }
        return { ok: true, processed: updated.length, updated };
    }
    async handleAutomaticChargeWebhook(body, hmac) {
        const config = await this.config();
        this.validateWebhookSecret(config, hmac);
        const events = Array.isArray(body?.cobsr) ? body.cobsr : [];
        const results = [];
        for (const event of events) {
            const txid = String(event?.txid || '').trim();
            const status = String(event?.status || '').toUpperCase();
            if (!txid)
                continue;
            const rows = await this.dataSource.query(`SELECT * FROM payments WHERE provider = 'EFI' AND "providerPaymentId" = $1 LIMIT 1`, [txid]);
            const payment = rows[0];
            if (!payment) {
                results.push({ txid, ignored: true });
                continue;
            }
            await this.dataSource.query(`UPDATE payments SET metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb, "updatedAt" = now() WHERE id = $1`, [payment.id, JSON.stringify({ efiAutomaticChargeStatus: status })]);
            if (status === 'CONCLUIDA' && payment.status === 'PENDING') {
                const detail = await this.api(config, 'GET', `/v2/cobr/${encodeURIComponent(txid)}`);
                const paidPix = Array.isArray(detail.pix) ? detail.pix[0] : null;
                const receivedCents = this.decimalToCents(paidPix?.valor || detail.valor?.original);
                if (receivedCents === Number(payment.amountCents)) {
                    await this.payments.confirmProviderPayment(payment.id, {
                        provider: 'EFI', efiEndToEndId: paidPix?.endToEndId || null, confirmationMode: 'EFI_AUTOMATIC_WEBHOOK',
                        automaticCycleDueDate: this.parseMetadata(payment.metadata).automaticCycleDueDate || null,
                    });
                    const idRec = String(this.parseMetadata(payment.metadata).efiRecurrenceId || event?.idRec || '');
                    if (idRec)
                        await this.ensureNextAutomaticCharge(idRec).catch(() => undefined);
                }
            }
            results.push({ txid, status });
        }
        return { ok: true, processed: results.length, results };
    }
};
exports.EfiPixService = EfiPixService;
exports.EfiPixService = EfiPixService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        payments_service_1.PaymentsService,
        payment_provider_config_service_1.PaymentProviderConfigService])
], EfiPixService);
//# sourceMappingURL=efi-pix.service.js.map