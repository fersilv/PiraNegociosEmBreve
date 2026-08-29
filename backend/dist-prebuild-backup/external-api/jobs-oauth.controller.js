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
exports.JobsOAuthController = void 0;
const common_1 = require("@nestjs/common");
const jobs_oauth_service_1 = require("./jobs-oauth.service");
let JobsOAuthController = class JobsOAuthController {
    oauth;
    constructor(oauth) {
        this.oauth = oauth;
    }
    sharedAuthorizationServerMetadata() {
        const base = this.oauth.publicBaseUrl();
        return {
            ...this.oauth.authorizationServerMetadata(),
            issuer: base,
            authorization_endpoint: `${base}/api/oauth/authorize`,
            token_endpoint: `${base}/api/oauth/token`,
            registration_endpoint: `${base}/api/oauth/register`,
            service_documentation: `${base}/admin/api`,
        };
    }
    sharedResourceMetadata() {
        return {
            ...this.oauth.resourceMetadata(),
            authorization_servers: [this.oauth.publicBaseUrl()],
        };
    }
    authorizationServerMetadata() {
        return this.sharedAuthorizationServerMetadata();
    }
    openIdConfiguration() {
        return this.sharedAuthorizationServerMetadata();
    }
    standardResourceMetadata() {
        return this.sharedResourceMetadata();
    }
    resourceMetadata() {
        return this.sharedResourceMetadata();
    }
    register(body) {
        return this.oauth.registerClient(body);
    }
    async authorizePage(query, res) {
        const html = await this.oauth.buildAuthorizationPage(query);
        res.setHeader('Cache-Control', 'no-store');
        res.type('html').send(html);
    }
    async approve(body, res) {
        const redirect = new URL(await this.oauth.approveAuthorization(body));
        redirect.searchParams.set('iss', this.oauth.publicBaseUrl());
        res.redirect(302, redirect.toString());
    }
    token(body) {
        return this.oauth.exchangeToken(body);
    }
};
exports.JobsOAuthController = JobsOAuthController;
__decorate([
    (0, common_1.Get)('.well-known/oauth-authorization-server/jobs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JobsOAuthController.prototype, "authorizationServerMetadata", null);
__decorate([
    (0, common_1.Get)('.well-known/openid-configuration/jobs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JobsOAuthController.prototype, "openIdConfiguration", null);
__decorate([
    (0, common_1.Get)('.well-known/oauth-protected-resource/api/jobs/mcp'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JobsOAuthController.prototype, "standardResourceMetadata", null);
__decorate([
    (0, common_1.Get)('jobs/oauth/resource'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JobsOAuthController.prototype, "resourceMetadata", null);
__decorate([
    (0, common_1.Post)('jobs/oauth/register'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], JobsOAuthController.prototype, "register", null);
__decorate([
    (0, common_1.Get)('jobs/oauth/authorize'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], JobsOAuthController.prototype, "authorizePage", null);
__decorate([
    (0, common_1.Post)('jobs/oauth/authorize'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], JobsOAuthController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)('jobs/oauth/token'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    (0, common_1.Header)('Pragma', 'no-cache'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], JobsOAuthController.prototype, "token", null);
exports.JobsOAuthController = JobsOAuthController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [jobs_oauth_service_1.JobsOAuthService])
], JobsOAuthController);
//# sourceMappingURL=jobs-oauth.controller.js.map