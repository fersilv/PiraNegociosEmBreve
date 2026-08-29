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
exports.JobMatchAdminService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const job_entity_1 = require("../jobs/entities/job.entity");
const job_match_service_1 = require("./job-match.service");
let JobMatchAdminService = class JobMatchAdminService {
    jobs;
    dataSource;
    jobMatch;
    constructor(jobs, dataSource, jobMatch) {
        this.jobs = jobs;
        this.dataSource = dataSource;
        this.jobMatch = jobMatch;
    }
    async overview() {
        const rows = await this.dataSource.query(`SELECT
        count(*) FILTER (WHERE j.active = true)::int AS active,
        count(*) FILTER (WHERE j.active = true AND p.status = 'READY' AND p."algorithmVersion" = $1)::int AS ready,
        count(*) FILTER (WHERE j.active = true AND p.status = 'PENDING')::int AS pending,
        count(*) FILTER (WHERE j.active = true AND p.status = 'ERROR')::int AS error,
        count(*) FILTER (WHERE j.active = true AND (p."jobId" IS NULL OR p."algorithmVersion" <> $1))::int AS missing
       FROM jobs j
       LEFT JOIN job_match_profiles p ON p."jobId" = j.id`, [job_match_service_1.JOB_MATCH_ALGORITHM_VERSION]);
        const result = rows[0] || { active: 0, ready: 0, pending: 0, error: 0, missing: 0 };
        return {
            ...result,
            toPrepare: Number(result.error || 0) + Number(result.missing || 0),
        };
    }
    async updateConfig(input) {
        const durationDays = Math.round(Number(input?.durationDays));
        if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 365) {
            throw new common_1.BadRequestException('A duração do Match deve ficar entre 1 e 365 dias.');
        }
        const rows = await this.dataSource.query(`UPDATE payment_products SET "durationDays" = $1, "updatedAt" = now()
       WHERE code = 'JOB_MATCH_30D' RETURNING *`, [durationDays]);
        if (!rows[0])
            throw new common_1.BadRequestException('O produto Match Inteligente ainda não foi criado.');
        return rows[0];
    }
    async backfillQueue(limit = 100) {
        const safeLimit = Math.min(500, Math.max(1, Math.round(limit || 100)));
        return this.dataSource.query(`SELECT
         j.id, j.title, j."companyName", j."sourceName", j.city, j.state,
         p.status, p.error, p."updatedAt" AS "profileUpdatedAt"
       FROM jobs j
       LEFT JOIN job_match_profiles p ON p."jobId" = j.id
       WHERE j.active = true
         AND (p."jobId" IS NULL OR p.status = 'ERROR' OR p."algorithmVersion" <> $1)
       ORDER BY j."createdAt" DESC
       LIMIT $2`, [job_match_service_1.JOB_MATCH_ALGORITHM_VERSION, safeLimit]);
    }
    async prepareOne(jobId) {
        const job = await this.jobs.findOne({ where: { id: jobId } });
        if (!job)
            throw new common_1.NotFoundException('Vaga não encontrada.');
        if (!job.active)
            throw new common_1.BadRequestException('Somente vagas ativas podem ser preparadas para o Match.');
        const result = await this.jobMatch.reanalyzeJob(jobId);
        const profileRows = await this.dataSource.query(`SELECT status, error, "analyzedAt", "updatedAt" FROM job_match_profiles WHERE "jobId" = $1 LIMIT 1`, [jobId]);
        const profile = profileRows[0] || null;
        return {
            jobId,
            title: job.title,
            success: Boolean(result && profile?.status === 'READY'),
            status: profile?.status || 'ERROR',
            error: profile?.error || null,
        };
    }
    async backfill(limit = 25) {
        const queue = await this.backfillQueue(Math.min(100, Math.max(1, Math.round(limit || 25))));
        let succeeded = 0;
        let failed = 0;
        const errors = [];
        for (const item of queue) {
            const result = await this.prepareOne(item.id);
            if (result.success)
                succeeded += 1;
            else {
                failed += 1;
                errors.push({ jobId: item.id, title: item.title, error: result.error });
            }
        }
        return {
            processed: queue.length,
            attempted: queue.length,
            succeeded,
            failed,
            errors,
            overview: await this.overview(),
        };
    }
};
exports.JobMatchAdminService = JobMatchAdminService;
exports.JobMatchAdminService = JobMatchAdminService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(job_entity_1.Job)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource,
        job_match_service_1.JobMatchService])
], JobMatchAdminService);
//# sourceMappingURL=job-match-admin.service.js.map