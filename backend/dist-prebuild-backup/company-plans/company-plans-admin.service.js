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
exports.CompanyPlansAdminService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const company_plans_service_1 = require("./company-plans.service");
let CompanyPlansAdminService = class CompanyPlansAdminService {
    dataSource;
    companyPlans;
    constructor(dataSource, companyPlans) {
        this.dataSource = dataSource;
        this.companyPlans = companyPlans;
    }
    async get(companyId) {
        const companies = await this.dataSource.query(`SELECT id, name, "ownerId" FROM companies WHERE id = $1 LIMIT 1`, [companyId]);
        const company = companies[0];
        if (!company)
            throw new common_1.NotFoundException('Empresa não encontrada.');
        const [current, subscriptionRows, trialRows, productRows] = await Promise.all([
            this.companyPlans.getCompanyPlan(companyId),
            this.dataSource.query(`SELECT * FROM company_plan_subscriptions WHERE "companyId" = $1 LIMIT 1`, [companyId]).catch(() => []),
            this.dataSource.query(`SELECT * FROM company_plan_trials WHERE "companyId" = $1 LIMIT 1`, [companyId]).catch(() => []),
            this.dataSource.query(`SELECT code, name, "priceCents", "promotionalPriceCents", "promotionStartsAt", "promotionEndsAt", "durationDays", enabled
         FROM payment_products
         WHERE code IN ('COMPANY_PLUS_MONTHLY','COMPANY_ELITE_MONTHLY')
         ORDER BY "sortOrder" ASC`).catch(() => []),
        ]);
        return {
            company: { id: company.id, name: company.name },
            current,
            subscription: subscriptionRows[0] || null,
            trial: trialRows[0] || null,
            plans: [
                { id: 'FREE', name: 'Free', priceCents: 0 },
                ...productRows.map((row) => ({
                    id: row.code === 'COMPANY_ELITE_MONTHLY' ? 'ELITE' : 'PLUS',
                    name: row.code === 'COMPANY_ELITE_MONTHLY' ? 'Elite' : 'Plus',
                    productCode: row.code,
                    priceCents: Number(row.priceCents || 0),
                    promotionalPriceCents: row.promotionalPriceCents == null ? null : Number(row.promotionalPriceCents),
                    promotionStartsAt: row.promotionStartsAt || null,
                    promotionEndsAt: row.promotionEndsAt || null,
                    durationDays: Number(row.durationDays || 30),
                    enabled: row.enabled !== false,
                })),
            ],
        };
    }
    async set(companyId, rawPlan, rawCurrentPeriodEnd, adminUserId) {
        const plan = this.plan(rawPlan);
        const companies = await this.dataSource.query(`SELECT id, name, "ownerId" FROM companies WHERE id = $1 LIMIT 1`, [companyId]);
        const company = companies[0];
        if (!company)
            throw new common_1.NotFoundException('Empresa não encontrada.');
        await this.dataSource.query(`UPDATE company_plan_trials SET status = 'EXPIRED', "endsAt" = LEAST("endsAt", now()), "updatedAt" = now()
       WHERE "companyId" = $1 AND status = 'ACTIVE'`, [companyId]).catch(() => undefined);
        if (plan === 'FREE') {
            await this.dataSource.query(`UPDATE company_plan_subscriptions
         SET status = 'EXPIRED', "currentPeriodEnd" = LEAST("currentPeriodEnd", now()),
             "cancelAtPeriodEnd" = false,
             metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
             "updatedAt" = now()
         WHERE "companyId" = $1`, [companyId, JSON.stringify({ adminOverride: true, plan: 'FREE', grantedBy: adminUserId, changedAt: new Date().toISOString() })]).catch(() => undefined);
            await this.setHighlight(companyId, false, null, 'ADMIN_OVERRIDE');
            return this.get(companyId);
        }
        const productCode = plan === 'ELITE' ? 'COMPANY_ELITE_MONTHLY' : 'COMPANY_PLUS_MONTHLY';
        const products = await this.dataSource.query(`SELECT code, COALESCE("durationDays", 30)::int AS "durationDays" FROM payment_products WHERE code = $1 LIMIT 1`, [productCode]);
        if (!products[0])
            throw new common_1.BadRequestException(`O produto financeiro do plano ${plan} não está configurado.`);
        const payerRows = await this.dataSource.query(`SELECT id FROM users
       WHERE id = $1 OR "companyId" = $2
       ORDER BY CASE WHEN id = $1 THEN 0 WHEN "isCompanyAdmin" = true THEN 1 ELSE 2 END, "createdAt" ASC
       LIMIT 1`, [company.ownerId || '', companyId]);
        const payerUserId = payerRows[0]?.id;
        if (!payerUserId) {
            throw new common_1.BadRequestException('A empresa precisa ter um proprietário ou administrador vinculado antes de receber um plano.');
        }
        const durationDays = Math.max(1, Number(products[0].durationDays || 30));
        const currentPeriodEnd = this.periodEnd(rawCurrentPeriodEnd, durationDays);
        const metadata = {
            adminOverride: true,
            grantedBy: adminUserId,
            changedAt: new Date().toISOString(),
            plan,
            noCharge: true,
        };
        await this.dataSource.query(`INSERT INTO company_plan_subscriptions
        ("companyId", "payerUserId", plan, status, "productCode", provider,
         "providerSubscriptionId", "paymentId", "currentPeriodStart", "currentPeriodEnd",
         "cancelAtPeriodEnd", "isSimulation", metadata, "updatedAt")
       VALUES ($1,$2,$3,'ACTIVE',$4,'ADMIN',NULL,NULL,now(),$5,false,true,$6::jsonb,now())
       ON CONFLICT ("companyId") DO UPDATE SET
         "payerUserId" = EXCLUDED."payerUserId",
         plan = EXCLUDED.plan,
         status = 'ACTIVE',
         "productCode" = EXCLUDED."productCode",
         provider = 'ADMIN',
         "providerSubscriptionId" = NULL,
         "paymentId" = NULL,
         "currentPeriodStart" = now(),
         "currentPeriodEnd" = EXCLUDED."currentPeriodEnd",
         "cancelAtPeriodEnd" = false,
         "isSimulation" = true,
         metadata = coalesce(company_plan_subscriptions.metadata, '{}'::jsonb) || EXCLUDED.metadata,
         "updatedAt" = now()`, [companyId, payerUserId, plan, productCode, currentPeriodEnd, JSON.stringify(metadata)]);
        await this.setHighlight(companyId, plan === 'ELITE', plan === 'ELITE' ? currentPeriodEnd : null, 'ADMIN_OVERRIDE');
        return this.get(companyId);
    }
    plan(value) {
        const plan = String(value || '').toUpperCase();
        if (!['FREE', 'PLUS', 'ELITE'].includes(plan))
            throw new common_1.BadRequestException('Plano inválido.');
        return plan;
    }
    periodEnd(value, durationDays) {
        if (value !== null && value !== undefined && String(value).trim()) {
            const date = new Date(String(value));
            if (Number.isNaN(date.getTime()))
                throw new common_1.BadRequestException('Data de vencimento inválida.');
            const max = Date.now() + 5 * 365 * 24 * 60 * 60 * 1000;
            if (date.getTime() <= Date.now())
                throw new common_1.BadRequestException('O vencimento do plano deve ficar no futuro.');
            if (date.getTime() > max)
                throw new common_1.BadRequestException('O vencimento não pode ultrapassar 5 anos.');
            return date;
        }
        return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    }
    async setHighlight(companyId, eligible, eligibleUntil, source) {
        await this.dataSource.query(`INSERT INTO company_ad_highlight_eligibility
        ("companyId", eligible, channels, "eligibleUntil", source, "updatedAt")
       VALUES ($1,$2,'["META","GOOGLE"]'::jsonb,$3,$4,now())
       ON CONFLICT ("companyId") DO UPDATE SET
         eligible = EXCLUDED.eligible,
         channels = EXCLUDED.channels,
         "eligibleUntil" = EXCLUDED."eligibleUntil",
         source = EXCLUDED.source,
         "updatedAt" = now()`, [companyId, eligible, eligibleUntil, source]).catch(() => undefined);
    }
};
exports.CompanyPlansAdminService = CompanyPlansAdminService;
exports.CompanyPlansAdminService = CompanyPlansAdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        company_plans_service_1.CompanyPlansService])
], CompanyPlansAdminService);
//# sourceMappingURL=company-plans-admin.service.js.map