import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Between, FindOptionsWhere, In, Repository } from 'typeorm';
import { ApplicationsService } from '../applications/applications.service';
import { Application, ApplicationStatus } from '../applications/entities/application.entity';
import { ClassifiedsCategoryTaxonomyService } from '../classifieds/classifieds-category-taxonomy.service';
import { CLASSIFIEDS_TERMS_VERSION } from '../classifieds/classifieds-identity.service';
import { ClassifiedCategory } from '../classifieds/entities/classified-category.entity';
import { ClassifiedListingImage } from '../classifieds/entities/classified-listing-image.entity';
import {
  ClassifiedCondition,
  ClassifiedListing,
  ClassifiedListingStatus,
  ClassifiedPublicationChannel,
} from '../classifieds/entities/classified-listing.entity';
import { Company } from '../companies/entities/company.entity';
import { Job } from '../jobs/entities/job.entity';
import { JobsService } from '../jobs/jobs.service';

type ReportRange = { from?: string; to?: string; groupBy?: string; metrics?: string[] };

@Injectable()
export class CompanyMcpOperationsService {
  constructor(
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(ClassifiedCategory) private readonly categoriesRepo: Repository<ClassifiedCategory>,
    @InjectRepository(ClassifiedListing) private readonly listings: Repository<ClassifiedListing>,
    @InjectRepository(ClassifiedListingImage) private readonly images: Repository<ClassifiedListingImage>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(Application) private readonly applications: Repository<Application>,
    private readonly taxonomy: ClassifiedsCategoryTaxonomyService,
    private readonly jobsService: JobsService,
    private readonly applicationsService: ApplicationsService,
  ) {}

  async companyContext(companyId: string) {
    const company = await this.requireCompany(companyId);
    const profile = await this.companies.manager.query(
      `SELECT status,"canSellProducts","canOfferServices","businessSegments","defaultPublicationChannels","termsVersion","termsAcceptedAt"
       FROM company_classified_profiles WHERE "companyId"=$1::uuid LIMIT 1`,
      [companyId],
    ).then((rows) => rows[0] || null).catch(() => null);
    const verified = Boolean((company as any).isVerified || String((company as any).verificationStatus || '').toUpperCase() === 'VERIFIED');
    return {
      company: {
        id: company.id,
        name: company.name,
        slug: (company as any).slug || null,
        city: (company as any).city || null,
        state: (company as any).state || null,
        verified,
      },
      catalog: {
        configured: Boolean(profile),
        active: profile?.status === 'ACTIVE',
        canSellProducts: profile?.canSellProducts !== false,
        canOfferServices: profile?.canOfferServices === true,
        termsCurrent: Boolean(profile?.termsAcceptedAt && profile?.termsVersion === CLASSIFIEDS_TERMS_VERSION),
        defaultPublicationChannels: profile?.defaultPublicationChannels || ['CLASSIFIEDS', 'COMPANY_PAGE'],
      },
      safety: {
        companyBound: true,
        arbitraryCompanyIdAccepted: false,
        permanentProductDelete: false,
      },
    };
  }

  async categories() {
    const items = await this.categoriesRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC', name: 'ASC' } });
    return items.map((item) => ({ slug: item.slug, name: item.name, icon: item.icon, parentSlug: item.parentSlug, attributeSchema: item.attributeSchema || [] }));
  }

  async productsList(companyId: string, args: { q?: string; status?: string; categorySlug?: string; limit?: number }) {
    const qb = this.listings.createQueryBuilder('listing')
      .where('listing.companyId = :companyId', { companyId })
      .andWhere('listing.listingType = :listingType', { listingType: 'PRODUCT' });
    if (args.status) qb.andWhere('listing.status = :status', { status: this.productStatusValue(args.status) });
    if (args.categorySlug) qb.andWhere('listing.categorySlug = :categorySlug', { categorySlug: args.categorySlug });
    if (args.q?.trim()) qb.andWhere('(LOWER(listing.title) LIKE :q OR LOWER(listing.description) LIKE :q)', { q: `%${args.q.trim().toLowerCase()}%` });
    qb.orderBy('listing.updatedAt', 'DESC').take(Math.min(100, Math.max(1, Number(args.limit || 50))));
    return this.hydrateProducts(await qb.getMany());
  }

  async productGet(companyId: string, id: string) {
    const item = await this.requireProduct(companyId, id);
    return (await this.hydrateProducts([item]))[0];
  }

