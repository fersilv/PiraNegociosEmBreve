import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  Application,
  ApplicationStatus,
} from '../applications/entities/application.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Job } from '../jobs/entities/job.entity';
import { User } from '../users/entities/user.entity';
import { Company } from './entities/company.entity';
import { CompanyTalentInvite } from './entities/company-talent-invite.entity';
import { TalentInviteEmailService } from './talent-invite-email.service';
import {
  createInviteToken,
  hashInviteToken,
  maskInviteEmail,
  normalizeInviteEmail,
} from './talent-invite.utils';

type AuthenticatedInviteUser = {
  uid: string;
  email?: string;
  emailVerified?: boolean;
};

@Injectable()
export class TalentInvitesService {
  constructor(
    @InjectRepository(CompanyTalentInvite)
    private readonly invites: Repository<CompanyTalentInvite>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
    @InjectRepository(Application)
    private readonly applications: Repository<Application>,
    private readonly email: TalentInviteEmailService,
    private readonly notifications: NotificationsService,
  ) {}

  private publicOrigin() {
    return (process.env.PUBLIC_SITE_URL || 'https://piranegocios.com.br').replace(
      /\/$/,
      '',
    );
  }

  private invitationExpiry(job: Job) {
    const configuredDays = Number(process.env.TALENT_INVITE_EXPIRY_DAYS || 14);
    const days = Number.isFinite(configuredDays)
      ? Math.max(1, Math.min(90, Math.round(configuredDays)))
      : 14;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    if (job.deadlineDate) {
      const deadline = new Date(`${job.deadlineDate}T23:59:59-03:00`);
      if (!Number.isNaN(deadline.getTime()) && deadline < expiresAt)
        return deadline;
    }
    return expiresAt;
  }

  private jobIsAvailable(job: Job | null | undefined): job is Job {
    if (!job?.active) return false;
    const today = new Date().toISOString().slice(0, 10);
    return !job.deadlineDate || job.deadlineDate >= today;
  }

  private publicToken(invite: Pick<CompanyTalentInvite, 'id' | 'tokenHash'>) {
    const compactId = invite.id.replace(/-/g, '').toLowerCase();
    const tokenHash = invite.tokenHash;
    if (
      !/^[a-f0-9]{32}$/.test(compactId) ||
      !tokenHash ||
      !/^[a-f0-9]{64}$/i.test(tokenHash)
    ) {
      throw new BadRequestException('Convite sem link seguro disponível.');
    }
    const signature = createHmac('sha256', tokenHash)
      .update(invite.id)
      .digest('base64url');
    return `${compactId}_${signature}`;
  }

  private async findInviteByToken(token: string) {
    const signedToken = /^([a-f0-9]{32})_([A-Za-z0-9_-]{43})$/.exec(token);
    if (signedToken) {
      const compactId = signedToken[1];
      const inviteId = `${compactId.slice(0, 8)}-${compactId.slice(8, 12)}-${compactId.slice(12, 16)}-${compactId.slice(16, 20)}-${compactId.slice(20)}`;
      const invite = await this.invites.findOne({ where: { id: inviteId } });
      if (!invite?.tokenHash || !/^[a-f0-9]{64}$/i.test(invite.tokenHash))
        return null;
      const expected = Buffer.from(this.publicToken(invite));
      const received = Buffer.from(token);
      return expected.length === received.length &&
        timingSafeEqual(expected, received)
        ? invite
        : null;
    }
    return this.invites.findOne({
      where: { tokenHash: hashInviteToken(token) },
    });
  }

  private async findExisting(
    companyId: string,
    jobId: string,
    candidateId: string | null,
    candidateEmail: string | null,
  ) {
    const query = this.invites
      .createQueryBuilder('invite')
      .where('invite.companyId = :companyId', { companyId })
      .andWhere('invite.jobId = :jobId', { jobId });
    if (candidateId && candidateEmail) {
      query.andWhere(
        '(invite.candidateId = :candidateId OR invite.candidateEmail = :candidateEmail)',
        { candidateId, candidateEmail },
      );
    } else if (candidateId) {
      query.andWhere('invite.candidateId = :candidateId', { candidateId });
    } else if (candidateEmail) {
      query.andWhere('invite.candidateEmail = :candidateEmail', {
        candidateEmail,
      });
    } else {
      return null;
    }
    return query.getOne();
  }

