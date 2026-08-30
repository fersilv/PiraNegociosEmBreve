import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
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
    const [settings, acceptedOffer] = await Promise.all([
      this.fulfillmentSettings(listingId),
      this.activeAcceptedOffer(req.user.uid, listingId),
    ]);

    const offerAmount = acceptedOffer ? Number(acceptedOffer.amount) : null;
    const withOffer = acceptedOffer && Number.isFinite(offerAmount) && Number(offerAmount) > 0
      ? {
          ...base,
          pricing: {
            ...(base as any).pricing,
            currentPrice: offerAmount,
            pixPrice: offerAmount,
            cardPrice: offerAmount,
            acceptedOffer: true,
            paymentDiscountsSuppressed: true,
          },
          acceptedOffer: {
            id: acceptedOffer.id,
            amount: offerAmount,
            expiresAt: acceptedOffer.expiresAt,
            paymentDiscountsSuppressed: true,
          },
        }
      : base;

    if (!settings || settings.pickupEnabled == null) return withOffer;

    const modes: Array<'PICKUP' | 'DELIVERY' | 'ARRANGE'> = [];
    if (settings.pickupEnabled === true) modes.push('PICKUP');
    const partnerDelivery = settings.platformPartnersEnabled === true && settings.disableLocalPartners !== true;
    if (partnerDelivery) modes.push('DELIVERY');
    if (!modes.length) return withOffer;

    await this.dataSource.query(
      `UPDATE classified_listings
       SET "commerceConfig"=jsonb_set(
         jsonb_set(COALESCE("commerceConfig",'{}'::jsonb),'{onlineCheckout}',COALESCE("commerceConfig"->'onlineCheckout','{}'::jsonb),true),
         '{onlineCheckout,fulfillmentModes}',to_jsonb($2::text[]),true
       ),"updatedAt"=now()
       WHERE id=$1`,
      [listingId, modes],
    ).catch(() => undefined);

    return { ...withOffer, fulfillmentModes: modes };
  }

  @Get('listings/:listingId/my-accepted-offer')
  async acceptedOffer(@Req() req: any, @Param('listingId') listingId: string) {
    const offer = await this.activeAcceptedOffer(req.user.uid, listingId);
    return offer ? {
      id: offer.id,
      listingId: offer.listingId,
      amount: Number(offer.amount),
      expiresAt: offer.expiresAt,
      acceptedAt: offer.respondedAt,
      paymentDiscountsSuppressed: true,
    } : null;
  }

  @Post('listings/:listingId/checkout')
  async createPayment(@Req() req: any, @Param('listingId') listingId: string, @Body() body: Record<string, any>) {
    if (String(body?.fulfillmentMode || '').toUpperCase() === 'DELIVERY') {
      const settings = await this.fulfillmentSettings(listingId);
      const partnerDelivery = settings?.platformPartnersEnabled === true && settings?.disableLocalPartners !== true;
      if (!partnerDelivery) {
        throw new BadRequestException('Entrega por parceiro da plataforma não está habilitada para este produto.');
      }
      return this.deliveryCheckout.createPayment(req.user.uid, listingId, body || {});
    }
    return this.checkout.createPayment(req.user.uid, listingId, body || {});
  }

  @Post('listings/:listingId/purchase-order')
  async createPurchaseOrder(@Req() req: any, @Param('listingId') listingId: string, @Body() body: Record<string, any>) {
    const uid = req.user.uid;
    const quantity = Math.max(1, Math.min(999, Math.round(Number(body?.quantity || 1))));
    if (!Number.isFinite(quantity)) throw new BadRequestException('Quantidade inválida.');

    return this.dataSource.transaction(async (manager) => {
      const listingRows = await manager.query(
        `SELECT l.id,l.title,l.status,l."listingType",l."companyId",l."sellerUserId",l."commerceConfig",i.url AS image
         FROM classified_listings l
         LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder","createdAt" LIMIT 1) i ON true
         WHERE l.id=$1 FOR UPDATE OF l`,
        [listingId],
      );
      const listing = listingRows[0];
      if (!listing || listing.status !== 'PUBLISHED' || listing.listingType !== 'PRODUCT' || !listing.companyId) {
        throw new BadRequestException('Este produto não está disponível para gerar ordem de compra.');
      }
      if (listing.sellerUserId === uid) throw new BadRequestException('Você não pode comprar o próprio anúncio.');

      const offerRows = await manager.query(
        `SELECT * FROM classified_offers
         WHERE "listingId"=$1 AND "buyerUserId"=$2 AND status='ACCEPTED'
           AND "expiresAt">now() AND "orderId" IS NULL
         ORDER BY "respondedAt" DESC NULLS LAST,"updatedAt" DESC
         LIMIT 1 FOR UPDATE`,
        [listingId, uid],
      );
      const offer = offerRows[0];
      if (!offer) throw new BadRequestException('Você precisa ter uma oferta aceita e ainda válida para gerar esta ordem de compra.');

      const unitPriceCents = Math.round(Number(offer.amount) * 100);
      if (!Number.isFinite(unitPriceCents) || unitPriceCents <= 0) throw new BadRequestException('O valor da oferta aceita é inválido.');
      const totalCents = unitPriceCents * quantity;
      const stockRaw = listing.commerceConfig?.onlineCheckout?.stockQuantity;
      const stock = stockRaw == null || stockRaw === '' ? null : Number(stockRaw);
      if (stock != null && Number.isFinite(stock) && stock < quantity) {
        throw new BadRequestException('O estoque atual é insuficiente para esta quantidade. A ordem não foi criada.');
      }

      const requestedMode = String(body?.fulfillmentMode || 'ARRANGE').toUpperCase();
      const fulfillmentMode = requestedMode === 'PICKUP' ? 'PICKUP' : 'ARRANGE';
      const offerSnapshot = {
        id: offer.id,
        amount: Number(offer.amount),
        amountCents: unitPriceCents,
        expiresAt: offer.expiresAt,
        pricingMode: 'ACCEPTED_OFFER',
        paymentDiscountsSuppressed: true,
      };
      const orderRows = await manager.query(
        `INSERT INTO classified_orders(
          "companyId","listingId","buyerUserId",quantity,"unitPriceCents","discountCents","totalCents",
          "platformFeeCents","sellerNetCents","paymentProvider","paymentMethod","paymentStatus",status,
          "fulfillmentMode","fulfillmentData","stockReserved",metadata,
          "itemSubtotalCents","shippingCents","buyerFeeCents","applicationFeeCents","deliveryPartnerPayableCents",
          "paymentFinancialSnapshot","offerId","orderMode"
        ) VALUES (
          $1,$2,$3,$4,$5,0,$6,0,$6,'DIRECT','PURCHASE_ORDER','PENDING','CREATED',$7,$8::jsonb,false,$9::jsonb,
          $6,0,0,0,0,$10::jsonb,$11,'PURCHASE_ORDER'
        ) RETURNING *`,
        [
          listing.companyId, listing.id, uid, quantity, unitPriceCents, totalCents, fulfillmentMode,
          JSON.stringify({ note: String(body?.note || '').trim().slice(0, 500) || null }),
          JSON.stringify({ acceptedOffer: offerSnapshot, pricingSource: 'ACCEPTED_OFFER', inventoryPolicy: 'ON_COMPLETION' }),
          JSON.stringify({ currency: 'BRL', itemSubtotalCents: totalCents, shippingCents: 0, buyerFeeCents: 0, totalCents, platformFeeCents: 0, applicationFeeCents: 0, sellerNetCents: totalCents, pricingSource: 'ACCEPTED_OFFER', acceptedOffer: offerSnapshot }),
          offer.id,
        ],
      );
      const order = orderRows[0];

      await manager.query(
        `INSERT INTO classified_order_items("orderId","listingId",quantity,"unitPriceCents","discountCents","totalCents","titleSnapshot","listingSnapshot","stockReserved")
         VALUES ($1,$2,$3,$4,0,$5,$6,$7::jsonb,false)`,
        [order.id, listing.id, quantity, unitPriceCents, totalCents, listing.title, JSON.stringify({ listingId: listing.id, title: listing.title, image: listing.image || null, acceptedOffer: offerSnapshot, pricingSource: 'ACCEPTED_OFFER' })],
      );
      await manager.query(
        `UPDATE classified_offers SET "orderId"=$2,"updatedAt"=now() WHERE id=$1 AND "orderId" IS NULL`,
        [offer.id, order.id],
      );
      await manager.query(
        `INSERT INTO classified_order_events("orderId",type,"toStatus","actorUserId",metadata)
         VALUES ($1,'PURCHASE_ORDER_CREATED','CREATED',$2,$3::jsonb)`,
        [order.id, uid, JSON.stringify({ offerId: offer.id, quantity, inventoryPolicy: 'ON_COMPLETION' })],
      ).catch(() => undefined);

      return {
        ...order,
        title: listing.title,
        image: listing.image || null,
        acceptedOffer: offerSnapshot,
        inventoryReserved: false,
        message: 'Ordem de compra enviada à empresa. O estoque só será baixado quando a empresa concluir a ordem.',
      };
    });
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

  private async activeAcceptedOffer(uid: string, listingId: string) {
    const rows = await this.dataSource.query(
      `SELECT id,"listingId",amount,status,"expiresAt","respondedAt"
       FROM classified_offers
       WHERE "listingId"=$1 AND "buyerUserId"=$2 AND status='ACCEPTED'
         AND "expiresAt">now() AND "orderId" IS NULL
       ORDER BY "respondedAt" DESC NULLS LAST,"updatedAt" DESC LIMIT 1`,
      [listingId, uid],
    ).catch(() => []);
    return rows[0] || null;
  }

  private async fulfillmentSettings(listingId: string) {
    const rows = await this.dataSource.query(
      `SELECT s."pickupEnabled",s."ownDeliveryEnabled",s."platformPartnersEnabled",
              COALESCE(ls."disableLocalPartners",false) AS "disableLocalPartners"
       FROM classified_listings l
       LEFT JOIN company_commerce_settings s ON s."companyId"=l."companyId"
       LEFT JOIN classified_listing_shipping ls ON ls."listingId"=l.id
       WHERE l.id=$1 LIMIT 1`,
      [listingId],
    ).catch(() => []);
    return rows[0] || null;
  }
}
