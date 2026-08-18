import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { slugify, validateCompanySlug } from '../seo/seo.utils';
import { CompanySlugAlias } from './entities/company-slug-alias.entity';

const COMPANY_MUTABLE_FIELDS = [
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
  'verificationStatus',
  'socialInstagram',
  'socialLinkedin',
  'socialFacebook',
  'logoURL',
  'documentURL',
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

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private companiesRepository: Repository<Company>,
    @InjectRepository(CompanySlugAlias)
    private slugAliases: Repository<CompanySlugAlias>,
  ) {}

  findAllMyCompanies(ownerId: string): Promise<Company[]> {
    return this.companiesRepository.find({ where: { ownerId } });
  }

  findAll(): Promise<Company[]> {
    return this.companiesRepository.find({ order: { createdAt: 'DESC' } });
  }

  searchByName(term: string): Promise<Company[]> {
    return this.companiesRepository
      .createQueryBuilder('company')
      .where('LOWER(company.name) LIKE LOWER(:term)', { term: `%${term}%` })
      .orderBy('company.name', 'ASC')
      .take(10)
      .getMany();
  }

  findExactName(name: string): Promise<Company | null> {
    return this.companiesRepository
      .createQueryBuilder('company')
      .where('LOWER(company.name) = LOWER(:name)', { name: name.trim() })
      .getOne();
  }

  async findOne(id: string): Promise<Company | null> {
    return this.companiesRepository.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Company | null> {
    return this.companiesRepository.findOne({ where: { slug } });
  }

  findActiveSlugAlias(slug: string) {
    return this.slugAliases.findOne({
      where: { slug, expiresAt: MoreThan(new Date()) },
    });
  }

  async isSlugAvailable(slug: string, companyId?: string) {
    try {
      const normalized = this.normalizeRequestedSlug(slug);
      await this.assertSlugAvailable(normalized, companyId);
      return { slug: normalized, available: true };
    } catch (error) {
      return {
        slug: slugify(slug || ''),
        available: false,
        message:
          error instanceof Error ? error.message : 'Endereço indisponível.',
      };
    }
  }

  async create(ownerId: string, data: Partial<Company>): Promise<Company> {
    const slug = await this.generateAvailableSlug(data.name || 'empresa');
    const location = this.normalizeLocation(data);
    const company = this.companiesRepository.create({
      ...this.pickMutableFields(data),
      ...location,
      ownerId,
      slug,
      slugIsCustom: false,
    });
    return this.companiesRepository.save(company);
  }

  async update(
    ownerId: string,
    id: string,
    data: Partial<Company>,
    alreadyAuthorized = false,
  ): Promise<Company> {
    const company = await this.findOne(id);
    if (!company) throw new NotFoundException('Empresa não encontrada');
    if (!alreadyAuthorized && company.ownerId !== ownerId)
      throw new ForbiddenException('Você só pode editar a sua própria empresa');

    const updates = this.pickMutableFields(data);
    if (
      data.city !== undefined ||
      data.state !== undefined ||
      data.cityState !== undefined
    )
      Object.assign(updates, this.normalizeLocation(data, company));
    Object.assign(company, updates);
    return this.companiesRepository.save(company);
  }

  async requestSlugChange(userId: string, id: string, value: string) {
    const company = await this.findOne(id);
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    if (company.verificationStatus !== 'VERIFIED' || !company.isVerified)
      throw new ForbiddenException(
        'A URL personalizada está disponível somente para empresas verificadas.',
      );
    const slug = this.normalizeRequestedSlug(value);
    if (slug === company.slug || slug === company.pendingSlug) return company;
    await this.assertSlugAvailable(slug, company.id);

    if (!company.slugIsCustom) {
      if (company.slug)
        await this.activateAlias(company, company.slug, slug, userId);
      company.slug = slug;
      company.slugIsCustom = true;
      company.pendingSlug = null;
      company.slugChangeStatus = 'APPROVED';
      company.slugChangeRequestedAt = new Date();
      company.slugChangeRequestedById = userId;
      company.slugChangeReviewedAt = new Date();
      company.slugChangeReviewedById = userId;
      company.slugChangeReviewNote = 'Primeira URL personalizada.';
      return this.companiesRepository.save(company);
    }

    company.pendingSlug = slug;
    company.slugChangeStatus = 'PENDING';
    company.slugChangeRequestedAt = new Date();
    company.slugChangeRequestedById = userId;
    company.slugChangeReviewedAt = null;
    company.slugChangeReviewedById = null;
    company.slugChangeReviewNote = null;
    return this.companiesRepository.save(company);
  }

  async rollbackSlugChange(userId: string, id: string) {
    const company = await this.findOne(id);
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    const alias = await this.slugAliases.findOne({
      where: {
        companyId: id,
        replacedBySlug: company.slug || '',
        rollbackAvailable: true,
        rollbackUsed: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
    if (!alias)
      throw new BadRequestException(
        'Não existe uma URL anterior disponível para restauração.',
      );
    company.slug = alias.slug;
    company.pendingSlug = null;
    company.slugIsCustom = true;
    company.slugChangeStatus = 'ROLLED_BACK';
    company.slugChangeReviewedAt = new Date();
    company.slugChangeReviewedById = userId;
    company.slugChangeReviewNote =
      'Retorno único para a URL anterior solicitado pela empresa.';
    alias.rollbackAvailable = false;
    alias.rollbackUsed = true;
    alias.rolledBackAt = new Date();
    alias.expiresAt = new Date();
    await this.slugAliases.save(alias);
    return this.companiesRepository.save(company);
  }

  async getSlugRollbackOption(company: Company) {
    if (!company.slug) return null;
    const alias = await this.slugAliases.findOne({
      where: {
        companyId: company.id,
        replacedBySlug: company.slug,
        rollbackAvailable: true,
        rollbackUsed: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
    return alias
      ? { previousSlug: alias.slug, expiresAt: alias.expiresAt }
      : null;
  }

  async activateAlias(
    company: Company,
    oldSlug: string,
    newSlug: string,
    actorId: string,
  ) {
    let alias = await this.slugAliases.findOne({ where: { slug: oldSlug } });
    alias =
      alias ||
      this.slugAliases.create({
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
    return this.slugAliases.save(alias);
  }

  private pickMutableFields(data: Partial<Company>): Partial<Company> {
    const sanitized: Partial<Company> = {};
    for (const field of COMPANY_MUTABLE_FIELDS) {
      if (data[field] !== undefined)
        (sanitized as Record<string, unknown>)[field] = data[field];
    }
    return sanitized;
  }

  private async assertSlugAvailable(
    slug: string,
    companyId?: string,
  ): Promise<string> {
    const existing = await this.companiesRepository.findOne({
      where: [{ slug }, { pendingSlug: slug }],
    });
    if (existing && existing.id !== companyId)
      throw new BadRequestException(
        'Este endereço público já está em uso. Escolha outro.',
      );
    const alias = await this.findActiveSlugAlias(slug);
    if (alias && alias.companyId !== companyId)
      throw new BadRequestException(
        'Este endereço está reservado temporariamente por uma URL anterior.',
      );
    return slug;
  }

  private normalizeRequestedSlug(value: string) {
    try {
      return validateCompanySlug(value);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Endereço público inválido.',
      );
    }
  }

  private normalizeLocation(data: Partial<Company>, current?: Company) {
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

  private async generateAvailableSlug(value: string): Promise<string> {
    const base = slugify(value) || 'empresa';
    for (let suffix = 1; suffix < 10_000; suffix += 1) {
      const candidate = suffix === 1 ? base : `${base}-${suffix}`;
      if (
        !(await this.companiesRepository.exists({ where: { slug: candidate } }))
      )
        return candidate;
    }
    throw new BadRequestException(
      'Não foi possível criar um endereço público. Tente outro nome.',
    );
  }
}
