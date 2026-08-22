import { BadRequestException, Injectable } from '@nestjs/common';
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
    return rows[0] || { active: 0, ready: 0, pending: 0, error: 0, missing: 0 };
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

  async backfill(limit = 25) {
    const safeLimit = Math.min(100, Math.max(1, Math.round(limit || 25)));
    const rows = await this.dataSource.query(
      `SELECT j.id
       FROM jobs j
       LEFT JOIN job_match_profiles p ON p."jobId" = j.id
       WHERE j.active = true
         AND (p."jobId" IS NULL OR p.status = 'ERROR' OR p."algorithmVersion" <> $1)
       ORDER BY j."createdAt" DESC
       LIMIT $2`,
      [JOB_MATCH_ALGORITHM_VERSION, safeLimit],
    );
    let processed = 0;
    for (const row of rows) {
      const job = await this.jobs.findOne({ where: { id: row.id } });
      if (!job) continue;
      await this.jobMatch.analyzeActiveJob(job);
      processed += 1;
    }
    return { processed, overview: await this.overview() };
  }
}
