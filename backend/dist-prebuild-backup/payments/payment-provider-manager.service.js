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
exports.PaymentProviderManagerService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const efi_pix_service_1 = require("./efi-pix.service");
const mercado_pago_service_1 = require("./mercado-pago.service");
const payment_provider_config_service_1 = require("./payment-provider-config.service");
let PaymentProviderManagerService = class PaymentProviderManagerService {
    dataSource;
    providerConfig;
    efi;
    mercadoPago;
    constructor(dataSource, providerConfig, efi, mercadoPago) {
        this.dataSource = dataSource;
        this.providerConfig = providerConfig;
        this.efi = efi;
        this.mercadoPago = mercadoPago;
    }
    isNativeAutomaticPixProvider(code) {
        return code === 'EFI';
    }
    async efiAutomaticEnabled() {
        try {
            const config = await this.providerConfig.getSecretConfig('EFI');
            return config.pixAutomaticEnabled === true;
        }
        catch {
            return false;
        }
    }
    async list() {
        const providers = await this.providerConfig.listSafe();
        return providers.map((provider) => {
            if (provider.code !== 'MERCADO_PAGO')
                return provider;
            return {
                ...provider,
                activeFor: Array.isArray(provider.activeFor)
                    ? provider.activeFor.filter((type) => type !== 'PIX_AUTOMATICO')
                    : [],
                config: {
                    ...(provider.config || {}),
                    capabilities: Array.isArray(provider.config?.capabilities)
                        ? provider.config.capabilities.filter((type) => type !== 'PIX_AUTOMATICO')
                        : ['PIX'],
                    recurringApi: 'SUBSCRIPTIONS',
                    recurringIsPixAutomatic: false,
                },
            };
        });
    }
    async routes() {
        const [routes, efiAutomaticEnabled] = await Promise.all([
            this.providerConfig.listRoutesSafe(),
            this.efiAutomaticEnabled(),
        ]);
        return routes.map((route) => {
            if (route.paymentType === 'PIX_AUTOMATICO'
                && route.enabled === true
                && route.providerCode
                && !this.isNativeAutomaticPixProvider(route.providerCode)) {
                return {
                    ...route,
                    enabled: false,
                    providerCode: null,
                    providerName: null,
                    invalidLegacyRoute: true,
                    message: 'A rota antiga apontava para uma assinatura do Mercado Pago, não para Pix Automático nativo.',
                };
            }
            if (route.paymentType === 'PIX_AUTOMATICO'
                && route.enabled === true
                && route.providerCode === 'EFI'
                && !efiAutomaticEnabled) {
                return {
                    ...route,
                    enabled: false,
                    providerCode: null,
                    providerName: null,
                    automaticPixDisabled: true,
                    message: 'A Efí está cadastrada, mas Pix Automático está desativado na configuração do provedor.',
                };
            }
            return route;
        });
    }
    async publicRoutes() {
        const routes = await this.routes();
        return routes.reduce((result, route) => {
            result[route.paymentType] = route.enabled && route.providerCode
                ? { available: true, code: route.providerCode, name: route.providerName }
                : {
                    available: false,
                    code: null,
                    name: null,
                    reason: route.invalidLegacyRoute
                        ? 'INVALID_LEGACY_ROUTE'
                        : route.automaticPixDisabled
                            ? 'EFI_AUTOMATIC_PIX_DISABLED'
                            : null,
                };
            return result;
        }, {});
    }
    get(code) {
        return this.providerConfig.getSafe(code);
    }
    save(code, body, adminUserId) {
        return this.providerConfig.saveConfig(code, body, adminUserId);
    }
    vaultStatus() {
        return this.providerConfig.vaultStatus();
    }
    adapter(code) {
        if (code === 'EFI')
            return this.efi;
        if (code === 'MERCADO_PAGO')
            return this.mercadoPago;
        throw new common_1.BadRequestException('Forma de pagamento não suportada.');
    }
    async test(codeInput, adminUserId) {
        const code = this.providerConfig.normalizeCode(codeInput);
        try {
            const adapter = this.adapter(code);
            const result = await adapter.healthCheck();
            return this.providerConfig.recordHealth(code, result?.operational === true, String(result?.message || 'Teste concluído.'), result?.details || {}, adminUserId);
        }
        catch (error) {
            const message = error?.response?.message
                || error?.response?.data?.message
                || error?.message
                || 'A API não respondeu ao teste operacional.';
            return this.providerConfig.recordHealth(code, false, String(message).slice(0, 2000), {}, adminUserId);
        }
    }
    async activate(codeInput, paymentTypeInput, adminUserId) {
        const code = this.providerConfig.normalizeCode(codeInput);
        const paymentType = this.providerConfig.normalizePaymentType(paymentTypeInput);
        if (paymentType === 'PIX_AUTOMATICO' && !this.isNativeAutomaticPixProvider(code)) {
            throw new common_1.BadRequestException('Mercado Pago Assinaturas não é Pix Automático. Para a rota Pix Automático, selecione uma integração nativa compatível, atualmente Efí Bank.');
        }
        const tested = await this.test(code, adminUserId);
        if (tested.lastHealthCheckOk !== true) {
            throw new common_1.BadRequestException(tested.lastHealthCheckMessage || 'A forma de pagamento não passou pelo teste operacional.');
        }
        if (code === 'EFI') {
            try {
                await this.efi.configureWebhooks(paymentType);
            }
            catch (error) {
                const responseMessage = error?.response?.message;
                const message = typeof responseMessage === 'string'
                    ? responseMessage
                    : error?.message || 'A Efí respondeu, mas o Webhook não pôde ser registrado.';
                await this.providerConfig.recordHealth(code, false, String(message), { stage: 'WEBHOOK_CONFIGURATION', paymentType }, adminUserId);
                throw new common_1.BadRequestException(`Efí não habilitada para ${paymentType === 'PIX' ? 'Pix avulso' : 'Pix Automático'}: ${message}`);
            }
        }
        const routes = await this.providerConfig.activateRoute(code, paymentType, adminUserId);
        return { provider: await this.providerConfig.getSafe(code), routes };
    }
    deactivate(paymentType, adminUserId) {
        return this.providerConfig.deactivateRoute(paymentType, adminUserId);
    }
    async createCheckout(payment, payerInput = {}, options = {}) {
        const trialDays = Math.max(0, Math.min(30, Math.round(Number(options.trialDays || 0))));
        const paymentType = payment.product?.billingType === 'RECURRING'
            ? 'PIX_AUTOMATICO'
            : 'PIX';
        const active = await this.providerConfig.activeProvider(paymentType);
        if (!active) {
            throw new common_1.ServiceUnavailableException(paymentType === 'PIX_AUTOMATICO'
                ? 'Nenhum provedor está habilitado para Pix Automático. Configure a rota em Formas de pagamento.'
                : 'Nenhum provedor está habilitado para Pix. Configure a rota em Formas de pagamento.');
        }
        if (paymentType === 'PIX_AUTOMATICO' && !this.isNativeAutomaticPixProvider(active)) {
            throw new common_1.ServiceUnavailableException('A rota de Pix Automático está apontando para uma integração de assinatura que não gera Pix Automático nativo. Selecione Efí Bank em Formas de pagamento.');
        }
        if (paymentType === 'PIX_AUTOMATICO' && !(await this.efiAutomaticEnabled())) {
            throw new common_1.ServiceUnavailableException('Pix Automático da Efí está desativado. Ative o recurso na configuração da Efí antes de oferecer assinaturas.');
        }
        const userRows = await this.dataSource.query(`SELECT email, "fullName", "displayName" FROM users WHERE id = $1 LIMIT 1`, [payment.userId]);
        const user = userRows[0] || {};
        const document = String(payerInput.document || '').replace(/\D/g, '');
        const requestedType = String(payerInput.documentType || '').toUpperCase();
        const documentType = requestedType === 'CNPJ' || (!requestedType && document.length === 14)
            ? 'CNPJ'
            : 'CPF';
        if (document && ((documentType === 'CPF' && document.length !== 11) || (documentType === 'CNPJ' && document.length !== 14))) {
            throw new common_1.BadRequestException(`Informe um ${documentType} válido.`);
        }
        const payer = {
            ...payerInput,
            document: document || undefined,
            documentType,
            email: String(payerInput.email || user.email || '').trim(),
            name: String(payerInput.name || user.fullName || user.displayName || '').trim(),
        };
        if (active === 'EFI') {
            if (paymentType === 'PIX_AUTOMATICO' && payer.documentType === 'CNPJ') {
                throw new common_1.BadRequestException('A rota atual de Pix Automático está usando Efí e este fluxo está configurado para CPF. Informe um CPF para a autorização recorrente.');
            }
            return paymentType === 'PIX_AUTOMATICO'
                ? this.efi.createMonthlyAutomaticCharge(Number(payment.amountCents), payment.id, payment.product?.name || payment.productCode, payer, trialDays)
                : this.efi.createImmediateCharge(Number(payment.amountCents), payment.id, payment.product?.name || payment.productCode);
        }
        if (active === 'MERCADO_PAGO') {
            if (paymentType === 'PIX_AUTOMATICO') {
                throw new common_1.ServiceUnavailableException('Mercado Pago Assinaturas não será usado como substituto de Pix Automático.');
            }
            return this.mercadoPago.createImmediateCharge(Number(payment.amountCents), payment.id, payment.product?.name || payment.productCode, payer);
        }
        throw new common_1.ServiceUnavailableException('A forma de pagamento selecionada não possui adapter carregado.');
    }
};
exports.PaymentProviderManagerService = PaymentProviderManagerService;
exports.PaymentProviderManagerService = PaymentProviderManagerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        payment_provider_config_service_1.PaymentProviderConfigService,
        efi_pix_service_1.EfiPixService,
        mercado_pago_service_1.MercadoPagoService])
], PaymentProviderManagerService);
//# sourceMappingURL=payment-provider-manager.service.js.map