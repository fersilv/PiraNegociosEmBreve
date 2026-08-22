import { BadRequestException, Controller, ForbiddenException, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { Notification } from './entities/notification.entity';
import { User, UserType } from '../users/entities/user.entity';

const ALLOWED_NOTIFICATION_PREFERENCES = new Set([
  'pushEnabled',
  'newJobs',
  'applicationUpdates',
  'messages',
  'documents',
  'applications',
  'candidateMessages',
  'hiringUpdates',
  'system',
  'moderation',
  'api',
  'companies',
]);

@Controller('notifications')
@UseGuards(FirebaseAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notifsService: NotificationsService,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
  ) {}

  @Get()
  findAll(@Req() req: any) {
    return this.notifsService.findAllForUser(req.user.uid);
  }

  @Get('preferences')
  async preferences(@Req() req: any) {
    const user = await this.usersRepository.findOne({ where: { id: req.user.uid } });
    return user?.notificationPreferences || {};
  }

  @Put('preferences')
  async updatePreferences(@Req() req: any, @Body() body: Record<string, unknown>) {
    const user = await this.usersRepository.findOne({ where: { id: req.user.uid } });
    if (!user) throw new BadRequestException('Usuário não encontrado.');
    const next: Record<string, boolean> = { ...(user.notificationPreferences || {}) };
    for (const [key, value] of Object.entries(body || {})) {
      if (ALLOWED_NOTIFICATION_PREFERENCES.has(key) && typeof value === 'boolean') next[key] = value;
    }
    user.notificationPreferences = next;
    await this.usersRepository.save(user);
    return next;
  }

  @Get('push-status')
  pushStatus(@Req() req: any) {
    return this.notifsService.pushStatus(req.user.uid);
  }

  @Put('push-installation')
  registerPushInstallation(
    @Req() req: any,
    @Body() body: { installationId?: unknown; token?: unknown; platform?: unknown; userAgent?: unknown },
  ) {
    if (typeof body?.installationId !== 'string' || !body.installationId.trim() || body.installationId.length > 255) {
      throw new BadRequestException('Identificador de instalação inválido.');
    }
    if (typeof body?.token !== 'string' || !body.token.trim() || body.token.length > 8192) {
      throw new BadRequestException('Token FCM inválido.');
    }
    return this.notifsService.registerPushInstallation(req.user.uid, {
      installationId: body.installationId,
      token: body.token,
      platform: typeof body.platform === 'string' ? body.platform : null,
      userAgent: typeof body.userAgent === 'string' ? body.userAgent : null,
    });
  }

  @Delete('push-installation')
  unregisterPushInstallation(@Req() req: any, @Body('installationId') installationId: unknown) {
    if (typeof installationId !== 'string' || !installationId.trim() || installationId.length > 255) {
      throw new BadRequestException('Identificador de instalação inválido.');
    }
    return this.notifsService.unregisterPushInstallation(req.user.uid, installationId.trim());
  }

  @Post('push-test')
  sendTestPush(@Req() req: any) {
    return this.notifsService.sendTestPush(req.user.uid);
  }

  @Post()
  create(@Req() req: any, @Body() createData: Partial<Notification>) {
    if (createData.userId !== req.user.uid) {
      throw new ForbiddenException('Notificações para terceiros são criadas apenas por fluxos internos autorizados.');
    }
    return this.notifsService.create({ ...createData, userId: req.user.uid });
  }

  @Post('new-job')
  async notifyNewJob(@Req() req: any, @Body() jobData: any) {
    const user = await this.usersRepository.findOne({ where: { id: req.user.uid } });
    if (!user || (user.type !== UserType.ADMIN && !user.companyId)) {
      throw new ForbiddenException('Apenas usuários vinculados a uma empresa podem publicar alertas de vaga.');
    }
    if (!jobData?.jobId || !jobData?.jobTitle) throw new BadRequestException('Dados da vaga inválidos.');
    return this.notifsService.notifyNewJob(jobData);
  }

  @Put('read-all')
  markAllAsRead(@Req() req: any) {
    return this.notifsService.markAllAsRead(req.user.uid);
  }

  @Put(':id/read')
  markAsRead(@Req() req: any, @Param('id') id: string) {
    return this.notifsService.markAsRead(req.user.uid, id);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.notifsService.remove(req.user.uid, id);
  }
}
