import { Controller, Get, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { PaymentProviderManagerService } from './payment-provider-manager.service';

@Controller('payments')
@UseGuards(FirebaseAuthGuard)
export class PaymentProviderPublicController {
  constructor(private readonly providers: PaymentProviderManagerService) {}

  @Get('provider')
  async activeProvider() {
    const providers = await this.providers.list();
    const active = providers.find((item: any) => item.active === true) || null;
    if (!active) return null;
    return {
      code: active.code,
      name: active.name,
      capabilities: active.config?.capabilities || [],
      environment: active.config?.environment || null,
    };
  }
}
