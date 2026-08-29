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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminPaymentsController = exports.MercadoPagoPaymentsWebhookController = exports.EfiPaymentsWebhookController = exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const admin_guard_1 = require("../admin/admin.guard");
const payments_service_1 = require("./payments.service");
const billing_support_service_1 = require("./billing-support.service");
const product_duration_service_1 = require("./product-duration.service");
const efi_pix_service_1 = require("./efi-pix.service");
const mercado_pago_service_1 = require("./mercado-pago.service");
const mercado_pago_test_lab_service_1 = require("./mercado-pago-test-lab.service");
const payment_checkout_status_service_1 = require("./payment-checkout-status.service");
const payment_provider_manager_service_1 = require("./payment-provider-manager.service");
let PaymentsController = class PaymentsController {
    payments;
    billingSupport;
    providers;
    checkoutStatus;
    constructor(payments, billingSupport, providers, checkoutStatus) {
        this.payments = payments;
        this.billingSupport = billingSupport;
        this.providers = providers;
        this.checkoutStatus = checkoutStatus;
    }
    getCatalog() {
        return this.payments.listCatalog(false);
    }
    getPaymentRoutes() {
        return this.providers.publicRoutes();
    }
    getMine(req) {
        return this.payments.listUserPayments(req.user.uid);
    }
    getMyCredits(req) {
        return this.payments.getCredits(req.user.uid);
    }
    getMyBillingStatus(req) {
        return this.billingSupport.getMyBillingStatus(req.user.uid);
    }
    async createPix(req, body) {
        const productCode = String(body?.productCode || '').trim();
        if (!productCode)
            throw new common_1.BadRequestException('Informe o produto que deseja comprar.');
        const lifetimeActivation = await this.billingSupport.activateLifetimeProduct(req.user.uid, productCode);
        if (lifetimeActivation) {
            return {
                ...lifetimeActivation,
                paymentRequired: false,
                checkoutReady: false,
                message: 'Conta vitalícia: este recurso não exige pagamento.',
            };
        }
        const payment = await this.payments.createPixPayment(req.user.uid, productCode);
        const paymentId = String(payment.id);
        const devMode = await this.payments.getDevMode();
        if (devMode.enabled) {
            const settled = await this.payments.simulatePayment(paymentId, req.user.uid);
            return {
                ...payment,
                ...settled,
                id: paymentId,
                paymentId,
                product: payment.product,
                paymentRequired: false,
                checkoutReady: false,
                providerConfigured: false,
                devSimulation: true,
                message: 'Modo DEV: pagamento simulado e benefício liberado automaticamente, sem contabilizar receita real.',
            };
        }
        try {
            const checkout = await this.providers.createCheckout(payment, body?.payer || {});
            const stored = await this.payments.attachProviderCheckout(paymentId, checkout);
            const metadata = stored.metadata;
            const response = {
                ...stored,
                id: paymentId,
                paymentId,
                product: payment.product,
                checkoutReady: Boolean(stored.pixCopyPaste
                    || stored.qrCodeBase64
                    || metadata?.ticketUrl
                    || metadata?.subscriptionCheckoutUrl),
                providerConfigured: true,
                paymentRequired: true,
            };
            this.checkoutStatus.watchForUser(req.user.uid, paymentId);
            return response;
        }
        catch (error) {
            await this.payments.cancelProviderCheckout(paymentId, error).catch(() => undefined);
            throw error;
        }
    }
    async getResumeHistory(req) {
        const [analyses, improvements, publications] = await Promise.all([
            this.payments.listAnalysisHistory(req.user.uid),
            this.payments.listImprovementHistory(req.user.uid),
            this.payments.listPublicationHistory(req.user.uid),
        ]);
        return { analyses, improvements, publications };
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Get)('catalog'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "getCatalog", null);
__decorate([
    (0, common_1.Get)('provider'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "getPaymentRoutes", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "getMine", null);
__decorate([
    (0, common_1.Get)('me/credits'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "getMyCredits", null);
__decorate([
    (0, common_1.Get)('me/billing-status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "getMyBillingStatus", null);
__decorate([
    (0, common_1.Post)('pix'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "createPix", null);
__decorate([
    (0, common_1.Get)('me/resume-history'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "getResumeHistory", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, common_1.Controller)('payments'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService,
        billing_support_service_1.BillingSupportService,
        payment_provider_manager_service_1.PaymentProviderManagerService,
        payment_checkout_status_service_1.PaymentCheckoutStatusService])
], PaymentsController);
let EfiPaymentsWebhookController = class EfiPaymentsWebhookController {
    efiPix;
    constructor(efiPix) {
        this.efiPix = efiPix;
    }
    async receive(body, hmac) {
        if (Array.isArray(body?.pix))
            return this.efiPix.handlePixWebhook(body, hmac);
        if (Array.isArray(body?.recs) || Array.isArray(body?.rec)) {
            return this.efiPix.handleAutomaticRecurrenceWebhook(body, hmac);
        }
        if (Array.isArray(body?.cobsr))
            return this.efiPix.handleAutomaticChargeWebhook(body, hmac);
        return { ok: true, test: true };
    }
};
exports.EfiPaymentsWebhookController = EfiPaymentsWebhookController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('hmac')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EfiPaymentsWebhookController.prototype, "receive", null);
exports.EfiPaymentsWebhookController = EfiPaymentsWebhookController = __decorate([
    (0, common_1.Controller)('payments/webhooks/efi'),
    __metadata("design:paramtypes", [efi_pix_service_1.EfiPixService])
], EfiPaymentsWebhookController);
let MercadoPagoPaymentsWebhookController = class MercadoPagoPaymentsWebhookController {
    mercadoPago;
    constructor(mercadoPago) {
        this.mercadoPago = mercadoPago;
    }
    receive(body, query, headers) {
        return this.mercadoPago.handleWebhook(body, query, headers);
    }
};
exports.MercadoPagoPaymentsWebhookController = MercadoPagoPaymentsWebhookController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Headers)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], MercadoPagoPaymentsWebhookController.prototype, "receive", null);
exports.MercadoPagoPaymentsWebhookController = MercadoPagoPaymentsWebhookController = __decorate([
    (0, common_1.Controller)('payments/webhooks/mercado-pago'),
    __metadata("design:paramtypes", [mercado_pago_service_1.MercadoPagoService])
], MercadoPagoPaymentsWebhookController);
let AdminPaymentsController = class AdminPaymentsController {
    payments;
    billingSupport;
    productDuration;
    providers;
    mercadoPagoTests;
    constructor(payments, billingSupport, productDuration, providers, mercadoPagoTests) {
        this.payments = payments;
        this.billingSupport = billingSupport;
        this.productDuration = productDuration;
        this.providers = providers;
        this.mercadoPagoTests = mercadoPagoTests;
    }
    getDevMode() {
        return this.payments.getDevMode();
    }
    setDevMode(body) {
        if (typeof body?.enabled !== 'boolean')
            throw new common_1.BadRequestException('enabled deve ser true ou false.');
        return this.payments.setDevMode(body.enabled);
    }
    mercadoPagoTestOverview() {
        return this.mercadoPagoTests.overview();
    }
    saveMercadoPagoTestProfile(req, profile, body) {
        return this.mercadoPagoTests.saveProfile(profile, body || {}, req.user.uid);
    }
    testMercadoPagoCredentials(req, profile) {
        return this.mercadoPagoTests.testCredentials(profile, req.user.uid);
    }
    createMercadoPagoTestOrder(req) {
        return this.mercadoPagoTests.createOrder(req.user.uid);
    }
    getMercadoPagoTestOrder(req, orderId) {
        return this.mercadoPagoTests.getOrder(orderId, req.user.uid);
    }
    createMercadoPagoTestSubscription(req) {
        return this.mercadoPagoTests.createSubscription(req.user.uid);
    }
    getMercadoPagoTestSubscription(req, preapprovalId) {
        return this.mercadoPagoTests.getSubscription(preapprovalId, req.user.uid);
    }
    createMercadoPagoTestSplit(req) {
        return this.mercadoPagoTests.createMarketplaceSplit(req.user.uid);
    }
    getMercadoPagoTestSplit(req, paymentId) {
        return this.mercadoPagoTests.getMarketplacePayment(paymentId, req.user.uid);
    }
    getProviders() {
        return this.providers.list();
    }
    getProviderRoutes() {
        return this.providers.routes();
    }
    getProviderVaultStatus() {
        return this.providers.vaultStatus();
    }
    getProvider(code) {
        return this.providers.get(code);
    }
    saveProvider(req, code, body) {
        return this.providers.save(code, body || {}, req.user.uid);
    }
    testProvider(req, code) {
        return this.providers.test(code, req.user.uid);
    }
    activateProvider(req, code, body) {
        if (!body?.paymentType)
            throw new common_1.BadRequestException('Informe o tipo de pagamento que este provedor atenderá.');
        return this.providers.activate(code, body.paymentType, req.user.uid);
    }
    deactivateProviderRoute(req, paymentType) {
        return this.providers.deactivate(paymentType, req.user.uid);
    }
    performance() {
        return this.payments.productPerformance();
    }
    getProducts() {
        return this.payments.listCatalog(true);
    }
    updateProduct(code, body) {
        return this.payments.updateProduct(code, body || {});
    }
    updateProductDuration(code, body) {
        return this.productDuration.update(code, Number(body?.durationDays));
    }
    summary() {
        return this.payments.paymentSummary();
    }
    searchUsers(query, limit) {
        return this.billingSupport.searchUsers(query || '', Number(limit || 30));
    }
    getUserSupport(userId) {
        return this.billingSupport.getUserSupport(userId);
    }
    setLifetime(req, userId, body) {
        return this.billingSupport.setLifetimeFree(userId, body?.enabled === true, req.user.uid, body?.note);
    }
    setCreditBalance(req, userId, rawFeature, body) {
        return this.billingSupport.setCreditBalance(userId, rawFeature, Number(body?.quantity || 0), req.user.uid, body?.note);
    }
    grantEntitlement(req, userId, rawFeature, body) {
        return this.billingSupport.grantTimedFeature(userId, rawFeature, Number(body?.durationDays || 30), req.user.uid, body?.note);
    }
    revokeEntitlement(req, userId, rawFeature, body) {
        return this.billingSupport.revokeTimedFeature(userId, rawFeature, req.user.uid, body?.note);
    }
    activateSubscription(req, userId, body) {
        return this.billingSupport.activateSubscription(userId, String(body?.productCode || 'PREMIUM_MONTHLY'), req.user.uid, body?.durationDays, body?.note);
    }
    updateSubscriptionStatus(req, userId, subscriptionId, body) {
        if (!body?.status)
            throw new common_1.BadRequestException('Informe o status da assinatura.');
        return this.billingSupport.setSubscriptionStatus(userId, subscriptionId, body.status, req.user.uid);
    }
    list(limit) {
        return this.payments.listAllPayments(Number(limit || 200));
    }
    confirm(req, id) {
        return this.payments.confirmPayment(id, {
            confirmedByAdmin: req.user.uid,
            confirmationMode: 'ADMIN_MANUAL',
        });
    }
    simulate(req, id) {
        return this.payments.simulatePayment(id, req.user.uid);
    }
    grantCredit(userId, body) {
        const feature = String(body?.feature || '');
        if (!['RESUME_REANALYSIS', 'RESUME_AI_IMPROVEMENT', 'RESUME_AI_IMPORT'].includes(feature)) {
            throw new common_1.BadRequestException('Recurso de crédito inválido.');
        }
        return this.payments.grantCredit(userId, feature, Number(body?.quantity || 1));
    }
};
exports.AdminPaymentsController = AdminPaymentsController;
__decorate([
    (0, common_1.Get)('dev-mode'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "getDevMode", null);
__decorate([
    (0, common_1.Patch)('dev-mode'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "setDevMode", null);
__decorate([
    (0, common_1.Get)('mercado-pago-tests'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "mercadoPagoTestOverview", null);
__decorate([
    (0, common_1.Patch)('mercado-pago-tests/:profile'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('profile')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "saveMercadoPagoTestProfile", null);
__decorate([
    (0, common_1.Post)('mercado-pago-tests/:profile/credentials'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('profile')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "testMercadoPagoCredentials", null);
__decorate([
    (0, common_1.Post)('mercado-pago-tests/orders/create'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "createMercadoPagoTestOrder", null);
__decorate([
    (0, common_1.Get)('mercado-pago-tests/orders/:orderId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "getMercadoPagoTestOrder", null);
__decorate([
    (0, common_1.Post)('mercado-pago-tests/subscriptions/create'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "createMercadoPagoTestSubscription", null);
__decorate([
    (0, common_1.Get)('mercado-pago-tests/subscriptions/:preapprovalId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('preapprovalId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "getMercadoPagoTestSubscription", null);
__decorate([
    (0, common_1.Post)('mercado-pago-tests/marketplace/create'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "createMercadoPagoTestSplit", null);
__decorate([
    (0, common_1.Get)('mercado-pago-tests/marketplace/:paymentId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('paymentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "getMercadoPagoTestSplit", null);
__decorate([
    (0, common_1.Get)('providers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "getProviders", null);
__decorate([
    (0, common_1.Get)('providers/routes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "getProviderRoutes", null);
__decorate([
    (0, common_1.Get)('providers/vault-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "getProviderVaultStatus", null);
__decorate([
    (0, common_1.Get)('providers/:code'),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "getProvider", null);
__decorate([
    (0, common_1.Patch)('providers/:code'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('code')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "saveProvider", null);
__decorate([
    (0, common_1.Post)('providers/:code/test'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "testProvider", null);
__decorate([
    (0, common_1.Post)('providers/:code/activate'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('code')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "activateProvider", null);
__decorate([
    (0, common_1.Post)('providers/routes/:paymentType/deactivate'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('paymentType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "deactivateProviderRoute", null);
__decorate([
    (0, common_1.Get)('performance'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "performance", null);
__decorate([
    (0, common_1.Get)('products'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "getProducts", null);
__decorate([
    (0, common_1.Patch)('products/:code'),
    __param(0, (0, common_1.Param)('code')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "updateProduct", null);
__decorate([
    (0, common_1.Patch)('products/:code/duration'),
    __param(0, (0, common_1.Param)('code')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "updateProductDuration", null);
__decorate([
    (0, common_1.Get)('summary'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('users'),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "searchUsers", null);
__decorate([
    (0, common_1.Get)('users/:userId/support'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "getUserSupport", null);
__decorate([
    (0, common_1.Patch)('users/:userId/lifetime'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "setLifetime", null);
__decorate([
    (0, common_1.Patch)('users/:userId/credits/:feature'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Param)('feature')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "setCreditBalance", null);
__decorate([
    (0, common_1.Post)('users/:userId/entitlements/:feature'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Param)('feature')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "grantEntitlement", null);
__decorate([
    (0, common_1.Post)('users/:userId/entitlements/:feature/revoke'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Param)('feature')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "revokeEntitlement", null);
__decorate([
    (0, common_1.Post)('users/:userId/subscriptions'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "activateSubscription", null);
__decorate([
    (0, common_1.Patch)('users/:userId/subscriptions/:subscriptionId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Param)('subscriptionId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "updateSubscriptionStatus", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(':id/confirm'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "confirm", null);
__decorate([
    (0, common_1.Post)(':id/simulate'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "simulate", null);
__decorate([
    (0, common_1.Post)('credits/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminPaymentsController.prototype, "grantCredit", null);
exports.AdminPaymentsController = AdminPaymentsController = __decorate([
    (0, common_1.Controller)('admin/payments'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService,
        billing_support_service_1.BillingSupportService,
        product_duration_service_1.ProductDurationService,
        payment_provider_manager_service_1.PaymentProviderManagerService,
        mercado_pago_test_lab_service_1.MercadoPagoTestLabService])
], AdminPaymentsController);
//# sourceMappingURL=payments.controller.js.map