import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { Application } from '../applications/entities/application.entity';
import {
  Company,
  CompanyCategory,
  CompanyStatus,
} from '../companies/entities/company.entity';
import {
  CompanyAccessRequest,
  CompanyAccessRequestStatus,
} from '../companies/entities/company-access-request.entity';
import { Job } from '../jobs/entities/job.entity';
import { User, UserType } from '../users/entities/user.entity';
import { AdminGuard } from './admin.guard';
import { VisitorEvent } from '../analytics/entities/visitor-event.entity';
import { AccountAccess } from '../analytics/entities/account-access.entity';
import {
  UserSanction,
  UserSanctionStatus,
} from './entities/user-sanction.entity';
import { slugify } from '../seo/seo.utils';
import { validateCompanySlug } from '../seo/seo.utils';
import { CompanySlugAlias } from '../companies/entities/company-slug-alias.entity';

const COMPANY_FIELDS = [
  'name',
  'category',
  'description',
  'documentType',
  'cnpj',
  'cpf',
  'website',
  'address',
  'cityState',
  'city',
  'state',
  'phone',
  'socialInstagram',
  'socialLinkedin',
  'socialFacebook',
  'logoURL',
  'documentURL',
] as const;

const JOB_FIELDS = [
  'title',
  'description',
  'requirements',
  'location',
  'city',
  'state',
  'type',
  'workModel',
  'salary',
  'isConfidential',
  'isTalentPool',
  'active',
  'deadlineDate',
  'acceptsPlatformApplications',
  'externalApplicationInstructions',
  'applicationEmail',
  'applicationWhatsApp',
  'sourceName',
  'sourceUrl',
] as const;

const VALID_UFS = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]);

function pick<T extends object>(
  data: Record<string, unknown>,
  fields: readonly string[],
): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const field of fields)
    if (data[field] !== undefined) result[field] = data[field];
  return result as Partial<T>;
}

