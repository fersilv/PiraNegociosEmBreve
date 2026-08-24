import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  UseGuards,
  Req,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JobsService } from './jobs.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';

import { Job } from './entities/job.entity';
import { User, UserType } from '../users/entities/user.entity';
import { Company } from '../companies/entities/company.entity';
import { JobReport } from './entities/job-report.entity';
import { CompanyTalentInvite } from '../companies/entities/company-talent-invite.entity';
import { Application } from '../applications/entities/application.entity';
import { createHash } from 'crypto';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companiesRepository: Repository<Company>,
    @InjectRepository(JobReport)
    private readonly reportsRepository: Repository<JobReport>,
    @InjectRepository(CompanyTalentInvite)
    private readonly talentInvitesRepository: Repository<CompanyTalentInvite>,
    @InjectRepository(Application)
    private readonly applicationsRepository: Repository<Application>,
  ) {}

  private async assertCanManageCompany(
    uid: string,
    companyId: string,
  ): Promise<Company> {
    const [user, company] = await Promise.all([
      this.usersRepository.findOne({ where: { id: uid } }),
      this.companiesRepository.findOne({ where: { id: companyId } }),
    ]);
    if (!company) throw new BadRequestException('Empresa não encontrada.');
    if (user?.type === UserType.ADMIN) return company;
    if (
      !user ||
      (company.ownerId !== uid &&
        !(user.companyId === companyId && user.isCompanyAdmin))
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para administrar vagas desta empresa.',
      );
    }
    return company;
  }

  @Get()
  findAll() {
    return this.jobsService.findAll();
  }

  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  findAllMyJobs(@Req() req: any) {
    return this.jobsService.findAllByOwner(req.user.uid);
  }

  @Get(':id')
  @UseGuards(FirebaseAuthGuard)
  async findOne(@Req() req: any, @Param('id') id: string) {
    const job = await this.jobsService.findOne(id);
    if (!job) throw new NotFoundException('Vaga não encontrada.');
    if (!job.isInternal) return job;

    const user = await this.usersRepository.findOne({
      where: { id: req.user.uid },
    });
    const canManage =
      user?.type === UserType.ADMIN ||
      job.ownerId === req.user.uid ||
      Boolean(
        job.companyId &&
          user?.companyId === job.companyId &&
          user.isCompanyAdmin,
      );
    if (canManage) return job;

    const [invite, application] = await Promise.all([
      this.talentInvitesRepository.findOne({
        where: {
          candidateId: req.user.uid,
          jobId: job.id,
          status: In(['PENDING', 'ACCEPTED']),
        },
      }),
      this.applicationsRepository.findOne({
        where: { candidateId: req.user.uid, jobId: job.id },
      }),
    ]);
    if (application) return job;

    const today = new Date().toISOString().slice(0, 10);
    if (
      invite &&
      job.active &&
      (!job.deadlineDate || job.deadlineDate >= today)
    ) {
      return job;
    }
    throw new NotFoundException('Vaga não encontrada.');
  }

  @Post(':id/reports')
  async report(
    @Req() req: any,
    @Param('id') id: string,
    @Body() data: { reason?: string; details?: string },
  ) {
    const job = await this.jobsService.findOne(id);
    if (!job || !job.active || job.isInternal)
      throw new NotFoundException('Vaga não encontrada.');
    const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
    const allowedReasons = [
      'VAGA_INEXISTENTE',
      'PROCESSO_ENCERRADO',
      'INFORMACAO_INCORRETA',
      'GOLPE_OU_FRAUDE',
      'OUTRO',
    ];
    if (!allowedReasons.includes(reason))
      throw new BadRequestException('Selecione um motivo de denúncia válido.');
    const rawIp = String(
      req.headers['x-forwarded-for'] ||
        req.ip ||
        req.socket?.remoteAddress ||
        '',
    )
      .split(',')[0]
      .trim();
    const reporterKey = createHash('sha256')
      .update(`${process.env.JOB_REPORT_SALT || 'job-report'}:${rawIp}`)
      .digest('hex');
    if (
      await this.reportsRepository.exists({ where: { jobId: id, reporterKey } })
    ) {
      throw new ConflictException(
        'Você já enviou uma denúncia para esta vaga.',
      );
    }
    const details =
      typeof data.details === 'string'
        ? data.details.trim().slice(0, 1000) || null
        : null;
    await this.reportsRepository.save(
      this.reportsRepository.create({
        jobId: id,
        reporterKey,
        reason,
        details,
      }),
    );
    await this.jobsService.incrementReportCount(id);
    return { success: true };
  }

  @Post()
  @UseGuards(FirebaseAuthGuard)
  async create(@Req() req: any, @Body() createJobDto: Partial<Job>) {
    if (
      typeof createJobDto.companyId !== 'string' ||
      !createJobDto.companyId.trim() ||
      typeof createJobDto.title !== 'string' ||
      !createJobDto.title.trim() ||
      typeof createJobDto.description !== 'string' ||
      !createJobDto.description.trim()
    ) {
      throw new BadRequestException(
        'Empresa, título e descrição são obrigatórios.',
      );
    }
    this.normalizeInternalVisibility(createJobDto);
    if (
      createJobDto.acceptsPlatformApplications === false &&
      !this.hasExternalApplicationChannel(createJobDto)
    ) {
      throw new BadRequestException(
        'Informe ao menos link, WhatsApp, e-mail ou instruções para a candidatura externa.',
      );
    }
    this.validateApplicationFields(createJobDto);
    this.normalizeJobSkills(createJobDto);
    this.normalizePcdMode(createJobDto);
    this.normalizeLocation(createJobDto);
    const company = await this.assertCanManageCompany(
      req.user.uid,
      createJobDto.companyId,
    );
    return this.jobsService.create(req.user.uid, company, createJobDto);
  }

  @Patch(':id')
  @UseGuards(FirebaseAuthGuard)
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateJobDto: Partial<Job>,
  ) {
    const job = await this.jobsService.findOne(id);
    if (!job) throw new BadRequestException('Vaga não encontrada.');
    if (job.companyId)
      await this.assertCanManageCompany(req.user.uid, job.companyId);
    else if (
      (await this.usersRepository.findOne({ where: { id: req.user.uid } }))
        ?.type !== UserType.ADMIN
    )
      throw new ForbiddenException(
        'Somente a administração pode gerenciar vagas externas.',
      );
    this.normalizeInternalVisibility(updateJobDto, job);
    if (
      updateJobDto.acceptsPlatformApplications === false &&
      !this.hasExternalApplicationChannel(updateJobDto, job)
    ) {
      throw new BadRequestException(
        'Informe ao menos link, WhatsApp, e-mail ou instruções para a candidatura externa.',
      );
    }
    this.validateApplicationFields(updateJobDto);
    this.normalizeJobSkills(updateJobDto);
    this.normalizePcdMode(updateJobDto);
    this.normalizeLocation(updateJobDto);
    return this.jobsService.update(req.user.uid, id, updateJobDto, true);
  }

  private hasExternalApplicationChannel(data: Partial<Job>, current?: Job) {
    const instructions =
      data.externalApplicationInstructions !== undefined
        ? typeof data.externalApplicationInstructions === 'string'
          ? data.externalApplicationInstructions.trim()
          : ''
        : current?.externalApplicationInstructions?.trim();
    const email =
      data.applicationEmail !== undefined
        ? typeof data.applicationEmail === 'string'
          ? data.applicationEmail.trim()
          : ''
        : current?.applicationEmail?.trim();
    const whatsapp =
      data.applicationWhatsApp !== undefined
        ? typeof data.applicationWhatsApp === 'string'
          ? data.applicationWhatsApp.trim()
          : ''
        : current?.applicationWhatsApp?.trim();
    const applicationUrl =
      data.applicationUrl !== undefined
        ? typeof data.applicationUrl === 'string'
          ? data.applicationUrl.trim()
          : ''
        : current?.applicationUrl?.trim();
    return Boolean(instructions || email || whatsapp || applicationUrl);
  }

  private normalizeInternalVisibility(data: Partial<Job>, current?: Job) {
    if (
      data.isInternal !== undefined &&
      typeof data.isInternal !== 'boolean'
    ) {
      throw new BadRequestException(
        'A classificação de vaga interna deve ser verdadeira ou falsa.',
      );
    }
    const isInternal = data.isInternal ?? current?.isInternal ?? false;
    if (!isInternal) return;

    data.acceptsPlatformApplications = true;
    data.externalApplicationInstructions = null;
    data.applicationEmail = null;
    data.applicationWhatsApp = null;
    data.applicationUrl = null;
    data.applicationUrlTitle = null;
  }

  private validateApplicationFields(data: Partial<Job>) {
    if (
      data.applicationEmail !== undefined &&
      data.applicationEmail !== null &&
      typeof data.applicationEmail !== 'string'
    )
      throw new BadRequestException('O e-mail de candidatura deve ser texto.');
    const email = data.applicationEmail?.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new BadRequestException('Informe um e-mail de candidatura válido.');

    if (
      data.applicationWhatsApp !== undefined &&
      data.applicationWhatsApp !== null &&
      typeof data.applicationWhatsApp !== 'string'
    )
      throw new BadRequestException(
        'O WhatsApp de candidatura deve ser texto.',
      );
    const whatsapp = data.applicationWhatsApp?.replace(/\D/g, '');
    if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 13))
      throw new BadRequestException(
        'Informe o WhatsApp com DDD e número, com DDI opcional.',
      );

    if (
      data.applicationUrl !== undefined &&
      data.applicationUrl !== null &&
      typeof data.applicationUrl !== 'string'
    )
      throw new BadRequestException('O link de candidatura deve ser texto.');
    if (typeof data.applicationUrl === 'string') {
      const applicationUrl = data.applicationUrl.trim();
      if (applicationUrl && !/^https?:\/\//i.test(applicationUrl))
        throw new BadRequestException(
          'O link de candidatura deve começar com http:// ou https://.',
        );
      data.applicationUrl = applicationUrl || null;
    }

    if (
      data.applicationUrlTitle !== undefined &&
      data.applicationUrlTitle !== null &&
      typeof data.applicationUrlTitle !== 'string'
    )
      throw new BadRequestException('O título do link de candidatura deve ser texto.');
    if (typeof data.applicationUrlTitle === 'string') {
      data.applicationUrlTitle = data.applicationUrlTitle.trim().slice(0, 180) || null;
    }
  }

  private normalizeJobSkills(data: Partial<Job>) {
    if (data.skills === undefined) return;
    if (!Array.isArray(data.skills)) {
      throw new BadRequestException('As habilidades da vaga devem ser uma lista.');
    }

    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const raw of data.skills) {
      if (typeof raw !== 'string') {
        throw new BadRequestException('Cada habilidade deve ser um texto.');
      }
      const skill = raw.trim().replace(/\s+/g, ' ').slice(0, 80);
      if (!skill) continue;
      const key = skill.toLocaleLowerCase('pt-BR');
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(skill);
    }

    if (normalized.length > 10) {
      throw new BadRequestException(
        'Cada vaga pode ter no máximo 10 habilidades.',
      );
    }
    data.skills = normalized;
  }

  private normalizePcdMode(data: Partial<Job>) {
    if (data.pcdMode === undefined) return;
    if (typeof data.pcdMode !== 'string')
      throw new BadRequestException('A classificação PCD da vaga é inválida.');
    const value = data.pcdMode.trim().toUpperCase();
    if (!['GENERAL', 'INCLUSIVE', 'EXCLUSIVE'].includes(value))
      throw new BadRequestException(
        'pcdMode deve ser GENERAL, INCLUSIVE ou EXCLUSIVE.',
      );
    data.pcdMode = value;
  }

  private normalizeLocation(data: Partial<Job>) {
    if (typeof data.city === 'string') data.city = data.city.trim();
    if (typeof data.state === 'string') data.state = data.state.trim().toUpperCase().slice(0, 2);
    if (typeof data.location !== 'string') return;
    data.location = data.location.trim();
    if (data.city && data.state) return;
    const match = data.location.match(/^(.+?),\s*([A-Za-z]{2})$/);
    if (!match) return;
    data.city = match[1].trim();
    data.state = match[2].toUpperCase();
  }

  @Put(':id')
  @UseGuards(FirebaseAuthGuard)
  replaceUpdate(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateJobDto: Partial<Job>,
  ) {
    return this.update(req, id, updateJobDto);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard)
  async remove(@Req() req: any, @Param('id') id: string) {
    const job = await this.jobsService.findOne(id);
    if (!job) throw new BadRequestException('Vaga não encontrada.');
    if (job.companyId)
      await this.assertCanManageCompany(req.user.uid, job.companyId);
    else if (
      (await this.usersRepository.findOne({ where: { id: req.user.uid } }))
        ?.type !== UserType.ADMIN
    )
      throw new ForbiddenException(
        'Somente a administração pode gerenciar vagas externas.',
      );
    return this.jobsService.remove(req.user.uid, id, true);
  }
}
