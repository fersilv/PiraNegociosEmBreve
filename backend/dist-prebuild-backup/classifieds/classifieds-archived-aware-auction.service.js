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
exports.ClassifiedsArchivedAwareAuctionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const notifications_service_1 = require("../notifications/notifications.service");
const classifieds_auction_gateway_1 = require("./classifieds-auction.gateway");
const classifieds_auction_service_1 = require("./classifieds-auction.service");
const classifieds_identity_service_1 = require("./classifieds-identity.service");
let ClassifiedsArchivedAwareAuctionService = class ClassifiedsArchivedAwareAuctionService extends classifieds_auction_service_1.ClassifiedsAuctionService {
    archiveDataSource;
    archiveIdentities;
    constructor(archiveDataSource, archiveIdentities, notifications, auctionGateway) {
        super(archiveDataSource, archiveIdentities, notifications, auctionGateway);
        this.archiveDataSource = archiveDataSource;
        this.archiveIdentities = archiveIdentities;
    }
    async list(uid) {
        await this.ensureArchiveColumn();
        await this.closeDue().catch(() => undefined);
        const identity = await this.archiveIdentities.active(uid);
        const companyId = identity.type === 'COMPANY' ? identity.company.id : null;
        const rows = await this.archiveDataSource.query(`SELECT a.*, l.title, l.slug, l.description, l.city, l.state, l.status AS "listingStatus",
              c.name AS "companyName", c."logoURL" AS "companyLogo",
              i.url AS image,
              hb.amount AS "currentBid", hb.id AS "currentBidId",
              hb."bidderUserId" AS "currentBidderUserId", hb."bidderCompanyId" AS "currentBidderCompanyId",
              COALESCE(bc."bidCount", 0)::int AS "bidCount"
       FROM classified_auctions a
       JOIN classified_listings l ON l.id = a."listingId"
       JOIN companies c ON c.id = a."companyId"
       LEFT JOIN LATERAL (
         SELECT b.* FROM classified_auction_bids b
         WHERE b."auctionId" = a.id
         ORDER BY b.amount DESC, b."createdAt" ASC LIMIT 1
       ) hb ON true
       LEFT JOIN LATERAL (
         SELECT count(*) AS "bidCount" FROM classified_auction_bids b WHERE b."auctionId" = a.id
       ) bc ON true
       LEFT JOIN LATERAL (
         SELECT url FROM classified_listing_images
         WHERE "listingId" = l.id ORDER BY "sortOrder" ASC LIMIT 1
       ) i ON true
       WHERE a."archivedAt" IS NULL
         AND (a.status IN ('SCHEDULED','OPEN') OR a."updatedAt" >= now() - interval '30 days')
       ORDER BY CASE a.status WHEN 'OPEN' THEN 0 WHEN 'SCHEDULED' THEN 1 ELSE 2 END,
                a."startsAt" ASC, a."endsAt" ASC, a."updatedAt" DESC`);
        return rows.map((row) => {
            const owned = companyId ? row.companyId === companyId : false;
            const leading = companyId
                ? row.currentBidderCompanyId === companyId
                : !row.currentBidderCompanyId && row.currentBidderUserId === uid;
            const won = companyId
                ? row.winnerCompanyId === companyId
                : !row.winnerCompanyId && row.winnerUserId === uid;
            const current = row.currentBid == null ? Number(row.startPrice) : Number(row.currentBid);
            const nextMinimum = row.currentBid == null ? Number(row.startPrice) : current + Number(row.minIncrement);
            return {
                ...row,
                owned,
                leading,
                won,
                currentBid: row.currentBid,
                nextMinimum: nextMinimum.toFixed(2),
                paymentMode: 'DIRECT',
            };
        });
    }
    async ensureArchiveColumn() {
        await this.archiveDataSource.query(`ALTER TABLE classified_auctions ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz NULL`).catch(() => undefined);
    }
};
exports.ClassifiedsArchivedAwareAuctionService = ClassifiedsArchivedAwareAuctionService;
exports.ClassifiedsArchivedAwareAuctionService = ClassifiedsArchivedAwareAuctionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        classifieds_identity_service_1.ClassifiedsIdentityService,
        notifications_service_1.NotificationsService,
        classifieds_auction_gateway_1.ClassifiedsAuctionGateway])
], ClassifiedsArchivedAwareAuctionService);
//# sourceMappingURL=classifieds-archived-aware-auction.service.js.map