  async productCreate(companyId: string, actorUserId: string, input: Record<string, any>) {
    const company = await this.requireCompany(companyId);
    const profile = await this.marketplaceProfile(companyId);
    if (profile?.canSellProducts === false) throw new ForbiddenException('A empresa desabilitou a venda de produtos nos Classificados.');
    await this.taxonomy.assertCompatible(input.categorySlug, 'PRODUCT', input.attributes);
    const category = await this.categoriesRepo.findOne({ where: { slug: String(input.categorySlug), isActive: true } });
    if (!category) throw new BadRequestException('Categoria inválida ou indisponível.');

    const title = requiredText(input.title, 160, 'Informe o título do produto.');
    const description = requiredText(input.description, 12_000, 'Informe a descrição do produto.');
    const price = money(input.price);
    if (price === null) throw new BadRequestException('Produtos precisam ter preço informado.');
    const city = requiredText(input.city || (company as any).city, 120, 'Informe a cidade.');
    const state = requiredText(input.state || (company as any).state, 2, 'Informe o estado.').toUpperCase();
    const condition = conditionValue(input.condition || 'NEW');
    const channels = publicationChannels(input.publicationChannels, profile?.defaultPublicationChannels || ['CLASSIFIEDS', 'COMPANY_PAGE']);
    const product = this.listings.create({
      sellerUserId: actorUserId,
      companyId,
      categorySlug: String(input.categorySlug),
      listingType: 'PRODUCT',
      title,
      slug: await this.uniqueProductSlug(title),
      description,
      price,
      priceType: input.priceType === 'NEGOTIABLE' ? 'NEGOTIABLE' : input.priceType === 'STARTING_AT' ? 'STARTING_AT' : 'FIXED',
      condition,
      city,
      state,
      neighborhood: nullableText(input.neighborhood, 140),
      status: 'DRAFT',
      isFeatured: false,
      sellerVerifiedSnapshot: this.companyVerified(company),
      attributes: recordAttributes(input.attributes),
      publicationChannels: channels,
      catalogConfig: objectOrNull(input.catalogConfig) as any,
      commerceConfig: this.commerceConfig(input.commerceConfig, input.stockQuantity),
      contactPhone: nullableText(input.contactPhone || (company as any).phone, 40),
      contactWhatsapp: nullableText(input.contactWhatsapp, 40),
      publishedAt: null,
      expiresAt: null,
    });
    const saved = await this.listings.save(product);
    await this.replaceImages(saved.id, input.images);
    return this.productGet(companyId, saved.id);
  }

  async productUpdate(companyId: string, id: string, input: Record<string, any>) {
    const product = await this.requireProduct(companyId, id);
    const categorySlug = input.categorySlug !== undefined ? String(input.categorySlug) : product.categorySlug;
    const attributes = input.attributes !== undefined ? input.attributes : product.attributes;
    await this.taxonomy.assertCompatible(categorySlug, 'PRODUCT', attributes);
    if (input.categorySlug !== undefined) {
      const category = await this.categoriesRepo.findOne({ where: { slug: categorySlug, isActive: true } });
      if (!category) throw new BadRequestException('Categoria inválida ou indisponível.');
      product.categorySlug = categorySlug;
    }
    if (input.title !== undefined) product.title = requiredText(input.title, 160, 'Informe o título do produto.');
    if (input.description !== undefined) product.description = requiredText(input.description, 12_000, 'Informe a descrição do produto.');
    if (input.price !== undefined) {
      const next = money(input.price);
      if (next === null) throw new BadRequestException('Informe um preço válido.');
      product.price = next;
    }
    if (input.priceType !== undefined) product.priceType = input.priceType === 'NEGOTIABLE' ? 'NEGOTIABLE' : input.priceType === 'STARTING_AT' ? 'STARTING_AT' : 'FIXED';
    if (input.condition !== undefined) product.condition = conditionValue(input.condition);
    if (input.city !== undefined) product.city = requiredText(input.city, 120, 'Informe a cidade.');
    if (input.state !== undefined) product.state = requiredText(input.state, 2, 'Informe o estado.').toUpperCase();
    if (input.neighborhood !== undefined) product.neighborhood = nullableText(input.neighborhood, 140);
    if (input.attributes !== undefined) product.attributes = recordAttributes(input.attributes);
    if (input.catalogConfig !== undefined) product.catalogConfig = objectOrNull(input.catalogConfig) as any;
    if (input.commerceConfig !== undefined || input.stockQuantity !== undefined) product.commerceConfig = this.commerceConfig(input.commerceConfig ?? product.commerceConfig, input.stockQuantity);
    if (input.publicationChannels !== undefined) product.publicationChannels = publicationChannels(input.publicationChannels, product.publicationChannels);
    if (input.contactPhone !== undefined) product.contactPhone = nullableText(input.contactPhone, 40);
    if (input.contactWhatsapp !== undefined) product.contactWhatsapp = nullableText(input.contactWhatsapp, 40);
    await this.listings.save(product);
    if (input.images !== undefined) await this.replaceImages(product.id, input.images);
    return this.productGet(companyId, product.id);
  }

