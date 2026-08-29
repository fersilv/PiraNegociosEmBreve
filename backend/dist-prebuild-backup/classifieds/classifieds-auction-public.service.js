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
exports.ClassifiedsAuctionPublicService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let ClassifiedsAuctionPublicService = class ClassifiedsAuctionPublicService {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async list() {
        const rows = await this.dataSource.query(`
      SELECT
        a.id,a."listingId",a."companyId",a.status,a."startPrice",a."minIncrement",a."startsAt",a."endsAt",a."closedAt",a."finalAmount",a."createdAt",a."updatedAt",
        a."onlinePaymentEnabled",a."fulfillmentModes",a."deliveryFeeCents",a."deliveryNote",a."settlementPaymentStatus",
        a."auctionFeePayer",a."auctionFeeRateBps",a."auctionFeeMinimumCents",a."auctionFeeMaximumCents",a."auctionFeeSource",
        a."paymentMethods",a."cardMaxInstallments",a."pickupAddressSnapshot",
        l.title,l.slug,l.description,l.price AS "listingPrice",l.city,l.state,l.neighborhood,l.condition,l."sellerVerifiedSnapshot",
        c.name AS "companyName",c."logoURL" AS "companyLogo",c.address AS "companyAddress",c.city AS "companyCity",c.state AS "companyState",
        i.url AS image,hb.amount AS "currentBid",COALESCE(bc."bidCount",0)::int AS "bidCount"
      FROM classified_auctions a
      JOIN classified_listings l ON l.id=a."listingId"
      JOIN companies c ON c.id=a."companyId"
      LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder" ASC,"createdAt" ASC LIMIT 1) i ON true
      LEFT JOIN LATERAL (SELECT b.amount FROM classified_auction_bids b WHERE b."auctionId"=a.id ORDER BY b.amount DESC,b."createdAt" ASC LIMIT 1) hb ON true
      LEFT JOIN LATERAL (SELECT count(*) AS "bidCount" FROM classified_auction_bids b WHERE b."auctionId"=a.id) bc ON true
      WHERE a.status IN ('SCHEDULED','OPEN')
        AND a."endsAt">now()
        AND l.status='PUBLISHED'
        AND l."publicationChannels" @> '["CLASSIFIEDS"]'::jsonb
      ORDER BY CASE a.status WHEN 'OPEN' THEN 0 ELSE 1 END,a."startsAt" ASC,a."endsAt" ASC
    `);
        return rows.map((row) => this.present(row));
    }
    async detail(auctionId) {
        const rows = await this.dataSource.query(`
      SELECT a.*,l.title,l.slug,l.description,l.price AS "listingPrice",l.city,l.state,l.neighborhood,l.condition,l."sellerVerifiedSnapshot",
             c.name AS "companyName",c."logoURL" AS "companyLogo",c.address AS "companyAddress",c.city AS "companyCity",c.state AS "companyState",
             i.url AS image,hb.amount AS "currentBid",COALESCE(bc."bidCount",0)::int AS "bidCount"
      FROM classified_auctions a
      JOIN classified_listings l ON l.id=a."listingId"
      JOIN companies c ON c.id=a."companyId"
      LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder" ASC,"createdAt" ASC LIMIT 1) i ON true
      LEFT JOIN LATERAL (SELECT b.amount FROM classified_auction_bids b WHERE b."auctionId"=a.id ORDER BY b.amount DESC,b."createdAt" ASC LIMIT 1) hb ON true
      LEFT JOIN LATERAL (SELECT count(*) AS "bidCount" FROM classified_auction_bids b WHERE b."auctionId"=a.id) bc ON true
      WHERE a.id=$1 AND l."publicationChannels" @> '["CLASSIFIEDS"]'::jsonb LIMIT 1`, [auctionId]);
        if (!rows[0])
            throw new common_1.NotFoundException('Leilão não encontrado.');
        const bids = await this.dataSource.query(`SELECT b.id,b.amount,b."createdAt",COALESCE(c.name,u."socialName",u."displayName",u."fullName",'Participante') AS "bidderName" FROM classified_auction_bids b LEFT JOIN companies c ON c.id=b."bidderCompanyId" LEFT JOIN users u ON u.id=b."bidderUserId" WHERE b."auctionId"=$1 ORDER BY b.amount DESC,b."createdAt" ASC LIMIT 30`, [auctionId]);
        const row = rows[0];
        const modes = this.modes(row.fulfillmentModes);
        const feePayer = this.feePayer(row.auctionFeePayer);
        const feeCents = row.finalAmount == null ? null : this.fee(Math.round(Number(row.finalAmount) * 100), row);
        return {
            ...this.present(row),
            bids: bids.map((b) => ({ id: b.id, amount: Number(b.amount), createdAt: b.createdAt, bidderName: this.maskName(b.bidderName) })),
            settlement: {
                mode: row.onlinePaymentEnabled ? 'ONLINE_OR_DIRECT' : 'DIRECT',
                onlinePaymentEnabled: row.onlinePaymentEnabled === true,
                protectedPayment: false,
                fulfillmentModes: modes,
                deliveryFeeCents: Number(row.deliveryFeeCents || 0),
                deliveryNote: row.deliveryNote || null,
                pickupAddress: modes.includes('PICKUP') ? this.pickupAddress(row) : null,
                paymentStatus: row.settlementPaymentStatus || 'NOT_STARTED',
                paymentMethods: this.paymentMethods(row.paymentMethods),
                cardMaxInstallments: Number(row.cardMaxInstallments || 12),
                auctionFeePayer: feePayer,
                auctionFeeRateBps: row.auctionFeeRateBps == null ? null : Number(row.auctionFeeRateBps),
                auctionFeePercentage: row.auctionFeeRateBps == null ? null : Number(row.auctionFeeRateBps) / 100,
                auctionFeeCents: feeCents,
                buyerAuctionFeeCents: feePayer === 'BUYER' ? feeCents : 0,
                feeDisclosure: this.feeDisclosure(row, feeCents),
                message: row.onlinePaymentEnabled ? 'Após o arremate, vencedor e anunciante podem combinar retirada/entrega e finalizar o pagamento online pelo Mercado Pago ou negociar diretamente, conforme as condições do anúncio.' : 'Pagamento, retirada e entrega são combinados diretamente entre vencedor e anunciante.'
            }
        };
    }
    async forListings(listingIds) {
        const ids = [...new Set(listingIds.map(id => String(id || '').trim()).filter(Boolean))].slice(0, 100);
        if (!ids.length)
            return [];
        const rows = await this.dataSource.query(`SELECT a.id,a."listingId",a.status,a."startPrice",a."minIncrement",a."startsAt",a."endsAt",a."onlinePaymentEnabled",a."auctionFeePayer",a."auctionFeeRateBps",hb.amount AS "currentBid",COALESCE(bc."bidCount",0)::int AS "bidCount" FROM classified_auctions a LEFT JOIN LATERAL (SELECT b.amount FROM classified_auction_bids b WHERE b."auctionId"=a.id ORDER BY b.amount DESC,b."createdAt" ASC LIMIT 1) hb ON true LEFT JOIN LATERAL (SELECT count(*) AS "bidCount" FROM classified_auction_bids b WHERE b."auctionId"=a.id) bc ON true WHERE a.status IN ('SCHEDULED','OPEN') AND a."endsAt">now() AND a."listingId"=ANY($1::uuid[])`, [ids]);
        return rows.map((r) => ({ id: r.id, listingId: r.listingId, status: r.status, startPrice: Number(r.startPrice), minIncrement: Number(r.minIncrement), currentBid: r.currentBid == null ? null : Number(r.currentBid), bidCount: Number(r.bidCount || 0), startsAt: r.startsAt, endsAt: r.endsAt, scheduled: r.status === 'SCHEDULED' || new Date(r.startsAt).getTime() > Date.now(), live: r.status === 'OPEN' && new Date(r.startsAt).getTime() <= Date.now() && new Date(r.endsAt).getTime() > Date.now(), nextMinimum: Number(r.currentBid == null ? r.startPrice : Number(r.currentBid) + Number(r.minIncrement)), onlinePaymentEnabled: r.onlinePaymentEnabled === true, auctionFeePayer: this.feePayer(r.auctionFeePayer), auctionFeePercentage: r.auctionFeeRateBps == null ? null : Number(r.auctionFeeRateBps) / 100 }));
    }
    present(row) {
        const current = row.currentBid == null ? Number(row.startPrice) : Number(row.currentBid);
        const starts = new Date(row.startsAt).getTime();
        const ends = new Date(row.endsAt).getTime();
        return { id: row.id, listingId: row.listingId, companyId: row.companyId, status: row.status, title: row.title, slug: row.slug, description: row.description, listingPrice: row.listingPrice == null ? null : Number(row.listingPrice), city: row.city, state: row.state, neighborhood: row.neighborhood, condition: row.condition, sellerVerifiedSnapshot: Boolean(row.sellerVerifiedSnapshot), companyName: row.companyName, companyLogo: row.companyLogo, image: row.image, startPrice: Number(row.startPrice), minIncrement: Number(row.minIncrement), currentBid: row.currentBid == null ? null : Number(row.currentBid), bidCount: Number(row.bidCount || 0), startsAt: row.startsAt, endsAt: row.endsAt, closedAt: row.closedAt, finalAmount: row.finalAmount == null ? null : Number(row.finalAmount), nextMinimum: Number((row.currentBid == null ? Number(row.startPrice) : current + Number(row.minIncrement)).toFixed(2)), scheduled: row.status === 'SCHEDULED' || starts > Date.now(), live: row.status === 'OPEN' && starts <= Date.now() && ends > Date.now(), onlinePaymentEnabled: row.onlinePaymentEnabled === true, auctionFeePayer: this.feePayer(row.auctionFeePayer), auctionFeePercentage: row.auctionFeeRateBps == null ? null : Number(row.auctionFeeRateBps) / 100, paymentMethods: this.paymentMethods(row.paymentMethods), pickupAddress: this.modes(row.fulfillmentModes).includes('PICKUP') ? this.pickupAddress(row) : null };
    }
    fee(baseCents, row) { let value = Math.round(Math.max(0, baseCents) * Number(row.auctionFeeRateBps || 0) / 10000); value = Math.max(Number(row.auctionFeeMinimumCents || 0), value); if (row.auctionFeeMaximumCents != null)
        value = Math.min(Number(row.auctionFeeMaximumCents), value); return Math.max(0, Math.min(baseCents, value)); }
    feePayer(value) { return String(value || '').toUpperCase() === 'BUYER' ? 'BUYER' : 'SELLER'; }
    feeDisclosure(row, feeCents) { if (this.feePayer(row.auctionFeePayer) === 'SELLER')
        return 'A taxa de leilão é absorvida pela empresa anunciante.'; const pct = Number(row.auctionFeeRateBps || 0) / 100; return feeCents == null ? `Arremate + taxa de leilão de ${pct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%.` : `Arremate + taxa de leilão de ${(feeCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${pct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%).`; }
    pickupAddress(row) { if (row.pickupAddressSnapshot)
        return row.pickupAddressSnapshot; const cityState = [row.companyCity, row.companyState].filter(Boolean).join('/'); return [row.companyAddress, cityState].filter(Boolean).join(', ') || null; }
    paymentMethods(value) { const raw = Array.isArray(value) ? value : []; const methods = [...new Set(raw.map(String).map(v => v.toUpperCase()).filter(v => v === 'PIX' || v === 'CARD'))]; return methods.length ? methods : ['PIX', 'CARD']; }
    modes(value) { const raw = Array.isArray(value) ? value : []; const m = raw.map(String).map(v => v.toUpperCase()).filter(v => ['ARRANGE', 'PICKUP', 'DELIVERY'].includes(v)); return m.length ? m : ['ARRANGE']; }
    maskName(value) { const name = String(value || 'Participante').trim(); if (name.length <= 2)
        return `${name.charAt(0) || 'P'}***`; return `${name.charAt(0)}${'*'.repeat(Math.min(5, Math.max(2, name.length - 2)))}${name.charAt(name.length - 1)}`; }
};
exports.ClassifiedsAuctionPublicService = ClassifiedsAuctionPublicService;
exports.ClassifiedsAuctionPublicService = ClassifiedsAuctionPublicService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], ClassifiedsAuctionPublicService);
//# sourceMappingURL=classifieds-auction-public.service.js.map