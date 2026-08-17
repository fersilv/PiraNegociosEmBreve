import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';

const COMPANY_MUTABLE_FIELDS = [
  'name', 'description', 'documentType', 'cnpj', 'cpf', 'website', 'address',
  'cityState', 'phone', 'verificationStatus', 'socialInstagram', 'socialLinkedin',
  'socialFacebook', 'logoURL', 'documentURL',
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

  async create(ownerId: string, data: Partial<Company>): Promise<Company> {
    const company = this.companiesRepository.create({ ...this.pickMutableFields(data), ownerId });
    return this.companiesRepository.save(company);
  }

  async update(ownerId: string, id: string, data: Partial<Company>, alreadyAuthorized = false): Promise<Company> {
    const company = await this.findOne(id);
    if (!company) throw new NotFoundException('Empresa não encontrada');
    if (!alreadyAuthorized && company.ownerId !== ownerId) throw new ForbiddenException('Você só pode editar a sua própria empresa');

    Object.assign(company, this.pickMutableFields(data));
    return this.companiesRepository.save(company);
  }

  private pickMutableFields(data: Partial<Company>): Partial<Company> {
    const sanitized: Partial<Company> = {};
    for (const field of COMPANY_MUTABLE_FIELDS) {
      if (data[field] !== undefined) (sanitized as Record<string, unknown>)[field] = data[field];
    }
    return sanitized;
  }
}
