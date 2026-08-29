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
exports.WhatsAppApiKeyGuard = exports.RequireWhatsAppScope = exports.WHATSAPP_SCOPE_METADATA = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const crypto_1 = require("crypto");
const typeorm_2 = require("typeorm");
const whatsapp_api_key_entity_1 = require("./entities/whatsapp-api-key.entity");
const whatsapp_instance_entity_1 = require("./entities/whatsapp-instance.entity");
exports.WHATSAPP_SCOPE_METADATA = 'whatsappRequiredScope';
const RequireWhatsAppScope = (scope) => (0, common_1.SetMetadata)(exports.WHATSAPP_SCOPE_METADATA, scope);
exports.RequireWhatsAppScope = RequireWhatsAppScope;
let WhatsAppApiKeyGuard = class WhatsAppApiKeyGuard {
    reflector;
    keys;
    instances;
    windows = new Map();
    constructor(reflector, keys, instances) {
        this.reflector = reflector;
        this.keys = keys;
        this.instances = instances;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const authorization = String(request.headers.authorization || '');
        const rawKey = String(request.headers['x-api-key'] ||
            (authorization.startsWith('Bearer ') ? authorization.slice(7) : '')).trim();
        if (!rawKey.startsWith('pn_wa_') || rawKey.length < 45) {
            throw new common_1.UnauthorizedException('Chave do WhatsApp ausente ou inválida.');
        }
        const key = await this.keys.findOne({
            where: { keyPrefix: rawKey.slice(0, 24), active: true },
        });
        const supplied = Buffer.from((0, crypto_1.createHash)('sha256').update(rawKey).digest('hex'));
        const expected = Buffer.from(key?.keyHash || '0'.repeat(64));
        if (!key || supplied.length !== expected.length || !(0, crypto_1.timingSafeEqual)(supplied, expected)) {
            throw new common_1.UnauthorizedException('Chave do WhatsApp inválida ou revogada.');
        }
        if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) {
            throw new common_1.UnauthorizedException('Esta chave do WhatsApp expirou.');
        }
        const instanceId = String(request.params?.instanceId || '').trim();
        if (!instanceId || key.instanceId !== instanceId) {
            throw new common_1.ForbiddenException('Esta chave não pertence ao número solicitado.');
        }
        const instance = await this.instances.findOne({ where: { id: instanceId, active: true } });
        if (!instance)
            throw new common_1.ForbiddenException('Número desativado ou inexistente.');
        const requiredScope = this.reflector.getAllAndOverride(exports.WHATSAPP_SCOPE_METADATA, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (requiredScope && !key.scopes.includes(requiredScope)) {
            throw new common_1.ForbiddenException(`Esta chave não possui o escopo ${requiredScope}.`);
        }
        const now = Date.now();
        const window = this.windows.get(key.id);
        if (!window || now - window.start >= 60_000) {
            this.windows.set(key.id, { start: now, count: 1 });
        }
        else if (++window.count > 120) {
            throw new common_1.HttpException('Limite de 120 requisições por minuto excedido.', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        key.lastUsedAt = new Date();
        void this.keys.save(key).catch(() => undefined);
        request.whatsappApiKey = key;
        request.whatsappInstance = instance;
        return true;
    }
};
exports.WhatsAppApiKeyGuard = WhatsAppApiKeyGuard;
exports.WhatsAppApiKeyGuard = WhatsAppApiKeyGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(whatsapp_api_key_entity_1.WhatsAppApiKey)),
    __param(2, (0, typeorm_1.InjectRepository)(whatsapp_instance_entity_1.WhatsAppInstance)),
    __metadata("design:paramtypes", [core_1.Reflector,
        typeorm_2.Repository,
        typeorm_2.Repository])
], WhatsAppApiKeyGuard);
//# sourceMappingURL=whatsapp-key.guard.js.map