import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from './entities/job.entity';
import { Company } from '../companies/entities/company.entity';
import { slugify } from '../seo/seo.utils';

const JOB_MUTABLE_FIELDS = [
  'title',
  'description',
  'requirements',
  'skills',
  'location',
  'city',
  'state',
  'type',
  'workModel',
  'salary',
  'pcdMode',
  'isConfidential',
  'isInternal',
  'isTalentPool',
  'active',
  'deadlineDate',
  'acceptsPlatformApplications',
  'requiresResumeFile',
  'externalApplicationInstructions',
  'applicationEmail',
  'applicationWhatsApp',
  'applicationUrl',
  'applicationUrlTitle',
] as const;

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private jobsRepository: Repository<Job>,
  ) {}

  async findAll(): Promise<Array<Job & { postedAt: string }>> {
    const jobs = await this.jobsRepository.find({
      where: { active: true, isInternal: false },
      order: { createdAt: 'DESC' },
    });
    return jobs.map((job) => ({
      ...job,
      postedAt: (job.sourcePublishedAt || job.createdAt).toISOString(),
    }));
  }

  findAllByOwner(ownerId: string): Promise<Job[]> {
    return this.jobsRepository.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
    });
  }

  findOne(id: string): Promise<Job | null> {
    return this.jobsRepository.findOne({ where: { id } });
  }

  async create(
    userId: string,
    company: Company,
    data: Partial<Job>,
  ): Promise<Job> {
    const slug = await this.generateAvailableSlug(
      `${data.title || 'vaga'}-${company.slug || company.name}`,
    );
    const job = this.jobsRepository.create({
      ...this.pickMutableFields(data),
      ownerId: userId,
      companyId: company.id,
      companyName: company.name,
      active: true,
      slug,
    });
    return this.jobsRepository.save(job);
  }

  async update(
    userId: string,
    id: string,
    data: Partial<Job>,
    alreadyAuthorized = false,
  ): Promise<Job> {
    const job = await this.findOne(id);
    if (!job) throw new NotFoundException('Job not found');
    if (!alreadyAuthorized && job.ownerId !== userId)
      throw new ForbiddenException('Você só pode editar suas próprias vagas');

    if (
      data.active === true &&
      (job.moderationStatus === 'PENDING' ||
        job.moderationStatus === 'REJECTED')
    ) {
      throw new BadRequestException(
        'Esta vaga precisa ser aprovada pela moderação antes da publicação.',
      );
    }
    Object.assign(job, this.pickMutableFields(data));
    return this.jobsRepository.save(job);
  }

  async remove(
    userId: string,
    id: string,
    alreadyAuthorized = false,
  ): Promise<void> {
    const job = await this.findOne(id);
    if (!job) throw new NotFoundException('Job not found');
    if (!alreadyAuthorized && job.ownerId !== userId)
      throw new ForbiddenException('Você só pode excluir suas próprias vagas');

    await this.jobsRepository.remove(job);
  }

  async incrementReportCount(id: string): Promise<void> {
    await this.jobsRepository.increment({ id }, 'reportCount', 1);
  }

  private pickMutableFields(data: Partial<Job>): Partial<Job> {
    const sanitized: Partial<Job> = {};
    for (const field of JOB_MUTABLE_FIELDS) {
      if (data[field] === undefined) continue;
      (sanitized as Record<string, unknown>)[field] =
        field === 'deadlineDate'
          ? this.normalizeDeadlineDate(data[field])
          : data[field];
    }
    return sanitized;
  }

  private normalizeDeadlineDate(value: unknown): string | null {
    if (value === null) return null;
    if (typeof value !== 'string')
      throw new BadRequestException('A data limite da vaga é inválida.');

    const normalized = value.trim();
    if (!normalized) return null;

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
    if (!match)
      throw new BadRequestException('A data limite da vaga é inválida.');

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new BadRequestException('A data limite da vaga é inválida.');
    }

    return normalized;
  }

  private async generateAvailableSlug(value: string): Promise<string> {
    const base = slugify(value) || 'vaga';
    for (let suffix = 1; suffix < 10_000; suffix += 1) {
      const candidate = suffix === 1 ? base : `${base}-${suffix}`;
      if (!(await this.jobsRepository.exists({ where: { slug: candidate } })))
        return candidate;
    }
    throw new NotFoundException(
      'Não foi possível criar um endereço público para a vaga.',
    );
  }
}
