"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalApiModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const admin_guard_1 = require("../admin/admin.guard");
const job_match_module_1 = require("../job-match/job-match.module");
const job_entity_1 = require("../jobs/entities/job.entity");
const user_entity_1 = require("../users/entities/user.entity");
const api_key_guard_1 = require("./api-key.guard");
const controlled_ai_automation_service_1 = require("./controlled-ai-automation.service");
const external_api_admin_controller_1 = require("./external-api-admin.controller");
const external_api_controller_1 = require("./external-api.controller");
const external_api_v2_controller_1 = require("./external-api-v2.controller");
const external_jobs_service_1 = require("./external-jobs.service");
const external_api_client_entity_1 = require("./entities/external-api-client.entity");
const external_api_request_entity_1 = require("./entities/external-api-request.entity");
const jobs_oauth_entity_1 = require("./entities/jobs-oauth.entity");
const jobs_integrations_admin_controller_1 = require("./jobs-integrations-admin.controller");
const jobs_mcp_controller_1 = require("./jobs-mcp.controller");
const jobs_oauth_controller_1 = require("./jobs-oauth.controller");
const jobs_oauth_guard_1 = require("./jobs-oauth.guard");
const jobs_oauth_service_1 = require("./jobs-oauth.service");
const jobs_operations_service_1 = require("./jobs-operations.service");
let ExternalApiModule = class ExternalApiModule {
};
exports.ExternalApiModule = ExternalApiModule;
exports.ExternalApiModule = ExternalApiModule = __decorate([
    (0, common_1.Module)({
        imports: [
            job_match_module_1.JobMatchModule,
            typeorm_1.TypeOrmModule.forFeature([
                external_api_client_entity_1.ExternalApiClient,
                external_api_request_entity_1.ExternalApiRequest,
                jobs_oauth_entity_1.JobsOAuthClient,
                jobs_oauth_entity_1.JobsOAuthCode,
                jobs_oauth_entity_1.JobsOAuthToken,
                job_entity_1.Job,
                user_entity_1.User,
            ]),
        ],
        controllers: [
            jobs_oauth_controller_1.JobsOAuthController,
            jobs_mcp_controller_1.JobsMcpController,
            external_api_controller_1.ExternalApiController,
            external_api_v2_controller_1.ExternalApiV2Controller,
            external_api_admin_controller_1.ExternalApiAdminController,
            jobs_integrations_admin_controller_1.JobsIntegrationsAdminController,
        ],
        providers: [
            api_key_guard_1.ApiKeyGuard,
            admin_guard_1.AdminGuard,
            controlled_ai_automation_service_1.ControlledAiAutomationService,
            external_jobs_service_1.ExternalJobsService,
            jobs_operations_service_1.JobsOperationsService,
            jobs_oauth_guard_1.JobsOAuthGuard,
            jobs_oauth_service_1.JobsOAuthService,
        ],
        exports: [jobs_oauth_service_1.JobsOAuthService],
    })
], ExternalApiModule);
//# sourceMappingURL=external-api.module.js.map