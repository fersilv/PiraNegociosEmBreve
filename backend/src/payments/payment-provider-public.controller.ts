import { Controller, Get, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { PaymentProviderManagerService } from './payment-provider-manager.service';

@Controller('payments')
@UseGuards(FirebaseAuthGuard)
export class PaymentProviderPublicController {
  constructor(private readonly providers: PaymentProviderManagerService) {}

  // /payments/provider é reservado às rotas por tipo de pagamento no PaymentsController.
  // Este endpoint existe apenas para uma visão resumida do(s) provedor(es) ativos.
  @Get('provider-summary')
  async activeProviderSummary() {
    const providers = await this.providers.list();
    const active = providers.filter((item: any) => item.active === true);
    return active.map((provider: any) => ({
      code: provider.code,
      name: provider.name,
      activeFor: provider.activeFor || [],
      capabilities: provider.config?.capabilities || [],
      environment: provider.config?.environment || null,
    }));
  }
}
