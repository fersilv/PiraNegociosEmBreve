import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApplicationsService } from './applications.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { Application, ApplicationStatus } from './entities/application.entity';
import { Job } from '../jobs/entities/job.entity';
import { User, UserType } from '../users/entities/user.entity';

@Controller('applications')
@UseGuards(FirebaseAuthGuard)
export class ApplicationsController {
  constructor(
    private readonly appsService: ApplicationsService,
    @InjectRepository(Job) private readonly jobsRepository: Repository<Job>,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
  ) {}

  private async assertCanManageApplication(uid: string, application: Application) {
    const [user, job] = await Promise.all([
      this.usersRepository.findOne({ where: { id: uid } }),
      this.jobsRepository.findOne({ where: { id: application.jobId } }),
    ]);
    if (!job) throw new BadRequestException('Vaga vinculada não encontrada.');
    if (user?.type === UserType.ADMIN) return;
    if (!user || (job.ownerId !== uid && !(user.companyId === job.companyId && user.isCompanyAdmin))) {
      throw new ForbiddenException('Você não tem permissão para administrar esta candidatura.');
    }
  }

  private parseStatus(status: unknown): ApplicationStatus {
    const aliases: Record<string, ApplicationStatus> = {
      'Enviado': ApplicationStatus.PENDING,
      'Em Análise': ApplicationStatus.REVIEWING,
      'Em Contratação': ApplicationStatus.DOCUMENTS_REQUESTED,
      'Recusado': ApplicationStatus.REJECTED,
      'Não Classificado': ApplicationStatus.REJECTED,
      'Desistiu': ApplicationStatus.WITHDRAWN,
    };
    const normalized = aliases[String(status)] || status;
    if (!Object.values(ApplicationStatus).includes(normalized as ApplicationStatus)) {
      throw new BadRequestException('Status de candidatura inválido.');
    }
    return normalized as ApplicationStatus;
  }

  private hasStructuredResume(candidate: User): boolean {
    return Boolean(
      candidate.bio?.trim() ||
      (Array.isArray(candidate.experiences) && candidate.experiences.length > 0) ||
      (Array.isArray(candidate.education) && candidate.education.length > 0) ||
      (Array.isArray(candidate.skills) && candidate.skills.length > 0),
    );
  }

  private buildResumeSnapshot(candidate: User, includeUploadedFile: boolean): Record<string, unknown> {
    return {
      fullName: candidate.fullName,
      socialName: candidate.socialName,
      phone: candidate.phone,
      email: candidate.email,
      city: candidate.city,
      state: candidate.state,
      address: candidate.address,
      bio: candidate.bio,
      experiences: Array.isArray(candidate.experiences) ? candidate.experiences : [],
      education: Array.isArray(candidate.education) ? candidate.education : [],
      skills: Array.isArray(candidate.skills) ? candidate.skills : [],
      courses: Array.isArray(candidate.courses) ? candidate.courses : [],
      languages: Array.isArray(candidate.languages) ? candidate.languages : [],
      salaryExpectation: candidate.salaryExpectation,
      resumePhotoURL: candidate.resumePhotoURL,
      resumePreferences: candidate.resumePreferences || {},
      resumePublishedAt: candidate.resumePublishedAt,
      ...(includeUploadedFile && candidate.uploadedResumeFile
        ? { uploadedResumeFile: candidate.uploadedResumeFile }
        : {}),
    };
  }

  @Get('me')
  findAllForMe(@Req() req: any) {
    return this.appsService.findAllForCandidate(req.user.uid);
  }

