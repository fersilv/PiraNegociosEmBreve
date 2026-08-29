"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const auth_module_1 = require("./auth/auth.module");
const jobs_module_1 = require("./jobs/jobs.module");
const users_module_1 = require("./users/users.module");
const uploads_module_1 = require("./uploads/uploads.module");
const notifications_module_1 = require("./notifications/notifications.module");
const applications_module_1 = require("./applications/applications.module");
const companies_module_1 = require("./companies/companies.module");
const chat_module_1 = require("./chat/chat.module");
const admin_module_1 = require("./admin/admin.module");
const analytics_module_1 = require("./analytics/analytics.module");
const seo_module_1 = require("./seo/seo.module");
const advertising_module_1 = require("./advertising/advertising.module");
const external_api_module_1 = require("./external-api/external-api.module");
const payments_module_1 = require("./payments/payments.module");
const job_match_module_1 = require("./job-match/job-match.module");
const ai_module_1 = require("./ai/ai.module");
const public_resume_module_1 = require("./public-resume/public-resume.module");
const product_feedback_module_1 = require("./product-feedback/product-feedback.module");
const classifieds_module_1 = require("./classifieds/classifieds.module");
const company_plans_module_1 = require("./company-plans/company-plans.module");
const whatsapp_module_1 = require("./whatsapp/whatsapp.module");
const compliance_module_1 = require("./compliance/compliance.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            auth_module_1.AuthModule,
            typeorm_1.TypeOrmModule.forRoot({
                type: 'postgres',
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5432', 10),
                username: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASS || 'postgres',
                database: process.env.DB_NAME || 'piranegocios',
                entities: [__dirname + '/**/*.entity{.ts,.js}'],
                synchronize: process.env.NODE_ENV !== 'production',
            }),
            external_api_module_1.ExternalApiModule,
            jobs_module_1.JobsModule,
            users_module_1.UsersModule,
            uploads_module_1.UploadsModule,
            notifications_module_1.NotificationsModule,
            applications_module_1.ApplicationsModule,
            companies_module_1.CompaniesModule,
            chat_module_1.ChatModule,
            analytics_module_1.AnalyticsModule,
            seo_module_1.SeoModule,
            advertising_module_1.AdvertisingModule,
            payments_module_1.PaymentsModule,
            ai_module_1.AiModule,
            public_resume_module_1.PublicResumeModule,
            job_match_module_1.JobMatchModule,
            admin_module_1.AdminModule,
            product_feedback_module_1.ProductFeedbackModule,
            compliance_module_1.ComplianceModule,
            classifieds_module_1.ClassifiedsModule,
            company_plans_module_1.CompanyPlansModule,
            whatsapp_module_1.WhatsAppModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map