  private resetInvite(
    invite: CompanyTalentInvite,
    job: Job,
    invitedById: string,
  ) {
    const { tokenHash } = createInviteToken();
    invite.status = 'PENDING';
    invite.invitedById = invitedById;
    invite.tokenHash = tokenHash;
    invite.expiresAt = this.invitationExpiry(job);
    invite.viewedAt = null;
    invite.acceptedAt = null;
    invite.declinedAt = null;
    invite.emailStatus = 'PENDING';
    invite.emailSentAt = null;
    invite.emailMessageId = null;
    invite.emailError = null;
  }

  private async deliver(
    invite: CompanyTalentInvite,
    company: Company,
    job: Job,
    token: string,
  ) {
    const inviteUrl = `${this.publicOrigin()}/convites/vaga/${token}`;
    if (!invite.candidateEmail) {
      invite.emailStatus = 'NOT_REQUESTED';
      await this.invites.save(invite);
      return { inviteUrl, status: 'NOT_REQUESTED' as const };
    }
    const result = await this.email.sendInvitation({
      to: invite.candidateEmail,
      candidateName: invite.candidateName,
      companyName: company.name,
      jobTitle: job.title,
      jobLocation: job.location,
      inviteUrl,
      expiresAt: invite.expiresAt || this.invitationExpiry(job),
    });
    invite.emailStatus = result.status;
    invite.emailSentAt = result.status === 'SENT' ? new Date() : null;
    invite.emailMessageId = result.messageId || null;
    invite.emailError = result.error || null;
    await this.invites.save(invite);
    return { inviteUrl, ...result };
  }

  private async prepareInvite(data: {
    company: Company;
    job: Job;
    invitedById: string;
    candidateId: string | null;
    candidateEmail: string | null;
    candidateName: string | null;
    registeredAt: Date | null;
  }) {
    const existing = await this.findExisting(
      data.company.id,
      data.job.id,
      data.candidateId,
      data.candidateEmail,
    );
    if (existing?.status === 'ACCEPTED') {
      throw new ConflictException('Esta pessoa já aceitou o convite para esta vaga.');
    }
    if (existing?.status === 'PENDING') {
      throw new ConflictException('Esta pessoa já possui um convite pendente para esta vaga.');
    }
    const invite =
      existing ||
      this.invites.create({
        companyId: data.company.id,
        jobId: data.job.id,
        candidateId: data.candidateId,
        candidateEmail: data.candidateEmail,
        candidateName: data.candidateName,
        registeredAt: data.registeredAt,
      });
    invite.candidateId = data.candidateId || invite.candidateId || null;
    invite.candidateEmail =
      data.candidateEmail || invite.candidateEmail || null;
    invite.candidateName = data.candidateName || invite.candidateName || null;
    invite.registeredAt = data.registeredAt || invite.registeredAt || null;
    this.resetInvite(invite, data.job, data.invitedById);
    const saved = await this.invites.save(invite);
    const delivery = await this.deliver(
      saved,
      data.company,
      data.job,
      this.publicToken(saved),
    );
    return { invite: saved, delivery };
  }

  async inviteRegisteredCandidate(data: {
    company: Company;
    job: Job;
    candidate: User;
    invitedById: string;
  }) {
    const candidateEmail = normalizeInviteEmail(data.candidate.email);
    const result = await this.prepareInvite({
      company: data.company,
      job: data.job,
      invitedById: data.invitedById,
      candidateId: data.candidate.id,
      candidateEmail: candidateEmail || null,
      candidateName:
        data.candidate.socialName ||
        data.candidate.displayName ||
        data.candidate.fullName ||
        null,
      registeredAt: data.candidate.createdAt || new Date(),
    });
    try {
      await this.notifications.notifyUser(data.candidate.id, {
        title: 'Convite para uma vaga',
        message: `${data.company.name} convidou você para conhecer a vaga “${data.job.title}”.`,
        type: 'talent_invite',
        jobId: data.job.id,
        link: `/user/vaga/${data.job.id}`,
      });
    } catch (error) {
      console.warn(
        `Convite ${result.invite.id} salvo, mas a notificação interna falhou:`,
        error,
      );
    }
    return result;
  }

