"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicResumeModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const auth_module_1 = require("../auth/auth.module");
const ai_module_1 = require("../ai/ai.module");
const payments_module_1 = require("../payments/payments.module");
const admin_guard_1 = require("../admin/admin.guard");
const user_entity_1 = require("../users/entities/user.entity");
const public_resume_controller_1 = require("./public-resume.controller");
const public_resume_service_1 = require("./public-resume.service");
let PublicResumeModule = class PublicResumeModule {
};
exports.PublicResumeModule = PublicResumeModule;
exports.PublicResumeModule = PublicResumeModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            ai_module_1.AiModule,
            payments_module_1.PaymentsModule,
            typeorm_1.TypeOrmModule.forFeature([user_entity_1.User]),
        ],
        controllers: [
            public_resume_controller_1.PublicResumeController,
            public_resume_controller_1.PublicResumeAccountController,
            public_resume_controller_1.AdminPublicResumeController,
        ],
        providers: [public_resume_service_1.PublicResumeService, admin_guard_1.AdminGuard],
        exports: [public_resume_service_1.PublicResumeService],
    })
], PublicResumeModule);
//# sourceMappingURL=public-resume.module.js.map