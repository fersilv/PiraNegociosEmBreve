"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobMatchModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const admin_module_1 = require("../admin/admin.module");
const admin_guard_1 = require("../admin/admin.guard");
const notifications_module_1 = require("../notifications/notifications.module");
const payments_module_1 = require("../payments/payments.module");
const job_entity_1 = require("../jobs/entities/job.entity");
const user_entity_1 = require("../users/entities/user.entity");
const job_match_admin_service_1 = require("./job-match-admin.service");
const job_match_ai_service_1 = require("./job-match-ai.service");
const job_match_controller_1 = require("./job-match.controller");
const job_match_service_1 = require("./job-match.service");
const job_match_subscriber_1 = require("./job-match.subscriber");
let JobMatchModule = class JobMatchModule {
};
exports.JobMatchModule = JobMatchModule;
exports.JobMatchModule = JobMatchModule = __decorate([
    (0, common_1.Module)({
        imports: [admin_module_1.AdminModule, payments_module_1.PaymentsModule, notifications_module_1.NotificationsModule, typeorm_1.TypeOrmModule.forFeature([job_entity_1.Job, user_entity_1.User])],
        controllers: [job_match_controller_1.JobMatchController, job_match_controller_1.AdminJobMatchController],
        providers: [admin_guard_1.AdminGuard, job_match_ai_service_1.JobMatchAiService, job_match_service_1.JobMatchService, job_match_admin_service_1.JobMatchAdminService, job_match_subscriber_1.JobMatchSubscriber],
        exports: [job_match_service_1.JobMatchService],
    })
], JobMatchModule);
//# sourceMappingURL=job-match.module.js.map