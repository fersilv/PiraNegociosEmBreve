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
exports.AdvertisingController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const auth_guard_1 = require("../auth/auth.guard");
const admin_guard_1 = require("../admin/admin.guard");
const advertisement_entity_1 = require("./entities/advertisement.entity");
const advertising_config_entity_1 = require("./entities/advertising-config.entity");
const company_entity_1 = require("../companies/entities/company.entity");
const user_entity_1 = require("../users/entities/user.entity");
let AdvertisingController = class AdvertisingController {
    advertisements;
    configs;
    companies;
    users;
    constructor(advertisements, configs, companies, users) {
        this.advertisements = advertisements;
        this.configs = configs;
        this.companies = companies;
        this.users = users;
    }
    async normalizeOwner(data, current) {
        if (current &&
            data.companyId === undefined &&
            data.contractedByUserId === undefined) {
            return {
                companyId: current.companyId || null,
                contractedByUserId: current.contractedByUserId || null,
            };
        }
        const companyId = data.companyId === undefined
            ? current?.companyId || null
            : data.companyId || null;
        const contractedByUserId = data.contractedByUserId === undefined
            ? current?.contractedByUserId || null
            : data.contractedByUserId || null;
        if (companyId && contractedByUserId)
            throw new common_1.BadRequestException('Selecione uma empresa ou um usuário, não ambos.');
        if (!companyId && !contractedByUserId)
            throw new common_1.BadRequestException('Selecione a empresa ou o usuário responsável pelo anúncio.');
        if (companyId &&
            !(await this.companies.exists({ where: { id: companyId } })))
            throw new common_1.BadRequestException('Empresa responsável não encontrada.');
        if (contractedByUserId &&
            !(await this.users.exists({ where: { id: contractedByUserId } })))
            throw new common_1.BadRequestException('Usuário responsável não encontrado.');
        return { companyId, contractedByUserId };
    }
    async publicAds() {
        const now = new Date();
        return this.advertisements.find({
            where: {
                active: true,
                startsAt: (0, typeorm_2.Or)((0, typeorm_2.IsNull)(), (0, typeorm_2.LessThanOrEqual)(now)),
                endsAt: (0, typeorm_2.Or)((0, typeorm_2.IsNull)(), (0, typeorm_2.MoreThanOrEqual)(now)),
            },
            order: { createdAt: 'DESC' },
        });
    }
    async publicConfig() {
        return ((await this.configs.findOne({ where: { id: 'default' } })) || {
            googleAdsEnabled: false,
            googleAdsClient: null,
            googleAdsSlotLeaderboard: null,
            googleAdsSlotRectangle: null,
        });
    }
    listAds() {
        return this.advertisements.find({ order: { createdAt: 'DESC' } });
    }
    async createAd(data) {
        const title = data.title?.trim();
        const imageURL = data.imageURL?.trim();
        const link = data.link?.trim();
        if (!title ||
            !imageURL ||
            !link ||
            !['leaderboard', 'rectangle', 'sidebar', 'carousel'].includes(data.type || ''))
            throw new common_1.BadRequestException('Título, imagem, link e espaço do anúncio são obrigatórios.');
        const owner = await this.normalizeOwner(data);
        return this.advertisements.save(this.advertisements.create({
            ...data,
            ...owner,
            title,
            imageURL,
            link,
            active: data.active !== false,
        }));
    }
    async updateAd(id, data) {
        const ad = await this.advertisements.findOne({ where: { id } });
        if (!ad)
            throw new common_1.BadRequestException('Anúncio não encontrado.');
        const owner = await this.normalizeOwner(data, ad);
        Object.assign(ad, data, owner);
        return this.advertisements.save(ad);
    }
    async updateConfig(data) {
        const config = (await this.configs.findOne({ where: { id: 'default' } })) ||
            this.configs.create({ id: 'default' });
        Object.assign(config, {
            googleAdsEnabled: Boolean(data.googleAdsEnabled),
            googleAdsClient: typeof data.googleAdsClient === 'string'
                ? data.googleAdsClient.trim() || null
                : null,
            googleAdsSlotLeaderboard: typeof data.googleAdsSlotLeaderboard === 'string'
                ? data.googleAdsSlotLeaderboard.trim() || null
                : null,
            googleAdsSlotRectangle: typeof data.googleAdsSlotRectangle === 'string'
                ? data.googleAdsSlotRectangle.trim() || null
                : null,
        });
        return this.configs.save(config);
    }
};
exports.AdvertisingController = AdvertisingController;
__decorate([
    (0, common_1.Get)('ads'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdvertisingController.prototype, "publicAds", null);
__decorate([
    (0, common_1.Get)('configs/advertising'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdvertisingController.prototype, "publicConfig", null);
__decorate([
    (0, common_1.Get)('admin/ads'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdvertisingController.prototype, "listAds", null);
__decorate([
    (0, common_1.Post)('admin/ads'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard, admin_guard_1.AdminGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdvertisingController.prototype, "createAd", null);
__decorate([
    (0, common_1.Put)('admin/ads/:id'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard, admin_guard_1.AdminGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdvertisingController.prototype, "updateAd", null);
__decorate([
    (0, common_1.Put)('admin/advertising-config'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard, admin_guard_1.AdminGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdvertisingController.prototype, "updateConfig", null);
exports.AdvertisingController = AdvertisingController = __decorate([
    (0, common_1.Controller)(),
    __param(0, (0, typeorm_1.InjectRepository)(advertisement_entity_1.Advertisement)),
    __param(1, (0, typeorm_1.InjectRepository)(advertising_config_entity_1.AdvertisingConfig)),
    __param(2, (0, typeorm_1.InjectRepository)(company_entity_1.Company)),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AdvertisingController);
//# sourceMappingURL=advertising.controller.js.map