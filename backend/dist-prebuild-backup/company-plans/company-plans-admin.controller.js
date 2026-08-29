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
exports.CompanyPlansAdminController = void 0;
const common_1 = require("@nestjs/common");
const admin_guard_1 = require("../admin/admin.guard");
const auth_guard_1 = require("../auth/auth.guard");
const company_plans_admin_service_1 = require("./company-plans-admin.service");
const company_plans_service_1 = require("./company-plans.service");
let CompanyPlansAdminController = class CompanyPlansAdminController {
    adminPlans;
    plans;
    constructor(adminPlans, plans) {
        this.adminPlans = adminPlans;
        this.plans = plans;
    }
    benefitCatalog() {
        return this.plans.commercialBenefitCatalog();
    }
    get(companyId) {
        return this.adminPlans.get(companyId);
    }
    set(req, companyId, body) {
        return this.adminPlans.set(companyId, body?.plan, body?.currentPeriodEnd, req.user.uid);
    }
};
exports.CompanyPlansAdminController = CompanyPlansAdminController;
__decorate([
    (0, common_1.Get)('benefit-catalog'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CompanyPlansAdminController.prototype, "benefitCatalog", null);
__decorate([
    (0, common_1.Get)(':companyId'),
    __param(0, (0, common_1.Param)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyPlansAdminController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)(':companyId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('companyId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], CompanyPlansAdminController.prototype, "set", null);
exports.CompanyPlansAdminController = CompanyPlansAdminController = __decorate([
    (0, common_1.Controller)('admin/company-plans'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [company_plans_admin_service_1.CompanyPlansAdminService,
        company_plans_service_1.CompanyPlansService])
], CompanyPlansAdminController);
//# sourceMappingURL=company-plans-admin.controller.js.map