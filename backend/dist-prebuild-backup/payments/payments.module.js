"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const admin_guard_1 = require("../admin/admin.guard");
const chat_module_1 = require("../chat/chat.module");
const user_entity_1 = require("../users/entities/user.entity");
const payments_controller_1 = require("./payments.controller");
const commercial_payments_controller_1 = require("./commercial-payments.controller");
const commercial_payments_service_1 = require("./commercial-payments.service");
const payment_provider_public_controller_1 = require("./payment-provider-public.controller");
const payment_checkout_status_controller_1 = require("./payment-checkout-status.controller");
const payments_service_1 = require("./payments.service");
const billing_support_service_1 = require("./billing-support.service");
const product_duration_service_1 = require("./product-duration.service");
const efi_pix_service_1 = require("./efi-pix.service");
const mercado_pago_service_1 = require("./mercado-pago.service");
const mercado_pago_test_lab_service_1 = require("./mercado-pago-test-lab.service");
const payment_checkout_status_service_1 = require("./payment-checkout-status.service");
const payment_provider_vault_service_1 = require("./payment-provider-vault.service");
const payment_provider_config_service_1 = require("./payment-provider-config.service");
const payment_provider_manager_service_1 = require("./payment-provider-manager.service");
let PaymentsModule = class PaymentsModule {
};
exports.PaymentsModule = PaymentsModule;
exports.PaymentsModule = PaymentsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([user_entity_1.User]), chat_module_1.ChatModule],
        controllers: [
            payments_controller_1.PaymentsController,
            commercial_payments_controller_1.CommercialPaymentsController,
            commercial_payments_controller_1.AdminCommercialPaymentsController,
            payment_provider_public_controller_1.PaymentProviderPublicController,
            payment_checkout_status_controller_1.PaymentCheckoutStatusController,
            payments_controller_1.EfiPaymentsWebhookController,
            payments_controller_1.MercadoPagoPaymentsWebhookController,
            payments_controller_1.AdminPaymentsController,
        ],
        providers: [
            payments_service_1.PaymentsService,
            commercial_payments_service_1.CommercialPaymentsService,
            billing_support_service_1.BillingSupportService,
            product_duration_service_1.ProductDurationService,
            payment_provider_vault_service_1.PaymentProviderVaultService,
            payment_provider_config_service_1.PaymentProviderConfigService,
            efi_pix_service_1.EfiPixService,
            mercado_pago_service_1.MercadoPagoService,
            mercado_pago_test_lab_service_1.MercadoPagoTestLabService,
            payment_checkout_status_service_1.PaymentCheckoutStatusService,
            payment_provider_manager_service_1.PaymentProviderManagerService,
            admin_guard_1.AdminGuard,
        ],
        exports: [
            payments_service_1.PaymentsService,
            commercial_payments_service_1.CommercialPaymentsService,
            billing_support_service_1.BillingSupportService,
            product_duration_service_1.ProductDurationService,
            payment_provider_config_service_1.PaymentProviderConfigService,
            payment_provider_manager_service_1.PaymentProviderManagerService,
            payment_provider_vault_service_1.PaymentProviderVaultService,
            efi_pix_service_1.EfiPixService,
            mercado_pago_service_1.MercadoPagoService,
            mercado_pago_test_lab_service_1.MercadoPagoTestLabService,
            payment_checkout_status_service_1.PaymentCheckoutStatusService,
        ],
    })
], PaymentsModule);
//# sourceMappingURL=payments.module.js.map