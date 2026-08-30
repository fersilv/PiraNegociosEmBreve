import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClassifiedsEntitlementsService } from './classifieds-entitlements.service';
import { CLASSIFIEDS_PAYMENT_TERMS_VERSION, ClassifiedsMarketplaceTermsService } from './classifieds-marketplace-terms.service';
import { ClassifiedsSalesService } from './classifieds-sales.service';

type FulfillmentMode = 'PICKUP' | 'DELIVERY';
type ReceiptMethod = 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD';

@Injectable()
export class ClassifiedsPayOnReceiptCheckoutService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sales: ClassifiedsSalesService,
    private readonly entitlements: ClassifiedsEntitlementsService,
    private readonly terms: ClassifiedsMarketplaceTermsService,
  ) {}

  async create(uid: string, listingId: string, body: Record<string, any>) {
    await this.terms.assertAccepted(uid, 'ONLINE_PAYMENT_BUYER');
    const quantity = this.quantity(body.quantity);
    const fulfillmentMode = this.fulfillmentMode(body.fulfillmentMode);
    const receiptMethod = this.receiptMethod(body.receiptPaymentMethod);
    const idempotencyKey = this.idempotencyKey(body.idempotencyKey);

    const previous = await this.dataSource.query(
      `SELECT o.*,l.title,l.slug,i.url AS image,c.name AS "companyName"
       FROM classified_orders o
       JOIN classified_listings l ON l.id=o."listingId"
       JOIN companies c ON c.id=o."companyId"
       LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder","createdAt" LIMIT 1) i ON true
       WHERE o."idempotencyKey"=$1 LIMIT 1`,
      [idempotencyKey],
    ).catch(() => []);
    if (previous[0]) {
      if (previous[0].buyerUserId !== uid || previous[0].listingId !== listingId) {
        throw new BadRequestException('Chave de idempotência já utilizada em outra compra.');
      }
      return this.present(previous[0]);
    }

    const created = await this.dataSource.transaction(async (manager) => {
      const listingRows = await manager.query(
        `SELECT l.*,c.name AS "companyName",c."ownerId" AS "companyOwnerId",i.url AS image
         FROM classified_listings l
         JOIN companies c ON c.id=l."companyId"
         LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder","createdAt" LIMIT 1) i ON true
         WHERE l.id=$1 LIMIT 1 FOR UPDATE OF l`,
        [listingId],
      );
      const listing = listingRows[0];
      if (!listing || listing.status !== 'PUBLISHED' || listing.listingType !== 'PRODUCT' || !listing.companyId) {
        throw new NotFoundException('Este produto não está disponível para compra.');
      }
      if (listing.sellerUserId === uid || listing.companyOwnerId === uid) {
        throw new BadRequestException('Você não pode comprar o próprio anúncio.');
      }

      const preferenceRows = await manager.query(
        `SELECT * FROM company_classified_receipt_preferences WHERE "companyId"=$1 LIMIT 1`,
        [listing.companyId],
      ).catch(() => []);
      const preferences = preferenceRows[0];
      if (!preferences?.payOnReceiptEnabled) {
        throw new BadRequestException('Esta empresa aceita somente pagamento online neste momento.');
      }
      if (this.listingDisablesPayOnReceipt(listing.commerceConfig)) {
        throw new BadRequestException('Este produto aceita somente pagamento online.');
      }
      if (fulfillmentMode === 'PICKUP' && preferences.payOnPickupEnabled === false) {
        throw new BadRequestException('Pagamento na retirada não está habilitado para esta empresa.');
      }
      if (fulfillmentMode === 'DELIVERY' && preferences.payOnDeliveryEnabled === false) {
        throw new BadRequestException('Pagamento na entrega não está habilitado para esta empresa.');
      }
      this.assertReceiptMethodAllowed(receiptMethod, preferences);

      const offerRows = await manager.query(
        `SELECT * FROM classified_offers
         WHERE "listingId"=$1 AND "buyerUserId"=$2 AND status='ACCEPTED'
           AND "expiresAt">now() AND "orderId" IS NULL
         ORDER BY "respondedAt" DESC NULLS LAST,"updatedAt" DESC
         LIMIT 1 FOR UPDATE`,
        [listingId, uid],
      ).catch(() => []);
      const acceptedOffer = offerRows[0] || null;

      const pricing = this.sales.effectivePricing(listing.price, listing.commerceConfig);
      const normalUnitPrice = Number(pricing.currentPrice ?? listing.price);
      const negotiatedUnitPrice = acceptedOffer ? Number(acceptedOffer.amount) : null;
      const unitPrice = negotiatedUnitPrice != null && Number.isFinite(negotiatedUnitPrice) && negotiatedUnitPrice > 0
        ? negotiatedUnitPrice
        : normalUnitPrice;
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new BadRequestException('Este produto está sem preço válido para compra.');
      }
      const unitPriceCents = Math.round(unitPrice * 100);
      const itemSubtotalCents = unitPriceCents * quantity;

      const stock = this.stockQuantity(listing.commerceConfig);
      if (stock != null && stock < quantity) throw new BadRequestException('Estoque insuficiente para esta quantidade.');
      if (stock != null) {
        const nextConfig = this.withStock(listing.commerceConfig, stock - quantity);
        await manager.query(`UPDATE classified_listings SET "commerceConfig"=$2::jsonb,"updatedAt"=now() WHERE id=$1`, [listing.id, JSON.stringify(nextConfig)]);
        listing.commerceConfig = nextConfig;
      }

      let shippingCents = 0;
      let deliveryPartnerPayableCents = 0;
      let deliveryQuoteSnapshot: any = null;
      let deliveryAddressSnapshot: any = null;
      let fulfillmentLocationSnapshot: any = null;
      let fulfillmentData: Record<string, any> = { note: String(body?.fulfillmentData?.note || '').trim().slice(0, 500) || null };
      let deliveryQuoteId: string | null = null;

      if (fulfillmentMode === 'DELIVERY') {
        const deliveryAddressId = this.uuid(body.deliveryAddressId, 'Selecione o endereço de entrega.');
        deliveryQuoteId = this.uuid(body.deliveryQuoteId, 'Calcule e selecione uma opção de frete antes de finalizar o pedido.');
        const addressRows = await manager.query(`SELECT * FROM delivery_addresses WHERE id=$1 AND "userId"=$2 AND active=true LIMIT 1`, [deliveryAddressId, uid]);
        const address = addressRows[0];
        if (!address) throw new BadRequestException('Endereço de entrega inválido ou removido.');
        const quoteRows = await manager.query(
          `SELECT q.*,p.name AS "partnerName",p.type AS "partnerType"
           FROM delivery_quotes q LEFT JOIN delivery_partners p ON p.id=q."partnerId"
           WHERE q.id=$1 AND q."buyerUserId"=$2 AND q."companyId"=$3 AND q."destinationAddressId"=$4
             AND q.eligible=true AND q.status IN ('QUOTED','SELECTED') AND q."expiresAt">now()
           LIMIT 1 FOR UPDATE OF q`,
          [deliveryQuoteId, uid, listing.companyId, deliveryAddressId],
        );
        const quote = quoteRows[0];
        if (!quote || quote.mode !== 'DELIVERY') throw new BadRequestException('A cotação de frete expirou. Calcule novamente.');
        this.assertQuoteItems(quote, listingId, quantity);
        const origins = await manager.query(`SELECT * FROM company_fulfillment_locations WHERE id=$1 AND "companyId"=$2 AND active=true LIMIT 1`, [quote.originLocationId, listing.companyId]);
        const origin = origins[0];
        if (!origin) throw new BadRequestException('A origem desta entrega não está mais disponível.');
        shippingCents = Math.max(0, Number(quote.amountCents || 0));
        deliveryPartnerPayableCents = Math.max(0, Number(quote.partnerPayableCents || shippingCents));
        deliveryAddressSnapshot = this.addressSnapshot(address);
        fulfillmentLocationSnapshot = this.addressSnapshot(origin);
        deliveryQuoteSnapshot = {
          id: quote.id, partnerId: quote.partnerId, partnerName: quote.partnerName || null, partnerType: quote.partnerType || null,
          rateTableId: quote.rateTableId || null, rateRuleId: quote.rateRuleId || null,
          amountCents: shippingCents, partnerPayableCents: deliveryPartnerPayableCents,
          estimatedMinutes: quote.estimatedMinutes == null ? null : Number(quote.estimatedMinutes),
          distanceMeters: quote.distanceMeters == null ? null : Number(quote.distanceMeters), mode: quote.mode,
          quoteSnapshot: quote.quoteSnapshot || null,
        };
        fulfillmentData = { ...fulfillmentData, address: this.addressText(address), deliveryAddressId, deliveryQuoteId };
      }

      const totalCents = itemSubtotalCents + shippingCents;
      const needsChange = receiptMethod === 'CASH' && body.needsChange === true;
      const changeForCents = needsChange ? this.moneyCents(body.changeForCents ?? body.changeFor) : null;
      if (needsChange && preferences.receiptChangeEnabled === false) throw new BadRequestException('A empresa não aceita solicitação de troco.');
      if (needsChange && (changeForCents == null || changeForCents < totalCents)) {
        throw new BadRequestException('Informe um valor para troco igual ou maior que o total do pedido.');
      }

      const plan = await this.entitlements.companyPlan(listing.companyId);
      const feeRule = await this.sales.resolveFeeRule(listing.companyId, plan);
      const platformFeeCents = feeRule ? this.sales.calculatePlatformFee(itemSubtotalCents, feeRule) : 0;
      const sellerNetCents = Math.max(0, itemSubtotalCents - platformFeeCents);
      const offerSnapshot = acceptedOffer ? {
        id: acceptedOffer.id, amount: Number(acceptedOffer.amount), amountCents: unitPriceCents,
        expiresAt: acceptedOffer.expiresAt, pricingMode: 'ACCEPTED_OFFER', paymentDiscountsSuppressed: true,
      } : null;
      const receiptSnapshot = { method: receiptMethod, needsChange, changeForCents, settlement: 'DIRECT_WITH_SELLER' };
      const financialSnapshot = {
        currency: 'BRL', itemSubtotalCents, shippingCents, buyerFeeCents: 0, totalCents,
        platformFeeCents, applicationFeeCents: 0, sellerNetCents, deliveryPartnerPayableCents,
        feeRule: feeRule ? { ...feeRule, plan } : null,
        settlementMode: 'PAY_ON_RECEIPT', acceptedOffer: offerSnapshot,
      };
      const metadata = {
        pricingSource: acceptedOffer ? 'ACCEPTED_OFFER' : 'LISTING', acceptedOffer: offerSnapshot,
        paymentOnReceipt: receiptSnapshot,
        inventoryPolicy: stock == null ? 'UNTRACKED' : 'RESERVED_UNTIL_COMPLETION',
        deliverySettlement: fulfillmentMode === 'DELIVERY' ? 'COMPANY_RESPONSIBLE_FOR_PARTNER_PAYOUT' : null,
      };

      const orderRows = await manager.query(
        `INSERT INTO classified_orders(
          "companyId","listingId","buyerUserId",quantity,"unitPriceCents","discountCents","totalCents",
          "platformFeeCents","sellerNetCents","paymentProvider","paymentMethod","paymentStatus",status,
          "fulfillmentMode","fulfillmentData","idempotencyKey","termsVersion","stockReserved",metadata,
          "itemSubtotalCents","shippingCents","buyerFeeCents","applicationFeeCents","deliveryPartnerPayableCents",
          "paymentFinancialSnapshot","deliveryQuoteSnapshot","deliveryAddressSnapshot","fulfillmentLocationSnapshot","offerId","orderMode"
        ) VALUES (
          $1,$2,$3,$4,$5,0,$6,$7,$8,'DIRECT',$9,'PENDING','CREATED',$10,$11::jsonb,$12,$13,$14,$15::jsonb,
          $16,$17,0,0,$18,$19::jsonb,$20::jsonb,$21::jsonb,$22::jsonb,$23,'PAY_ON_RECEIPT'
        ) RETURNING *`,
        [
          listing.companyId, listing.id, uid, quantity, unitPriceCents, totalCents, platformFeeCents, sellerNetCents,
          receiptMethod, fulfillmentMode, JSON.stringify(fulfillmentData), idempotencyKey, CLASSIFIEDS_PAYMENT_TERMS_VERSION,
          stock != null, JSON.stringify(metadata), itemSubtotalCents, shippingCents, deliveryPartnerPayableCents,
          JSON.stringify(financialSnapshot), JSON.stringify(deliveryQuoteSnapshot), JSON.stringify(deliveryAddressSnapshot),
          JSON.stringify(fulfillmentLocationSnapshot), acceptedOffer?.id || null,
        ],
      );
      const order = orderRows[0];
      await manager.query(
        `INSERT INTO classified_order_items("orderId","listingId",quantity,"unitPriceCents","discountCents","totalCents","titleSnapshot","listingSnapshot","stockReserved")
         VALUES ($1,$2,$3,$4,0,$5,$6,$7::jsonb,$8)
         ON CONFLICT ("orderId","listingId") DO NOTHING`,
        [order.id, listing.id, quantity, unitPriceCents, itemSubtotalCents, listing.title,
          JSON.stringify({ listingId: listing.id, title: listing.title, image: listing.image || null, pricing, acceptedOffer: offerSnapshot, pricingSource: metadata.pricingSource }), stock != null],
      ).catch(() => undefined);
      if (acceptedOffer) {
        await manager.query(`UPDATE classified_offers SET "orderId"=$2,"updatedAt"=now() WHERE id=$1 AND status='ACCEPTED' AND "orderId" IS NULL`, [acceptedOffer.id, order.id]);
      }
      if (deliveryQuoteId) await manager.query(`UPDATE delivery_quotes SET status='SELECTED' WHERE id=$1 AND status IN ('QUOTED','SELECTED')`, [deliveryQuoteId]);
      await manager.query(
        `INSERT INTO classified_order_events("orderId",type,"toStatus","actorUserId",metadata)
         VALUES ($1,'CHECKOUT_CREATED','CREATED',$2,$3::jsonb)`,
        [order.id, uid, JSON.stringify({ paymentMode: 'PAY_ON_RECEIPT', receiptMethod, fulfillmentMode, needsChange, changeForCents, acceptedOfferId: acceptedOffer?.id || null })],
      ).catch(() => undefined);
      return { ...order, title: listing.title, slug: listing.slug, image: listing.image || null, companyName: listing.companyName, acceptedOffer: offerSnapshot };
    });

    return {
      ...this.present(created),
      paymentOnReceipt: true,
      message: fulfillmentMode === 'DELIVERY'
        ? 'Pedido enviado à empresa. O pagamento será feito no recebimento.'
        : 'Pedido enviado à empresa. O pagamento será feito na retirada.',
    };
  }

  private listingDisablesPayOnReceipt(config: any) {
    const value = config?.paymentOnReceipt;
    return value?.disabled === true || ['DISABLED','ONLINE_ONLY'].includes(String(value?.mode || '').toUpperCase());
  }

  private assertReceiptMethodAllowed(method: ReceiptMethod, row: any) {
    const allowed = method === 'CASH' ? row.receiptCashEnabled !== false
      : method === 'PIX' ? row.receiptPixEnabled !== false
      : method === 'CREDIT_CARD' ? row.receiptCreditCardEnabled === true
      : row.receiptDebitCardEnabled === true;
    if (!allowed) throw new BadRequestException('A empresa não aceita esta forma de pagamento no recebimento.');
  }

  private fulfillmentMode(value: unknown): FulfillmentMode {
    const mode = String(value || '').toUpperCase();
    if (!['PICKUP','DELIVERY'].includes(mode)) throw new BadRequestException('Pagamento ao receber exige retirada ou entrega.');
    return mode as FulfillmentMode;
  }

  private receiptMethod(value: unknown): ReceiptMethod {
    const method = String(value || '').toUpperCase();
    if (!['CASH','PIX','CREDIT_CARD','DEBIT_CARD'].includes(method)) throw new BadRequestException('Escolha como deseja pagar no recebimento.');
    return method as ReceiptMethod;
  }

  private quantity(value: unknown) {
    const quantity = Math.round(Number(value || 1));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999) throw new BadRequestException('Quantidade inválida.');
    return quantity;
  }

  private idempotencyKey(value: unknown) {
    const key = String(value || '').trim();
    if (!key || key.length > 160) throw new BadRequestException('Chave de idempotência inválida.');
    return key;
  }

  private uuid(value: unknown, message: string) {
    const id = String(value || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException(message);
    return id;
  }

  private moneyCents(value: unknown) {
    if (value == null || value === '') return null;
    const raw = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (!Number.isFinite(raw) || raw < 0) throw new BadRequestException('Valor de troco inválido.');
    if (typeof value === 'number' && Number.isInteger(value) && value >= 1000) return Math.round(value);
    return Math.round(raw * 100);
  }

  private stockQuantity(config: any) {
    const value = config?.onlineCheckout?.stockQuantity;
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
  }

  private withStock(config: any, stockQuantity: number) {
    return { ...(config || {}), onlineCheckout: { ...(config?.onlineCheckout || {}), stockQuantity } };
  }

  private assertQuoteItems(quote: any, listingId: string, quantity: number) {
    const items = Array.isArray(quote.itemsSnapshot) ? quote.itemsSnapshot : [];
    const matching = items.filter((item: any) => String(item?.listingId || '') === listingId);
    const total = matching.reduce((sum: number, item: any) => sum + Math.max(0, Number(item?.quantity || 0)), 0);
    if (matching.length !== 1 || total !== quantity || items.length !== 1) throw new BadRequestException('A cotação de frete não corresponde mais ao produto ou quantidade. Calcule novamente.');
  }

  private addressSnapshot(row: any) {
    if (!row) return null;
    return { id: row.id || null, label: row.label || row.name || null, zipCode: row.zipCode || null, street: row.street || row.address || null, number: row.number || null, complement: row.complement || null, neighborhood: row.neighborhood || null, city: row.city || null, state: row.state || null, latitude: row.latitude == null ? null : Number(row.latitude), longitude: row.longitude == null ? null : Number(row.longitude) };
  }

  private addressText(row: any) {
    return [row.street && `${row.street}${row.number ? `, ${row.number}` : ''}`, row.complement, row.neighborhood, row.city && `${row.city}${row.state ? `/${row.state}` : ''}`, row.zipCode].filter(Boolean).join(', ');
  }

  private present(row: any) {
    return { ...row, unitPrice: Number(row.unitPriceCents || 0) / 100, total: Number(row.totalCents || 0) / 100, platformFee: Number(row.platformFeeCents || 0) / 100, sellerNet: Number(row.sellerNetCents || 0) / 100 };
  }
}
