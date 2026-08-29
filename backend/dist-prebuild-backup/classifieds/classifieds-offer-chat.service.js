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
exports.ClassifiedsOfferChatService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let ClassifiedsOfferChatService = class ClassifiedsOfferChatService {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async record(uid, offerId, event) {
        const rows = await this.dataSource.query(`SELECT o.*, l.title,
              COALESCE(bc.name, bu."socialName", bu."displayName", bu."fullName", 'Comprador') AS "buyerName",
              COALESCE(sc.name, su."socialName", su."displayName", su."fullName", 'Vendedor') AS "sellerName"
       FROM classified_offers o
       JOIN classified_listings l ON l.id=o."listingId"
       LEFT JOIN users bu ON bu.id=o."buyerUserId"
       LEFT JOIN companies bc ON bc.id=o."buyerCompanyId"
       LEFT JOIN users su ON su.id=o."sellerUserId"
       LEFT JOIN companies sc ON sc.id=o."sellerCompanyId"
       WHERE o.id=$1 LIMIT 1`, [offerId]);
        const offer = rows[0];
        if (!offer)
            return null;
        let conversations = await this.dataSource.query(`SELECT * FROM classified_conversations
       WHERE "listingId"=$1 AND "buyerUserId"=$2
         AND (("buyerCompanyId" IS NULL AND $3::uuid IS NULL) OR "buyerCompanyId"=$3)
       ORDER BY "createdAt" ASC LIMIT 1`, [offer.listingId, offer.buyerUserId, offer.buyerCompanyId || null]);
        if (!conversations[0]) {
            conversations = await this.dataSource.query(`INSERT INTO classified_conversations
          ("listingId","buyerUserId","buyerCompanyId","sellerUserId","sellerCompanyId","buyerLastReadAt","sellerLastReadAt","lastMessageAt")
         VALUES ($1,$2,$3,$4,$5,now(),NULL,now()) RETURNING *`, [offer.listingId, offer.buyerUserId, offer.buyerCompanyId || null, offer.sellerUserId, offer.sellerCompanyId || null]);
        }
        const conversation = conversations[0];
        const buyerEvent = event === 'CREATED' || event === 'UPDATED' || event === 'WITHDRAWN';
        const senderRole = buyerEvent ? 'BUYER' : 'SELLER';
        const senderName = buyerEvent ? offer.buyerName : offer.sellerName;
        const amount = Number(offer.amount || 0);
        const statusText = { CREATED: 'enviou uma oferta', UPDATED: 'atualizou a oferta', ACCEPTED: 'aceitou a oferta', REJECTED: 'recusou a oferta', WITHDRAWN: 'retirou a oferta' }[event];
        const body = `${senderName} ${statusText}: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}.`;
        const messages = await this.dataSource.query(`INSERT INTO classified_conversation_messages
        ("conversationId","senderId","senderName","senderRole",body,"messageType",metadata)
       VALUES ($1,$2,$3,$4,$5,'OFFER',$6::jsonb) RETURNING *`, [conversation.id, uid, senderName, senderRole, body, JSON.stringify({ type: 'OFFER', event, offerId: offer.id, listingId: offer.listingId, amount, status: offer.status })]);
        await this.dataSource.query(`UPDATE classified_conversations SET "lastMessageAt"=now(),"updatedAt"=now() WHERE id=$1`, [conversation.id]);
        return {
            conversationId: conversation.id,
            message: messages[0] || null,
            recipientIds: [offer.buyerUserId, offer.sellerUserId].filter((id) => id && id !== uid),
        };
    }
};
exports.ClassifiedsOfferChatService = ClassifiedsOfferChatService;
exports.ClassifiedsOfferChatService = ClassifiedsOfferChatService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], ClassifiedsOfferChatService);
//# sourceMappingURL=classifieds-offer-chat.service.js.map