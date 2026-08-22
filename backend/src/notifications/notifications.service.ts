import { Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notifRepo: Repository<Notification>,
    @InjectRepository(PushInstallation)
    private pushInstallationRepo: Repository<PushInstallation>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private firebaseService: FirebaseService,
  ) {}

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

  private async pushToUser(user: User | null, notif: Notification): Promise<void> {
    if (!user) return;
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

  async notifyNewJob(jobData: any): Promise<void> {
    const users = await this.userRepo.find({ where: { isOpenToWork: true } });
    const candidates = users.filter((user) => user.type !== UserType.ADMIN);
    await Promise.all(
      candidates.map((candidate) => this.notifyUser(candidate.id, {
        title: 'Nova vaga na região',
        message: `A empresa "${jobData.companyName}" publicou a vaga "${jobData.jobTitle}" em ${jobData.location || 'localização informada na vaga'}.`,
        type: 'new_job',
        jobId: jobData.jobId,
        link: jobData.slug ? `/vagas/${jobData.slug}` : `/user/vaga/${jobData.jobId}`,
      })),
    );
  }
}
