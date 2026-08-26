import { Body, Controller, Headers, Post, Query } from '@nestjs/common';
import { ClassifiedsCheckoutService } from './classifieds-checkout.service';

@Controller('classifieds/payments')
export class ClassifiedsCheckoutWebhookController {
  constructor(private readonly checkout: ClassifiedsCheckoutService) {}

  @Post('mercado-pago/webhook')
  mercadoPago(
    @Headers() headers: Record<string, unknown>,
    @Query() query: Record<string, any>,
    @Body() body: Record<string, any>,
  ) {
    return this.checkout.mercadoPagoWebhook(headers, query || {}, body || {});
  }
}
