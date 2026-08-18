import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response } from 'express';
import { Company, CompanyStatus } from '../companies/entities/company.entity';
import { Job } from '../jobs/entities/job.entity';
import { isReservedCompanySlug, slugify } from './seo.utils';

const siteUrl = () => (process.env.PUBLIC_SITE_URL || 'https://piranegocios.com.br').replace(/\/$/, '');

@Controller()
export class PublicSeoController {
  constructor(
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
  ) {}

  @Get('public/slug-availability')
  async slugAvailability(@Query('slug') value?: string) {
    const slug = slugify(value || '');
    if (!slug || isReservedCompanySlug(slug)) return { slug, available: false };
    const exists = await this.companies.exists({ where: { slug } });
    return { slug, available: !exists };
  }

  @Get('public/companies/:slug')
  async company(@Param('slug') slug: string) {
    const company = await this.companies.findOne({ where: { slug, verificationStatus: CompanyStatus.VERIFIED } });
    if (!company) throw new NotFoundException('Empresa pública não encontrada.');
    const jobs = await this.jobs.createQueryBuilder('job')
      .where('job.companyId = :companyId', { companyId: company.id })
      .andWhere('job.active = true')
      .andWhere('job.isConfidential = false')
      .andWhere('(job.deadlineDate IS NULL OR job.deadlineDate >= CURRENT_DATE)')
      .orderBy('job.createdAt', 'DESC')
      .getMany();
    return { company: this.publicCompany(company), jobs: jobs.map(job => this.publicJob(job, company)) };
  }

  @Get('public/jobs/:slug')
  async job(@Param('slug') slug: string) {
    const result = await this.jobs.createQueryBuilder('job')
      .innerJoinAndSelect(Company, 'company', 'company.id = job.companyId')
      .where('job.slug = :slug', { slug })
      .andWhere('job.active = true')
      .andWhere('job.isConfidential = false')
      .andWhere('company.verificationStatus = :status', { status: CompanyStatus.VERIFIED })
      .andWhere('(job.deadlineDate IS NULL OR job.deadlineDate >= CURRENT_DATE)')
      .getRawAndEntities();
    const job = result.entities[0];
    const row = result.raw[0];
    if (!job || !row) throw new NotFoundException('Vaga pública não encontrada.');
    const company = await this.companies.findOneByOrFail({ id: job.companyId });
    return this.publicJob(job, company);
  }

  @Get('seo/sitemap')
  async sitemap(@Res() response: Response) {
    const [companies, jobs] = await Promise.all([
      this.companies.find({ where: { verificationStatus: CompanyStatus.VERIFIED }, select: { slug: true, updatedAt: true } }),
      this.jobs.createQueryBuilder('job')
        .innerJoin(Company, 'company', 'company.id = job.companyId')
        .where('job.active = true')
        .andWhere('job.isConfidential = false')
        .andWhere('job.slug IS NOT NULL')
        .andWhere('company.verificationStatus = :status', { status: CompanyStatus.VERIFIED })
        .andWhere('(job.deadlineDate IS NULL OR job.deadlineDate >= CURRENT_DATE)')
        .select(['job.slug', 'job.updatedAt'])
        .getMany(),
    ]);
    const urls = [
      { loc: `${siteUrl()}/`, lastmod: new Date() },
      { loc: `${siteUrl()}/vagas`, lastmod: new Date() },
      ...companies.filter(company => company.slug).map(company => ({ loc: `${siteUrl()}/${company.slug}`, lastmod: company.updatedAt })),
      ...jobs.filter(job => job.slug).map(job => ({ loc: `${siteUrl()}/vagas/${job.slug}`, lastmod: job.updatedAt })),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${this.escapeXml(url.loc)}</loc><lastmod>${url.lastmod.toISOString().slice(0, 10)}</lastmod></url>`).join('\n')}\n</urlset>`;
    response.type('application/xml').send(xml);
  }

  private publicCompany(company: Company) {
    return {
      id: company.id, name: company.name, slug: company.slug, description: company.description,
      website: company.website, address: company.address, cityState: company.cityState, phone: company.phone,
      logoURL: company.logoURL, socialInstagram: company.socialInstagram, socialLinkedin: company.socialLinkedin,
      socialFacebook: company.socialFacebook, updatedAt: company.updatedAt,
    };
  }

  private publicJob(job: Job, company: Company) {
    return {
      id: job.id, slug: job.slug, title: job.title, description: job.description, requirements: job.requirements, location: job.location,
      type: job.type, workModel: job.workModel, salary: job.salary, isTalentPool: job.isTalentPool,
      acceptsPlatformApplications: job.acceptsPlatformApplications,
      externalApplicationInstructions: job.externalApplicationInstructions, deadlineDate: job.deadlineDate,
      createdAt: job.createdAt, updatedAt: job.updatedAt, company: this.publicCompany(company),
    };
  }

  private escapeXml(value: string) {
    return value.replace(/[<>&'\"]/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[character] || character));
  }
}
