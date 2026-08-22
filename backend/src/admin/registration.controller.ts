import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { AdminGuard } from './admin.guard';
import { RegistrationService } from './registration.service';

@Controller('public/registration')
export class PublicRegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Get()
  async status() {
    return { open: await this.registrationService.isOpen() };
  }

  @Post('waitlist')
  async waitlist(@Body() body: { name?: unknown; email?: unknown; source?: unknown }) {
    const interest = await this.registrationService.joinWaitlist(body || {});
    return {
      ok: true,
      message: 'Pré-cadastro realizado. Vamos avisar você quando novos membros forem aceitos.',
      interest: {
        id: interest.id,
        email: interest.email,
        name: interest.name,
        status: interest.status,
      },
    };
  }
}

@Controller('admin/registration')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminRegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Get()
  async overview() {
    return {
      open: await this.registrationService.isOpen(),
      waiting: await this.registrationService.countWaiting(),
      interests: await this.registrationService.list(),
    };
  }

  @Patch()
  async setStatus(@Body('open') open: unknown) {
    return this.registrationService.setOpen(open === true);
  }
}
