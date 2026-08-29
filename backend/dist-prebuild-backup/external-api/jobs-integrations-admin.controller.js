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
exports.JobsIntegrationsAdminController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const crypto_1 = require("crypto");
const typeorm_2 = require("typeorm");
const admin_guard_1 = require("../admin/admin.guard");
const auth_guard_1 = require("../auth/auth.guard");
const external_api_client_entity_1 = require("./entities/external-api-client.entity");
const jobs_mcp_scopes_1 = require("./jobs-mcp.scopes");
const LEGACY_OAUTH_ENVELOPE = ['jobs:read', 'jobs:write'];
let JobsIntegrationsAdminController = class JobsIntegrationsAdminController {
    clients;
    constructor(clients) {
        this.clients = clients;
    }
    capabilities() {
        return {
            capabilities: jobs_mcp_scopes_1.JOBS_CAPABILITIES,
            defaults: {
                v1: LEGACY_OAUTH_ENVELOPE,
                v2: jobs_mcp_scopes_1.DEFAULT_JOBS_V2_SCOPES,
                mcp: jobs_mcp_scopes_1.DEFAULT_JOBS_MCP_SCOPES,
            },
            policy: {
                mcpPermissionModel: 'ONE_TOOL_ONE_SCOPE',
                legacyScopesAccepted: true,
                newKeysUseLegacyUmbrella: false,
            },
        };
    }
    async list(kindRaw) {
        const kind = this.kind(kindRaw || 'v1');
        const target = this.target(kind);
        const clients = await this.clients.find({
            where: { apiVersion: target.apiVersion, audience: target.audience },
            select: {
                id: true,
                name: true,
                sourceLabel: true,
                keyPrefix: true,
                scopes: true,
                apiVersion: true,
                audience: true,
                active: true,
                createdById: true,
                lastUsedAt: true,
                createdAt: true,
                updatedAt: true,
            },
            order: { createdAt: 'DESC' },
        });
        return clients.map((client) => this.publicClient(client));
    }
    async create(req, data) {
        const kind = this.kind(data.kind || 'v2');
        const target = this.target(kind);
        const name = String(data.name || '').trim().slice(0, 120);
        const sourceLabel = String(data.sourceLabel || name).trim().slice(0, 160);
        if (!name || !sourceLabel) {
            throw new common_1.BadRequestException('Nome e identificação da origem são obrigatórios.');
        }
        const scopes = kind === 'v1'
            ? [...LEGACY_OAUTH_ENVELOPE]
            : this.scopesForKind(kind, data.scopes, kind === 'mcp' ? jobs_mcp_scopes_1.DEFAULT_JOBS_MCP_SCOPES : jobs_mcp_scopes_1.DEFAULT_JOBS_V2_SCOPES);
        if (!scopes.length)
            throw new common_1.BadRequestException('Selecione pelo menos uma permissão.');
        const apiKey = this.newKey(kind);
        const client = await this.clients.save(this.clients.create({
            name,
            sourceLabel,
            keyPrefix: apiKey.slice(0, 20),
            keyHash: this.hash(apiKey),
            scopes,
            apiVersion: target.apiVersion,
            audience: target.audience,
            active: true,
            createdById: String(req.user?.uid || req.user?.email || 'admin'),
            lastUsedAt: null,
        }));
        return {
            client: this.publicClient(client),
            apiKey,
            warning: 'Copie agora. A chave completa não será exibida novamente.',
        };
    }
    async update(id, data) {
        const client = await this.clients.findOne({ where: { id } });
        if (!client)
            throw new common_1.NotFoundException('Chave não encontrada.');
        if (data.name?.trim())
            client.name = data.name.trim().slice(0, 120);
        if (data.sourceLabel?.trim())
            client.sourceLabel = data.sourceLabel.trim().slice(0, 160);
        if (typeof data.active === 'boolean')
            client.active = data.active;
        if (Array.isArray(data.scopes)) {
            if (client.apiVersion === 'v1' && client.audience === 'api') {
                client.scopes = [...LEGACY_OAUTH_ENVELOPE];
            }
            else {
                const kind = client.audience === 'mcp' ? 'mcp' : 'v2';
                const selected = this.scopesForKind(kind, data.scopes, []);
                if (!selected.length)
                    throw new common_1.BadRequestException('Selecione pelo menos uma permissão.');
                client.scopes = selected;
            }
        }
        return this.publicClient(await this.clients.save(client));
    }
    async rotate(id) {
        const client = await this.clients.findOne({ where: { id } });
        if (!client)
            throw new common_1.NotFoundException('Chave não encontrada.');
        const kind = client.audience === 'mcp'
            ? 'mcp'
            : client.apiVersion === 'v2'
                ? 'v2'
                : 'v1';
        const apiKey = this.newKey(kind);
        client.keyPrefix = apiKey.slice(0, 20);
        client.keyHash = this.hash(apiKey);
        client.active = true;
        await this.clients.save(client);
        return { apiKey, warning: 'A chave anterior foi revogada. Copie esta chave agora.' };
    }
    kind(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (!['v1', 'v2', 'mcp'].includes(normalized)) {
            throw new common_1.BadRequestException('kind deve ser v1, v2 ou mcp.');
        }
        return normalized;
    }
    target(kind) {
        if (kind === 'mcp')
            return { apiVersion: 'v2', audience: 'mcp' };
        return { apiVersion: kind, audience: 'api' };
    }
    scopesForKind(kind, value, fallback) {
        const channel = kind === 'mcp' ? 'mcp' : 'v2';
        const allowed = new Set(jobs_mcp_scopes_1.JOBS_CAPABILITIES
            .filter((capability) => !capability.legacy && capability.channels.includes(channel))
            .map((capability) => capability.scope));
        return (0, jobs_mcp_scopes_1.sanitizeJobsScopes)(value, fallback).filter((scope) => allowed.has(scope));
    }
    newKey(kind) {
        const prefix = kind === 'v2' ? 'pn_v2_' : 'pn_v1_';
        return `${prefix}${(0, crypto_1.randomBytes)(32).toString('hex')}`;
    }
    hash(value) {
        return (0, crypto_1.createHash)('sha256').update(value).digest('hex');
    }
    publicClient(client) {
        const { keyHash: _keyHash, ...safe } = client;
        return {
            ...safe,
            effectiveScopes: (0, jobs_mcp_scopes_1.expandLegacyJobsScopes)(client.scopes || []),
            usesLegacyScopes: (client.scopes || []).some((scope) => jobs_mcp_scopes_1.JOBS_CAPABILITIES.some((capability) => capability.scope === scope && capability.legacy)),
        };
    }
};
exports.JobsIntegrationsAdminController = JobsIntegrationsAdminController;
__decorate([
    (0, common_1.Get)('capabilities'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JobsIntegrationsAdminController.prototype, "capabilities", null);
__decorate([
    (0, common_1.Get)('clients'),
    __param(0, (0, common_1.Query)('kind')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], JobsIntegrationsAdminController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('clients'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], JobsIntegrationsAdminController.prototype, "create", null);
__decorate([
    (0, common_1.Put)('clients/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], JobsIntegrationsAdminController.prototype, "update", null);
__decorate([
    (0, common_1.Post)('clients/:id/rotate'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], JobsIntegrationsAdminController.prototype, "rotate", null);
exports.JobsIntegrationsAdminController = JobsIntegrationsAdminController = __decorate([
    (0, common_1.Controller)('admin/job-integrations'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard, admin_guard_1.AdminGuard),
    __param(0, (0, typeorm_1.InjectRepository)(external_api_client_entity_1.ExternalApiClient)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], JobsIntegrationsAdminController);
//# sourceMappingURL=jobs-integrations-admin.controller.js.map