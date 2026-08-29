"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const admin_guard_1 = require("../admin/admin.guard");
const admin_module_1 = require("../admin/admin.module");
const ai_module_1 = require("../ai/ai.module");
const application_entity_1 = require("../applications/entities/application.entity");
const auth_guard_1 = require("../auth/auth.guard");
const auth_module_1 = require("../auth/auth.module");
const company_plans_module_1 = require("../company-plans/company-plans.module");
const company_entity_1 = require("../companies/entities/company.entity");
const jobs_oauth_entity_1 = require("../external-api/entities/jobs-oauth.entity");
const external_api_module_1 = require("../external-api/external-api.module");
const job_match_module_1 = require("../job-match/job-match.module");
const job_entity_1 = require("../jobs/entities/job.entity");
const jobs_module_1 = require("../jobs/jobs.module");
const payments_module_1 = require("../payments/payments.module");
const user_entity_1 = require("../users/entities/user.entity");
const oauth_broker_controller_1 = require("./oauth-broker.controller");
const oauth_broker_service_1 = require("./oauth-broker.service");
const whatsapp_api_key_entity_1 = require("./entities/whatsapp-api-key.entity");
const whatsapp_concierge_entity_1 = require("./entities/whatsapp-concierge.entity");
const whatsapp_contact_entity_1 = require("./entities/whatsapp-contact.entity");
const whatsapp_instance_entity_1 = require("./entities/whatsapp-instance.entity");
const whatsapp_message_entity_1 = require("./entities/whatsapp-message.entity");
const whatsapp_oauth_entity_1 = require("./entities/whatsapp-oauth.entity");
const whatsapp_admin_controller_1 = require("./whatsapp-admin.controller");
const whatsapp_ai_service_1 = require("./whatsapp-ai.service");
const whatsapp_alert_service_1 = require("./whatsapp-alert.service");
const whatsapp_api_controller_1 = require("./whatsapp-api.controller");
const whatsapp_concierge_service_1 = require("./whatsapp-concierge.service");
const whatsapp_key_guard_1 = require("./whatsapp-key.guard");
const whatsapp_mcp_controller_1 = require("./whatsapp-mcp.controller");
const whatsapp_oauth_controller_1 = require("./whatsapp-oauth.controller");
const whatsapp_oauth_guard_1 = require("./whatsapp-oauth.guard");
const whatsapp_oauth_service_1 = require("./whatsapp-oauth.service");
const whatsapp_phone_verification_controller_1 = require("./whatsapp-phone-verification.controller");
const whatsapp_phone_verification_service_1 = require("./whatsapp-phone-verification.service");
const whatsapp_service_1 = require("./whatsapp.service");
let WhatsAppModule = class WhatsAppModule {
};
exports.WhatsAppModule = WhatsAppModule;
exports.WhatsAppModule = WhatsAppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                user_entity_1.User,
                company_entity_1.Company,
                job_entity_1.Job,
                application_entity_1.Application,
                whatsapp_instance_entity_1.WhatsAppInstance,
                whatsapp_api_key_entity_1.WhatsAppApiKey,
                whatsapp_message_entity_1.WhatsAppMessage,
                whatsapp_contact_entity_1.WhatsAppSavedContact,
                whatsapp_oauth_entity_1.WhatsAppOAuthClient,
                whatsapp_oauth_entity_1.WhatsAppOAuthCode,
                whatsapp_oauth_entity_1.WhatsAppOAuthToken,
                jobs_oauth_entity_1.JobsOAuthClient,
                whatsapp_concierge_entity_1.WhatsAppConversation,
                whatsapp_concierge_entity_1.WhatsAppPhoneOtp,
            ]),
            auth_module_1.AuthModule,
            admin_module_1.AdminModule,
            ai_module_1.AiModule,
            payments_module_1.PaymentsModule,
            jobs_module_1.JobsModule,
            job_match_module_1.JobMatchModule,
            external_api_module_1.ExternalApiModule,
            company_plans_module_1.CompanyPlansModule,
        ],
        controllers: [
            whatsapp_admin_controller_1.WhatsAppAdminController,
            whatsapp_api_controller_1.WhatsAppApiController,
            whatsapp_mcp_controller_1.WhatsAppMcpController,
            oauth_broker_controller_1.OAuthBrokerController,
            whatsapp_oauth_controller_1.WhatsAppOAuthController,
            whatsapp_phone_verification_controller_1.WhatsAppPhoneVerificationController,
        ],
        providers: [
            whatsapp_service_1.WhatsAppService,
            whatsapp_ai_service_1.WhatsAppAiService,
            whatsapp_alert_service_1.WhatsAppAlertService,
            whatsapp_concierge_service_1.WhatsAppConciergeService,
            whatsapp_phone_verification_service_1.WhatsAppPhoneVerificationService,
            whatsapp_oauth_service_1.WhatsAppOAuthService,
            oauth_broker_service_1.OAuthBrokerService,
            whatsapp_oauth_guard_1.WhatsAppOAuthGuard,
            whatsapp_key_guard_1.WhatsAppApiKeyGuard,
            auth_guard_1.FirebaseAuthGuard,
            admin_guard_1.AdminGuard,
        ],
        exports: [
            whatsapp_service_1.WhatsAppService,
            whatsapp_oauth_service_1.WhatsAppOAuthService,
            oauth_broker_service_1.OAuthBrokerService,
            whatsapp_phone_verification_service_1.WhatsAppPhoneVerificationService,
        ],
    })
], WhatsAppModule);
//# sourceMappingURL=whatsapp.module.js.map