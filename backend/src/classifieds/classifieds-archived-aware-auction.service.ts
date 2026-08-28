import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { ClassifiedsAuctionGateway } from './classifieds-auction.gateway';
import { ClassifiedsAuctionService } from './classifieds-auction.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';

@Injectable()
export class ClassifiedsArchivedAwareAuctionService extends ClassifiedsAuctionService {
  constructor(
    private readonly archiveDataSource: DataSource,
    private readonly archiveIdentities: ClassifiedsIdentityService,
    notifications: NotificationsService,
    auctionGateway: ClassifiedsAuctionGateway,
  ) {
    super(archiveDataSource, archiveIdentities, notifications, auctionGateway);
  }

  override async list(uid: string) {
    await this.ensureArchiveColumn();
    await this.closeDue().catch(() => undefined);
    const identity = await this.archiveIdentities.active(uid);
    const companyId = identity.type === 'COMPANY' ? identity.company!.id : null;
    const rows = await this.archiveDataSource.query(
      `SELECT a.*, l.title, l.slug, l.description, l.city, l.state, l.status AS "listingStatus",
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
                a."startsAt" ASC, a."endsAt" ASC, a."updatedAt" DESC`,
    );

    return rows.map((row: any) => {
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

  private async ensureArchiveColumn() {
    await this.archiveDataSource.query(
      `ALTER TABLE classified_auctions ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz NULL`,
    ).catch(() => undefined);
  }
}