  async productPublish(companyId: string, id: string) {
    const product = await this.requireProduct(companyId, id);
    const company = await this.requireCompany(companyId);
    const profile = await this.marketplaceProfile(companyId);
    if (!this.companyVerified(company)) throw new ForbiddenException('A empresa precisa estar verificada antes de publicar produtos.');
    if (!profile || profile.status !== 'ACTIVE' || !profile.termsAcceptedAt || profile.termsVersion !== CLASSIFIEDS_TERMS_VERSION) {
      throw new ForbiddenException('Conclua a adesão ao Marketplace e aceite os termos atuais antes de publicar.');
    }
    if (profile.canSellProducts === false) throw new ForbiddenException('A venda de produtos está desabilitada para esta empresa.');
    if (!product.title?.trim() || !product.description?.trim() || !product.city?.trim() || !product.state?.trim()) throw new BadRequestException('Complete título, descrição e localização antes de publicar.');
    if (product.price === null) throw new BadRequestException('Produtos precisam ter preço informado.');
    if (!product.publicationChannels?.length) throw new BadRequestException('Escolha onde o produto será exibido.');
    product.status = 'PUBLISHED';
    product.publishedAt = product.publishedAt || new Date();
    await this.listings.save(product);
    return this.productGet(companyId, id);
  }

  async productStatus(companyId: string, id: string, statusRaw: string) {
    const status = String(statusRaw || '').toUpperCase();
    if (status === 'PUBLISHED') return this.productPublish(companyId, id);
    if (!['DRAFT', 'PAUSED', 'SOLD', 'ARCHIVED'].includes(status)) throw new BadRequestException('Status de produto inválido.');
    const product = await this.requireProduct(companyId, id);
    product.status = status as ClassifiedListingStatus;
    await this.listings.save(product);
    return this.productGet(companyId, id);
  }

  productArchive(companyId: string, id: string) {
    return this.productStatus(companyId, id, 'ARCHIVED');
  }

  async commerceAnalytics(companyId: string, range: ReportRange = {}) {
    const { from, to } = reportDates(range);
    const qb = this.listings.createQueryBuilder('listing')
      .where('listing.companyId = :companyId', { companyId })
      .andWhere('listing.listingType = :type', { type: 'PRODUCT' });
    if (from) qb.andWhere('listing.createdAt >= :from', { from });
    if (to) qb.andWhere('listing.createdAt <= :to', { to });
    const products = await qb.getMany();
    const byStatus = countBy(products, (item) => item.status);
    const byCategory = countBy(products, (item) => item.categorySlug);
    const totals = {
      products: products.length,
      published: products.filter((item) => item.status === 'PUBLISHED').length,
      sold: products.filter((item) => item.status === 'SOLD').length,
      views: products.reduce((sum, item) => sum + Number(item.viewsCount || 0), 0),
      favorites: products.reduce((sum, item) => sum + Number(item.favoritesCount || 0), 0),
      stockUnits: products.reduce((sum, item) => sum + Number((item.commerceConfig as any)?.onlineCheckout?.stockQuantity || 0), 0),
    };
    return { domain: 'COMMERCE', period: periodPayload(from, to), totals, byStatus, byCategory };
  }

  async jobsList(companyId: string, args: { active?: boolean; q?: string; limit?: number } = {}) {
    const qb = this.jobs.createQueryBuilder('job').where('job.companyId = :companyId', { companyId });
    if (typeof args.active === 'boolean') qb.andWhere('job.active = :active', { active: args.active });
    if (args.q?.trim()) qb.andWhere('(LOWER(job.title) LIKE :q OR LOWER(job.description) LIKE :q)', { q: `%${args.q.trim().toLowerCase()}%` });
    return qb.orderBy('job.updatedAt', 'DESC').take(Math.min(100, Math.max(1, Number(args.limit || 50)))).getMany();
  }

