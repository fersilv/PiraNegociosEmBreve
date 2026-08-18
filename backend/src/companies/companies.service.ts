import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { slugify, validateCompanySlug } from '../seo/seo.utils';

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
  'phone',
  'verificationStatus',
  'socialInstagram',
  'socialLinkedin',
  'socialFacebook',
  'logoURL',
  'documentURL',
  'slug',
] as const;

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private companiesRepository: Repository<Company>,
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

  async create(ownerId: string, data: Partial<Company>): Promise<Company> {
    const requestedSlug =
      typeof data.slug === 'string' && data.slug.trim()
        ? validateCompanySlug(data.slug)
        : null;
    const slug = requestedSlug
      ? await this.assertSlugAvailable(requestedSlug)
      : await this.generateAvailableSlug(data.name || 'empresa');
    const company = this.companiesRepository.create({
      ...this.pickMutableFields(data),
      ownerId,
      slug,
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
    if (typeof updates.slug === 'string' && updates.slug !== company.slug) {
      updates.slug = await this.assertSlugAvailable(
        validateCompanySlug(updates.slug),
        company.id,
      );
    }
    Object.assign(company, updates);
    return this.companiesRepository.save(company);
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
      where: { slug },
    });
    if (existing && existing.id !== companyId)
      throw new BadRequestException(
        'Este endereço público já está em uso. Escolha outro.',
      );
    return slug;
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
