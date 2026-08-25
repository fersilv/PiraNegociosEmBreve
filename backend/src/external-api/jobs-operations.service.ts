import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  JOB_REVIEW_STATUSES,
  Job,
  JobReviewStatus,
} from '../jobs/entities/job.entity';

@Injectable()
export class JobsOperationsService {
  constructor(
    @InjectRepository(Job)
    private readonly jobs: Repository<Job>,
  ) {}

  async get(id: string) {
    return this.requireJob(id);
  }

  async reviewQueue(input: {
    status?: string;
    active?: boolean;
    city?: string;
    state?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(input.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(input.pageSize || 30)));
    const query = this.jobs.createQueryBuilder('job');

    if (input.status) {
      query.andWhere('job."reviewStatus" = :status', {
        status: this.requireReviewStatus(input.status),
      });
    } else {
      query.andWhere('job."reviewStatus" IN (:...statuses)', {
        statuses: ['PENDING_REVIEW', 'RECHECK_REQUIRED', 'DEACTIVATION_REQUIRED'],
      });
    }
    if (typeof input.active === 'boolean') query.andWhere('job.active = :active', { active: input.active });
    if (input.city?.trim()) query.andWhere('LOWER(job.city) = LOWER(:city)', { city: input.city.trim() });
    if (input.state?.trim()) query.andWhere('UPPER(job.state) = UPPER(:state)', { state: input.state.trim() });

    query
      .orderBy(
        `CASE job."reviewStatus"
          WHEN 'DEACTIVATION_REQUIRED' THEN 1
          WHEN 'RECHECK_REQUIRED' THEN 2
          WHEN 'PENDING_REVIEW' THEN 3
          ELSE 4
        END`,
        'ASC',
      )
      .addOrderBy('COALESCE(job."reviewedAt", job."lastVerifiedAt", job."createdAt")', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await query.getManyAndCount();
    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async stats() {
    const rows = await this.jobs
      .createQueryBuilder('job')
      .select('job."reviewStatus"', 'reviewStatus')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('job."reviewStatus"')
      .getRawMany<{ reviewStatus: string; count: number | string }>();

    const review = Object.fromEntries(
      JOB_REVIEW_STATUSES.map((status) => [status, 0]),
    ) as Record<string, number>;
    for (const row of rows) review[row.reviewStatus || 'PENDING_REVIEW'] = Number(row.count || 0);

    const [total, active, inactive, flagged, moderationPending] = await Promise.all([
      this.jobs.count(),
      this.jobs.count({ where: { active: true } }),
      this.jobs.count({ where: { active: false } }),
      this.jobs.count({ where: { isFlagged: true } }),
      this.jobs.count({ where: { moderationStatus: 'PENDING' } }),
    ]);

    return { total, active, inactive, flagged, moderationPending, review };
  }

  async setActive(id: string, active: boolean, actor: string, note?: string) {
    const job = await this.requireJob(id);
    job.active = active;
    job.reviewStatus = active ? 'REVIEWED_OK' : 'RESOLVED';
    job.reviewedAt = new Date();
    job.reviewedBy = this.actor(actor);
    job.reviewNote = this.note(
      note || (active ? 'Vaga ativada pela integração.' : 'Vaga desativada pela integração.'),
    );
    if (active && job.moderationStatus === 'PENDING') job.moderationStatus = 'APPROVED';
    await this.jobs.save(job);
    return job;
  }

  async setReview(
    id: string,
    statusRaw: string,
    actor: string,
    note?: string,
  ) {
    const job = await this.requireJob(id);
    const status = this.requireReviewStatus(statusRaw);
    job.reviewStatus = status;
    job.reviewedAt = new Date();
    job.reviewedBy = this.actor(actor);
    if (note !== undefined) job.reviewNote = this.note(note);

    if (status === 'REVIEWED_OK' && job.moderationStatus === 'PENDING') {
      job.moderationStatus = 'APPROVED';
    }
    if (status === 'RESOLVED' && !job.active && job.moderationStatus === 'PENDING') {
      job.moderationStatus = 'APPROVED';
    }

    await this.jobs.save(job);
    return job;
  }

  async flag(
    id: string,
    actor: string,
    data: { reason?: string; observation?: string },
  ) {
    const job = await this.requireJob(id);
    const reason = String(data.reason || 'REVIEW_REQUIRED').trim().slice(0, 120);
    job.isFlagged = true;
    job.flagReason = reason;
    job.flagObservation = this.note(data.observation || 'Sinalizada por integração.');
    job.flaggedAt = new Date();
    job.flaggedBy = this.actor(actor);

    if (reason === 'NOT_FOUND' || reason === 'CLOSED' || reason === 'EXPIRED') {
      job.reviewStatus = job.active ? 'DEACTIVATION_REQUIRED' : 'RESOLVED';
    } else {
      job.reviewStatus = 'RECHECK_REQUIRED';
    }
    job.reviewedAt = new Date();
    job.reviewedBy = this.actor(actor);
    await this.jobs.save(job);
    return job;
  }

  async clearFlag(id: string, actor: string, note?: string) {
    const job = await this.requireJob(id);
    const keepDeactivation = job.reviewStatus === 'DEACTIVATION_REQUIRED' && job.active;
    job.isFlagged = false;
    job.flagObservation = null;
    job.flagReason = null;
    job.flaggedAt = null;
    job.flaggedBy = null;
    job.reportCount = 0;
    if (job.moderationStatus === 'FLAGGED' || job.moderationStatus === 'PENDING') {
      job.moderationStatus = 'APPROVED';
    }
    job.reviewStatus = keepDeactivation
      ? 'DEACTIVATION_REQUIRED'
      : job.active
        ? 'REVIEWED_OK'
        : 'RESOLVED';
    job.reviewedAt = new Date();
    job.reviewedBy = this.actor(actor);
    job.reviewNote = this.note(
      note ||
        (keepDeactivation
          ? 'Alerta limpo, mas a vaga ainda exige desativação.'
          : 'Alerta revisado e limpo.'),
    );
    await this.jobs.save(job);
    return job;
  }

  async remove(id: string) {
    const job = await this.requireJob(id);
    await this.jobs.remove(job);
    return { success: true, id };
  }

  private async requireJob(id: string) {
    const job = await this.jobs.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Vaga não encontrada.');
    return job;
  }

  private requireReviewStatus(value: string): JobReviewStatus {
    const status = String(value || '').trim().toUpperCase();
    if (!JOB_REVIEW_STATUSES.includes(status as JobReviewStatus)) {
      throw new BadRequestException(
        `reviewStatus inválido. Use: ${JOB_REVIEW_STATUSES.join(', ')}.`,
      );
    }
    return status as JobReviewStatus;
  }

  private actor(value: string) {
    return String(value || 'integration').trim().slice(0, 160) || 'integration';
  }

  private note(value: string) {
    return String(value || '').trim().slice(0, 4000) || null;
  }
}
