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
exports.AiController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ai_service_1 = require("./ai.service");
const job_skills_service_1 = require("./job-skills.service");
const resume_import_service_1 = require("./resume-import.service");
const resume_review_service_1 = require("./resume-review.service");
const resume_improvement_service_1 = require("./resume-improvement.service");
const auth_guard_1 = require("../auth/auth.guard");
const user_entity_1 = require("../users/entities/user.entity");
const payments_service_1 = require("../payments/payments.service");
const billing_support_service_1 = require("../payments/billing-support.service");
let AiController = class AiController {
    aiService;
    jobSkillsService;
    resumeImportService;
    resumeReviewService;
    resumeImprovementService;
    paymentsService;
    billingSupport;
    usersRepository;
    constructor(aiService, jobSkillsService, resumeImportService, resumeReviewService, resumeImprovementService, paymentsService, billingSupport, usersRepository) {
        this.aiService = aiService;
        this.jobSkillsService = jobSkillsService;
        this.resumeImportService = resumeImportService;
        this.resumeReviewService = resumeReviewService;
        this.resumeImprovementService = resumeImprovementService;
        this.paymentsService = paymentsService;
        this.billingSupport = billingSupport;
        this.usersRepository = usersRepository;
    }
    async requireUser(userId) {
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user)
            throw new common_1.ForbiddenException('Perfil de usuário não encontrado.');
        return user;
    }
    async getStatus(req) {
        const [status, user, reanalysisProduct, improvementProduct, importProduct, credits, lifetimeFree, devMode] = await Promise.all([
            this.aiService.getStatus(),
            this.usersRepository.findOne({ where: { id: req.user.uid } }),
            this.paymentsService.findProduct('RESUME_REANALYSIS', true),
            this.paymentsService.findProduct('RESUME_AI_IMPROVEMENT', true),
            this.paymentsService.findProduct('RESUME_AI_IMPORT', true),
            this.paymentsService.getCredits(req.user.uid),
            this.billingSupport.isLifetimeFree(req.user.uid),
            this.paymentsService.getDevMode(),
        ]);
        const paymentAccessOverride = lifetimeFree || devMode.enabled;
        const analysisCount = Number(user?.aiAnalysisCount || 0);
        const freeAnalysisLimit = user?.aiAnalysisLimit ?? Number(reanalysisProduct.freeUses ?? 1);
        const freeResumeAnalysisAvailable = analysisCount < freeAnalysisLimit;
        const hasSavedResumeAnalysis = Boolean(user?.aiAnalysis && user?.hasAiAnalyzed);
        const reanalysisFreeNow = Boolean(reanalysisProduct.enabled) && Number(reanalysisProduct.effectivePriceCents || 0) === 0;
        const resumeReanalysisPaymentRequired = !paymentAccessOverride &&
            Boolean(reanalysisProduct.enabled) &&
            Number(reanalysisProduct.effectivePriceCents || 0) > 0 &&
            !freeResumeAnalysisAvailable &&
            Number(credits.RESUME_REANALYSIS || 0) <= 0;
        const resumeScorePaymentRequired = resumeReanalysisPaymentRequired && !hasSavedResumeAnalysis;
        const importCount = Number(user?.aiImportCount || 0);
        const freeImportLimit = user?.aiImportLimit ?? Number(importProduct.freeUses ?? 1);
        const freeResumeImportAvailable = importCount < freeImportLimit;
        const importFreeNow = Boolean(importProduct.enabled) && Number(importProduct.effectivePriceCents || 0) === 0;
        const resumeImportPaymentRequired = !paymentAccessOverride &&
            Boolean(importProduct.enabled) &&
            Number(importProduct.effectivePriceCents || 0) > 0 &&
            !freeResumeImportAvailable &&
            Number(credits.RESUME_AI_IMPORT || 0) <= 0;
        const improvementFreeNow = Boolean(improvementProduct.enabled) && Number(improvementProduct.effectivePriceCents || 0) === 0;
        const resumeImprovementPaymentRequired = !paymentAccessOverride &&
            Boolean(improvementProduct.enabled) &&
            Number(improvementProduct.effectivePriceCents || 0) > 0 &&
            Number(credits.RESUME_AI_IMPROVEMENT || 0) <= 0;
        return {
            ...status,
            lifetimeFree,
            devMode: devMode.enabled,
            paymentAccessOverride,
            resumeScorePaymentRequired,
            resumeReanalysisPaymentRequired,
            resumeImprovementPaymentRequired,
            resumeImportPaymentRequired,
            freeResumeAnalysisAvailable,
            freeResumeImportAvailable,
            hasSavedResumeAnalysis,
            resumeAnalysisCount: analysisCount,
            resumeImportCount: importCount,
            credits,
            products: {
                reanalysis: reanalysisProduct,
                improvement: improvementProduct,
                import: importProduct,
            },
            availability: {
                reanalysis: paymentAccessOverride || freeResumeAnalysisAvailable || reanalysisFreeNow || Number(credits.RESUME_REANALYSIS || 0) > 0 || Boolean(reanalysisProduct.enabled),
                improvement: paymentAccessOverride || improvementFreeNow || Number(credits.RESUME_AI_IMPROVEMENT || 0) > 0 || Boolean(improvementProduct.enabled),
                import: paymentAccessOverride || freeResumeImportAvailable || importFreeNow || Number(credits.RESUME_AI_IMPORT || 0) > 0 || Boolean(importProduct.enabled),
            },
        };
    }
    async runResumeImport(userId, documents) {
        const [user, product, credits, lifetimeFree, devMode] = await Promise.all([
            this.requireUser(userId),
            this.paymentsService.findProduct('RESUME_AI_IMPORT', true),
            this.paymentsService.getCredits(userId),
            this.billingSupport.isLifetimeFree(userId),
            this.paymentsService.getDevMode(),
        ]);
        const paymentAccessOverride = lifetimeFree || devMode.enabled;
        const count = Number(user.aiImportCount || 0);
        const freeLimit = user.aiImportLimit ?? Number(product.freeUses ?? 1);
        const freeAvailable = count < freeLimit;
        const freeNow = Boolean(product.enabled) && Number(product.effectivePriceCents || 0) === 0;
        const paidCreditAvailable = Number(credits.RESUME_AI_IMPORT || 0) > 0;
        if (!paymentAccessOverride && !freeAvailable && !freeNow && !paidCreditAvailable) {
            if (!product.enabled) {
                throw new common_1.ForbiddenException({
                    code: 'AI_IMPORT_UNAVAILABLE',
                    message: 'Sua primeira organização por IA já foi utilizada e novas importações estão temporariamente indisponíveis.',
                });
            }
            throw new common_1.ForbiddenException({
                code: 'PAYMENT_REQUIRED',
                productCode: product.code,
                product,
                message: 'Sua primeira organização por IA já foi utilizada. Uma nova importação requer um crédito.',
            });
        }
        let consumed = false;
        if (!paymentAccessOverride && !freeAvailable && !freeNow && paidCreditAvailable) {
            await this.paymentsService.consumeCredit(userId, 'RESUME_AI_IMPORT');
            consumed = true;
        }
        try {
            const result = await this.resumeImportService.importDocuments(documents);
            user.aiImportCount = count + 1;
            await this.usersRepository.save(user);
            return result;
        }
        catch (error) {
            if (consumed)
                await this.paymentsService.grantCredit(userId, 'RESUME_AI_IMPORT', 1).catch(() => undefined);
            throw error;
        }
    }
    async analyzeResume(req, body) {
        if (!body.base64File) {
            throw new common_1.BadRequestException('Nenhum arquivo de currículo enviado.');
        }
        return this.runResumeImport(req.user.uid, [
            {
                base64File: body.base64File,
                mimeType: body.mimeType,
                fileName: 'curriculo',
            },
        ]);
    }
    async analyzeResumeDocuments(req, body) {
        return this.runResumeImport(req.user.uid, body.documents || []);
    }
    async reviewResume(req, body) {
        if (!body || !body.profile) {
            throw new common_1.BadRequestException('Envie os dados do currículo para avaliação.');
        }
        const [user, product, credits, lifetimeFree, devMode] = await Promise.all([
            this.requireUser(req.user.uid),
            this.paymentsService.findProduct('RESUME_REANALYSIS', true),
            this.paymentsService.getCredits(req.user.uid),
            this.billingSupport.isLifetimeFree(req.user.uid),
            this.paymentsService.getDevMode(),
        ]);
        const paymentAccessOverride = lifetimeFree || devMode.enabled;
        const analysisCount = Number(user.aiAnalysisCount || 0);
        const freeAnalysisLimit = user.aiAnalysisLimit ?? Number(product.freeUses ?? 1);
        const freeAvailable = analysisCount < freeAnalysisLimit;
        const freeNow = Boolean(product.enabled) && Number(product.effectivePriceCents || 0) === 0;
        const paidCreditAvailable = Number(credits.RESUME_REANALYSIS || 0) > 0;
        const canRunNewAnalysis = paymentAccessOverride || freeAvailable || freeNow || paidCreditAvailable;
        if (!canRunNewAnalysis) {
            if (!product.enabled) {
                throw new common_1.ForbiddenException({
                    code: 'REANALYSIS_UNAVAILABLE',
                    message: 'Sua análise gratuita continua disponível para consulta, mas novas análises estão temporariamente indisponíveis.',
                });
            }
            throw new common_1.ForbiddenException({
                code: 'PAYMENT_REQUIRED',
                productCode: product.code,
                product,
                message: 'Sua análise gratuita já foi utilizada. Uma nova análise requer um crédito.',
            });
        }
        let consumed = false;
        if (!paymentAccessOverride && !freeAvailable && !freeNow && paidCreditAvailable) {
            await this.paymentsService.consumeCredit(req.user.uid, 'RESUME_REANALYSIS');
            consumed = true;
        }
        try {
            const analysis = await this.resumeReviewService.review(body.profile);
            user.aiAnalysis = analysis;
            user.hasAiAnalyzed = true;
            user.aiAnalysisCount = analysisCount + 1;
            await this.usersRepository.save(user);
            await this.paymentsService.recordAnalysis(req.user.uid, body.profile, analysis, freeAvailable ? 'FREE' : 'REANALYSIS');
            return analysis;
        }
        catch (error) {
            if (consumed)
                await this.paymentsService.grantCredit(req.user.uid, 'RESUME_REANALYSIS', 1).catch(() => undefined);
            throw error;
        }
    }
    async improveResume(req) {
        const [user, product, credits, lifetimeFree, devMode] = await Promise.all([
            this.requireUser(req.user.uid),
            this.paymentsService.findProduct('RESUME_AI_IMPROVEMENT', true),
            this.paymentsService.getCredits(req.user.uid),
            this.billingSupport.isLifetimeFree(req.user.uid),
            this.paymentsService.getDevMode(),
        ]);
        const paymentAccessOverride = lifetimeFree || devMode.enabled;
        const freeNow = Boolean(product.enabled) && Number(product.effectivePriceCents || 0) === 0;
        const paidCreditAvailable = Number(credits.RESUME_AI_IMPROVEMENT || 0) > 0;
        if (!paymentAccessOverride && !freeNow && !paidCreditAvailable) {
            if (!product.enabled) {
                throw new common_1.ForbiddenException({ code: 'IMPROVEMENT_UNAVAILABLE', message: 'A otimização profissional por IA está temporariamente indisponível.' });
            }
            throw new common_1.ForbiddenException({
                code: 'PAYMENT_REQUIRED',
                productCode: product.code,
                product,
                message: 'A otimização profissional por IA requer um crédito.',
            });
        }
        let consumed = false;
        if (!paymentAccessOverride && !freeNow && paidCreditAvailable) {
            await this.paymentsService.consumeCredit(req.user.uid, 'RESUME_AI_IMPROVEMENT');
            consumed = true;
        }
        try {
            const proposal = await this.resumeImprovementService.propose(user);
            const stored = await this.paymentsService.createImprovementProposal(req.user.uid, user, proposal);
            return { id: stored.id, status: stored.status, proposal };
        }
        catch (error) {
            if (consumed)
                await this.paymentsService.grantCredit(req.user.uid, 'RESUME_AI_IMPROVEMENT', 1).catch(() => undefined);
            throw error;
        }
    }
    async applyResumeImprovement(req, id, body) {
        const [user, stored] = await Promise.all([
            this.requireUser(req.user.uid),
            this.paymentsService.getImprovementProposal(req.user.uid, id),
        ]);
        if (stored.status !== 'PENDING') {
            throw new common_1.BadRequestException('Esta proposta de melhoria já foi concluída.');
        }
        const proposal = stored.proposal;
        const availableIds = new Set((proposal.changes || []).map((change) => change.id));
        const selectedIds = Array.from(new Set((body.selectedChangeIds || []).map(String))).filter((changeId) => availableIds.has(changeId));
        if (selectedIds.length === 0)
            throw new common_1.BadRequestException('Selecione ao menos uma melhoria para aplicar.');
        const patch = this.resumeImprovementService.applySelected(user, proposal, selectedIds);
        user.bio = patch.bio;
        user.skills = patch.skills;
        user.resumePreferences = patch.resumePreferences;
        user.experiences = patch.experiences;
        await this.usersRepository.save(user);
        const partial = selectedIds.length < (proposal.changes || []).length;
        await this.paymentsService.completeImprovementProposal(req.user.uid, id, selectedIds, partial);
        let analysis = null;
        let analysisError = null;
        try {
            const profileForReview = {
                ...user,
                uploadedResumeFile: undefined,
                publishedResumeSnapshot: undefined,
            };
            analysis = await this.resumeReviewService.review(profileForReview);
            user.aiAnalysis = analysis;
            user.hasAiAnalyzed = true;
            user.aiAnalysisCount = Number(user.aiAnalysisCount || 0) + 1;
            await this.usersRepository.save(user);
            await this.paymentsService.recordAnalysis(req.user.uid, profileForReview, analysis, 'IMPROVEMENT');
        }
        catch (error) {
            analysisError = error?.message || 'As melhorias foram aplicadas, mas a nova análise não pôde ser concluída agora.';
        }
        return {
            applied: true,
            partial,
            selectedChangeIds: selectedIds,
            analysis,
            analysisError,
        };
    }
    async suggestJobSkills(body) {
        return this.jobSkillsService.suggestSkills(body.title || '', body.description || '', body.requirements || '');
    }
    async skillCompatibility(body) {
        return this.jobSkillsService.scoreCompatibility(body.candidateSkills, body.jobSkills);
    }
    async jobMatch(body) {
        if (!Array.isArray(body.jobs) || body.jobs.length === 0) {
            throw new common_1.BadRequestException('Nenhuma vaga foi enviada para análise.');
        }
        const [generalResult, skillResult] = await Promise.all([
            this.aiService.matchJobs(body.profile, body.jobs, Array.isArray(body.applications) ? body.applications : []),
            this.jobSkillsService.scoreJobs(body.profile, body.jobs),
        ]);
        const skillScores = new Map(skillResult.scores.map((item) => [item.jobId, item]));
        const matches = Array.isArray(generalResult?.matches)
            ? generalResult.matches.map((match) => {
                const skill = skillScores.get(String(match?.jobId || ''));
                const originalReason = String(match?.reason || '').trim();
                const skillSentence = skill
                    ? `Compatibilidade de habilidades: ${Math.round(skill.score)}%.`
                    : '';
                return {
                    ...match,
                    reason: [originalReason, skillSentence].filter(Boolean).join(' '),
                    skillScore: skill?.score ?? null,
                    skillMatches: skill?.matches ?? [],
                };
            })
            : [];
        return { ...generalResult, matches };
    }
};
exports.AiController = AiController;
__decorate([
    (0, common_1.Get)('status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Post)('analyze-resume'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "analyzeResume", null);
__decorate([
    (0, common_1.Post)('analyze-resume-documents'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "analyzeResumeDocuments", null);
__decorate([
    (0, common_1.Post)('review-resume'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "reviewResume", null);
__decorate([
    (0, common_1.Post)('improve-resume'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "improveResume", null);
__decorate([
    (0, common_1.Post)('improve-resume/:id/apply'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "applyResumeImprovement", null);
__decorate([
    (0, common_1.Post)('suggest-job-skills'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "suggestJobSkills", null);
__decorate([
    (0, common_1.Post)('skill-compatibility'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "skillCompatibility", null);
__decorate([
    (0, common_1.Post)('job-match'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "jobMatch", null);
exports.AiController = AiController = __decorate([
    (0, common_1.Controller)('ai'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __param(7, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [ai_service_1.AiService,
        job_skills_service_1.JobSkillsService,
        resume_import_service_1.ResumeImportService,
        resume_review_service_1.ResumeReviewService,
        resume_improvement_service_1.ResumeImprovementService,
        payments_service_1.PaymentsService,
        billing_support_service_1.BillingSupportService,
        typeorm_2.Repository])
], AiController);
//# sourceMappingURL=ai.controller.js.map