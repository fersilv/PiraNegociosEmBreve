import { BadRequestException, Controller, ForbiddenException, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { Company } from './entities/company.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserType } from '../users/entities/user.entity';
import { CompanyInvitation } from '../users/entities/company-invitation.entity';

@Controller('companies')
@UseGuards(FirebaseAuthGuard)
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(CompanyInvitation)
    private invitationsRepository: Repository<CompanyInvitation>,
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

  @Get('mine')
  findAllMyCompanies(@Req() req: any) {
    return this.companiesService.findAllMyCompanies(req.user.uid);
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
