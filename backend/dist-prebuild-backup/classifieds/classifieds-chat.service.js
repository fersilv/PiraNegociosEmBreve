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
exports.ClassifiedsChatService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const company_entity_1 = require("../companies/entities/company.entity");
const user_entity_1 = require("../users/entities/user.entity");
const classifieds_identity_service_1 = require("./classifieds-identity.service");
const classified_conversation_entity_1 = require("./entities/classified-conversation.entity");
const classified_conversation_message_entity_1 = require("./entities/classified-conversation-message.entity");
const classified_listing_entity_1 = require("./entities/classified-listing.entity");
const classified_listing_image_entity_1 = require("./entities/classified-listing-image.entity");
let ClassifiedsChatService = class ClassifiedsChatService {
    conversations;
    messages;
    listings;
    images;
    users;
    companies;
    identities;
    constructor(conversations, messages, listings, images, users, companies, identities) {
        this.conversations = conversations;
        this.messages = messages;
        this.listings = listings;
        this.images = images;
        this.users = users;
        this.companies = companies;
        this.identities = identities;
    }
    async start(listingId, uid) {
        const [listing, user, identity] = await Promise.all([
            this.listings.findOne({ where: { id: listingId, status: 'PUBLISHED' } }),
            this.users.findOne({ where: { id: uid } }),
            this.identities.active(uid),
        ]);
        if (!listing)
            throw new common_1.NotFoundException('Anúncio não encontrado.');
        if (!user)
            throw new common_1.ForbiddenException('Usuário não encontrado.');
        if (await this.isSeller(listing, user)) {
            throw new common_1.BadRequestException('Você não pode iniciar uma negociação com o seu próprio anúncio.');
        }
        const buyerCompanyId = identity.type === 'COMPANY' ? identity.company.id : null;
        let conversation = buyerCompanyId
            ? await this.conversations.findOne({ where: { listingId, buyerCompanyId } })
            : await this.conversations.findOne({ where: { listingId, buyerUserId: uid, buyerCompanyId: (0, typeorm_2.IsNull)() } });
        if (!conversation) {
            conversation = this.conversations.create({
                listingId,
                buyerUserId: uid,
                buyerCompanyId,
                sellerUserId: listing.sellerUserId,
                sellerCompanyId: listing.companyId,
                buyerLastReadAt: new Date(),
                sellerLastReadAt: null,
                lastMessageAt: null,
            });
            conversation = await this.conversations.save(conversation);
        }
        return this.hydrate(conversation, uid, identity);
    }
    async list(uid) {
        const [user, identity] = await Promise.all([
            this.users.findOne({ where: { id: uid } }),
            this.identities.active(uid),
        ]);
        if (!user)
            throw new common_1.ForbiddenException('Usuário não encontrado.');
        const query = this.conversations.createQueryBuilder('conversation')
            .where(new typeorm_2.Brackets((where) => {
            if (identity.type === 'COMPANY') {
                const companyId = identity.company.id;
                where.where('(conversation.buyerCompanyId = :companyId AND conversation.buyerDeletedAt IS NULL)', { companyId })
                    .orWhere('(conversation.sellerCompanyId = :companyId AND conversation.sellerDeletedAt IS NULL)', { companyId });
            }
            else {
                where.where('(conversation.buyerUserId = :uid AND conversation.buyerCompanyId IS NULL AND conversation.buyerDeletedAt IS NULL)', { uid })
                    .orWhere('(conversation.sellerUserId = :uid AND conversation.sellerCompanyId IS NULL AND conversation.sellerDeletedAt IS NULL)', { uid });
            }
        }))
            .orderBy('conversation.lastMessageAt', 'DESC', 'NULLS LAST')
            .addOrderBy('conversation.updatedAt', 'DESC');
        const rows = await query.getMany();
        return Promise.all(rows.map((conversation) => this.hydrate(conversation, uid, identity)));
    }
    async listMessages(conversationId, uid) {
        const { conversation, role } = await this.assertParticipant(conversationId, uid);
        await this.markReadEntity(conversation, role);
        return this.messages.find({ where: { conversationId }, order: { createdAt: 'ASC' } });
    }
    async archive(conversationId, uid) {
        const { conversation, role } = await this.assertParticipant(conversationId, uid);
        if (role === 'BUYER')
            conversation.buyerDeletedAt = new Date();
        else
            conversation.sellerDeletedAt = new Date();
        await this.conversations.save(conversation);
        return { archived: true };
    }
    async send(conversationId, uid, rawBody, rawMetadata = null) {
        const { conversation, user, role } = await this.assertParticipant(conversationId, uid);
        const body = String(rawBody ?? '').trim();
        if (!body && !rawMetadata)
            throw new common_1.BadRequestException('Escreva uma mensagem ou envie um anexo.');
        if (body.length > 4000)
            throw new common_1.BadRequestException('A mensagem excede o limite de 4.000 caracteres.');
        const companyId = role === 'BUYER' ? conversation.buyerCompanyId : conversation.sellerCompanyId;
        const company = companyId ? await this.companies.findOne({ where: { id: companyId } }) : null;
        const senderName = company?.name || user.socialName || user.displayName || user.fullName || 'Usuário';
        let metadata = null;
        if (rawMetadata && typeof rawMetadata === 'object') {
            metadata = rawMetadata;
        }
        const message = await this.messages.save(this.messages.create({
            conversationId,
            senderId: uid,
            senderName,
            senderRole: role,
            body,
            messageType: 'TEXT',
            metadata,
        }));
        conversation.lastMessageAt = message.createdAt || new Date();
        if (role === 'BUYER')
            conversation.buyerLastReadAt = new Date();
        else
            conversation.sellerLastReadAt = new Date();
        await this.conversations.save(conversation);
        return {
            message,
            recipientIds: await this.recipientIds(conversation, uid),
        };
    }
    async markRead(conversationId, uid) {
        const { conversation, role } = await this.assertParticipant(conversationId, uid);
        await this.markReadEntity(conversation, role);
        return { ok: true };
    }
    async markReadEntity(conversation, role) {
        if (role === 'BUYER')
            conversation.buyerLastReadAt = new Date();
        else
            conversation.sellerLastReadAt = new Date();
        await this.conversations.save(conversation);
    }
    async assertParticipant(conversationId, uid) {
        const [conversation, user] = await Promise.all([
            this.conversations.findOne({ where: { id: conversationId } }),
            this.users.findOne({ where: { id: uid } }),
        ]);
        if (!conversation || !user)
            throw new common_1.NotFoundException('Conversa não encontrada.');
        if (user.type === user_entity_1.UserType.ADMIN)
            return { conversation, user, role: 'SELLER' };
        const identity = await this.identities.active(uid);
        if (identity.type === 'COMPANY') {
            const companyId = identity.company.id;
            if (conversation.buyerCompanyId === companyId)
                return { conversation, user, role: 'BUYER' };
            if (conversation.sellerCompanyId === companyId)
                return { conversation, user, role: 'SELLER' };
        }
        else {
            if (!conversation.buyerCompanyId && conversation.buyerUserId === uid)
                return { conversation, user, role: 'BUYER' };
            if (!conversation.sellerCompanyId && conversation.sellerUserId === uid)
                return { conversation, user, role: 'SELLER' };
        }
        throw new common_1.ForbiddenException('Esta conversa pertence a outra identidade dos Classificados.');
    }
    async isSeller(listing, user) {
        if (listing.sellerUserId === user.id)
            return true;
        if (!listing.companyId)
            return false;
        return this.isCompanyOperator(listing.companyId, user);
    }
    async isCompanyOperator(companyId, user) {
        if (user.companyId === companyId && user.isCompanyAdmin)
            return true;
        const company = await this.companies.findOne({ where: { id: companyId } });
        return company?.ownerId === user.id;
    }
    async recipientIds(conversation, senderId) {
        const ids = new Set();
        await this.addIdentityRecipients(ids, conversation.buyerUserId, conversation.buyerCompanyId);
        await this.addIdentityRecipients(ids, conversation.sellerUserId, conversation.sellerCompanyId);
        ids.delete(senderId);
        return [...ids];
    }
    async addIdentityRecipients(ids, fallbackUserId, companyId) {
        if (!companyId) {
            ids.add(fallbackUserId);
            return;
        }
        ids.add(fallbackUserId);
        const [admins, company] = await Promise.all([
            this.users.find({ where: { companyId, isCompanyAdmin: true } }),
            this.companies.findOne({ where: { id: companyId } }),
        ]);
        admins.forEach((user) => ids.add(user.id));
        if (company?.ownerId)
            ids.add(company.ownerId);
    }
    async hydrate(conversation, uid, identity) {
        const activeIdentity = identity || await this.identities.active(uid);
        const role = activeIdentity.type === 'COMPANY'
            ? conversation.buyerCompanyId === activeIdentity.company.id ? 'BUYER' : 'SELLER'
            : !conversation.buyerCompanyId && conversation.buyerUserId === uid ? 'BUYER' : 'SELLER';
        const listing = await this.listings.findOne({ where: { id: conversation.listingId } });
        const image = listing ? await this.images.findOne({ where: { listingId: listing.id }, order: { sortOrder: 'ASC' } }) : null;
        const [buyer, buyerCompany, seller, sellerCompany, lastMessage] = await Promise.all([
            this.users.findOne({ where: { id: conversation.buyerUserId } }),
            conversation.buyerCompanyId ? this.companies.findOne({ where: { id: conversation.buyerCompanyId } }) : Promise.resolve(null),
            this.users.findOne({ where: { id: conversation.sellerUserId } }),
            conversation.sellerCompanyId ? this.companies.findOne({ where: { id: conversation.sellerCompanyId } }) : Promise.resolve(null),
            this.messages.findOne({ where: { conversationId: conversation.id }, order: { createdAt: 'DESC' } }),
        ]);
        const readAt = role === 'BUYER' ? conversation.buyerLastReadAt : conversation.sellerLastReadAt;
        const unreadQuery = this.messages.createQueryBuilder('message')
            .where('message.conversationId = :conversationId', { conversationId: conversation.id })
            .andWhere('message.senderRole != :role', { role });
        if (readAt)
            unreadQuery.andWhere('message.createdAt > :readAt', { readAt });
        const unreadCount = await unreadQuery.getCount();
        return {
            ...conversation,
            role,
            unreadCount,
            listing: listing ? {
                id: listing.id,
                slug: listing.slug,
                title: listing.title,
                price: listing.price,
                priceType: listing.priceType,
                status: listing.status,
                image: image?.url || null,
            } : null,
            buyer: {
                id: conversation.buyerCompanyId || buyer?.id || conversation.buyerUserId,
                type: conversation.buyerCompanyId ? 'COMPANY' : 'PERSON',
                name: buyerCompany?.name || buyer?.socialName || buyer?.displayName || buyer?.fullName || 'Comprador',
                photoURL: buyerCompany?.logoURL || buyer?.photoURL || null,
                verified: Boolean(buyerCompany?.isVerified || buyer?.isVerified),
            },
            seller: {
                id: conversation.sellerCompanyId || conversation.sellerUserId,
                type: conversation.sellerCompanyId ? 'COMPANY' : 'PERSON',
                name: sellerCompany?.name || seller?.socialName || seller?.displayName || seller?.fullName || 'Anunciante',
                photoURL: sellerCompany?.logoURL || seller?.photoURL || null,
                verified: Boolean(sellerCompany?.isVerified || seller?.isVerified),
            },
            lastMessage: lastMessage ? {
                id: lastMessage.id,
                senderId: lastMessage.senderId,
                senderRole: lastMessage.senderRole,
                body: lastMessage.body,
                createdAt: lastMessage.createdAt,
            } : null,
        };
    }
};
exports.ClassifiedsChatService = ClassifiedsChatService;
exports.ClassifiedsChatService = ClassifiedsChatService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(classified_conversation_entity_1.ClassifiedConversation)),
    __param(1, (0, typeorm_1.InjectRepository)(classified_conversation_message_entity_1.ClassifiedConversationMessage)),
    __param(2, (0, typeorm_1.InjectRepository)(classified_listing_entity_1.ClassifiedListing)),
    __param(3, (0, typeorm_1.InjectRepository)(classified_listing_image_entity_1.ClassifiedListingImage)),
    __param(4, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(5, (0, typeorm_1.InjectRepository)(company_entity_1.Company)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        classifieds_identity_service_1.ClassifiedsIdentityService])
], ClassifiedsChatService);
//# sourceMappingURL=classifieds-chat.service.js.map