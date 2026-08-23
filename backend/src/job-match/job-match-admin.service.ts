import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Job } from '../jobs/entities/job.entity';
import { JOB_MATCH_ALGORITHM_VERSION, JobMatchService } from './job-match.service';

@Injectable()
export class JobMatchAdminService {
  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    private readonly dataSource: DataSource,
    private readonly jobMatch: JobMatchService,
  ) {}

  async overview() {
    const rows = await this.dataSource.query(
      `SELECT
        count(*) FILTER (WHERE j.active = true)::int AS active,
        count(*) FILTER (WHERE j.active = true AND p.status = 'READY' AND p."algorithmVersion" = $1)::int AS ready,
        count(*) FILTER (WHERE j.active = true AND p.status = 'PENDING')::int AS pending,
        count(*) FILTER (WHERE j.active = true AND p.status = 'ERROR')::int AS error,
        count(*) FILTER (WHERE j.active = true AND (p."jobId" IS NULL OR p."algorithmVersion" <> $1))::int AS missing
       FROM jobs j
       LEFT JOIN job_match_profiles p ON p."jobId" = j.id`,
      [JOB_MATCH_ALGORITHM_VERSION],
    );
    const result = rows[0] || { active: 0, ready: 0, pending: 0, error: 0, missing: 0 };
    return {
      ...result,
      toPrepare: Number(result.error || 0) + Number(result.missing || 0),
    };
  }

  async updateConfig(input: { durationDays?: unknown }) {
    const durationDays = Math.round(Number(input?.durationDays));
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 365) {
      throw new BadRequestException('A duração do Match deve ficar entre 1 e 365 dias.');
    }
    const rows = await this.dataSource.query(
      `UPDATE payment_products SET "durationDays" = $1, "updatedAt" = now()
       WHERE code = 'JOB_MATCH_30D' RETURNING *`,
      [durationDays],
    );
    if (!rows[0]) throw new BadRequestException('O produto Match Inteligente ainda não foi criado.');
    return rows[0];
  }

  async backfillQueue(limit = 100) {
    const safeLimit = Math.min(500, Math.max(1, Math.round(limit || 100)));
    return this.dataSource.query(
      `SELECT
         j.id, j.title, j."companyName", j."sourceName", j.city, j.state,
         p.status, p.error, p."updatedAt" AS "profileUpdatedAt"
       FROM jobs j
       LEFT JOIN job_match_profiles p ON p."jobId" = j.id
       WHERE j.active = true
         AND (p."jobId" IS NULL OR p.status = 'ERROR' OR p."algorithmVersion" <> $1)
       ORDER BY j."createdAt" DESC
       LIMIT $2`,
      [JOB_MATCH_ALGORITHM_VERSION, safeLimit],
    );
  }

  async prepareOne(jobId: string) {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Vaga não encontrada.');
    if (!job.active) throw new BadRequestException('Somente vagas ativas podem ser preparadas para o Match.');

    const result = await this.jobMatch.reanalyzeJob(jobId);
    const profileRows = await this.dataSource.query(
      `SELECT status, error, "analyzedAt", "updatedAt" FROM job_match_profiles WHERE "jobId" = $1 LIMIT 1`,
      [jobId],
    );
    const profile = profileRows[0] || null;
    return {
      jobId,
      title: job.title,
      success: Boolean(result && profile?.status === 'READY'),
      status: profile?.status || 'ERROR',
      error: profile?.error || null,
    };
  }

  async backfill(limit = 25) {
    const queue = await this.backfillQueue(Math.min(100, Math.max(1, Math.round(limit || 25))));
    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ jobId: string; title: string; error: string | null }> = [];

    for (const item of queue) {
      const result = await this.prepareOne(item.id);
      if (result.success) succeeded += 1;
      else {
        failed += 1;
        errors.push({ jobId: item.id, title: item.title, error: result.error });
      }
    }

    return {
      processed: queue.length,
      attempted: queue.length,
      succeeded,
      failed,
      errors,
      overview: await this.overview(),
    };
  }
}