  async inviteByEmail(data: {
    company: Company;
    job: Job;
    email: unknown;
    candidateName?: unknown;
    invitedById: string;
  }) {
    const candidateEmail = normalizeInviteEmail(data.email);
    if (
      !candidateEmail ||
      candidateEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail)
    ) {
      throw new BadRequestException('Informe um e-mail válido.');
    }
    const candidate = await this.users
      .createQueryBuilder('candidate')
      .where('LOWER(candidate.email) = :candidateEmail', { candidateEmail })
      .getOne();
    const providedName =
      typeof data.candidateName === 'string'
        ? data.candidateName.trim().slice(0, 140)
        : '';
    return this.prepareInvite({
      company: data.company,
      job: data.job,
      invitedById: data.invitedById,
      candidateId: candidate?.id || null,
      candidateEmail,
      candidateName:
        providedName ||
        candidate?.socialName ||
        candidate?.displayName ||
        candidate?.fullName ||
        null,
      registeredAt: candidate?.createdAt || null,
    });
  }

  async resend(company: Company, inviteId: string, invitedById: string) {
    const invite = await this.invites.findOne({
      where: { id: inviteId, companyId: company.id, status: 'PENDING' },
    });
    const job = invite
      ? await this.jobs.findOne({
          where: { id: invite.jobId, companyId: company.id },
        })
      : null;
    if (!invite || !invite.candidateEmail || !this.jobIsAvailable(job))
      throw new BadRequestException('Convite não disponível para reenvio.');
    this.resetInvite(invite, job, invitedById);
    await this.invites.save(invite);
    const delivery = await this.deliver(
      invite,
      company,
      job,
      this.publicToken(invite),
    );
    return { invite, delivery };
  }

  async linkForCompany(companyId: string, inviteId: string) {
    const invite = await this.invites.findOne({
      where: { id: inviteId, companyId, status: 'PENDING' },
    });
    const job = invite
      ? await this.jobs.findOne({
          where: { id: invite.jobId, companyId },
        })
      : null;
    if (!invite || !this.jobIsAvailable(job))
      throw new BadRequestException('Convite não disponível para copiar.');
    return {
      inviteUrl: `${this.publicOrigin()}/convites/vaga/${this.publicToken(invite)}`,
    };
  }

  async cancelPending(companyId: string, inviteId: string) {
    const invite = await this.invites.findOne({
      where: { id: inviteId, companyId },
    });
    if (!invite) throw new BadRequestException('Convite não encontrado.');
    if (invite.status !== 'PENDING') {
      throw new ConflictException('Somente convites ainda não aceitos podem ser removidos.');
    }
    await this.invites.remove(invite);
    return { removed: true, inviteId };
  }

  async listForCompany(companyId: string) {
    const invites = await this.invites.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
    const jobsPromise: Promise<Job[]> = invites.length
      ? this.jobs.findBy({ id: In(invites.map((invite) => invite.jobId)) })
      : Promise.resolve([]);
    const candidatesPromise: Promise<User[]> = invites.some(
      (invite) => invite.candidateId,
    )
      ? this.users.findBy({
            id: In(
              invites
                .map((invite) => invite.candidateId)
                .filter((id): id is string => Boolean(id)),
            ),
          })
      : Promise.resolve([]);
    const [jobs, candidates] = await Promise.all([
      jobsPromise,
      candidatesPromise,
    ]);
    return invites.map((invite) => {
      const job = jobs.find((item) => item.id === invite.jobId);
      const candidate = candidates.find(
        (item) => item.id === invite.candidateId,
      );
      return {
        id: invite.id,
        candidateId: invite.candidateId,
        candidateEmail: invite.candidateEmail,
        candidateName:
          candidate?.socialName ||
          candidate?.displayName ||
          candidate?.fullName ||
          invite.candidateName,
        jobId: invite.jobId,
        jobTitle: job?.title || 'Vaga indisponível',
        isInternal: Boolean(job?.isInternal),
        status: invite.status,
        emailStatus: invite.emailStatus,
        emailSentAt: invite.emailSentAt,
        viewedAt: invite.viewedAt,
        registeredAt: invite.registeredAt,
        acceptedAt: invite.acceptedAt,
        declinedAt: invite.declinedAt,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      };
    });
  }

  private async availableInviteByToken(token: string) {
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(token))
      throw new NotFoundException('Vaga não encontrada.');
    const invite = await this.findInviteByToken(token);
    if (
      !invite ||
      !['PENDING', 'ACCEPTED'].includes(invite.status) ||
      !invite.expiresAt ||
      invite.expiresAt.getTime() < Date.now()
    ) {
      throw new NotFoundException('Vaga não encontrada.');
    }
    const [job, company] = await Promise.all([
      this.jobs.findOne({ where: { id: invite.jobId } }),
      this.companies.findOne({ where: { id: invite.companyId } }),
    ]);
    if (!this.jobIsAvailable(job) || !company)
      throw new NotFoundException('Vaga não encontrada.');
    return { invite, job, company };
  }

  async preview(token: string) {
    const { invite, job, company } = await this.availableInviteByToken(token);
    return {
      invite: {
        id: invite.id,
        status: invite.status,
        expiresAt: invite.expiresAt,
        recipientEmailMasked: invite.candidateEmail
          ? maskInviteEmail(invite.candidateEmail)
          : null,
      },
      company: {
        id: company.id,
        name: company.name,
        logoURL: company.logoURL,
      },
      job: {
        title: job.title,
        isInternal: job.isInternal,
      },
    };
  }

  private async linkVerifiedEmailInvites(user: AuthenticatedInviteUser) {
    const email = normalizeInviteEmail(user.email);
    if (!email || !user.emailVerified) return;
    const candidate = await this.users.findOne({ where: { id: user.uid } });
    if (!candidate) return;
    const matches = await this.invites.find({
      where: { candidateEmail: email, status: 'PENDING' },
    });
    for (const invite of matches) {
      if (invite.candidateId && invite.candidateId !== user.uid) continue;
      invite.candidateId = user.uid;
      invite.registeredAt = invite.registeredAt || candidate.createdAt || new Date();
      await this.invites.save(invite);
    }
  }

  async mine(user: AuthenticatedInviteUser) {
    await this.linkVerifiedEmailInvites(user);
    const invites = await this.invites.find({
      where: { candidateId: user.uid, status: 'PENDING' },
      order: { createdAt: 'DESC' },
    });
    const jobs = invites.length
      ? await this.jobs.findBy({
          id: In(invites.map((invite) => invite.jobId)),
        })
      : [];
    return invites.flatMap((invite) => {
      const job = jobs.find((item) => item.id === invite.jobId);
      return this.jobIsAvailable(job) ? [{ ...invite, job }] : [];
    });
  }

  async claim(token: string, user: AuthenticatedInviteUser) {
    const { invite, job } = await this.availableInviteByToken(token);
    const accountEmail = normalizeInviteEmail(user.email);
    if (!accountEmail || accountEmail !== invite.candidateEmail)
      throw new ForbiddenException({
        code: 'INVITE_EMAIL_MISMATCH',
        message: `Entre com o e-mail ${invite.candidateEmail ? maskInviteEmail(invite.candidateEmail) : 'convidado'} para acessar esta vaga.`,
      });
    if (invite.candidateId && invite.candidateId !== user.uid)
      throw new ForbiddenException('Este convite já está vinculado a outra conta.');
    const candidate = await this.users.findOne({ where: { id: user.uid } });
    if (!candidate)
      throw new BadRequestException('Conclua seu cadastro antes de continuar.');
    invite.candidateId = user.uid;
    invite.registeredAt = invite.registeredAt || candidate.createdAt || new Date();
    await this.invites.save(invite);
    return {
      invite: {
        id: invite.id,
        status: invite.status,
        registeredAt: invite.registeredAt,
      },
      jobId: job.id,
    };
  }

  async markViewed(id: string, userId: string) {
    const invite = await this.invites.findOne({
      where: { id, candidateId: userId },
    });
    if (!invite || !['PENDING', 'ACCEPTED'].includes(invite.status))
      throw new NotFoundException('Vaga não encontrada.');
    const job = await this.jobs.findOne({ where: { id: invite.jobId } });
    if (!this.jobIsAvailable(job))
      throw new NotFoundException('Vaga não encontrada.');
    if (!invite.viewedAt) {
      invite.viewedAt = new Date();
      await this.invites.save(invite);
    }
    return { viewedAt: invite.viewedAt };
  }

  async accept(id: string, userId: string) {
    const invite = await this.invites.findOne({
      where: { id, candidateId: userId },
    });
    if (invite?.status === 'ACCEPTED') return invite;
    const [candidate, job] = await Promise.all([
      this.users.findOne({ where: { id: userId } }),
      invite ? this.jobs.findOne({ where: { id: invite.jobId } }) : null,
    ]);
    if (!invite || invite.status !== 'PENDING' || !candidate || !this.jobIsAvailable(job))
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
    invite.acceptedAt = new Date();
    return this.invites.save(invite);
  }

  async decline(id: string, userId: string) {
    const invite = await this.invites.findOne({
      where: { id, candidateId: userId, status: 'PENDING' },
    });
    if (!invite) throw new BadRequestException('Convite não disponível.');
    invite.status = 'DECLINED';
    invite.declinedAt = new Date();
    return this.invites.save(invite);
  }
}
