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
exports.ClassifiedsArchivedAwareCommerceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const notifications_service_1 = require("../notifications/notifications.service");
const classifieds_ai_review_service_1 = require("./classifieds-ai-review.service");
const classifieds_commerce_service_1 = require("./classifieds-commerce.service");
const classifieds_identity_service_1 = require("./classifieds-identity.service");
let ClassifiedsArchivedAwareCommerceService = class ClassifiedsArchivedAwareCommerceService extends classifieds_commerce_service_1.ClassifiedsCommerceService {
    reportingDataSource;
    reportingIdentities;
    constructor(reportingDataSource, reportingIdentities, notifications, aiReview) {
        super(reportingDataSource, reportingIdentities, notifications, aiReview);
        this.reportingDataSource = reportingDataSource;
        this.reportingIdentities = reportingIdentities;
    }
    async analytics(uid) {
        const identity = await this.reportingIdentities.active(uid);
        const companyId = identity.type === 'COMPANY' ? identity.company.id : null;
        const listings = companyId
            ? await this.reportingDataSource.query(`SELECT id,title,slug,"listingType",status,"viewsCount","favoritesCount"
           FROM classified_listings
           WHERE "companyId"=$1 AND status<>'ARCHIVED'
           ORDER BY "updatedAt" DESC`, [companyId])
            : await this.reportingDataSource.query(`SELECT id,title,slug,"listingType",status,"viewsCount","favoritesCount"
           FROM classified_listings
           WHERE "sellerUserId"=$1 AND "companyId" IS NULL AND status<>'ARCHIVED'
           ORDER BY "updatedAt" DESC`, [uid]);
        const ids = listings.map((item) => item.id);
        if (!ids.length) {
            return {
                totals: { views: 0, favorites: 0, conversations: 0, offers: 0, acceptedOffers: 0, contactClicks: 0 },
                listings: [],
                daily: [],
            };
        }
        const [conversationRows, offerRows, eventRows, daily] = await Promise.all([
            this.reportingDataSource.query(`SELECT "listingId",count(*)::int AS count
         FROM classified_conversations
         WHERE "listingId"=ANY($1::uuid[])
         GROUP BY "listingId"`, [ids]),
            this.reportingDataSource.query(`SELECT "listingId",count(*)::int AS offers,
                count(*) FILTER (WHERE status='ACCEPTED')::int AS accepted
         FROM classified_offers
         WHERE "listingId"=ANY($1::uuid[])
         GROUP BY "listingId"`, [ids]).catch(() => []),
            this.reportingDataSource.query(`SELECT "listingId",
                count(*) FILTER (WHERE "eventType"='CONTACT_CLICK')::int AS contacts
         FROM classified_listing_events
         WHERE "listingId"=ANY($1::uuid[])
         GROUP BY "listingId"`, [ids]).catch(() => []),
            this.reportingDataSource.query(`SELECT date_trunc('day',"createdAt")::date AS day,"eventType",count(*)::int AS count
         FROM classified_listing_events
         WHERE "listingId"=ANY($1::uuid[]) AND "createdAt">=now()-interval '30 days'
         GROUP BY 1,2 ORDER BY 1 ASC`, [ids]).catch(() => []),
        ]);
        const conversations = new Map(conversationRows.map((row) => [row.listingId, Number(row.count)]));
        const offers = new Map(offerRows.map((row) => [row.listingId, { offers: Number(row.offers), accepted: Number(row.accepted) }]));
        const contacts = new Map(eventRows.map((row) => [row.listingId, Number(row.contacts)]));
        const enriched = listings.map((listing) => ({
            ...listing,
            views: Number(listing.viewsCount || 0),
            favorites: Number(listing.favoritesCount || 0),
            conversations: conversations.get(listing.id) || 0,
            offers: offers.get(listing.id)?.offers || 0,
            acceptedOffers: offers.get(listing.id)?.accepted || 0,
            contactClicks: contacts.get(listing.id) || 0,
        }));
        return {
            totals: enriched.reduce((acc, item) => ({
                views: acc.views + item.views,
                favorites: acc.favorites + item.favorites,
                conversations: acc.conversations + item.conversations,
                offers: acc.offers + item.offers,
                acceptedOffers: acc.acceptedOffers + item.acceptedOffers,
                contactClicks: acc.contactClicks + item.contactClicks,
            }), { views: 0, favorites: 0, conversations: 0, offers: 0, acceptedOffers: 0, contactClicks: 0 }),
            listings: enriched,
            daily,
        };
    }
};
exports.ClassifiedsArchivedAwareCommerceService = ClassifiedsArchivedAwareCommerceService;
exports.ClassifiedsArchivedAwareCommerceService = ClassifiedsArchivedAwareCommerceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        classifieds_identity_service_1.ClassifiedsIdentityService,
        notifications_service_1.NotificationsService,
        classifieds_ai_review_service_1.ClassifiedsAiReviewService])
], ClassifiedsArchivedAwareCommerceService);
//# sourceMappingURL=classifieds-archived-aware-commerce.service.js.map