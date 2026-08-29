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
exports.ClassifiedsArchivedAwareSalesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const notifications_service_1 = require("../notifications/notifications.service");
const classifieds_entitlements_service_1 = require("./classifieds-entitlements.service");
const classifieds_identity_service_1 = require("./classifieds-identity.service");
const classifieds_sales_service_1 = require("./classifieds-sales.service");
let ClassifiedsArchivedAwareSalesService = class ClassifiedsArchivedAwareSalesService extends classifieds_sales_service_1.ClassifiedsSalesService {
    reportingDataSource;
    reportingIdentities;
    constructor(reportingDataSource, reportingIdentities, entitlements, notifications) {
        super(reportingDataSource, reportingIdentities, entitlements, notifications);
        this.reportingDataSource = reportingDataSource;
        this.reportingIdentities = reportingIdentities;
    }
    async dashboard(uid) {
        const identity = await this.reportingIdentities.active(uid);
        if (identity.type !== 'COMPANY')
            throw new common_1.ForbiddenException('O módulo de Vendas é do workspace Business.');
        const companyId = identity.company.id;
        const [totals, recent, products, calendar] = await Promise.all([
            this.reportingDataSource.query(`SELECT
           count(*)::int AS orders,
           count(*) FILTER (WHERE "paymentStatus"='APPROVED')::int AS paid,
           COALESCE(sum("totalCents") FILTER (WHERE "paymentStatus"='APPROVED'),0)::bigint AS revenue,
           COALESCE(sum("platformFeeCents") FILTER (WHERE "paymentStatus"='APPROVED'),0)::bigint AS fees,
           COALESCE(sum("sellerNetCents") FILTER (WHERE "paymentStatus"='APPROVED'),0)::bigint AS net
         FROM classified_orders WHERE "companyId"=$1`, [companyId]).catch(() => [{ orders: 0, paid: 0, revenue: 0, fees: 0, net: 0 }]),
            this.reportingDataSource.query(`SELECT o.*,l.title,l.slug
         FROM classified_orders o JOIN classified_listings l ON l.id=o."listingId"
         WHERE o."companyId"=$1 ORDER BY o."createdAt" DESC LIMIT 30`, [companyId]).catch(() => []),
            this.reportingDataSource.query(`SELECT l.id,l.title,l.slug,
                count(o.id)::int AS orders,
                COALESCE(sum(o.quantity) FILTER (WHERE o."paymentStatus"='APPROVED'),0)::int AS units,
                COALESCE(sum(o."totalCents") FILTER (WHERE o."paymentStatus"='APPROVED'),0)::bigint AS revenue
         FROM classified_listings l
         LEFT JOIN classified_orders o ON o."listingId"=l.id
         WHERE l."companyId"=$1 AND l."listingType"='PRODUCT' AND l.status<>'ARCHIVED'
         GROUP BY l.id ORDER BY revenue DESC,units DESC,l."updatedAt" DESC LIMIT 50`, [companyId]).catch(() => []),
            this.reportingDataSource.query(`SELECT date_trunc('day',"createdAt")::date AS day,
                count(*)::int AS orders,
                COALESCE(sum("totalCents") FILTER (WHERE "paymentStatus"='APPROVED'),0)::bigint AS revenue
         FROM classified_orders
         WHERE "companyId"=$1 AND "createdAt">=now()-interval '90 days'
         GROUP BY 1 ORDER BY 1 ASC`, [companyId]).catch(() => []),
        ]);
        return {
            totals: totals[0] || { orders: 0, paid: 0, revenue: 0, fees: 0, net: 0 },
            recentOrders: recent,
            products,
            calendar,
        };
    }
};
exports.ClassifiedsArchivedAwareSalesService = ClassifiedsArchivedAwareSalesService;
exports.ClassifiedsArchivedAwareSalesService = ClassifiedsArchivedAwareSalesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        classifieds_identity_service_1.ClassifiedsIdentityService,
        classifieds_entitlements_service_1.ClassifiedsEntitlementsService,
        notifications_service_1.NotificationsService])
], ClassifiedsArchivedAwareSalesService);
//# sourceMappingURL=classifieds-archived-aware-sales.service.js.map