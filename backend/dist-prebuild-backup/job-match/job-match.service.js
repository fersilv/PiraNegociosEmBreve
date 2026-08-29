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
exports.JobMatchService = exports.JOB_MATCH_ALGORITHM_VERSION = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const crypto_1 = require("crypto");
const typeorm_2 = require("typeorm");
const job_entity_1 = require("../jobs/entities/job.entity");
const user_entity_1 = require("../users/entities/user.entity");
const payments_service_1 = require("../payments/payments.service");
const billing_support_service_1 = require("../payments/billing-support.service");
const job_match_ai_service_1 = require("./job-match-ai.service");
exports.JOB_MATCH_ALGORITHM_VERSION = 'job-match-v2';
const GENERIC_ROLE_TOKENS = new Set(['operador', 'operadora', 'auxiliar', 'assistente', 'analista', 'ajudante', 'tecnico', 'tecnica', 'profissional', 'colaborador', 'colaboradora', 'funcionario', 'funcionaria']);
const STOP_WORDS = new Set(['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'em', 'para', 'com', 'e', 'um', 'uma', 'na', 'no', 'por', 'que', 'ao', 'aos']);
let JobMatchService = class JobMatchService {
    jobs;
    users;
    dataSource;
    ai;
    payments;
    billingSupport;
    stagedProvidedProfiles = new Map();
    constructor(jobs, users, dataSource, ai, payments, billingSupport) {
        this.jobs = jobs;
        this.users = users;
        this.dataSource = dataSource;
        this.ai = ai;
        this.payments = payments;
        this.billingSupport = billingSupport;
    }
    normalize(value) {
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').replace(/\s+/g, ' ').trim();
    }
    tokens(value, ignoreGeneric = false) {
        return this.normalize(value).split(' ').filter((token) => token.length > 1 && !STOP_WORDS.has(token) && (!ignoreGeneric || !GENERIC_ROLE_TOKENS.has(token)));
    }
    hash(value) {
        return (0, crypto_1.createHash)('sha256').update(JSON.stringify(value)).digest('hex');
    }
    jobFingerprint(job) {
        return this.hash({ title: job.title, description: job.description, requirements: job.requirements, skills: job.skills, type: job.type, workModel: job.workModel });
    }
    resumeFingerprint(user) {
        return this.hash({
            bio: user.bio,
            experiences: user.experiences,
            education: user.education,
            skills: user.skills,
            courses: user.courses,
            languages: user.languages,
            jobPreferences: user.jobPreferences,
            city: user.city,
            state: user.state,
        });
    }
    stageProvidedProfile(jobId, rawProfile) {
        if (jobId && rawProfile !== undefined)
            this.stagedProvidedProfiles.set(jobId, rawProfile);
    }
    clearStagedProvidedProfile(jobId) {
        this.stagedProvidedProfiles.delete(jobId);
    }
    async storeProvidedProfile(job, rawProfile) {
        try {
            const profile = this.ai.normalizeProvidedProfile(rawProfile);
            const sourceFingerprint = this.jobFingerprint(job);
            const rows = await this.dataSource.query(`INSERT INTO job_match_profiles
          ("jobId", status, "algorithmVersion", "sourceFingerprint", profile, error, "analyzedAt", "updatedAt")
         VALUES ($1, 'READY', $2, $3, $4::jsonb, NULL, now(), now())
         ON CONFLICT ("jobId") DO UPDATE SET
           status = 'READY', "algorithmVersion" = EXCLUDED."algorithmVersion",
           "sourceFingerprint" = EXCLUDED."sourceFingerprint", profile = EXCLUDED.profile,
           error = NULL, "analyzedAt" = now(), "updatedAt" = now()
         RETURNING *`, [job.id, exports.JOB_MATCH_ALGORITHM_VERSION, sourceFingerprint, JSON.stringify(profile)]);
            return { accepted: true, source: 'PROVIDED', profile: rows[0] || null };
        }
        catch (error) {
            return { accepted: false, source: 'PROVIDED', reason: String(error?.message || 'matchProfile inválido').slice(0, 1000) };
        }
    }
    async acceptProvidedProfile(jobId, rawProfile) {
        const job = await this.jobs.findOne({ where: { id: jobId } });
        if (!job)
            throw new common_1.NotFoundException('Vaga não encontrada.');
        this.clearStagedProvidedProfile(jobId);
        return this.storeProvidedProfile(job, rawProfile);
    }
    async analyzeActiveJob(job, force = false) {
        const staged = this.stagedProvidedProfiles.get(job.id);
        if (staged !== undefined) {
            this.stagedProvidedProfiles.delete(job.id);
            const provided = await this.storeProvidedProfile(job, staged);
            if (provided.accepted)
                return provided.profile;
            console.warn(`Provided job match profile rejected for ${job.id}: ${provided.reason}`);
        }
        if (!job.active)
            return null;
        const sourceFingerprint = this.jobFingerprint(job);
        const existing = await this.dataSource.query(`SELECT * FROM job_match_profiles WHERE "jobId" = $1 LIMIT 1`, [job.id]);
        if (!force && existing[0]?.status === 'READY' && existing[0]?.sourceFingerprint === sourceFingerprint && existing[0]?.algorithmVersion === exports.JOB_MATCH_ALGORITHM_VERSION)
            return existing[0];
        await this.dataSource.query(`INSERT INTO job_match_profiles ("jobId", status, "algorithmVersion", "sourceFingerprint", profile, error, "updatedAt")
       VALUES ($1, 'PENDING', $2, $3, NULL, NULL, now())
       ON CONFLICT ("jobId") DO UPDATE SET status = 'PENDING', "algorithmVersion" = EXCLUDED."algorithmVersion",
         "sourceFingerprint" = EXCLUDED."sourceFingerprint", error = NULL, "updatedAt" = now()`, [job.id, exports.JOB_MATCH_ALGORITHM_VERSION, sourceFingerprint]);
        try {
            const profile = await this.ai.analyze(job);
            const rows = await this.dataSource.query(`UPDATE job_match_profiles SET status = 'READY', profile = $2::jsonb, error = NULL, "analyzedAt" = now(), "updatedAt" = now()
         WHERE "jobId" = $1 RETURNING *`, [job.id, JSON.stringify(profile)]);
            return rows[0] || null;
        }
        catch (error) {
            await this.dataSource.query(`UPDATE job_match_profiles SET status = 'ERROR', error = $2, "updatedAt" = now() WHERE "jobId" = $1`, [job.id, String(error?.message || 'Falha ao analisar vaga para matching').slice(0, 2000)]);
            console.error(`Job match profile error for ${job.id}:`, error);
            return null;
        }
    }
    async reanalyzeJob(jobId) {
        const job = await this.jobs.findOne({ where: { id: jobId } });
        if (!job)
            throw new common_1.NotFoundException('Vaga não encontrada.');
        return this.analyzeActiveJob(job, true);
    }
    candidateData(user) {
        const experiences = Array.isArray(user.experiences) ? user.experiences : [];
        const courses = Array.isArray(user.courses) ? user.courses : [];
        const education = Array.isArray(user.education) ? user.education : [];
        const roles = experiences.flatMap((experience) => [experience?.role, ...(Array.isArray(experience?.timeline) ? experience.timeline.map((stage) => stage?.role) : [])]).filter(Boolean).map(String);
        const skills = [
            ...(Array.isArray(user.skills) ? user.skills : []),
            ...experiences.flatMap((experience) => Array.isArray(experience?.skills) ? experience.skills : []),
            ...courses.flatMap((course) => Array.isArray(course?.skills) ? course.skills : []),
        ].filter(Boolean).map(String);
        const experienceText = experiences.flatMap((experience) => [experience?.role, experience?.description, experience?.company, ...(Array.isArray(experience?.timeline) ? experience.timeline.flatMap((stage) => [stage?.role, stage?.description]) : [])]).filter(Boolean).join(' ');
        const educationText = education.flatMap((item) => [item?.degree, item?.fieldOfStudy, item?.institution, item?.description]).filter(Boolean).join(' ');
        const courseText = courses.flatMap((item) => [item?.name, item?.institution, item?.description]).filter(Boolean).join(' ');
        const allText = [user.bio, roles.join(' '), skills.join(' '), experienceText, educationText, courseText].filter(Boolean).join(' ');
        return { roles, skills, experienceText, educationText, courseText, allText };
    }
    phraseScore(term, source, ignoreGeneric = false) {
        const normalizedTerm = this.normalize(term);
        const normalizedSource = this.normalize(source);
        if (!normalizedTerm || !normalizedSource)
            return 0;
        if (normalizedSource.includes(normalizedTerm))
            return 1;
        const wanted = this.tokens(term, ignoreGeneric);
        if (!wanted.length)
            return 0;
        const sourceTokens = new Set(this.tokens(source));
        const overlap = wanted.filter((token) => sourceTokens.has(token)).length;
        const coverage = overlap / wanted.length;
        if (coverage === 1)
            return 0.9;
        if (coverage >= 0.75 && overlap >= 2)
            return 0.72;
        if (coverage >= 0.5 && overlap >= 2)
            return 0.48;
        return 0;
    }
    bestEvidence(terms, sources, ignoreGeneric = false) {
        let best = 0;
        for (const term of terms.filter(Boolean))
            for (const source of sources.filter(Boolean))
                best = Math.max(best, this.phraseScore(term, source, ignoreGeneric));
        return best;
    }
    requirementScore(requirements, candidate, types) {
        const selected = requirements.filter((item) => types.includes(item.type));
        if (!selected.length)
            return { score: 100, evidence: [], missing: [] };
        let weighted = 0;
        let weightTotal = 0;
        const evidence = [];
        const missing = [];
        for (const item of selected) {
            const source = item.type === 'EDUCATION' ? `${candidate.educationText} ${candidate.courseText}` : item.type === 'EXPERIENCE' ? candidate.experienceText : candidate.allText;
            const match = this.bestEvidence([item.label, ...(item.evidenceTerms || [])], [source]);
            const covered = match >= 0.72;
            weighted += (covered ? 1 : match >= 0.48 ? 0.45 : 0) * item.weight;
            weightTotal += item.weight;
            if (covered)
                evidence.push(item.label);
            else if (item.required)
                missing.push(item);
        }
        return { score: weightTotal ? Math.round((weighted / weightTotal) * 100) : 100, evidence, missing };
    }
    locationScore(job, user) {
        if (this.normalize(job.workModel).includes('remot'))
            return 100;
        const preferences = user.jobPreferences?.preferredLocations;
        const accepted = [
            user.city && user.state ? `${user.city}|${user.state}` : '',
            ...(Array.isArray(preferences) ? preferences.map((item) => item?.city && item?.state ? `${item.city}|${item.state}` : '') : []),
        ].filter(Boolean).map((value) => this.normalize(value));
        if (!accepted.length || !job.city || !job.state)
            return 60;
        return accepted.includes(this.normalize(`${job.city}|${job.state}`)) ? 100 : 0;
    }
    scoreJob(job, profile, user) {
        const candidate = this.candidateData(user);
        const occupationTerms = [profile.canonicalRole, profile.occupationalFamily, ...(profile.occupationKeywords || [])].filter(Boolean);
        const roleEvidence = this.bestEvidence(occupationTerms, candidate.roles, true);
        const broaderOccupationEvidence = this.bestEvidence(occupationTerms, [candidate.experienceText], true);
        let technicalWeighted = 0;
        let technicalWeight = 0;
        const evidence = [];
        const missingTechnical = [];
        for (const skill of profile.technicalSkills || []) {
            const match = this.bestEvidence([skill.name, ...(skill.evidenceTerms || [])], [...candidate.skills, candidate.experienceText]);
            const covered = match >= 0.72;
            technicalWeighted += (covered ? 1 : match >= 0.48 ? 0.4 : 0) * skill.weight;
            technicalWeight += skill.weight;
            if (covered)
                evidence.push(skill.name);
            else if (skill.required)
                missingTechnical.push(skill.name);
        }
        const technicalScore = technicalWeight ? Math.round((technicalWeighted / technicalWeight) * 100) : 0;
        let occupationalScore = 0;
        if (roleEvidence >= 0.9)
            occupationalScore = 100;
        else if (roleEvidence >= 0.72)
            occupationalScore = 82;
        else if (roleEvidence >= 0.48)
            occupationalScore = 55;
        else if (broaderOccupationEvidence >= 0.72)
            occupationalScore = 58;
        else if (technicalScore >= 65)
            occupationalScore = 48;
        else if (technicalScore >= 40)
            occupationalScore = 30;
        const experience = this.requirementScore(profile.requirements || [], candidate, ['EXPERIENCE']);
        const education = this.requirementScore(profile.requirements || [], candidate, ['EDUCATION', 'CERTIFICATION', 'LICENSE']);
        const other = this.requirementScore(profile.requirements || [], candidate, ['SKILL', 'OTHER']);
        const preferenceScore = this.locationScore(job, user);
        const effectiveTechnicalScore = Math.round(technicalScore * 0.82 + other.score * 0.18);
        let score = Math.round(occupationalScore * 0.35 + effectiveTechnicalScore * 0.30 + experience.score * 0.20 + education.score * 0.10 + preferenceScore * 0.05);
        const criticalMissing = [
            ...missingTechnical,
            ...experience.missing.map((item) => item.label),
            ...education.missing.filter((item) => item.type === 'CERTIFICATION' || item.type === 'LICENSE').map((item) => item.label),
            ...other.missing.map((item) => item.label),
        ];
        const missingRequirements = Array.from(new Set([...criticalMissing, ...education.missing.map((item) => item.label)])).slice(0, 8);
        if (occupationalScore < 20 && effectiveTechnicalScore < 20)
            score = Math.min(score, 20);
        if (criticalMissing.length >= 2)
            score = Math.min(score, 39);
        else if (criticalMissing.length === 1)
            score = Math.min(score, 49);
        if (preferenceScore === 0)
            score = Math.min(score, 79);
        score = Math.max(0, Math.min(100, score));
        const allEvidence = Array.from(new Set([...evidence, ...experience.evidence, ...education.evidence, ...other.evidence])).slice(0, 8);
        const reason = score >= 75
            ? 'O currículo apresenta aderência ocupacional e técnica consistente com os principais requisitos da vaga.'
            : score >= 55
                ? 'Há aderência relevante, mas ainda existem lacunas profissionais importantes para esta vaga.'
                : score >= 35
                    ? 'A compatibilidade é parcial e depende de competências transferíveis; há requisitos centrais ainda não comprovados.'
                    : 'O currículo não apresenta evidência suficiente de aderência ocupacional ou técnica para esta vaga.';
        return {
            score,
            occupationalScore,
            technicalScore: effectiveTechnicalScore,
            experienceScore: experience.score,
            educationScore: education.score,
            preferenceScore,
            confidence: candidate.roles.length + candidate.skills.length >= 4 ? 'HIGH' : candidate.roles.length > 0 ? 'MEDIUM' : 'LOW',
            evidence: allEvidence,
            missingRequirements,
            reason,
        };
    }
    async cachedScoreForUserJob(user, job, jobProfile, existing) {
        const resumeFingerprint = this.resumeFingerprint(user);
        const cacheValid = existing && existing.resumeFingerprint === resumeFingerprint && existing.jobProfileFingerprint === jobProfile.sourceFingerprint && existing.algorithmVersion === exports.JOB_MATCH_ALGORITHM_VERSION;
        if (cacheValid)
            return existing.result;
        const result = this.scoreJob(job, jobProfile.profile, user);
        await this.dataSource.query(`INSERT INTO job_match_results ("userId", "jobId", "resumeFingerprint", "jobProfileFingerprint", "algorithmVersion", score, result, "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,now())
       ON CONFLICT ("userId", "jobId") DO UPDATE SET
         "resumeFingerprint" = EXCLUDED."resumeFingerprint", "jobProfileFingerprint" = EXCLUDED."jobProfileFingerprint",
         "algorithmVersion" = EXCLUDED."algorithmVersion", score = EXCLUDED.score, result = EXCLUDED.result, "updatedAt" = now()`, [user.id, job.id, resumeFingerprint, jobProfile.sourceFingerprint, exports.JOB_MATCH_ALGORITHM_VERSION, result.score, JSON.stringify(result)]);
        return result;
    }
    rankCompanyExposure(eligible) {
        const organic = eligible.filter((item) => !item.boosted).sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
        const boosted = eligible.filter((item) => item.boosted).sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
        const ranked = [];
        if (organic.length > 0)
            ranked.push(organic.shift());
        while (organic.length > 0 || boosted.length > 0) {
            if (boosted.length > 0)
                ranked.push(boosted.shift());
            for (let i = 0; i < 2 && organic.length > 0; i += 1)
                ranked.push(organic.shift());
            if (organic.length === 0 && boosted.length > 0 && ranked.length > 0) {
                while (boosted.length > 0)
                    ranked.push(boosted.shift());
            }
        }
        return ranked;
    }
    async getStatus(userId) {
        const [product, entitlementRows, lifetimeFree] = await Promise.all([
            this.payments.findProduct('JOB_MATCH_30D', true),
            this.dataSource.query(`SELECT "startsAt", "expiresAt", "paymentId", source, ("expiresAt" > now()) AS active
         FROM user_feature_entitlements
         WHERE "userId" = $1 AND feature = 'JOB_MATCH_PREMIUM' LIMIT 1`, [userId]),
            this.billingSupport.isLifetimeFree(userId),
        ]);
        const entitlement = entitlementRows[0] || null;
        return { product, entitlement, lifetimeFree, active: lifetimeFree || Boolean(entitlement?.active) };
    }
    async getMatches(userId) {
        const status = await this.getStatus(userId);
        if (!status.active)
            return { ...status, matches: [] };
        const user = await this.users.findOne({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('Perfil do usuário não encontrado.');
        const jobs = await this.jobs.find({
            where: { active: true, isInternal: false },
            order: { createdAt: 'DESC' },
        });
        if (!jobs.length)
            return { ...status, matches: [] };
        const jobIds = jobs.map((job) => job.id);
        const profiles = await this.dataSource.query(`SELECT * FROM job_match_profiles WHERE status = 'READY' AND "jobId" = ANY($1::uuid[])`, [jobIds]);
        const profileMap = new Map(profiles.map((row) => [row.jobId, row]));
        const cached = await this.dataSource.query(`SELECT * FROM job_match_results WHERE "userId" = $1 AND "jobId" = ANY($2::uuid[])`, [userId, jobIds]);
        const cacheMap = new Map(cached.map((row) => [row.jobId, row]));
        const matches = [];
        for (const job of jobs) {
            const jobProfile = profileMap.get(job.id);
            if (!jobProfile?.profile)
                continue;
            const result = await this.cachedScoreForUserJob(user, job, jobProfile, cacheMap.get(job.id));
            matches.push({ jobId: job.id, ...result });
        }
        matches.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
        return { ...status, matches };
    }
    async getEarlyAlertRecipientsForJob(jobId) {
        const [job, profileRows, entitlementRows] = await Promise.all([
            this.jobs.findOne({ where: { id: jobId, active: true } }),
            this.dataSource.query(`SELECT * FROM job_match_profiles WHERE "jobId" = $1 AND status = 'READY' LIMIT 1`, [jobId]),
            this.dataSource.query(`SELECT DISTINCT e."userId"
         FROM user_feature_entitlements e
         JOIN users u ON u.id = e."userId"
         WHERE e.feature = 'EARLY_JOB_ALERTS' AND e."expiresAt" > now()
           AND (u.type IS NULL OR u.type = 'CANDIDATE')`),
        ]);
        const jobProfile = profileRows[0];
        const userIds = entitlementRows.map((row) => String(row.userId)).filter(Boolean);
        if (!job || job.isInternal || !jobProfile?.profile || !userIds.length)
            return [];
        const candidates = await this.users.find({ where: { id: (0, typeorm_2.In)(userIds) } });
        const cachedRows = await this.dataSource.query(`SELECT * FROM job_match_results WHERE "jobId" = $1 AND "userId" = ANY($2::varchar[])`, [jobId, userIds]);
        const cacheMap = new Map(cachedRows.map((row) => [row.userId, row]));
        const recipients = [];
        for (const candidate of candidates) {
            const result = await this.cachedScoreForUserJob(candidate, job, jobProfile, cacheMap.get(candidate.id));
            if (Number(result.score || 0) >= 55)
                recipients.push(candidate.id);
        }
        return recipients;
    }
    async getCompanyCandidatesForJob(requestingUserId, jobId, requestedCandidateIds = []) {
        const [requester, job] = await Promise.all([
            this.users.findOne({ where: { id: requestingUserId } }),
            this.jobs.findOne({ where: { id: jobId } }),
        ]);
        if (!requester)
            throw new common_1.ForbiddenException('Usuário não encontrado.');
        if (!job)
            throw new common_1.NotFoundException('Vaga não encontrada.');
        const authorized = requester.type === user_entity_1.UserType.ADMIN || job.ownerId === requestingUserId || Boolean(requester.companyId && job.companyId && requester.companyId === job.companyId);
        if (!authorized)
            throw new common_1.ForbiddenException('Você não pode consultar candidatos para esta vaga.');
        const profileRows = await this.dataSource.query(`SELECT * FROM job_match_profiles WHERE "jobId" = $1 AND status = 'READY' LIMIT 1`, [jobId]);
        const jobProfile = profileRows[0];
        if (!jobProfile?.profile) {
            return { jobId, preparing: true, candidates: [] };
        }
        const uniqueRequestedIds = [...new Set(requestedCandidateIds.filter(Boolean))].slice(0, 200);
        const candidates = uniqueRequestedIds.length
            ? await this.users.find({ where: { id: (0, typeorm_2.In)(uniqueRequestedIds) } })
            : await this.users.createQueryBuilder('candidate')
                .where('candidate."resumeStatus" = :status', { status: 'PUBLISHED' })
                .andWhere('candidate."isOpenToWork" = true')
                .andWhere('(candidate."type" IS NULL OR candidate."type" = :candidateType)', { candidateType: user_entity_1.UserType.CANDIDATE })
                .orderBy('candidate."updatedAt"', 'DESC')
                .take(500)
                .getMany();
        if (!candidates.length)
            return { jobId, preparing: false, candidates: [] };
        const candidateIds = candidates.map((candidate) => candidate.id);
        const [cachedRows, boostRows] = await Promise.all([
            this.dataSource.query(`SELECT * FROM job_match_results WHERE "jobId" = $1 AND "userId" = ANY($2::varchar[])`, [jobId, candidateIds]),
            this.dataSource.query(`SELECT "userId" FROM user_feature_entitlements
         WHERE feature = 'RESUME_BOOST' AND "expiresAt" > now() AND "userId" = ANY($1::varchar[])`, [candidateIds]),
        ]);
        const cacheMap = new Map(cachedRows.map((row) => [row.userId, row]));
        const boosts = new Set(boostRows.map((row) => row.userId));
        const eligible = [];
        for (const candidate of candidates) {
            const result = await this.cachedScoreForUserJob(candidate, job, jobProfile, cacheMap.get(candidate.id));
            if (!uniqueRequestedIds.length && Number(result.score || 0) < 55)
                continue;
            eligible.push({
                candidateId: candidate.id,
                score: Number(result.score || 0),
                boosted: boosts.has(candidate.id),
                reason: String(result.reason || ''),
                evidence: Array.isArray(result.evidence) ? result.evidence : [],
                missingRequirements: Array.isArray(result.missingRequirements) ? result.missingRequirements : [],
                confidence: String(result.confidence || 'LOW'),
                occupationalScore: Number(result.occupationalScore || 0),
                technicalScore: Number(result.technicalScore || 0),
                experienceScore: Number(result.experienceScore || 0),
                educationScore: Number(result.educationScore || 0),
                preferenceScore: Number(result.preferenceScore || 0),
            });
        }
        const ranked = uniqueRequestedIds.length
            ? eligible.sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
            : this.rankCompanyExposure(eligible);
        return {
            jobId,
            preparing: false,
            rankingRule: 'organic_top_then_sponsored_slots',
            candidates: ranked,
        };
    }
};
exports.JobMatchService = JobMatchService;
exports.JobMatchService = JobMatchService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(job_entity_1.Job)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        job_match_ai_service_1.JobMatchAiService,
        payments_service_1.PaymentsService,
        billing_support_service_1.BillingSupportService])
], JobMatchService);
//# sourceMappingURL=job-match.service.js.map