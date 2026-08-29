import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
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
    private readonly dataSource: DataSource,
  ) {}

  @Get('listings/:listingId/checkout')
  async config(@Req() req: any, @Param('listingId') listingId: string) {
    const base = await this.checkout.config(req.user.uid, listingId);
    const rows = await this.dataSource.query(
      `SELECT s."pickupEnabled",s."ownDeliveryEnabled",s."platformPartnersEnabled",
              COALESCE(ls."disableLocalPartners",false) AS "disableLocalPartners"
       FROM classified_listings l
       LEFT JOIN company_commerce_settings s ON s."companyId"=l."companyId"
       LEFT JOIN classified_listing_shipping ls ON ls."listingId"=l.id
       WHERE l.id=$1 LIMIT 1`,
      [listingId],
    ).catch(() => []);
    const settings = rows[0];
    if (!settings || settings.pickupEnabled == null) return base;

    const modes: Array<'PICKUP' | 'DELIVERY' | 'ARRANGE'> = [];
    if (settings.pickupEnabled === true) modes.push('PICKUP');
    const partnerDelivery = settings.platformPartnersEnabled === true && settings.disableLocalPartners !== true;
    if (settings.ownDeliveryEnabled === true || partnerDelivery) modes.push('DELIVERY');
    return { ...base, fulfillmentModes: modes.length ? modes : base.fulfillmentModes };
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
