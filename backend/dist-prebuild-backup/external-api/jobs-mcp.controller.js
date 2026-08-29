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
exports.JobsMcpController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const job_match_service_1 = require("../job-match/job-match.service");
const controlled_ai_automation_service_1 = require("./controlled-ai-automation.service");
const external_jobs_service_1 = require("./external-jobs.service");
const jobs_mcp_scopes_1 = require("./jobs-mcp.scopes");
const jobs_oauth_guard_1 = require("./jobs-oauth.guard");
const jobs_operations_service_1 = require("./jobs-operations.service");
let JobsMcpController = class JobsMcpController {
    jobs;
    operations;
    jobMatch;
    automation;
    dataSource;
    constructor(jobs, operations, jobMatch, automation, dataSource) {
        this.jobs = jobs;
        this.operations = operations;
        this.jobMatch = jobMatch;
        this.automation = automation;
        this.dataSource = dataSource;
    }
    async handle(req, res) {
        const [{ createMcpHandler, McpServer }, { toNodeHandler }, z] = await Promise.all([
            import('@modelcontextprotocol/server'),
            import('@modelcontextprotocol/node'),
            import('zod/v4'),
        ]);
        const scopes = new Set(req.jobsOAuth?.scopes || []);
        const apiClient = req.jobsOAuth?.apiClient;
        const allowed = (scope) => (0, jobs_mcp_scopes_1.hasJobsScope)(scopes, scope);
        const actor = `mcp:${apiClient?.id || 'unknown'}:${apiClient?.name || 'integration'}`.slice(0, 160);
        const externalJobFields = {
            title: z.string().min(1).max(180).optional(),
            sourceName: z.string().max(160).optional(),
            sourceUrl: z.string().max(2000).optional(),
            city: z.string().max(120).optional(),
            state: z.string().max(2).optional(),
            description: z.string().min(1).max(20000).optional(),
            requirements: z.string().max(20000).optional(),
            type: z.string().max(40).optional(),
            workModel: z.string().max(40).optional(),
            salary: z.string().max(80).optional(),
            estimatedSalary: z.string().max(80).optional(),
            estimatedSalarySource: z.string().max(160).optional(),
            estimatedSalarySourceUrl: z.string().max(2000).optional(),
            estimatedSalaryRegion: z.string().max(160).optional(),
            estimatedSalaryUpdatedAt: z.string().optional(),
            pcdMode: z.enum(['GENERAL', 'INCLUSIVE', 'EXCLUSIVE']).optional(),
            applicationEmail: z.string().max(254).optional(),
            applicationWhatsApp: z.string().max(30).optional(),
            applicationUrl: z.string().max(2000).optional(),
            applicationUrlTitle: z.string().max(180).optional(),
            externalApplicationInstructions: z.string().max(5000).optional(),
            deadlineDate: z.string().optional(),
            isTalentPool: z.boolean().optional(),
            isFlagged: z.boolean().optional(),
            flagObservation: z.string().max(1000).optional(),
            companyName: z.string().max(160).optional(),
            sourceExternalId: z.string().max(120).optional(),
            sourcePublishedAt: z.string().optional(),
            lastVerifiedAt: z.string().optional(),
            lastSeenAt: z.string().optional(),
            flagReason: z.string().max(120).optional(),
            flaggedAt: z.string().optional(),
            flaggedBy: z.string().max(120).optional(),
            matchProfile: z.any().optional(),
        };
        const handler = createMcpHandler(() => {
            const server = new McpServer({
                name: 'PiraNegócios Operações',
                version: '2.2.0',
            });
            const register = (scope, name, definition, toolHandler) => {
                if (allowed(scope))
                    server.registerTool(name, definition, toolHandler);
            };
            register('jobs:list', 'piranegocios_jobs_list', {
                description: 'Lista e pesquisa vagas com filtros, estado ativo e paginação por cursor.',
                inputSchema: z.object({
                    q: z.string().max(300).optional(),
                    limit: z.number().int().min(1).max(100).optional(),
                    cursor: z.string().max(1024).optional(),
                    active: z.boolean().optional(),
                    external: z.boolean().optional(),
                    city: z.string().max(120).optional(),
                    state: z.string().max(2).optional(),
                    type: z.string().max(40).optional(),
                    workModel: z.string().max(40).optional(),
                    companyId: z.string().max(100).optional(),
                    pcdMode: z.enum(['GENERAL', 'INCLUSIVE', 'EXCLUSIVE']).optional(),
                }),
            }, async (args) => {
                const query = {
                    ...args,
                    limit: args.limit === undefined ? undefined : String(args.limit),
                    active: args.active === undefined ? undefined : String(args.active),
                    external: args.external === undefined ? undefined : String(args.external),
                };
                return this.result(await this.jobs.list(query, apiClient));
            });
            register('jobs:detail', 'piranegocios_jobs_get', {
                description: 'Consulta uma vaga específica por ID, incluindo moderação, revisão operacional e estado ativo.',
                inputSchema: z.object({ id: z.string().uuid() }),
            }, async ({ id }) => this.result(await this.operations.get(id)));
            register('jobs:stats:read', 'piranegocios_jobs_stats', {
                description: 'Consulta totais de vagas ativas/inativas, alertas, moderação e estados da fila operacional.',
                inputSchema: z.object({}),
            }, async () => this.result(await this.operations.stats()));
            register('jobs:review:read', 'piranegocios_jobs_review_queue', {
                description: 'Consulta a fila operacional de revisão, rechecagem, desativação e resolução.',
                inputSchema: z.object({
                    status: z.enum([
                        'PENDING_REVIEW',
                        'REVIEWED_OK',
                        'RECHECK_REQUIRED',
                        'DEACTIVATION_REQUIRED',
                        'RESOLVED',
                    ]).optional(),
                    active: z.boolean().optional(),
                    city: z.string().max(120).optional(),
                    state: z.string().max(2).optional(),
                    page: z.number().int().min(1).optional(),
                    pageSize: z.number().int().min(1).max(100).optional(),
                }),
            }, async (args) => this.result(await this.operations.reviewQueue(args)));
            register('jobs:match:schema:read', 'piranegocios_jobs_match_profile_schema', {
                description: 'Retorna o formato aceito em matchProfile para uma IA externa preparar a ficha da vaga.',
                inputSchema: z.object({}),
            }, async () => this.result(this.matchProfileSchema()));
            register('jobs:match:status:read', 'piranegocios_jobs_match_profile_status', {
                description: 'Localiza fichas de matching prontas, ausentes, com erro ou desatualizadas para processamento externo.',
                inputSchema: z.object({
                    ready: z.enum(['true', 'false', 'all']).optional(),
                    active: z.enum(['true', 'false', 'all']).optional(),
                    limit: z.number().int().min(1).max(500).optional(),
                    city: z.string().max(120).optional(),
                    state: z.string().max(2).optional(),
                }),
            }, async (args) => this.result(await this.matchProfileStatus(args)));
            register('jobs:match:write', 'piranegocios_jobs_set_match_profile', {
                description: 'Grava a ficha de matching produzida por uma IA externa. Não executa modelo no backend.',
                inputSchema: z.object({ id: z.string().uuid(), matchProfile: z.any() }),
            }, async ({ id, matchProfile }) => this.result(await this.jobMatch.acceptProvidedProfile(id, matchProfile)));
            register('jobs:duplicates:check', 'piranegocios_jobs_check_duplicate', {
                description: 'Verifica se uma vaga já existe antes do cadastro.',
                inputSchema: z.object({
                    ...externalJobFields,
                    title: z.string().min(1).max(180),
                    description: z.string().min(1).max(20000),
                    allowSimilarDuplicate: z.boolean().optional(),
                }),
            }, async (args) => this.result(await this.jobs.check(args, apiClient)));
            register('jobs:create', 'piranegocios_jobs_create_external', {
                description: 'Cadastra uma vaga externa com deduplicação e fluxo normal de moderação.',
                inputSchema: z.object({
                    ...externalJobFields,
                    title: z.string().min(1).max(180),
                    description: z.string().min(1).max(20000),
                    allowSimilarDuplicate: z.boolean().optional(),
                }),
            }, async (args) => this.result(await this.createExternal(args, apiClient)));
            register('jobs:update', 'piranegocios_jobs_update_external', {
                description: 'Atualiza o conteúdo de uma vaga externa gerida pela credencial de ingestão.',
                inputSchema: z.object({ id: z.string().uuid(), ...externalJobFields }),
            }, async ({ id, ...input }) => this.result(await this.updateExternal(id, input, apiClient)));
            register('jobs:verify', 'piranegocios_jobs_verify_external', {
                description: 'Registra disponibilidade, encerramento, expiração, ausência ou incerteza da vaga na fonte.',
                inputSchema: z.object({
                    id: z.string().uuid(),
                    status: z.enum(['AVAILABLE', 'NOT_FOUND', 'CLOSED', 'EXPIRED', 'UNCERTAIN']),
                    observation: z.string().max(1000).optional(),
                    matchProfile: z.any().optional(),
                }),
            }, async ({ id, ...input }) => this.result(await this.verifyExternal(id, input, apiClient)));
            register('jobs:activate', 'piranegocios_jobs_activate', {
                description: 'Aprova e ativa uma vaga válida para publicação.',
                inputSchema: z.object({ id: z.string().uuid(), note: z.string().max(4000).optional() }),
            }, async ({ id, note }) => this.result(await this.operations.setActive(id, true, actor, note)));
            register('jobs:deactivate', 'piranegocios_jobs_deactivate', {
                description: 'Desativa uma vaga inválida, encerrada ou não verificável. Ação sensível.',
                inputSchema: z.object({ id: z.string().uuid(), note: z.string().max(4000).optional() }),
            }, async ({ id, note }) => this.result(await this.operations.setActive(id, false, actor, note)));
            register('jobs:review:write', 'piranegocios_jobs_set_review_status', {
                description: 'Altera o estado operacional da revisão de uma vaga.',
                inputSchema: z.object({
                    id: z.string().uuid(),
                    status: z.enum([
                        'PENDING_REVIEW',
                        'REVIEWED_OK',
                        'RECHECK_REQUIRED',
                        'DEACTIVATION_REQUIRED',
                        'RESOLVED',
                    ]),
                    note: z.string().max(4000).optional(),
                }),
            }, async ({ id, status, note }) => this.result(await this.operations.setReview(id, status, actor, note)));
            register('jobs:flag', 'piranegocios_jobs_flag', {
                description: 'Sinaliza uma vaga para atenção, correção ou rechecagem.',
                inputSchema: z.object({
                    id: z.string().uuid(),
                    reason: z.string().max(120).optional(),
                    observation: z.string().max(4000).optional(),
                }),
            }, async ({ id, ...data }) => this.result(await this.operations.flag(id, actor, data)));
            register('jobs:unflag', 'piranegocios_jobs_unflag', {
                description: 'Remove a sinalização depois que o problema foi resolvido.',
                inputSchema: z.object({ id: z.string().uuid(), note: z.string().max(4000).optional() }),
            }, async ({ id, note }) => this.result(await this.operations.clearFlag(id, actor, note)));
            register('automation:status:read', 'piranegocios_ai_automation_status', {
                description: 'Mostra as filas que substituem os antigos disparos automáticos de IA e confirma a política request-only.',
                inputSchema: z.object({}),
            }, async () => this.result(await this.automation.status()));
            register('automation:classifieds:listings:queue:read', 'piranegocios_classifieds_listing_moderation_queue', {
                description: 'Lista anúncios publicados ainda sem revisão externa de duplicidade. Não chama IA.',
                inputSchema: z.object({ limit: z.number().int().min(1).max(200).optional() }),
            }, async ({ limit }) => this.result(await this.automation.listingModerationQueue(limit)));
            register('automation:classifieds:listings:context:read', 'piranegocios_classifieds_listing_moderation_context', {
                description: 'Carrega um anúncio e anúncios anteriores da mesma identidade para comparação de duplicidade.',
                inputSchema: z.object({
                    id: z.string().uuid(),
                    candidateLimit: z.number().int().min(1).max(50).optional(),
                }),
            }, async ({ id, candidateLimit }) => this.result(await this.automation.listingModerationContext(id, candidateLimit)));
            register('automation:classifieds:listings:moderation:write', 'piranegocios_classifieds_apply_listing_moderation', {
                description: 'Aplica ao anúncio a decisão produzida externamente. APPROVE marca revisado e DUPLICATE pausa o anúncio.',
                inputSchema: z.object({
                    id: z.string().uuid(),
                    decision: z.enum(['APPROVE', 'DUPLICATE']),
                    reason: z.string().max(1200).optional(),
                    duplicateOfListingId: z.string().uuid().optional(),
                }),
            }, async ({ id, decision, reason, duplicateOfListingId }) => this.result(await this.automation.applyListingModeration(id, decision, reason, duplicateOfListingId)));
            register('automation:classifieds:reviews:queue:read', 'piranegocios_classifieds_review_moderation_queue', {
                description: 'Lista avaliações de compras aguardando moderação externa ou manual. Não chama IA.',
                inputSchema: z.object({ limit: z.number().int().min(1).max(200).optional() }),
            }, async ({ limit }) => this.result(await this.automation.reviewModerationQueue(limit)));
            register('automation:classifieds:reviews:moderation:write', 'piranegocios_classifieds_apply_review_moderation', {
                description: 'Aplica aprovação ou reprovação a uma avaliação após análise externa.',
                inputSchema: z.object({
                    id: z.string().uuid(),
                    decision: z.enum(['APPROVE', 'REJECT']),
                    reason: z.string().max(1200).optional(),
                }),
            }, async ({ id, decision, reason }) => this.result(await this.automation.applyReviewModeration(id, decision, reason)));
            register('automation:feedback:queue:read', 'piranegocios_product_feedback_queue', {
                description: 'Lê feedbacks abertos para agrupamento e priorização por um agente externo.',
                inputSchema: z.object({ limit: z.number().int().min(1).max(500).optional() }),
            }, async ({ limit }) => this.result(await this.automation.feedbackQueue(limit)));
            register('automation:feedback:insights:write', 'piranegocios_product_feedback_apply_insights', {
                description: 'Substitui os insights pelos agrupamentos preparados externamente, sem chamada de IA no backend.',
                inputSchema: z.object({
                    clusters: z.array(z.object({
                        title: z.string().min(1).max(180),
                        summary: z.string().min(1).max(5000),
                        feedbackIds: z.array(z.string().uuid()).min(1).max(500),
                        score: z.number().min(0).max(100).optional(),
                        reason: z.string().max(2000).optional(),
                    })).max(100),
                }),
            }, async ({ clusters }) => this.result(await this.automation.applyFeedbackInsights(clusters)));
            register('automation:feedback:faq-source:read', 'piranegocios_product_faq_source', {
                description: 'Lê conversas recentes de suporte como fonte para um agente externo propor FAQs.',
                inputSchema: z.object({ limit: z.number().int().min(1).max(500).optional() }),
            }, async ({ limit }) => this.result(await this.automation.faqSource(limit)));
            register('automation:feedback:faqs:write', 'piranegocios_product_feedback_apply_faqs', {
                description: 'Salva rascunhos de FAQ produzidos externamente. A publicação continua sob revisão administrativa.',
                inputSchema: z.object({
                    articles: z.array(z.object({
                        title: z.string().min(1).max(180),
                        summary: z.string().min(1).max(5000),
                        body: z.string().min(1).max(20000),
                        conversationIds: z.array(z.string().uuid()).min(1).max(500),
                    })).max(50),
                }),
            }, async ({ articles }) => this.result(await this.automation.applyFaqs(articles)));
            register('jobs:delete', 'piranegocios_jobs_delete', {
                description: 'Exclui definitivamente uma vaga. Ação destrutiva, libere somente a integrações administrativas confiáveis.',
                inputSchema: z.object({ id: z.string().uuid() }),
            }, async ({ id }) => this.result(await this.operations.remove(id)));
            return server;
        });
        const nodeHandler = toNodeHandler(handler);
        await nodeHandler(req, res, req.body);
    }
    async createExternal(input, apiClient) {
        const result = await this.jobs.create(input, apiClient);
        if (input?.matchProfile !== undefined && result?.created && result?.job?.id) {
            const matchProfile = await this.jobMatch.acceptProvidedProfile(result.job.id, input.matchProfile);
            return { ...result, matchProfile };
        }
        return result;
    }
    async updateExternal(id, input, apiClient) {
        if (input?.matchProfile !== undefined)
            this.jobMatch.stageProvidedProfile(id, input.matchProfile);
        try {
            const result = await this.jobs.update(id, input, apiClient);
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
    async verifyExternal(id, input, apiClient) {
        if (input?.matchProfile !== undefined)
            this.jobMatch.stageProvidedProfile(id, input.matchProfile);
        try {
            const result = await this.jobs.verify(id, input, apiClient);
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
    matchProfileSchema() {
        return {
            field: 'matchProfile',
            optional: true,
            purpose: 'Permite que uma IA externa envie a ficha estruturada da vaga sem provocar uma segunda chamada de IA interna.',
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
            note: 'A ficha descreve a vaga. Ela nunca define score de candidato; a compatibilidade continua sendo calculada internamente contra cada currículo.',
        };
    }
    async matchProfileStatus(args) {
        const normalizedReady = String(args.ready || 'all').trim().toLowerCase();
        const normalizedActive = String(args.active || 'true').trim().toLowerCase();
        if (!['true', 'false', 'all'].includes(normalizedReady))
            throw new common_1.BadRequestException('ready deve ser true, false ou all.');
        if (!['true', 'false', 'all'].includes(normalizedActive))
            throw new common_1.BadRequestException('active deve ser true, false ou all.');
        const safeLimit = Math.min(500, Math.max(1, Number(args.limit || 500)));
        const cleanCity = String(args.city || '').trim();
        const cleanState = String(args.state || '').trim().toUpperCase();
        if (cleanState && !/^[A-Z]{2}$/.test(cleanState))
            throw new common_1.BadRequestException('state deve ser uma UF com 2 letras.');
        const params = [job_match_service_1.JOB_MATCH_ALGORITHM_VERSION];
        const where = [];
        if (normalizedActive !== 'all') {
            params.push(normalizedActive === 'true');
            where.push(`j.active = $${params.length}`);
        }
        if (cleanCity) {
            params.push(cleanCity);
            where.push(`LOWER(j.city) = LOWER($${params.length})`);
        }
        if (cleanState) {
            params.push(cleanState);
            where.push(`UPPER(j.state) = $${params.length}`);
        }
        const validReadyExpression = `(p.status = 'READY' AND p."algorithmVersion" = $1)`;
        if (normalizedReady === 'true')
            where.push(validReadyExpression);
        if (normalizedReady === 'false')
            where.push(`NOT ${validReadyExpression}`);
        params.push(Math.trunc(safeLimit));
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
         j."reviewStatus",
         j."reviewedAt",
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
                limit: Math.trunc(safeLimit),
                algorithmVersion: job_match_service_1.JOB_MATCH_ALGORITHM_VERSION,
            },
        };
    }
    result(value) {
        return { content: [{ type: 'text', text: this.safeStringify(value) }] };
    }
    safeStringify(value) {
        const seen = new WeakSet();
        return JSON.stringify(value, (_key, nested) => {
            if (typeof nested === 'bigint')
                return nested.toString();
            if (Buffer.isBuffer(nested))
                return { type: 'buffer', base64: nested.toString('base64') };
            if (nested && typeof nested === 'object') {
                if (seen.has(nested))
                    return '[circular]';
                seen.add(nested);
            }
            if (typeof nested === 'function')
                return undefined;
            return nested;
        }, 2);
    }
};
exports.JobsMcpController = JobsMcpController;
__decorate([
    (0, common_1.All)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], JobsMcpController.prototype, "handle", null);
exports.JobsMcpController = JobsMcpController = __decorate([
    (0, common_1.Controller)('jobs/mcp'),
    (0, common_1.UseGuards)(jobs_oauth_guard_1.JobsOAuthGuard),
    __metadata("design:paramtypes", [external_jobs_service_1.ExternalJobsService,
        jobs_operations_service_1.JobsOperationsService,
        job_match_service_1.JobMatchService,
        controlled_ai_automation_service_1.ControlledAiAutomationService,
        typeorm_1.DataSource])
], JobsMcpController);
//# sourceMappingURL=jobs-mcp.controller.js.map