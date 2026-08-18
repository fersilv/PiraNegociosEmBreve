import { BadRequestException, Controller, ForbiddenException, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { Company } from './entities/company.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserType } from '../users/entities/user.entity';
import { CompanyInvitation } from '../users/entities/company-invitation.entity';
import { CompanyAccessRequest, CompanyAccessRequestStatus } from './entities/company-access-request.entity';

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
  ) {}

  private async assertManager(uid: string, companyId: string) {
    const [company, user] = await Promise.all([
      this.companiesService.findOne(companyId),
      this.usersRepository.findOne({ where: { id: uid } }),
    ]);
    if (!company) throw new BadRequestException('Empresa não encontrada.');
    if (user?.type === UserType.ADMIN) return company;
    if (!user || user.type !== UserType.COMPANY || (company.ownerId !== uid && !(user.companyId === companyId && user.isCompanyAdmin))) {
      throw new ForbiddenException('Você não tem permissão para administrar esta empresa.');
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
    const user = await this.usersRepository.findOne({ where: { id: req.user.uid } });
    const companyId = user?.companyId;
    const normalized = slug?.trim().toLowerCase();
    if (!normalized) return { available: false };
    const company = await this.companiesService.findBySlug(normalized);
    return { available: !company || company.id === companyId };
  }

  @Get('mine')
  async findAllMyCompanies(@Req() req: any) {
    const user = await this.usersRepository.findOne({ where: { id: req.user.uid } });
    if (user?.type === UserType.ADMIN) return this.companiesService.findAll();
    const owned = await this.companiesService.findAllMyCompanies(req.user.uid);
    if (!user?.companyId || owned.some(company => company.id === user.companyId)) return owned;
    const linked = await this.companiesService.findOne(user.companyId);
    return linked ? [linked, ...owned] : owned;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Post()
  async create(@Req() req: any, @Body() createData: Partial<Company>) {
    const user = await this.usersRepository.findOne({ where: { id: req.user.uid } });
    if (!user || user.type !== UserType.COMPANY) throw new ForbiddenException('Apenas contas empresariais podem criar empresas.');
    if (!createData.name?.trim()) throw new BadRequestException('O nome da empresa é obrigatório.');
    const company = await this.companiesService.create(req.user.uid, createData);
    await this.usersRepository.update({ id: req.user.uid }, { companyId: company.id, isCompanyAdmin: true, companyName: company.name });
    return company;
  }

  @Post('register')
  async registerNewCompany(@Req() req: any, @Body() data: Partial<Company>) {
    const user = await this.usersRepository.findOne({ where: { id: req.user.uid } });
    if (!user || user.type !== UserType.COMPANY) throw new ForbiddenException('Conclua primeiro o cadastro como conta empresarial.');
    if (user.companyId) throw new BadRequestException('Sua conta já está vinculada a uma empresa.');
    if (!data.name?.trim()) throw new BadRequestException('O nome da empresa é obrigatório.');
    const existing = await this.companiesService.findExactName(data.name);
    if (existing) throw new BadRequestException('Esta empresa já está cadastrada. Selecione-a na busca e solicite o vínculo.');
    const company = await this.companiesService.create(req.user.uid, data);
    await this.usersRepository.update({ id: req.user.uid }, { companyId: company.id, companyName: company.name, isCompanyAdmin: true, status: 'ACTIVE' });
    return company;
  }

  @Post(':id/access-requests')
  async requestAccess(@Req() req: any, @Param('id') id: string) {
    const [company, user] = await Promise.all([
      this.companiesService.findOne(id),
      this.usersRepository.findOne({ where: { id: req.user.uid } }),
    ]);
    if (!company) throw new BadRequestException('Empresa não encontrada.');
    if (!user || user.type !== UserType.COMPANY) throw new ForbiddenException('Conclua primeiro o cadastro como conta empresarial.');
    if (user.companyId && user.companyId !== id) throw new BadRequestException('Sua conta já está vinculada a outra empresa.');
    if (user.companyId === id) throw new BadRequestException('Sua conta já possui acesso a esta empresa.');

    const existing = await this.accessRequestsRepository.findOne({ where: { companyId: id, userId: user.id } });
    if (existing?.status === CompanyAccessRequestStatus.PENDING) return existing;
    const request = existing || this.accessRequestsRepository.create({ companyId: id, userId: user.id });
    request.requesterName = user.fullName || user.displayName || 'Usuário';
    request.requesterEmail = user.email || '';
    request.status = CompanyAccessRequestStatus.PENDING;
    request.reviewedById = null;
    request.reviewNote = null;
    return this.accessRequestsRepository.save(request);
  }

  @Get('access-requests/me')
  async myAccessRequest(@Req() req: any) {
    const request = await this.accessRequestsRepository.findOne({ where: { userId: req.user.uid }, order: { updatedAt: 'DESC' } });
    if (!request) return null;
    const company = await this.companiesService.findOne(request.companyId);
    return { ...request, companyName: company?.name || 'Empresa removida' };
  }

  @Get(':id/access-requests')
  async listAccessRequests(@Req() req: any, @Param('id') id: string) {
    await this.assertManager(req.user.uid, id);
    return this.accessRequestsRepository.find({ where: { companyId: id, status: CompanyAccessRequestStatus.PENDING }, order: { createdAt: 'ASC' } });
  }

  @Put(':id/access-requests/:requestId')
  async reviewAccessRequest(@Req() req: any, @Param('id') id: string, @Param('requestId') requestId: string, @Body() data: { action?: string; role?: string; note?: string }) {
    await this.assertManager(req.user.uid, id);
    const request = await this.accessRequestsRepository.findOne({ where: { id: requestId, companyId: id } });
    if (!request || request.status !== CompanyAccessRequestStatus.PENDING) throw new BadRequestException('Solicitação não encontrada ou já processada.');
    if (!['approve', 'reject'].includes(data.action || '')) throw new BadRequestException('Ação inválida.');
    request.reviewedById = req.user.uid;
    request.reviewNote = typeof data.note === 'string' ? data.note.slice(0, 1000) : null;
    if (data.action === 'reject') {
      request.status = CompanyAccessRequestStatus.REJECTED;
      return this.accessRequestsRepository.save(request);
    }
    const company = await this.companiesService.findOne(id);
    await this.usersRepository.update({ id: request.userId }, {
      type: UserType.COMPANY,
      companyId: id,
      companyName: company?.name,
      isCompanyAdmin: data.role === 'admin',
      status: 'ACTIVE',
    });
    request.status = CompanyAccessRequestStatus.APPROVED;
    return this.accessRequestsRepository.save(request);
  }

  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() updateData: Partial<Company>) {
    await this.assertManager(req.user.uid, id);
    const user = await this.usersRepository.findOne({ where: { id: req.user.uid } });
    if (user?.type !== UserType.ADMIN && updateData.verificationStatus && !['DRAFT', 'PENDING'].includes(updateData.verificationStatus)) {
      throw new ForbiddenException('A verificação da empresa é concluída exclusivamente pela administração.');
    }
    return this.companiesService.update(req.user.uid, id, updateData, true);
  }

  @Get(':id/employees')
  async getEmployees(@Req() req: any, @Param('id') id: string) {
    await this.assertManager(req.user.uid, id);
    return this.usersRepository.find({ where: { companyId: id } });
  }

  @Post(':id/employees')
  async addEmployee(@Req() req: any, @Param('id') id: string, @Body() data: { name?: string; email?: string; role?: string }) {
    await this.assertManager(req.user.uid, id);
    if (!data.name?.trim() || !data.email?.trim()) throw new BadRequestException('Nome e e-mail são obrigatórios.');
    const email = data.email.trim().toLowerCase();
    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing) throw new BadRequestException('Este e-mail já possui uma conta. Vincule-o por um fluxo administrativo.');
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
  async updateEmployeeRole(@Req() req: any, @Param('id') id: string, @Param('empId') empId: string, @Body() data: any) {
    await this.assertManager(req.user.uid, id);
    await this.usersRepository.update({ id: empId, companyId: id }, { isCompanyAdmin: data.isCompanyAdmin });
    return { success: true };
  }

  @Delete(':id/employees/:empId')
  async removeEmployee(@Req() req: any, @Param('id') id: string, @Param('empId') empId: string) {
    await this.assertManager(req.user.uid, id);
    await this.usersRepository.update({ id: empId, companyId: id }, { companyId: null, isCompanyAdmin: false });
    return { success: true };
  }
}
