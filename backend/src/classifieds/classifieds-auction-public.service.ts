import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ClassifiedsAuctionPublicService {
  constructor(private readonly dataSource: DataSource) {}

  async list() {
    const rows = await this.dataSource.query(`
      SELECT
        a.id,
        a."listingId",
        a."companyId",
        a.status,
        a."startPrice",
        a."minIncrement",
        a."startsAt",
        a."endsAt",
        a."closedAt",
        a."finalAmount",
        a."createdAt",
        a."updatedAt",
        l.title,
        l.slug,
        l.description,
        l.price AS "listingPrice",
        l.city,
        l.state,
        l.neighborhood,
        l.condition,
        l."sellerVerifiedSnapshot",
        c.name AS "companyName",
        c."logoURL" AS "companyLogo",
        i.url AS image,
        hb.amount AS "currentBid",
        COALESCE(bc."bidCount", 0)::int AS "bidCount"
      FROM classified_auctions a
      JOIN classified_listings l ON l.id = a."listingId"
      JOIN companies c ON c.id = a."companyId"
      LEFT JOIN LATERAL (
        SELECT url
        FROM classified_listing_images
        WHERE "listingId" = l.id
        ORDER BY "sortOrder" ASC, "createdAt" ASC
        LIMIT 1
      ) i ON true
      LEFT JOIN LATERAL (
        SELECT b.amount
        FROM classified_auction_bids b
        WHERE b."auctionId" = a.id
        ORDER BY b.amount DESC, b."createdAt" ASC
        LIMIT 1
      ) hb ON true
      LEFT JOIN LATERAL (
        SELECT count(*) AS "bidCount"
        FROM classified_auction_bids b
        WHERE b."auctionId" = a.id
      ) bc ON true
      WHERE a.status = 'OPEN'
        AND a."endsAt" > now()
        AND l.status = 'PUBLISHED'
        AND l."publicationChannels" @> '["CLASSIFIEDS"]'::jsonb
      ORDER BY a."endsAt" ASC, COALESCE(hb.amount, a."startPrice") DESC
    `);
    return rows.map((row: any) => this.present(row));
  }

  async detail(auctionId: string) {
    const rows = await this.dataSource.query(
      `SELECT
        a.id,
        a."listingId",
        a."companyId",
        a.status,
        a."startPrice",
        a."minIncrement",
        a."startsAt",
        a."endsAt",
        a."closedAt",
        a."finalAmount",
        a."createdAt",
        a."updatedAt",
        l.title,
        l.slug,
        l.description,
        l.price AS "listingPrice",
        l.city,
        l.state,
        l.neighborhood,
        l.condition,
        l."sellerVerifiedSnapshot",
        c.name AS "companyName",
        c."logoURL" AS "companyLogo",
        i.url AS image,
        hb.amount AS "currentBid",
        COALESCE(bc."bidCount", 0)::int AS "bidCount"
      FROM classified_auctions a
      JOIN classified_listings l ON l.id = a."listingId"
      JOIN companies c ON c.id = a."companyId"
      LEFT JOIN LATERAL (
        SELECT url
        FROM classified_listing_images
        WHERE "listingId" = l.id
        ORDER BY "sortOrder" ASC, "createdAt" ASC
        LIMIT 1
      ) i ON true
      LEFT JOIN LATERAL (
        SELECT b.amount
        FROM classified_auction_bids b
        WHERE b."auctionId" = a.id
        ORDER BY b.amount DESC, b."createdAt" ASC
        LIMIT 1
      ) hb ON true
      LEFT JOIN LATERAL (
        SELECT count(*) AS "bidCount"
        FROM classified_auction_bids b
        WHERE b."auctionId" = a.id
      ) bc ON true
      WHERE a.id = $1
        AND l."publicationChannels" @> '["CLASSIFIEDS"]'::jsonb
      LIMIT 1`,
      [auctionId],
    );
    if (!rows[0]) throw new NotFoundException('Leilão não encontrado.');

    const bids = await this.dataSource.query(
      `SELECT
        b.id,
        b.amount,
        b."createdAt",
        COALESCE(c.name, u."socialName", u."displayName", u."fullName", 'Participante') AS "bidderName"
      FROM classified_auction_bids b
      LEFT JOIN companies c ON c.id = b."bidderCompanyId"
      LEFT JOIN users u ON u.id = b."bidderUserId"
      WHERE b."auctionId" = $1
      ORDER BY b.amount DESC, b."createdAt" ASC
      LIMIT 30`,
      [auctionId],
    );

    return {
      ...this.present(rows[0]),
      bids: bids.map((bid: any) => ({
        id: bid.id,
        amount: Number(bid.amount),
        createdAt: bid.createdAt,
        bidderName: this.maskName(bid.bidderName),
      })),
      settlement: {
        mode: 'DIRECT',
        protectedPayment: false,
        message: 'Pagamento e entrega são combinados diretamente entre vencedor e anunciante.',
      },
    };
  }

  async forListings(listingIds: string[]) {
    const ids = [...new Set(listingIds.map((id) => String(id || '').trim()).filter(Boolean))].slice(0, 100);
    if (!ids.length) return [];
    const rows = await this.dataSource.query(
      `SELECT a.id, a."listingId", a."startPrice", a."minIncrement", a."endsAt",
              hb.amount AS "currentBid", COALESCE(bc."bidCount", 0)::int AS "bidCount"
       FROM classified_auctions a
       LEFT JOIN LATERAL (
         SELECT b.amount FROM classified_auction_bids b
         WHERE b."auctionId" = a.id ORDER BY b.amount DESC, b."createdAt" ASC LIMIT 1
       ) hb ON true
       LEFT JOIN LATERAL (
         SELECT count(*) AS "bidCount" FROM classified_auction_bids b WHERE b."auctionId" = a.id
       ) bc ON true
       WHERE a.status = 'OPEN' AND a."endsAt" > now() AND a."listingId" = ANY($1::uuid[])`,
      [ids],
    );
    return rows.map((row: any) => ({
      id: row.id,
      listingId: row.listingId,
      startPrice: Number(row.startPrice),
      minIncrement: Number(row.minIncrement),
      currentBid: row.currentBid == null ? null : Number(row.currentBid),
      bidCount: Number(row.bidCount || 0),
      endsAt: row.endsAt,
      nextMinimum: Number(row.currentBid == null ? row.startPrice : Number(row.currentBid) + Number(row.minIncrement)),
    }));
  }

  private present(row: any) {
    const current = row.currentBid == null ? Number(row.startPrice) : Number(row.currentBid);
    return {
      id: row.id,
      listingId: row.listingId,
      companyId: row.companyId,
      status: row.status,
      title: row.title,
      slug: row.slug,
      description: row.description,
      listingPrice: row.listingPrice == null ? null : Number(row.listingPrice),
      city: row.city,
      state: row.state,
      neighborhood: row.neighborhood,
      condition: row.condition,
      sellerVerifiedSnapshot: Boolean(row.sellerVerifiedSnapshot),
      companyName: row.companyName,
      companyLogo: row.companyLogo,
      image: row.image,
      startPrice: Number(row.startPrice),
      minIncrement: Number(row.minIncrement),
      currentBid: row.currentBid == null ? null : Number(row.currentBid),
      bidCount: Number(row.bidCount || 0),
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      closedAt: row.closedAt,
      finalAmount: row.finalAmount == null ? null : Number(row.finalAmount),
      nextMinimum: Number((row.currentBid == null ? Number(row.startPrice) : current + Number(row.minIncrement)).toFixed(2)),
      live: row.status === 'OPEN' && new Date(row.endsAt).getTime() > Date.now(),
    };
  }

  private maskName(value: unknown) {
    const name = String(value || 'Participante').trim();
    if (name.length <= 2) return `${name.charAt(0) || 'P'}***`;
    return `${name.charAt(0)}${'*'.repeat(Math.min(5, Math.max(2, name.length - 2)))}${name.charAt(name.length - 1)}`;
  }
}