  @Get('job/:jobId')
  async findAllForJob(@Req() req: any, @Param('jobId') jobId: string) {
    const applicationProbe = { jobId } as Application;
    await this.assertCanManageApplication(req.user.uid, applicationProbe);
    return this.appsService.findAllForJob(jobId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const application = await this.appsService.findOne(id);
    if (!application) throw new BadRequestException('Candidatura não encontrada.');
    if (application.candidateId !== req.user.uid) await this.assertCanManageApplication(req.user.uid, application);
    return application;
  }

  @Post()
  async create(@Req() req: any, @Body() createData: { jobId?: string; resumeURL?: string; resumeUrl?: string }) {
    if (!createData.jobId) throw new BadRequestException('A vaga é obrigatória.');
    const [candidate, job] = await Promise.all([
      this.usersRepository.findOne({ where: { id: req.user.uid } }),
      this.jobsRepository.findOne({ where: { id: createData.jobId } }),
    ]);
    if (!candidate) throw new ForbiddenException('Usuário não encontrado.');
    if (!job || !job.active) throw new BadRequestException('Esta vaga não está disponível para candidaturas.');
    if (!job.acceptsPlatformApplications) {
      throw new BadRequestException('Esta empresa recebe currículos por um canal externo indicado na vaga.');
    }

    const legacyResumeUrl = createData.resumeURL || createData.resumeUrl || candidate.resumeURL || undefined;
    const hasUploadedResumeFile = Boolean(candidate.uploadedResumeFile?.dataUrl?.startsWith('data:'));

    if (job.requiresResumeFile && !hasUploadedResumeFile && !legacyResumeUrl?.trim()) {
      throw new BadRequestException(
        'Esta empresa exige um arquivo de currículo. Importe ou anexe seu currículo antes de se candidatar.',
      );
    }

    if (!job.requiresResumeFile) {
      if (candidate.resumeStatus !== 'PUBLISHED' || !this.hasStructuredResume(candidate)) {
        throw new BadRequestException(
          'Publique seu currículo no PiraNegócios antes de se candidatar a esta vaga.',
        );
      }
    }

    const snapshot = this.buildResumeSnapshot(candidate, job.requiresResumeFile);
    return this.appsService.create(
      req.user.uid,
      job,
      legacyResumeUrl?.startsWith('http') ? legacyResumeUrl : undefined,
      snapshot,
    );
  }

  @Put(':id/status')
  async updateStatus(@Req() req: any, @Param('id') id: string, @Body('status') status: unknown) {
    const application = await this.appsService.findOne(id);
    if (!application) throw new BadRequestException('Candidatura não encontrada.');
    await this.assertCanManageApplication(req.user.uid, application);
    return this.appsService.updateStatus(id, this.parseStatus(status));
  }

  @Put(':id')
  async updateByCompany(@Req() req: any, @Param('id') id: string, @Body() data: Partial<Application>) {
    const application = await this.appsService.findOne(id);
    if (!application) throw new BadRequestException('Candidatura não encontrada.');
    await this.assertCanManageApplication(req.user.uid, application);
    if (data.status !== undefined) data.status = this.parseStatus(data.status);
    return this.appsService.updateByCompany(id, data);
  }

  @Put(':id/docs')
  async updateDocuments(@Req() req: any, @Param('id') id: string, @Body('onboardingDocs') onboardingDocs: Record<string, unknown>) {
    const application = await this.appsService.findOne(id);
    if (!application) throw new BadRequestException('Candidatura não encontrada.');
    if (application.candidateId !== req.user.uid) throw new ForbiddenException('Você só pode enviar documentos da sua própria candidatura.');
    if (!onboardingDocs || typeof onboardingDocs !== 'object') throw new BadRequestException('Documentos inválidos.');
    return this.appsService.updateDocumentsByCandidate(id, onboardingDocs);
  }

  @Post(':id/submit-docs')
  async submitDocuments(@Req() req: any, @Param('id') id: string) {
    const application = await this.appsService.findOne(id);
    if (!application) throw new BadRequestException('Candidatura não encontrada.');
    if (application.candidateId !== req.user.uid) throw new ForbiddenException('Você só pode enviar documentos da sua própria candidatura.');
    return this.appsService.submitDocuments(id);
  }

  @Delete(':id')
  async withdraw(@Req() req: any, @Param('id') id: string) {
    const application = await this.appsService.findOne(id);
    if (!application) throw new BadRequestException('Candidatura não encontrada.');
    if (application.candidateId !== req.user.uid) throw new ForbiddenException('Você só pode desistir da sua própria candidatura.');
    return this.appsService.withdraw(id);
  }
}
