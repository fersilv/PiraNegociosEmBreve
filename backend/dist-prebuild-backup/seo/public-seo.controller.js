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
exports.PublicSeoController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto_1 = require("crypto");
const company_entity_1 = require("../companies/entities/company.entity");
const job_entity_1 = require("../jobs/entities/job.entity");
const seo_utils_1 = require("./seo.utils");
const company_slug_alias_entity_1 = require("../companies/entities/company-slug-alias.entity");
const siteUrl = () => (process.env.PUBLIC_SITE_URL || 'https://piranegocios.com.br').replace(/\/$/, '');
let PublicSeoController = class PublicSeoController {
    companies;
    jobs;
    companySlugAliases;
    recentJobViews = new Map();
    constructor(companies, jobs, companySlugAliases) {
        this.companies = companies;
        this.jobs = jobs;
        this.companySlugAliases = companySlugAliases;
    }
    locationHint(req) {
        const readHeader = (name) => {
            const value = req.headers?.[name];
            return Array.isArray(value) ? value[0] : typeof value === 'string' ? value.trim() : '';
        };
        const latitudeHeader = readHeader('cf-iplatitude');
        const longitudeHeader = readHeader('cf-iplongitude');
        const latitude = latitudeHeader ? Number(latitudeHeader) : Number.NaN;
        const longitude = longitudeHeader ? Number(longitudeHeader) : Number.NaN;
        const city = readHeader('cf-ipcity');
        const state = readHeader('cf-region-code');
        const country = readHeader('cf-ipcountry');
        const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
        return {
            city: city || null,
            state: state || null,
            country: country || null,
            latitude: hasCoordinates ? latitude : null,
            longitude: hasCoordinates ? longitude : null,
            source: city || hasCoordinates ? 'cloudflare' : null,
        };
    }
    async jobsIndex() {
        const jobs = await this.publicJobsQuery().orderBy('job.createdAt', 'DESC').getMany();
        const cityMap = new Map();
        for (const job of jobs) {
            const city = this.cityName(job);
            const slug = (0, seo_utils_1.slugify)(city);
            if (!city || !slug)
                continue;
            const state = job.state?.trim().toUpperCase() || this.stateFromLocation(job.location);
            const updatedAt = job.updatedAt || job.createdAt || new Date();
            const existing = cityMap.get(slug);
            cityMap.set(slug, {
                city,
                state: state || existing?.state || null,
                count: (existing?.count || 0) + 1,
                updatedAt: !existing || updatedAt > existing.updatedAt ? updatedAt : existing.updatedAt,
            });
        }
        return {
            count: jobs.length,
            cities: Array.from(cityMap.entries())
                .map(([slug, value]) => ({ slug, ...value }))
                .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, 'pt-BR')),
            jobs: jobs.map((job) => ({
                id: job.id,
                slug: job.slug,
                title: job.title,
                companyName: job.companyName,
                sourceName: job.sourceName,
                location: job.location,
                city: job.city,
                state: job.state,
                type: job.type,
                workModel: job.workModel,
                salary: job.salary,
                estimatedSalary: job.salary ? null : job.estimatedSalary,
                estimatedSalarySource: job.salary ? null : job.estimatedSalarySource,
                estimatedSalarySourceUrl: job.salary ? null : job.estimatedSalarySourceUrl,
                estimatedSalaryRegion: job.salary ? null : job.estimatedSalaryRegion,
                estimatedSalaryUpdatedAt: job.salary ? null : job.estimatedSalaryUpdatedAt,
                applicationUrl: job.applicationUrl,
                applicationUrlTitle: job.applicationUrlTitle,
                sourcePublishedAt: job.sourcePublishedAt,
                createdAt: job.createdAt,
                updatedAt: job.updatedAt,
            })),
        };
    }
    async slugAvailability(value) {
        const slug = (0, seo_utils_1.slugify)(value || '');
        if (!slug || (0, seo_utils_1.isReservedCompanySlug)(slug))
            return { slug, available: false };
        const [exists, alias] = await Promise.all([
            this.companies.exists({ where: [{ slug }, { pendingSlug: slug }] }),
            this.companySlugAliases.exists({ where: { slug, expiresAt: (0, typeorm_2.MoreThan)(new Date()) } }),
        ]);
        return { slug, available: !exists && !alias };
    }
    async company(slug) {
        let company = await this.companies.findOne({
            where: { slug, verificationStatus: company_entity_1.CompanyStatus.VERIFIED },
        });
        let resolvedFromAlias = false;
        if (!company) {
            const alias = await this.companySlugAliases.findOne({
                where: { slug, expiresAt: (0, typeorm_2.MoreThan)(new Date()) },
            });
            if (alias) {
                company = await this.companies.findOne({
                    where: { id: alias.companyId, verificationStatus: company_entity_1.CompanyStatus.VERIFIED },
                });
                resolvedFromAlias = Boolean(company);
            }
        }
        if (!company)
            throw new common_1.NotFoundException('Empresa pública não encontrada.');
        const jobs = await this.jobs
            .createQueryBuilder('job')
            .where('job.companyId = :companyId', { companyId: company.id })
            .andWhere('job.active = true')
            .andWhere('job.isConfidential = false')
            .andWhere('job."isInternal" = false')
            .andWhere('(job.deadlineDate IS NULL OR job.deadlineDate >= CURRENT_DATE)')
            .orderBy('job.createdAt', 'DESC')
            .getMany();
        return {
            company: this.publicCompany(company),
            jobs: jobs.map((job) => this.publicJob(job, company)),
            resolvedFromAlias,
        };
    }
    async job(slug) {
        const job = await this.findPublicJob('slug', slug);
        const company = await this.publicJobCompany(job);
        return this.publicJob(job, company);
    }
    async jobsByCity(citySlug) {
        const normalizedSlug = (0, seo_utils_1.slugify)(citySlug);
        const jobs = await this.publicJobsQuery().orderBy('job.createdAt', 'DESC').getMany();
        const matching = jobs.filter((job) => (0, seo_utils_1.slugify)(this.cityName(job)) === normalizedSlug);
        if (!matching.length)
            throw new common_1.NotFoundException('Não há vagas públicas ativas para esta cidade.');
        const city = this.cityName(matching[0]);
        const state = matching.find((job) => job.state)?.state || this.stateFromLocation(matching[0].location);
        const publicJobs = await Promise.all(matching.map(async (job) => this.publicJob(job, await this.publicJobCompany(job))));
        return {
            city,
            state: state || null,
            slug: normalizedSlug,
            count: publicJobs.length,
            jobs: publicJobs,
            updatedAt: matching.reduce((latest, job) => {
                const value = job.updatedAt || job.createdAt;
                return !latest || value > latest ? value : latest;
            }, null),
        };
    }
    async registerJobView(id, req) {
        const job = await this.findPublicJob('id', id);
        await this.publicJobCompany(job);
        return this.incrementJobView(job, req);
    }
    async registerJobViewBySlug(slug, req) {
        const job = await this.findPublicJob('slug', slug);
        await this.publicJobCompany(job);
        return this.incrementJobView(job, req);
    }
    async sitemap(response) {
        const [companies, jobs] = await Promise.all([
            this.companies.find({
                where: { verificationStatus: company_entity_1.CompanyStatus.VERIFIED },
                select: { slug: true, updatedAt: true },
            }),
            this.publicJobsQuery()
                .select([
                'job.id', 'job.slug', 'job.city', 'job.state', 'job.location',
                'job.updatedAt', 'job.createdAt',
            ])
                .getMany(),
        ]);
        const cityMap = new Map();
        for (const job of jobs) {
            const city = this.cityName(job);
            const slug = (0, seo_utils_1.slugify)(city);
            if (!slug)
                continue;
            const lastmod = job.updatedAt || job.createdAt || new Date();
            const existing = cityMap.get(slug);
            if (!existing || lastmod > existing.lastmod)
                cityMap.set(slug, { name: city, lastmod });
        }
        const urls = [
            { loc: `${siteUrl()}/`, lastmod: new Date() },
            { loc: `${siteUrl()}/vagas`, lastmod: new Date() },
            { loc: `${siteUrl()}/criador-de-curriculo`, lastmod: new Date() },
            ...Array.from(cityMap.entries()).map(([slug, city]) => ({
                loc: `${siteUrl()}/vagas-em/${slug}`,
                lastmod: city.lastmod,
            })),
            ...companies
                .filter((company) => company.slug)
                .map((company) => ({
                loc: `${siteUrl()}/${company.slug}`,
                lastmod: company.updatedAt || new Date(),
            })),
            ...jobs
                .filter((job) => job.slug)
                .map((job) => ({
                loc: `${siteUrl()}/vagas/${job.slug}`,
                lastmod: job.updatedAt || new Date(),
            })),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => {
            const d = url.lastmod instanceof Date && !isNaN(url.lastmod.getTime()) ? url.lastmod : new Date();
            return `  <url><loc>${this.escapeXml(url.loc)}</loc><lastmod>${d.toISOString().slice(0, 10)}</lastmod></url>`;
        }).join('\n')}\n</urlset>`;
        response.type('application/xml').send(xml);
    }
    async incrementJobView(job, req) {
        const forwarded = String(req.headers?.['cf-connecting-ip'] || req.headers?.['x-forwarded-for'] || req.ip || '')
            .split(',')[0]
            .trim();
        const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 220);
        const visitorHash = (0, crypto_1.createHash)('sha256')
            .update(`${forwarded}|${userAgent}`)
            .digest('hex')
            .slice(0, 24);
        const key = `${job.id}:${visitorHash}`;
        const now = Date.now();
        const previous = this.recentJobViews.get(key);
        if (previous && now - previous < 8_000) {
            const current = await this.jobs.findOne({ where: { id: job.id }, select: { views: true } });
            return { views: Number(current?.views || job.views || 0), counted: false };
        }
        this.recentJobViews.set(key, now);
        if (this.recentJobViews.size > 5_000) {
            const cutoff = now - 60_000;
            for (const [entryKey, timestamp] of this.recentJobViews.entries()) {
                if (timestamp < cutoff)
                    this.recentJobViews.delete(entryKey);
            }
        }
        await this.jobs.increment({ id: job.id }, 'views', 1);
        const updated = await this.jobs.findOne({ where: { id: job.id }, select: { views: true } });
        return { views: Number(updated?.views || Number(job.views || 0) + 1), counted: true };
    }
    publicJobsQuery() {
        return this.jobs
            .createQueryBuilder('job')
            .leftJoin(company_entity_1.Company, 'company', 'company.id::varchar = job.companyId')
            .where('job.active = true')
            .andWhere('job.isConfidential = false')
            .andWhere('job."isInternal" = false')
            .andWhere('job.slug IS NOT NULL')
            .andWhere('(job.companyId IS NULL OR company.verificationStatus = :status)', { status: company_entity_1.CompanyStatus.VERIFIED })
            .andWhere('(job.deadlineDate IS NULL OR job.deadlineDate >= CURRENT_DATE)');
    }
    cityName(job) {
        const explicit = job.city?.trim();
        if (explicit)
            return explicit;
        const location = String(job.location || '').trim();
        if (!location || /^remoto$/i.test(location))
            return '';
        return location
            .split(',')[0]
            .trim()
            .replace(/\s*\/\s*[A-Z]{2}$/i, '')
            .trim();
    }
    stateFromLocation(location) {
        const value = String(location || '');
        const match = value.match(/(?:,|\/)\s*([A-Z]{2})\s*$/i);
        return match ? match[1].toUpperCase() : null;
    }
    async findPublicJob(field, value) {
        const job = await this.jobs
            .createQueryBuilder('job')
            .where(`job.${field} = :value`, { value })
            .andWhere('job.active = true')
            .andWhere('job.isConfidential = false')
            .andWhere('job."isInternal" = false')
            .andWhere('(job.deadlineDate IS NULL OR job.deadlineDate >= CURRENT_DATE)')
            .getOne();
        if (!job)
            throw new common_1.NotFoundException('Vaga pública não encontrada.');
        return job;
    }
    async publicJobCompany(job) {
        const company = job.companyId
            ? await this.companies.findOne({
                where: { id: job.companyId, verificationStatus: company_entity_1.CompanyStatus.VERIFIED },
            })
            : null;
        if (job.companyId && !company)
            throw new common_1.NotFoundException('Vaga pública não encontrada.');
        return company;
    }
    publicCompany(company) {
        return {
            id: company.id,
            name: company.name,
            slug: company.slug,
            description: company.description,
            website: company.website,
            address: company.address,
            cityState: company.cityState,
            city: company.city,
            state: company.state,
            phone: company.phone,
            logoURL: company.logoURL,
            socialInstagram: company.socialInstagram,
            socialLinkedin: company.socialLinkedin,
            socialFacebook: company.socialFacebook,
            updatedAt: company.updatedAt,
        };
    }
    publicJob(job, company) {
        const hasOfficialSalary = Boolean(job.salary?.trim());
        return {
            id: job.id,
            slug: job.slug,
            title: job.title,
            description: job.description,
            requirements: job.requirements,
            location: job.location,
            city: job.city,
            state: job.state,
            type: job.type,
            workModel: job.workModel,
            salary: job.salary,
            estimatedSalary: hasOfficialSalary ? null : job.estimatedSalary,
            estimatedSalarySource: hasOfficialSalary ? null : job.estimatedSalarySource,
            estimatedSalarySourceUrl: hasOfficialSalary ? null : job.estimatedSalarySourceUrl,
            estimatedSalaryRegion: hasOfficialSalary ? null : job.estimatedSalaryRegion,
            estimatedSalaryUpdatedAt: hasOfficialSalary ? null : job.estimatedSalaryUpdatedAt,
            pcdMode: job.pcdMode,
            isTalentPool: job.isTalentPool,
            acceptsPlatformApplications: job.acceptsPlatformApplications,
            requiresResumeFile: job.requiresResumeFile,
            externalApplicationInstructions: job.externalApplicationInstructions,
            applicationEmail: job.applicationEmail,
            applicationWhatsApp: job.applicationWhatsApp,
            applicationUrl: job.applicationUrl,
            applicationUrlTitle: job.applicationUrlTitle,
            deadlineDate: job.deadlineDate,
            sourcePublishedAt: job.sourcePublishedAt,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            views: job.views,
            company: company ? this.publicCompany(company) : null,
            companyName: job.isConfidential ? null : (company?.name || job.companyName || null),
            isExternalListing: job.isExternalListing,
            sourceName: job.sourceName,
            sourceUrl: job.sourceUrl,
        };
    }
    escapeXml(value) {
        return value.replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] || character);
    }
};
exports.PublicSeoController = PublicSeoController;
__decorate([
    (0, common_1.Get)('public/location-hint'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PublicSeoController.prototype, "locationHint", null);
__decorate([
    (0, common_1.Get)('public/jobs-index'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PublicSeoController.prototype, "jobsIndex", null);
__decorate([
    (0, common_1.Get)('public/slug-availability'),
    __param(0, (0, common_1.Query)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PublicSeoController.prototype, "slugAvailability", null);
__decorate([
    (0, common_1.Get)('public/companies/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PublicSeoController.prototype, "company", null);
__decorate([
    (0, common_1.Get)('public/jobs/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PublicSeoController.prototype, "job", null);
__decorate([
    (0, common_1.Get)('public/jobs-by-city/:citySlug'),
    __param(0, (0, common_1.Param)('citySlug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PublicSeoController.prototype, "jobsByCity", null);
__decorate([
    (0, common_1.Post)('public/jobs/:id/view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PublicSeoController.prototype, "registerJobView", null);
__decorate([
    (0, common_1.Post)('public/jobs-by-slug/:slug/view'),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PublicSeoController.prototype, "registerJobViewBySlug", null);
__decorate([
    (0, common_1.Get)('seo/sitemap'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PublicSeoController.prototype, "sitemap", null);
exports.PublicSeoController = PublicSeoController = __decorate([
    (0, common_1.Controller)(),
    __param(0, (0, typeorm_1.InjectRepository)(company_entity_1.Company)),
    __param(1, (0, typeorm_1.InjectRepository)(job_entity_1.Job)),
    __param(2, (0, typeorm_1.InjectRepository)(company_slug_alias_entity_1.CompanySlugAlias)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], PublicSeoController);
//# sourceMappingURL=public-seo.controller.js.map