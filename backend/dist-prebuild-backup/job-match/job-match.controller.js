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
exports.AdminJobMatchController = exports.JobMatchController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const admin_guard_1 = require("../admin/admin.guard");
const job_match_admin_service_1 = require("./job-match-admin.service");
const job_match_service_1 = require("./job-match.service");
let JobMatchController = class JobMatchController {
    jobMatch;
    constructor(jobMatch) {
        this.jobMatch = jobMatch;
    }
    status(req) {
        return this.jobMatch.getStatus(req.user.uid);
    }
    matches(req) {
        return this.jobMatch.getMatches(req.user.uid);
    }
    companyCandidates(req, jobId) {
        return this.jobMatch.getCompanyCandidatesForJob(req.user.uid, jobId);
    }
    companyCandidateDetails(req, jobId, candidateIds) {
        return this.jobMatch.getCompanyCandidatesForJob(req.user.uid, jobId, Array.isArray(candidateIds) ? candidateIds.map(String) : []);
    }
};
exports.JobMatchController = JobMatchController;
__decorate([
    (0, common_1.Get)('status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], JobMatchController.prototype, "status", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], JobMatchController.prototype, "matches", null);
__decorate([
    (0, common_1.Get)('jobs/:jobId/candidates'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], JobMatchController.prototype, "companyCandidates", null);
__decorate([
    (0, common_1.Post)('jobs/:jobId/candidates/details'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('jobId')),
    __param(2, (0, common_1.Body)('candidateIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], JobMatchController.prototype, "companyCandidateDetails", null);
exports.JobMatchController = JobMatchController = __decorate([
    (0, common_1.Controller)('job-match'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [job_match_service_1.JobMatchService])
], JobMatchController);
let AdminJobMatchController = class AdminJobMatchController {
    jobMatch;
    adminMatch;
    constructor(jobMatch, adminMatch) {
        this.jobMatch = jobMatch;
        this.adminMatch = adminMatch;
    }
    overview() {
        return this.adminMatch.overview();
    }
    backfillQueue(limit) {
        return this.adminMatch.backfillQueue(Number(limit || 100));
    }
    updateConfig(body) {
        return this.adminMatch.updateConfig(body || {});
    }
    backfill(limit) {
        return this.adminMatch.backfill(Number(limit || 25));
    }
    prepareOne(id) {
        return this.adminMatch.prepareOne(id);
    }
    reanalyze(id) {
        return this.jobMatch.reanalyzeJob(id);
    }
};
exports.AdminJobMatchController = AdminJobMatchController;
__decorate([
    (0, common_1.Get)('overview'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminJobMatchController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)('backfill/queue'),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminJobMatchController.prototype, "backfillQueue", null);
__decorate([
    (0, common_1.Patch)('config'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminJobMatchController.prototype, "updateConfig", null);
__decorate([
    (0, common_1.Post)('backfill'),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminJobMatchController.prototype, "backfill", null);
__decorate([
    (0, common_1.Post)('backfill/jobs/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminJobMatchController.prototype, "prepareOne", null);
__decorate([
    (0, common_1.Post)('jobs/:id/reanalyze'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminJobMatchController.prototype, "reanalyze", null);
exports.AdminJobMatchController = AdminJobMatchController = __decorate([
    (0, common_1.Controller)('admin/job-match'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [job_match_service_1.JobMatchService,
        job_match_admin_service_1.JobMatchAdminService])
], AdminJobMatchController);
//# sourceMappingURL=job-match.controller.js.map