  async jobGet(companyId: string, id: string) {
    const job = await this.jobs.findOne({ where: { id, companyId } });
    if (!job) throw new NotFoundException('Vaga não encontrada para a empresa conectada.');
    return job;
  }

  async jobCreate(companyId: string, actorUserId: string, input: Partial<Job>) {
    const company = await this.requireCompany(companyId);
    if (!String(input.title || '').trim() || !String(input.description || '').trim()) throw new BadRequestException('Título e descrição são obrigatórios.');
    const data: Partial<Job> = {
      ...input,
      companyId,
      title: String(input.title).trim().slice(0, 180),
      description: String(input.description).trim().slice(0, 20_000),
      requirements: input.requirements ? String(input.requirements).trim().slice(0, 20_000) : null,
      skills: normalizeSkills(input.skills),
      state: input.state ? String(input.state).trim().toUpperCase().slice(0, 2) : null,
      active: input.active !== false,
    };
    return this.jobsService.create(actorUserId, company, data);
  }

  async jobUpdate(companyId: string, actorUserId: string, id: string, input: Partial<Job>) {
    await this.jobGet(companyId, id);
    const data: Partial<Job> = { ...input };
    delete (data as any).companyId;
    delete (data as any).ownerId;
    if (data.skills !== undefined) data.skills = normalizeSkills(data.skills);
    if (data.state !== undefined && data.state !== null) data.state = String(data.state).trim().toUpperCase().slice(0, 2);
    return this.jobsService.update(actorUserId, id, data, true);
  }

  async jobStatus(companyId: string, actorUserId: string, id: string, active: boolean) {
    return this.jobUpdate(companyId, actorUserId, id, { active });
  }

  async jobDelete(companyId: string, actorUserId: string, id: string) {
    await this.jobGet(companyId, id);
    await this.jobsService.remove(actorUserId, id, true);
    return { success: true, deletedJobId: id };
  }

