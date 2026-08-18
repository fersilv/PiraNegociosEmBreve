import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { Company } from './entities/company.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserType } from '../users/entities/user.entity';
import { CompanyInvitation } from '../users/entities/company-invitation.entity';
import {
  CompanyAccessRequest,
  CompanyAccessRequestStatus,
} from './entities/company-access-request.entity';
import { CompanyTalentFolder } from './entities/company-talent-folder.entity';
import { CompanyTalentRecord } from './entities/company-talent-record.entity';
import { CompanyCandidateNote } from './entities/company-candidate-note.entity';
import { CompanyTalentInvite } from './entities/company-talent-invite.entity';
import { Job } from '../jobs/entities/job.entity';

@Controller('companies')
@UseGuards(FirebaseAuthGuard)
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(CompanyInvitation)
    private invitationsRepository: Repository<CompanyInvitation>,
    @InjectRepository(CompanyAccessRequest)
    private accessRequestsRepository: Repository<CompanyAccessRequest>,
    @InjectRepository(CompanyTalentFolder)
    private folders: Repository<CompanyTalentFolder>,
    @InjectRepository(CompanyTalentRecord)
    private talentRecords: Repository<CompanyTalentRecord>,
    @InjectRepository(CompanyCandidateNote)
    private talentNotes: Repository<CompanyCandidateNote>,
    @InjectRepository(CompanyTalentInvite)
    private talentInvites: Repository<CompanyTalentInvite>,
    @InjectRepository(Job) private jobs: Repository<Job>,
  ) {}

  private async assertManager(uid: string, companyId: string) {
    const [company, user] = await Promise.all([
      this.companiesService.findOne(companyId),
      this.usersRepository.findOne({ where: { id: uid } }),
    ]);
    if (!company) throw new BadRequestException('Empresa não encontrada.');
    if (user?.type === UserType.ADMIN) return company;
    if (
      !user ||
      user.type !== UserType.COMPANY ||
      (company.ownerId !== uid &&
        !(user.companyId === companyId && user.isCompanyAdmin))
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para administrar esta empresa.',
      );
    }
    return company;
  }

  @Get('search')
  async search(@Query('q') query: string) {
    const term = query?.trim();
    if (!term || term.length < 2) return [];
    return this.companiesService.searchByName(term);
  }

  @Get('slug-availability')
  async slugAvailability(@Query('slug') slug: string, @Req() req: any) {
    const user = await this.usersRepository.findOne({
      where: { id: req.user.uid },
    });
    const company = user?.companyId
      ? await this.companiesService.findOne(user.companyId)
      : null;
    if (!company?.isVerified)
      return {
        available: false,
        eligible: false,
        message: 'A URL personalizada exige uma empresa verificada.',
      };
    return {
      ...(await this.companiesService.isSlugAvailable(slug, company.id)),
      eligible: true,
    };
  }

  @Get('mine')
  async findAllMyCompanies(@Req() req: any) {
    const user = await this.usersRepository.findOne({
      where: { id: req.user.uid },
    });
    if (user?.type === UserType.ADMIN) return this.companiesService.findAll();
    const owned = await this.companiesService.findAllMyCompanies(req.user.uid);
    if (
      !user?.companyId ||
      owned.some((company) => company.id === user.companyId)
    )
      return owned;
    const linked = await this.companiesService.findOne(user.companyId);
    return linked ? [linked, ...owned] : owned;
  }

  @Get(':id/talent-folders')
  async listTalentFolders(@Req() req: any, @Param('id') id: string) {
    await this.assertManager(req.user.uid, id);
    return this.folders.find({
      where: { companyId: id },
      order: { name: 'ASC' },
    });
  }

  @Get(':id/talent-jobs')
  async listTalentJobs(@Req() req: any, @Param('id') id: string) {
    await this.assertManager(req.user.uid, id);
    return this.jobs.find({
      where: { companyId: id, active: true },
      order: { createdAt: 'DESC' },
    });
  }

  @Post(':id/talent-folders')
  async createTalentFolder(
    @Req() req: any,
    @Param('id') id: string,
    @Body('name') value: unknown,
  ) {
    await this.assertManager(req.user.uid, id);
    const name = typeof value === 'string' ? value.trim().slice(0, 100) : '';
    if (!name) throw new BadRequestException('Informe o nome da pasta.');
    return this.folders.save(this.folders.create({ companyId: id, name }));
  }

  @Get(':id/talent-records')
  async listTalentRecords(@Req() req: any, @Param('id') id: string) {
    await this.assertManager(req.user.uid, id);
    const records = await this.talentRecords.find({
      where: { companyId: id },
      order: { updatedAt: 'DESC' },
    });
    const candidates = records.length
      ? await this.usersRepository.findBy({
          id: In(records.map((r) => r.candidateId)),
        })
      : [];
    return records.map((record) => ({
      ...record,
      candidate: candidates.find(
        (candidate) => candidate.id === record.candidateId,
      ),
    }));
  }

  @Post(':id/talent-records')
  async saveTalentRecord(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    data: { candidateId?: string; folderIds?: string[]; jobIds?: string[] },
  ) {
    await this.assertManager(req.user.uid, id);
    const candidate = data.candidateId
      ? await this.usersRepository.findOne({ where: { id: data.candidateId } })
      : null;
    if (
      !candidate ||
      candidate.type !== UserType.CANDIDATE ||
      !candidate.isOpenToWork
    )
      throw new BadRequestException(
        'Este candidato não está disponível no banco de talentos.',
      );
    const existing = await this.talentRecords.findOne({
      where: { companyId: id, candidateId: candidate.id },
    });
    const record =
      existing ||
      this.talentRecords.create({
        companyId: id,
        candidateId: candidate.id,
        folderIds: [],
        jobIds: [],
      });
    if (Array.isArray(data.folderIds))
      record.folderIds = [...new Set(data.folderIds)];
    if (Array.isArray(data.jobIds)) record.jobIds = [...new Set(data.jobIds)];
    return this.talentRecords.save(record);
  }

  @Post(':id/talent-records/:candidateId/notes')
  async addTalentNote(
    @Req() req: any,
    @Param('id') id: string,
    @Param('candidateId') candidateId: string,
    @Body() data: { body?: string; type?: string },
  ) {
    await this.assertManager(req.user.uid, id);
    const record = await this.talentRecords.findOne({
      where: { companyId: id, candidateId },
    });
    if (!record)
      throw new BadRequestException(
        'Salve o candidato no banco antes de registrar histórico.',
      );
    const body = data.body?.trim().slice(0, 3000);
    if (!body) throw new BadRequestException('Escreva uma observação.');
    return this.talentNotes.save(
      this.talentNotes.create({
        recordId: record.id,
        authorId: req.user.uid,
        body,
        type: data.type?.slice(0, 30) || 'NOTE',
      }),
    );
  }

  @Post(':id/talent-invites')
  async inviteTalent(
    @Req() req: any,
    @Param('id') id: string,
    @Body() data: { candidateId?: string; jobId?: string },
  ) {
    await this.assertManager(req.user.uid, id);
    const [candidate, job] = await Promise.all([
      data.candidateId
        ? this.usersRepository.findOne({ where: { id: data.candidateId } })
        : null,
      data.jobId
        ? this.jobs.findOne({
            where: { id: data.jobId, companyId: id, active: true },
          })
        : null,
    ]);
    if (!candidate?.isOpenToWork || !job)
      throw new BadRequestException('Candidato ou vaga inválidos.');
    const existing = await this.talentInvites.findOne({
      where: { candidateId: candidate.id, jobId: job.id },
    });
    if (existing?.status === 'PENDING') return existing;
    const invite =
      existing ||
      this.talentInvites.create({
        companyId: id,
        candidateId: candidate.id,
        jobId: job.id,
      });
    invite.status = 'PENDING';
    return this.talentInvites.save(invite);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const company = await this.companiesService.findOne(id);
    if (!company) return null;
    return {
      ...company,
      slugRollback: await this.companiesService.getSlugRollbackOption(company),
    };
  }

  @Post()
  async create(@Req() req: any, @Body() createData: Partial<Company>) {
    const user = await this.usersRepository.findOne({
      where: { id: req.user.uid },
    });
    if (!user || user.type !== UserType.COMPANY)
      throw new ForbiddenException(
        'Apenas contas empresariais podem criar empresas.',
      );
    if (!createData.name?.trim())
      throw new BadRequestException('O nome da empresa é obrigatório.');
    const company = await this.companiesService.create(
      req.user.uid,
      createData,
    );
    await this.usersRepository.update(
      { id: req.user.uid },
      {
        companyId: company.id,
        isCompanyAdmin: true,
        companyName: company.name,
      },
    );
    return company;
  }

  @Post('register')
  async registerNewCompany(@Req() req: any, @Body() data: Partial<Company>) {
    const user = await this.usersRepository.findOne({
      where: { id: req.user.uid },
    });
    if (!user || user.type !== UserType.COMPANY)
      throw new ForbiddenException(
        'Conclua primeiro o cadastro como conta empresarial.',
      );
    if (user.companyId)
      throw new BadRequestException(
        'Sua conta já está vinculada a uma empresa.',
      );
    if (!data.name?.trim())
      throw new BadRequestException('O nome da empresa é obrigatório.');
    const existing = await this.companiesService.findExactName(data.name);
    if (existing)
      throw new BadRequestException(
        'Esta empresa já está cadastrada. Selecione-a na busca e solicite o vínculo.',
      );
    const company = await this.companiesService.create(req.user.uid, data);
    await this.usersRepository.update(
      { id: req.user.uid },
      {
        companyId: company.id,
        companyName: company.name,
        isCompanyAdmin: true,
        status: 'ACTIVE',
      },
    );
    return company;
  }

  @Post(':id/access-requests')
  async requestAccess(@Req() req: any, @Param('id') id: string) {
    const [company, user] = await Promise.all([
      this.companiesService.findOne(id),
      this.usersRepository.findOne({ where: { id: req.user.uid } }),
    ]);
    if (!company) throw new BadRequestException('Empresa não encontrada.');
    if (!user || user.type !== UserType.COMPANY)
      throw new ForbiddenException(
        'Conclua primeiro o cadastro como conta empresarial.',
      );
    if (user.companyId && user.companyId !== id)
      throw new BadRequestException(
        'Sua conta já está vinculada a outra empresa.',
      );
    if (user.companyId === id)
      throw new BadRequestException(
        'Sua conta já possui acesso a esta empresa.',
      );

    const existing = await this.accessRequestsRepository.findOne({
      where: { companyId: id, userId: user.id },
    });
    if (existing?.status === CompanyAccessRequestStatus.PENDING)
      return existing;
    const request =
      existing ||
      this.accessRequestsRepository.create({ companyId: id, userId: user.id });
    request.requesterName = user.fullName || user.displayName || 'Usuário';
    request.requesterEmail = user.email || '';
    request.status = CompanyAccessRequestStatus.PENDING;
    request.reviewedById = null;
    request.reviewNote = null;
    return this.accessRequestsRepository.save(request);
  }

  @Get('access-requests/me')
  async myAccessRequest(@Req() req: any) {
    const request = await this.accessRequestsRepository.findOne({
      where: { userId: req.user.uid },
      order: { updatedAt: 'DESC' },
    });
    if (!request) return null;
    const company = await this.companiesService.findOne(request.companyId);
    return { ...request, companyName: company?.name || 'Empresa removida' };
  }

  @Get(':id/access-requests')
  async listAccessRequests(@Req() req: any, @Param('id') id: string) {
    await this.assertManager(req.user.uid, id);
    return this.accessRequestsRepository.find({
      where: { companyId: id, status: CompanyAccessRequestStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }

  @Put(':id/access-requests/:requestId')
  async reviewAccessRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() data: { action?: string; role?: string; note?: string },
  ) {
    await this.assertManager(req.user.uid, id);
    const request = await this.accessRequestsRepository.findOne({
      where: { id: requestId, companyId: id },
    });
    if (!request || request.status !== CompanyAccessRequestStatus.PENDING)
      throw new BadRequestException(
        'Solicitação não encontrada ou já processada.',
      );
    if (!['approve', 'reject'].includes(data.action || ''))
      throw new BadRequestException('Ação inválida.');
    request.reviewedById = req.user.uid;
    request.reviewNote =
      typeof data.note === 'string' ? data.note.slice(0, 1000) : null;
    if (data.action === 'reject') {
      request.status = CompanyAccessRequestStatus.REJECTED;
      return this.accessRequestsRepository.save(request);
    }
    const company = await this.companiesService.findOne(id);
    await this.usersRepository.update(
      { id: request.userId },
      {
        type: UserType.COMPANY,
        companyId: id,
        companyName: company?.name,
        isCompanyAdmin: data.role === 'admin',
        status: 'ACTIVE',
      },
    );
    request.status = CompanyAccessRequestStatus.APPROVED;
    return this.accessRequestsRepository.save(request);
  }

  @Put(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateData: Partial<Company>,
  ) {
    const company = await this.assertManager(req.user.uid, id);
    const user = await this.usersRepository.findOne({
      where: { id: req.user.uid },
    });
    if (
      user?.type !== UserType.ADMIN &&
      updateData.verificationStatus &&
      !['DRAFT', 'PENDING'].includes(updateData.verificationStatus)
    ) {
      throw new ForbiddenException(
        'A verificação da empresa é concluída exclusivamente pela administração.',
      );
    }
    const requestedSlug =
      typeof updateData.slug === 'string' ? updateData.slug.trim() : '';
    if (
      requestedSlug &&
      requestedSlug !== company.slug &&
      company.verificationStatus !== 'VERIFIED'
    )
      throw new ForbiddenException(
        'A URL personalizada está disponível somente para empresas verificadas.',
      );
    const safeUpdates = { ...updateData };
    delete safeUpdates.slug;
    let updated = await this.companiesService.update(
      req.user.uid,
      id,
      safeUpdates,
      true,
    );
    if (requestedSlug && requestedSlug !== updated.slug)
      updated = await this.companiesService.requestSlugChange(
        req.user.uid,
        id,
        requestedSlug,
      );
    return {
      ...updated,
      slugRollback: await this.companiesService.getSlugRollbackOption(updated),
    };
  }

  @Post(':id/slug-rollback')
  async rollbackSlug(@Req() req: any, @Param('id') id: string) {
    await this.assertManager(req.user.uid, id);
    return this.companiesService.rollbackSlugChange(req.user.uid, id);
  }

  @Get(':id/employees')
  async getEmployees(@Req() req: any, @Param('id') id: string) {
    await this.assertManager(req.user.uid, id);
    return this.usersRepository.find({ where: { companyId: id } });
  }

  @Post(':id/employees')
  async addEmployee(
    @Req() req: any,
    @Param('id') id: string,
    @Body() data: { name?: string; email?: string; role?: string },
  ) {
    await this.assertManager(req.user.uid, id);
    if (!data.name?.trim() || !data.email?.trim())
      throw new BadRequestException('Nome e e-mail são obrigatórios.');
    const email = data.email.trim().toLowerCase();
    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing)
      throw new BadRequestException(
        'Este e-mail já possui uma conta. Vincule-o por um fluxo administrativo.',
      );
    const invitation = this.invitationsRepository.create({
      companyId: id,
      name: data.name.trim(),
      email,
      isCompanyAdmin: data.role === 'admin',
    });
    await this.invitationsRepository.save(invitation);
    return { success: true, invitationId: invitation.id };
  }

  @Put(':id/employees/:empId/role')
  async updateEmployeeRole(
    @Req() req: any,
    @Param('id') id: string,
    @Param('empId') empId: string,
    @Body() data: any,
  ) {
    await this.assertManager(req.user.uid, id);
    await this.usersRepository.update(
      { id: empId, companyId: id },
      { isCompanyAdmin: data.isCompanyAdmin },
    );
    return { success: true };
  }

  @Delete(':id/employees/:empId')
  async removeEmployee(
    @Req() req: any,
    @Param('id') id: string,
    @Param('empId') empId: string,
  ) {
    await this.assertManager(req.user.uid, id);
    await this.usersRepository.update(
      { id: empId, companyId: id },
      { companyId: null, isCompanyAdmin: false },
    );
    return { success: true };
  }
}
