import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsCheckoutService } from './classifieds-checkout.service';
import { ClassifiedsDeliveryAwareCheckoutService } from './classifieds-delivery-aware-checkout.service';
import { ClassifiedsMarketplaceTermsService } from './classifieds-marketplace-terms.service';

@Controller('classifieds')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsCheckoutController {
  constructor(
    private readonly checkout: ClassifiedsCheckoutService,
    private readonly deliveryCheckout: ClassifiedsDeliveryAwareCheckoutService,
    private readonly terms: ClassifiedsMarketplaceTermsService,
  ) {}

  @Get('listings/:listingId/checkout')
  config(@Req() req: any, @Param('listingId') listingId: string) {
    return this.checkout.config(req.user.uid, listingId);
  }

  @Post('listings/:listingId/checkout')
  createPayment(@Req() req: any, @Param('listingId') listingId: string, @Body() body: Record<string, any>) {
    if (String(body?.fulfillmentMode || '').toUpperCase() === 'DELIVERY') {
      return this.deliveryCheckout.createPayment(req.user.uid, listingId, body || {});
    }
    return this.checkout.createPayment(req.user.uid, listingId, body || {});
  }

  @Get('me/purchases')
  purchases(@Req() req: any) {
    return this.checkout.purchases(req.user.uid);
  }

  @Get('me/marketplace-terms')
  termsStatus(@Req() req: any) {
    return this.terms.status(req.user.uid);
  }

  @Post('me/marketplace-terms/accept')
  acceptTerms(@Req() req: any, @Headers('user-agent') userAgent: string | undefined, @Body() body: any) {
    return this.terms.accept(req.user.uid, body?.scope, {
      surface: body?.surface || 'CLASSIFIEDS',
      userAgent: userAgent || '',
    });
  }
}
