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
exports.CompanyWhatsAppPremiumService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const applications_service_1 = require("../applications/applications.service");
const application_entity_1 = require("../applications/entities/application.entity");
const company_candidate_note_entity_1 = require("../companies/entities/company-candidate-note.entity");
const company_talent_folder_entity_1 = require("../companies/entities/company-talent-folder.entity");
const company_talent_record_entity_1 = require("../companies/entities/company-talent-record.entity");
const talent_invites_service_1 = require("../companies/talent-invites.service");
const job_entity_1 = require("../jobs/entities/job.entity");
const user_entity_1 = require("../users/entities/user.entity");
const company_plans_service_1 = require("./company-plans.service");
let CompanyWhatsAppPremiumService = class CompanyWhatsAppPremiumService {
    jobs;
    applications;
    users;
    folders;
    talentRecords;
    candidateNotes;
    appsService;
    talentInvites;
    plans;
    constructor(jobs, applications, users, folders, talentRecords, candidateNotes, appsService, talentInvites, plans) {
        this.jobs = jobs;
        this.applications = applications;
        this.users = users;
        this.folders = folders;
        this.talentRecords = talentRecords;
        this.candidateNotes = candidateNotes;
        this.appsService = appsService;
        this.talentInvites = talentInvites;
        this.plans = plans;
    }
    async companyJob(companyId, jobId) {
        const job = await this.jobs.findOne({ where: { id: jobId, companyId } });
        if (!job)
            throw new common_1.NotFoundException('Vaga da empresa não encontrada.');
        return job;
    }
    async companyApplication(companyId, applicationId) {
        const application = await this.applications.findOne({
            where: { id: applicationId },
        });
        if (!application)
            throw new common_1.NotFoundException('Candidatura não encontrada.');
        const job = await this.companyJob(companyId, application.jobId);
        return { application, job };
    }
    parseStatus(value) {
        const raw = String(value || '').trim();
        const aliases = {
            PENDING: application_entity_1.ApplicationStatus.PENDING,
            ENVIADO: application_entity_1.ApplicationStatus.PENDING,
            REVIEWING: application_entity_1.ApplicationStatus.REVIEWING,
            'EM ANALISE': application_entity_1.ApplicationStatus.REVIEWING,
            'EM ANÁLISE': application_entity_1.ApplicationStatus.REVIEWING,
            DOCUMENTS_REQUESTED: application_entity_1.ApplicationStatus.DOCUMENTS_REQUESTED,
            'EM CONTRATACAO': application_entity_1.ApplicationStatus.DOCUMENTS_REQUESTED,
            'EM CONTRATAÇÃO': application_entity_1.ApplicationStatus.DOCUMENTS_REQUESTED,
            DOCUMENTS_SUBMITTED: application_entity_1.ApplicationStatus.DOCUMENTS_SUBMITTED,
            'DOCUMENTOS EM ANALISE': application_entity_1.ApplicationStatus.DOCUMENTS_SUBMITTED,
            'DOCUMENTOS EM ANÁLISE': application_entity_1.ApplicationStatus.DOCUMENTS_SUBMITTED,
            HIRED: application_entity_1.ApplicationStatus.HIRED,
            APROVADO: application_entity_1.ApplicationStatus.HIRED,
            CONTRATADO: application_entity_1.ApplicationStatus.HIRED,
            REJECTED: application_entity_1.ApplicationStatus.REJECTED,
            RECUSADO: application_entity_1.ApplicationStatus.REJECTED,
            WITHDRAWN: application_entity_1.ApplicationStatus.WITHDRAWN,
            DESISTIU: application_entity_1.ApplicationStatus.WITHDRAWN,
        };
        const key = raw.toUpperCase();
        const status = aliases[key];
        if (!status) {
            throw new common_1.BadRequestException('Status inválido. Use PENDING, REVIEWING, DOCUMENTS_REQUESTED, DOCUMENTS_SUBMITTED, HIRED, REJECTED ou WITHDRAWN.');
        }
        return status;
    }
    candidateName(candidate) {
        return String(candidate?.socialName ||
            candidate?.displayName ||
            candidate?.fullName ||
            candidate?.email ||
            'Candidato').trim();
    }
    async setJobState(companyId, jobId, action) {
        await this.plans.assertWhatsAppFeature(companyId, action === 'ACTIVATE'
            ? 'JOB_ACTIVATE'
            : action === 'CLOSE'
                ? 'JOB_CLOSE'
                : 'JOB_DEACTIVATE');
        const job = await this.companyJob(companyId, jobId);
        if (action === 'ACTIVATE') {
            job.active = true;
            if (job.deadlineDate && job.deadlineDate < new Date().toISOString().slice(0, 10)) {
                job.deadlineDate = null;
            }
        }
        else {
            job.active = false;
            if (action === 'CLOSE')
                job.deadlineDate = new Date().toISOString().slice(0, 10);
        }
        await this.jobs.save(job);
        return {
            id: job.id,
            title: job.title,
            active: job.active,
            deadlineDate: job.deadlineDate,
            action,
        };
    }
    async listCandidates(companyId, jobId) {
        await this.plans.assertWhatsAppFeature(companyId, 'CANDIDATES_DETAIL');
        const job = await this.companyJob(companyId, jobId);
        const rows = await this.appsService.findAllForJob(job.id);
        return {
            job: { id: job.id, title: job.title },
            count: rows.length,
            candidates: rows.slice(0, 30).map((row) => ({
                applicationId: row.id,
                candidateId: row.candidateId,
                status: row.status,
                priority: row.priority,
                appliedAt: row.createdAt,
                name: row.candidateProfile?.name,
                email: row.candidateProfile?.email,
                phone: row.candidateProfile?.phone,
                city: row.candidateProfile?.city,
                state: row.candidateProfile?.state,
                skills: row.candidateProfile?.skills,
                resumeStatus: row.candidateProfile?.resumeStatus,
            })),
        };
    }
    async candidateProfile(companyId, candidateId) {
        await this.plans.assertWhatsAppFeature(companyId, 'CANDIDATE_PROFILE');
        const application = await this.applications
            .createQueryBuilder('application')
            .innerJoin(job_entity_1.Job, 'job', 'job.id = application."jobId"')
            .where('application."candidateId" = :candidateId', { candidateId })
            .andWhere('job."companyId" = :companyId', { companyId })
            .orderBy('application."createdAt"', 'DESC')
            .getOne();
        if (!application) {
            throw new common_1.NotFoundException('Este candidato não possui candidatura em uma vaga da empresa.');
        }
        const candidate = await this.users.findOne({ where: { id: candidateId } });
        if (!candidate)
            throw new common_1.NotFoundException('Candidato não encontrado.');
        return {
            applicationId: application.id,
            candidate: {
                id: candidate.id,
                name: this.candidateName(candidate),
                email: candidate.email,
                phone: candidate.phone,
                additionalPhones: candidate.additionalPhones,
                city: candidate.city,
                state: candidate.state,
                bio: candidate.bio,
                experiences: candidate.experiences,
                education: candidate.education,
                skills: candidate.skills,
                courses: candidate.courses,
                languages: candidate.languages,
                linkedinURL: candidate.linkedinURL,
                salaryExpectation: candidate.salaryExpectation,
                resumeURL: candidate.resumeURL,
                resumeStatus: candidate.resumeStatus,
                publishedResumeSnapshot: candidate.publishedResumeSnapshot,
            },
        };
    }
    async updateApplicationStatus(companyId, applicationId, statusInput, actor) {
        await this.plans.assertWhatsAppFeature(companyId, 'APPLICATION_STATUS');
        const { application } = await this.companyApplication(companyId, applicationId);
        const status = this.parseStatus(statusInput);
        return this.appsService.updateByCompany(application.id, { status }, actor);
    }
    async addApplicationNote(companyId, applicationId, note, actor) {
        await this.plans.assertWhatsAppFeature(companyId, 'APPLICATION_NOTE');
        const { application } = await this.companyApplication(companyId, applicationId);
        const text = String(note || '').trim().slice(0, 3000);
        if (!text)
            throw new common_1.BadRequestException('Escreva a observação que deseja registrar.');
        const observations = [
            ...(Array.isArray(application.observations) ? application.observations : []),
            text,
        ];
        return this.appsService.updateByCompany(application.id, { observations }, actor);
    }
    async inviteCandidate(company, jobId, candidateId, actorId) {
        await this.plans.assertWhatsAppFeature(company.id, 'CANDIDATE_INVITE');
        const [job, candidate] = await Promise.all([
            this.companyJob(company.id, jobId),
            this.users.findOne({ where: { id: candidateId } }),
        ]);
        if (!job.active)
            throw new common_1.BadRequestException('A vaga precisa estar ativa para convidar candidatos.');
        if (!candidate?.isOpenToWork) {
            throw new common_1.BadRequestException('Este candidato não está disponível no Banco de Talentos.');
        }
        const result = await this.talentInvites.inviteRegisteredCandidate({
            company,
            job,
            candidate,
            invitedById: actorId,
        });
        return {
            inviteId: result.invite.id,
            candidateId,
            candidateName: this.candidateName(candidate),
            jobId: job.id,
            jobTitle: job.title,
            status: result.invite.status,
            delivery: result.delivery,
        };
    }
    async cancelInvite(companyId, inviteId) {
        await this.plans.assertWhatsAppFeature(companyId, 'CANDIDATE_INVITE_CANCEL');
        return this.talentInvites.cancelPending(companyId, inviteId);
    }
    async listInvites(companyId) {
        await this.plans.assertWhatsAppFeature(companyId, 'CANDIDATE_INVITE');
        return this.talentInvites.listForCompany(companyId);
    }
    async listTalentFolders(companyId) {
        await this.plans.assertWhatsAppFeature(companyId, 'TALENT_MANAGE');
        return this.folders.find({ where: { companyId }, order: { name: 'ASC' } });
    }
    async saveTalent(companyId, candidateId, folderIds, jobIds) {
        await this.plans.assertWhatsAppFeature(companyId, 'TALENT_MANAGE');
        const candidate = await this.users.findOne({ where: { id: candidateId } });
        if (!candidate?.isOpenToWork) {
            throw new common_1.BadRequestException('Este candidato não está disponível no Banco de Talentos.');
        }
        const record = (await this.talentRecords.findOne({ where: { companyId, candidateId } })) ||
            this.talentRecords.create({ companyId, candidateId, folderIds: [], jobIds: [] });
        if (Array.isArray(folderIds))
            record.folderIds = [...new Set(folderIds)];
        if (Array.isArray(jobIds))
            record.jobIds = [...new Set(jobIds)];
        return this.talentRecords.save(record);
    }
    async removeTalent(companyId, candidateId, folderId) {
        await this.plans.assertWhatsAppFeature(companyId, 'TALENT_MANAGE');
        const record = await this.talentRecords.findOne({ where: { companyId, candidateId } });
        if (!record)
            return { removed: false };
        if (folderId) {
            record.folderIds = (record.folderIds || []).filter((id) => id !== folderId);
            return this.talentRecords.save(record);
        }
        await this.talentRecords.remove(record);
        return { removed: true, candidateId };
    }
    async addTalentNote(companyId, candidateId, actorId, note) {
        await this.plans.assertWhatsAppFeature(companyId, 'TALENT_MANAGE');
        const record = await this.talentRecords.findOne({ where: { companyId, candidateId } });
        if (!record)
            throw new common_1.BadRequestException('Salve o candidato no Banco de Talentos antes de registrar histórico.');
        const body = String(note || '').trim().slice(0, 3000);
        if (!body)
            throw new common_1.BadRequestException('Escreva uma observação.');
        return this.candidateNotes.save(this.candidateNotes.create({ recordId: record.id, authorId: actorId, body, type: 'NOTE' }));
    }
    startOfWindow(value) {
        const normalized = String(value || '').toLowerCase();
        const now = new Date();
        if (normalized.includes('ontem'))
            return new Date(now.getTime() - 48 * 60 * 60 * 1000);
        if (normalized.includes('7') || normalized.includes('semana'))
            return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (normalized.includes('hoje')) {
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Sao_Paulo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).formatToParts(now);
            const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
            return new Date(`${values.year}-${values.month}-${values.day}T00:00:00-03:00`);
        }
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    async recentApplications(companyId, window) {
        await this.plans.assertWhatsAppFeature(companyId, 'RECENT_APPLICATIONS');
        const since = this.startOfWindow(window);
        const rows = await this.applications
            .createQueryBuilder('application')
            .innerJoin(job_entity_1.Job, 'job', 'job.id = application."jobId"')
            .where('job."companyId" = :companyId', { companyId })
            .andWhere('application."createdAt" >= :since', { since })
            .orderBy('application."createdAt"', 'DESC')
            .take(40)
            .getMany();
        const candidateIds = [...new Set(rows.map((row) => row.candidateId))];
        const candidates = candidateIds.length
            ? await this.users
                .createQueryBuilder('user')
                .where('user.id IN (:...candidateIds)', { candidateIds })
                .getMany()
            : [];
        const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));
        return {
            since,
            count: rows.length,
            applications: rows.map((row) => ({
                applicationId: row.id,
                candidateId: row.candidateId,
                candidateName: this.candidateName(candidateMap.get(row.candidateId)),
                jobId: row.jobId,
                jobTitle: row.jobTitle,
                status: row.status,
                createdAt: row.createdAt,
            })),
        };
    }
    async jobStats(companyId, jobId) {
        await this.plans.assertWhatsAppFeature(companyId, 'ADVANCED_JOB_STATS');
        const jobs = jobId
            ? [await this.companyJob(companyId, jobId)]
            : await this.jobs.find({ where: { companyId }, order: { createdAt: 'DESC' } });
        const result = [];
        for (const job of jobs.slice(0, 30)) {
            const statusRows = await this.applications
                .createQueryBuilder('application')
                .select('application.status', 'status')
                .addSelect('COUNT(*)', 'count')
                .where('application."jobId" = :jobId', { jobId: job.id })
                .groupBy('application.status')
                .getRawMany();
            const total = statusRows.reduce((sum, row) => sum + Number(row.count || 0), 0);
            const new24h = await this.applications
                .createQueryBuilder('application')
                .where('application."jobId" = :jobId', { jobId: job.id })
                .andWhere('application."createdAt" >= :since', {
                since: new Date(Date.now() - 24 * 60 * 60 * 1000),
            })
                .getCount();
            result.push({
                jobId: job.id,
                title: job.title,
                active: job.active,
                views: job.views,
                applications: total,
                newApplications24h: new24h,
                conversionPercent: job.views > 0 ? Math.round((total / job.views) * 1000) / 10 : 0,
                byStatus: Object.fromEntries(statusRows.map((row) => [row.status, Number(row.count || 0)])),
                deadlineDate: job.deadlineDate,
            });
        }
        return result;
    }
    async candidateWhatsAppTarget(companyId, candidateId) {
        await this.plans.assertWhatsAppFeature(companyId, 'CANDIDATE_WHATSAPP');
        const hasRelationship = await this.applications
            .createQueryBuilder('application')
            .innerJoin(job_entity_1.Job, 'job', 'job.id = application."jobId"')
            .where('application."candidateId" = :candidateId', { candidateId })
            .andWhere('job."companyId" = :companyId', { companyId })
            .getCount();
        if (!hasRelationship) {
            throw new common_1.BadRequestException('Este candidato não possui relação de recrutamento com a empresa.');
        }
        const candidate = await this.users.findOne({ where: { id: candidateId } });
        if (!candidate)
            throw new common_1.NotFoundException('Candidato não encontrado.');
        const raw = String(candidate.whatsappId || candidate.whatsappPhoneE164 || candidate.phone || '').trim();
        const digits = raw.split('@')[0].replace(/\D/g, '');
        if (!digits || !candidate.whatsappVerifiedAt) {
            throw new common_1.BadRequestException('O candidato não possui WhatsApp verificado no PiraNegócios.');
        }
        const normalized = digits.startsWith('55') ? digits : `55${digits}`;
        return {
            candidateId,
            candidateName: this.candidateName(candidate),
            chatId: raw.includes('@') ? raw : `${normalized}@c.us`,
        };
    }
};
exports.CompanyWhatsAppPremiumService = CompanyWhatsAppPremiumService;
exports.CompanyWhatsAppPremiumService = CompanyWhatsAppPremiumService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(job_entity_1.Job)),
    __param(1, (0, typeorm_1.InjectRepository)(application_entity_1.Application)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(3, (0, typeorm_1.InjectRepository)(company_talent_folder_entity_1.CompanyTalentFolder)),
    __param(4, (0, typeorm_1.InjectRepository)(company_talent_record_entity_1.CompanyTalentRecord)),
    __param(5, (0, typeorm_1.InjectRepository)(company_candidate_note_entity_1.CompanyCandidateNote)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        applications_service_1.ApplicationsService,
        talent_invites_service_1.TalentInvitesService,
        company_plans_service_1.CompanyPlansService])
], CompanyWhatsAppPremiumService);
//# sourceMappingURL=company-whatsapp-premium.service.js.map