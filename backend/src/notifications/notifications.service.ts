import { Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { PushInstallation } from './entities/push-installation.entity';
import { User, UserType } from '../users/entities/user.entity';
import { FirebaseService } from '../auth/firebase.service';

export type PushInstallationInput = {
  installationId: string;
  token: string;
  platform?: string | null;
  userAgent?: string | null;
};

export type AdminBroadcastInput = {
  audience: 'all' | 'candidates' | 'companies' | 'admins' | 'user';
  title: string;
  message: string;
  link?: string | null;
  category?: 'announcement' | 'system' | 'maintenance' | 'important';
  userQuery?: string | null;
};

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private jobAlertTimer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(Notification)
    private notifRepo: Repository<Notification>,
    @InjectRepository(PushInstallation)
    private pushInstallationRepo: Repository<PushInstallation>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private firebaseService: FirebaseService,
  ) {}

  onModuleInit() {
    this.jobAlertTimer = setInterval(() => {
      void this.processDueJobAlerts().catch((error) => console.warn('Falha ao processar alertas agendados de vagas:', error));
    }, 60_000);
    this.jobAlertTimer.unref?.();
    void this.processDueJobAlerts().catch(() => undefined);
  }

  onModuleDestroy() {
    if (this.jobAlertTimer) clearInterval(this.jobAlertTimer);
  }

  async findAllForUser(userId: string): Promise<Notification[]> {
    return this.notifRepo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async markAsRead(userId: string, id: string): Promise<void> {
    const notif = await this.notifRepo.findOne({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Notificação não encontrada');
    notif.read = true;
    await this.notifRepo.save(notif);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notifRepo.update({ userId, read: false }, { read: true });
  }

  async remove(userId: string, id: string): Promise<void> {
    const notif = await this.notifRepo.findOne({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Notificação não encontrada');
    await this.notifRepo.remove(notif);
  }

  async registerPushInstallation(userId: string, input: PushInstallationInput) {
    const installationId = input.installationId.trim();
    const token = input.token.trim();
    let installation = await this.pushInstallationRepo.findOne({ where: { installationId } });
    if (!installation) {
      installation = this.pushInstallationRepo.create({
        userId,
        installationId,
        token,
        platform: input.platform?.trim().slice(0, 120) || null,
        userAgent: input.userAgent?.trim().slice(0, 512) || null,
        active: true,
        lastSeenAt: new Date(),
      });
    } else {
      installation.userId = userId;
      installation.token = token;
      installation.platform = input.platform?.trim().slice(0, 120) || installation.platform || null;
      installation.userAgent = input.userAgent?.trim().slice(0, 512) || installation.userAgent || null;
      installation.active = true;
      installation.lastSeenAt = new Date();
    }
    await this.pushInstallationRepo.save(installation);

    return {
      registered: true,
      installationId: installation.installationId,
      active: installation.active,
      lastSeenAt: installation.lastSeenAt,
    };
  }

  async unregisterPushInstallation(userId: string, installationId: string) {
    const installation = await this.pushInstallationRepo.findOne({ where: { userId, installationId } });
    if (!installation) return { unregistered: true };
    installation.active = false;
    await this.pushInstallationRepo.save(installation);
    return { unregistered: true };
  }

  async pushStatus(userId: string) {
    const activeInstallations = await this.pushInstallationRepo.count({ where: { userId, active: true } });
    return { enabled: activeInstallations > 0, activeInstallations };
  }

  private notificationUrl(notif: Partial<Notification>): string {
    if (notif.link) return notif.link;
    if (notif.appId) return `/user/admissao/${notif.appId}`;
    if (notif.jobId) return `/user/vaga/${notif.jobId}`;
    return '/user';
  }

  private absoluteWebUrl(pathOrUrl: string): string {
    if (/^https:\/\//i.test(pathOrUrl)) return pathOrUrl;
    const origin = (process.env.PUBLIC_SITE_URL || 'https://piranegocios.com.br').replace(/\/$/, '');
    return `${origin}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
  }

  private isPermanentRegistrationError(error: any): boolean {
    const code = String(error?.code || error?.errorInfo?.code || '').toLowerCase();
    return code.includes('registration-token-not-registered') ||
      code.includes('invalid-registration-token') ||
      code.includes('invalid-argument') ||
      code.includes('unregistered');
  }

  private async disableInstallations(ids: string[]) {
    if (!ids.length) return;
    await this.pushInstallationRepo.update({ installationId: In(ids) }, { active: false });
  }

  private shouldPush(user: User, notif: Notification): boolean {
    if (notif.type === 'push_test') return true;
    const prefs = user.notificationPreferences || {};
    if (prefs.pushEnabled === false) return false;
    const type = String(notif.type || '').toLowerCase();
    if ((type === 'new_job' || type === 'new_job_early') && prefs.newJobs === false) return false;
    if ((type.includes('status') || type.includes('application')) && user.companyId && prefs.hiringUpdates === false) return false;
    if ((type.includes('status') || type.includes('application')) && !user.companyId && prefs.applicationUpdates === false) return false;
    if (type.includes('document') && prefs.documents === false) return false;
    if (type.includes('message') || type.includes('chat')) {
      if (user.companyId && prefs.candidateMessages === false) return false;
      if (!user.companyId && prefs.messages === false) return false;
    }
    if (type.includes('moderation') && prefs.moderation === false) return false;
    if (type.includes('api') && prefs.api === false) return false;
    if (type.includes('company') && user.type === UserType.ADMIN && prefs.companies === false) return false;
    if (type.includes('system') && prefs.system === false) return false;
    return true;
  }

  private async pushToUser(user: User | null, notif: Notification): Promise<void> {
    if (!user || !this.shouldPush(user, notif)) return;
    const installations = await this.pushInstallationRepo.find({
      where: { userId: user.id, active: true },
      order: { updatedAt: 'DESC' },
    });
    const url = this.notificationUrl(notif);
    const absoluteLink = this.absoluteWebUrl(url);

    if (installations.length) {
      for (let offset = 0; offset < installations.length; offset += 500) {
        const batch = installations.slice(offset, offset + 500);
        const tokens = batch
          .map((item) => item.token)
          .filter((token): token is string => typeof token === 'string' && token.length > 0);
        if (!tokens.length) continue;
        try {
          const result = await this.firebaseService.getMessaging().sendEachForMulticast({
            tokens,
            notification: { title: notif.title, body: notif.message },
            data: {
              url,
              notificationId: String(notif.id || ''),
              type: String(notif.type || ''),
              jobId: String(notif.jobId || ''),
              appId: String(notif.appId || ''),
            },
            webpush: { fcmOptions: { link: absoluteLink } },
          });
          const invalidIds = result.responses
            .map((response, index) => (!response.success && this.isPermanentRegistrationError(response.error) ? batch[index]?.installationId : null))
            .filter((value): value is string => Boolean(value));
          await this.disableInstallations(invalidIds);
        } catch (error: any) {
          console.warn(`FCM push failed for user ${user.id}:`, error?.code || error?.message || error);
        }
      }
      return;
    }

    const legacyToken = user.fcmToken?.trim();
    if (!legacyToken) return;
    try {
      await this.firebaseService.getMessaging().send({
        token: legacyToken,
        notification: { title: notif.title, body: notif.message },
        data: {
          url,
          notificationId: String(notif.id || ''),
          type: String(notif.type || ''),
          jobId: String(notif.jobId || ''),
          appId: String(notif.appId || ''),
        },
        webpush: { fcmOptions: { link: absoluteLink } },
      });
    } catch (error: any) {
      console.warn(`Legacy FCM push failed for user ${user.id}:`, error?.code || error?.message || error);
      if (this.isPermanentRegistrationError(error)) {
        user.fcmToken = null;
        await this.userRepo.save(user).catch(() => undefined);
      }
    }
  }

  async create(data: Partial<Notification>): Promise<Notification> {
    const notif = this.notifRepo.create({ ...data, read: data.read ?? false });
    const saved = await this.notifRepo.save(notif);
    const user = saved.userId ? await this.userRepo.findOne({ where: { id: saved.userId } }) : null;
    await this.pushToUser(user, saved);
    return saved;
  }

  async sendTestPush(userId: string): Promise<Notification> {
    return this.notifyUser(userId, {
      title: 'Push ativado 🔔',
      message: 'As notificações do PiraNegócios estão funcionando neste dispositivo.',
      type: 'push_test',
      link: '/user',
    });
  }

  async notifyUser(userId: string, data: Partial<Notification>): Promise<Notification> {
    return this.create({ ...data, userId });
  }

  async notifyCompany(companyId: string | null | undefined, data: Partial<Notification>): Promise<void> {
    if (!companyId) return;
    const recipients = await this.userRepo.find({ where: { companyId } });
    await Promise.all(recipients.map((user) => this.notifyUser(user.id, data)));
  }

  async adminBroadcast(input: AdminBroadcastInput) {
    const title = input.title.trim();
    const message = input.message.trim();
    const link = input.link?.trim() || undefined;
    const category = input.category || 'announcement';

    let recipients: User[] = [];
    if (input.audience === 'admins') {
      recipients = await this.userRepo.find({ where: { type: UserType.ADMIN } });
    } else if (input.audience === 'companies') {
      const all = await this.userRepo.find();
      recipients = all.filter((user) => Boolean(user.companyId));
    } else if (input.audience === 'candidates') {
      const all = await this.userRepo.find();
      recipients = all.filter((user) => user.type !== UserType.ADMIN && !user.companyId);
    } else if (input.audience === 'user') {
      const query = String(input.userQuery || '').trim().toLowerCase();
      if (!query) return { sent: 0, recipients: 0 };
      const all = await this.userRepo.find();
      recipients = all.filter((user) => user.id.toLowerCase() === query || String(user.email || '').toLowerCase() === query);
    } else {
      recipients = await this.userRepo.find();
    }

    const type = `admin_${category}`;
    let sent = 0;
    for (let offset = 0; offset < recipients.length; offset += 100) {
      const batch = recipients.slice(offset, offset + 100);
      const results = await Promise.allSettled(
        batch.map((user) => this.notifyUser(user.id, { title, message, link, type })),
      );
      sent += results.filter((result) => result.status === 'fulfilled').length;
    }

    return { sent, recipients: recipients.length };
  }

  private jobAlertLink(jobData: any) {
    return jobData.slug ? `/vagas/${jobData.slug}` : `/user/vaga/${jobData.jobId}`;
  }

  private jobAlertMessage(jobData: any) {
    const company = jobData.companyName || 'Uma empresa';
    const title = jobData.jobTitle || jobData.title || 'nova oportunidade';
    const location = jobData.location || [jobData.city, jobData.state].filter(Boolean).join('/') || 'localização informada na vaga';
    return `${company} publicou “${title}” em ${location}.`;
  }

  async scheduleNewJobAlerts(jobData: any, earlyRecipientIds: string[] = []) {
    const jobId = String(jobData?.jobId || jobData?.id || '').trim();
    if (!jobId) return { scheduled: false, reason: 'missing_job_id' };
    const earlyIds = Array.from(new Set(earlyRecipientIds.map(String).filter(Boolean)));
    const delayMinutes = Math.max(1, Math.min(1440, Number(process.env.EARLY_JOB_ALERT_MINUTES || 30)));
    const releaseAt = new Date(Date.now() + delayMinutes * 60_000);
    const payload = {
      jobId,
      jobTitle: jobData.jobTitle || jobData.title || null,
      companyName: jobData.companyName || null,
      location: jobData.location || null,
      city: jobData.city || null,
      state: jobData.state || null,
      slug: jobData.slug || null,
    };

    const rows = await this.userRepo.manager.query(
      `INSERT INTO scheduled_job_alerts ("jobId", payload, "earlyRecipientIds", "releaseAt")
       VALUES ($1,$2::jsonb,$3::jsonb,$4)
       ON CONFLICT ("jobId") DO NOTHING
       RETURNING *`,
      [jobId, JSON.stringify(payload), JSON.stringify(earlyIds), releaseAt],
    );
    if (!rows[0]) return { scheduled: false, duplicate: true };

    if (earlyIds.length) {
      const results = await Promise.allSettled(earlyIds.map((userId) => this.notifyUser(userId, {
        title: '⚡ Vaga compatível em primeira mão',
        message: `${this.jobAlertMessage(payload)} Você está recebendo este aviso antecipado pelo Plano Destaque.`,
        type: 'new_job_early',
        jobId,
        link: this.jobAlertLink(payload),
      })));
      await this.userRepo.manager.query(
        `UPDATE scheduled_job_alerts SET "earlyDispatchedAt" = now(), "updatedAt" = now() WHERE id = $1`,
        [rows[0].id],
      );
      return { scheduled: true, earlyRecipients: earlyIds.length, earlySent: results.filter((item) => item.status === 'fulfilled').length, releaseAt };
    }

    return { scheduled: true, earlyRecipients: 0, releaseAt };
  }

  private jsonArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  async processDueJobAlerts() {
    let rows: any[] = [];
    try {
      rows = await this.userRepo.manager.query(
        `UPDATE scheduled_job_alerts SET "processingAt" = now(), "updatedAt" = now()
         WHERE id IN (
           SELECT id FROM scheduled_job_alerts
           WHERE "generalDispatchedAt" IS NULL AND "releaseAt" <= now()
             AND ("processingAt" IS NULL OR "processingAt" < now() - interval '5 minutes')
           ORDER BY "releaseAt" ASC
           LIMIT 10
           FOR UPDATE SKIP LOCKED
         )
         RETURNING *`,
      );
    } catch (error: any) {
      if (String(error?.message || '').includes('scheduled_job_alerts')) return { processed: 0, migrationPending: true };
      throw error;
    }

    let processed = 0;
    for (const row of rows) {
      try {
        const jobRows = await this.userRepo.manager.query(
          `SELECT active, "isInternal"
           FROM jobs
           WHERE id = $1
           LIMIT 1`,
          [row.jobId],
        );
        if (!jobRows[0]?.active || jobRows[0]?.isInternal) {
          await this.userRepo.manager.query(
            `UPDATE scheduled_job_alerts SET "generalDispatchedAt" = now(), "processingAt" = NULL, "updatedAt" = now() WHERE id = $1`,
            [row.id],
          );
          processed += 1;
          continue;
        }
        const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {});
        const earlyIds = new Set(this.jsonArray(row.earlyRecipientIds));
        const users = await this.userRepo.find({ where: { isOpenToWork: true } });
        const recipients = users.filter((user) => user.type !== UserType.ADMIN && !user.companyId && !earlyIds.has(user.id));
        for (let offset = 0; offset < recipients.length; offset += 100) {
          const batch = recipients.slice(offset, offset + 100);
          await Promise.allSettled(batch.map((candidate) => this.notifyUser(candidate.id, {
            title: 'Nova vaga na região',
            message: this.jobAlertMessage(payload),
            type: 'new_job',
            jobId: payload.jobId,
            link: this.jobAlertLink(payload),
          })));
        }
        await this.userRepo.manager.query(
          `UPDATE scheduled_job_alerts SET "generalDispatchedAt" = now(), "processingAt" = NULL, "updatedAt" = now() WHERE id = $1`,
          [row.id],
        );
        processed += 1;
      } catch (error) {
        await this.userRepo.manager.query(
          `UPDATE scheduled_job_alerts SET "processingAt" = NULL, "updatedAt" = now() WHERE id = $1`,
          [row.id],
        ).catch(() => undefined);
        console.warn(`Falha ao liberar alerta geral da vaga ${row.jobId}:`, error);
      }
    }
    return { processed };
  }

  async notifyNewJob(jobData: any, earlyRecipientIds: string[] = []): Promise<void> {
    await this.scheduleNewJobAlerts(jobData, earlyRecipientIds);
  }
}
