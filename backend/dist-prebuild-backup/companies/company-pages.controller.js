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
exports.CompanyPagesController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const auth_guard_1 = require("../auth/auth.guard");
const user_entity_1 = require("../users/entities/user.entity");
const company_entity_1 = require("./entities/company.entity");
const company_pages_service_1 = require("./company-pages.service");
let CompanyPagesController = class CompanyPagesController {
    companyPages;
    companies;
    users;
    constructor(companyPages, companies, users) {
        this.companyPages = companyPages;
        this.companies = companies;
        this.users = users;
    }
    async assertManager(uid, companyId) {
        const [company, user] = await Promise.all([
            this.companies.findOne({ where: { id: companyId } }),
            this.users.findOne({ where: { id: uid } }),
        ]);
        if (!company)
            throw new common_1.BadRequestException('Empresa não encontrada.');
        if (user?.type !== user_entity_1.UserType.ADMIN) {
            if (!user ||
                (company.ownerId !== uid && !(user.companyId === companyId && user.isCompanyAdmin))) {
                throw new common_1.ForbiddenException('Você não tem permissão para editar a página desta empresa.');
            }
        }
        if (company.verificationStatus !== company_entity_1.CompanyStatus.VERIFIED) {
            throw new common_1.ForbiddenException('Minha Página está disponível apenas para empresas verificadas.');
        }
        return company;
    }
    async getPage(req, id) {
        const company = await this.assertManager(req.user.uid, id);
        const page = await this.companyPages.getForCompany(company);
        return {
            ...page,
            access: {
                requiresVerifiedCompany: true,
                advancedEditor: {
                    product: 'COMPANY_PLUS',
                    requiresPlus: true,
                    testMode: true,
                    allowed: true,
                },
            },
        };
    }
    async saveDraft(req, id, body) {
        const company = await this.assertManager(req.user.uid, id);
        return this.companyPages.saveDraft(company, body?.config);
    }
    async createPreview(req, id, body) {
        const company = await this.assertManager(req.user.uid, id);
        const preview = await this.companyPages.createPreview(company, body?.config);
        return {
            ...preview,
            url: `/preview/empresa/${preview.token}`,
        };
    }
    async publish(req, id, body) {
        const company = await this.assertManager(req.user.uid, id);
        return this.companyPages.publish(company, body?.config);
    }
    async unpublish(req, id) {
        const company = await this.assertManager(req.user.uid, id);
        return this.companyPages.unpublish(company);
    }
};
exports.CompanyPagesController = CompanyPagesController;
__decorate([
    (0, common_1.Get)(':id/page'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CompanyPagesController.prototype, "getPage", null);
__decorate([
    (0, common_1.Put)(':id/page/draft'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], CompanyPagesController.prototype, "saveDraft", null);
__decorate([
    (0, common_1.Post)(':id/page/preview'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], CompanyPagesController.prototype, "createPreview", null);
__decorate([
    (0, common_1.Post)(':id/page/publish'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], CompanyPagesController.prototype, "publish", null);
__decorate([
    (0, common_1.Delete)(':id/page/published'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CompanyPagesController.prototype, "unpublish", null);
exports.CompanyPagesController = CompanyPagesController = __decorate([
    (0, common_1.Controller)('companies'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __param(1, (0, typeorm_1.InjectRepository)(company_entity_1.Company)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [company_pages_service_1.CompanyPagesService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], CompanyPagesController);
//# sourceMappingURL=company-pages.controller.js.map