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
exports.McpManagementService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const registration_service_1 = require("../admin/registration.service");
const settings_service_1 = require("../admin/settings.service");
const company_plans_admin_service_1 = require("../company-plans/company-plans-admin.service");
const billing_support_service_1 = require("../payments/billing-support.service");
const payment_provider_manager_service_1 = require("../payments/payment-provider-manager.service");
const payments_service_1 = require("../payments/payments.service");
const product_duration_service_1 = require("../payments/product-duration.service");
const seo_utils_1 = require("../seo/seo.utils");
const VALID_UFS = new Set([
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);
const COMPANY_CATEGORIES = new Set(['EMPLOYER', 'SERVICE_PROVIDER', 'RETAILER', 'OTHER']);
const COMPANY_STATUSES = new Set(['DRAFT', 'PENDING', 'VERIFIED', 'REJECTED']);
const AD_TYPES = new Set(['leaderboard', 'rectangle', 'sidebar', 'carousel']);
const BILLING_FEATURES = new Set(['RESUME_REANALYSIS', 'RESUME_AI_IMPROVEMENT', 'RESUME_AI_IMPORT']);
const TIMED_FEATURES = new Set(['JOB_MATCH_30D']);
let McpManagementService = class McpManagementService {
    dataSource;
    registration;
    settings;
    companyPlans;
    payments;
    billing;
    productDuration;
    paymentProviders;
    constructor(dataSource, registration, settings, companyPlans, payments, billing, productDuration, paymentProviders) {
        this.dataSource = dataSource;
        this.registration = registration;
        this.settings = settings;
        this.companyPlans = companyPlans;
        this.payments = payments;
        this.billing = billing;
        this.productDuration = productDuration;
        this.paymentProviders = paymentProviders;
    }
    async platformSummary() {
        const [counts, activeVisitors] = await Promise.all([
            this.dataSource.query(`
        SELECT
          (SELECT count(*)::int FROM companies) AS companies,
          (SELECT count(*)::int FROM companies WHERE "verificationStatus"='PENDING') AS "pendingCompanies",
          (SELECT count(*)::int FROM jobs WHERE active=true) AS "activeJobs",
          (SELECT count(*)::int FROM users) AS users
      `),
            this.dataSource.query(`
        SELECT count(DISTINCT "visitorId")::int AS count
        FROM visitor_events
        WHERE "createdAt" >= now() - interval '5 minutes'
      `).catch(() => [{ count: 0 }]),
        ]);
        return {
            ...(counts[0] || {}),
            activeVisitors: Number(activeVisitors[0]?.count || 0),
        };
    }
    async platformAnalytics(days = 30) {
        const safeDays = Math.min(365, Math.max(1, Math.round(Number(days || 30))));
        const interval = `${safeDays} days`;
        const [totals, engagement, sources, devices, pages, security] = await Promise.all([
            this.dataSource.query(`SELECT count(*)::int AS "pageViews", count(DISTINCT "visitorId")::int AS "uniqueVisitors"
         FROM visitor_events WHERE "createdAt" >= now() - $1::interval`, [interval]).catch(() => []),
            this.dataSource.query(`SELECT round(coalesce(avg("durationSeconds"),0))::int AS seconds
         FROM visitor_events WHERE "createdAt" >= now() - $1::interval AND "eventType"='ENGAGEMENT'`, [interval]).catch(() => []),
            this.dataSource.query(`SELECT coalesce("utmSource","referrerOrigin",'Direto') AS source,count(*)::int AS count
         FROM visitor_events WHERE "createdAt" >= now() - $1::interval
         GROUP BY coalesce("utmSource","referrerOrigin",'Direto') ORDER BY count DESC LIMIT 10`, [interval]).catch(() => []),
            this.dataSource.query(`SELECT coalesce("deviceType",'unknown') AS device,count(DISTINCT "visitorId")::int AS count
         FROM visitor_events WHERE "createdAt" >= now() - $1::interval
         GROUP BY coalesce("deviceType",'unknown') ORDER BY count DESC`, [interval]).catch(() => []),
            this.dataSource.query(`SELECT path,count(*)::int AS count
         FROM visitor_events WHERE "createdAt" >= now() - $1::interval AND "eventType"='PAGE_VIEW'
         GROUP BY path ORDER BY count DESC LIMIT 12`, [interval]).catch(() => []),
            this.dataSource.query(`SELECT count(*)::int AS accesses,
                count(*) FILTER (WHERE "isNewDevice"=true)::int AS "newDevices"
         FROM account_accesses WHERE "createdAt" >= now() - $1::interval`, [interval]).catch(() => []),
        ]);
        return {
            periodDays: safeDays,
            pageViews: Number(totals[0]?.pageViews || 0),
            uniqueVisitors: Number(totals[0]?.uniqueVisitors || 0),
            averageEngagementSeconds: Number(engagement[0]?.seconds || 0),
            sources,
            devices,
            topPages: pages,
            accountAccesses: Number(security[0]?.accesses || 0),
            newDevices: Number(security[0]?.newDevices || 0),
        };
    }
    async registrationOverview() {
        return {
            open: await this.registration.isOpen(),
            waiting: await this.registration.countWaiting(),
            interests: await this.registration.list(),
        };
    }
    registrationSetOpen(open) {
        return this.registration.setOpen(open === true);
    }
    async companiesList(input = {}) {
        const q = this.text(input.q, 160);
        const status = String(input.status || '').trim().toUpperCase();
        if (status && !COMPANY_STATUSES.has(status))
            throw new common_1.BadRequestException('Status de empresa inválido.');
        const limit = Math.min(200, Math.max(1, Math.round(Number(input.limit || 50))));
        const params = [];
        const where = [];
        if (q) {
            params.push(`%${q.replace(/[%_]/g, '')}%`);
            where.push(`(name ILIKE $${params.length} OR cnpj ILIKE $${params.length} OR city ILIKE $${params.length})`);
        }
        if (status) {
            params.push(status);
            where.push(`"verificationStatus"=$${params.length}`);
        }
        params.push(limit);
        return this.dataSource.query(`SELECT id,name,slug,category,city,state,"verificationStatus","isVerified","complianceStatus","createdAt","updatedAt"
       FROM companies ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY "createdAt" DESC LIMIT $${params.length}`, params);
    }
    async companyGet(id) {
        const companies = await this.dataSource.query(`SELECT id,"ownerId",name,slug,"slugIsCustom","pendingSlug","slugChangeStatus",category,description,
              "documentType",cnpj,cpf,website,address,"cityState",city,state,phone,"verificationStatus","isVerified",
              "complianceStatus","rejectionReason","socialInstagram","socialLinkedin","socialFacebook","logoURL","createdAt","updatedAt"
       FROM companies WHERE id=$1 LIMIT 1`, [id]);
        if (!companies[0])
            throw new common_1.NotFoundException('Empresa não encontrada.');
        const [employees, counters] = await Promise.all([
            this.dataSource.query(`SELECT id,email,"displayName","fullName","socialName","isCompanyAdmin",status,"createdAt"
         FROM users WHERE "companyId"=$1 ORDER BY "isCompanyAdmin" DESC,"createdAt" ASC LIMIT 200`, [id]),
            this.dataSource.query(`SELECT
          (SELECT count(*)::int FROM jobs WHERE "companyId"=$1) AS jobs,
          (SELECT count(*)::int FROM applications WHERE "companyId"=$1) AS applications`, [id]),
        ]);
        return { company: companies[0], employees, counters: counters[0] || { jobs: 0, applications: 0 } };
    }
    async companyCreate(actor, input) {
        const ownerUserId = this.text(input.ownerUserId, 160);
        const name = this.text(input.name, 240);
        if (!ownerUserId || !name)
            throw new common_1.BadRequestException('ownerUserId e nome são obrigatórios.');
        const owner = await this.dataSource.query('SELECT id FROM users WHERE id=$1 LIMIT 1', [ownerUserId]);
        if (!owner[0])
            throw new common_1.BadRequestException('Usuário proprietário não encontrado.');
        const category = String(input.category || 'EMPLOYER').toUpperCase();
        if (!COMPANY_CATEGORIES.has(category))
            throw new common_1.BadRequestException('Categoria inválida.');
        const verificationStatus = String(input.verificationStatus || 'DRAFT').toUpperCase();
        if (!COMPANY_STATUSES.has(verificationStatus))
            throw new common_1.BadRequestException('Status de verificação inválido.');
        const city = this.text(input.city, 120) || null;
        const state = this.uf(input.state);
        const requestedSlug = this.text(input.slug, 180);
        const slug = await this.nextCompanySlug(requestedSlug ? this.validSlug(requestedSlug) : name);
        const rows = await this.dataSource.query(`INSERT INTO companies
        ("ownerId",name,slug,"slugIsCustom",category,description,"documentType",cnpj,cpf,website,address,"cityState",city,state,phone,
         "verificationStatus","isVerified","socialInstagram","socialLinkedin","socialFacebook","logoURL","documentURL")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`, [
            ownerUserId,
            name,
            slug,
            Boolean(requestedSlug),
            category,
            this.nullText(input.description, 10000),
            this.text(input.documentType, 20) || 'CNPJ',
            this.nullText(input.cnpj, 40),
            this.nullText(input.cpf, 40),
            this.nullText(input.website, 1000),
            this.nullText(input.address, 1000),
            city && state ? `${city}, ${state}` : city,
            city,
            state,
            this.nullText(input.phone, 60),
            verificationStatus,
            verificationStatus === 'VERIFIED',
            this.nullText(input.socialInstagram, 500),
            this.nullText(input.socialLinkedin, 500),
            this.nullText(input.socialFacebook, 500),
            this.nullText(input.logoURL, 2000),
            this.nullText(input.documentURL, 2000),
        ]);
        return { ...rows[0], managedBy: actor };
    }
    async companyUpdate(id, input) {
        const existing = await this.dataSource.query('SELECT * FROM companies WHERE id=$1 LIMIT 1', [id]);
        if (!existing[0])
            throw new common_1.NotFoundException('Empresa não encontrada.');
        const fields = [];
        const values = [];
        const push = (column, value) => {
            values.push(value);
            fields.push(`${column}=$${values.length}`);
        };
        if (input.name !== undefined) {
            const name = this.text(input.name, 240);
            if (!name)
                throw new common_1.BadRequestException('Nome da empresa não pode ficar vazio.');
            push('name', name);
        }
        const textFields = [
            ['description', 'description', 10000], ['documentType', '"documentType"', 20], ['cnpj', 'cnpj', 40], ['cpf', 'cpf', 40],
            ['website', 'website', 1000], ['address', 'address', 1000], ['phone', 'phone', 60], ['socialInstagram', '"socialInstagram"', 500],
            ['socialLinkedin', '"socialLinkedin"', 500], ['socialFacebook', '"socialFacebook"', 500], ['logoURL', '"logoURL"', 2000], ['documentURL', '"documentURL"', 2000],
            ['rejectionReason', '"rejectionReason"', 4000],
        ];
        for (const [key, column, max] of textFields) {
            if (input[key] !== undefined)
                push(column, this.nullText(input[key], max));
        }
        if (input.category !== undefined) {
            const category = String(input.category || '').toUpperCase();
            if (!COMPANY_CATEGORIES.has(category))
                throw new common_1.BadRequestException('Categoria inválida.');
            push('category', category);
        }
        if (input.verificationStatus !== undefined) {
            const status = String(input.verificationStatus || '').toUpperCase();
            if (!COMPANY_STATUSES.has(status))
                throw new common_1.BadRequestException('Status de verificação inválido.');
            push('"verificationStatus"', status);
            push('"isVerified"', status === 'VERIFIED');
        }
        if (input.city !== undefined || input.state !== undefined) {
            const city = input.city !== undefined ? this.text(input.city, 120) || null : existing[0].city;
            const state = input.state !== undefined ? this.uf(input.state) : existing[0].state;
            push('city', city);
            push('state', state);
            push('"cityState"', city && state ? `${city}, ${state}` : city);
        }
        if (input.slug !== undefined) {
            const desired = this.validSlug(input.slug);
            if (desired !== existing[0].slug) {
                await this.assertCompanySlugAvailable(desired, id);
                if (existing[0].slug) {
                    await this.dataSource.query(`INSERT INTO company_slug_aliases ("companyId",slug,"replacedBySlug","expiresAt","rollbackAvailable","rollbackUsed","createdById")
             VALUES ($1,$2,$3,now()+interval '90 days',true,false,$4)
             ON CONFLICT (slug) DO UPDATE SET "companyId"=EXCLUDED."companyId","replacedBySlug"=EXCLUDED."replacedBySlug","expiresAt"=EXCLUDED."expiresAt","rollbackAvailable"=true,"rollbackUsed"=false,"createdById"=EXCLUDED."createdById"`, [id, existing[0].slug, desired, 'mcp-admin']).catch(() => undefined);
                }
                push('slug', desired);
                push('"slugIsCustom"', true);
                push('"pendingSlug"', null);
                push('"slugChangeStatus"', 'APPROVED');
            }
        }
        if (!fields.length)
            return existing[0];
        values.push(id);
        const rows = await this.dataSource.query(`UPDATE companies SET ${fields.join(',')},"updatedAt"=now() WHERE id=$${values.length} RETURNING *`, values);
        return rows[0];
    }
    async companyAccessQueue() {
        return this.dataSource.query(`
      SELECT r.*,c.name AS "companyName"
      FROM company_access_requests r
      LEFT JOIN companies c ON c.id=r."companyId"
      WHERE r.status='PENDING'
      ORDER BY r."createdAt" ASC LIMIT 300
    `);
    }
    async companyAccessDecide(actor, id, decisionRaw, roleRaw, noteRaw) {
        const decision = String(decisionRaw || '').trim().toUpperCase();
        if (!['APPROVE', 'REJECT'].includes(decision))
            throw new common_1.BadRequestException('decision deve ser APPROVE ou REJECT.');
        const role = String(roleRaw || 'MEMBER').trim().toUpperCase();
        if (!['MEMBER', 'ADMIN'].includes(role))
            throw new common_1.BadRequestException('role deve ser MEMBER ou ADMIN.');
        return this.dataSource.transaction(async (manager) => {
            const requests = await manager.query(`SELECT * FROM company_access_requests WHERE id=$1 AND status='PENDING' FOR UPDATE`, [id]);
            const request = requests[0];
            if (!request)
                throw new common_1.NotFoundException('Solicitação não encontrada ou já processada.');
            if (decision === 'APPROVE') {
                const companies = await manager.query('SELECT id,name FROM companies WHERE id=$1 LIMIT 1', [request.companyId]);
                if (!companies[0])
                    throw new common_1.NotFoundException('Empresa não encontrada.');
                await manager.query(`UPDATE users SET type='COMPANY',"companyId"=$2,"companyName"=$3,"isCompanyAdmin"=$4,status='ACTIVE',"updatedAt"=now() WHERE id=$1`, [request.userId, request.companyId, companies[0].name, role === 'ADMIN']);
            }
            const rows = await manager.query(`UPDATE company_access_requests SET status=$2,"reviewedById"=$3,"reviewNote"=$4,"updatedAt"=now() WHERE id=$1 RETURNING *`, [id, decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', actor, this.nullText(noteRaw, 1000)]);
            return rows[0];
        });
    }
    async companySlugDecide(actor, companyId, decisionRaw, noteRaw) {
        const decision = String(decisionRaw || '').trim().toUpperCase();
        if (!['APPROVE', 'REJECT'].includes(decision))
            throw new common_1.BadRequestException('decision deve ser APPROVE ou REJECT.');
        const companies = await this.dataSource.query(`SELECT * FROM companies WHERE id=$1 AND "pendingSlug" IS NOT NULL AND "slugChangeStatus"='PENDING' LIMIT 1`, [companyId]);
        const company = companies[0];
        if (!company)
            throw new common_1.BadRequestException('A empresa não possui alteração de URL pendente.');
        if (decision === 'REJECT') {
            const rows = await this.dataSource.query(`UPDATE companies SET "pendingSlug"=NULL,"slugChangeStatus"='REJECTED',"slugChangeReviewedAt"=now(),"slugChangeReviewedById"=$2,"slugChangeReviewNote"=$3,"updatedAt"=now() WHERE id=$1 RETURNING *`, [companyId, actor, this.nullText(noteRaw, 1000)]);
            return rows[0];
        }
        const approved = this.validSlug(company.pendingSlug);
        await this.assertCompanySlugAvailable(approved, companyId);
        if (company.slug) {
            await this.dataSource.query(`INSERT INTO company_slug_aliases ("companyId",slug,"replacedBySlug","expiresAt","rollbackAvailable","rollbackUsed","createdById")
         VALUES ($1,$2,$3,now()+interval '90 days',true,false,$4)
         ON CONFLICT (slug) DO UPDATE SET "companyId"=EXCLUDED."companyId","replacedBySlug"=EXCLUDED."replacedBySlug","expiresAt"=EXCLUDED."expiresAt","rollbackAvailable"=true,"rollbackUsed"=false,"createdById"=EXCLUDED."createdById"`, [companyId, company.slug, approved, actor]).catch(() => undefined);
        }
        const rows = await this.dataSource.query(`UPDATE companies SET slug=$2,"slugIsCustom"=true,"pendingSlug"=NULL,"slugChangeStatus"='APPROVED',"slugChangeReviewedAt"=now(),"slugChangeReviewedById"=$3,"slugChangeReviewNote"=$4,"updatedAt"=now() WHERE id=$1 RETURNING *`, [companyId, approved, actor, this.nullText(noteRaw, 1000)]);
        return rows[0];
    }
    companyPlanGet(companyId) {
        return this.companyPlans.get(companyId);
    }
    companyPlanSet(actor, companyId, plan, currentPeriodEnd) {
        return this.companyPlans.set(companyId, plan, currentPeriodEnd, actor);
    }
    async usersList(input = {}) {
        const q = this.text(input.q, 160);
        const status = String(input.status || '').trim().toUpperCase();
        if (status && !['ACTIVE', 'SUSPENDED', 'BLOCKED'].includes(status))
            throw new common_1.BadRequestException('Status de usuário inválido.');
        const limit = Math.min(200, Math.max(1, Math.round(Number(input.limit || 50))));
        const params = [];
        const where = [];
        if (q) {
            params.push(`%${q.replace(/[%_]/g, '')}%`);
            where.push(`(email ILIKE $${params.length} OR "displayName" ILIKE $${params.length} OR "fullName" ILIKE $${params.length} OR "socialName" ILIKE $${params.length})`);
        }
        if (status) {
            params.push(status);
            where.push(`status=$${params.length}`);
        }
        params.push(limit);
        return this.dataSource.query(`SELECT id,email,"displayName","fullName","socialName",type,"companyId","isCompanyAdmin","isVerified",status,"createdAt","updatedAt"
       FROM users ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY "createdAt" DESC LIMIT $${params.length}`, params);
    }
    async userGet(id) {
        const users = await this.dataSource.query(`SELECT id,email,"displayName","fullName","socialName",phone,bio,type,"companyId","companyName","isCompanyAdmin","isVerified",status,city,state,"createdAt","updatedAt"
       FROM users WHERE id=$1 LIMIT 1`, [id]);
        if (!users[0])
            throw new common_1.NotFoundException('Usuário não encontrado.');
        const [sanctions, security] = await Promise.all([
            this.dataSource.query(`SELECT id,type,reason,status,"expiresAt","createdAt" FROM user_sanctions WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 100`, [id]),
            this.dataSource.query(`SELECT count(*)::int AS accesses,count(DISTINCT "deviceHash")::int AS devices,count(*) FILTER (WHERE "isNewDevice"=true)::int AS "newDeviceEvents",max("createdAt") AS "lastAccessAt"
         FROM account_accesses WHERE "userId"=$1`, [id]).catch(() => []),
        ]);
        return { user: users[0], sanctions, security: security[0] || null };
    }
    async userModerate(id, input) {
        const fields = [];
        const values = [];
        if (input.status !== undefined) {
            const status = String(input.status || '').trim().toUpperCase();
            if (!['ACTIVE', 'SUSPENDED', 'BLOCKED'].includes(status))
                throw new common_1.BadRequestException('Status inválido.');
            values.push(status);
            fields.push(`status=$${values.length}`);
        }
        if (input.isVerified !== undefined) {
            if (typeof input.isVerified !== 'boolean')
                throw new common_1.BadRequestException('isVerified deve ser booleano.');
            values.push(input.isVerified);
            fields.push(`"isVerified"=$${values.length}`);
        }
        if (!fields.length)
            return this.userGet(id);
        values.push(id);
        const rows = await this.dataSource.query(`UPDATE users SET ${fields.join(',')},"updatedAt"=now() WHERE id=$${values.length} RETURNING id,email,status,"isVerified","updatedAt"`, values);
        if (!rows[0])
            throw new common_1.NotFoundException('Usuário não encontrado.');
        return rows[0];
    }
    async userSanction(actor, userId, input) {
        const exists = await this.dataSource.query('SELECT id FROM users WHERE id=$1 LIMIT 1', [userId]);
        if (!exists[0])
            throw new common_1.NotFoundException('Usuário não encontrado.');
        const type = this.text(input.type, 40);
        const reason = this.text(input.reason, 3000);
        if (!type || !reason)
            throw new common_1.BadRequestException('Tipo e motivo são obrigatórios.');
        const expiresAt = input.expiresAt ? new Date(String(input.expiresAt)) : null;
        if (expiresAt && Number.isNaN(expiresAt.getTime()))
            throw new common_1.BadRequestException('Data de expiração inválida.');
        const rows = await this.dataSource.query(`INSERT INTO user_sanctions ("userId","createdById",type,reason,status,"expiresAt") VALUES ($1,$2,$3,$4,'ACTIVE',$5) RETURNING *`, [userId, actor, type, reason, expiresAt]);
        return rows[0];
    }
    feeRules(kind) {
        return this.listFeeRules(this.feeTable(kind));
    }
    feePlanSet(kind, plan, input) {
        return this.saveFeePlan(this.feeTable(kind), plan, input);
    }
    feeCompanySet(kind, companyId, input) {
        return this.saveFeeCompany(this.feeTable(kind), companyId, input);
    }
    async feeCompanyRemove(kind, companyId) {
        const table = this.feeTable(kind);
        const rows = await this.dataSource.query(`DELETE FROM ${table} WHERE scope='COMPANY' AND "companyId"=$1 RETURNING id`, [companyId]);
        return { removed: Boolean(rows[0]?.id) };
    }
    adsList() {
        return this.dataSource.query(`SELECT * FROM advertisements ORDER BY "createdAt" DESC LIMIT 500`);
    }
    async adCreate(input) {
        const title = this.text(input.title, 120);
        const type = String(input.type || '').trim();
        const imageURL = this.text(input.imageURL, 2000);
        const link = this.text(input.link, 2000);
        if (!title || !AD_TYPES.has(type) || !imageURL || !link)
            throw new common_1.BadRequestException('Título, tipo, imagem e link válidos são obrigatórios.');
        const owner = await this.normalizeAdOwner(input);
        const startsAt = this.dateOrNull(input.startsAt, 'Data inicial inválida.');
        const endsAt = this.dateOrNull(input.endsAt, 'Data final inválida.');
        if (startsAt && endsAt && endsAt <= startsAt)
            throw new common_1.BadRequestException('A data final deve ficar depois da inicial.');
        const rows = await this.dataSource.query(`INSERT INTO advertisements (title,type,description,"imageURL",link,"companyId","contractedByUserId",price,"billingPeriod","startsAt","endsAt",active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [title, type, this.nullText(input.description, 5000), imageURL, link, owner.companyId, owner.contractedByUserId, this.moneyOrNull(input.price), this.nullText(input.billingPeriod, 20), startsAt, endsAt, input.active !== false]);
        return rows[0];
    }
    async adUpdate(id, input) {
        const existingRows = await this.dataSource.query('SELECT * FROM advertisements WHERE id=$1 LIMIT 1', [id]);
        const existing = existingRows[0];
        if (!existing)
            throw new common_1.NotFoundException('Anúncio não encontrado.');
        const fields = [];
        const values = [];
        const push = (column, value) => { values.push(value); fields.push(`${column}=$${values.length}`); };
        if (input.title !== undefined) {
            const title = this.text(input.title, 120);
            if (!title)
                throw new common_1.BadRequestException('Título inválido.');
            push('title', title);
        }
        if (input.type !== undefined) {
            const type = String(input.type || '').trim();
            if (!AD_TYPES.has(type))
                throw new common_1.BadRequestException('Tipo de anúncio inválido.');
            push('type', type);
        }
        for (const [key, column, max] of [
            ['description', 'description', 5000], ['imageURL', '"imageURL"', 2000], ['link', 'link', 2000], ['billingPeriod', '"billingPeriod"', 20],
        ]) {
            if (input[key] !== undefined)
                push(column, this.nullText(input[key], max));
        }
        if (input.price !== undefined)
            push('price', this.moneyOrNull(input.price));
        if (input.active !== undefined) {
            if (typeof input.active !== 'boolean')
                throw new common_1.BadRequestException('active deve ser booleano.');
            push('active', input.active);
        }
        if (input.startsAt !== undefined)
            push('"startsAt"', this.dateOrNull(input.startsAt, 'Data inicial inválida.'));
        if (input.endsAt !== undefined)
            push('"endsAt"', this.dateOrNull(input.endsAt, 'Data final inválida.'));
        if (input.companyId !== undefined || input.contractedByUserId !== undefined) {
            const owner = await this.normalizeAdOwner(input, existing);
            push('"companyId"', owner.companyId);
            push('"contractedByUserId"', owner.contractedByUserId);
        }
        if (!fields.length)
            return existing;
        values.push(id);
        const rows = await this.dataSource.query(`UPDATE advertisements SET ${fields.join(',')},"updatedAt"=now() WHERE id=$${values.length} RETURNING *`, values);
        return rows[0];
    }
    async advertisingConfigGet() {
        const rows = await this.dataSource.query('SELECT * FROM advertising_config WHERE id=$1 LIMIT 1', ['default']).catch(() => []);
        return rows[0] || { id: 'default', googleAdsEnabled: false, googleAdsClient: null, googleAdsSlotLeaderboard: null, googleAdsSlotRectangle: null };
    }
    async advertisingConfigSet(input) {
        const values = [
            input.googleAdsEnabled === true,
            this.nullText(input.googleAdsClient, 300),
            this.nullText(input.googleAdsSlotLeaderboard, 300),
            this.nullText(input.googleAdsSlotRectangle, 300),
        ];
        const rows = await this.dataSource.query(`INSERT INTO advertising_config (id,"googleAdsEnabled","googleAdsClient","googleAdsSlotLeaderboard","googleAdsSlotRectangle")
       VALUES ('default',$1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET "googleAdsEnabled"=EXCLUDED."googleAdsEnabled","googleAdsClient"=EXCLUDED."googleAdsClient","googleAdsSlotLeaderboard"=EXCLUDED."googleAdsSlotLeaderboard","googleAdsSlotRectangle"=EXCLUDED."googleAdsSlotRectangle","updatedAt"=now()
       RETURNING *`, values);
        return rows[0];
    }
    paymentsSummary() { return this.payments.paymentSummary(); }
    paymentsPerformance() { return this.payments.productPerformance(); }
    paymentsList(limit = 200) { return this.payments.listAllPayments(Math.min(500, Math.max(1, Math.round(Number(limit || 200))))); }
    paymentConfirm(actor, id) { return this.payments.confirmPayment(id, { confirmedByAdmin: actor, confirmationMode: 'ADMIN_MANUAL' }); }
    paymentSimulate(actor, id) { return this.payments.simulatePayment(id, actor); }
    paymentProducts() { return this.payments.listCatalog(true); }
    paymentProductUpdate(code, input) { return this.payments.updateProduct(code, input || {}); }
    paymentProductDurationSet(code, durationDays) { return this.productDuration.update(code, Number(durationDays)); }
    paymentDevModeGet() { return this.payments.getDevMode(); }
    paymentDevModeSet(enabled) {
        if (typeof enabled !== 'boolean')
            throw new common_1.BadRequestException('enabled deve ser booleano.');
        return this.payments.setDevMode(enabled);
    }
    billingUsersSearch(q = '', limit = 30) { return this.billing.searchUsers(q, Math.min(100, Math.max(1, Number(limit || 30)))); }
    billingUserGet(userId) { return this.billing.getUserSupport(userId); }
    billingLifetimeSet(actor, userId, enabled, note) { return this.billing.setLifetimeFree(userId, enabled === true, actor, this.nullText(note, 2000) || undefined); }
    billingCreditSet(actor, userId, featureRaw, quantity, note) {
        const feature = String(featureRaw || '').toUpperCase();
        if (!BILLING_FEATURES.has(feature))
            throw new common_1.BadRequestException('Recurso de crédito inválido.');
        return this.billing.setCreditBalance(userId, feature, Number(quantity || 0), actor, this.nullText(note, 2000) || undefined);
    }
    billingEntitlementGrant(actor, userId, featureRaw, durationDays, note) {
        const feature = String(featureRaw || '').toUpperCase();
        if (!TIMED_FEATURES.has(feature))
            throw new common_1.BadRequestException('Benefício temporário inválido.');
        return this.billing.grantTimedFeature(userId, feature, Number(durationDays || 30), actor, this.nullText(note, 2000) || undefined);
    }
    billingEntitlementRevoke(actor, userId, featureRaw, note) {
        const feature = String(featureRaw || '').toUpperCase();
        if (!TIMED_FEATURES.has(feature))
            throw new common_1.BadRequestException('Benefício temporário inválido.');
        return this.billing.revokeTimedFeature(userId, feature, actor, this.nullText(note, 2000) || undefined);
    }
    subscriptionActivate(actor, userId, productCode, durationDays, note) {
        return this.billing.activateSubscription(userId, String(productCode || 'PREMIUM_MONTHLY'), actor, durationDays == null ? undefined : Number(durationDays), this.nullText(note, 2000) || undefined);
    }
    subscriptionStatusSet(actor, userId, subscriptionId, statusRaw) {
        const status = String(statusRaw || '').toUpperCase();
        if (!['ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'].includes(status))
            throw new common_1.BadRequestException('Status de assinatura inválido.');
        return this.billing.setSubscriptionStatus(userId, subscriptionId, status, actor);
    }
    paymentProvidersList() { return this.paymentProviders.list(); }
    paymentProviderRoutes() { return this.paymentProviders.routes(); }
    paymentVaultStatus() { return this.paymentProviders.vaultStatus(); }
    paymentProviderGet(code) { return this.paymentProviders.get(code); }
    paymentProviderTest(actor, code) { return this.paymentProviders.test(code, actor); }
    paymentProviderActivate(actor, code, paymentType) { return this.paymentProviders.activate(code, paymentType, actor); }
    paymentProviderDeactivate(actor, paymentType) { return this.paymentProviders.deactivate(paymentType, actor); }
    aiBehaviorGet() { return this.settings.getAiBehavior(); }
    aiBehaviorSet(input) { return this.settings.saveAiBehavior(input || {}); }
    aiBrainList(q) { return this.settings.listAiBrain(q); }
    aiBrainCreate(input) { return this.settings.createAiBrain(input || {}); }
    aiBrainUpdate(id, input) { return this.settings.updateAiBrain(id, input || {}); }
    aiBrainDelete(id) { return this.settings.deleteAiBrain(id); }
    feeTable(kind) {
        return kind === 'auction' ? 'classified_auction_fee_rules' : 'classified_commerce_fee_rules';
    }
    async listFeeRules(table) {
        const rows = await this.dataSource.query(`SELECT r.*,c.name AS "companyName" FROM ${table} r LEFT JOIN companies c ON c.id=r."companyId"
       ORDER BY CASE r.scope WHEN 'PLAN' THEN 0 ELSE 1 END,CASE r.plan WHEN 'FREE' THEN 0 WHEN 'PLUS' THEN 1 WHEN 'ELITE' THEN 2 ELSE 3 END,c.name NULLS LAST`).catch(() => []);
        return rows.map((row) => this.presentFeeRule(row));
    }
    async saveFeePlan(table, planRaw, input) {
        const plan = this.plan(planRaw);
        const rule = this.cleanFeeRule(input);
        const rows = await this.dataSource.query(`INSERT INTO ${table} (scope,plan,"companyId","rateBps","minimumFeeCents","maximumFeeCents",enabled,"updatedAt")
       VALUES ('PLAN',$1,NULL,$2,$3,$4,$5,now())
       ON CONFLICT (plan) WHERE scope='PLAN' DO UPDATE SET "rateBps"=EXCLUDED."rateBps","minimumFeeCents"=EXCLUDED."minimumFeeCents","maximumFeeCents"=EXCLUDED."maximumFeeCents",enabled=EXCLUDED.enabled,"updatedAt"=now()
       RETURNING *`, [plan, rule.rateBps, rule.minimumFeeCents, rule.maximumFeeCents, rule.enabled]);
        return this.presentFeeRule(rows[0]);
    }
    async saveFeeCompany(table, companyId, input) {
        const companies = await this.dataSource.query('SELECT id,name FROM companies WHERE id=$1 LIMIT 1', [companyId]);
        if (!companies[0])
            throw new common_1.NotFoundException('Empresa não encontrada.');
        const rule = this.cleanFeeRule(input);
        const rows = await this.dataSource.query(`INSERT INTO ${table} (scope,plan,"companyId","rateBps","minimumFeeCents","maximumFeeCents",enabled,"updatedAt")
       VALUES ('COMPANY',NULL,$1,$2,$3,$4,$5,now())
       ON CONFLICT ("companyId") WHERE scope='COMPANY' DO UPDATE SET "rateBps"=EXCLUDED."rateBps","minimumFeeCents"=EXCLUDED."minimumFeeCents","maximumFeeCents"=EXCLUDED."maximumFeeCents",enabled=EXCLUDED.enabled,"updatedAt"=now()
       RETURNING *`, [companyId, rule.rateBps, rule.minimumFeeCents, rule.maximumFeeCents, rule.enabled]);
        return this.presentFeeRule({ ...rows[0], companyName: companies[0].name });
    }
    cleanFeeRule(input) {
        const percentage = Number(String(input.percentage ?? '').replace(',', '.'));
        if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100)
            throw new common_1.BadRequestException('A porcentagem deve ficar entre 0% e 100%.');
        const minimumFeeCents = this.cents(input.minimumFeeCents, 'Taxa mínima inválida.');
        const maximumFeeCents = input.maximumFeeCents === null || input.maximumFeeCents === undefined || input.maximumFeeCents === '' ? null : this.cents(input.maximumFeeCents, 'Teto máximo inválido.');
        if (maximumFeeCents !== null && maximumFeeCents < minimumFeeCents)
            throw new common_1.BadRequestException('O teto máximo não pode ser menor que a taxa mínima.');
        return { rateBps: Math.round(percentage * 100), minimumFeeCents, maximumFeeCents, enabled: input.enabled !== false };
    }
    presentFeeRule(row) {
        return {
            id: row.id, scope: row.scope, plan: row.plan || null, companyId: row.companyId || null,
            companyName: row.companyName || null, rateBps: Number(row.rateBps || 0), percentage: Number(row.rateBps || 0) / 100,
            minimumFeeCents: Number(row.minimumFeeCents || 0), maximumFeeCents: row.maximumFeeCents == null ? null : Number(row.maximumFeeCents),
            enabled: row.enabled !== false, updatedAt: row.updatedAt || null,
        };
    }
    plan(value) {
        const plan = String(value || '').toUpperCase();
        if (!['FREE', 'PLUS', 'ELITE'].includes(plan))
            throw new common_1.BadRequestException('Plano inválido.');
        return plan;
    }
    cents(value, message) {
        const n = Number(value ?? 0);
        if (!Number.isFinite(n) || n < 0 || n > 100_000_000)
            throw new common_1.BadRequestException(message);
        return Math.round(n);
    }
    async normalizeAdOwner(input, current) {
        const companyId = input.companyId === undefined ? current?.companyId || null : this.nullText(input.companyId, 160);
        const contractedByUserId = input.contractedByUserId === undefined ? current?.contractedByUserId || null : this.nullText(input.contractedByUserId, 160);
        if (companyId && contractedByUserId)
            throw new common_1.BadRequestException('Selecione empresa ou usuário responsável, não ambos.');
        if (!companyId && !contractedByUserId)
            throw new common_1.BadRequestException('Informe empresa ou usuário responsável.');
        if (companyId) {
            const rows = await this.dataSource.query('SELECT id FROM companies WHERE id=$1 LIMIT 1', [companyId]);
            if (!rows[0])
                throw new common_1.NotFoundException('Empresa responsável não encontrada.');
        }
        if (contractedByUserId) {
            const rows = await this.dataSource.query('SELECT id FROM users WHERE id=$1 LIMIT 1', [contractedByUserId]);
            if (!rows[0])
                throw new common_1.NotFoundException('Usuário responsável não encontrado.');
        }
        return { companyId, contractedByUserId };
    }
    text(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
    nullText(value, max) { const text = this.text(value, max); return text || null; }
    uf(value) {
        const state = this.text(value, 2).toUpperCase();
        if (!state)
            return null;
        if (!VALID_UFS.has(state))
            throw new common_1.BadRequestException('UF inválida.');
        return state;
    }
    dateOrNull(value, message) {
        if (value === null || value === undefined || String(value).trim() === '')
            return null;
        const date = new Date(String(value));
        if (Number.isNaN(date.getTime()))
            throw new common_1.BadRequestException(message);
        return date;
    }
    moneyOrNull(value) {
        if (value === null || value === undefined || String(value).trim() === '')
            return null;
        const n = Number(String(value).replace(',', '.'));
        if (!Number.isFinite(n) || n < 0 || n > 100_000_000)
            throw new common_1.BadRequestException('Valor financeiro inválido.');
        return n.toFixed(2);
    }
    validSlug(value) {
        try {
            return (0, seo_utils_1.validateCompanySlug)(String(value || ''));
        }
        catch (error) {
            throw new common_1.BadRequestException(error instanceof Error ? error.message : 'URL pública inválida.');
        }
    }
    async nextCompanySlug(value) {
        const base = (0, seo_utils_1.slugify)(value) || 'empresa';
        for (let suffix = 1; suffix < 10_000; suffix += 1) {
            const slug = suffix === 1 ? base : `${base}-${suffix}`;
            try {
                await this.assertCompanySlugAvailable(slug);
                return slug;
            }
            catch { }
        }
        throw new common_1.BadRequestException('Não foi possível reservar URL pública para a empresa.');
    }
    async assertCompanySlugAvailable(slug, companyId) {
        const rows = await this.dataSource.query(`SELECT id FROM companies WHERE (slug=$1 OR "pendingSlug"=$1) AND ($2::uuid IS NULL OR id<>$2::uuid) LIMIT 1`, [slug, companyId || null]);
        if (rows[0])
            throw new common_1.BadRequestException('Este endereço público já está em uso ou aguardando aprovação.');
        const aliases = await this.dataSource.query(`SELECT "companyId" FROM company_slug_aliases WHERE slug=$1 AND "expiresAt">now() LIMIT 1`, [slug]).catch(() => []);
        if (aliases[0] && aliases[0].companyId !== companyId)
            throw new common_1.BadRequestException('Este endereço está reservado temporariamente.');
    }
};
exports.McpManagementService = McpManagementService;
exports.McpManagementService = McpManagementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        registration_service_1.RegistrationService,
        settings_service_1.SettingsService,
        company_plans_admin_service_1.CompanyPlansAdminService,
        payments_service_1.PaymentsService,
        billing_support_service_1.BillingSupportService,
        product_duration_service_1.ProductDurationService,
        payment_provider_manager_service_1.PaymentProviderManagerService])
], McpManagementService);
//# sourceMappingURL=mcp-management.service.js.map