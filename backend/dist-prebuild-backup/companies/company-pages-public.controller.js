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
exports.CompanyPagesPublicController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const company_entity_1 = require("./entities/company.entity");
const company_page_entity_1 = require("./entities/company-page.entity");
const company_page_preview_entity_1 = require("./entities/company-page-preview.entity");
const job_entity_1 = require("../jobs/entities/job.entity");
let CompanyPagesPublicController = class CompanyPagesPublicController {
    companies;
    pages;
    previews;
    jobs;
    constructor(companies, pages, previews, jobs) {
        this.companies = companies;
        this.pages = pages;
        this.previews = previews;
        this.jobs = jobs;
    }
    async published(companyId) {
        const company = await this.companies.findOne({
            where: { id: companyId, verificationStatus: company_entity_1.CompanyStatus.VERIFIED },
        });
        if (!company)
            throw new common_1.NotFoundException('Empresa pública não encontrada.');
        const page = await this.pages.findOne({ where: { companyId } });
        if (!page || page.status !== 'PUBLISHED' || !page.published) {
            return { page: null };
        }
        return {
            page: page.published,
            templateKey: page.templateKey,
            revision: page.revision,
            publishedAt: page.publishedAt,
        };
    }
    async preview(token) {
        const preview = await this.previews.findOne({
            where: { token, expiresAt: (0, typeorm_2.MoreThan)(new Date()) },
        });
        if (!preview)
            throw new common_1.NotFoundException('Prévia expirada ou não encontrada.');
        const company = await this.companies.findOne({ where: { id: preview.companyId } });
        if (!company)
            throw new common_1.NotFoundException('Empresa não encontrada.');
        const jobs = await this.jobs
            .createQueryBuilder('job')
            .where('job.companyId = :companyId', { companyId: company.id })
            .andWhere('job.active = true')
            .andWhere('job.isConfidential = false')
            .andWhere('job."isInternal" = false')
            .andWhere('(job.deadlineDate IS NULL OR job.deadlineDate >= CURRENT_DATE)')
            .orderBy('job.createdAt', 'DESC')
            .getMany();
        return {
            preview: true,
            expiresAt: preview.expiresAt,
            page: preview.snapshot,
            company: {
                id: company.id,
                name: company.name,
                slug: company.slug,
                description: company.description,
                website: company.website,
                address: company.address,
                cityState: company.cityState,
                city: company.city,
                state: company.state,
                phone: company.phone,
                logoURL: company.logoURL,
                socialInstagram: company.socialInstagram,
                socialLinkedin: company.socialLinkedin,
                socialFacebook: company.socialFacebook,
                isVerified: company.isVerified,
                verificationStatus: company.verificationStatus,
            },
            jobs: jobs.map((job) => ({
                id: job.id,
                slug: job.slug,
                title: job.title,
                location: job.location,
                city: job.city,
                state: job.state,
                type: job.type,
                workModel: job.workModel,
                salary: job.salary,
            })),
        };
    }
};
exports.CompanyPagesPublicController = CompanyPagesPublicController;
__decorate([
    (0, common_1.Get)('company/:companyId'),
    __param(0, (0, common_1.Param)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CompanyPagesPublicController.prototype, "published", null);
__decorate([
    (0, common_1.Get)('preview/:token'),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CompanyPagesPublicController.prototype, "preview", null);
exports.CompanyPagesPublicController = CompanyPagesPublicController = __decorate([
    (0, common_1.Controller)('public/company-pages'),
    __param(0, (0, typeorm_1.InjectRepository)(company_entity_1.Company)),
    __param(1, (0, typeorm_1.InjectRepository)(company_page_entity_1.CompanyPage)),
    __param(2, (0, typeorm_1.InjectRepository)(company_page_preview_entity_1.CompanyPagePreview)),
    __param(3, (0, typeorm_1.InjectRepository)(job_entity_1.Job)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], CompanyPagesPublicController);
//# sourceMappingURL=company-pages-public.controller.js.map