@Controller('admin')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(Application)
    private readonly applications: Repository<Application>,
    @InjectRepository(CompanyAccessRequest)
    private readonly accessRequests: Repository<CompanyAccessRequest>,
    @InjectRepository(VisitorEvent)
    private readonly visitorEvents: Repository<VisitorEvent>,
    @InjectRepository(AccountAccess)
    private readonly accountAccesses: Repository<AccountAccess>,
    @InjectRepository(UserSanction)
    private readonly sanctions: Repository<UserSanction>,
    @InjectRepository(CompanySlugAlias)
    private readonly companySlugAliases: Repository<CompanySlugAlias>,
  ) {}

  @Get('summary')
  async summary() {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [companies, pendingCompanies, activeJobs, users] = await Promise.all([
      this.companies.count(),
      this.companies.count({
        where: { verificationStatus: CompanyStatus.PENDING },
      }),
      this.jobs.count({ where: { active: true } }),
      this.users.count(),
    ]);
    const [activeVisitors, analytics] = await Promise.all([
      this.visitorEvents
        .createQueryBuilder('event')
        .select('COUNT(DISTINCT event.visitorId)', 'count')
        .where('event.createdAt >= :since', { since: fiveMinutesAgo })
        .getRawOne(),
      this.analyticsSnapshot(thirtyDaysAgo),
    ]);
    return {
      companies,
      pendingCompanies,
      activeJobs,
      users,
      activeVisitors: Number(activeVisitors?.count || 0),
      ...analytics,
    };
  }

  @Get('analytics')
  async analytics() {
    return this.analyticsSnapshot(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    );
  }

  private async analyticsSnapshot(since: Date) {
    const [totals, averageEngagement, sources, devices, pages, security] =
      await Promise.all([
        this.visitorEvents
          .createQueryBuilder('event')
          .select('COUNT(*)', 'pageViews')
          .addSelect('COUNT(DISTINCT event.visitorId)', 'uniqueVisitors')
          .where('event.createdAt >= :since', { since })
          .getRawOne(),
        this.visitorEvents
          .createQueryBuilder('event')
          .select('AVG(event.durationSeconds)', 'seconds')
          .where('event.createdAt >= :since AND event.eventType = :type', {
            since,
            type: 'ENGAGEMENT',
          })
          .getRawOne(),
        this.visitorEvents
          .createQueryBuilder('event')
          .select(
            "COALESCE(event.utmSource, event.referrerOrigin, 'Direto')",
            'source',
          )
          .addSelect('COUNT(*)', 'count')
          .where('event.createdAt >= :since', { since })
          .groupBy("COALESCE(event.utmSource, event.referrerOrigin, 'Direto')")
          .orderBy('count', 'DESC')
          .limit(8)
          .getRawMany(),
        this.visitorEvents
          .createQueryBuilder('event')
          .select("COALESCE(event.deviceType, 'unknown')", 'device')
          .addSelect('COUNT(DISTINCT event.visitorId)', 'count')
          .where('event.createdAt >= :since', { since })
          .groupBy("COALESCE(event.deviceType, 'unknown')")
          .orderBy('count', 'DESC')
          .getRawMany(),
        this.visitorEvents
          .createQueryBuilder('event')
          .select('event.path', 'path')
          .addSelect('COUNT(*)', 'count')
          .where('event.createdAt >= :since AND event.eventType = :type', {
            since,
            type: 'PAGE_VIEW',
          })
          .groupBy('event.path')
          .orderBy('count', 'DESC')
          .limit(8)
          .getRawMany(),
        this.accountAccesses
          .createQueryBuilder('access')
          .select('COUNT(*)', 'accesses')
          .addSelect(
            'COUNT(*) FILTER (WHERE access.isNewDevice = true)',
            'newDevices',
          )
          .where('access.createdAt >= :since', { since })
          .getRawOne(),
      ]);
    return {
      periodDays: 30,
      pageViews: Number(totals?.pageViews || 0),
      uniqueVisitors: Number(totals?.uniqueVisitors || 0),
      averageEngagementSeconds: Math.round(
        Number(averageEngagement?.seconds || 0),
      ),
      sources: sources.map((row) => ({
        source: row.source,
        count: Number(row.count),
      })),
      devices: devices.map((row) => ({
        device: row.device,
        count: Number(row.count),
      })),
      topPages: pages.map((row) => ({
        path: row.path,
        count: Number(row.count),
      })),
      accountAccesses: Number(security?.accesses || 0),
      newDevices: Number(security?.newDevices || 0),
    };
  }

  @Get('companies')
  listCompanies() {
    return this.companies.find({ order: { createdAt: 'DESC' } });
  }

  @Get('companies/:id')
  async companyDetails(@Param('id') id: string) {
    const company = await this.companies.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    const [employees, jobs, applications] = await Promise.all([
      this.users.find({
        where: { companyId: id },
        select: {
          id: true,
          email: true,
          displayName: true,
          fullName: true,
          socialName: true,
          phone: true,
          photoURL: true,
          isCompanyAdmin: true,
          status: true,
          createdAt: true,
        },
      }),
      this.jobs.find({
        where: { companyId: id },
        order: { createdAt: 'DESC' },
      }),
      this.applications.find({
        where: { companyId: id },
        order: { createdAt: 'DESC' },
      }),
    ]);
    return { company, employees, jobs, applications };
  }

  @Get('company-access-requests')
  async listCompanyAccessRequests() {
    const requests = await this.accessRequests.find({
      where: { status: CompanyAccessRequestStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
    const managerCompanyIds = new Set(
      (
        await this.users.find({
          where: { isCompanyAdmin: true },
          select: { companyId: true },
        })
      )
        .map((user) => user.companyId)
        .filter((companyId): companyId is string => Boolean(companyId)),
    );
    const platformRequests = requests.filter(
      (request) => !managerCompanyIds.has(request.companyId),
    );
    const companyIds = [
      ...new Set(platformRequests.map((request) => request.companyId)),
    ];
    const companies = companyIds.length
      ? await this.companies.findBy({ id: In(companyIds) })
      : [];
    const companyNames = new Map(
      companies.map((company) => [company.id, company.name]),
    );
    return platformRequests.map((request) => ({
      ...request,
      companyName: companyNames.get(request.companyId) || 'Empresa removida',
    }));
  }

  @Put('company-access-requests/:id')
  async reviewCompanyAccessRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Body() data: { action?: string; role?: string; note?: string },
  ) {
    const request = await this.accessRequests.findOne({
      where: { id, status: CompanyAccessRequestStatus.PENDING },
    });
    if (!request)
      throw new NotFoundException(
        'Solicitação não encontrada ou já processada.',
      );
    if (!['approve', 'reject'].includes(data.action || ''))
      throw new BadRequestException('Ação inválida.');
    if (
      await this.users.count({
        where: { companyId: request.companyId, isCompanyAdmin: true },
      })
    ) {
      throw new BadRequestException(
        'Esta empresa já possui gestores. A solicitação deve ser analisada por um administrador da própria empresa.',
      );
    }
    request.reviewedById = req.user.uid;
    request.reviewNote =
      typeof data.note === 'string' ? data.note.slice(0, 1000) : null;
    if (data.action === 'reject') {
      request.status = CompanyAccessRequestStatus.REJECTED;
      return this.accessRequests.save(request);
    }
    const company = await this.companies.findOne({
      where: { id: request.companyId },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    await this.users.update(
      { id: request.userId },
      {
        type: UserType.COMPANY,
        companyId: company.id,
        companyName: company.name,
        isCompanyAdmin: data.role === 'admin',
        status: 'ACTIVE',
      },
    );
    request.status = CompanyAccessRequestStatus.APPROVED;
    return this.accessRequests.save(request);
  }

  @Post('companies')
  async createCompany(@Req() req: any, @Body() data: Record<string, unknown>) {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name)
      throw new BadRequestException('O nome da empresa é obrigatório.');
    const verificationStatus =
      data.verificationStatus === CompanyStatus.VERIFIED
        ? CompanyStatus.VERIFIED
        : CompanyStatus.DRAFT;
    const requestedSlug =
      typeof data.slug === 'string' && data.slug.trim()
        ? this.validatedCompanySlug(data.slug)
        : '';
    const slug = requestedSlug
      ? await this.assertExactCompanySlugAvailable(requestedSlug)
      : await this.nextCompanySlug(name);
    const location = this.normalizeCompanyLocation(data);
    const company = this.companies.create({
      ...pick<Company>(data, COMPANY_FIELDS),
      name,
      ownerId: req.user.uid,
      verificationStatus,
      isVerified: verificationStatus === CompanyStatus.VERIFIED,
      category: Object.values(CompanyCategory).includes(
        data.category as CompanyCategory,
      )
        ? (data.category as CompanyCategory)
        : CompanyCategory.EMPLOYER,
      slug,
      slugIsCustom: Boolean(requestedSlug),
      ...location,
    });
    return this.companies.save(company);
  }

  @Put('companies/:id')
  async updateCompany(
    @Req() req: any,
    @Param('id') id: string,
    @Body() data: Record<string, unknown>,
  ) {
    const company = await this.companies.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    Object.assign(company, pick<Company>(data, COMPANY_FIELDS));
    if (typeof data.name === 'string' && data.name.trim())
      company.name = data.name.trim();
    if (
      typeof data.slug === 'string' &&
      data.slug.trim() &&
      data.slug !== company.slug
    ) {
      const slug = await this.assertExactCompanySlugAvailable(
        this.validatedCompanySlug(data.slug),
        company.id,
      );
      if (company.slug)
        await this.activateCompanyAlias(
          company,
          company.slug,
          slug,
          req.user.uid,
        );
      company.slug = slug;
      company.slugIsCustom = true;
      company.pendingSlug = null;
      company.slugChangeStatus = 'APPROVED';
    }
    if (
      data.city !== undefined ||
      data.state !== undefined ||
      data.cityState !== undefined
    )
      Object.assign(company, this.normalizeCompanyLocation(data, company));
    if (
      Object.values(CompanyStatus).includes(
        data.verificationStatus as CompanyStatus,
      )
    ) {
      company.verificationStatus = data.verificationStatus as CompanyStatus;
      company.isVerified =
        company.verificationStatus === CompanyStatus.VERIFIED;
    }
    return this.companies.save(company);
  }

  @Put('companies/:id/slug-request')
  async reviewCompanySlugRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Body() data: { action?: string; note?: string },
  ) {
    const company = await this.companies.findOne({ where: { id } });
    if (!company?.pendingSlug || company.slugChangeStatus !== 'PENDING')
      throw new BadRequestException(
        'Esta empresa não possui alteração de URL pendente.',
      );
    if (!['approve', 'reject'].includes(data.action || ''))
      throw new BadRequestException('Ação inválida.');
    const pendingSlug = company.pendingSlug;
    company.slugChangeReviewedAt = new Date();
    company.slugChangeReviewedById = req.user.uid;
    company.slugChangeReviewNote =
      typeof data.note === 'string' ? data.note.trim().slice(0, 1000) : null;
    if (data.action === 'reject') {
      company.pendingSlug = null;
      company.slugChangeStatus = 'REJECTED';
      return this.companies.save(company);
    }
    const approvedSlug = await this.assertExactCompanySlugAvailable(
      pendingSlug,
      company.id,
    );
    if (company.slug)
      await this.activateCompanyAlias(
        company,
        company.slug,
        approvedSlug,
        req.user.uid,
      );
    company.slug = approvedSlug;
    company.slugIsCustom = true;
    company.pendingSlug = null;
    company.slugChangeStatus = 'APPROVED';
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
    const description =
      typeof data.description === 'string' ? data.description.trim() : '';
    const isExternalListing = data.isExternalListing === true;
    if (!title || !description || (!isExternalListing && !companyId)) {
      throw new BadRequestException(
        'Título e descrição são obrigatórios; selecione uma empresa ou marque como vaga externa.',
      );
    }
    const company = isExternalListing
      ? null
      : await this.companies.findOne({ where: { id: companyId } });
    if (!isExternalListing && !company)
      throw new NotFoundException('Empresa não encontrada.');
    if (
      data.acceptsPlatformApplications === false &&
      !this.hasExternalApplicationChannel(data)
    ) {
      throw new BadRequestException(
        'Informe ao menos WhatsApp, e-mail ou instruções para a candidatura externa.',
      );
    }
    this.validateJobContactFields(data);
    const normalizedLocation = this.normalizeJobLocation(data);
    const sourceName =
      typeof data.sourceName === 'string'
        ? data.sourceName.trim().slice(0, 160)
        : '';
    const sourceUrl =
      typeof data.sourceUrl === 'string'
        ? data.sourceUrl.trim().slice(0, 2000)
        : '';
    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl))
      throw new BadRequestException(
        'A URL da fonte deve começar com http:// ou https://.',
      );
    const slug = await this.nextJobSlug(
      `${title}-${isExternalListing ? sourceName || 'fonte-externa' : company!.slug || company!.name}`,
    );
    const job = this.jobs.create({
      ...pick<Job>(data, JOB_FIELDS),
      title,
      description,
      ...normalizedLocation,
      companyId: company?.id || null,
      companyName:
        company?.name || sourceName || 'Oportunidade de fonte externa',
      isExternalListing,
      sourceName: isExternalListing ? sourceName || null : null,
      sourceUrl: isExternalListing ? sourceUrl || null : null,
      ownerId: req.user.uid,
      active: data.active !== false,
      slug,
    });
    return this.jobs.save(job);
  }

  @Put('jobs/:id')
  async updateJob(
    @Param('id') id: string,
    @Body() data: Record<string, unknown>,
  ) {
    const job = await this.jobs.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Vaga não encontrada.');
    if (
      data.acceptsPlatformApplications === false &&
      !this.hasExternalApplicationChannel(data, job)
    ) {
      throw new BadRequestException(
        'Informe ao menos WhatsApp, e-mail ou instruções para a candidatura externa.',
      );
    }
    this.validateJobContactFields(data);
    Object.assign(job, pick<Job>(data, JOB_FIELDS));
    if (
      data.location !== undefined ||
      data.city !== undefined ||
      data.state !== undefined
    )
      Object.assign(job, this.normalizeJobLocation(data));
    if (data.active === true && job.moderationStatus === 'PENDING')
      job.moderationStatus = 'APPROVED';
    return this.jobs.save(job);
  }

  private hasExternalApplicationChannel(
    data: Record<string, unknown>,
    current?: Job,
  ) {
    const instructions =
      typeof data.externalApplicationInstructions === 'string'
        ? data.externalApplicationInstructions.trim()
        : current?.externalApplicationInstructions;
    const email =
      typeof data.applicationEmail === 'string'
        ? data.applicationEmail.trim()
        : current?.applicationEmail;
    const whatsapp =
      typeof data.applicationWhatsApp === 'string'
        ? data.applicationWhatsApp.trim()
        : current?.applicationWhatsApp;
    return Boolean(instructions || email || whatsapp);
  }

  private validateJobContactFields(data: Record<string, unknown>) {
    if (
      data.applicationEmail !== undefined &&
      data.applicationEmail !== null &&
      typeof data.applicationEmail !== 'string'
    )
      throw new BadRequestException('O e-mail de candidatura deve ser texto.');
    const email =
      typeof data.applicationEmail === 'string'
        ? data.applicationEmail.trim()
        : '';
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
    const whatsapp =
      typeof data.applicationWhatsApp === 'string'
        ? data.applicationWhatsApp.replace(/\D/g, '')
        : '';
    if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 13))
      throw new BadRequestException(
        'Informe o WhatsApp com DDD e número, com DDI opcional.',
      );

    if (
      typeof data.sourceUrl === 'string' &&
      data.sourceUrl.trim() &&
      !/^https?:\/\//i.test(data.sourceUrl.trim())
    )
      throw new BadRequestException(
        'A URL da fonte deve começar com http:// ou https://.',
      );
  }

  private normalizeJobLocation(data: Record<string, unknown>) {
    const explicitCity =
      typeof data.city === 'string' ? data.city.trim().slice(0, 120) : '';
    const explicitState =
      typeof data.state === 'string'
        ? data.state.trim().toUpperCase().slice(0, 2)
        : '';
    const rawLocation =
      typeof data.location === 'string'
        ? data.location.trim().slice(0, 180)
        : '';
    const parts = rawLocation.split(/\s*,\s*/);
    const city = explicitCity || parts[0] || 'Pirassununga';
    const state = explicitState || parts[1]?.toUpperCase() || 'SP';
    if (!VALID_UFS.has(state))
      throw new BadRequestException('Selecione um estado brasileiro válido.');
    return { city, state, location: `${city}, ${state}` };
  }

  @Delete('jobs/:id')
  async deleteJob(@Param('id') id: string) {
    const job = await this.jobs.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Vaga não encontrada.');
    if (await this.applications.count({ where: { jobId: id } })) {
      throw new BadRequestException(
        'Esta vaga possui candidaturas. Desative-a para encerrar a captação sem perder o histórico.',
      );
    }
    await this.jobs.remove(job);
    return { success: true };
  }

  private async nextCompanySlug(
    value: string,
    companyId?: string,
  ): Promise<string> {
    const base = slugify(value) || 'empresa';
    for (let suffix = 1; suffix < 10_000; suffix += 1) {
      const slug = suffix === 1 ? base : `${base}-${suffix}`;
      const existing = await this.companies.findOne({ where: { slug } });
      const alias = await this.companySlugAliases.findOne({
        where: { slug, expiresAt: MoreThan(new Date()) },
      });
      if ((!existing || existing.id === companyId) && !alias) return slug;
    }
    throw new BadRequestException(
      'Não foi possível reservar este endereço público.',
    );
  }

  private validatedCompanySlug(value: string) {
    try {
      return validateCompanySlug(value);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Endereço público inválido.',
      );
    }
  }

  private async assertExactCompanySlugAvailable(
    slug: string,
    companyId?: string,
  ) {
    const existing = await this.companies.findOne({
      where: [{ slug }, { pendingSlug: slug }],
    });
    if (existing && existing.id !== companyId)
      throw new BadRequestException(
        'Este endereço público já está em uso ou aguardando aprovação.',
      );
    const alias = await this.companySlugAliases.findOne({
      where: { slug, expiresAt: MoreThan(new Date()) },
    });
    if (alias && alias.companyId !== companyId)
      throw new BadRequestException(
        'Este endereço está reservado temporariamente por uma URL anterior.',
      );
    return slug;
  }

  private async activateCompanyAlias(
    company: Company,
    oldSlug: string,
    newSlug: string,
    actorId: string,
  ) {
    let alias = await this.companySlugAliases.findOne({
      where: { slug: oldSlug },
    });
    alias =
      alias ||
      this.companySlugAliases.create({
        companyId: company.id,
        slug: oldSlug,
        replacedBySlug: newSlug,
        expiresAt: new Date(),
        rollbackAvailable: true,
        rollbackUsed: false,
        rolledBackAt: null,
        createdById: actorId,
      });
    alias.companyId = company.id;
    alias.replacedBySlug = newSlug;
    alias.expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    alias.rollbackAvailable = true;
    alias.rollbackUsed = false;
    alias.rolledBackAt = null;
    alias.createdById = actorId;
    return this.companySlugAliases.save(alias);
  }

  private normalizeCompanyLocation(
    data: Record<string, unknown>,
    current?: Company,
  ) {
    const raw = typeof data.cityState === 'string' ? data.cityState.trim() : '';
    const parts = raw.split(/\s*(?:,|-)\s*/);
    const city =
      (typeof data.city === 'string' ? data.city.trim() : '') ||
      parts[0] ||
      current?.city ||
      '';
    const state = (
      (typeof data.state === 'string' ? data.state.trim() : '') ||
      parts[1] ||
      current?.state ||
      ''
    ).toUpperCase();
    if (state && !VALID_UFS.has(state))
      throw new BadRequestException('Selecione um estado brasileiro válido.');
    return {
      city: city || null,
      state: state || null,
      cityState: city && state ? `${city}, ${state}` : city || null,
    };
  }

  private async nextJobSlug(value: string): Promise<string> {
    const base = slugify(value) || 'vaga';
    for (let suffix = 1; suffix < 10_000; suffix += 1) {
      const slug = suffix === 1 ? base : `${base}-${suffix}`;
      if (!(await this.jobs.exists({ where: { slug } }))) return slug;
    }
    throw new BadRequestException(
      'Não foi possível criar o endereço público da vaga.',
    );
  }

  @Get('users')
  listUsers() {
    return this.users.find({
      order: { createdAt: 'DESC' },
      select: {
        id: true,
        email: true,
        displayName: true,
        fullName: true,
        type: true,
        companyId: true,
        isVerified: true,
        createdAt: true,
      },
    });
  }

  @Get('users/:id')
  async userDetails(@Param('id') id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    const [sanctions, accesses] = await Promise.all([
      this.sanctions.find({
        where: { userId: id },
        order: { createdAt: 'DESC' },
      }),
      this.accountAccesses.find({
        where: { userId: id },
        order: { createdAt: 'DESC' },
        take: 30,
      }),
    ]);
    const ipHashes = [
      ...new Set(
        accesses
          .map((access) => access.ipHash)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const sharedIpUsers = ipHashes.length
      ? await this.accountAccesses
          .createQueryBuilder('access')
          .select('access.ipHash', 'ipHash')
          .addSelect('COUNT(DISTINCT access.userId)', 'userCount')
          .where('access.ipHash IN (:...ipHashes)', { ipHashes })
          .groupBy('access.ipHash')
          .getRawMany()
      : [];
    return {
      user,
      sanctions,
      accesses,
      sharedIpUsers: sharedIpUsers.map((row) => ({
        ipHash: row.ipHash,
        userCount: Number(row.userCount),
      })),
    };
  }

  @Post('users/:id/sanctions')
  async sanctionUser(
    @Req() req: any,
    @Param('id') id: string,
    @Body() data: { type?: string; reason?: string; expiresAt?: string | null },
  ) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    const type =
      typeof data.type === 'string' ? data.type.trim().slice(0, 40) : '';
    const reason =
      typeof data.reason === 'string' ? data.reason.trim().slice(0, 3000) : '';
    if (!type || !reason)
      throw new BadRequestException(
        'Tipo e motivo da sanção são obrigatórios.',
      );
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime()))
      throw new BadRequestException('Data de expiração inválida.');
    const sanction = this.sanctions.create({
      userId: id,
      createdById: req.user.uid,
      type,
      reason,
      expiresAt,
      status: UserSanctionStatus.ACTIVE,
    });
    return this.sanctions.save(sanction);
  }

  @Put('users/:id')
  async moderateUser(
    @Param('id') id: string,
    @Body()
    data: {
      status?: string;
      isVerified?: boolean;
      fullName?: string;
      displayName?: string;
      socialName?: string;
      phone?: string;
      bio?: string;
      type?: UserType;
      companyId?: string | null;
      isCompanyAdmin?: boolean;
    },
  ) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (
      typeof data.status === 'string' &&
      ['ACTIVE', 'SUSPENDED', 'BLOCKED'].includes(data.status)
    )
      user.status = data.status;
    if (typeof data.isVerified === 'boolean') user.isVerified = data.isVerified;
    if (typeof data.fullName === 'string')
      user.fullName = data.fullName.trim().slice(0, 160);
    if (typeof data.displayName === 'string')
      user.displayName = data.displayName.trim().slice(0, 160);
    if (typeof data.socialName === 'string')
      user.socialName = data.socialName.trim().slice(0, 160);
    if (typeof data.phone === 'string')
      user.phone = data.phone.trim().slice(0, 40);
    if (typeof data.bio === 'string') user.bio = data.bio.trim().slice(0, 5000);
    if (data.type && Object.values(UserType).includes(data.type))
      user.type = data.type;
    if (data.companyId === null || typeof data.companyId === 'string')
      user.companyId = data.companyId;
    if (typeof data.isCompanyAdmin === 'boolean')
      user.isCompanyAdmin = data.isCompanyAdmin;
    return this.users.save(user);
  }

  @Put('users/:id/promote')
  async promoteUser(@Req() req: any, @Param('id') id: string) {
    if (id === req.user.uid)
      throw new BadRequestException(
        'Sua própria permissão não pode ser alterada por esta tela.',
      );
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    user.type = UserType.ADMIN;
    return this.users.save(user);
  }
}
