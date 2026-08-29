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
exports.ExternalJobsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const crypto_1 = require("crypto");
const typeorm_2 = require("typeorm");
const job_entity_1 = require("../jobs/entities/job.entity");
const seo_utils_1 = require("../seo/seo.utils");
const external_api_request_entity_1 = require("./entities/external-api-request.entity");
let ExternalJobsService = class ExternalJobsService {
    jobs;
    requests;
    validStates = new Set([
        'AC',
        'AL',
        'AP',
        'AM',
        'BA',
        'CE',
        'DF',
        'ES',
        'GO',
        'MA',
        'MT',
        'MS',
        'MG',
        'PA',
        'PB',
        'PR',
        'PE',
        'PI',
        'RJ',
        'RN',
        'RS',
        'RO',
        'RR',
        'SC',
        'SP',
        'SE',
        'TO',
    ]);
    constructor(jobs, requests) {
        this.jobs = jobs;
        this.requests = requests;
    }
    async check(input, client) {
        const match = await this.findDuplicate(input, client);
        await this.log(client.id, 'CHECK', match.job?.id || null, match.duplicate ? 'DUPLICATE' : 'AVAILABLE', { confidence: match.confidence });
        return match;
    }
    async findDuplicate(input, client) {
        const data = this.sanitize(input, client);
        const fingerprint = (0, crypto_1.createHash)('sha256')
            .update(`${this.normalize(data.title)}|${this.normalize(data.sourceName)}|${this.normalize(data.city)}|${data.state}`)
            .digest('hex');
        const exactWhere = [];
        if (data.sourceExternalId)
            exactWhere.push({
                sourceExternalId: data.sourceExternalId,
                ingestionSourceId: client.id,
                isInternal: false,
            });
        if (data.sourceUrl)
            exactWhere.push({ sourceUrl: data.sourceUrl, isInternal: false });
        if (exactWhere.length > 0) {
            const exact = await this.jobs.findOne({ where: exactWhere });
            if (exact) {
                return {
                    duplicate: true,
                    matchType: 'EXACT',
                    confidence: 1,
                    job: this.publicResult(exact),
                    fingerprint,
                    data,
                    signals: {
                        sameSourceExternalId: data.sourceExternalId &&
                            exact.sourceExternalId === data.sourceExternalId,
                        sameSourceUrl: data.sourceUrl && exact.sourceUrl === data.sourceUrl,
                    },
                };
            }
        }
        const recent = await this.jobs.find({
            where: { isInternal: false },
            order: { createdAt: 'DESC' },
            take: 500,
        });
        let best = null;
        for (const job of recent) {
            const titleScore = this.similarity(data.title, job.title);
            const companyScore = this.similarity(data.companyName, job.companyName || job.sourceName);
            const sameCity = this.normalize(data.city) === this.normalize(job.city || job.location);
            const sameState = data.state === (job.state || 'SP');
            const score = titleScore * 0.5 +
                companyScore * 0.35 +
                (sameCity && sameState ? 0.15 : 0);
            if (!best || score > best.score) {
                best = {
                    job,
                    score,
                    signals: {
                        sameTitle: titleScore > 0.8,
                        sameCompany: companyScore > 0.8,
                        sameCity,
                        sameSourceExternalId: false,
                        sameSourceUrl: false,
                        titleSimilarity: Number(titleScore.toFixed(2)),
                        companySimilarity: Number(companyScore.toFixed(2)),
                    },
                };
            }
        }
        if (best && best.score >= 0.85) {
            return {
                duplicate: true,
                matchType: 'LIKELY',
                confidence: Number(best.score.toFixed(2)),
                job: this.publicResult(best.job),
                fingerprint,
                data,
                signals: best.signals,
            };
        }
        if (best && best.score >= 0.65) {
            return {
                duplicate: false,
                matchType: 'SIMILAR',
                confidence: Number(best.score.toFixed(2)),
                closestJob: this.publicResult(best.job),
                fingerprint,
                data,
                signals: best.signals,
            };
        }
        return {
            duplicate: false,
            matchType: null,
            confidence: best ? Number(best.score.toFixed(2)) : 0,
            closestJob: best ? this.publicResult(best.job) : null,
            fingerprint,
            data,
            signals: best ? best.signals : null,
        };
    }
    async create(input, client) {
        const match = await this.findDuplicate(input, client);
        if (input.allowSimilarDuplicate !== undefined &&
            typeof input.allowSimilarDuplicate !== 'boolean')
            throw new common_1.BadRequestException('allowSimilarDuplicate deve ser true ou false.');
        const overriddenSimilarMatch = match.duplicate &&
            (match.matchType === 'SIMILAR' || match.matchType === 'LIKELY') &&
            input.allowSimilarDuplicate === true;
        if (match.duplicate && !overriddenSimilarMatch) {
            await this.log(client.id, 'CREATE', match.job?.id || null, 'DUPLICATE', { confidence: match.confidence });
            return match;
        }
        const data = match.data;
        const slug = await this.nextSlug(`${data.title}-${data.sourceName}`);
        try {
            const job = await this.jobs.save(this.jobs.create({
                ...data,
                ownerId: `api:${client.id}`,
                companyId: null,
                companyName: data.companyName,
                isExternalListing: true,
                externalFingerprint: match.fingerprint,
                ingestionSourceId: client.id,
                ingestionSourceName: client.name,
                moderationStatus: 'PENDING',
                acceptsPlatformApplications: false,
                active: false,
                slug,
            }));
            await this.log(client.id, 'CREATE', job.id, 'CREATED', null);
            return {
                duplicate: false,
                created: true,
                moderationStatus: job.moderationStatus,
                similarMatchOverridden: overriddenSimilarMatch,
                job: this.publicResult(job),
            };
        }
        catch (error) {
            if (error instanceof typeorm_2.QueryFailedError &&
                error.driverError?.code === '23505') {
                const concurrentMatch = await this.findDuplicate(input, client);
                await this.log(client.id, 'CREATE', concurrentMatch.job?.id || null, 'DUPLICATE', { confidence: concurrentMatch.confidence, concurrent: true });
                return concurrentMatch;
            }
            throw error;
        }
    }
    async update(id, input, client) {
        if (!input || typeof input !== 'object' || Array.isArray(input))
            throw new common_1.BadRequestException('O corpo da requisição deve ser um objeto JSON.');
        for (const field of ['status', 'active', 'moderationStatus']) {
            if (Object.prototype.hasOwnProperty.call(input, field))
                throw new common_1.BadRequestException(`O campo ${field} não pode ser alterado pela API.`);
        }
        const job = await this.jobs.findOne({ where: { id } });
        if (!job || !job.isExternalListing || job.ingestionSourceId !== client.id)
            throw new common_1.NotFoundException('Vaga não encontrada ou não é um cadastro externo gerido por esta API.');
        const merged = {
            title: input.title !== undefined ? input.title : job.title,
            description: input.description !== undefined ? input.description : job.description,
            requirements: input.requirements !== undefined
                ? input.requirements
                : job.requirements,
            sourceName: input.sourceName !== undefined ? input.sourceName : job.sourceName,
            sourceUrl: input.sourceUrl !== undefined ? input.sourceUrl : job.sourceUrl,
            city: input.city !== undefined ? input.city : job.city,
            state: input.state !== undefined ? input.state : job.state,
            type: input.type !== undefined ? input.type : job.type,
            workModel: input.workModel !== undefined ? input.workModel : job.workModel,
            salary: input.salary !== undefined ? input.salary : job.salary,
            estimatedSalary: input.estimatedSalary !== undefined
                ? input.estimatedSalary
                : job.estimatedSalary,
            estimatedSalarySource: input.estimatedSalarySource !== undefined
                ? input.estimatedSalarySource
                : job.estimatedSalarySource,
            estimatedSalarySourceUrl: input.estimatedSalarySourceUrl !== undefined
                ? input.estimatedSalarySourceUrl
                : job.estimatedSalarySourceUrl,
            estimatedSalaryRegion: input.estimatedSalaryRegion !== undefined
                ? input.estimatedSalaryRegion
                : job.estimatedSalaryRegion,
            estimatedSalaryUpdatedAt: input.estimatedSalaryUpdatedAt !== undefined
                ? input.estimatedSalaryUpdatedAt
                : job.estimatedSalaryUpdatedAt,
            pcdMode: input.pcdMode !== undefined ? input.pcdMode : job.pcdMode,
            applicationEmail: input.applicationEmail !== undefined
                ? input.applicationEmail
                : job.applicationEmail,
            applicationWhatsApp: input.applicationWhatsApp !== undefined
                ? input.applicationWhatsApp
                : job.applicationWhatsApp,
            applicationUrl: input.applicationUrl !== undefined
                ? input.applicationUrl
                : job.applicationUrl,
            applicationUrlTitle: input.applicationUrlTitle !== undefined
                ? input.applicationUrlTitle
                : job.applicationUrlTitle,
            externalApplicationInstructions: input.externalApplicationInstructions !== undefined
                ? input.externalApplicationInstructions
                : job.externalApplicationInstructions,
            deadlineDate: input.deadlineDate !== undefined
                ? input.deadlineDate
                : job.deadlineDate,
            isTalentPool: input.isTalentPool !== undefined
                ? input.isTalentPool
                : job.isTalentPool,
            isFlagged: input.isFlagged !== undefined ? input.isFlagged : job.isFlagged,
            flagObservation: input.flagObservation !== undefined
                ? input.flagObservation
                : job.flagObservation,
            companyName: input.companyName !== undefined ? input.companyName : job.companyName,
            sourceExternalId: input.sourceExternalId !== undefined
                ? input.sourceExternalId
                : job.sourceExternalId,
            sourcePublishedAt: input.sourcePublishedAt !== undefined
                ? input.sourcePublishedAt
                : job.sourcePublishedAt,
            lastVerifiedAt: input.lastVerifiedAt !== undefined
                ? input.lastVerifiedAt
                : job.lastVerifiedAt,
            lastSeenAt: input.lastSeenAt !== undefined ? input.lastSeenAt : job.lastSeenAt,
            flagReason: input.flagReason !== undefined ? input.flagReason : job.flagReason,
            flaggedAt: input.flaggedAt !== undefined ? input.flaggedAt : job.flaggedAt,
            flaggedBy: input.flaggedBy !== undefined ? input.flaggedBy : job.flaggedBy,
        };
        const data = this.sanitize(merged, client);
        const fingerprint = (0, crypto_1.createHash)('sha256')
            .update(`${this.normalize(data.title)}|${this.normalize(data.sourceName)}|${this.normalize(data.city)}|${data.state}`)
            .digest('hex');
        const duplicateWhere = [
            { externalFingerprint: fingerprint },
        ];
        if (data.sourceUrl)
            duplicateWhere.push({ sourceUrl: data.sourceUrl });
        const duplicate = await this.jobs.findOne({ where: duplicateWhere });
        if (duplicate && duplicate.id !== job.id)
            throw new common_1.ConflictException('A alteração deixaria esta vaga duplicada de outra já cadastrada.');
        Object.assign(job, data, { externalFingerprint: fingerprint });
        try {
            const updated = await this.jobs.save(job);
            await this.log(client.id, 'UPDATE', job.id, 'UPDATED', null);
            return { updated: true, job: this.publicResult(updated) };
        }
        catch (error) {
            if (error instanceof typeorm_2.QueryFailedError &&
                error.driverError?.code === '23505')
                throw new common_1.ConflictException('A alteração deixaria esta vaga duplicada de outra já cadastrada.');
            throw error;
        }
    }
    async verify(id, input, client) {
        if (!input || typeof input !== 'object' || Array.isArray(input))
            throw new common_1.BadRequestException('O corpo da requisição deve ser um objeto JSON.');
        const job = await this.jobs.findOne({ where: { id } });
        if (!job || !job.isExternalListing)
            throw new common_1.NotFoundException('Vaga não encontrada ou não é um cadastro externo.');
        const validStatuses = [
            'AVAILABLE',
            'NOT_FOUND',
            'CLOSED',
            'EXPIRED',
            'UNCERTAIN',
        ];
        if (!validStatuses.includes(input.status))
            throw new common_1.BadRequestException(`status deve ser um dos seguintes: ${validStatuses.join(', ')}`);
        job.lastVerifiedAt = new Date();
        job.lastSeenAt = new Date();
        if (input.status === 'AVAILABLE') {
            const wasUnavailable = job.isFlagged &&
                ['NOT_FOUND', 'CLOSED', 'EXPIRED'].includes(job.flagReason || '');
            if (job.isFlagged) {
                job.isFlagged = false;
                job.flagReason = null;
                job.flagObservation = null;
            }
            if (job.moderationStatus !== 'APPROVED')
                job.active = false;
            else if (wasUnavailable)
                job.active = true;
        }
        else if (input.status === 'CLOSED' || input.status === 'EXPIRED') {
            job.active = false;
            job.isFlagged = true;
            job.flagReason = input.status;
            job.flagObservation =
                input.observation ||
                    `Vaga marcada como ${input.status} via verificação.`;
            job.flaggedAt = new Date();
            job.flaggedBy = client.name;
        }
        else {
            job.isFlagged = true;
            job.flagReason = input.status;
            job.flagObservation =
                input.observation ||
                    `Vaga sinalizada como ${input.status} via verificação.`;
            job.flaggedAt = new Date();
            job.flaggedBy = client.name;
        }
        const updated = await this.jobs.save(job);
        await this.log(client.id, 'VERIFY', job.id, input.status, null);
        return { verified: true, job: this.publicResult(updated) };
    }
    async list(query, client) {
        const requestedLimit = Number(query.limit || 50);
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100)
            : 50;
        const filters = this.catalogFilters(query);
        const filterHash = (0, crypto_1.createHash)('sha256')
            .update(JSON.stringify(filters))
            .digest('hex');
        const cursor = query.cursor
            ? this.decodeCursor(query.cursor, filterHash, client)
            : null;
        const builder = this.jobs
            .createQueryBuilder('job')
            .andWhere('job."isInternal" = false')
            .orderBy('job.createdAt', 'DESC')
            .addOrderBy('job.id', 'DESC')
            .take(limit + 1);
        if (cursor)
            builder.andWhere('(job."createdAt" < :cursorCreatedAt OR (job."createdAt" = :cursorCreatedAt AND job.id < :cursorId))', { cursorCreatedAt: cursor.createdAt, cursorId: cursor.id });
        if (filters.active !== null)
            builder.andWhere('job.active = :active', { active: filters.active });
        if (filters.external !== null)
            builder.andWhere('job."isExternalListing" = :external', {
                external: filters.external,
            });
        if (filters.city)
            builder.andWhere('LOWER(job.city) = LOWER(:city)', {
                city: filters.city,
            });
        if (filters.state)
            builder.andWhere('UPPER(job.state) = :state', { state: filters.state });
        if (filters.type)
            builder.andWhere('LOWER(job.type) = LOWER(:type)', {
                type: filters.type,
            });
        if (filters.workModel)
            builder.andWhere('LOWER(job."workModel") = LOWER(:workModel)', {
                workModel: filters.workModel,
            });
        if (filters.companyId)
            builder.andWhere('job."companyId" = :companyId', {
                companyId: filters.companyId,
            });
        if (filters.pcdMode)
            builder.andWhere('job."pcdMode" = :pcdMode', {
                pcdMode: filters.pcdMode,
            });
        const searchTokens = this.normalize(filters.q)
            .split(' ')
            .filter((token) => token.length > 1)
            .slice(0, 12);
        const searchable = `translate(lower(concat_ws(' ', job.title, job."companyName", job."sourceName", job.description, job.requirements, job.location, job.city, job.state, job.type, job."workModel", job.salary, job."estimatedSalary", job."estimatedSalarySource", job."estimatedSalaryRegion", job."pcdMode")), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')`;
        searchTokens.forEach((token, index) => builder.andWhere(`${searchable} LIKE :searchToken${index}`, {
            [`searchToken${index}`]: `%${token}%`,
        }));
        const rows = await builder.getMany();
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const last = page.at(-1);
        const nextCursor = hasMore && last
            ? this.encodeCursor(last.createdAt, last.id, filterHash, client)
            : null;
        await this.log(client.id, 'LIST', null, 'OK', {
            filters,
            count: page.length,
            hasMore,
            cursorUsed: Boolean(query.cursor),
        });
        return {
            data: page.map((job) => this.catalogResult(job)),
            pagination: { limit, count: page.length, hasMore, nextCursor },
            filters,
        };
    }
    sanitize(input, client) {
        if (!input || typeof input !== 'object' || Array.isArray(input))
            throw new common_1.BadRequestException('O corpo da requisição deve ser um objeto JSON.');
        const title = this.requiredText(input.title, 'title', 180);
        const description = this.requiredText(input.description, 'description', 20_000);
        const city = this.optionalText(input.city, 'city', 120) || 'Pirassununga';
        const state = (this.optionalText(input.state, 'state', 2) || 'SP').toUpperCase();
        if (!this.validStates.has(state))
            throw new common_1.BadRequestException('state deve ser uma UF brasileira válida.');
        const sourceName = this.optionalText(input.sourceName, 'sourceName', 160) ||
            client.sourceLabel;
        const companyName = this.optionalText(input.companyName, 'companyName', 160) || sourceName;
        const sourceUrl = this.optionalText(input.sourceUrl, 'sourceUrl', 2_000);
        if (sourceUrl && !/^https?:\/\//i.test(sourceUrl))
            throw new common_1.BadRequestException('sourceUrl deve começar com http:// ou https://.');
        const sourceExternalId = this.optionalText(input.sourceExternalId, 'sourceExternalId', 120);
        const pcdMode = (this.optionalText(input.pcdMode, 'pcdMode', 16) || 'GENERAL').toUpperCase();
        if (!['GENERAL', 'INCLUSIVE', 'EXCLUSIVE'].includes(pcdMode))
            throw new common_1.BadRequestException('pcdMode deve ser GENERAL, INCLUSIVE ou EXCLUSIVE.');
        const applicationEmail = this.optionalText(input.applicationEmail, 'applicationEmail', 254)?.toLowerCase() || null;
        if (applicationEmail &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicationEmail))
            throw new common_1.BadRequestException('applicationEmail inválido.');
        const whatsappInput = this.optionalText(input.applicationWhatsApp, 'applicationWhatsApp', 30);
        const applicationWhatsApp = whatsappInput
            ? whatsappInput.replace(/\D/g, '')
            : null;
        if (applicationWhatsApp &&
            (applicationWhatsApp.length < 10 || applicationWhatsApp.length > 13))
            throw new common_1.BadRequestException('applicationWhatsApp deve conter DDD e número, com DDI opcional.');
        const applicationUrl = this.optionalText(input.applicationUrl, 'applicationUrl', 2_000);
        if (applicationUrl && !/^https?:\/\//i.test(applicationUrl))
            throw new common_1.BadRequestException('applicationUrl deve começar com http:// ou https://.');
        const applicationUrlTitle = this.optionalText(input.applicationUrlTitle, 'applicationUrlTitle', 180);
        const deadlineDate = this.optionalText(input.deadlineDate, 'deadlineDate', 10);
        if (deadlineDate && !this.isIsoDate(deadlineDate))
            throw new common_1.BadRequestException('deadlineDate deve usar o formato YYYY-MM-DD.');
        const salary = this.optionalText(input.salary, 'salary', 80);
        let estimatedSalary = this.optionalText(input.estimatedSalary, 'estimatedSalary', 80);
        let estimatedSalarySource = this.optionalText(input.estimatedSalarySource, 'estimatedSalarySource', 160);
        let estimatedSalarySourceUrl = this.optionalText(input.estimatedSalarySourceUrl, 'estimatedSalarySourceUrl', 2_000);
        let estimatedSalaryRegion = this.optionalText(input.estimatedSalaryRegion, 'estimatedSalaryRegion', 160);
        let estimatedSalaryUpdatedAt = this.optionalDate(input.estimatedSalaryUpdatedAt, 'estimatedSalaryUpdatedAt');
        if (estimatedSalarySourceUrl &&
            !/^https?:\/\//i.test(estimatedSalarySourceUrl)) {
            throw new common_1.BadRequestException('estimatedSalarySourceUrl deve começar com http:// ou https://.');
        }
        if (salary) {
            estimatedSalary = null;
            estimatedSalarySource = null;
            estimatedSalarySourceUrl = null;
            estimatedSalaryRegion = null;
            estimatedSalaryUpdatedAt = null;
        }
        else if (estimatedSalary && !estimatedSalarySource) {
            throw new common_1.BadRequestException('estimatedSalarySource é obrigatório quando estimatedSalary for informado.');
        }
        else if (!estimatedSalary) {
            estimatedSalarySource = null;
            estimatedSalarySourceUrl = null;
            estimatedSalaryRegion = null;
            estimatedSalaryUpdatedAt = null;
        }
        return {
            title,
            description,
            city,
            state,
            location: `${city}, ${state}`,
            sourceName,
            sourceUrl,
            requirements: this.optionalText(input.requirements, 'requirements', 20_000),
            type: this.optionalText(input.type, 'type', 40) || 'Não informado',
            workModel: this.optionalText(input.workModel, 'workModel', 40) || 'Não informado',
            salary,
            estimatedSalary,
            estimatedSalarySource,
            estimatedSalarySourceUrl,
            estimatedSalaryRegion,
            estimatedSalaryUpdatedAt,
            pcdMode,
            applicationEmail,
            applicationWhatsApp,
            applicationUrl,
            applicationUrlTitle,
            externalApplicationInstructions: this.optionalText(input.externalApplicationInstructions, 'externalApplicationInstructions', 5_000),
            deadlineDate,
            isTalentPool: this.optionalBoolean(input.isTalentPool, 'isTalentPool') || false,
            isFlagged: this.optionalBoolean(input.isFlagged, 'isFlagged') || false,
            flagObservation: this.optionalText(input.flagObservation, 'flagObservation', 1000),
            companyName,
            sourceExternalId,
            sourcePublishedAt: this.optionalDate(input.sourcePublishedAt, 'sourcePublishedAt'),
            lastVerifiedAt: this.optionalDate(input.lastVerifiedAt, 'lastVerifiedAt'),
            lastSeenAt: this.optionalDate(input.lastSeenAt, 'lastSeenAt'),
            flagReason: this.optionalText(input.flagReason, 'flagReason', 120),
            flaggedAt: this.optionalDate(input.flaggedAt, 'flaggedAt'),
            flaggedBy: this.optionalText(input.flaggedBy, 'flaggedBy', 120),
        };
    }
    optionalBoolean(value, field) {
        if (value === undefined || value === null || value === '')
            return null;
        if (typeof value === 'boolean')
            return value;
        if (value === 'true')
            return true;
        if (value === 'false')
            return false;
        throw new common_1.BadRequestException(`${field} deve ser um valor booleano.`);
    }
    optionalDate(value, field) {
        if (value === undefined || value === null || value === '')
            return null;
        if (value instanceof Date && !isNaN(value.getTime()))
            return value;
        if (typeof value !== 'string')
            throw new common_1.BadRequestException(`${field} deve ser uma string de data (ISO-8601).`);
        const date = new Date(value);
        if (isNaN(date.getTime()))
            throw new common_1.BadRequestException(`${field} deve ser uma data válida.`);
        return date;
    }
    requiredText(value, field, maxLength) {
        const result = this.optionalText(value, field, maxLength);
        if (!result)
            throw new common_1.BadRequestException(`${field} é obrigatório.`);
        return result;
    }
    optionalText(value, field, maxLength) {
        if (value === undefined || value === null || value === '')
            return null;
        if (typeof value !== 'string')
            throw new common_1.BadRequestException(`${field} deve ser texto.`);
        return value.trim().slice(0, maxLength) || null;
    }
    isIsoDate(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (!match)
            return false;
        const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
        return date.toISOString().slice(0, 10) === value;
    }
    normalize(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }
    tokens(value) {
        return new Set(this.normalize(value)
            .split(' ')
            .filter((token) => token.length > 2));
    }
    similarity(left, right) {
        const a = this.tokens(left);
        const b = this.tokens(right);
        if (!a.size || !b.size)
            return 0;
        const intersection = [...a].filter((value) => b.has(value)).length;
        return intersection / (a.size + b.size - intersection);
    }
    catalogFilters(query) {
        const state = this.queryText(query.state, 'state', 2).toUpperCase();
        if (state && !this.validStates.has(state))
            throw new common_1.BadRequestException('state deve ser uma UF brasileira válida.');
        const pcdMode = this.queryText(query.pcdMode, 'pcdMode', 16).toUpperCase();
        if (pcdMode && !['GENERAL', 'INCLUSIVE', 'EXCLUSIVE'].includes(pcdMode))
            throw new common_1.BadRequestException('pcdMode deve ser GENERAL, INCLUSIVE ou EXCLUSIVE.');
        return {
            q: this.queryText(query.q, 'q', 300),
            active: this.queryBoolean(query.active, 'active'),
            external: this.queryBoolean(query.external, 'external'),
            city: this.queryText(query.city, 'city', 120),
            state,
            type: this.queryText(query.type, 'type', 40),
            workModel: this.queryText(query.workModel, 'workModel', 40),
            companyId: this.queryText(query.companyId, 'companyId', 100),
            pcdMode,
        };
    }
    queryText(value, field, maxLength) {
        if (value === undefined || value === null || value === '')
            return '';
        if (typeof value !== 'string')
            throw new common_1.BadRequestException(`${field} deve ser informado uma única vez.`);
        return value.trim().slice(0, maxLength);
    }
    queryBoolean(value, field) {
        if (value === undefined || value === null || value === '')
            return null;
        if (value === 'true')
            return true;
        if (value === 'false')
            return false;
        throw new common_1.BadRequestException(`${field} deve ser true ou false.`);
    }
    encodeCursor(createdAt, id, filterHash, client) {
        const payload = {
            version: 1,
            createdAt: createdAt.toISOString(),
            id,
            filterHash,
        };
        const signature = this.cursorSignature(payload, client);
        return Buffer.from(JSON.stringify({ ...payload, signature })).toString('base64url');
    }
    decodeCursor(token, filterHash, client) {
        try {
            if (typeof token !== 'string' || token.length > 1_024)
                throw new Error('invalid cursor');
            const payload = JSON.parse(Buffer.from(token, 'base64url').toString());
            if (payload.version !== 1 ||
                typeof payload.createdAt !== 'string' ||
                typeof payload.id !== 'string' ||
                typeof payload.filterHash !== 'string' ||
                typeof payload.signature !== 'string' ||
                payload.filterHash !== filterHash ||
                !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(payload.createdAt) ||
                !/^[0-9a-f-]{36}$/i.test(payload.id))
                throw new Error('invalid cursor');
            const expected = this.cursorSignature({
                version: payload.version,
                createdAt: payload.createdAt,
                id: payload.id,
                filterHash: payload.filterHash,
            }, client);
            const suppliedBuffer = Buffer.from(payload.signature);
            const expectedBuffer = Buffer.from(expected);
            if (suppliedBuffer.length !== expectedBuffer.length ||
                !(0, crypto_1.timingSafeEqual)(suppliedBuffer, expectedBuffer))
                throw new Error('invalid cursor');
            return { createdAt: new Date(payload.createdAt), id: payload.id };
        }
        catch {
            throw new common_1.BadRequestException('Cursor inválido, expirado ou incompatível com os filtros atuais.');
        }
    }
    cursorSignature(payload, client) {
        return (0, crypto_1.createHmac)('sha256', client.keyHash)
            .update(`${payload.version}|${payload.createdAt}|${payload.id}|${payload.filterHash}`)
            .digest('base64url');
    }
    catalogResult(job) {
        return {
            id: job.id,
            slug: job.slug,
            title: job.title,
            description: job.description,
            requirements: job.requirements,
            companyId: job.companyId,
            companyName: job.companyName,
            isExternalListing: job.isExternalListing,
            sourceName: job.sourceName,
            sourceUrl: job.sourceUrl,
            city: job.city,
            state: job.state,
            location: job.location,
            type: job.type,
            workModel: job.workModel,
            salary: job.salary,
            estimatedSalary: job.estimatedSalary,
            estimatedSalarySource: job.estimatedSalarySource,
            estimatedSalarySourceUrl: job.estimatedSalarySourceUrl,
            estimatedSalaryRegion: job.estimatedSalaryRegion,
            estimatedSalaryUpdatedAt: job.estimatedSalaryUpdatedAt,
            pcdMode: job.pcdMode,
            deadlineDate: job.deadlineDate,
            acceptsPlatformApplications: job.acceptsPlatformApplications,
            externalApplicationInstructions: job.externalApplicationInstructions,
            applicationEmail: job.applicationEmail,
            applicationWhatsApp: job.applicationWhatsApp,
            applicationUrl: job.applicationUrl,
            applicationUrlTitle: job.applicationUrlTitle,
            isConfidential: job.isConfidential,
            isTalentPool: job.isTalentPool,
            isSponsored: job.isSponsored,
            active: job.active,
            moderationStatus: job.moderationStatus,
            reportCount: job.reportCount,
            ingestionSourceId: job.ingestionSourceId,
            ingestionSourceName: job.ingestionSourceName,
            isFlagged: job.isFlagged,
            flagObservation: job.flagObservation,
            flagReason: job.flagReason,
            flaggedAt: job.flaggedAt,
            flaggedBy: job.flaggedBy,
            sourceExternalId: job.sourceExternalId,
            sourcePublishedAt: job.sourcePublishedAt,
            lastVerifiedAt: job.lastVerifiedAt,
            lastSeenAt: job.lastSeenAt,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
        };
    }
    publicResult(job) {
        return this.catalogResult(job);
    }
    async nextSlug(base) {
        const root = (0, seo_utils_1.slugify)(base) || 'vaga';
        let slug = root;
        let suffix = 2;
        while (await this.jobs.findOne({ where: { slug } }))
            slug = `${root}-${suffix++}`;
        return slug;
    }
    async log(clientId, action, jobId, result, metadata) {
        await this.requests.save(this.requests.create({ clientId, action, jobId, result, metadata }));
    }
};
exports.ExternalJobsService = ExternalJobsService;
exports.ExternalJobsService = ExternalJobsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(job_entity_1.Job)),
    __param(1, (0, typeorm_1.InjectRepository)(external_api_request_entity_1.ExternalApiRequest)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ExternalJobsService);
//# sourceMappingURL=external-jobs.service.js.map