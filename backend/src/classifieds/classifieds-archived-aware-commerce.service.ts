import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { ClassifiedsAiReviewService } from './classifieds-ai-review.service';
import { ClassifiedsCommerceService } from './classifieds-commerce.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';

@Injectable()
export class ClassifiedsArchivedAwareCommerceService extends ClassifiedsCommerceService {
  constructor(
    private readonly reportingDataSource: DataSource,
    private readonly reportingIdentities: ClassifiedsIdentityService,
    notifications: NotificationsService,
    aiReview: ClassifiedsAiReviewService,
  ) {
    super(reportingDataSource, reportingIdentities, notifications, aiReview);
  }

  override async analytics(uid: string) {
    const identity = await this.reportingIdentities.active(uid);
    const companyId = identity.type === 'COMPANY' ? identity.company!.id : null;
    const listings = companyId
      ? await this.reportingDataSource.query(
          `SELECT id,title,slug,"listingType",status,"viewsCount","favoritesCount"
           FROM classified_listings
           WHERE "companyId"=$1 AND status<>'ARCHIVED'
           ORDER BY "updatedAt" DESC`,
          [companyId],
        )
      : await this.reportingDataSource.query(
          `SELECT id,title,slug,"listingType",status,"viewsCount","favoritesCount"
           FROM classified_listings
           WHERE "sellerUserId"=$1 AND "companyId" IS NULL AND status<>'ARCHIVED'
           ORDER BY "updatedAt" DESC`,
          [uid],
        );
    const ids = listings.map((item: any) => item.id);
    if (!ids.length) {
      return {
        totals: { views: 0, favorites: 0, conversations: 0, offers: 0, acceptedOffers: 0, contactClicks: 0 },
        listings: [],
        daily: [],
      };
    }

    const [conversationRows, offerRows, eventRows, daily] = await Promise.all([
      this.reportingDataSource.query(
        `SELECT "listingId",count(*)::int AS count
         FROM classified_conversations
         WHERE "listingId"=ANY($1::uuid[])
         GROUP BY "listingId"`,
        [ids],
      ),
      this.reportingDataSource.query(
        `SELECT "listingId",count(*)::int AS offers,
                count(*) FILTER (WHERE status='ACCEPTED')::int AS accepted
         FROM classified_offers
         WHERE "listingId"=ANY($1::uuid[])
         GROUP BY "listingId"`,
        [ids],
      ).catch(() => []),
      this.reportingDataSource.query(
        `SELECT "listingId",
                count(*) FILTER (WHERE "eventType"='CONTACT_CLICK')::int AS contacts
         FROM classified_listing_events
         WHERE "listingId"=ANY($1::uuid[])
         GROUP BY "listingId"`,
        [ids],
      ).catch(() => []),
      this.reportingDataSource.query(
        `SELECT date_trunc('day',"createdAt")::date AS day,"eventType",count(*)::int AS count
         FROM classified_listing_events
         WHERE "listingId"=ANY($1::uuid[]) AND "createdAt">=now()-interval '30 days'
         GROUP BY 1,2 ORDER BY 1 ASC`,
        [ids],
      ).catch(() => []),
    ]);

    const conversations = new Map<string, number>(conversationRows.map((row: any) => [row.listingId, Number(row.count)]));
    const offers = new Map<string, { offers: number; accepted: number }>(offerRows.map((row: any) => [row.listingId, { offers: Number(row.offers), accepted: Number(row.accepted) }]));
    const contacts = new Map<string, number>(eventRows.map((row: any) => [row.listingId, Number(row.contacts)]));
    const enriched = listings.map((listing: any) => ({
      ...listing,
      views: Number(listing.viewsCount || 0),
      favorites: Number(listing.favoritesCount || 0),
      conversations: conversations.get(listing.id) || 0,
      offers: offers.get(listing.id)?.offers || 0,
      acceptedOffers: offers.get(listing.id)?.accepted || 0,
      contactClicks: contacts.get(listing.id) || 0,
    }));

    return {
      totals: enriched.reduce((acc: any, item: any) => ({
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
}
