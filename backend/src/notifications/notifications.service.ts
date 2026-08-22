import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { User, UserType } from '../users/entities/user.entity';
import { FirebaseService } from '../auth/firebase.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notifRepo: Repository<Notification>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private firebaseService: FirebaseService,
  ) {}

  async findAllForUser(userId: string): Promise<Notification[]> {
    return this.notifRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
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

  private notificationUrl(notif: Partial<Notification>): string {
    if (notif.link) return notif.link;
    if (notif.appId) return `/user/admissao/${notif.appId}`;
    if (notif.jobId) return `/user/vaga/${notif.jobId}`;
    return '/user';
  }

  private async pushToUser(user: User | null, notif: Notification): Promise<void> {
    const token = user?.fcmToken?.trim();
    if (!token) return;

    try {
      await this.firebaseService.getMessaging().send({
        token,
        notification: {
          title: notif.title,
          body: notif.message,
        },
        data: {
          url: this.notificationUrl(notif),
          notificationId: String(notif.id || ''),
          type: String(notif.type || ''),
          jobId: String(notif.jobId || ''),
          appId: String(notif.appId || ''),
        },
        webpush: {
          fcmOptions: {
            link: this.notificationUrl(notif),
          },
        },
      });
    } catch (error: any) {
      const code = String(error?.code || error?.errorInfo?.code || '');
      console.warn(`FCM push failed for user ${user?.id || 'unknown'}:`, code || error?.message || error);
      if (
        user &&
        (code.includes('registration-token-not-registered') ||
          code.includes('invalid-registration-token') ||
          code.includes('invalid-argument'))
      ) {
        user.fcmToken = null;
        await this.userRepo.save(user).catch(() => undefined);
      }
    }
  }

  async create(data: Partial<Notification>): Promise<Notification> {
    const notif = this.notifRepo.create({ ...data, read: data.read ?? false });
    const saved = await this.notifRepo.save(notif);
    const user = saved.userId
      ? await this.userRepo.findOne({ where: { id: saved.userId } })
      : null;
    await this.pushToUser(user, saved);
    return saved;
  }

  async notifyUser(userId: string, data: Partial<Notification>): Promise<Notification> {
    return this.create({ ...data, userId });
  }

  async notifyCompany(companyId: string | null | undefined, data: Partial<Notification>): Promise<void> {
    if (!companyId) return;
    const users = await this.userRepo.find({ where: { companyId } });
    const recipients = users.filter((user) => user.isCompanyAdmin || user.type === UserType.COMPANY);
    await Promise.all(recipients.map((user) => this.notifyUser(user.id, data)));
  }

  async notifyNewJob(jobData: any): Promise<void> {
    const users = await this.userRepo.find({ where: { isOpenToWork: true } });
    const candidates = users.filter((user) => user.type !== UserType.ADMIN);
    await Promise.all(
      candidates.map((candidate) =>
        this.notifyUser(candidate.id, {
          title: 'Nova vaga na região',
          message: `A empresa "${jobData.companyName}" publicou a vaga "${jobData.jobTitle}" em ${jobData.location || 'localização informada na vaga'}.`,
          type: 'new_job',
          jobId: jobData.jobId,
          link: jobData.slug ? `/vagas/${jobData.slug}` : `/user/vaga/${jobData.jobId}`,
        }),
      ),
    );
  }
}
