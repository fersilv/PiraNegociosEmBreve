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
exports.OAuthBrokerController = void 0;
const common_1 = require("@nestjs/common");
const oauth_broker_service_1 = require("./oauth-broker.service");
let OAuthBrokerController = class OAuthBrokerController {
    broker;
    constructor(broker) {
        this.broker = broker;
    }
    authorizationServerMetadata() {
        return this.broker.authorizationServerMetadata();
    }
    openIdConfiguration() {
        return this.broker.authorizationServerMetadata();
    }
    register(body) {
        return this.broker.registerClient(body);
    }
    async authorizePage(query, res) {
        const html = await this.broker.buildAuthorizationPage(query);
        res.setHeader('Cache-Control', 'no-store');
        res.type('html').send(html);
    }
    async approve(body, res) {
        const redirect = await this.broker.approveAuthorization(body);
        res.redirect(302, redirect);
    }
    token(body) {
        return this.broker.exchangeToken(body);
    }
};
exports.OAuthBrokerController = OAuthBrokerController;
__decorate([
    (0, common_1.Get)('.well-known/oauth-authorization-server'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OAuthBrokerController.prototype, "authorizationServerMetadata", null);
__decorate([
    (0, common_1.Get)('.well-known/openid-configuration'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OAuthBrokerController.prototype, "openIdConfiguration", null);
__decorate([
    (0, common_1.Post)('oauth/register'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OAuthBrokerController.prototype, "register", null);
__decorate([
    (0, common_1.Get)('oauth/authorize'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OAuthBrokerController.prototype, "authorizePage", null);
__decorate([
    (0, common_1.Post)('oauth/authorize'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OAuthBrokerController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)('oauth/token'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    (0, common_1.Header)('Pragma', 'no-cache'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OAuthBrokerController.prototype, "token", null);
exports.OAuthBrokerController = OAuthBrokerController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [oauth_broker_service_1.OAuthBrokerService])
], OAuthBrokerController);
//# sourceMappingURL=oauth-broker.controller.js.map