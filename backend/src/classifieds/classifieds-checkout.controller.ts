import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsCheckoutService } from './classifieds-checkout.service';
import { ClassifiedsDeliveryAwareCheckoutService } from './classifieds-delivery-aware-checkout.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedsMarketplaceTermsService } from './classifieds-marketplace-terms.service';
import { ClassifiedsPayOnReceiptCheckoutService } from './classifieds-pay-on-receipt-checkout.service';

@Controller('classifieds')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsCheckoutController {
  constructor(
    private readonly checkout: ClassifiedsCheckoutService,
    private readonly deliveryCheckout: ClassifiedsDeliveryAwareCheckoutService,
    private readonly payOnReceiptCheckout: ClassifiedsPayOnReceiptCheckoutService,
    private readonly terms: ClassifiedsMarketplaceTermsService,
    private readonly identities: ClassifiedsIdentityService,
    private readonly dataSource: DataSource,
  ) {}

  @Get('listings/:listingId/checkout')
  async config(@Req() req: any, @Param('listingId') listingId: string) {
    const [base, settings, acceptedOffer, receipt] = await Promise.all([
      this.checkout.config(req.user.uid, listingId),
      this.fulfillmentSettings(listingId),
      this.activeAcceptedOffer(req.user.uid, listingId),
      this.paymentOnReceiptSettings(listingId),
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

    const onlineMethods = Array.isArray((withOffer as any).paymentMethods) ? [...(withOffer as any).paymentMethods] : ['PIX', 'CARD'];
    if (receipt?.pixEnabled === false) this.remove(onlineMethods, 'PIX');
    if (receipt?.cardEnabled === false) this.remove(onlineMethods, 'CARD');

    const receiptConfig = this.presentPaymentOnReceipt(receipt);
    let result: any = { ...withOffer, paymentMethods: onlineMethods, paymentOnReceipt: receiptConfig };

    if (settings && settings.pickupEnabled != null) {
      const modes: Array<'PICKUP' | 'DELIVERY' | 'ARRANGE'> = [];
      if (settings.pickupEnabled === true) modes.push('PICKUP');
      const partnerDelivery = settings.platformPartnersEnabled === true && settings.disableLocalPartners !== true;
      if (partnerDelivery) modes.push('DELIVERY');
      if (modes.length) {
        await this.dataSource.query(
          `UPDATE classified_listings
           SET "commerceConfig"=jsonb_set(
             jsonb_set(COALESCE("commerceConfig",'{}'::jsonb),'{onlineCheckout}',COALESCE("commerceConfig"->'onlineCheckout','{}'::jsonb),true),
             '{onlineCheckout,fulfillmentModes}',to_jsonb($2::text[]),true
           ),"updatedAt"=now()
           WHERE id=$1`,
          [listingId, modes],
        ).catch(() => undefined);
        result = { ...result, fulfillmentModes: modes };
      }
    }

    return result;
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

  @Get('listings/:listingId/interaction-context')
  async interactionContext(@Req() req: any, @Param('listingId') listingId: string) {
    const uid = req.user.uid;
    const rows = await this.dataSource.query(
      `SELECT o.id,o.status,o.amount,o."expiresAt",conv.id AS "conversationId"
       FROM classified_offers o
       LEFT JOIN LATERAL (
         SELECT id FROM classified_conversations c
         WHERE c."listingId"=o."listingId" AND c."buyerUserId"=o."buyerUserId"
         ORDER BY c."createdAt" DESC LIMIT 1
       ) conv ON true
       WHERE o."listingId"=$1 AND o."buyerUserId"=$2
       ORDER BY o."updatedAt" DESC LIMIT 1`,
      [listingId, uid],
    ).catch(() => []);
    const offer = rows[0] || null;
    return {
      hasOfferRelationship: Boolean(offer),
      conversationId: offer?.conversationId || null,
      latestOffer: offer ? { id: offer.id, status: offer.status, amount: Number(offer.amount), expiresAt: offer.expiresAt } : null,
      chatAvailable: Boolean(offer),
    };
  }

  @Post('listings/:listingId/checkout')
  async createPayment(@Req() req: any, @Param('listingId') listingId: string, @Body() body: Record<string, any>) {
    const paymentMethod = String(body?.paymentMethod || '').trim().toUpperCase();
    if (paymentMethod === 'PAY_ON_RECEIPT') {
      return this.payOnReceiptCheckout.create(req.user.uid, listingId, body || {});
    }
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
      await manager.query(`UPDATE classified_offers SET "orderId"=$2,"updatedAt"=now() WHERE id=$1 AND "orderId" IS NULL`, [offer.id, order.id]);
      await manager.query(
        `INSERT INTO classified_order_events("orderId",type,"toStatus","actorUserId",metadata)
         VALUES ($1,'PURCHASE_ORDER_CREATED','CREATED',$2,$3::jsonb)`,
        [order.id, uid, JSON.stringify({ offerId: offer.id, quantity, inventoryPolicy: 'ON_COMPLETION' })],
      ).catch(() => undefined);

      return { ...order, title: listing.title, image: listing.image || null, acceptedOffer: offerSnapshot, inventoryReserved: false, message: 'Ordem de compra enviada à empresa.' };
    });
  }

  @Post('me/offers/:offerId/revoke-acceptance')
  async revokeAcceptedOffer(@Req() req: any, @Param('offerId') offerId: string) {
    const uid = req.user.uid;
    const identity = await this.identities.active(uid);

    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT o.*,l.title,l.slug FROM classified_offers o JOIN classified_listings l ON l.id=o."listingId" WHERE o.id=$1 LIMIT 1 FOR UPDATE OF o`,
        [offerId],
      );
      const offer = rows[0];
      if (!offer) throw new BadRequestException('Oferta não encontrada.');
      const sellerAllowed = identity.type === 'COMPANY' ? offer.sellerCompanyId === identity.company!.id : !offer.sellerCompanyId && offer.sellerUserId === uid;
      if (!sellerAllowed) throw new ForbiddenException('Esta oferta pertence a outra identidade.');
      if (offer.status !== 'ACCEPTED') throw new BadRequestException('Somente uma oferta aceita pode ter o aceite retirado.');
      if (offer.orderId) throw new BadRequestException('Esta oferta já foi usada para iniciar uma compra. A partir daqui, qualquer desistência deve acontecer no pedido.');
      const updatedRows = await manager.query(
        `UPDATE classified_offers SET status='REVOKED',"revokedAt"=now(),"revokedByUserId"=$2,"updatedAt"=now() WHERE id=$1 AND status='ACCEPTED' AND "orderId" IS NULL RETURNING *`,
        [offerId, uid],
      );
      const updated = updatedRows[0];
      if (!updated) throw new BadRequestException('O aceite já não está disponível para retirada.');
      return { ...updated, title: offer.title, slug: offer.slug, role: 'SELLER', acceptanceRevoked: true };
    });
  }

  @Get('me/purchases')
  purchases(@Req() req: any) { return this.checkout.purchases(req.user.uid); }

  @Get('me/marketplace-terms')
  termsStatus(@Req() req: any) { return this.terms.status(req.user.uid); }

  @Post('me/marketplace-terms/accept')
  acceptTerms(@Req() req: any, @Headers('user-agent') userAgent: string | undefined, @Body() body: any) {
    return this.terms.accept(req.user.uid, body?.scope, { surface: body?.surface || 'CLASSIFIEDS', userAgent: userAgent || '' });
  }

  private async activeAcceptedOffer(uid: string, listingId: string) {
    const rows = await this.dataSource.query(
      `SELECT id,"listingId",amount,status,"expiresAt","respondedAt" FROM classified_offers
       WHERE "listingId"=$1 AND "buyerUserId"=$2 AND status='ACCEPTED' AND "expiresAt">now() AND "orderId" IS NULL
       ORDER BY "respondedAt" DESC NULLS LAST,"updatedAt" DESC LIMIT 1`,
      [listingId, uid],
    ).catch(() => []);
    return rows[0] || null;
  }

  private async fulfillmentSettings(listingId: string) {
    const rows = await this.dataSource.query(
      `SELECT s."pickupEnabled",s."ownDeliveryEnabled",s."platformPartnersEnabled",COALESCE(ls."disableLocalPartners",false) AS "disableLocalPartners"
       FROM classified_listings l LEFT JOIN company_commerce_settings s ON s."companyId"=l."companyId"
       LEFT JOIN classified_listing_shipping ls ON ls."listingId"=l.id WHERE l.id=$1 LIMIT 1`,
      [listingId],
    ).catch(() => []);
    return rows[0] || null;
  }

  private async paymentOnReceiptSettings(listingId: string) {
    const rows = await this.dataSource.query(
      `SELECT p."pixEnabled",p."cardEnabled",p."payOnReceiptEnabled",p."payOnPickupEnabled",p."payOnDeliveryEnabled",
              p."receiptCashEnabled",p."receiptPixEnabled",p."receiptCreditCardEnabled",p."receiptDebitCardEnabled",p."receiptChangeEnabled",
              l."commerceConfig"->'paymentOnReceipt' AS "listingPaymentOnReceipt"
       FROM classified_listings l LEFT JOIN company_classified_receipt_preferences p ON p."companyId"=l."companyId"
       WHERE l.id=$1 LIMIT 1`,
      [listingId],
    ).catch(() => []);
    return rows[0] || null;
  }

  private presentPaymentOnReceipt(row: any) {
    const listing = row?.listingPaymentOnReceipt || {};
    const disabledByListing = listing?.disabled === true || ['DISABLED','ONLINE_ONLY'].includes(String(listing?.mode || '').toUpperCase());
    const enabled = row?.payOnReceiptEnabled === true && !disabledByListing;
    const methods: string[] = [];
    if (enabled && row?.receiptCashEnabled !== false) methods.push('CASH');
    if (enabled && row?.receiptPixEnabled !== false) methods.push('PIX');
    if (enabled && row?.receiptCreditCardEnabled === true) methods.push('CREDIT_CARD');
    if (enabled && row?.receiptDebitCardEnabled === true) methods.push('DEBIT_CARD');
    return {
      enabled,
      disabledByListing,
      pickupEnabled: enabled && row?.payOnPickupEnabled !== false,
      deliveryEnabled: enabled && row?.payOnDeliveryEnabled !== false,
      methods,
      changeEnabled: enabled && row?.receiptChangeEnabled !== false,
      listingMode: disabledByListing ? 'ONLINE_ONLY' : 'INHERIT',
    };
  }

  private remove(items: string[], value: string) {
    const index = items.indexOf(value);
    if (index >= 0) items.splice(index, 1);
  }
}
