"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplianceModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const admin_guard_1 = require("../admin/admin.guard");
const user_entity_1 = require("../users/entities/user.entity");
const cnpj_lookup_service_1 = require("./cnpj-lookup.service");
const company_context_repair_service_1 = require("./company-context-repair.service");
const company_verification_authorization_service_1 = require("./company-verification-authorization.service");
const company_verification_controller_1 = require("./company-verification.controller");
const company_verification_email_service_1 = require("./company-verification-email.service");
const identity_compliance_controller_1 = require("./identity-compliance.controller");
const identity_compliance_service_1 = require("./identity-compliance.service");
let ComplianceModule = class ComplianceModule {
};
exports.ComplianceModule = ComplianceModule;
exports.ComplianceModule = ComplianceModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([user_entity_1.User])],
        controllers: [
            identity_compliance_controller_1.IdentityComplianceController,
            identity_compliance_controller_1.IdentityComplianceAdminController,
            company_verification_controller_1.CompanyVerificationController,
            company_verification_controller_1.CompanyVerificationPublicController,
            company_verification_controller_1.CompanyVerificationAdminController,
        ],
        providers: [
            admin_guard_1.AdminGuard,
            identity_compliance_service_1.IdentityComplianceService,
            company_context_repair_service_1.CompanyContextRepairService,
            cnpj_lookup_service_1.CnpjLookupService,
            company_verification_email_service_1.CompanyVerificationEmailService,
            company_verification_authorization_service_1.CompanyVerificationAuthorizationService,
        ],
        exports: [
            identity_compliance_service_1.IdentityComplianceService,
            company_context_repair_service_1.CompanyContextRepairService,
            cnpj_lookup_service_1.CnpjLookupService,
            company_verification_authorization_service_1.CompanyVerificationAuthorizationService,
        ],
    })
], ComplianceModule);
//# sourceMappingURL=compliance.module.js.map