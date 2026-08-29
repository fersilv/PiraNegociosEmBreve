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
exports.JobsOAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const jobs_oauth_service_1 = require("./jobs-oauth.service");
let JobsOAuthGuard = class JobsOAuthGuard {
    oauth;
    windows = new Map();
    constructor(oauth) {
        this.oauth = oauth;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        const resourceMetadata = `${this.oauth.publicBaseUrl()}/.well-known/oauth-protected-resource/api/jobs/mcp`;
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
            const auth = await this.oauth.verifyAccessToken(rawToken);
            if (auth.apiClient.audience !== 'mcp') {
                throw new common_1.UnauthorizedException('Este vínculo OAuth não foi autorizado por uma chave exclusiva do MCP.');
            }
            const now = Date.now();
            const window = this.windows.get(auth.apiClient.id);
            if (!window || now - window.start >= 60_000) {
                this.windows.set(auth.apiClient.id, { start: now, count: 1 });
            }
            else if (++window.count > 60) {
                throw new common_1.HttpException('Limite de 60 requisições por minuto excedido.', common_1.HttpStatus.TOO_MANY_REQUESTS);
            }
            request.jobsOAuth = auth;
            return true;
        }
        catch (error) {
            response.setHeader('WWW-Authenticate', challenge);
            throw error;
        }
    }
};
exports.JobsOAuthGuard = JobsOAuthGuard;
exports.JobsOAuthGuard = JobsOAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jobs_oauth_service_1.JobsOAuthService])
], JobsOAuthGuard);
//# sourceMappingURL=jobs-oauth.guard.js.map