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
exports.PaymentProviderPublicController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const payment_provider_manager_service_1 = require("./payment-provider-manager.service");
let PaymentProviderPublicController = class PaymentProviderPublicController {
    providers;
    constructor(providers) {
        this.providers = providers;
    }
    async activeProviderSummary() {
        const providers = await this.providers.list();
        const active = providers.filter((item) => item.active === true);
        return active.map((provider) => ({
            code: provider.code,
            name: provider.name,
            activeFor: provider.activeFor || [],
            capabilities: provider.config?.capabilities || [],
            environment: provider.config?.environment || null,
        }));
    }
};
exports.PaymentProviderPublicController = PaymentProviderPublicController;
__decorate([
    (0, common_1.Get)('provider-summary'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PaymentProviderPublicController.prototype, "activeProviderSummary", null);
exports.PaymentProviderPublicController = PaymentProviderPublicController = __decorate([
    (0, common_1.Controller)('payments'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [payment_provider_manager_service_1.PaymentProviderManagerService])
], PaymentProviderPublicController);
//# sourceMappingURL=payment-provider-public.controller.js.map