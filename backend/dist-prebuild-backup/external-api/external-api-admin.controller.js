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
exports.ExternalApiAdminController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const crypto_1 = require("crypto");
const typeorm_2 = require("typeorm");
const admin_guard_1 = require("../admin/admin.guard");
const auth_guard_1 = require("../auth/auth.guard");
const external_api_client_entity_1 = require("./entities/external-api-client.entity");
const external_api_request_entity_1 = require("./entities/external-api-request.entity");
let ExternalApiAdminController = class ExternalApiAdminController {
    clients;
    requests;
    constructor(clients, requests) {
        this.clients = clients;
        this.requests = requests;
    }
    list() {
        return this.clients.find({
            select: {
                id: true,
                name: true,
                sourceLabel: true,
                keyPrefix: true,
                scopes: true,
                active: true,
                createdById: true,
                lastUsedAt: true,
                createdAt: true,
                updatedAt: true,
            },
            order: { createdAt: 'DESC' },
        });
    }
    async create(req, data) {
        const name = data.name?.trim().slice(0, 120);
        const sourceLabel = data.sourceLabel?.trim().slice(0, 160);
        if (!name || !sourceLabel)
            throw new common_1.BadRequestException('Nome e identificação da origem são obrigatórios.');
        const apiKey = this.newKey();
        const client = await this.clients.save(this.clients.create({
            name,
            sourceLabel,
            keyPrefix: apiKey.slice(0, 20),
            keyHash: this.hash(apiKey),
            scopes: ['jobs:read', 'jobs:write'],
            active: true,
            createdById: req.user.uid,
            lastUsedAt: null,
        }));
        return {
            client: {
                id: client.id,
                name: client.name,
                sourceLabel: client.sourceLabel,
                keyPrefix: client.keyPrefix,
                active: client.active,
            },
            apiKey,
            warning: 'Copie agora. A chave completa não será exibida novamente.',
        };
    }
    async update(id, data) {
        const client = await this.clients.findOne({ where: { id } });
        if (!client)
            throw new common_1.NotFoundException('Chave não encontrada.');
        if (typeof data.active === 'boolean')
            client.active = data.active;
        if (data.name?.trim())
            client.name = data.name.trim().slice(0, 120);
        if (data.sourceLabel?.trim())
            client.sourceLabel = data.sourceLabel.trim().slice(0, 160);
        return this.clients.save(client);
    }
    async rotate(id) {
        const client = await this.clients.findOne({ where: { id } });
        if (!client)
            throw new common_1.NotFoundException('Chave não encontrada.');
        const apiKey = this.newKey();
        client.keyPrefix = apiKey.slice(0, 20);
        client.keyHash = this.hash(apiKey);
        client.active = true;
        await this.clients.save(client);
        return {
            apiKey,
            warning: 'A chave anterior foi revogada. Copie esta chave agora.',
        };
    }
    async usage(id, query) {
        if (!(await this.clients.exists({ where: { id } })))
            throw new common_1.NotFoundException('Chave não encontrada.');
        const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
        const pageSize = Math.min(100, Math.max(10, Number.parseInt(query.pageSize || '20', 10) || 20));
        const [data, total] = await this.requests.findAndCount({
            where: { clientId: id },
            order: { createdAt: 'DESC' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        });
        return {
            data,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.max(1, Math.ceil(total / pageSize)),
            },
        };
    }
    newKey() {
        return `pn_v1_${(0, crypto_1.randomBytes)(32).toString('hex')}`;
    }
    hash(value) {
        return (0, crypto_1.createHash)('sha256').update(value).digest('hex');
    }
};
exports.ExternalApiAdminController = ExternalApiAdminController;
__decorate([
    (0, common_1.Get)('clients'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ExternalApiAdminController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('clients'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExternalApiAdminController.prototype, "create", null);
__decorate([
    (0, common_1.Put)('clients/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ExternalApiAdminController.prototype, "update", null);
__decorate([
    (0, common_1.Post)('clients/:id/rotate'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ExternalApiAdminController.prototype, "rotate", null);
__decorate([
    (0, common_1.Get)('clients/:id/requests'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ExternalApiAdminController.prototype, "usage", null);
exports.ExternalApiAdminController = ExternalApiAdminController = __decorate([
    (0, common_1.Controller)('admin/api-v1'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard, admin_guard_1.AdminGuard),
    __param(0, (0, typeorm_1.InjectRepository)(external_api_client_entity_1.ExternalApiClient)),
    __param(1, (0, typeorm_1.InjectRepository)(external_api_request_entity_1.ExternalApiRequest)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ExternalApiAdminController);
//# sourceMappingURL=external-api-admin.controller.js.map