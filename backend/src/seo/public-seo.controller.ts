import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import type { Response } from 'express';
import { createHash } from 'crypto';
import { Company, CompanyStatus } from '../companies/entities/company.entity';
import { Job } from '../jobs/entities/job.entity';
import { isReservedCompanySlug, slugify } from './seo.utils';
import { CompanySlugAlias } from '../companies/entities/company-slug-alias.entity';

const siteUrl = () =>
  (process.env.PUBLIC_SITE_URL || 'https://piranegocios.com.br').replace(/\/$/, '');

@Controller()
export class PublicSeoController {
  private readonly recentJobViews = new Map<string, number>();

  constructor(
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(CompanySlugAlias)
    private readonly companySlugAliases: Repository<CompanySlugAlias>,
  ) {}

  @Get('public/location-hint')
  locationHint(@Req() req: any) {
    const readHeader = (name: string) => {
      const value = req.headers?.[name];
      return Array.isArray(value) ? value[0] : typeof value === 'string' ? value.trim() : '';
    };
    const latitudeHeader = readHeader('cf-iplatitude');
    const longitudeHeader = readHeader('cf-iplongitude');
    const latitude = latitudeHeader ? Number(latitudeHeader) : Number.NaN;
    const longitude = longitudeHeader ? Number(longitudeHeader) : Number.NaN;
    const city = readHeader('cf-ipcity');
    const state = readHeader('cf-region-code');
    const country = readHeader('cf-ipcountry');
    const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

    return {
      city: city || null,
      state: state || null,
      country: country || null,
      latitude: hasCoordinates ? latitude : null,
      longitude: hasCoordinates ? longitude : null,
      source: city || hasCoordinates ? 'cloudflare' : null,
    };
  }

