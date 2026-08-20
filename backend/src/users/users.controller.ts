import { BadRequestException, Controller, Get, Post, Patch, Put, Body, UseGuards, Req, Param, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { SettingsService } from '../admin/settings.service';

import { User, UserType } from './entities/user.entity';
import { AnalyticsService } from '../analytics/analytics.service';

@Controller('users')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly analytics: AnalyticsService,
    private readonly settingsService: SettingsService,
  ) {}

  private isBootstrapAdmin(email?: string): boolean {
    if (!email) return false;
    const admins = (this.configService.get<string>('ADMIN_EMAILS') || '')
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean);
    return admins.includes(email.toLowerCase());
  }

  private async exposeProfileForRuntime(profile: User) {
    const runtimeProfile = {
      ...profile,
      experiences: this.usersService.normalizeExperienceDates(profile.experiences),
    };
    const aiEnabled =
      (await this.settingsService.getValue('AI_ENABLED', 'false')) === 'true';
    if (aiEnabled) return runtimeProfile;

    const { aiAnalysis: _aiAnalysis, ...safeProfile } = runtimeProfile;
    return {
      ...safeProfile,
      hasAiAnalyzed: false,
    };
  }

  @Get('me')
  async getProfile(@Req() req: any) {
    const user = req.user;
    void this.analytics.recordAccountAccess(user.uid, req.headers).catch(() => undefined);
    const existing = await this.usersService.findOneOrNull(user.uid);

    if (this.isBootstrapAdmin(user.email)) {
      if (!existing || existing.type !== UserType.ADMIN) {
        const profile = await this.usersService.createOrUpdate(user.uid, {
          type: UserType.ADMIN,
          displayName: existing?.displayName || user.name || user.email,
          fullName: existing?.fullName || user.name || user.email,
          email: user.email,
        });
        return this.exposeProfileForRuntime(profile);
      }
      return this.exposeProfileForRuntime(existing);
    }

    if (existing) return this.exposeProfileForRuntime(existing);

    // Firebase Authentication and the application database have independent
    // lifecycles. A valid Firebase account may legitimately reach the app
    // before a row exists in users (local development, imported accounts,
    // restored databases, etc.). Bootstrap the application profile instead of
    // returning 404. UsersService.createOrUpdate also consumes a pending
    // company invitation, when one exists for this e-mail.
    const email =
      typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
    if (!email) {
      throw new BadRequestException(
        'Sua conta de autenticação precisa possuir um e-mail válido.',
      );
    }

    const displayName =
      (typeof user.name === 'string' && user.name.trim()) || email.split('@')[0];
    const profile = await this.usersService.createOrUpdate(user.uid, {
      type: UserType.CANDIDATE,
      email,
      displayName,
      fullName: displayName,
    });

    return this.exposeProfileForRuntime(profile);
  }

  @Post('me')
  @Patch('me')
  async updateProfile(@Req() req: any, @Body() updateData: Partial<User>) {
    const user = req.user;
    const existing = await this.usersService.findOneOrNull(user.uid);
    const sanitized = this.usersService.sanitizeSelfUpdate(updateData, existing);

    if (updateData.type === UserType.ADMIN || updateData.isCompanyAdmin !== undefined || updateData.companyId !== undefined) {
      throw new BadRequestException('Campos de permissão e vínculo corporativo são gerenciados exclusivamente pelo servidor.');
    }

    if (typeof user.email === 'string' && user.email.trim()) {
      sanitized.email = user.email.trim().toLowerCase();
    } else if (!existing) {
      throw new BadRequestException('Sua conta de autenticação precisa possuir um e-mail válido.');
    }

    if (this.isBootstrapAdmin(user.email)) {
      sanitized.type = UserType.ADMIN;
    }

    return this.usersService.createOrUpdate(user.uid, sanitized);
  }

  @Put(':id/fcm-token')
  async updateFcmToken(@Req() req: any, @Param('id') id: string, @Body('token') token: unknown) {
    if (id !== req.user.uid) throw new ForbiddenException('Você só pode atualizar o seu próprio dispositivo.');
    if (typeof token !== 'string' || token.length > 4096) throw new BadRequestException('Token de dispositivo inválido.');
    return this.usersService.createOrUpdate(id, { fcmToken: token });
  }
}