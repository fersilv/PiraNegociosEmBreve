import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from './entities/job.entity';
import { Company } from '../companies/entities/company.entity';

const JOB_MUTABLE_FIELDS = [
  'title', 'description', 'location', 'type', 'workModel', 'salary', 'isConfidential',
  'isTalentPool', 'active', 'deadlineDate', 'acceptsPlatformApplications', 'externalApplicationInstructions',
] as const;

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private jobsRepository: Repository<Job>,
  ) {}

  findAll(): Promise<Job[]> {
    return this.jobsRepository.find({ where: { active: true }, order: { createdAt: 'DESC' } });
  }

  findAllByOwner(ownerId: string): Promise<Job[]> {
    return this.jobsRepository.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  findOne(id: string): Promise<Job | null> {
    return this.jobsRepository.findOne({ where: { id } });
  }

  create(userId: string, company: Company, data: Partial<Job>): Promise<Job> {
    const job = this.jobsRepository.create({
      ...this.pickMutableFields(data),
      ownerId: userId,
      companyId: company.id,
      companyName: company.name,
      active: true,
    });
    return this.jobsRepository.save(job);
  }

  async update(userId: string, id: string, data: Partial<Job>, alreadyAuthorized = false): Promise<Job> {
    const job = await this.findOne(id);
    if (!job) throw new NotFoundException('Job not found');
    if (!alreadyAuthorized && job.ownerId !== userId) throw new ForbiddenException('Você só pode editar suas próprias vagas');

    Object.assign(job, this.pickMutableFields(data));
    return this.jobsRepository.save(job);
  }

  async remove(userId: string, id: string, alreadyAuthorized = false): Promise<void> {
    const job = await this.findOne(id);
    if (!job) throw new NotFoundException('Job not found');
    if (!alreadyAuthorized && job.ownerId !== userId) throw new ForbiddenException('Você só pode excluir suas próprias vagas');

    await this.jobsRepository.remove(job);
  }

  private pickMutableFields(data: Partial<Job>): Partial<Job> {
    const sanitized: Partial<Job> = {};
    for (const field of JOB_MUTABLE_FIELDS) {
      if (data[field] !== undefined) (sanitized as Record<string, unknown>)[field] = data[field];
    }
    return sanitized;
  }
}
