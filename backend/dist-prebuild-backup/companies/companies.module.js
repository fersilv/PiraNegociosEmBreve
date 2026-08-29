"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompaniesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const company_entity_1 = require("./entities/company.entity");
const user_entity_1 = require("../users/entities/user.entity");
const company_invitation_entity_1 = require("../users/entities/company-invitation.entity");
const company_access_request_entity_1 = require("./entities/company-access-request.entity");
const companies_service_1 = require("./companies.service");
const companies_controller_1 = require("./companies.controller");
const company_talent_folder_entity_1 = require("./entities/company-talent-folder.entity");
const company_talent_record_entity_1 = require("./entities/company-talent-record.entity");
const company_candidate_note_entity_1 = require("./entities/company-candidate-note.entity");
const company_talent_invite_entity_1 = require("./entities/company-talent-invite.entity");
const job_entity_1 = require("../jobs/entities/job.entity");
const application_entity_1 = require("../applications/entities/application.entity");
const talent_invites_controller_1 = require("./talent-invites.controller");
const company_slug_alias_entity_1 = require("./entities/company-slug-alias.entity");
const company_hiring_config_controller_1 = require("./company-hiring-config.controller");
const hiring_config_compat_controller_1 = require("./hiring-config-compat.controller");
const company_page_entity_1 = require("./entities/company-page.entity");
const company_page_preview_entity_1 = require("./entities/company-page-preview.entity");
const company_pages_service_1 = require("./company-pages.service");
const company_pages_controller_1 = require("./company-pages.controller");
const company_pages_public_controller_1 = require("./company-pages-public.controller");
const notifications_module_1 = require("../notifications/notifications.module");
const talent_invites_service_1 = require("./talent-invites.service");
const talent_invite_email_service_1 = require("./talent-invite-email.service");
const talent_invite_preview_controller_1 = require("./talent-invite-preview.controller");
let CompaniesModule = class CompaniesModule {
};
exports.CompaniesModule = CompaniesModule;
exports.CompaniesModule = CompaniesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                company_entity_1.Company,
                user_entity_1.User,
                company_invitation_entity_1.CompanyInvitation,
                company_access_request_entity_1.CompanyAccessRequest,
                company_talent_folder_entity_1.CompanyTalentFolder,
                company_talent_record_entity_1.CompanyTalentRecord,
                company_candidate_note_entity_1.CompanyCandidateNote,
                company_talent_invite_entity_1.CompanyTalentInvite,
                job_entity_1.Job,
                application_entity_1.Application,
                company_slug_alias_entity_1.CompanySlugAlias,
                company_page_entity_1.CompanyPage,
                company_page_preview_entity_1.CompanyPagePreview,
            ]),
            notifications_module_1.NotificationsModule,
        ],
        providers: [
            companies_service_1.CompaniesService,
            company_pages_service_1.CompanyPagesService,
            talent_invites_service_1.TalentInvitesService,
            talent_invite_email_service_1.TalentInviteEmailService,
        ],
        controllers: [
            companies_controller_1.CompaniesController,
            company_pages_controller_1.CompanyPagesController,
            company_pages_public_controller_1.CompanyPagesPublicController,
            talent_invites_controller_1.TalentInvitesController,
            talent_invite_preview_controller_1.TalentInvitePreviewController,
            company_hiring_config_controller_1.CompanyHiringConfigController,
            hiring_config_compat_controller_1.HiringConfigCompatController,
        ],
        exports: [companies_service_1.CompaniesService, talent_invites_service_1.TalentInvitesService],
    })
], CompaniesModule);
//# sourceMappingURL=companies.module.js.map