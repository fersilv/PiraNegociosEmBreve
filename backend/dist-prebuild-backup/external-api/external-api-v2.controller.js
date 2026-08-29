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
exports.ExternalApiV2Controller = void 0;
const common_1 = require("@nestjs/common");
const job_match_service_1 = require("../job-match/job-match.service");
const api_key_guard_1 = require("./api-key.guard");
const external_jobs_service_1 = require("./external-jobs.service");
const jobs_mcp_scopes_1 = require("./jobs-mcp.scopes");
const jobs_operations_service_1 = require("./jobs-operations.service");
let ExternalApiV2Controller = class ExternalApiV2Controller {
    jobs;
    operations;
    jobMatch;
    constructor(jobs, operations, jobMatch) {
        this.jobs = jobs;
        this.operations = operations;
        this.jobMatch = jobMatch;
    }
    stats(req) {
        this.requireScope(req, 'jobs:stats:read');
        return this.operations.stats();
    }
    reviewQueue(req, query) {
        this.requireScope(req, 'jobs:review:read');
        return this.operations.reviewQueue({
            status: query.status,
            active: query.active === undefined ? undefined : query.active === 'true',
            city: query.city,
            state: query.state,
            page: Number(query.page || 1),
            pageSize: Number(query.pageSize || 30),
        });
    }
    list(req, query) {
        this.requireScope(req, 'jobs:list');
        return this.jobs.list(query, req.apiClient);
    }
    get(req, id) {
        this.requireScope(req, 'jobs:detail');
        return this.operations.get(id);
    }
    check(req, input) {
        this.requireScope(req, 'jobs:duplicates:check');
        return this.jobs.check(input, req.apiClient);
    }
    async create(req, input) {
        this.requireScope(req, 'jobs:create');
        const result = await this.jobs.create(input, req.apiClient);
        if (input?.matchProfile !== undefined && result?.created && result?.job?.id) {
            const matchProfile = await this.jobMatch.acceptProvidedProfile(result.job.id, input.matchProfile);
            return { ...result, matchProfile };
        }
        return result;
    }
    async update(req, id, input) {
        this.requireScope(req, 'jobs:update');
        if (input?.matchProfile !== undefined) {
            this.jobMatch.stageProvidedProfile(id, input.matchProfile);
        }
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
        this.requireScope(req, 'jobs:verify');
        if (input?.matchProfile !== undefined) {
            this.jobMatch.stageProvidedProfile(id, input.matchProfile);
        }
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
    activate(req, id, body) {
        this.requireScope(req, 'jobs:activate');
        return this.operations.setActive(id, true, this.actor(req.apiClient), body?.note);
    }
    deactivate(req, id, body) {
        this.requireScope(req, 'jobs:deactivate');
        return this.operations.setActive(id, false, this.actor(req.apiClient), body?.note);
    }
    review(req, id, body) {
        this.requireScope(req, 'jobs:review:write');
        return this.operations.setReview(id, String(body?.status || ''), this.actor(req.apiClient), body?.note);
    }
    flag(req, id, body) {
        this.requireScope(req, 'jobs:flag');
        return this.operations.flag(id, this.actor(req.apiClient), body || {});
    }
    unflag(req, id, body) {
        this.requireScope(req, 'jobs:unflag');
        return this.operations.clearFlag(id, this.actor(req.apiClient), body?.note);
    }
    remove(req, id) {
        this.requireScope(req, 'jobs:delete');
        return this.operations.remove(id);
    }
    requireScope(req, scope) {
        const client = req.apiClient;
        if (!client || !(0, jobs_mcp_scopes_1.hasJobsScope)(client.scopes || [], scope)) {
            throw new common_1.ForbiddenException(`Esta chave não possui o escopo ${scope}.`);
        }
    }
    actor(client) {
        return `api-v2:${client.id}:${client.name}`.slice(0, 160);
    }
};
exports.ExternalApiV2Controller = ExternalApiV2Controller;
__decorate([
    (0, common_1.Get)('stats'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ExternalApiV2Controller.prototype, "stats", null);
__decorate([
    (0, common_1.Get)('review'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ExternalApiV2Controller.prototype, "reviewQueue", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ExternalApiV2Controller.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ExternalApiV2Controller.prototype, "get", null);
__decorate([
    (0, common_1.Post)('check'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ExternalApiV2Controller.prototype, "check", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExternalApiV2Controller.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ExternalApiV2Controller.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/verification'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ExternalApiV2Controller.prototype, "verify", null);
__decorate([
    (0, common_1.Post)(':id/activate'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ExternalApiV2Controller.prototype, "activate", null);
__decorate([
    (0, common_1.Post)(':id/deactivate'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ExternalApiV2Controller.prototype, "deactivate", null);
__decorate([
    (0, common_1.Patch)(':id/review'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ExternalApiV2Controller.prototype, "review", null);
__decorate([
    (0, common_1.Post)(':id/flag'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ExternalApiV2Controller.prototype, "flag", null);
__decorate([
    (0, common_1.Post)(':id/unflag'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ExternalApiV2Controller.prototype, "unflag", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ExternalApiV2Controller.prototype, "remove", null);
exports.ExternalApiV2Controller = ExternalApiV2Controller = __decorate([
    (0, common_1.Controller)('v2/jobs'),
    (0, common_1.UseGuards)(api_key_guard_1.ApiKeyGuard),
    __metadata("design:paramtypes", [external_jobs_service_1.ExternalJobsService,
        jobs_operations_service_1.JobsOperationsService,
        job_match_service_1.JobMatchService])
], ExternalApiV2Controller);
//# sourceMappingURL=external-api-v2.controller.js.map