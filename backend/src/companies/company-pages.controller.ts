import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { User, UserType } from '../users/entities/user.entity';
import { Company, CompanyStatus } from './entities/company.entity';
import { CompanyPagesService } from './company-pages.service';

@Controller('companies')
@UseGuards(FirebaseAuthGuard)
export class CompanyPagesController {
  constructor(
    private readonly companyPages: CompanyPagesService,
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  private async assertManager(uid: string, companyId: string) {
    const [company, user] = await Promise.all([
      this.companies.findOne({ where: { id: companyId } }),
      this.users.findOne({ where: { id: uid } }),
    ]);
    if (!company) throw new BadRequestException('Empresa não encontrada.');
    if (user?.type !== UserType.ADMIN) {
      if (
        !user ||
        (company.ownerId !== uid && !(user.companyId === companyId && user.isCompanyAdmin))
      ) {
        throw new ForbiddenException('Você não tem permissão para editar a página desta empresa.');
      }
    }
    if (company.verificationStatus !== CompanyStatus.VERIFIED) {
      throw new ForbiddenException(
        'Minha Página está disponível apenas para empresas verificadas.',
      );
    }
    return company;
  }

  @Get(':id/page')
  async getPage(@Req() req: any, @Param('id') id: string) {
    const company = await this.assertManager(req.user.uid, id);
    const page = await this.companyPages.getForCompany(company);
    return {
      ...page,
      access: {
        requiresVerifiedCompany: true,
        advancedEditor: {
          product: 'COMPANY_PLUS',
          requiresPlus: true,
          testMode: true,
          allowed: true,
        },
      },
    };
  }

  @Put(':id/page/draft')
  async saveDraft(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { config?: unknown },
  ) {
    const company = await this.assertManager(req.user.uid, id);
    return this.companyPages.saveDraft(company, body?.config);
  }

  @Post(':id/page/preview')
  async createPreview(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { config?: unknown },
  ) {
    const company = await this.assertManager(req.user.uid, id);
    const preview = await this.companyPages.createPreview(company, body?.config);
    return {
      ...preview,
      url: `/preview/empresa/${preview.token}`,
    };
  }

  @Post(':id/page/publish')
  async publish(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { config?: unknown },
  ) {
    const company = await this.assertManager(req.user.uid, id);
    return this.companyPages.publish(company, body?.config);
  }

  @Delete(':id/page/published')
  async unpublish(@Req() req: any, @Param('id') id: string) {
    const company = await this.assertManager(req.user.uid, id);
    return this.companyPages.unpublish(company);
  }
}
