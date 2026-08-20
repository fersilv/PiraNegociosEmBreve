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
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobsService } from './jobs.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';

import { Job } from './entities/job.entity';
import { User, UserType } from '../users/entities/user.entity';
import { Company } from '../companies/entities/company.entity';
import { JobReport } from './entities/job-report.entity';
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
    return this.jobsService.findAll(); // Rota pública
  }

  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  findAllMyJobs(@Req() req: any) {
    return this.jobsService.findAllByOwner(req.user.uid);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id); // Rota pública
  }

  @Post(':id/reports')
  async report(
    @Req() req: any,
    @Param('id') id: string,
    @Body() data: { reason?: string; details?: string },
  ) {
    const job = await this.jobsService.findOne(id);
    if (!job || !job.active)
      throw new BadRequestException(
        'Esta vaga não está disponível para denúncia.',
      );
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
    if (
      createJobDto.acceptsPlatformApplications === false &&
      !this.hasExternalApplicationChannel(createJobDto)
    ) {
      throw new BadRequestException(
        'Informe ao menos WhatsApp, e-mail ou instruções para a candidatura externa.',
      );
    }
    this.validateApplicationFields(createJobDto);
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
    if (
      updateJobDto.acceptsPlatformApplications === false &&
      !this.hasExternalApplicationChannel(updateJobDto, job)
    ) {
      throw new BadRequestException(
        'Informe ao menos WhatsApp, e-mail ou instruções para a candidatura externa.',
      );
    }
    this.validateApplicationFields(updateJobDto);
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
    return Boolean(instructions || email || whatsapp);
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
