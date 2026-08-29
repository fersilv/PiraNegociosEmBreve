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
exports.ExternalApiController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const job_match_service_1 = require("../job-match/job-match.service");
const api_key_guard_1 = require("./api-key.guard");
const external_jobs_service_1 = require("./external-jobs.service");
let ExternalApiController = class ExternalApiController {
    jobs;
    jobMatch;
    dataSource;
    constructor(jobs, jobMatch, dataSource) {
        this.jobs = jobs;
        this.jobMatch = jobMatch;
        this.dataSource = dataSource;
    }
    matchProfileSchema() {
        return {
            field: 'matchProfile',
            optional: true,
            purpose: 'Permite que uma IA de ingestão envie a ficha estruturada da vaga e evite uma segunda chamada de IA interna quando a ficha for aceita.',
            requiredFields: ['canonicalRole', 'occupationalFamily'],
            requirementTypes: ['SKILL', 'EXPERIENCE', 'EDUCATION', 'CERTIFICATION', 'LICENSE', 'OTHER'],
            schema: {
                canonicalRole: 'string',
                occupationalFamily: 'string',
                occupationKeywords: ['string'],
                technicalSkills: [{ name: 'string', required: 'boolean', weight: 'number 0.1..5', evidenceTerms: ['string'] }],
                requirements: [{ label: 'string', type: 'SKILL|EXPERIENCE|EDUCATION|CERTIFICATION|LICENSE|OTHER', required: 'boolean', weight: 'number 0.1..5', evidenceTerms: ['string'] }],
                softSkills: ['string'],
                summary: 'string',
            },
            example: {
                canonicalRole: 'Operador de Colhedora',
                occupationalFamily: 'Operação de máquinas agrícolas e colheita mecanizada',
                occupationKeywords: ['colhedora', 'máquinas agrícolas', 'colheita mecanizada'],
                technicalSkills: [
                    { name: 'Operação de colhedora', required: true, weight: 2, evidenceTerms: ['colhedora', 'máquina de colheita'] },
                ],
                requirements: [
                    { label: 'Experiência com operação de colhedora', type: 'EXPERIENCE', required: true, weight: 2, evidenceTerms: ['operação de colhedora', 'colheita mecanizada'] },
                ],
                softSkills: ['Trabalho em equipe'],
                summary: 'Perfil para operação segura de colhedoras e apoio à colheita mecanizada.',
            },
            note: 'A ficha descreve a vaga. Ela nunca define score de candidato; a compatibilidade continua sendo calculada internamente contra cada currículo.',
        };
    }
    async matchProfileStatus(ready = 'all', active = 'true', limit = '500', city = '', state = '') {
        const normalizedReady = String(ready || 'all').trim().toLowerCase();
        if (!['true', 'false', 'all'].includes(normalizedReady)) {
            throw new common_1.BadRequestException('ready deve ser true, false ou all.');
        }
        const normalizedActive = String(active || 'true').trim().toLowerCase();
        if (!['true', 'false', 'all'].includes(normalizedActive)) {
            throw new common_1.BadRequestException('active deve ser true, false ou all.');
        }
        const parsedLimit = Math.round(Number(limit || 500));
        if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
            throw new common_1.BadRequestException('limit deve ser um número inteiro maior que zero.');
        }
        const safeLimit = Math.min(500, parsedLimit);
        const params = [job_match_service_1.JOB_MATCH_ALGORITHM_VERSION];
        const where = [];
        if (normalizedActive !== 'all') {
            params.push(normalizedActive === 'true');
            where.push(`j.active = $${params.length}`);
        }
        const cleanCity = String(city || '').trim();
        if (cleanCity) {
            params.push(cleanCity);
            where.push(`LOWER(j.city) = LOWER($${params.length})`);
        }
        const cleanState = String(state || '').trim().toUpperCase();
        if (cleanState) {
            if (!/^[A-Z]{2}$/.test(cleanState)) {
                throw new common_1.BadRequestException('state deve ser uma UF com 2 letras.');
            }
            params.push(cleanState);
            where.push(`UPPER(j.state) = $${params.length}`);
        }
        const validReadyExpression = `(p.status = 'READY' AND p."algorithmVersion" = $1)`;
        if (normalizedReady === 'true')
            where.push(validReadyExpression);
        if (normalizedReady === 'false')
            where.push(`NOT ${validReadyExpression}`);
        params.push(safeLimit);
        const rows = await this.dataSource.query(`SELECT
         j.id,
         j.slug,
         j.title,
         j."companyName",
         j."sourceName",
         j."sourceUrl",
         j."sourceExternalId",
         j.city,
         j.state,
         j.active,
         j."moderationStatus",
         j."createdAt",
         j."updatedAt",
         p.status AS "matchProfileStatus",
         p."algorithmVersion" AS "matchProfileAlgorithmVersion",
         p.error AS "matchProfileError",
         p."analyzedAt" AS "matchProfileAnalyzedAt",
         p."updatedAt" AS "matchProfileUpdatedAt",
         ${validReadyExpression} AS ready
       FROM jobs j
       LEFT JOIN job_match_profiles p ON p."jobId" = j.id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY j."createdAt" DESC, j.id DESC
       LIMIT $${params.length}`, params);
        return {
            data: rows.map((row) => ({
                ...row,
                matchProfileStatus: row.matchProfileStatus || 'MISSING',
                ready: Boolean(row.ready),
            })),
            count: rows.length,
            filters: {
                ready: normalizedReady,
                active: normalizedActive,
                city: cleanCity || null,
                state: cleanState || null,
                limit: safeLimit,
                algorithmVersion: job_match_service_1.JOB_MATCH_ALGORITHM_VERSION,
            },
        };
    }
    list(req, query) {
        return this.jobs.list(query, req.apiClient);
    }
    check(req, input) {
        return this.jobs.check(input, req.apiClient);
    }
    async create(req, input) {
        const result = await this.jobs.create(input, req.apiClient);
        if (input?.matchProfile !== undefined && result?.created && result?.job?.id) {
            const matchProfile = await this.jobMatch.acceptProvidedProfile(result.job.id, input.matchProfile);
            return { ...result, matchProfile };
        }
        return result;
    }
    async update(req, id, input) {
        if (input?.matchProfile !== undefined)
            this.jobMatch.stageProvidedProfile(id, input.matchProfile);
        try {
            const result = await this.jobs.update(id, input, req.apiClient);
            if (input?.matchProfile !== undefined && result?.job?.id) {
                const matchProfile = await this.jobMatch.acceptProvidedProfile(result.job.id, input.matchProfile);
                return { ...result, matchProfile };
            }
            return result;
        }
        finally {
            this.jobMatch.clearStagedProvidedProfile(id);
        }
    }
    async verify(req, id, input) {
        if (input?.matchProfile !== undefined)
            this.jobMatch.stageProvidedProfile(id, input.matchProfile);
        try {
            const result = await this.jobs.verify(id, input, req.apiClient);
            if (input?.matchProfile !== undefined && result?.job?.id) {
                const matchProfile = await this.jobMatch.acceptProvidedProfile(result.job.id, input.matchProfile);
                return { ...result, matchProfile };
            }
            return result;
        }
        finally {
            this.jobMatch.clearStagedProvidedProfile(id);
        }
    }
};
exports.ExternalApiController = ExternalApiController;
__decorate([
    (0, common_1.Get)('match-profile-schema'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ExternalApiController.prototype, "matchProfileSchema", null);
__decorate([
    (0, common_1.Get)('match-profile-status'),
    __param(0, (0, common_1.Query)('ready')),
    __param(1, (0, common_1.Query)('active')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('city')),
    __param(4, (0, common_1.Query)('state')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ExternalApiController.prototype, "matchProfileStatus", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ExternalApiController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('check'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ExternalApiController.prototype, "check", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExternalApiController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ExternalApiController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/verification'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ExternalApiController.prototype, "verify", null);
exports.ExternalApiController = ExternalApiController = __decorate([
    (0, common_1.Controller)('v1/jobs'),
    (0, common_1.UseGuards)(api_key_guard_1.ApiKeyGuard),
    __metadata("design:paramtypes", [external_jobs_service_1.ExternalJobsService,
        job_match_service_1.JobMatchService,
        typeorm_1.DataSource])
], ExternalApiController);
//# sourceMappingURL=external-api.controller.js.map