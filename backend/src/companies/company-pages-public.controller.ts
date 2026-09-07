import { BadGatewayException, Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { Company, CompanyStatus } from './entities/company.entity';
import { CompanyPage } from './entities/company-page.entity';
import { CompanyPagePreview } from './entities/company-page-preview.entity';
import { Job } from '../jobs/entities/job.entity';

@Controller('public/company-pages')
export class CompanyPagesPublicController {
  constructor(
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
    @InjectRepository(CompanyPage)
    private readonly pages: Repository<CompanyPage>,
    @InjectRepository(CompanyPagePreview)
    private readonly previews: Repository<CompanyPagePreview>,
    @InjectRepository(Job)
    private readonly jobs: Repository<Job>,
  ) {}

  @Get('rapi10/catalog')
  async rapi10Catalog() {
    const companies = await this.companies.find({
      where: { verificationStatus: CompanyStatus.VERIFIED },
      order: { updatedAt: 'DESC' },
    });
    if (!companies.length) return { complete: true, generatedAt: new Date().toISOString(), items: [] };
    const pages = await this.pages.find({ where: { companyId: In(companies.map((company) => company.id)) } });
    const byCompany = new Map(pages.map((page) => [page.companyId, page]));
    const items = companies.map((company) => {
      const page = byCompany.get(company.id);
      const config: any = (page?.published || page?.draft || {}) as any;
      const businessHours = config?.businessHours && typeof config.businessHours === 'object' ? config.businessHours : null;
      return {
        id: company.id,
        slug: company.slug,
        name: company.name,
        description: company.description,
        phone: company.phone,
        whatsapp: config?.contacts?.whatsapp || null,
        website: company.website,
        address: company.address,
        city: company.city,
        state: company.state,
        postalCode: company.commercialAddressSameAsLegal ? company.legalZipCode : null,
        logoUrl: company.logoURL,
        heroUrl: config?.cover?.enabled ? config?.cover?.url || null : null,
        catalogEnabled: company.rapi10CatalogEnabled !== false,
        businessHours,
        specialDates: Array.isArray(businessHours?.specialDates) ? businessHours.specialDates : [],
        updatedAt: company.updatedAt,
      };
    }).filter((item) => Boolean(item.name && item.address && item.city && item.state));
    return { complete: true, generatedAt: new Date().toISOString(), items };
  }

  @Get('company/:companyId/reviews')
  async reviews(@Param('companyId') companyId: string) {
    const company = await this.companies.findOne({
      where: { id: companyId, verificationStatus: CompanyStatus.VERIFIED },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Empresa pública não encontrada.');
    const base = String(process.env.RAPI10_PUBLIC_API_URL || 'https://rapi10.piranegocios.com.br/api/v1').replace(/\/$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    try {
      const response = await fetch(`${base}/catalog/companies/${encodeURIComponent(companyId)}/reviews`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (response.status === 404) return { place: { companyId }, summary: { average: null, count: 0 }, reviews: [] };
      if (!response.ok) throw new BadGatewayException('As avaliações estão temporariamente indisponíveis.');
      const payload: any = await response.json();
      return {
        place: payload?.place || { companyId },
        summary: {
          average: payload?.summary?.average == null ? null : Number(payload.summary.average),
          count: Math.max(0, Number(payload?.summary?.count || 0)),
        },
        reviews: Array.isArray(payload?.reviews) ? payload.reviews.slice(0, 200) : [],
      };
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('As avaliações estão temporariamente indisponíveis.');
    } finally {
      clearTimeout(timeout);
    }
  }

  @Get('company/:companyId')
  async published(@Param('companyId') companyId: string) {
    const company = await this.companies.findOne({
      where: { id: companyId, verificationStatus: CompanyStatus.VERIFIED },
    });
    if (!company) throw new NotFoundException('Empresa pública não encontrada.');
    const page = await this.pages.findOne({ where: { companyId } });
    if (!page || page.status !== 'PUBLISHED' || !page.published) {
      return { page: null };
    }
    return {
      page: page.published,
      templateKey: page.templateKey,
      revision: page.revision,
      publishedAt: page.publishedAt,
    };
  }

  @Get('preview/:token')
  async preview(@Param('token') token: string) {
    const preview = await this.previews.findOne({
      where: { token, expiresAt: MoreThan(new Date()) },
    });
    if (!preview) throw new NotFoundException('Prévia expirada ou não encontrada.');

    const company = await this.companies.findOne({ where: { id: preview.companyId } });
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    const jobs = await this.jobs
      .createQueryBuilder('job')
      .where('job.companyId = :companyId', { companyId: company.id })
      .andWhere('job.active = true')
      .andWhere('job.isConfidential = false')
      .andWhere('job."isInternal" = false')
      .andWhere('(job.deadlineDate IS NULL OR job.deadlineDate >= CURRENT_DATE)')
      .orderBy('job.createdAt', 'DESC')
      .getMany();

    return {
      preview: true,
      expiresAt: preview.expiresAt,
      page: preview.snapshot,
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        description: company.description,
        website: company.website,
        address: company.address,
        cityState: company.cityState,
        city: company.city,
        state: company.state,
        phone: company.phone,
        logoURL: company.logoURL,
        socialInstagram: company.socialInstagram,
        socialLinkedin: company.socialLinkedin,
        socialFacebook: company.socialFacebook,
        isVerified: company.isVerified,
        verificationStatus: company.verificationStatus,
      },
      jobs: jobs.map((job) => ({
        id: job.id,
        slug: job.slug,
        title: job.title,
        location: job.location,
        city: job.city,
        state: job.state,
        type: job.type,
        workModel: job.workModel,
        salary: job.salary,
      })),
    };
  }
}
