"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const ai_controller_1 = require("./ai.controller");
const ai_service_1 = require("./ai.service");
const job_skills_service_1 = require("./job-skills.service");
const resume_import_service_1 = require("./resume-import.service");
const resume_review_service_1 = require("./resume-review.service");
const tracked_resume_review_service_1 = require("./tracked-resume-review.service");
const resume_improvement_service_1 = require("./resume-improvement.service");
const aligned_resume_improvement_service_1 = require("./aligned-resume-improvement.service");
const photo_ai_controller_1 = require("./photo-ai.controller");
const photo_ai_service_1 = require("./photo-ai.service");
const admin_module_1 = require("../admin/admin.module");
const payments_module_1 = require("../payments/payments.module");
const user_entity_1 = require("../users/entities/user.entity");
let AiModule = class AiModule {
};
exports.AiModule = AiModule;
exports.AiModule = AiModule = __decorate([
    (0, common_1.Module)({
        imports: [admin_module_1.AdminModule, payments_module_1.PaymentsModule, typeorm_1.TypeOrmModule.forFeature([user_entity_1.User])],
        controllers: [ai_controller_1.AiController, photo_ai_controller_1.PhotoAiController],
        providers: [
            ai_service_1.AiService,
            job_skills_service_1.JobSkillsService,
            resume_import_service_1.ResumeImportService,
            tracked_resume_review_service_1.TrackedResumeReviewService,
            {
                provide: resume_review_service_1.ResumeReviewService,
                useExisting: tracked_resume_review_service_1.TrackedResumeReviewService,
            },
            aligned_resume_improvement_service_1.AlignedResumeImprovementService,
            {
                provide: resume_improvement_service_1.ResumeImprovementService,
                useExisting: aligned_resume_improvement_service_1.AlignedResumeImprovementService,
            },
            photo_ai_service_1.PhotoAiService,
        ],
        exports: [
            ai_service_1.AiService,
            job_skills_service_1.JobSkillsService,
            resume_import_service_1.ResumeImportService,
            resume_review_service_1.ResumeReviewService,
            resume_improvement_service_1.ResumeImprovementService,
            photo_ai_service_1.PhotoAiService,
        ],
    })
], AiModule);
//# sourceMappingURL=ai.module.js.map