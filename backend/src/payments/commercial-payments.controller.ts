import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import type { PaymentCheckoutPayer } from './payment-provider-manager.service';
import { CommercialPaymentsService, type PurchaseMode } from './commercial-payments.service';

@Controller('payments/commercial')
@UseGuards(FirebaseAuthGuard)
export class CommercialPaymentsController {
  constructor(private readonly commercial: CommercialPaymentsService) {}

  @Get('catalog')
  catalog() {
    return this.commercial.listProducts(false);
  }

  @Post('checkout')
  checkout(
    @Req() req: any,
    @Body() body: { productCode?: string; purchaseMode?: PurchaseMode; payer?: PaymentCheckoutPayer },
  ) {
    return this.commercial.createCheckout(
      req.user.uid,
      String(body?.productCode || '').trim(),
      body?.purchaseMode,
      body?.payer || {},
    );
  }
}

@Controller('admin/payments/commercial-products')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminCommercialPaymentsController {
  constructor(private readonly commercial: CommercialPaymentsService) {}

  @Get()
  list() {
    return this.commercial.listProducts(true);
  }

  @Patch(':code')
  update(@Param('code') code: string, @Body() body: Record<string, unknown>) {
    return this.commercial.updateProduct(code, body || {});
  }
}
