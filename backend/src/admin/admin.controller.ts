import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { Application } from '../applications/entities/application.entity';
import { Company, CompanyStatus } from '../companies/entities/company.entity';
import { CompanyAccessRequest, CompanyAccessRequestStatus } from '../companies/entities/company-access-request.entity';
import { Job } from '../jobs/entities/job.entity';
import { User, UserType } from '../users/entities/user.entity';
import { AdminGuard } from './admin.guard';

const COMPANY_FIELDS = [
  'name', 'description', 'documentType', 'cnpj', 'cpf', 'website', 'address',
  'cityState', 'phone', 'socialInstagram', 'socialLinkedin', 'socialFacebook',
  'logoURL', 'documentURL',
] as const;

const JOB_FIELDS = [
  'title', 'description', 'location', 'type', 'workModel', 'salary', 'isConfidential',
  'isTalentPool', 'active', 'deadlineDate', 'acceptsPlatformApplications', 'externalApplicationInstructions',
] as const;

function pick<T extends object>(data: Record<string, unknown>, fields: readonly string[]): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const field of fields) if (data[field] !== undefined) result[field] = data[field];
  return result as Partial<T>;
}

@Controller('admin')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(Application) private readonly applications: Repository<Application>,
    @InjectRepository(CompanyAccessRequest) private readonly accessRequests: Repository<CompanyAccessRequest>,
  ) {}

  @Get('summary')
  async summary() {
    const [companies, pendingCompanies, activeJobs, users] = await Promise.all([
      this.companies.count(),
      this.companies.count({ where: { verificationStatus: CompanyStatus.PENDING } }),
      this.jobs.count({ where: { active: true } }),
      this.users.count(),
    ]);
    return { companies, pendingCompanies, activeJobs, users };
  }

  @Get('companies')
  listCompanies() {
    return this.companies.find({ order: { createdAt: 'DESC' } });
  }

  @Get('company-access-requests')
  async listCompanyAccessRequests() {
    const requests = await this.accessRequests.find({ where: { status: CompanyAccessRequestStatus.PENDING }, order: { createdAt: 'ASC' } });
    const managerCompanyIds = new Set(
      (await this.users.find({ where: { isCompanyAdmin: true }, select: { companyId: true } }))
        .map(user => user.companyId)
        .filter((companyId): companyId is string => Boolean(companyId)),
    );
    const platformRequests = requests.filter(request => !managerCompanyIds.has(request.companyId));
    const companyIds = [...new Set(platformRequests.map(request => request.companyId))];
    const companies = companyIds.length ? await this.companies.findBy({ id: In(companyIds) }) : [];
    const companyNames = new Map(companies.map(company => [company.id, company.name]));
    return platformRequests.map(request => ({ ...request, companyName: companyNames.get(request.companyId) || 'Empresa removida' }));
  }

  @Put('company-access-requests/:id')
  async reviewCompanyAccessRequest(@Req() req: any, @Param('id') id: string, @Body() data: { action?: string; role?: string; note?: string }) {
    const request = await this.accessRequests.findOne({ where: { id, status: CompanyAccessRequestStatus.PENDING } });
    if (!request) throw new NotFoundException('Solicitação não encontrada ou já processada.');
    if (!['approve', 'reject'].includes(data.action || '')) throw new BadRequestException('Ação inválida.');
    if (await this.users.count({ where: { companyId: request.companyId, isCompanyAdmin: true } })) {
      throw new BadRequestException('Esta empresa já possui gestores. A solicitação deve ser analisada por um administrador da própria empresa.');
    }
    request.reviewedById = req.user.uid;
    request.reviewNote = typeof data.note === 'string' ? data.note.slice(0, 1000) : null;
    if (data.action === 'reject') {
      request.status = CompanyAccessRequestStatus.REJECTED;
      return this.accessRequests.save(request);
    }
    const company = await this.companies.findOne({ where: { id: request.companyId } });
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    await this.users.update({ id: request.userId }, { type: UserType.COMPANY, companyId: company.id, companyName: company.name, isCompanyAdmin: data.role === 'admin', status: 'ACTIVE' });
    request.status = CompanyAccessRequestStatus.APPROVED;
    return this.accessRequests.save(request);
  }

  @Post('companies')
  async createCompany(@Req() req: any, @Body() data: Record<string, unknown>) {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) throw new BadRequestException('O nome da empresa é obrigatório.');
    const verificationStatus = data.verificationStatus === CompanyStatus.VERIFIED
      ? CompanyStatus.VERIFIED
      : CompanyStatus.DRAFT;
    const company = this.companies.create({
      ...pick<Company>(data, COMPANY_FIELDS),
      name,
      ownerId: req.user.uid,
      verificationStatus,
      isVerified: verificationStatus === CompanyStatus.VERIFIED,
    });
    return this.companies.save(company);
  }

  @Put('companies/:id')
  async updateCompany(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    const company = await this.companies.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    Object.assign(company, pick<Company>(data, COMPANY_FIELDS));
    if (typeof data.name === 'string' && data.name.trim()) company.name = data.name.trim();
    if (Object.values(CompanyStatus).includes(data.verificationStatus as CompanyStatus)) {
      company.verificationStatus = data.verificationStatus as CompanyStatus;
      company.isVerified = company.verificationStatus === CompanyStatus.VERIFIED;
    }
    return this.companies.save(company);
  }

  @Get('jobs')
  listJobs() {
    return this.jobs.find({ order: { createdAt: 'DESC' } });
  }

  @Post('jobs')
  async createJob(@Req() req: any, @Body() data: Record<string, unknown>) {
    const companyId = typeof data.companyId === 'string' ? data.companyId : '';
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const description = typeof data.description === 'string' ? data.description.trim() : '';
    if (!companyId || !title || !description) {
      throw new BadRequestException('Empresa, título e descrição são obrigatórios.');
    }
    const company = await this.companies.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    if (data.acceptsPlatformApplications === false && !(typeof data.externalApplicationInstructions === 'string' && data.externalApplicationInstructions.trim())) {
      throw new BadRequestException('Informe como o candidato deve enviar ou entregar o currículo.');
    }
    const job = this.jobs.create({
      ...pick<Job>(data, JOB_FIELDS),
      title,
      description,
      companyId: company.id,
      companyName: company.name,
      ownerId: req.user.uid,
      active: data.active !== false,
    });
    return this.jobs.save(job);
  }

  @Put('jobs/:id')
  async updateJob(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    const job = await this.jobs.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Vaga não encontrada.');
    if (data.acceptsPlatformApplications === false && !(typeof data.externalApplicationInstructions === 'string' && data.externalApplicationInstructions.trim())) {
      throw new BadRequestException('Informe como o candidato deve enviar ou entregar o currículo.');
    }
    Object.assign(job, pick<Job>(data, JOB_FIELDS));
    return this.jobs.save(job);
  }

  @Delete('jobs/:id')
  async deleteJob(@Param('id') id: string) {
    const job = await this.jobs.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Vaga não encontrada.');
    if (await this.applications.count({ where: { jobId: id } })) {
      throw new BadRequestException('Esta vaga possui candidaturas. Desative-a para encerrar a captação sem perder o histórico.');
    }
    await this.jobs.remove(job);
    return { success: true };
  }

  @Get('users')
  listUsers() {
    return this.users.find({
      order: { createdAt: 'DESC' },
      select: { id: true, email: true, displayName: true, fullName: true, type: true, companyId: true, isVerified: true, createdAt: true },
    });
  }

  @Put('users/:id/promote')
  async promoteUser(@Req() req: any, @Param('id') id: string) {
    if (id === req.user.uid) throw new BadRequestException('Sua própria permissão não pode ser alterada por esta tela.');
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    user.type = UserType.ADMIN;
    return this.users.save(user);
  }
}
