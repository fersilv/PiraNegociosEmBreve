import { BadRequestException, Controller, Get, Post, Put, Body, UseGuards, Req, Param, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';

import { User, UserType } from './entities/user.entity';

@Controller('users')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  private isBootstrapAdmin(email?: string): boolean {
    if (!email) return false;
    const admins = (this.configService.get<string>('ADMIN_EMAILS') || '')
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean);
    return admins.includes(email.toLowerCase());
  }

  @Get('me')
  async getProfile(@Req() req: any) {
    const user = req.user; // Vem do AuthGuard
    try {
      return await this.usersService.findOne(user.uid);
    } catch (e) {
      if (this.isBootstrapAdmin(user.email)) {
        return await this.usersService.createOrUpdate(user.uid, {
          type: UserType.ADMIN,
          displayName: 'Fernando Monteiro',
          email: user.email,
        });
      }
      throw e;
    }
  }

  @Post('me')
  async updateProfile(@Req() req: any, @Body() updateData: Partial<User>) {
    const user = req.user;
    const existing = await this.usersService.findOneOrNull(user.uid);
    const sanitized = this.usersService.sanitizeSelfUpdate(updateData, existing);

    if (updateData.type === UserType.ADMIN || updateData.isCompanyAdmin !== undefined || updateData.companyId !== undefined) {
      throw new BadRequestException('Campos de permissão e vínculo corporativo são gerenciados exclusivamente pelo servidor.');
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
