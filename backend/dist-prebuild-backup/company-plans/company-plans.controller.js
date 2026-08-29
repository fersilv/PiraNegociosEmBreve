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
exports.CompanyPlansController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const company_plan_commerce_service_1 = require("./company-plan-commerce.service");
const company_plans_overview_service_1 = require("./company-plans-overview.service");
const company_plans_service_1 = require("./company-plans.service");
let CompanyPlansController = class CompanyPlansController {
    plans;
    overview;
    commerce;
    constructor(plans, overview, commerce) {
        this.plans = plans;
        this.overview = overview;
        this.commerce = commerce;
    }
    async getPlans(req) {
        const base = await this.overview.getForUser(req.user.uid);
        return this.commerce.enrichOverview(base);
    }
    latestCheckout(req) {
        return this.plans.latestCheckout(req.user.uid);
    }
    checkout(req, body) {
        return this.commerce.createCheckout(req.user.uid, body?.plan, body?.purchaseMode || 'SUBSCRIPTION', body?.payer || {});
    }
    cancelAtPeriodEnd(req, body) {
        return this.plans.setCancelAtPeriodEnd(req.user.uid, body?.enabled !== false);
    }
};
exports.CompanyPlansController = CompanyPlansController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CompanyPlansController.prototype, "getPlans", null);
__decorate([
    (0, common_1.Get)('checkout/latest'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CompanyPlansController.prototype, "latestCheckout", null);
__decorate([
    (0, common_1.Post)('checkout'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CompanyPlansController.prototype, "checkout", null);
__decorate([
    (0, common_1.Patch)('cancel-at-period-end'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CompanyPlansController.prototype, "cancelAtPeriodEnd", null);
exports.CompanyPlansController = CompanyPlansController = __decorate([
    (0, common_1.Controller)('company/plans'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [company_plans_service_1.CompanyPlansService,
        company_plans_overview_service_1.CompanyPlansOverviewService,
        company_plan_commerce_service_1.CompanyPlanCommerceService])
], CompanyPlansController);
//# sourceMappingURL=company-plans.controller.js.map