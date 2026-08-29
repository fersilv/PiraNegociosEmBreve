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
exports.CompanyContextRepairService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let CompanyContextRepairService = class CompanyContextRepairService {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async repair(uid) {
        const users = await this.dataSource.query(`SELECT id,"companyId","isCompanyAdmin" FROM users WHERE id=$1 LIMIT 1`, [uid]);
        const user = users[0];
        if (!user)
            return null;
        let company = null;
        let membership = null;
        if (user.companyId) {
            company = (await this.dataSource.query(`SELECT id,name,"ownerId" FROM companies WHERE id=$1 LIMIT 1`, [user.companyId]))[0] || null;
            if (company) {
                membership = (await this.dataSource.query(`SELECT role,permissions,status,"isPartner" FROM company_memberships WHERE "companyId"=$1 AND "userId"=$2 LIMIT 1`, [company.id, uid]).catch(() => []))[0] || null;
            }
        }
        if (!company) {
            company = (await this.dataSource.query(`SELECT id,name,"ownerId" FROM companies WHERE "ownerId"=$1 ORDER BY "updatedAt" DESC LIMIT 1`, [uid]))[0] || null;
        }
        if (!company) {
            const rows = await this.dataSource.query(`SELECT c.id,c.name,c."ownerId",m.role,m.permissions,m.status,m."isPartner"
         FROM company_memberships m
         JOIN companies c ON c.id=m."companyId"
         WHERE m."userId"=$1 AND m.status='ACTIVE'
         ORDER BY CASE m.role WHEN 'PRIMARY_ADMIN' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,m."updatedAt" DESC
         LIMIT 1`, [uid]).catch(() => []);
            if (rows[0]) {
                company = rows[0];
                membership = rows[0];
            }
        }
        if (!company)
            return null;
        if (!membership) {
            membership = (await this.dataSource.query(`SELECT role,permissions,status,"isPartner" FROM company_memberships WHERE "companyId"=$1 AND "userId"=$2 LIMIT 1`, [company.id, uid]).catch(() => []))[0] || null;
        }
        const owner = company.ownerId === uid;
        const activeAdmin = membership?.status === 'ACTIVE' && ['PRIMARY_ADMIN', 'ADMIN'].includes(String(membership.role || ''));
        await this.dataSource.query(`UPDATE users
       SET "companyId"=$2,"companyName"=$3,"isCompanyAdmin"=$4,"updatedAt"=now()
       WHERE id=$1`, [uid, company.id, company.name, owner || activeAdmin]);
        return {
            companyId: company.id,
            companyName: company.name,
            owner,
            membership,
        };
    }
};
exports.CompanyContextRepairService = CompanyContextRepairService;
exports.CompanyContextRepairService = CompanyContextRepairService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], CompanyContextRepairService);
//# sourceMappingURL=company-context-repair.service.js.map