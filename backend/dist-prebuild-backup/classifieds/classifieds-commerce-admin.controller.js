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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassifiedsCommerceAdminController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const admin_guard_1 = require("../admin/admin.guard");
const auth_guard_1 = require("../auth/auth.guard");
let ClassifiedsCommerceAdminController = class ClassifiedsCommerceAdminController {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    feeRules() {
        return this.listRules('classified_commerce_fee_rules');
    }
    savePlanRule(planRaw, body) {
        return this.savePlan('classified_commerce_fee_rules', planRaw, body);
    }
    saveCompanyRule(companyId, body) {
        return this.saveCompany('classified_commerce_fee_rules', companyId, body);
    }
    removeCompanyRule(companyId) {
        return this.removeCompany('classified_commerce_fee_rules', companyId);
    }
    auctionFeeRules() {
        return this.listRules('classified_auction_fee_rules');
    }
    saveAuctionPlanRule(planRaw, body) {
        return this.savePlan('classified_auction_fee_rules', planRaw, body);
    }
    saveAuctionCompanyRule(companyId, body) {
        return this.saveCompany('classified_auction_fee_rules', companyId, body);
    }
    removeAuctionCompanyRule(companyId) {
        return this.removeCompany('classified_auction_fee_rules', companyId);
    }
    async companies(queryRaw) {
        const q = String(queryRaw || '').trim();
        if (q.length < 2)
            return [];
        const like = `%${q.replace(/[%_]/g, '')}%`;
        return this.dataSource.query(`SELECT id,name,"verificationStatus","isVerified",city,state
       FROM companies
       WHERE name ILIKE $1 OR cnpj ILIKE $1
       ORDER BY "isVerified" DESC, name ASC LIMIT 30`, [like]);
    }
    async listRules(table) {
        const rows = await this.dataSource.query(`SELECT r.*, c.name AS "companyName"
       FROM ${table} r
       LEFT JOIN companies c ON c.id = r."companyId"
       ORDER BY CASE r.scope WHEN 'PLAN' THEN 0 ELSE 1 END,
                CASE r.plan WHEN 'FREE' THEN 0 WHEN 'PLUS' THEN 1 WHEN 'ELITE' THEN 2 ELSE 3 END,
                c.name NULLS LAST`).catch(() => []);
        return rows.map((row) => this.presentRule(row));
    }
    async savePlan(table, planRaw, body) {
        const plan = this.plan(planRaw);
        const rule = this.cleanRule(body);
        const rows = await this.dataSource.query(`INSERT INTO ${table}
        (scope,plan,"companyId","rateBps","minimumFeeCents","maximumFeeCents",enabled,"updatedAt")
       VALUES ('PLAN',$1,NULL,$2,$3,$4,$5,now())
       ON CONFLICT (plan) WHERE scope = 'PLAN' DO UPDATE SET
         "rateBps"=EXCLUDED."rateBps",
         "minimumFeeCents"=EXCLUDED."minimumFeeCents",
         "maximumFeeCents"=EXCLUDED."maximumFeeCents",
         enabled=EXCLUDED.enabled,
         "updatedAt"=now()
       RETURNING *`, [plan, rule.rateBps, rule.minimumFeeCents, rule.maximumFeeCents, rule.enabled]);
        return this.presentRule(rows[0]);
    }
    async saveCompany(table, companyId, body) {
        const companies = await this.dataSource.query(`SELECT id,name FROM companies WHERE id=$1 LIMIT 1`, [companyId]);
        if (!companies[0])
            throw new common_1.BadRequestException('Empresa não encontrada.');
        const rule = this.cleanRule(body);
        const rows = await this.dataSource.query(`INSERT INTO ${table}
        (scope,plan,"companyId","rateBps","minimumFeeCents","maximumFeeCents",enabled,"updatedAt")
       VALUES ('COMPANY',NULL,$1,$2,$3,$4,$5,now())
       ON CONFLICT ("companyId") WHERE scope = 'COMPANY' DO UPDATE SET
         "rateBps"=EXCLUDED."rateBps",
         "minimumFeeCents"=EXCLUDED."minimumFeeCents",
         "maximumFeeCents"=EXCLUDED."maximumFeeCents",
         enabled=EXCLUDED.enabled,
         "updatedAt"=now()
       RETURNING *`, [companyId, rule.rateBps, rule.minimumFeeCents, rule.maximumFeeCents, rule.enabled]);
        return this.presentRule({ ...rows[0], companyName: companies[0].name });
    }
    async removeCompany(table, companyId) {
        const result = await this.dataSource.query(`DELETE FROM ${table} WHERE scope='COMPANY' AND "companyId"=$1 RETURNING id`, [companyId]);
        return { removed: Boolean(result[0]?.id) };
    }
    cleanRule(body) {
        const percentage = Number(String(body.percentage ?? '').replace(',', '.'));
        if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
            throw new common_1.BadRequestException('A porcentagem deve ficar entre 0% e 100%.');
        }
        const minimumFeeCents = this.cents(body.minimumFeeCents, 'Taxa mínima inválida.');
        const maximumFeeCents = body.maximumFeeCents === null || body.maximumFeeCents === undefined || body.maximumFeeCents === ''
            ? null
            : this.cents(body.maximumFeeCents, 'Teto máximo inválido.');
        if (maximumFeeCents !== null && maximumFeeCents < minimumFeeCents) {
            throw new common_1.BadRequestException('O teto máximo não pode ser menor que a taxa mínima.');
        }
        return {
            rateBps: Math.round(percentage * 100),
            minimumFeeCents,
            maximumFeeCents,
            enabled: body.enabled !== false,
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
    presentRule(row) {
        return {
            id: row.id,
            scope: row.scope,
            plan: row.plan || null,
            companyId: row.companyId || null,
            companyName: row.companyName || null,
            rateBps: row.rateBps == null ? null : Number(row.rateBps),
            percentage: row.rateBps == null ? null : Number(row.rateBps) / 100,
            minimumFeeCents: Number(row.minimumFeeCents || 0),
            maximumFeeCents: row.maximumFeeCents == null ? null : Number(row.maximumFeeCents),
            enabled: row.enabled !== false,
            updatedAt: row.updatedAt || null,
        };
    }
};
exports.ClassifiedsCommerceAdminController = ClassifiedsCommerceAdminController;
__decorate([
    (0, common_1.Get)('fee-rules'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ClassifiedsCommerceAdminController.prototype, "feeRules", null);
__decorate([
    (0, common_1.Patch)('fee-rules/plans/:plan'),
    __param(0, (0, common_1.Param)('plan')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsCommerceAdminController.prototype, "savePlanRule", null);
__decorate([
    (0, common_1.Patch)('fee-rules/companies/:companyId'),
    __param(0, (0, common_1.Param)('companyId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsCommerceAdminController.prototype, "saveCompanyRule", null);
__decorate([
    (0, common_1.Delete)('fee-rules/companies/:companyId'),
    __param(0, (0, common_1.Param)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ClassifiedsCommerceAdminController.prototype, "removeCompanyRule", null);
__decorate([
    (0, common_1.Get)('auction-fee-rules'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ClassifiedsCommerceAdminController.prototype, "auctionFeeRules", null);
__decorate([
    (0, common_1.Patch)('auction-fee-rules/plans/:plan'),
    __param(0, (0, common_1.Param)('plan')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsCommerceAdminController.prototype, "saveAuctionPlanRule", null);
__decorate([
    (0, common_1.Patch)('auction-fee-rules/companies/:companyId'),
    __param(0, (0, common_1.Param)('companyId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsCommerceAdminController.prototype, "saveAuctionCompanyRule", null);
__decorate([
    (0, common_1.Delete)('auction-fee-rules/companies/:companyId'),
    __param(0, (0, common_1.Param)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ClassifiedsCommerceAdminController.prototype, "removeAuctionCompanyRule", null);
__decorate([
    (0, common_1.Get)('companies'),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ClassifiedsCommerceAdminController.prototype, "companies", null);
exports.ClassifiedsCommerceAdminController = ClassifiedsCommerceAdminController = __decorate([
    (0, common_1.Controller)('admin/classifieds-commerce'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], ClassifiedsCommerceAdminController);
//# sourceMappingURL=classifieds-commerce-admin.controller.js.map