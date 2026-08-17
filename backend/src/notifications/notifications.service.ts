import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { User, UserType } from '../users/entities/user.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notifRepo: Repository<Notification>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
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

  async create(data: Partial<Notification>): Promise<Notification> {
    const notif = this.notifRepo.create(data);
    return this.notifRepo.save(notif);
  }

  async notifyNewJob(jobData: any): Promise<void> {
    const candidates = await this.userRepo.find({ where: { type: UserType.CANDIDATE } });
    const notifications = candidates.map(c => this.notifRepo.create({
      userId: c.id,
      title: 'Nova Vaga Compatível!',
      message: `A empresa "${jobData.companyName}" publicou uma nova vaga de "${jobData.jobTitle}" em "${jobData.location}".`,
      type: 'new_job',
      jobId: jobData.jobId,
      link: `/vagas/${jobData.jobId}`,
      read: false,
    }));
    await this.notifRepo.save(notifications);
  }
}
