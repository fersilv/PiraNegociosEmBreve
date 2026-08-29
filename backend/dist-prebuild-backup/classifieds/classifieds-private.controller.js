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
exports.ClassifiedsPrivateController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const chat_gateway_1 = require("../chat/chat.gateway");
const identity_compliance_service_1 = require("../compliance/identity-compliance.service");
const classifieds_auction_service_1 = require("./classifieds-auction.service");
const classifieds_category_taxonomy_service_1 = require("./classifieds-category-taxonomy.service");
const classifieds_chat_service_1 = require("./classifieds-chat.service");
const classifieds_commerce_service_1 = require("./classifieds-commerce.service");
const classifieds_entitlements_service_1 = require("./classifieds-entitlements.service");
const classifieds_identity_service_1 = require("./classifieds-identity.service");
const classifieds_lifecycle_service_1 = require("./classifieds-lifecycle.service");
const classifieds_offer_chat_service_1 = require("./classifieds-offer-chat.service");
const classifieds_service_1 = require("./classifieds.service");
let ClassifiedsPrivateController = class ClassifiedsPrivateController {
    classifieds;
    taxonomy;
    identities;
    lifecycle;
    chats;
    commerce;
    entitlements;
    auctions;
    offerChat;
    chatGateway;
    compliance;
    constructor(classifieds, taxonomy, identities, lifecycle, chats, commerce, entitlements, auctions, offerChat, chatGateway, compliance) {
        this.classifieds = classifieds;
        this.taxonomy = taxonomy;
        this.identities = identities;
        this.lifecycle = lifecycle;
        this.chats = chats;
        this.commerce = commerce;
        this.entitlements = entitlements;
        this.auctions = auctions;
        this.offerChat = offerChat;
        this.chatGateway = chatGateway;
        this.compliance = compliance;
    }
    context(req) {
        return this.identities.context(req.user.uid);
    }
    limits(req) {
        return this.entitlements.limits(req.user.uid);
    }
    selectIdentity(req, body) {
        return this.identities.select(req.user.uid, body?.identity);
    }
    acceptPersonalTerms(req, body) {
        return this.identities.acceptPersonalTerms(req.user.uid, body?.accepted);
    }
    configureCompany(req, body) {
        return this.identities.configureCompany(req.user.uid, body || {});
    }
    updateCompany(req, body) {
        return this.identities.configureCompany(req.user.uid, body || {});
    }
    mine(req) {
        return this.classifieds.mine(req.user.uid);
    }
    favorites(req) {
        return this.classifieds.favorites(req.user.uid);
    }
    analytics(req) {
        return this.commerce.analytics(req.user.uid);
    }
    offers(req) {
        return this.commerce.listOffers(req.user.uid);
    }
    async createOffer(req, listingId, body) {
        await this.auctions.assertOffersAllowed(listingId);
        const offer = await this.commerce.createOffer(req.user.uid, listingId, body?.amount);
        const event = offer?.offerEvent === 'UPDATED' ? 'UPDATED' : 'CREATED';
        const chat = offer?.id ? await this.offerChat.record(req.user.uid, offer.id, event) : null;
        if (chat?.message)
            this.chatGateway.publishMessage(chat.message, chat.recipientIds);
        return { ...offer, conversationId: chat?.conversationId || null };
    }
    async respondOffer(req, offerId, body) {
        const result = await this.commerce.respondOffer(req.user.uid, offerId, body?.decision);
        const event = String(body?.decision || '').toUpperCase().startsWith('ACCEPT') ? 'ACCEPTED' : 'REJECTED';
        const chat = await this.offerChat.record(req.user.uid, offerId, event);
        if (chat?.message)
            this.chatGateway.publishMessage(chat.message, chat.recipientIds);
        return { ...result, conversationId: chat?.conversationId || null };
    }
    async withdrawOffer(req, offerId) {
        const result = await this.commerce.withdrawOffer(req.user.uid, offerId);
        const chat = await this.offerChat.record(req.user.uid, offerId, 'WITHDRAWN');
        if (chat?.message)
            this.chatGateway.publishMessage(chat.message, chat.recipientIds);
        return { ...result, conversationId: chat?.conversationId || null };
    }
    auctionsList(req) {
        return this.auctions.list(req.user.uid);
    }
    auctionDetail(req, auctionId) {
        return this.auctions.detail(req.user.uid, auctionId);
    }
    async createAuction(req, body) {
        const identity = await this.identities.active(req.user.uid);
        await this.compliance.assertSellerEligible(req.user.uid, identity);
        await this.entitlements.assertAuctionCreation(req.user.uid);
        return this.auctions.create(req.user.uid, body || {});
    }
    async bidAuction(req, auctionId, body) {
        await this.entitlements.assertAuctionParticipant(req.user.uid);
        return this.auctions.bid(req.user.uid, auctionId, body?.amount);
    }
    async cancelAuction(req, auctionId) {
        await this.entitlements.assertAuctionCreation(req.user.uid);
        return this.auctions.cancel(req.user.uid, auctionId);
    }
    async create(req, body) {
        await this.taxonomy.assertCompatible(body.categorySlug, body.listingType, body.attributes);
        await this.entitlements.assertImageLimit(req.user.uid, body.images);
        return this.classifieds.create(req.user.uid, normalizeOptionalPublicContacts(body));
    }
    async update(req, id, body) {
        if (body.categorySlug !== undefined && body.listingType !== undefined) {
            await this.taxonomy.assertCompatible(body.categorySlug, body.listingType, body.attributes);
        }
        if (Array.isArray(body.images))
            await this.entitlements.assertImageLimit(req.user.uid, body.images);
        return this.classifieds.update(req.user.uid, id, body);
    }
    async publish(req, id) {
        await this.identities.assertPublishingReady(req.user.uid);
        const identity = await this.identities.active(req.user.uid);
        await this.compliance.assertSellerEligible(req.user.uid, identity);
        return this.classifieds.publish(req.user.uid, id);
    }
    async status(req, id, body) {
        const status = String(body?.status || '').toUpperCase();
        if (status === 'PUBLISHED') {
            const identity = await this.identities.active(req.user.uid);
            await this.compliance.assertSellerEligible(req.user.uid, identity);
        }
        if (status === 'SOLD') {
            return this.lifecycle.markSold(req.user.uid, id);
        }
        return this.classifieds.setStatus(req.user.uid, id, body?.status);
    }
    async favorite(req, id) {
        const result = await this.classifieds.toggleFavorite(req.user.uid, id);
        if (result?.favorited)
            await this.commerce.trackEvent(id, 'FAVORITE', req.user.uid);
        return result;
    }
    async conversations(req) {
        const rows = await this.chats.list(req.user.uid);
        return this.commerce.decorateConversations(req.user.uid, rows);
    }
    async startConversation(req, listingId) {
        const conversation = await this.chats.start(listingId, req.user.uid);
        const identity = await this.identities.active(req.user.uid);
        await this.commerce.trackEvent(listingId, 'CHAT_START', req.user.uid, identity.type === 'COMPANY' ? identity.company.id : null);
        return conversation;
    }
    renameConversation(req, conversationId, body) {
        return this.commerce.renameConversation(req.user.uid, conversationId, body?.name);
    }
    async archiveConversation(req, conversationId) {
        return this.chats.archive(conversationId, req.user.uid);
    }
    labels(req) {
        return this.commerce.companyLabels(req.user.uid);
    }
    createLabel(req, body) {
        return this.commerce.createCompanyLabel(req.user.uid, body?.name, body?.colorKey);
    }
    setConversationLabels(req, conversationId, body) {
        return this.commerce.setConversationLabels(req.user.uid, conversationId, body?.labelIds);
    }
    messages(req, conversationId) {
        return this.chats.listMessages(conversationId, req.user.uid);
    }
    async sendMessage(req, conversationId, body) {
        const result = await this.chats.send(conversationId, req.user.uid, body?.body, body?.metadata);
        this.chatGateway.publishMessage(result.message, result.recipientIds);
        return result.message;
    }
    readConversation(req, conversationId) {
        return this.chats.markRead(conversationId, req.user.uid);
    }
};
exports.ClassifiedsPrivateController = ClassifiedsPrivateController;
__decorate([
    (0, common_1.Get)('me/context'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsPrivateController.prototype, "context", null);
__decorate([
    (0, common_1.Get)('me/limits'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsPrivateController.prototype, "limits", null);
__decorate([
    (0, common_1.Post)('me/context/select'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsPrivateController.prototype, "selectIdentity", null);
__decorate([
    (0, common_1.Post)('me/terms/personal'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsPrivateController.prototype, "acceptPersonalTerms", null);
__decorate([
    (0, common_1.Post)('me/company-profile'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsPrivateController.prototype, "configureCompany", null);
__decorate([
    (0, common_1.Patch)('me/company-profile'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsPrivateController.prototype, "updateCompany", null);
__decorate([
    (0, common_1.Get)('me/listings'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsPrivateController.prototype, "mine", null);
__decorate([
    (0, common_1.Get)('me/favorites'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsPrivateController.prototype, "favorites", null);
__decorate([
    (0, common_1.Get)('me/analytics'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsPrivateController.prototype, "analytics", null);
__decorate([
    (0, common_1.Get)('me/offers'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsPrivateController.prototype, "offers", null);
__decorate([
    (0, common_1.Post)('listings/:listingId/offers'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('listingId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ClassifiedsPrivateController.prototype, "createOffer", null);
__decorate([
    (0, common_1.Post)('me/offers/:offerId/respond'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('offerId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ClassifiedsPrivateController.prototype, "respondOffer", null);
__decorate([
    (0, common_1.Post)('me/offers/:offerId/withdraw'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('offerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ClassifiedsPrivateController.prototype, "withdrawOffer", null);
__decorate([
    (0, common_1.Get)('auctions'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsPrivateController.prototype, "auctionsList", null);
__decorate([
    (0, common_1.Get)('auctions/:auctionId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('auctionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsPrivateController.prototype, "auctionDetail", null);
__decorate([
    (0, common_1.Post)('me/auctions'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ClassifiedsPrivateController.prototype, "createAuction", null);
__decorate([
    (0, common_1.Post)('auctions/:auctionId/bids'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('auctionId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ClassifiedsPrivateController.prototype, "bidAuction", null);
__decorate([
    (0, common_1.Post)('me/auctions/:auctionId/cancel'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('auctionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ClassifiedsPrivateController.prototype, "cancelAuction", null);
__decorate([
    (0, common_1.Post)('me/listings'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ClassifiedsPrivateController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)('me/listings/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ClassifiedsPrivateController.prototype, "update", null);
__decorate([
    (0, common_1.Post)('me/listings/:id/publish'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ClassifiedsPrivateController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)('me/listings/:id/status'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ClassifiedsPrivateController.prototype, "status", null);
__decorate([
    (0, common_1.Post)('listings/:id/favorite'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ClassifiedsPrivateController.prototype, "favorite", null);
__decorate([
    (0, common_1.Get)('me/conversations'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClassifiedsPrivateController.prototype, "conversations", null);
__decorate([
    (0, common_1.Post)('listings/:listingId/conversations'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('listingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ClassifiedsPrivateController.prototype, "startConversation", null);
__decorate([
    (0, common_1.Patch)('me/conversations/:conversationId/name'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsPrivateController.prototype, "renameConversation", null);
__decorate([
    (0, common_1.Delete)('me/conversations/:conversationId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ClassifiedsPrivateController.prototype, "archiveConversation", null);
__decorate([
    (0, common_1.Get)('me/chat-labels'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsPrivateController.prototype, "labels", null);
__decorate([
    (0, common_1.Post)('me/chat-labels'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsPrivateController.prototype, "createLabel", null);
__decorate([
    (0, common_1.Patch)('me/conversations/:conversationId/labels'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsPrivateController.prototype, "setConversationLabels", null);
__decorate([
    (0, common_1.Get)('me/conversations/:conversationId/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsPrivateController.prototype, "messages", null);
__decorate([
    (0, common_1.Post)('me/conversations/:conversationId/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ClassifiedsPrivateController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Post)('me/conversations/:conversationId/read'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsPrivateController.prototype, "readConversation", null);
exports.ClassifiedsPrivateController = ClassifiedsPrivateController = __decorate([
    (0, common_1.Controller)('classifieds'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [classifieds_service_1.ClassifiedsService,
        classifieds_category_taxonomy_service_1.ClassifiedsCategoryTaxonomyService,
        classifieds_identity_service_1.ClassifiedsIdentityService,
        classifieds_lifecycle_service_1.ClassifiedsLifecycleService,
        classifieds_chat_service_1.ClassifiedsChatService,
        classifieds_commerce_service_1.ClassifiedsCommerceService,
        classifieds_entitlements_service_1.ClassifiedsEntitlementsService,
        classifieds_auction_service_1.ClassifiedsAuctionService,
        classifieds_offer_chat_service_1.ClassifiedsOfferChatService,
        chat_gateway_1.ChatGateway,
        identity_compliance_service_1.IdentityComplianceService])
], ClassifiedsPrivateController);
function normalizeOptionalPublicContacts(body) {
    const payload = { ...body };
    if (!String(body.contactPhone ?? '').trim())
        payload.contactPhone = ' ';
    if (!String(body.contactWhatsapp ?? '').trim())
        payload.contactWhatsapp = ' ';
    return payload;
}
//# sourceMappingURL=classifieds-private.controller.js.map