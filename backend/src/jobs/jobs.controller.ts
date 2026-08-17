import { BadRequestException, Controller, ForbiddenException, Get, Post, Body, Patch, Put, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobsService } from './jobs.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';

import { Job } from './entities/job.entity';
import { User, UserType } from '../users/entities/user.entity';
import { Company } from '../companies/entities/company.entity';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(Company) private readonly companiesRepository: Repository<Company>,
  ) {}

  private async assertCanManageCompany(uid: string, companyId: string): Promise<Company> {
    const [user, company] = await Promise.all([
      this.usersRepository.findOne({ where: { id: uid } }),
      this.companiesRepository.findOne({ where: { id: companyId } }),
    ]);
    if (!company) throw new BadRequestException('Empresa não encontrada.');
    if (user?.type === UserType.ADMIN) return company;
    if (!user || user.type !== UserType.COMPANY || (company.ownerId !== uid && !(user.companyId === companyId && user.isCompanyAdmin))) {
      throw new ForbiddenException('Você não tem permissão para administrar vagas desta empresa.');
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

  @Post()
  @UseGuards(FirebaseAuthGuard)
  async create(@Req() req: any, @Body() createJobDto: Partial<Job>) {
    if (!createJobDto.companyId || !createJobDto.title?.trim() || !createJobDto.description?.trim()) {
      throw new BadRequestException('Empresa, título e descrição são obrigatórios.');
    }
    if (createJobDto.acceptsPlatformApplications === false && !createJobDto.externalApplicationInstructions?.trim()) {
      throw new BadRequestException('Informe como o candidato deve enviar ou entregar o currículo.');
    }
    const company = await this.assertCanManageCompany(req.user.uid, createJobDto.companyId);
    return this.jobsService.create(req.user.uid, company, createJobDto);
  }

  @Patch(':id')
  @UseGuards(FirebaseAuthGuard)
  async update(@Req() req: any, @Param('id') id: string, @Body() updateJobDto: Partial<Job>) {
    const job = await this.jobsService.findOne(id);
    if (!job) throw new BadRequestException('Vaga não encontrada.');
    await this.assertCanManageCompany(req.user.uid, job.companyId);
    if (updateJobDto.acceptsPlatformApplications === false && !updateJobDto.externalApplicationInstructions?.trim() && !job.externalApplicationInstructions?.trim()) {
      throw new BadRequestException('Informe como o candidato deve enviar ou entregar o currículo.');
    }
    return this.jobsService.update(req.user.uid, id, updateJobDto, true);
  }

  @Put(':id')
  @UseGuards(FirebaseAuthGuard)
  replaceUpdate(@Req() req: any, @Param('id') id: string, @Body() updateJobDto: Partial<Job>) {
    return this.update(req, id, updateJobDto);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard)
  async remove(@Req() req: any, @Param('id') id: string) {
    const job = await this.jobsService.findOne(id);
    if (!job) throw new BadRequestException('Vaga não encontrada.');
    await this.assertCanManageCompany(req.user.uid, job.companyId);
    return this.jobsService.remove(req.user.uid, id, true);
  }
}
