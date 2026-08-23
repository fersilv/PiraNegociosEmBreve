import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Application, ApplicationStatus } from './entities/application.entity';
import { Job } from '../jobs/entities/job.entity';
import { NotificationsService } from '../notifications/notifications.service';

const COMPANY_MANAGED_FIELDS = [
  'status', 'priority', 'observations', 'onboardingDocs', 'customDocs',
  'documentsRequested', 'documentsRequestedAt', 'submittedForReview',
] as const;

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application)
    private appRepo: Repository<Application>,
    @InjectRepository(Job)
    private jobRepo: Repository<Job>,
    private notifications: NotificationsService,
    private dataSource: DataSource,
  ) {}

  private asArray(value: unknown): unknown[] {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed as Record<string, unknown>
          : {};
      } catch {
        return {};
      }
    }
    return {};
  }

  private normalizeApplication(app: Application): Application {
    app.observations = this.asArray(app.observations);
    app.customDocs = this.asArray(app.customDocs);
    app.onboardingDocs = this.asRecord(app.onboardingDocs);
    app.resumeSnapshot = app.resumeSnapshot ? this.asRecord(app.resumeSnapshot) : null;
    return app;
  }

  private statusLabel(status: ApplicationStatus): string {
    const labels: Record<ApplicationStatus, string> = {
      [ApplicationStatus.PENDING]: 'Candidatura enviada',
      [ApplicationStatus.REVIEWING]: 'Em análise',
      [ApplicationStatus.DOCUMENTS_REQUESTED]: 'Documentos solicitados',
      [ApplicationStatus.DOCUMENTS_SUBMITTED]: 'Documentos enviados para análise',
      [ApplicationStatus.HIRED]: 'Contratado',
      [ApplicationStatus.REJECTED]: 'Processo encerrado',
      [ApplicationStatus.WITHDRAWN]: 'Candidatura retirada',
    };
    return labels[status] || status;
  }

  private async notifyCandidate(app: Application, title: string, message: string): Promise<void> {
    try {
      await this.notifications.notifyUser(app.candidateId, {
        title,
        message,
        type: 'status_update',
        jobId: app.jobId,
        appId: app.id,
        link: `/user/admissao/${app.id}`,
      });
    } catch (error) {
      console.warn('Não foi possível notificar o candidato:', error);
    }
  }

  private async notifyCompany(app: Application, title: string, message: string): Promise<void> {
    try {
      const job = await this.jobRepo.findOne({ where: { id: app.jobId } });
      const data = {
        title,
        message,
        type: 'status_update',
        jobId: app.jobId,
        appId: app.id,
        link: `/company/vagas/${app.jobId}`,
      };
      if (job?.companyId) {
        await this.notifications.notifyCompany(job.companyId, data);
      } else if (job?.ownerId) {
        await this.notifications.notifyUser(job.ownerId, data);
      }
    } catch (error) {
      console.warn('Não foi possível notificar a empresa:', error);
    }
  }

  async findAllForCandidate(candidateId: string): Promise<Application[]> {
    const applications = await this.appRepo.find({
      where: { candidateId },
      order: { createdAt: 'DESC' },
    });
    return applications.map((app) => this.normalizeApplication(app));
  }

  async findAllForJob(jobId: string): Promise<Array<Application & { boosted: boolean }>> {
    const applications = await this.appRepo.find({
      where: { jobId },
      order: { createdAt: 'DESC' },
    });
    if (!applications.length) return [];

    const candidateIds = Array.from(new Set(applications.map((app) => app.candidateId).filter(Boolean)));
    const boostRows = candidateIds.length
      ? await this.dataSource.query(
          `SELECT "userId" FROM user_feature_entitlements
           WHERE feature = 'RESUME_BOOST' AND "expiresAt" > now()
             AND "userId" = ANY($1::varchar[])`,
          [candidateIds],
        )
      : [];
    const boostedIds = new Set(boostRows.map((row: any) => String(row.userId)));

    return applications
      .map((app) => ({ ...this.normalizeApplication(app), boosted: boostedIds.has(app.candidateId) }))
      .sort((a, b) => {
        if (a.boosted !== b.boosted) return Number(b.boosted) - Number(a.boosted);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }

  async findOne(id: string): Promise<Application | null> {
    const application = await this.appRepo.findOne({ where: { id } });
    return application ? this.normalizeApplication(application) : null;
  }

  async create(
    candidateId: string,
    job: Job,
    resumeUrl?: string,
    resumeSnapshot?: Record<string, unknown>,
  ): Promise<Application> {
    const existing = await this.appRepo.findOne({ where: { candidateId, jobId: job.id } });
    if (existing) throw new ConflictException('Você já possui uma candidatura para esta vaga.');
    const application = this.appRepo.create({
      candidateId,
      jobId: job.id,
      companyId: job.companyId,
      companyName: job.isConfidential ? 'Empresa Confidencial' : job.companyName,
      jobTitle: job.title,
      resumeUrl: resumeUrl || null,
      resumeSnapshot: resumeSnapshot || null,
      status: ApplicationStatus.PENDING,
      observations: [],
      onboardingDocs: {},
      customDocs: [],
    });
    const saved = this.normalizeApplication(await this.appRepo.save(application));
    await this.notifyCompany(
      saved,
      'Nova candidatura recebida',
      `Uma nova candidatura chegou para a vaga “${saved.jobTitle}”.`,
    );
    return saved;
  }

  async updateStatus(id: string, status: ApplicationStatus): Promise<Application> {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Candidatura não encontrada');
    const previousStatus = app.status;
    app.status = status;
    const saved = this.normalizeApplication(await this.appRepo.save(app));
    if (previousStatus !== status) {
      await this.notifyCandidate(
        saved,
        'Atualização na sua candidatura',
        `Seu processo para a vaga “${saved.jobTitle}” agora está como: ${this.statusLabel(status)}.`,
      );
    }
    return saved;
  }

  async updateByCompany(id: string, data: Partial<Application>): Promise<Application> {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Candidatura não encontrada');

    this.normalizeApplication(app);
    const previousStatus = app.status;
    const previousDocumentsRequested = Boolean(app.documentsRequested);
    const previousCustomDocs = this.asArray(app.customDocs);
    const previousOnboardingDocs = this.asRecord(app.onboardingDocs);

    const sanitized: Partial<Application> = {};
    for (const field of COMPANY_MANAGED_FIELDS) {
      if (data[field] === undefined) continue;
      if (field === 'observations' || field === 'customDocs') {
        (sanitized as Record<string, unknown>)[field] = this.asArray(data[field]);
      } else if (field === 'onboardingDocs') {
        (sanitized as Record<string, unknown>)[field] = this.asRecord(data[field]);
      } else {
        (sanitized as Record<string, unknown>)[field] = data[field] as unknown;
      }
    }

    Object.assign(app, sanitized);
    const saved = this.normalizeApplication(await this.appRepo.save(app));
    const currentCustomDocs = this.asArray(saved.customDocs);
    const currentOnboardingDocs = this.asRecord(saved.onboardingDocs);
    const newCustomDocument = currentCustomDocs.length > previousCustomDocs.length;
    const documentsRequestedNow =
      (!previousDocumentsRequested && Boolean(saved.documentsRequested)) ||
      (previousStatus !== ApplicationStatus.DOCUMENTS_REQUESTED && saved.status === ApplicationStatus.DOCUMENTS_REQUESTED);
    const rejectedNow = Object.keys(currentOnboardingDocs).filter((docId) => {
      const current = currentOnboardingDocs[docId] as Record<string, unknown> | undefined;
      const previous = previousOnboardingDocs[docId] as Record<string, unknown> | undefined;
      return current?.status === 'rejected' && previous?.status !== 'rejected';
    });

    if (newCustomDocument) {
      const latest = currentCustomDocs.at(-1) as Record<string, unknown> | undefined;
      await this.notifyCandidate(
        saved,
        'Novo documento solicitado',
        `A empresa solicitou ${latest?.name ? `o documento “${String(latest.name)}”` : 'um novo documento'} para o processo da vaga “${saved.jobTitle}”.`,
      );
    } else if (documentsRequestedNow) {
      await this.notifyCandidate(
        saved,
        'Documentos solicitados',
        `A empresa solicitou documentos para continuar seu processo na vaga “${saved.jobTitle}”.`,
      );
    } else if (rejectedNow.length > 0) {
      await this.notifyCandidate(
        saved,
        'Documento precisa de correção',
        `A empresa pediu o reenvio de ${rejectedNow.length === 1 ? 'um documento' : `${rejectedNow.length} documentos`} no processo da vaga “${saved.jobTitle}”.`,
      );
    } else if (previousStatus !== saved.status) {
      await this.notifyCandidate(
        saved,
        'Atualização na sua candidatura',
        `Seu processo para a vaga “${saved.jobTitle}” agora está como: ${this.statusLabel(saved.status)}.`,
      );
    }

    return saved;
  }

  async updateDocumentsByCandidate(id: string, documents: Record<string, unknown>): Promise<Application> {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Candidatura não encontrada');
    app.onboardingDocs = this.asRecord(documents);
    app.submittedForReview = false;
    if (app.status === ApplicationStatus.DOCUMENTS_SUBMITTED) app.status = ApplicationStatus.DOCUMENTS_REQUESTED;
    return this.normalizeApplication(await this.appRepo.save(app));
  }

  async submitDocuments(id: string): Promise<Application> {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Candidatura não encontrada');
    app.submittedForReview = true;
    app.status = ApplicationStatus.DOCUMENTS_SUBMITTED;
    const saved = this.normalizeApplication(await this.appRepo.save(app));
    await this.notifyCompany(
      saved,
      'Documentos enviados para análise',
      `O candidato enviou a documentação solicitada para a vaga “${saved.jobTitle}”.`,
    );
    return saved;
  }

  async withdraw(id: string): Promise<Application> {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Candidatura não encontrada');
    app.status = ApplicationStatus.WITHDRAWN;
    const saved = this.normalizeApplication(await this.appRepo.save(app));
    await this.notifyCompany(
      saved,
      'Candidato retirou a candidatura',
      `A candidatura para a vaga “${saved.jobTitle}” foi retirada pelo candidato.`,
    );
    return saved;
  }
}