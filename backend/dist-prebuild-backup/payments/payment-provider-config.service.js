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
exports.PaymentProviderConfigService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const typeorm_1 = require("typeorm");
const payment_provider_vault_service_1 = require("./payment-provider-vault.service");
let PaymentProviderConfigService = class PaymentProviderConfigService {
    dataSource;
    vault;
    constructor(dataSource, vault) {
        this.dataSource = dataSource;
        this.vault = vault;
    }
    normalizeCode(value) {
        const code = String(value || '').trim().toUpperCase();
        if (!['EFI', 'MERCADO_PAGO'].includes(code)) {
            throw new common_1.BadRequestException('Forma de pagamento não suportada.');
        }
        return code;
    }
    normalizePaymentType(value) {
        const type = String(value || '').trim().toUpperCase();
        if (!['PIX', 'PIX_AUTOMATICO'].includes(type)) {
            throw new common_1.BadRequestException('Tipo de pagamento não suportado.');
        }
        return type;
    }
    text(value, max = 4000) {
        if (value === undefined)
            return undefined;
        if (value === null)
            return '';
        return String(value).trim().slice(0, max);
    }
    bool(value, current = false) {
        return value === undefined ? current : value === true;
    }
    publicApiBaseUrl(value, current) {
        if (value === undefined)
            return current;
        const raw = String(value || '').trim().replace(/\/$/, '');
        if (!raw)
            return '';
        let parsed;
        try {
            parsed = new URL(raw);
        }
        catch {
            throw new common_1.BadRequestException('URL pública da API inválida.');
        }
        if (!['https:', 'http:'].includes(parsed.protocol))
            throw new common_1.BadRequestException('A URL pública precisa usar HTTP ou HTTPS.');
        if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
            throw new common_1.BadRequestException('Em produção, a URL pública da API precisa usar HTTPS.');
        }
        return raw;
    }
    certificateFromInput(input, current) {
        if (input.removeCertificate === true) {
            return { certificateBase64: '', certificateFileName: '', certificatePassphrase: '' };
        }
        if (input.certificateBase64 === undefined) {
            return {
                certificateBase64: current.certificateBase64 || '',
                certificateFileName: current.certificateFileName || '',
                certificatePassphrase: input.certificatePassphrase === undefined
                    ? current.certificatePassphrase || ''
                    : this.text(input.certificatePassphrase, 500) || '',
            };
        }
        const fileName = this.text(input.certificateFileName, 240) || 'certificado.p12';
        if (!/\.(p12|pfx)$/i.test(fileName)) {
            throw new common_1.BadRequestException('O certificado Efí precisa ser um arquivo .p12 ou .pfx.');
        }
        const raw = String(input.certificateBase64 || '').trim();
        const base64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
        let bytes;
        try {
            bytes = Buffer.from(base64.replace(/\s+/g, ''), 'base64');
        }
        catch {
            bytes = Buffer.alloc(0);
        }
        if (!bytes.length)
            throw new common_1.BadRequestException('O certificado enviado está vazio ou inválido.');
        if (bytes.length > 5 * 1024 * 1024)
            throw new common_1.BadRequestException('O certificado excede o limite de 5 MB.');
        return {
            certificateBase64: bytes.toString('base64'),
            certificateFileName: fileName,
            certificatePassphrase: this.text(input.certificatePassphrase, 500) || '',
        };
    }
    sanitizeEfi(input, current) {
        const certificate = this.certificateFromInput(input, current);
        const typeRaw = input.receiverAccountType === undefined
            ? String(current.receiverAccountType || 'PAGAMENTO')
            : String(input.receiverAccountType || 'PAGAMENTO').toUpperCase();
        if (!['CORRENTE', 'POUPANCA', 'PAGAMENTO'].includes(typeRaw)) {
            throw new common_1.BadRequestException('Tipo da conta recebedora inválido.');
        }
        const expiration = input.expirationSeconds === undefined
            ? Number(current.expirationSeconds || 3600)
            : Number(input.expirationSeconds || 3600);
        return {
            clientId: this.text(input.clientId, 500) ?? current.clientId ?? '',
            clientSecret: this.text(input.clientSecret, 1000) ?? current.clientSecret ?? '',
            pixKey: this.text(input.pixKey, 180) ?? current.pixKey ?? '',
            sandbox: this.bool(input.sandbox, current.sandbox === true),
            ...certificate,
            pixAutomaticEnabled: this.bool(input.pixAutomaticEnabled, current.pixAutomaticEnabled === true),
            receiverAgency: this.text(input.receiverAgency, 40) ?? current.receiverAgency ?? '',
            receiverAccount: this.text(input.receiverAccount, 80) ?? current.receiverAccount ?? '',
            receiverAccountType: typeRaw,
            publicApiBaseUrl: this.publicApiBaseUrl(input.publicApiBaseUrl, current.publicApiBaseUrl),
            webhookSecret: current.webhookSecret || (0, crypto_1.randomBytes)(32).toString('hex'),
            skipMtlsChecking: this.bool(input.skipMtlsChecking, current.skipMtlsChecking === true),
            expirationSeconds: Math.min(86400, Math.max(300, Math.round(expiration || 3600))),
        };
    }
    sanitizeMercadoPago(input, current) {
        return {
            accessToken: this.text(input.accessToken, 2000) ?? current.accessToken ?? '',
            publicKey: this.text(input.publicKey, 1000) ?? current.publicKey ?? '',
            webhookSecret: this.text(input.webhookSecret, 2000) ?? current.webhookSecret ?? '',
            publicApiBaseUrl: this.publicApiBaseUrl(input.publicApiBaseUrl, current.publicApiBaseUrl),
            marketplaceClientId: this.text(input.marketplaceClientId, 500) ?? current.marketplaceClientId ?? '',
            marketplaceClientSecret: this.text(input.marketplaceClientSecret, 1000) ?? current.marketplaceClientSecret ?? '',
            marketplaceRedirectUri: this.publicApiBaseUrl(input.marketplaceRedirectUri, current.marketplaceRedirectUri),
        };
    }
    async getRow(codeInput) {
        const code = this.normalizeCode(codeInput);
        const rows = await this.dataSource.query(`SELECT * FROM payment_providers WHERE code = $1 LIMIT 1`, [code]);
        if (!rows[0])
            throw new common_1.NotFoundException('Forma de pagamento não encontrada.');
        return rows[0];
    }
    async getSecretConfig(codeInput) {
        const row = await this.getRow(codeInput);
        return this.vault.decrypt(row.encryptedConfig);
    }
    safeDetails(code, config) {
        if (code === 'EFI') {
            return {
                environment: config.sandbox ? 'HOMOLOGATION' : 'PRODUCTION',
                clientIdConfigured: Boolean(config.clientId),
                clientSecretConfigured: Boolean(config.clientSecret),
                pixKeyConfigured: Boolean(config.pixKey),
                certificateConfigured: Boolean(config.certificateBase64),
                certificateFileName: config.certificateFileName || null,
                certificateHasPassphrase: Boolean(config.certificatePassphrase),
                pixAutomaticEnabled: config.pixAutomaticEnabled === true,
                receiverAccountConfigured: Boolean(config.receiverAgency && config.receiverAccount && config.receiverAccountType),
                publicApiBaseUrl: config.publicApiBaseUrl || null,
                skipMtlsChecking: config.skipMtlsChecking === true,
                capabilities: ['PIX', 'PIX_AUTOMATICO'],
            };
        }
        return {
            environment: String(config.accessToken || '').startsWith('TEST-') ? 'TEST' : 'PRODUCTION',
            accessTokenConfigured: Boolean(config.accessToken),
            publicKeyConfigured: Boolean(config.publicKey),
            webhookSecretConfigured: Boolean(config.webhookSecret),
            marketplaceClientIdConfigured: Boolean(config.marketplaceClientId),
            marketplaceClientId: config.marketplaceClientId || null,
            marketplaceClientSecretConfigured: Boolean(config.marketplaceClientSecret),
            marketplaceRedirectUri: config.marketplaceRedirectUri || null,
            publicApiBaseUrl: config.publicApiBaseUrl || null,
            capabilities: ['PIX', 'PIX_AUTOMATICO'],
            checkoutApi: 'ORDERS',
            recurringApi: 'SUBSCRIPTIONS',
            sdk: 'mercadopago',
        };
    }
    supportsType(code, config, type) {
        if (type === 'PIX')
            return true;
        if (code === 'EFI')
            return config.pixAutomaticEnabled === true;
        return code === 'MERCADO_PAGO';
    }
    async activeTypesFor(code) {
        const rows = await this.dataSource.query(`SELECT "paymentType" FROM payment_provider_routes WHERE enabled = true AND "providerCode" = $1 ORDER BY "paymentType"`, [code]);
        return rows.map((row) => this.normalizePaymentType(row.paymentType));
    }
    async presentRow(row) {
        const code = this.normalizeCode(row.code);
        const config = this.vault.decrypt(row.encryptedConfig);
        const activeFor = await this.activeTypesFor(code);
        return {
            code,
            name: row.name,
            description: row.description,
            active: activeFor.length > 0,
            activeFor,
            configured: Boolean(row.encryptedConfig),
            configVersion: Number(row.configVersion || 0),
            lastHealthCheckAt: row.lastHealthCheckAt,
            lastHealthCheckOk: row.lastHealthCheckOk,
            lastHealthCheckMessage: row.lastHealthCheckMessage,
            lastHealthCheckDetails: row.lastHealthCheckDetails || {},
            activatedAt: row.activatedAt,
            updatedAt: row.updatedAt,
            config: this.safeDetails(code, config),
        };
    }
    async listSafe() {
        const rows = await this.dataSource.query(`SELECT * FROM payment_providers ORDER BY name ASC`);
        return Promise.all(rows.map((row) => this.presentRow(row)));
    }
    async getSafe(code) {
        return this.presentRow(await this.getRow(code));
    }
    async listRoutesSafe() {
        const rows = await this.dataSource.query(`SELECT r."paymentType", r.enabled, r."providerCode", r."activatedAt", p.name AS "providerName"
       FROM payment_provider_routes r
       LEFT JOIN payment_providers p ON p.code = r."providerCode"
       ORDER BY CASE r."paymentType" WHEN 'PIX' THEN 1 ELSE 2 END`);
        return rows.map((row) => ({
            paymentType: this.normalizePaymentType(row.paymentType),
            enabled: row.enabled === true,
            providerCode: row.enabled && row.providerCode ? this.normalizeCode(row.providerCode) : null,
            providerName: row.enabled ? row.providerName || null : null,
            activatedAt: row.activatedAt || null,
        }));
    }
    async publicRoutes() {
        const routes = await this.listRoutesSafe();
        return routes.reduce((result, route) => {
            result[route.paymentType] = route.enabled && route.providerCode
                ? { available: true, code: route.providerCode, name: route.providerName }
                : { available: false, code: null, name: null };
            return result;
        }, {});
    }
    async saveConfig(codeInput, input, adminUserId) {
        const code = this.normalizeCode(codeInput);
        const row = await this.getRow(code);
        const current = this.vault.decrypt(row.encryptedConfig);
        const next = code === 'EFI'
            ? this.sanitizeEfi(input, current)
            : this.sanitizeMercadoPago(input, current);
        const encrypted = this.vault.encrypt(next);
        await this.dataSource.transaction(async (manager) => {
            await manager.query(`UPDATE payment_provider_routes SET enabled = false, "providerCode" = NULL, "activatedAt" = NULL, "updatedBy" = $2, "updatedAt" = now()
         WHERE "providerCode" = $1`, [code, adminUserId]);
            await manager.query(`UPDATE payment_providers SET
           active = false,
           "encryptedConfig" = $2,
           "configVersion" = "configVersion" + 1,
           "lastHealthCheckAt" = NULL,
           "lastHealthCheckOk" = NULL,
           "lastHealthCheckMessage" = NULL,
           "lastHealthCheckDetails" = '{}'::jsonb,
           "activatedAt" = NULL,
           "updatedBy" = $3,
           "updatedAt" = now()
         WHERE code = $1`, [code, encrypted, adminUserId]);
            await manager.query(`INSERT INTO payment_provider_audit ("providerCode", action, "actorUserId", metadata)
         VALUES ($1,'CONFIG_UPDATED',$2,$3::jsonb)`, [code, adminUserId, JSON.stringify({ configVersion: Number(row.configVersion || 0) + 1, routesDisabled: true })]);
        });
        return this.getSafe(code);
    }
    async recordHealth(codeInput, operational, message, details = {}, adminUserId) {
        const code = this.normalizeCode(codeInput);
        await this.dataSource.query(`UPDATE payment_providers SET
         "lastHealthCheckAt" = now(),
         "lastHealthCheckOk" = $2,
         "lastHealthCheckMessage" = $3,
         "lastHealthCheckDetails" = $4::jsonb,
         "updatedAt" = now()
       WHERE code = $1`, [code, operational, String(message || '').slice(0, 2000), JSON.stringify(details || {})]);
        if (adminUserId) {
            await this.dataSource.query(`INSERT INTO payment_provider_audit ("providerCode", action, "actorUserId", metadata)
         VALUES ($1,'HEALTH_CHECK',$2,$3::jsonb)`, [code, adminUserId, JSON.stringify({ operational, message: String(message || '').slice(0, 500) })]);
        }
        return this.getSafe(code);
    }
    async activateRoute(codeInput, paymentTypeInput, adminUserId) {
        const code = this.normalizeCode(codeInput);
        const paymentType = this.normalizePaymentType(paymentTypeInput);
        const row = await this.getRow(code);
        if (row.lastHealthCheckOk !== true) {
            throw new common_1.BadRequestException('Este provedor precisa passar pelo teste operacional antes de ser habilitado.');
        }
        const config = this.vault.decrypt(row.encryptedConfig);
        if (!this.supportsType(code, config, paymentType)) {
            if (code === 'EFI' && paymentType === 'PIX_AUTOMATICO') {
                throw new common_1.BadRequestException('Ative e configure o Pix Automático dentro da Efí antes de selecionar este roteamento.');
            }
            throw new common_1.BadRequestException('Este provedor não está configurado para este tipo de pagamento.');
        }
        await this.dataSource.transaction(async (manager) => {
            await manager.query(`INSERT INTO payment_provider_routes ("paymentType","providerCode",enabled,"activatedAt","updatedBy","updatedAt")
         VALUES ($1,$2,true,now(),$3,now())
         ON CONFLICT ("paymentType") DO UPDATE SET
           "providerCode" = EXCLUDED."providerCode", enabled = true, "activatedAt" = now(), "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = now()`, [paymentType, code, adminUserId]);
            await manager.query(`INSERT INTO payment_provider_audit ("providerCode", action, "actorUserId", metadata)
         VALUES ($1,'ROUTE_ACTIVATED',$2,$3::jsonb)`, [code, adminUserId, JSON.stringify({ paymentType })]);
        });
        return this.listRoutesSafe();
    }
    async deactivateRoute(paymentTypeInput, adminUserId) {
        const paymentType = this.normalizePaymentType(paymentTypeInput);
        const rows = await this.dataSource.query(`SELECT "providerCode" FROM payment_provider_routes WHERE "paymentType" = $1 LIMIT 1`, [paymentType]);
        const providerCode = rows[0]?.providerCode ? this.normalizeCode(rows[0].providerCode) : null;
        await this.dataSource.query(`UPDATE payment_provider_routes SET enabled = false, "providerCode" = NULL, "activatedAt" = NULL, "updatedBy" = $2, "updatedAt" = now()
       WHERE "paymentType" = $1`, [paymentType, adminUserId]);
        if (providerCode) {
            await this.dataSource.query(`INSERT INTO payment_provider_audit ("providerCode", action, "actorUserId", metadata)
         VALUES ($1,'ROUTE_DEACTIVATED',$2,$3::jsonb)`, [providerCode, adminUserId, JSON.stringify({ paymentType })]);
        }
        return this.listRoutesSafe();
    }
    async activeProvider(paymentTypeInput) {
        const paymentType = this.normalizePaymentType(paymentTypeInput);
        const rows = await this.dataSource.query(`SELECT "providerCode" FROM payment_provider_routes WHERE "paymentType" = $1 AND enabled = true LIMIT 1`, [paymentType]);
        return rows[0]?.providerCode ? this.normalizeCode(rows[0].providerCode) : null;
    }
    vaultStatus() {
        return this.vault.status();
    }
};
exports.PaymentProviderConfigService = PaymentProviderConfigService;
exports.PaymentProviderConfigService = PaymentProviderConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        payment_provider_vault_service_1.PaymentProviderVaultService])
], PaymentProviderConfigService);
//# sourceMappingURL=payment-provider-config.service.js.map