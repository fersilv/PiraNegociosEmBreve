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
exports.ApiKeyGuard = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const crypto_1 = require("crypto");
const typeorm_2 = require("typeorm");
const external_api_client_entity_1 = require("./entities/external-api-client.entity");
let ApiKeyGuard = class ApiKeyGuard {
    clients;
    windows = new Map();
    constructor(clients) {
        this.clients = clients;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const authorization = String(request.headers.authorization || '');
        const rawKey = String(request.headers['x-api-key'] ||
            (authorization.startsWith('Bearer ') ? authorization.slice(7) : '')).trim();
        if (!/^pn_v[12]_/.test(rawKey) || rawKey.length < 40) {
            throw new common_1.UnauthorizedException('Chave de API ausente ou inválida.');
        }
        const client = await this.clients.findOne({
            where: { keyPrefix: rawKey.slice(0, 20), active: true },
        });
        const supplied = Buffer.from((0, crypto_1.createHash)('sha256').update(rawKey).digest('hex'));
        const expected = Buffer.from(client?.keyHash || '0'.repeat(64));
        if (!client ||
            supplied.length !== expected.length ||
            !(0, crypto_1.timingSafeEqual)(supplied, expected)) {
            throw new common_1.UnauthorizedException('Chave de API inválida ou revogada.');
        }
        if (client.audience !== 'api') {
            throw new common_1.ForbiddenException('Esta chave foi criada para MCP e não pode ser usada como chave REST.');
        }
        const url = String(request.originalUrl || request.url || '');
        const isV1 = /\/v1\/jobs(?:\/|\?|$)/.test(url);
        if (isV1) {
            const requiredScope = request.method === 'GET' ? 'jobs:read' : 'jobs:write';
            if (!client.scopes.includes(requiredScope)) {
                throw new common_1.ForbiddenException(`Esta chave não possui o escopo legado ${requiredScope}.`);
            }
        }
        else if (client.apiVersion !== 'v2') {
            throw new common_1.ForbiddenException('Use uma chave API V2 para este endpoint.');
        }
        const now = Date.now();
        const window = this.windows.get(client.id);
        if (!window || now - window.start >= 60_000) {
            this.windows.set(client.id, { start: now, count: 1 });
        }
        else if (++window.count > 60) {
            throw new common_1.HttpException('Limite de 60 requisições por minuto excedido.', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        client.lastUsedAt = new Date();
        void this.clients.save(client).catch(() => undefined);
        request.apiClient = client;
        return true;
    }
};
exports.ApiKeyGuard = ApiKeyGuard;
exports.ApiKeyGuard = ApiKeyGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(external_api_client_entity_1.ExternalApiClient)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ApiKeyGuard);
//# sourceMappingURL=api-key.guard.js.map