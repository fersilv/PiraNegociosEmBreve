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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppOAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const whatsapp_oauth_service_1 = require("./whatsapp-oauth.service");
let WhatsAppOAuthGuard = class WhatsAppOAuthGuard {
    oauth;
    constructor(oauth) {
        this.oauth = oauth;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        const instanceId = String(request.params?.instanceId || '').trim();
        const resourceMetadata = `${this.oauth.publicBaseUrl()}/.well-known/oauth-protected-resource/api/whatsapp/mcp/${encodeURIComponent(instanceId)}`;
        const challenge = [
            'Bearer error="invalid_token"',
            'error_description="Authentication required"',
            `resource_metadata="${resourceMetadata}"`,
        ].join(', ');
        const authorization = String(request.headers.authorization || '');
        const rawToken = authorization.startsWith('Bearer ')
            ? authorization.slice(7).trim()
            : '';
        if (!rawToken) {
            response.setHeader('WWW-Authenticate', challenge);
            throw new common_1.UnauthorizedException('OAuth access token não fornecido.');
        }
        try {
            const auth = await this.oauth.verifyAccessToken(instanceId, rawToken);
            const liveScopes = auth.scopes.filter((scope) => Array.isArray(auth.instance.allowedScopes) && auth.instance.allowedScopes.includes(scope));
            request.whatsappOAuth = { ...auth, scopes: liveScopes };
            return true;
        }
        catch (error) {
            response.setHeader('WWW-Authenticate', challenge);
            throw error;
        }
    }
};
exports.WhatsAppOAuthGuard = WhatsAppOAuthGuard;
exports.WhatsAppOAuthGuard = WhatsAppOAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [whatsapp_oauth_service_1.WhatsAppOAuthService])
], WhatsAppOAuthGuard);
//# sourceMappingURL=whatsapp-oauth.guard.js.map