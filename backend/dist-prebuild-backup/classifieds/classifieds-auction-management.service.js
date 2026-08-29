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
exports.ClassifiedsAuctionManagementService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const classifieds_identity_service_1 = require("./classifieds-identity.service");
let ClassifiedsAuctionManagementService = class ClassifiedsAuctionManagementService {
    dataSource;
    identities;
    constructor(dataSource, identities) {
        this.dataSource = dataSource;
        this.identities = identities;
    }
    async list(uid) {
        const identity = await this.identities.active(uid);
        const companyId = identity.type === 'COMPANY' ? identity.company.id : null;
        const rows = await this.dataSource.query(`SELECT DISTINCT
         a.*, l.title, l.slug, l.description, l.city, l.state,
         c.name AS "companyName", c."logoURL" AS "companyLogo", i.url AS image,
         hb.amount AS "currentBid", COALESCE(bc."bidCount", 0)::int AS "bidCount",
         CASE WHEN $2::uuid IS NOT NULL THEN a."companyId" = $2 ELSE false END AS owned,
         CASE WHEN $2::uuid IS NOT NULL
           THEN a."winnerCompanyId" = $2
           ELSE a."winnerCompanyId" IS NULL AND a."winnerUserId" = $1
         END AS won,
         EXISTS (
           SELECT 1 FROM classified_auction_bids mine
           WHERE mine."auctionId" = a.id
             AND (($2::uuid IS NOT NULL AND mine."bidderCompanyId" = $2)
               OR ($2::uuid IS NULL AND mine."bidderCompanyId" IS NULL AND mine."bidderUserId" = $1))
         ) AS participated,
         conv.id AS "conversationId"
       FROM classified_auctions a
       JOIN classified_listings l ON l.id = a."listingId"
       JOIN companies c ON c.id = a."companyId"
       LEFT JOIN LATERAL (
         SELECT url FROM classified_listing_images
         WHERE "listingId" = l.id ORDER BY "sortOrder" ASC, "createdAt" ASC LIMIT 1
       ) i ON true
       LEFT JOIN LATERAL (
         SELECT amount FROM classified_auction_bids
         WHERE "auctionId" = a.id ORDER BY amount DESC, "createdAt" ASC LIMIT 1
       ) hb ON true
       LEFT JOIN LATERAL (
         SELECT count(*) AS "bidCount" FROM classified_auction_bids WHERE "auctionId" = a.id
       ) bc ON true
       LEFT JOIN LATERAL (
         SELECT id FROM classified_conversations
         WHERE "listingId" = a."listingId"
           AND a."winnerUserId" IS NOT NULL
           AND "buyerUserId" = a."winnerUserId"
           AND "sellerCompanyId" = a."companyId"
         ORDER BY "createdAt" DESC LIMIT 1
       ) conv ON true
       WHERE
         ($2::uuid IS NOT NULL AND (
           a."companyId" = $2 OR a."winnerCompanyId" = $2 OR EXISTS (
             SELECT 1 FROM classified_auction_bids b WHERE b."auctionId" = a.id AND b."bidderCompanyId" = $2
           )
         ))
         OR
         ($2::uuid IS NULL AND (
           a."winnerUserId" = $1 OR EXISTS (
             SELECT 1 FROM classified_auction_bids b
             WHERE b."auctionId" = a.id AND b."bidderCompanyId" IS NULL AND b."bidderUserId" = $1
           )
         ))
       ORDER BY a."startsAt" DESC, a."createdAt" DESC`, [uid, companyId]);
        return rows.map((row) => this.present(row));
    }
    async detail(uid, auctionId) {
        const identity = await this.identities.active(uid);
        const companyId = identity.type === 'COMPANY' ? identity.company.id : null;
        const rows = await this.dataSource.query(`SELECT a.*, l.title, l.slug, l.description, l.city, l.state,
              c.name AS "companyName", c."logoURL" AS "companyLogo", c.phone AS "sellerPhone",
              i.url AS image,
              hb.amount AS "currentBid", COALESCE(bc."bidCount", 0)::int AS "bidCount",
              CASE WHEN $3::uuid IS NOT NULL THEN a."companyId" = $3 ELSE false END AS owned,
              CASE WHEN $3::uuid IS NOT NULL THEN a."winnerCompanyId" = $3
                   ELSE a."winnerCompanyId" IS NULL AND a."winnerUserId" = $2 END AS won,
              EXISTS (
                SELECT 1 FROM classified_auction_bids mine WHERE mine."auctionId" = a.id
                AND (($3::uuid IS NOT NULL AND mine."bidderCompanyId" = $3)
                  OR ($3::uuid IS NULL AND mine."bidderCompanyId" IS NULL AND mine."bidderUserId" = $2))
              ) AS participated,
              conv.id AS "conversationId"
       FROM classified_auctions a
       JOIN classified_listings l ON l.id = a."listingId"
       JOIN companies c ON c.id = a."companyId"
       LEFT JOIN LATERAL (
         SELECT url FROM classified_listing_images WHERE "listingId" = l.id
         ORDER BY "sortOrder" ASC, "createdAt" ASC LIMIT 1
       ) i ON true
       LEFT JOIN LATERAL (
         SELECT amount FROM classified_auction_bids WHERE "auctionId" = a.id
         ORDER BY amount DESC, "createdAt" ASC LIMIT 1
       ) hb ON true
       LEFT JOIN LATERAL (
         SELECT count(*) AS "bidCount" FROM classified_auction_bids WHERE "auctionId" = a.id
       ) bc ON true
       LEFT JOIN LATERAL (
         SELECT id FROM classified_conversations
         WHERE "listingId" = a."listingId" AND a."winnerUserId" IS NOT NULL
           AND "buyerUserId" = a."winnerUserId" AND "sellerCompanyId" = a."companyId"
         ORDER BY "createdAt" DESC LIMIT 1
       ) conv ON true
       WHERE a.id = $1 LIMIT 1`, [auctionId, uid, companyId]);
        const auction = rows[0];
        if (!auction)
            throw new common_1.NotFoundException('Leilão não encontrado.');
        if (!auction.owned && !auction.won && !auction.participated) {
            throw new common_1.ForbiddenException('Este leilão não pertence ao histórico desta identidade.');
        }
        const bids = await this.dataSource.query(`SELECT b.id,b.amount,b."createdAt",b."bidderUserId",b."bidderCompanyId",
              COALESCE(c.name,u."socialName",u."displayName",u."fullName",'Participante') AS "bidderName"
       FROM classified_auction_bids b
       LEFT JOIN users u ON u.id = b."bidderUserId"
       LEFT JOIN companies c ON c.id = b."bidderCompanyId"
       WHERE b."auctionId" = $1 ORDER BY b.amount DESC,b."createdAt" ASC LIMIT 100`, [auctionId]);
        let winnerContact = null;
        if (auction.owned && auction.status === 'ENDED' && auction.winnerUserId) {
            const winnerRows = await this.dataSource.query(`SELECT u.id,u.email,u.phone,u."whatsappPhoneE164",u."whatsappVerifiedAt",u."photoURL",
                COALESCE(u."socialName",u."displayName",u."fullName",'Arrematante') AS name,
                c.id AS "companyId",c.name AS "companyName",c.phone AS "companyPhone",c."logoURL" AS "companyLogo"
         FROM users u
         LEFT JOIN companies c ON c.id = $2
         WHERE u.id = $1 LIMIT 1`, [auction.winnerUserId, auction.winnerCompanyId || null]);
            const winner = winnerRows[0];
            if (winner) {
                winnerContact = {
                    id: winner.id,
                    name: winner.companyName || winner.name,
                    personName: winner.name,
                    email: winner.email || null,
                    phone: winner.whatsappPhoneE164 || winner.phone || winner.companyPhone || null,
                    whatsappVerified: Boolean(winner.whatsappVerifiedAt),
                    photoURL: winner.companyLogo || winner.photoURL || null,
                    companyId: winner.companyId || null,
                    companyName: winner.companyName || null,
                };
            }
        }
        const sellerContact = auction.won ? {
            companyId: auction.companyId,
            name: auction.companyName,
            phone: auction.sellerPhone || null,
            logoURL: auction.companyLogo || null,
        } : null;
        return {
            ...this.present(auction),
            bids: bids.map((bid) => ({
                id: bid.id,
                amount: Number(bid.amount),
                createdAt: bid.createdAt,
                mine: companyId
                    ? bid.bidderCompanyId === companyId
                    : !bid.bidderCompanyId && bid.bidderUserId === uid,
                bidderName: this.maskName(bid.bidderName),
            })),
            winnerContact,
            sellerContact,
        };
    }
    async updateSettlement(uid, auctionId, rawStatus) {
        const identity = await this.identities.active(uid);
        if (identity.type !== 'COMPANY')
            throw new common_1.ForbiddenException('Somente a empresa anunciante pode atualizar a negociação.');
        const companyId = identity.company.id;
        const status = String(rawStatus || '').trim().toUpperCase();
        if (!['PENDING', 'CONTACTED', 'AGREED', 'COMPLETED', 'CANCELED'].includes(status)) {
            throw new common_1.BadRequestException('Status de negociação inválido.');
        }
        const rows = await this.dataSource.query(`UPDATE classified_auctions SET "settlementStatus"=$3,"settlementUpdatedAt"=now(),"updatedAt"=now()
       WHERE id=$1 AND "companyId"=$2 AND status='ENDED' AND "winnerUserId" IS NOT NULL
       RETURNING id,"settlementStatus","settlementUpdatedAt"`, [auctionId, companyId, status]);
        if (!rows[0])
            throw new common_1.NotFoundException('Arrematação não encontrada para esta empresa.');
        return rows[0];
    }
    async assertCooldown(listingId) {
        const rows = await this.dataSource.query(`SELECT id,status,"closedAt",COALESCE("closedAt","updatedAt") + interval '48 hours' AS "cooldownUntil"
       FROM classified_auctions
       WHERE "listingId"=$1 AND status IN ('ENDED','CANCELED')
         AND COALESCE("closedAt","updatedAt") > now() - interval '48 hours'
       ORDER BY COALESCE("closedAt","updatedAt") DESC LIMIT 1`, [listingId]);
        if (rows[0]) {
            const until = new Date(rows[0].cooldownUntil);
            throw new common_1.BadRequestException(`Este produto entra em quarentena de leilão por 48 horas. Novo leilão disponível após ${until.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`);
        }
        return { ok: true };
    }
    present(row) {
        const current = row.currentBid == null ? Number(row.startPrice || 0) : Number(row.currentBid || 0);
        const startsAt = row.startsAt ? new Date(row.startsAt) : null;
        const endsAt = row.endsAt ? new Date(row.endsAt) : null;
        const now = Date.now();
        return {
            ...row,
            startPrice: Number(row.startPrice || 0),
            minIncrement: Number(row.minIncrement || 0),
            currentBid: row.currentBid == null ? null : Number(row.currentBid),
            finalAmount: row.finalAmount == null ? null : Number(row.finalAmount),
            bidCount: Number(row.bidCount || 0),
            nextMinimum: Number((row.currentBid == null ? Number(row.startPrice || 0) : current + Number(row.minIncrement || 0)).toFixed(2)),
            scheduled: row.status === 'OPEN' && Boolean(startsAt && startsAt.getTime() > now),
            live: row.status === 'OPEN' && Boolean(startsAt && startsAt.getTime() <= now && endsAt && endsAt.getTime() > now),
            settlementStatus: row.status === 'CANCELED' ? 'CANCELED' : (row.settlementStatus || 'PENDING'),
        };
    }
    maskName(value) {
        const name = String(value || 'Participante').trim();
        if (name.length <= 2)
            return `${name.charAt(0) || 'P'}***`;
        return `${name.charAt(0)}${'*'.repeat(Math.min(5, Math.max(2, name.length - 2)))}${name.charAt(name.length - 1)}`;
    }
};
exports.ClassifiedsAuctionManagementService = ClassifiedsAuctionManagementService;
exports.ClassifiedsAuctionManagementService = ClassifiedsAuctionManagementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        classifieds_identity_service_1.ClassifiedsIdentityService])
], ClassifiedsAuctionManagementService);
//# sourceMappingURL=classifieds-auction-management.service.js.map