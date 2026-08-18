import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import {
  Application,
  ApplicationStatus,
} from '../applications/entities/application.entity';
import { Job } from '../jobs/entities/job.entity';
import { CompanyTalentInvite } from './entities/company-talent-invite.entity';
import { User, UserType } from '../users/entities/user.entity';

@Controller('talent-invites')
@UseGuards(FirebaseAuthGuard)
export class TalentInvitesController {
  constructor(
    @InjectRepository(CompanyTalentInvite)
    private invites: Repository<CompanyTalentInvite>,
    @InjectRepository(Job) private jobs: Repository<Job>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Application)
    private applications: Repository<Application>,
  ) {}
  @Get('me') async mine(@Req() req: any) {
    const invites = await this.invites.find({
      where: { candidateId: req.user.uid, status: 'PENDING' },
      order: { createdAt: 'DESC' },
    });
    const jobs = invites.length
      ? await this.jobs.findBy({ id: In(invites.map((invite) => invite.jobId)) })
      : [];
    return invites.map((invite) => ({
      ...invite,
      job: jobs.find((job) => job.id === invite.jobId),
    }));
  }
  @Post(':id/accept') async accept(@Req() req: any, @Param('id') id: string) {
    const invite = await this.invites.findOne({
      where: { id, candidateId: req.user.uid, status: 'PENDING' },
    });
    const [candidate, job] = await Promise.all([
      this.users.findOne({ where: { id: req.user.uid } }),
      invite
        ? this.jobs.findOne({ where: { id: invite.jobId, active: true } })
        : null,
    ]);
    if (!invite || !job || candidate?.type !== UserType.CANDIDATE)
      throw new BadRequestException('Convite não disponível.');
    const existing = await this.applications.findOne({
      where: { candidateId: candidate.id, jobId: job.id },
    });
    if (!existing)
      await this.applications.save(
        this.applications.create({
          candidateId: candidate.id,
          jobId: job.id,
          companyId: job.companyId,
          companyName: job.companyName,
          jobTitle: job.title,
          resumeUrl: candidate.resumeURL || null,
          status: ApplicationStatus.PENDING,
          observations: [],
          onboardingDocs: {},
          customDocs: [],
        }),
      );
    invite.status = 'ACCEPTED';
    return this.invites.save(invite);
  }
  @Post(':id/decline') async decline(@Req() req: any, @Param('id') id: string) {
    const invite = await this.invites.findOne({
      where: { id, candidateId: req.user.uid, status: 'PENDING' },
    });
    if (!invite) throw new BadRequestException('Convite não disponível.');
    invite.status = 'DECLINED';
    return this.invites.save(invite);
  }
}
