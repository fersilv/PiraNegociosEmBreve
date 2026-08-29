import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsMarketplacePaymentsService } from './classifieds-marketplace-payments.service';
import { ClassifiedsReceiptPreferencesService } from './classifieds-receipt-preferences.service';
import { ClassifiedsSalesService } from './classifieds-sales.service';

@Controller('classifieds')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsSalesController {
  constructor(
    private readonly sales: ClassifiedsSalesService,
    private readonly marketplacePayments: ClassifiedsMarketplacePaymentsService,
    private readonly receiptPreferences: ClassifiedsReceiptPreferencesService,
  ) {}

  @Get('me/commerce/status')
  commerceStatus(@Req() req: any) {
    return this.sales.status(req.user.uid);
  }

  @Get('me/commerce/listings/:listingId')
  listingCommerce(@Req() req: any, @Param('listingId') listingId: string) {
    return this.sales.getListingCommerce(req.user.uid, listingId);
  }

  @Patch('me/commerce/listings/:listingId')
  configureListing(@Req() req: any, @Param('listingId') listingId: string, @Body() body: Record<string, unknown>) {
    return this.sales.configureListing(req.user.uid, listingId, body || {});
  }

  @Get('me/inventory')
  inventory(@Req() req: any) {
    return this.sales.inventory(req.user.uid);
  }

  @Patch('me/inventory/:listingId')
  updateInventory(@Req() req: any, @Param('listingId') listingId: string, @Body() body: Record<string, unknown>) {
    return this.sales.updateInventory(req.user.uid, listingId, body || {});
  }

  @Get('me/sales/dashboard')
  dashboard(@Req() req: any) {
    return this.sales.dashboard(req.user.uid);
  }

  @Get('me/sales/orders')
  orders(@Req() req: any) {
    return this.sales.orders(req.user.uid);
  }

  @Patch('me/sales/orders/:orderId/status')
  updateOrderStatus(@Req() req: any, @Param('orderId') orderId: string, @Body() body: any) {
    return this.sales.updateOrderStatus(req.user.uid, orderId, body?.status);
  }

  @Get('me/services/appointments')
  appointments(@Req() req: any) {
    return this.sales.appointments(req.user.uid);
  }

  @Get('me/payments/connections')
  paymentConnections(@Req() req: any) {
    return this.marketplacePayments.connections(req.user.uid);
  }

  @Get('me/payments/receipt-preferences')
  receiptSettings(@Req() req: any) {
    return this.receiptPreferences.get(req.user.uid);
  }

  @Patch('me/payments/receipt-preferences')
  updateReceiptSettings(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.receiptPreferences.update(req.user.uid, body || {});
  }

  @Post('me/payments/mercado-pago/oauth/start')
  startMercadoPago(@Req() req: any) {
    return this.marketplacePayments.startMercadoPago(req.user.uid);
  }

  @Post('me/payments/mercado-pago/oauth/complete')
  completeMercadoPago(@Req() req: any, @Body() body: any) {
    return this.marketplacePayments.completeMercadoPago(req.user.uid, body?.state, body?.code);
  }

  @Post('me/payments/mercado-pago/disconnect')
  disconnectMercadoPago(@Req() req: any) {
    return this.marketplacePayments.disconnectMercadoPago(req.user.uid);
  }
}
