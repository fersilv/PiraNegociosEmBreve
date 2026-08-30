import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ApplicationsService } from '../applications/applications.service';
import { Application } from '../applications/entities/application.entity';
import { ClassifiedsCategoryTaxonomyService } from '../classifieds/classifieds-category-taxonomy.service';
import { ClassifiedCategory } from '../classifieds/entities/classified-category.entity';
import { ClassifiedListingImage } from '../classifieds/entities/classified-listing-image.entity';
import { ClassifiedListing } from '../classifieds/entities/classified-listing.entity';
import { Company } from '../companies/entities/company.entity';
import { Job } from '../jobs/entities/job.entity';
import { JobsService } from '../jobs/jobs.service';
import { CompanyMcpOperationsService } from './company-mcp-operations.service';
import { CompanyMcpProductLifecycleService } from './company-mcp-product-lifecycle.service';

@Injectable()
export class CompanyMcpSafeOperationsService extends CompanyMcpOperationsService {
  constructor(
    @InjectRepository(Company) companies: Repository<Company>,
    @InjectRepository(ClassifiedCategory) categoriesRepo: Repository<ClassifiedCategory>,
    @InjectRepository(ClassifiedListing) listings: Repository<ClassifiedListing>,
    @InjectRepository(ClassifiedListingImage) images: Repository<ClassifiedListingImage>,
    @InjectRepository(Job) jobs: Repository<Job>,
    @InjectRepository(Application) applications: Repository<Application>,
    taxonomy: ClassifiedsCategoryTaxonomyService,
    jobsService: JobsService,
    applicationsService: ApplicationsService,
    private readonly lifecycle: CompanyMcpProductLifecycleService,
    private readonly dataSource: DataSource,
  ) {
    super(
      companies,
      categoriesRepo,
      listings,
      images,
      jobs,
      applications,
      taxonomy,
      jobsService,
      applicationsService,
    );
  }

  override async productStatus(companyId: string, id: string, statusRaw: string) {
    const status = String(statusRaw || '').toUpperCase();
    if (status === 'SOLD') {
      await this.lifecycle.markSold(companyId, id);
      return this.productGet(companyId, id);
    }
    if (status === 'ARCHIVED') {
      await this.lifecycle.archive(companyId, id);
      return this.productGet(companyId, id);
    }
    return super.productStatus(companyId, id, statusRaw);
  }

  override async productArchive(companyId: string, id: string) {
    await this.lifecycle.archive(companyId, id);
    return this.productGet(companyId, id);
  }

  override async jobCreate(companyId: string, actorUserId: string, input: Partial<Job>) {
    const requestedActive = input.active;
    const created = await super.jobCreate(companyId, actorUserId, input);
    if (requestedActive === false) {
      return super.jobStatus(companyId, actorUserId, created.id, false);
    }
    return created;
  }

  override async commerceAnalytics(
    companyId: string,
    range: { from?: string; to?: string; groupBy?: string; metrics?: string[] } = {},
  ) {
    const base = await super.commerceAnalytics(companyId, range);
    const params: unknown[] = [companyId];
    const clauses = ['"companyId"=$1::uuid'];
    if (base.period.from) {
      params.push(base.period.from);
      clauses.push(`"createdAt">=$${params.length}::timestamptz`);
    }
    if (base.period.to) {
      params.push(base.period.to);
      clauses.push(`"createdAt"<=$${params.length}::timestamptz`);
    }
    const where = clauses.join(' AND ');

    const [orderRows, topProducts] = await Promise.all([
      this.dataSource.query(
        `SELECT
           count(*)::int AS orders,
           count(*) FILTER (WHERE "paymentStatus"='APPROVED')::int AS paid,
           COALESCE(sum("totalCents") FILTER (WHERE "paymentStatus"='APPROVED'),0)::bigint AS revenue,
           COALESCE(sum("platformFeeCents") FILTER (WHERE "paymentStatus"='APPROVED'),0)::bigint AS fees,
           COALESCE(sum("sellerNetCents") FILTER (WHERE "paymentStatus"='APPROVED'),0)::bigint AS net,
           COALESCE(sum(quantity) FILTER (WHERE "paymentStatus"='APPROVED'),0)::bigint AS units
         FROM classified_orders WHERE ${where}`,
        params,
      ).catch(() => [{ orders: 0, paid: 0, revenue: 0, fees: 0, net: 0, units: 0 }]),
      this.dataSource.query(
        `SELECT l.id,l.title,l.slug,
                count(o.id)::int AS orders,
                COALESCE(sum(o.quantity) FILTER (WHERE o."paymentStatus"='APPROVED'),0)::int AS units,
                COALESCE(sum(o."totalCents") FILTER (WHERE o."paymentStatus"='APPROVED'),0)::bigint AS revenue
         FROM classified_listings l
         LEFT JOIN classified_orders o ON o."listingId"=l.id
           AND (${where.replaceAll('"companyId"', 'o."companyId"').replaceAll('"createdAt"', 'o."createdAt"')})
         WHERE l."companyId"=$1::uuid AND l."listingType"='PRODUCT'
         GROUP BY l.id
         ORDER BY revenue DESC,units DESC,l."updatedAt" DESC
         LIMIT 20`,
        params,
      ).catch(() => []),
    ]);
    const orders = orderRows[0] || {};
    const cents = (value: unknown) => Number(value || 0);
    return {
      ...base,
      totals: {
        ...base.totals,
        orders: Number(orders.orders || 0),
        paidOrders: Number(orders.paid || 0),
        unitsSold: Number(orders.units || 0),
        revenueCents: cents(orders.revenue),
        platformFeesCents: cents(orders.fees),
        sellerNetCents: cents(orders.net),
      },
      topProducts: topProducts.map((item: any) => ({
        id: item.id,
        title: item.title,
        slug: item.slug,
        orders: Number(item.orders || 0),
        units: Number(item.units || 0),
        revenueCents: Number(item.revenue || 0),
      })),
      moneyUnit: 'BRL cents',
    };
  }
}
