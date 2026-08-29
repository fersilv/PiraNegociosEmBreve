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
exports.JobsOperationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const job_entity_1 = require("../jobs/entities/job.entity");
let JobsOperationsService = class JobsOperationsService {
    jobs;
    constructor(jobs) {
        this.jobs = jobs;
    }
    async get(id) {
        return this.requireJob(id);
    }
    async reviewQueue(input) {
        const page = Math.max(1, Number(input.page || 1));
        const pageSize = Math.min(100, Math.max(1, Number(input.pageSize || 30)));
        const query = this.jobs.createQueryBuilder('job');
        if (input.status) {
            query.andWhere('job."reviewStatus" = :status', {
                status: this.requireReviewStatus(input.status),
            });
        }
        else {
            query.andWhere('job."reviewStatus" IN (:...statuses)', {
                statuses: ['PENDING_REVIEW', 'RECHECK_REQUIRED', 'DEACTIVATION_REQUIRED'],
            });
        }
        if (typeof input.active === 'boolean')
            query.andWhere('job.active = :active', { active: input.active });
        if (input.city?.trim())
            query.andWhere('LOWER(job.city) = LOWER(:city)', { city: input.city.trim() });
        if (input.state?.trim())
            query.andWhere('UPPER(job.state) = UPPER(:state)', { state: input.state.trim() });
        query
            .orderBy(`CASE job."reviewStatus"
          WHEN 'DEACTIVATION_REQUIRED' THEN 1
          WHEN 'RECHECK_REQUIRED' THEN 2
          WHEN 'PENDING_REVIEW' THEN 3
          ELSE 4
        END`, 'ASC')
            .addOrderBy('COALESCE(job."reviewedAt", job."lastVerifiedAt", job."createdAt")', 'DESC')
            .skip((page - 1) * pageSize)
            .take(pageSize);
        const [data, total] = await query.getManyAndCount();
        return {
            data,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.max(1, Math.ceil(total / pageSize)),
            },
        };
    }
    async stats() {
        const rows = await this.jobs
            .createQueryBuilder('job')
            .select('job."reviewStatus"', 'reviewStatus')
            .addSelect('COUNT(*)::int', 'count')
            .groupBy('job."reviewStatus"')
            .getRawMany();
        const review = Object.fromEntries(job_entity_1.JOB_REVIEW_STATUSES.map((status) => [status, 0]));
        for (const row of rows)
            review[row.reviewStatus || 'PENDING_REVIEW'] = Number(row.count || 0);
        const [total, active, inactive, flagged, moderationPending] = await Promise.all([
            this.jobs.count(),
            this.jobs.count({ where: { active: true } }),
            this.jobs.count({ where: { active: false } }),
            this.jobs.count({ where: { isFlagged: true } }),
            this.jobs.count({ where: { moderationStatus: 'PENDING' } }),
        ]);
        return { total, active, inactive, flagged, moderationPending, review };
    }
    async setActive(id, active, actor, note) {
        const job = await this.requireJob(id);
        job.active = active;
        job.reviewStatus = active ? 'REVIEWED_OK' : 'RESOLVED';
        job.reviewedAt = new Date();
        job.reviewedBy = this.actor(actor);
        job.reviewNote = this.note(note || (active ? 'Vaga ativada pela integração.' : 'Vaga desativada pela integração.'));
        if (active && job.moderationStatus === 'PENDING')
            job.moderationStatus = 'APPROVED';
        await this.jobs.save(job);
        return job;
    }
    async setReview(id, statusRaw, actor, note) {
        const job = await this.requireJob(id);
        const status = this.requireReviewStatus(statusRaw);
        job.reviewStatus = status;
        job.reviewedAt = new Date();
        job.reviewedBy = this.actor(actor);
        if (note !== undefined)
            job.reviewNote = this.note(note);
        if (status === 'REVIEWED_OK' && job.moderationStatus === 'PENDING') {
            job.moderationStatus = 'APPROVED';
        }
        if (status === 'RESOLVED' && !job.active && job.moderationStatus === 'PENDING') {
            job.moderationStatus = 'APPROVED';
        }
        await this.jobs.save(job);
        return job;
    }
    async flag(id, actor, data) {
        const job = await this.requireJob(id);
        const reason = String(data.reason || 'REVIEW_REQUIRED').trim().slice(0, 120);
        job.isFlagged = true;
        job.flagReason = reason;
        job.flagObservation = this.note(data.observation || 'Sinalizada por integração.');
        job.flaggedAt = new Date();
        job.flaggedBy = this.actor(actor);
        if (reason === 'NOT_FOUND' || reason === 'CLOSED' || reason === 'EXPIRED') {
            job.reviewStatus = job.active ? 'DEACTIVATION_REQUIRED' : 'RESOLVED';
        }
        else {
            job.reviewStatus = 'RECHECK_REQUIRED';
        }
        job.reviewedAt = new Date();
        job.reviewedBy = this.actor(actor);
        await this.jobs.save(job);
        return job;
    }
    async clearFlag(id, actor, note) {
        const job = await this.requireJob(id);
        const keepDeactivation = job.reviewStatus === 'DEACTIVATION_REQUIRED' && job.active;
        job.isFlagged = false;
        job.flagObservation = null;
        job.flagReason = null;
        job.flaggedAt = null;
        job.flaggedBy = null;
        job.reportCount = 0;
        if (job.moderationStatus === 'FLAGGED' || job.moderationStatus === 'PENDING') {
            job.moderationStatus = 'APPROVED';
        }
        job.reviewStatus = keepDeactivation
            ? 'DEACTIVATION_REQUIRED'
            : job.active
                ? 'REVIEWED_OK'
                : 'RESOLVED';
        job.reviewedAt = new Date();
        job.reviewedBy = this.actor(actor);
        job.reviewNote = this.note(note ||
            (keepDeactivation
                ? 'Alerta limpo, mas a vaga ainda exige desativação.'
                : 'Alerta revisado e limpo.'));
        await this.jobs.save(job);
        return job;
    }
    async remove(id) {
        const job = await this.requireJob(id);
        await this.jobs.remove(job);
        return { success: true, id };
    }
    async requireJob(id) {
        const job = await this.jobs.findOne({ where: { id } });
        if (!job)
            throw new common_1.NotFoundException('Vaga não encontrada.');
        return job;
    }
    requireReviewStatus(value) {
        const status = String(value || '').trim().toUpperCase();
        if (!job_entity_1.JOB_REVIEW_STATUSES.includes(status)) {
            throw new common_1.BadRequestException(`reviewStatus inválido. Use: ${job_entity_1.JOB_REVIEW_STATUSES.join(', ')}.`);
        }
        return status;
    }
    actor(value) {
        return String(value || 'integration').trim().slice(0, 160) || 'integration';
    }
    note(value) {
        return String(value || '').trim().slice(0, 4000) || null;
    }
};
exports.JobsOperationsService = JobsOperationsService;
exports.JobsOperationsService = JobsOperationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(job_entity_1.Job)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], JobsOperationsService);
//# sourceMappingURL=jobs-operations.service.js.map