  @Get('public/jobs-index')
  async jobsIndex() {
    const jobs = await this.publicJobsQuery().orderBy('job.createdAt', 'DESC').getMany();
    const cityMap = new Map<string, { city: string; state: string | null; count: number; updatedAt: Date }>();

    for (const job of jobs) {
      const city = this.cityName(job);
      const slug = slugify(city);
      if (!city || !slug) continue;
      const state = job.state?.trim().toUpperCase() || this.stateFromLocation(job.location);
      const updatedAt = job.updatedAt || job.createdAt || new Date();
      const existing = cityMap.get(slug);
      cityMap.set(slug, {
        city,
        state: state || existing?.state || null,
        count: (existing?.count || 0) + 1,
        updatedAt: !existing || updatedAt > existing.updatedAt ? updatedAt : existing.updatedAt,
      });
    }

    return {
      count: jobs.length,
      cities: Array.from(cityMap.entries())
        .map(([slug, value]) => ({ slug, ...value }))
        .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, 'pt-BR')),
      jobs: jobs.map((job) => ({
        id: job.id,
        slug: job.slug,
        title: job.title,
        companyName: job.companyName,
        sourceName: job.sourceName,
        location: job.location,
        city: job.city,
        state: job.state,
        type: job.type,
        workModel: job.workModel,
        salary: job.salary,
        applicationUrl: job.applicationUrl,
        applicationUrlTitle: job.applicationUrlTitle,
        sourcePublishedAt: job.sourcePublishedAt,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      })),
    };
  }

  @Get('public/slug-availability')
  async slugAvailability(@Query('slug') value?: string) {
    const slug = slugify(value || '');
    if (!slug || isReservedCompanySlug(slug)) return { slug, available: false };
    const [exists, alias] = await Promise.all([
      this.companies.exists({ where: [{ slug }, { pendingSlug: slug }] }),
      this.companySlugAliases.exists({ where: { slug, expiresAt: MoreThan(new Date()) } }),
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
          where: { id: alias.companyId, verificationStatus: CompanyStatus.VERIFIED },
        });
        resolvedFromAlias = Boolean(company);
      }
    }
    if (!company) throw new NotFoundException('Empresa pública não encontrada.');
    const jobs = await this.jobs
      .createQueryBuilder('job')
      .where('job.companyId = :companyId', { companyId: company.id })
      .andWhere('job.active = true')
      .andWhere('job.isConfidential = false')
      .andWhere('(job.deadlineDate IS NULL OR job.deadlineDate >= CURRENT_DATE)')
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

  @Get('public/jobs-by-city/:citySlug')
  async jobsByCity(@Param('citySlug') citySlug: string) {
    const normalizedSlug = slugify(citySlug);
    const jobs = await this.publicJobsQuery().orderBy('job.createdAt', 'DESC').getMany();
    const matching = jobs.filter((job) => slugify(this.cityName(job)) === normalizedSlug);
    if (!matching.length) throw new NotFoundException('Não há vagas públicas ativas para esta cidade.');
    const city = this.cityName(matching[0]);
    const state = matching.find((job) => job.state)?.state || this.stateFromLocation(matching[0].location);
    const publicJobs = await Promise.all(
      matching.map(async (job) => this.publicJob(job, await this.publicJobCompany(job))),
    );
    return {
      city,
      state: state || null,
      slug: normalizedSlug,
      count: publicJobs.length,
      jobs: publicJobs,
      updatedAt: matching.reduce<Date | null>((latest, job) => {
        const value = job.updatedAt || job.createdAt;
        return !latest || value > latest ? value : latest;
      }, null),
    };
  }

  @Post('public/jobs/:id/view')
  async registerJobView(@Param('id') id: string, @Req() req: any) {
    const job = await this.findPublicJob('id', id);
    await this.publicJobCompany(job);
    return this.incrementJobView(job, req);
  }

  @Post('public/jobs-by-slug/:slug/view')
  async registerJobViewBySlug(@Param('slug') slug: string, @Req() req: any) {
    const job = await this.findPublicJob('slug', slug);
    await this.publicJobCompany(job);
    return this.incrementJobView(job, req);
  }

  @Get('seo/sitemap')
  async sitemap(@Res() response: Response) {
    const [companies, jobs] = await Promise.all([
      this.companies.find({
        where: { verificationStatus: CompanyStatus.VERIFIED },
        select: { slug: true, updatedAt: true },
      }),
      this.publicJobsQuery()
        .select([
          'job.id', 'job.slug', 'job.city', 'job.state', 'job.location',
          'job.updatedAt', 'job.createdAt',
        ])
        .getMany(),
    ]);

    const cityMap = new Map<string, { name: string; lastmod: Date }>();
    for (const job of jobs) {
      const city = this.cityName(job);
      const slug = slugify(city);
      if (!slug) continue;
      const lastmod = job.updatedAt || job.createdAt || new Date();
      const existing = cityMap.get(slug);
      if (!existing || lastmod > existing.lastmod) cityMap.set(slug, { name: city, lastmod });
    }

    const urls = [
      { loc: `${siteUrl()}/`, lastmod: new Date() },
      { loc: `${siteUrl()}/vagas`, lastmod: new Date() },
      ...Array.from(cityMap.entries()).map(([slug, city]) => ({
        loc: `${siteUrl()}/vagas-em/${slug}`,
        lastmod: city.lastmod,
      })),
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
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => {
      const d = url.lastmod instanceof Date && !isNaN(url.lastmod.getTime()) ? url.lastmod : new Date();
      return `  <url><loc>${this.escapeXml(url.loc)}</loc><lastmod>${d.toISOString().slice(0, 10)}</lastmod></url>`;
    }).join('\n')}\n</urlset>`;
    response.type('application/xml').send(xml);
  }

  private async incrementJobView(job: Job, req: any) {
    const forwarded = String(req.headers?.['cf-connecting-ip'] || req.headers?.['x-forwarded-for'] || req.ip || '')
      .split(',')[0]
      .trim();
    const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 220);
    const visitorHash = createHash('sha256')
      .update(`${forwarded}|${userAgent}`)
      .digest('hex')
      .slice(0, 24);
    const key = `${job.id}:${visitorHash}`;
    const now = Date.now();
    const previous = this.recentJobViews.get(key);

    if (previous && now - previous < 8_000) {
      const current = await this.jobs.findOne({ where: { id: job.id }, select: { views: true } });
      return { views: Number(current?.views || job.views || 0), counted: false };
    }

    this.recentJobViews.set(key, now);
    if (this.recentJobViews.size > 5_000) {
      const cutoff = now - 60_000;
      for (const [entryKey, timestamp] of this.recentJobViews.entries()) {
        if (timestamp < cutoff) this.recentJobViews.delete(entryKey);
      }
    }

    await this.jobs.increment({ id: job.id }, 'views', 1);
    const updated = await this.jobs.findOne({ where: { id: job.id }, select: { views: true } });
    return { views: Number(updated?.views || Number(job.views || 0) + 1), counted: true };
  }

  private publicJobsQuery() {
    return this.jobs
      .createQueryBuilder('job')
      .leftJoin(Company, 'company', 'company.id::varchar = job.companyId')
      .where('job.active = true')
      .andWhere('job.isConfidential = false')
      .andWhere('job.slug IS NOT NULL')
      .andWhere(
        '(job.companyId IS NULL OR company.verificationStatus = :status)',
        { status: CompanyStatus.VERIFIED },
      )
      .andWhere('(job.deadlineDate IS NULL OR job.deadlineDate >= CURRENT_DATE)');
  }

  private cityName(job: Job): string {
    const explicit = job.city?.trim();
    if (explicit) return explicit;
    const location = String(job.location || '').trim();
    if (!location || /^remoto$/i.test(location)) return '';
    return location
      .split(',')[0]
      .trim()
      .replace(/\s*\/\s*[A-Z]{2}$/i, '')
      .trim();
  }

  private stateFromLocation(location: string | null | undefined): string | null {
    const value = String(location || '');
    const match = value.match(/(?:,|\/)\s*([A-Z]{2})\s*$/i);
    return match ? match[1].toUpperCase() : null;
  }

  private async findPublicJob(field: 'id' | 'slug', value: string) {
    const job = await this.jobs
      .createQueryBuilder('job')
      .where(`job.${field} = :value`, { value })
      .andWhere('job.active = true')
      .andWhere('job.isConfidential = false')
      .andWhere('(job.deadlineDate IS NULL OR job.deadlineDate >= CURRENT_DATE)')
      .getOne();
    if (!job) throw new NotFoundException('Vaga pública não encontrada.');
    return job;
  }

  private async publicJobCompany(job: Job) {
    const company = job.companyId
      ? await this.companies.findOne({
          where: { id: job.companyId, verificationStatus: CompanyStatus.VERIFIED },
        })
      : null;
    if (job.companyId && !company) throw new NotFoundException('Vaga pública não encontrada.');
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
      city: job.city,
      state: job.state,
      type: job.type,
      workModel: job.workModel,
      salary: job.salary,
      pcdMode: job.pcdMode,
      isTalentPool: job.isTalentPool,
      acceptsPlatformApplications: job.acceptsPlatformApplications,
      requiresResumeFile: job.requiresResumeFile,
      externalApplicationInstructions: job.externalApplicationInstructions,
      applicationEmail: job.applicationEmail,
      applicationWhatsApp: job.applicationWhatsApp,
      applicationUrl: job.applicationUrl,
      applicationUrlTitle: job.applicationUrlTitle,
      deadlineDate: job.deadlineDate,
      sourcePublishedAt: job.sourcePublishedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      views: job.views,
      company: company ? this.publicCompany(company) : null,
      companyName: job.isConfidential ? null : (company?.name || job.companyName || null),
      isExternalListing: job.isExternalListing,
      sourceName: job.sourceName,
      sourceUrl: job.sourceUrl,
    };
  }

  private escapeXml(value: string) {
    return value.replace(
      /[<>&'\"]/g,
      (character) =>
        ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] || character,
    );
  }
}
