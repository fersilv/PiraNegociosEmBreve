import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import type { Response } from 'express';
import { Company, CompanyStatus } from '../companies/entities/company.entity';
import { Job } from '../jobs/entities/job.entity';
import { isReservedCompanySlug, slugify } from './seo.utils';
import { CompanySlugAlias } from '../companies/entities/company-slug-alias.entity';

const siteUrl = () =>
  (process.env.PUBLIC_SITE_URL || 'https://piranegocios.com.br').replace(
    /\/$/,
    '',
  );

@Controller()
export class PublicSeoController {
  constructor(
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(CompanySlugAlias)
    private readonly companySlugAliases: Repository<CompanySlugAlias>,
  ) {}

  @Get('public/slug-availability')
  async slugAvailability(@Query('slug') value?: string) {
    const slug = slugify(value || '');
    if (!slug || isReservedCompanySlug(slug)) return { slug, available: false };
    const [exists, alias] = await Promise.all([
      this.companies.exists({ where: [{ slug }, { pendingSlug: slug }] }),
      this.companySlugAliases.exists({
        where: { slug, expiresAt: MoreThan(new Date()) },
      }),
    ]);
    return { slug, available: !exists && !alias };
  }

  @Get('public/companies/:slug')
  async company(@Param('slug') slug: string) {
    let company = await this.companies.findOne({
      where: { slug, verificationStatus: CompanyStatus.VERIFIED },
    });
    let resolvedFromAlias = false;
    if (!company) {
      const alias = await this.companySlugAliases.findOne({
        where: { slug, expiresAt: MoreThan(new Date()) },
      });
      if (alias) {
        company = await this.companies.findOne({
          where: {
            id: alias.companyId,
            verificationStatus: CompanyStatus.VERIFIED,
          },
        });
        resolvedFromAlias = Boolean(company);
      }
    }
    if (!company)
      throw new NotFoundException('Empresa pública não encontrada.');
    const jobs = await this.jobs
      .createQueryBuilder('job')
      .where('job.companyId = :companyId', { companyId: company.id })
      .andWhere('job.active = true')
      .andWhere('job.isConfidential = false')
      .andWhere(
        '(job.deadlineDate IS NULL OR job.deadlineDate >= CURRENT_DATE)',
      )
      .orderBy('job.createdAt', 'DESC')
      .getMany();
    return {
      company: this.publicCompany(company),
      jobs: jobs.map((job) => this.publicJob(job, company)),
      resolvedFromAlias,
    };
  }

  @Get('public/jobs/:slug')
  async job(@Param('slug') slug: string) {
    const job = await this.findPublicJob('slug', slug);
    const company = await this.publicJobCompany(job);
    return this.publicJob(job, company);
  }

  @Post('public/jobs/:id/view')
  async registerJobView(@Param('id') id: string) {
    const job = await this.findPublicJob('id', id);
    await this.publicJobCompany(job);

    await this.jobs.increment({ id: job.id }, 'views', 1);
    const updated = await this.jobs.findOne({
      where: { id: job.id },
      select: { views: true },
    });

    return { views: Number(updated?.views || job.views + 1) };
  }

  @Get('seo/sitemap')
  async sitemap(@Res() response: Response) {
    const [companies, jobs] = await Promise.all([
      this.companies.find({
        where: { verificationStatus: CompanyStatus.VERIFIED },
        select: { slug: true, updatedAt: true },
      }),
      this.jobs
        .createQueryBuilder('job')
        .leftJoin(Company, 'company', 'company.id::varchar = job.companyId')
        .where('job.active = true')
        .andWhere('job.isConfidential = false')
        .andWhere('job.slug IS NOT NULL')
        .andWhere(
          '(job.companyId IS NULL OR company.verificationStatus = :status)',
          { status: CompanyStatus.VERIFIED },
        )
        .andWhere(
          '(job.deadlineDate IS NULL OR job.deadlineDate >= CURRENT_DATE)',
        )
        .select(['job.slug', 'job.updatedAt'])
        .getMany(),
    ]);
    const urls = [
      { loc: `${siteUrl()}/`, lastmod: new Date() },
      { loc: `${siteUrl()}/vagas`, lastmod: new Date() },
      ...companies
        .filter((company) => company.slug)
        .map((company) => ({
          loc: `${siteUrl()}/${company.slug}`,
          lastmod: company.updatedAt || new Date(),
        })),
      ...jobs
        .filter((job) => job.slug)
        .map((job) => ({
          loc: `${siteUrl()}/vagas/${job.slug}`,
          lastmod: job.updatedAt || new Date(),
        })),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/sitemap/0.9">\n${urls.map((url) => {
      const d = url.lastmod instanceof Date && !isNaN(url.lastmod.getTime()) ? url.lastmod : new Date();
      return `  <url><loc>${this.escapeXml(url.loc)}</loc><lastmod>${d.toISOString().slice(0, 10)}</lastmod></url>`;
    }).join('\n')}\n</urlset>`;
    response.type('application/xml').send(xml);
  }

  private async findPublicJob(field: 'id' | 'slug', value: string) {
    const job = await this.jobs
      .createQueryBuilder('job')
      .where(`job.${field} = :value`, { value })
      .andWhere('job.active = true')
      .andWhere('job.isConfidential = false')
      .andWhere(
        '(job.deadlineDate IS NULL OR job.deadlineDate >= CURRENT_DATE)',
      )
      .getOne();

    if (!job) throw new NotFoundException('Vaga pública não encontrada.');
    return job;
  }

  private async publicJobCompany(job: Job) {
    const company = job.companyId
      ? await this.companies.findOne({
          where: {
            id: job.companyId,
            verificationStatus: CompanyStatus.VERIFIED,
          },
        })
      : null;

    if (job.companyId && !company)
      throw new NotFoundException('Vaga pública não encontrada.');
    return company;
  }

  private publicCompany(company: Company) {
    return {
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
      updatedAt: company.updatedAt,
    };
  }

  private publicJob(job: Job, company: Company | null) {
    return {
      id: job.id,
      slug: job.slug,
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      location: job.location,
      type: job.type,
      workModel: job.workModel,
      salary: job.salary,
      isTalentPool: job.isTalentPool,
      acceptsPlatformApplications: job.acceptsPlatformApplications,
      externalApplicationInstructions: job.externalApplicationInstructions,
      applicationEmail: job.applicationEmail,
      applicationWhatsApp: job.applicationWhatsApp,
      deadlineDate: job.deadlineDate,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      views: job.views,
      company: company ? this.publicCompany(company) : null,
      isExternalListing: job.isExternalListing,
      sourceName: job.sourceName,
      sourceUrl: job.sourceUrl,
    };
  }

  private escapeXml(value: string) {
    return value.replace(
      /[<>&'\"]/g,
      (character) =>
        ({
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          "'": '&apos;',
          '"': '&quot;',
        })[character] || character,
    );
  }
}
