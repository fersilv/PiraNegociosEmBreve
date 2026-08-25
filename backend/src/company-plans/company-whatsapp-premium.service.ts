import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApplicationsService } from '../applications/applications.service';
import {
  Application,
  ApplicationStatus,
} from '../applications/entities/application.entity';
import { CompanyCandidateNote } from '../companies/entities/company-candidate-note.entity';
import { CompanyTalentFolder } from '../companies/entities/company-talent-folder.entity';
import { CompanyTalentRecord } from '../companies/entities/company-talent-record.entity';
import { Company } from '../companies/entities/company.entity';
import { TalentInvitesService } from '../companies/talent-invites.service';
import { Job } from '../jobs/entities/job.entity';
import { User } from '../users/entities/user.entity';
import { CompanyPlansService } from './company-plans.service';

@Injectable()
export class CompanyWhatsAppPremiumService {
  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(Application)
    private readonly applications: Repository<Application>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(CompanyTalentFolder)
    private readonly folders: Repository<CompanyTalentFolder>,
    @InjectRepository(CompanyTalentRecord)
    private readonly talentRecords: Repository<CompanyTalentRecord>,
    @InjectRepository(CompanyCandidateNote)
    private readonly candidateNotes: Repository<CompanyCandidateNote>,
    private readonly appsService: ApplicationsService,
    private readonly talentInvites: TalentInvitesService,
    private readonly plans: CompanyPlansService,
  ) {}

  private async companyJob(companyId: string, jobId: string) {
    const job = await this.jobs.findOne({ where: { id: jobId, companyId } });
    if (!job) throw new NotFoundException('Vaga da empresa não encontrada.');
    return job;
  }

  private async companyApplication(companyId: string, applicationId: string) {
    const application = await this.applications.findOne({
      where: { id: applicationId },
    });
    if (!application) throw new NotFoundException('Candidatura não encontrada.');
    const job = await this.companyJob(companyId, application.jobId);
    return { application, job };
  }

  private parseStatus(value: unknown) {
    const raw = String(value || '').trim();
    const aliases: Record<string, ApplicationStatus> = {
      PENDING: ApplicationStatus.PENDING,
      ENVIADO: ApplicationStatus.PENDING,
      REVIEWING: ApplicationStatus.REVIEWING,
      'EM ANALISE': ApplicationStatus.REVIEWING,
      'EM ANÁLISE': ApplicationStatus.REVIEWING,
      DOCUMENTS_REQUESTED: ApplicationStatus.DOCUMENTS_REQUESTED,
      'EM CONTRATACAO': ApplicationStatus.DOCUMENTS_REQUESTED,
      'EM CONTRATAÇÃO': ApplicationStatus.DOCUMENTS_REQUESTED,
      DOCUMENTS_SUBMITTED: ApplicationStatus.DOCUMENTS_SUBMITTED,
      'DOCUMENTOS EM ANALISE': ApplicationStatus.DOCUMENTS_SUBMITTED,
      'DOCUMENTOS EM ANÁLISE': ApplicationStatus.DOCUMENTS_SUBMITTED,
      HIRED: ApplicationStatus.HIRED,
      APROVADO: ApplicationStatus.HIRED,
      CONTRATADO: ApplicationStatus.HIRED,
      REJECTED: ApplicationStatus.REJECTED,
      RECUSADO: ApplicationStatus.REJECTED,
      WITHDRAWN: ApplicationStatus.WITHDRAWN,
      DESISTIU: ApplicationStatus.WITHDRAWN,
    };
    const key = raw.toUpperCase();
    const status = aliases[key];
    if (!status) {
      throw new BadRequestException(
        'Status inválido. Use PENDING, REVIEWING, DOCUMENTS_REQUESTED, DOCUMENTS_SUBMITTED, HIRED, REJECTED ou WITHDRAWN.',
      );
    }
    return status;
  }

  private candidateName(candidate: User | null | undefined) {
    return String(
      candidate?.socialName ||
        candidate?.displayName ||
        candidate?.fullName ||
        candidate?.email ||
        'Candidato',
    ).trim();
  }

  async setJobState(
    companyId: string,
    jobId: string,
    action: 'ACTIVATE' | 'DEACTIVATE' | 'CLOSE',
  ) {
    await this.plans.assertFeature(
      companyId,
      action === 'ACTIVATE'
        ? 'JOB_ACTIVATE'
        : action === 'CLOSE'
          ? 'JOB_CLOSE'
          : 'JOB_DEACTIVATE',
    );
    const job = await this.companyJob(companyId, jobId);
    if (action === 'ACTIVATE') {
      job.active = true;
      if (job.deadlineDate && job.deadlineDate < new Date().toISOString().slice(0, 10)) {
        job.deadlineDate = null;
      }
    } else {
      job.active = false;
      if (action === 'CLOSE') job.deadlineDate = new Date().toISOString().slice(0, 10);
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

  async listCandidates(companyId: string, jobId: string) {
    await this.plans.assertFeature(companyId, 'CANDIDATES_DETAIL');
    const job = await this.companyJob(companyId, jobId);
    const rows = await this.appsService.findAllForJob(job.id);
    return {
      job: { id: job.id, title: job.title },
      count: rows.length,
      candidates: rows.slice(0, 30).map((row: any) => ({
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

  async candidateProfile(companyId: string, candidateId: string) {
    await this.plans.assertFeature(companyId, 'CANDIDATE_PROFILE');
    const application = await this.applications
      .createQueryBuilder('application')
      .innerJoin(Job, 'job', 'job.id = application."jobId"')
      .where('application."candidateId" = :candidateId', { candidateId })
      .andWhere('job."companyId" = :companyId', { companyId })
      .orderBy('application."createdAt"', 'DESC')
      .getOne();
    if (!application) {
      throw new NotFoundException('Este candidato não possui candidatura em uma vaga da empresa.');
    }
    const candidate = await this.users.findOne({ where: { id: candidateId } });
    if (!candidate) throw new NotFoundException('Candidato não encontrado.');
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

  async updateApplicationStatus(
    companyId: string,
    applicationId: string,
    statusInput: unknown,
    actor: { id: string; name: string },
  ) {
    await this.plans.assertFeature(companyId, 'APPLICATION_STATUS');
    const { application } = await this.companyApplication(companyId, applicationId);
    const status = this.parseStatus(statusInput);
    return this.appsService.updateByCompany(application.id, { status }, actor);
  }

  async addApplicationNote(
    companyId: string,
    applicationId: string,
    note: string,
    actor: { id: string; name: string },
  ) {
    await this.plans.assertFeature(companyId, 'APPLICATION_NOTE');
    const { application } = await this.companyApplication(companyId, applicationId);
    const text = String(note || '').trim().slice(0, 3000);
    if (!text) throw new BadRequestException('Escreva a observação que deseja registrar.');
    const observations = [
      ...(Array.isArray(application.observations) ? application.observations : []),
      text,
    ];
    return this.appsService.updateByCompany(
      application.id,
      { observations },
      actor,
    );
  }

  async inviteCandidate(
    company: Company,
    jobId: string,
    candidateId: string,
    actorId: string,
  ) {
    await this.plans.assertFeature(company.id, 'CANDIDATE_INVITE');
    const [job, candidate] = await Promise.all([
      this.companyJob(company.id, jobId),
      this.users.findOne({ where: { id: candidateId } }),
    ]);
    if (!job.active) throw new BadRequestException('A vaga precisa estar ativa para convidar candidatos.');
    if (!candidate?.isOpenToWork) {
      throw new BadRequestException('Este candidato não está disponível no Banco de Talentos.');
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

  async cancelInvite(companyId: string, inviteId: string) {
    await this.plans.assertFeature(companyId, 'CANDIDATE_INVITE_CANCEL');
    return this.talentInvites.cancelPending(companyId, inviteId);
  }

  async listInvites(companyId: string) {
    await this.plans.assertFeature(companyId, 'CANDIDATE_INVITE');
    return this.talentInvites.listForCompany(companyId);
  }

  async listTalentFolders(companyId: string) {
    await this.plans.assertFeature(companyId, 'TALENT_MANAGE');
    return this.folders.find({ where: { companyId }, order: { name: 'ASC' } });
  }

  async saveTalent(
    companyId: string,
    candidateId: string,
    folderIds?: string[],
    jobIds?: string[],
  ) {
    await this.plans.assertFeature(companyId, 'TALENT_MANAGE');
    const candidate = await this.users.findOne({ where: { id: candidateId } });
    if (!candidate?.isOpenToWork) {
      throw new BadRequestException('Este candidato não está disponível no Banco de Talentos.');
    }
    const record =
      (await this.talentRecords.findOne({ where: { companyId, candidateId } })) ||
      this.talentRecords.create({ companyId, candidateId, folderIds: [], jobIds: [] });
    if (Array.isArray(folderIds)) record.folderIds = [...new Set(folderIds)];
    if (Array.isArray(jobIds)) record.jobIds = [...new Set(jobIds)];
    return this.talentRecords.save(record);
  }

  async removeTalent(companyId: string, candidateId: string, folderId?: string) {
    await this.plans.assertFeature(companyId, 'TALENT_MANAGE');
    const record = await this.talentRecords.findOne({ where: { companyId, candidateId } });
    if (!record) return { removed: false };
    if (folderId) {
      record.folderIds = (record.folderIds || []).filter((id) => id !== folderId);
      return this.talentRecords.save(record);
    }
    await this.talentRecords.remove(record);
    return { removed: true, candidateId };
  }

  async addTalentNote(companyId: string, candidateId: string, actorId: string, note: string) {
    await this.plans.assertFeature(companyId, 'TALENT_MANAGE');
    const record = await this.talentRecords.findOne({ where: { companyId, candidateId } });
    if (!record) throw new BadRequestException('Salve o candidato no Banco de Talentos antes de registrar histórico.');
    const body = String(note || '').trim().slice(0, 3000);
    if (!body) throw new BadRequestException('Escreva uma observação.');
    return this.candidateNotes.save(
      this.candidateNotes.create({ recordId: record.id, authorId: actorId, body, type: 'NOTE' }),
    );
  }

  private startOfWindow(value: string) {
    const normalized = String(value || '').toLowerCase();
    const now = new Date();
    if (normalized.includes('ontem')) return new Date(now.getTime() - 48 * 60 * 60 * 1000);
    if (normalized.includes('7') || normalized.includes('semana')) return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
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

  async recentApplications(companyId: string, window: string) {
    await this.plans.assertFeature(companyId, 'RECENT_APPLICATIONS');
    const since = this.startOfWindow(window);
    const rows = await this.applications
      .createQueryBuilder('application')
      .innerJoin(Job, 'job', 'job.id = application."jobId"')
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

  async jobStats(companyId: string, jobId?: string) {
    await this.plans.assertFeature(companyId, 'ADVANCED_JOB_STATS');
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

  async candidateWhatsAppTarget(companyId: string, candidateId: string) {
    await this.plans.assertFeature(companyId, 'CANDIDATE_WHATSAPP');
    const hasRelationship = await this.applications
      .createQueryBuilder('application')
      .innerJoin(Job, 'job', 'job.id = application."jobId"')
      .where('application."candidateId" = :candidateId', { candidateId })
      .andWhere('job."companyId" = :companyId', { companyId })
      .getCount();
    if (!hasRelationship) {
      throw new BadRequestException('Este candidato não possui relação de recrutamento com a empresa.');
    }
    const candidate = await this.users.findOne({ where: { id: candidateId } });
    if (!candidate) throw new NotFoundException('Candidato não encontrado.');
    const raw = String(candidate.whatsappId || candidate.whatsappPhoneE164 || candidate.phone || '').trim();
    const digits = raw.split('@')[0].replace(/\D/g, '');
    if (!digits || !candidate.whatsappVerifiedAt) {
      throw new BadRequestException('O candidato não possui WhatsApp verificado no PiraNegócios.');
    }
    const normalized = digits.startsWith('55') ? digits : `55${digits}`;
    return {
      candidateId,
      candidateName: this.candidateName(candidate),
      chatId: raw.includes('@') ? raw : `${normalized}@c.us`,
    };
  }
}
