"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyPlansModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const admin_guard_1 = require("../admin/admin.guard");
const applications_module_1 = require("../applications/applications.module");
const application_entity_1 = require("../applications/entities/application.entity");
const companies_module_1 = require("../companies/companies.module");
const company_candidate_note_entity_1 = require("../companies/entities/company-candidate-note.entity");
const company_talent_folder_entity_1 = require("../companies/entities/company-talent-folder.entity");
const company_talent_record_entity_1 = require("../companies/entities/company-talent-record.entity");
const job_entity_1 = require("../jobs/entities/job.entity");
const payments_module_1 = require("../payments/payments.module");
const user_entity_1 = require("../users/entities/user.entity");
const company_plan_commerce_service_1 = require("./company-plan-commerce.service");
const company_plans_admin_controller_1 = require("./company-plans-admin.controller");
const company_plans_admin_service_1 = require("./company-plans-admin.service");
const company_plans_controller_1 = require("./company-plans.controller");
const company_plans_overview_service_1 = require("./company-plans-overview.service");
const company_plans_service_1 = require("./company-plans.service");
const company_whatsapp_premium_service_1 = require("./company-whatsapp-premium.service");
let CompanyPlansModule = class CompanyPlansModule {
};
exports.CompanyPlansModule = CompanyPlansModule;
exports.CompanyPlansModule = CompanyPlansModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                job_entity_1.Job,
                application_entity_1.Application,
                user_entity_1.User,
                company_talent_folder_entity_1.CompanyTalentFolder,
                company_talent_record_entity_1.CompanyTalentRecord,
                company_candidate_note_entity_1.CompanyCandidateNote,
            ]),
            payments_module_1.PaymentsModule,
            applications_module_1.ApplicationsModule,
            companies_module_1.CompaniesModule,
        ],
        controllers: [company_plans_controller_1.CompanyPlansController, company_plans_admin_controller_1.CompanyPlansAdminController],
        providers: [
            company_plans_service_1.CompanyPlansService,
            company_plan_commerce_service_1.CompanyPlanCommerceService,
            company_plans_overview_service_1.CompanyPlansOverviewService,
            company_plans_admin_service_1.CompanyPlansAdminService,
            company_whatsapp_premium_service_1.CompanyWhatsAppPremiumService,
            admin_guard_1.AdminGuard,
        ],
        exports: [
            company_plans_service_1.CompanyPlansService,
            company_plan_commerce_service_1.CompanyPlanCommerceService,
            company_plans_admin_service_1.CompanyPlansAdminService,
            company_whatsapp_premium_service_1.CompanyWhatsAppPremiumService,
        ],
    })
], CompanyPlansModule);
//# sourceMappingURL=company-plans.module.js.map