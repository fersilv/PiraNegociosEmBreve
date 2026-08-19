import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Institution } from './entities/institution.entity';

@Injectable()
export class InstitutionsService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
  ) {}

  async search(query: string): Promise<Institution[]> {
    if (!query) return [];
    return this.institutionRepo.find({
      where: { name: ILike(`%${query}%`) },
      take: 10,
    });
  }

  async findOrCreate(name: string): Promise<Institution> {
    const existing = await this.institutionRepo.findOne({
      where: { name: ILike(name) },
    });
    if (existing) return existing;

    // Gerar um slug básico (em produção real, lidar com duplicatas de slug)
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') + '-' + Date.now().toString().slice(-4);

    const inst = this.institutionRepo.create({ name, slug });
    return this.institutionRepo.save(inst);
  }
}
