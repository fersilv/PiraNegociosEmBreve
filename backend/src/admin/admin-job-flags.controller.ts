import { Controller, Get, NotFoundException, Param, Put, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { Job } from '../jobs/entities/job.entity';
import { JobReport } from '../jobs/entities/job-report.entity';
import { AdminGuard } from './admin.guard';

@Controller('admin/job-flags')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminJobFlagsController {
  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(JobReport) private readonly reports: Repository<JobReport>,
  ) {}

  @Get()
  async list() {
    const jobs = await this.jobs
      .createQueryBuilder('job')
      .where('(job."isFlagged" = true OR job."reportCount" > 0)')
      .orderBy('job."isFlagged"', 'DESC')
      .addOrderBy('job."reportCount"', 'DESC')
      .addOrderBy('COALESCE(job."flaggedAt", job."updatedAt")', 'DESC')
      .getMany();

    if (!jobs.length) return [];

    const reports = await this.reports.find({
      where: { jobId: In(jobs.map((job) => job.id)) },
      order: { createdAt: 'DESC' },
    });
    const reportsByJob = new Map<string, JobReport[]>();
    for (const report of reports) {
      const current = reportsByJob.get(report.jobId) || [];
      current.push(report);
      reportsByJob.set(report.jobId, current);
    }

    return jobs.map((job) => ({
      job,
      sources: {
        ai: Boolean(job.isFlagged),
        people: Number(job.reportCount || 0),
      },
      reports: (reportsByJob.get(job.id) || []).map((report) => ({
        id: report.id,
        reason: report.reason,
        details: report.details,
        createdAt: report.createdAt,
      })),
    }));
  }

  @Put(':id/clear')
  async clear(@Param('id') id: string, @Req() req: any) {
    const job = await this.jobs.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Vaga não encontrada.');

    const previousReviewStatus = job.reviewStatus;
    job.isFlagged = false;
    job.flagObservation = null;
    job.flagReason = null;
    job.flaggedAt = null;
    job.flaggedBy = null;
    job.reportCount = 0;

    // Limpar um alerta é uma decisão de revisão humana. A vaga não pode voltar
    // a aparecer como se fosse nova só porque o alerta da IA foi removido.
    if (job.moderationStatus === 'FLAGGED' || job.moderationStatus === 'PENDING') {
      job.moderationStatus = 'APPROVED';
    }
    if (previousReviewStatus === 'DEACTIVATION_REQUIRED' && job.active) {
      job.reviewStatus = 'DEACTIVATION_REQUIRED';
    } else {
      job.reviewStatus = job.active ? 'REVIEWED_OK' : 'RESOLVED';
    }
    job.reviewedAt = new Date();
    job.reviewedBy = String(req.user?.uid || req.user?.email || 'admin').slice(0, 160);
    job.reviewNote = previousReviewStatus === 'DEACTIVATION_REQUIRED' && job.active
      ? 'Alerta limpo pelo administrador. A vaga continua exigindo desativação.'
      : 'Alerta revisado e limpo pelo administrador.';

    await this.jobs.save(job);
    return { success: true, job };
  }
}
