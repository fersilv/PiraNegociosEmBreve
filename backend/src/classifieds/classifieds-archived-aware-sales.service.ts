import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { ClassifiedsEntitlementsService } from './classifieds-entitlements.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedsSalesService } from './classifieds-sales.service';

@Injectable()
export class ClassifiedsArchivedAwareSalesService extends ClassifiedsSalesService {
  constructor(
    private readonly reportingDataSource: DataSource,
    private readonly reportingIdentities: ClassifiedsIdentityService,
    entitlements: ClassifiedsEntitlementsService,
    notifications: NotificationsService,
  ) {
    super(reportingDataSource, reportingIdentities, entitlements, notifications);
  }

  override async dashboard(uid: string) {
    const identity = await this.reportingIdentities.active(uid);
    if (identity.type !== 'COMPANY') throw new ForbiddenException('O módulo de Vendas é do workspace Business.');
    const companyId = identity.company!.id;
    const [totals, recent, products, calendar] = await Promise.all([
      this.reportingDataSource.query(
        `SELECT
           count(*)::int AS orders,
           count(*) FILTER (WHERE "paymentStatus"='APPROVED')::int AS paid,
           COALESCE(sum("totalCents") FILTER (WHERE "paymentStatus"='APPROVED'),0)::bigint AS revenue,
           COALESCE(sum("platformFeeCents") FILTER (WHERE "paymentStatus"='APPROVED'),0)::bigint AS fees,
           COALESCE(sum("sellerNetCents") FILTER (WHERE "paymentStatus"='APPROVED'),0)::bigint AS net
         FROM classified_orders WHERE "companyId"=$1`,
        [companyId],
      ).catch(() => [{ orders: 0, paid: 0, revenue: 0, fees: 0, net: 0 }]),
      this.reportingDataSource.query(
        `SELECT o.*,l.title,l.slug
         FROM classified_orders o JOIN classified_listings l ON l.id=o."listingId"
         WHERE o."companyId"=$1 ORDER BY o."createdAt" DESC LIMIT 30`,
        [companyId],
      ).catch(() => []),
      this.reportingDataSource.query(
        `SELECT l.id,l.title,l.slug,
                count(o.id)::int AS orders,
                COALESCE(sum(o.quantity) FILTER (WHERE o."paymentStatus"='APPROVED'),0)::int AS units,
                COALESCE(sum(o."totalCents") FILTER (WHERE o."paymentStatus"='APPROVED'),0)::bigint AS revenue
         FROM classified_listings l
         LEFT JOIN classified_orders o ON o."listingId"=l.id
         WHERE l."companyId"=$1 AND l."listingType"='PRODUCT' AND l.status<>'ARCHIVED'
         GROUP BY l.id ORDER BY revenue DESC,units DESC,l."updatedAt" DESC LIMIT 50`,
        [companyId],
      ).catch(() => []),
      this.reportingDataSource.query(
        `SELECT date_trunc('day',"createdAt")::date AS day,
                count(*)::int AS orders,
                COALESCE(sum("totalCents") FILTER (WHERE "paymentStatus"='APPROVED'),0)::bigint AS revenue
         FROM classified_orders
         WHERE "companyId"=$1 AND "createdAt">=now()-interval '90 days'
         GROUP BY 1 ORDER BY 1 ASC`,
        [companyId],
      ).catch(() => []),
    ]);
    return {
      totals: totals[0] || { orders: 0, paid: 0, revenue: 0, fees: 0, net: 0 },
      recentOrders: recent,
      products,
      calendar,
    };
  }
}