  async applicationsList(companyId: string, args: { jobId?: string; status?: string; limit?: number } = {}) {
    if (args.jobId) await this.jobGet(companyId, args.jobId);
    const where: FindOptionsWhere<Application> = { companyId };
    if (args.jobId) where.jobId = args.jobId;
    if (args.status) where.status = applicationStatus(args.status);
    const rows = await this.applications.find({ where, order: { createdAt: 'DESC' }, take: Math.min(200, Math.max(1, Number(args.limit || 100))) });
    return rows.map((item) => ({
      id: item.id,
      jobId: item.jobId,
      jobTitle: item.jobTitle,
      candidateId: item.candidateId,
      status: item.status,
      priority: item.priority,
      documentsRequested: item.documentsRequested,
      submittedForReview: item.submittedForReview,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  async applicationGet(companyId: string, id: string) {
    const item = await this.applicationsService.findOne(id);
    if (!item || String(item.companyId) !== String(companyId)) throw new NotFoundException('Candidatura não encontrada para a empresa conectada.');
    return item;
  }

  async applicationUpdate(companyId: string, actorUserId: string, id: string, input: Partial<Application>) {
    await this.applicationGet(companyId, id);
    const data: Partial<Application> = {};
    if (input.status !== undefined) data.status = applicationStatus(input.status);
    if (input.priority !== undefined) data.priority = input.priority ? String(input.priority).slice(0, 120) : null as any;
    if (input.observations !== undefined) data.observations = Array.isArray(input.observations) ? input.observations.slice(0, 100) : [];
    if (input.documentsRequested !== undefined) data.documentsRequested = Boolean(input.documentsRequested);
    if (input.customDocs !== undefined) data.customDocs = Array.isArray(input.customDocs) ? input.customDocs.slice(0, 100) : [];
    return this.applicationsService.updateByCompany(id, data, { id: actorUserId, name: 'Agente autorizado via MCP' });
  }

  async recruitmentAnalytics(companyId: string, range: ReportRange = {}) {
    const { from, to } = reportDates(range);
    const jobsQb = this.jobs.createQueryBuilder('job').where('job.companyId = :companyId', { companyId });
    const appsQb = this.applications.createQueryBuilder('application').where('application.companyId = :companyId', { companyId });
    if (from) { jobsQb.andWhere('job.createdAt >= :from', { from }); appsQb.andWhere('application.createdAt >= :from', { from }); }
    if (to) { jobsQb.andWhere('job.createdAt <= :to', { to }); appsQb.andWhere('application.createdAt <= :to', { to }); }
    const [jobs, applications] = await Promise.all([jobsQb.getMany(), appsQb.getMany()]);
    return {
      domain: 'RECRUITMENT',
      period: periodPayload(from, to),
      totals: {
        jobs: jobs.length,
        activeJobs: jobs.filter((item) => item.active).length,
        jobViews: jobs.reduce((sum, item) => sum + Number(item.views || 0), 0),
        applications: applications.length,
        reviewing: applications.filter((item) => item.status === ApplicationStatus.REVIEWING).length,
        hired: applications.filter((item) => item.status === ApplicationStatus.HIRED).length,
        rejected: applications.filter((item) => item.status === ApplicationStatus.REJECTED).length,
      },
      applicationsByStatus: countBy(applications, (item) => item.status),
      applicationsByJob: countBy(applications, (item) => item.jobTitle || item.jobId),
    };
  }

  async report(companyId: string, domainRaw: string, range: ReportRange = {}) {
    const domain = String(domainRaw || '').toUpperCase();
    if (domain === 'COMMERCE') return { ...(await this.commerceAnalytics(companyId, range)), requestedMetrics: range.metrics || [], groupBy: range.groupBy || null };
    if (domain === 'RECRUITMENT') return { ...(await this.recruitmentAnalytics(companyId, range)), requestedMetrics: range.metrics || [], groupBy: range.groupBy || null };
    if (domain === 'EXECUTIVE') {
      const [commerce, recruitment] = await Promise.all([this.commerceAnalytics(companyId, range), this.recruitmentAnalytics(companyId, range)]);
      return { domain: 'EXECUTIVE', period: commerce.period, requestedMetrics: range.metrics || [], commerce, recruitment };
    }
    throw new BadRequestException('domain deve ser COMMERCE, RECRUITMENT ou EXECUTIVE.');
  }

  private async requireCompany(companyId: string) {
    const company = await this.companies.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa conectada não encontrada.');
    return company;
  }

  private async requireProduct(companyId: string, id: string) {
    const item = await this.listings.findOne({ where: { id, companyId, listingType: 'PRODUCT' } });
    if (!item) throw new NotFoundException('Produto não encontrado para a empresa conectada.');
    return item;
  }

  private async marketplaceProfile(companyId: string) {
    return this.companies.manager.query(
      `SELECT status,"canSellProducts","defaultPublicationChannels","termsVersion","termsAcceptedAt"
       FROM company_classified_profiles WHERE "companyId"=$1::uuid LIMIT 1`,
      [companyId],
    ).then((rows) => rows[0] || null).catch(() => null);
  }

  private companyVerified(company: Company) {
    return Boolean((company as any).isVerified || String((company as any).verificationStatus || '').toUpperCase() === 'VERIFIED');
  }

  private async hydrateProducts(items: ClassifiedListing[]) {
    if (!items.length) return [];
    const images = await this.images.find({ where: { listingId: In(items.map((item) => item.id)) }, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
    const imageMap = new Map<string, ClassifiedListingImage[]>();
    for (const image of images) imageMap.set(image.listingId, [...(imageMap.get(image.listingId) || []), image]);
    return items.map((item) => ({ ...item, images: (imageMap.get(item.id) || []).map((image) => ({ id: image.id, url: image.url, sortOrder: image.sortOrder, isPrimary: image.isPrimary })) }));
  }

  private async replaceImages(listingId: string, raw: unknown) {
    if (!Array.isArray(raw)) return;
    const urls = raw.map((item: any) => typeof item === 'string' ? item : item?.url).map(imageUrl).filter(Boolean).slice(0, 10) as string[];
    if (raw.length > 10) throw new BadRequestException('Empresas podem usar até 10 fotos por produto.');
    await this.images.delete({ listingId });
    if (urls.length) await this.images.save(urls.map((url, index) => this.images.create({ listingId, url, sortOrder: index, isPrimary: index === 0 })));
  }

  private commerceConfig(raw: unknown, stockQuantity: unknown) {
    const base = objectOrNull(raw) || {};
    if (stockQuantity === undefined) return Object.keys(base).length ? base as any : null;
    const parsed = Number(stockQuantity);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1_000_000) throw new BadRequestException('stockQuantity deve ser um inteiro entre 0 e 1000000.');
    return { ...base, onlineCheckout: { ...((base as any).onlineCheckout || {}), stockQuantity: parsed } } as any;
  }

  private async uniqueProductSlug(title: string) {
    const base = slugify(title).slice(0, 130) || 'produto';
    for (let i = 0; i < 8; i += 1) {
      const slug = `${base}-${randomBytes(4).toString('hex')}`;
      if (!(await this.listings.exists({ where: { slug } }))) return slug;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  private productStatusValue(raw: string) {
    const value = String(raw || '').toUpperCase();
    if (!['DRAFT', 'PUBLISHED', 'PAUSED', 'SOLD', 'ARCHIVED', 'PENDING_REVIEW'].includes(value)) throw new BadRequestException('Status de produto inválido.');
    return value;
  }
}

function reportDates(range: ReportRange) {
  const parse = (value?: string, end = false) => {
    if (!value) return null;
    const date = new Date(value.length === 10 ? `${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z` : value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Período de relatório inválido. Use ISO 8601 ou YYYY-MM-DD.');
    return date;
  };
  const from = parse(range.from);
  const to = parse(range.to, true);
  if (from && to && from > to) throw new BadRequestException('A data inicial não pode ser posterior à data final.');
  return { from, to };
}

function periodPayload(from: Date | null, to: Date | null) { return { from: from?.toISOString() || null, to: to?.toISOString() || null }; }
function countBy<T>(items: T[], key: (item: T) => string) { return items.reduce<Record<string, number>>((acc, item) => { const value = String(key(item) || 'UNKNOWN'); acc[value] = (acc[value] || 0) + 1; return acc; }, {}); }
function requiredText(value: unknown, max: number, message: string) { const text = String(value ?? '').trim().slice(0, max); if (!text) throw new BadRequestException(message); return text; }
function nullableText(value: unknown, max: number) { const text = String(value ?? '').trim().slice(0, max); return text || null; }
function money(value: unknown) { if (value === null || value === undefined || value === '') return null; const number = Number(String(value).replace(',', '.')); return Number.isFinite(number) && number >= 0 && number <= 999_999_999.99 ? number.toFixed(2) : null; }
function conditionValue(value: unknown): ClassifiedCondition { const normalized = String(value || 'NEW').toUpperCase(); if (!['NEW', 'USED', 'REFURBISHED'].includes(normalized)) throw new BadRequestException('condition deve ser NEW, USED ou REFURBISHED.'); return normalized as ClassifiedCondition; }
function publicationChannels(value: unknown, fallback: ClassifiedPublicationChannel[]) { if (!Array.isArray(value)) return fallback; const allowed = new Set(['CLASSIFIEDS', 'COMPANY_PAGE']); const result = Array.from(new Set(value.map(String).map((item) => item.toUpperCase()).filter((item) => allowed.has(item)))) as ClassifiedPublicationChannel[]; if (!result.length) throw new BadRequestException('Escolha ao menos um canal de publicação.'); return result; }
function objectOrNull(value: unknown) { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function recordAttributes(value: unknown) { if (!value || typeof value !== 'object' || Array.isArray(value)) return null; const output: Record<string, string | number | boolean | null> = {}; for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 60)) { const cleanKey = String(key).trim().slice(0, 80); if (!cleanKey) continue; output[cleanKey] = raw === null || typeof raw === 'number' || typeof raw === 'boolean' ? raw as any : String(raw).trim().slice(0, 500); } return output; }
function imageUrl(value: unknown) { const url = String(value ?? '').trim().slice(0, 2200); return /^(https?:\/\/|\/)/i.test(url) ? url : null; }
function normalizeSkills(raw: unknown) { if (!Array.isArray(raw)) return []; return Array.from(new Set(raw.map((item) => String(item || '').trim().replace(/\s+/g, ' ').slice(0, 80)).filter(Boolean))).slice(0, 10); }
function applicationStatus(raw: unknown): ApplicationStatus { const value = String(raw || '').trim().toUpperCase(); if (!Object.values(ApplicationStatus).includes(value as ApplicationStatus)) throw new BadRequestException('Status de candidatura inválido.'); return value as ApplicationStatus; }
function slugify(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
