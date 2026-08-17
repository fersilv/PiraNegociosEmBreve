import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application, ApplicationStatus } from './entities/application.entity';
import { Job } from '../jobs/entities/job.entity';

const COMPANY_MANAGED_FIELDS = [
  'status', 'priority', 'observations', 'onboardingDocs', 'customDocs',
  'documentsRequested', 'documentsRequestedAt', 'submittedForReview',
] as const;

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application)
    private appRepo: Repository<Application>,
  ) {}

  async findAllForCandidate(candidateId: string): Promise<Application[]> {
    return this.appRepo.find({
      where: { candidateId },
      order: { createdAt: 'DESC' },
    });
  }

  async findAllForJob(jobId: string): Promise<Application[]> {
    return this.appRepo.find({
      where: { jobId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Application | null> {
    return this.appRepo.findOne({ where: { id } });
  }

  async create(candidateId: string, job: Job, resumeUrl?: string): Promise<Application> {
    const existing = await this.appRepo.findOne({ where: { candidateId, jobId: job.id } });
    if (existing) throw new ConflictException('Você já possui uma candidatura para esta vaga.');
    const application = this.appRepo.create({
      candidateId,
      jobId: job.id,
      companyId: job.companyId,
      companyName: job.isConfidential ? 'Empresa Confidencial' : job.companyName,
      jobTitle: job.title,
      resumeUrl: resumeUrl || null,
      status: ApplicationStatus.PENDING,
      observations: [],
      onboardingDocs: {},
      customDocs: [],
    });
    return this.appRepo.save(application);
  }

  async updateStatus(id: string, status: ApplicationStatus): Promise<Application> {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Candidatura não encontrada');
    app.status = status;
    return this.appRepo.save(app);
  }

  async updateByCompany(id: string, data: Partial<Application>): Promise<Application> {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Candidatura não encontrada');
    const sanitized: Partial<Application> = {};
    for (const field of COMPANY_MANAGED_FIELDS) {
      if (data[field] !== undefined) (sanitized as Record<string, unknown>)[field] = data[field];
    }
    Object.assign(app, sanitized);
    return this.appRepo.save(app);
  }

  async updateDocumentsByCandidate(id: string, documents: Record<string, unknown>): Promise<Application> {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Candidatura não encontrada');
    app.onboardingDocs = documents;
    app.submittedForReview = false;
    if (app.status === ApplicationStatus.DOCUMENTS_SUBMITTED) app.status = ApplicationStatus.DOCUMENTS_REQUESTED;
    return this.appRepo.save(app);
  }

  async submitDocuments(id: string): Promise<Application> {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Candidatura não encontrada');
    app.submittedForReview = true;
    app.status = ApplicationStatus.DOCUMENTS_SUBMITTED;
    return this.appRepo.save(app);
  }

  async withdraw(id: string): Promise<Application> {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Candidatura não encontrada');
    app.status = ApplicationStatus.WITHDRAWN;
    return this.appRepo.save(app);
  }
}
