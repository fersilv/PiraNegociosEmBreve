import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MercadoPagoProviderConfig, PaymentProviderConfigService } from '../payments/payment-provider-config.service';
import { ClassifiedsCheckoutService } from './classifieds-checkout.service';
import { ClassifiedsEntitlementsService } from './classifieds-entitlements.service';
import { ClassifiedsMarketplacePaymentsService } from './classifieds-marketplace-payments.service';
import { CLASSIFIEDS_PAYMENT_TERMS_VERSION, ClassifiedsMarketplaceTermsService } from './classifieds-marketplace-terms.service';
import { ClassifiedsSalesService } from './classifieds-sales.service';
import { NotificationsService } from '../notifications/notifications.service';

type CheckoutMethod = 'PIX' | 'CARD';

@Injectable()
export class ClassifiedsDeliveryAwareCheckoutService extends ClassifiedsCheckoutService {
  constructor(
    private readonly deliveryDataSource: DataSource,
    private readonly deliveryMarketplacePayments: ClassifiedsMarketplacePaymentsService,
    private readonly deliveryProviderConfig: PaymentProviderConfigService,
    private readonly deliverySales: ClassifiedsSalesService,
    private readonly deliveryEntitlements: ClassifiedsEntitlementsService,
    private readonly deliveryTerms: ClassifiedsMarketplaceTermsService,
    notifications: NotificationsService,
  ) {
    super(
      deliveryDataSource,
      deliveryMarketplacePayments,
      deliveryProviderConfig,
      deliverySales,
      deliveryEntitlements,
      deliveryTerms,
      notifications,
    );
  }

  override async createPayment(uid: string, listingId: string, body: Record<string, any>) {
    if (String(body?.fulfillmentMode || '').toUpperCase() !== 'DELIVERY') {
      return super.createPayment(uid, listingId, body);
    }
    return this.createDeliveryPayment(uid, listingId, body || {});
  }

  private async createDeliveryPayment(uid: string, listingId: string, body: Record<string, any>) {
    await this.deliveryTerms.assertAccepted(uid, 'ONLINE_PAYMENT_BUYER');
    const method = this.paymentMethod(body.paymentMethod);
    const quantity = this.quantity(body.quantity);
    const idempotencyKey = this.idempotencyKey(body.idempotencyKey);
    const deliveryAddressId = this.uuid(body.deliveryAddressId, 'Selecione o endereço de entrega.');
    const deliveryQuoteId = this.uuid(body.deliveryQuoteId, 'Calcule e selecione uma opção de frete antes de pagar.');

    const previous = await this.deliveryDataSource.query(
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
      return this.presentOrder(previous[0]);
    }

    const buyerRows = await this.deliveryDataSource.query(
      `SELECT id,email,"displayName","fullName","socialName" FROM users WHERE id=$1 LIMIT 1`,
      [uid],
    );
    const buyer = buyerRows[0];
    if (!buyer?.email) throw new BadRequestException('Sua conta precisa ter e-mail válido para o pagamento online.');

    const prepared = await this.deliveryDataSource.transaction(async (manager) => {
      const listingRows = await manager.query(
        `SELECT l.*,c.name AS "companyName",i.url AS image
         FROM classified_listings l
         JOIN companies c ON c.id=l."companyId"
         LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder","createdAt" LIMIT 1) i ON true
         WHERE l.id=$1 FOR UPDATE OF l`,
        [listingId],
      );
      const listing = listingRows[0];
      this.assertListing(uid, listing);
      if (!this.fulfillmentModes(listing).includes('DELIVERY')) {
        throw new BadRequestException('Entrega não está habilitada para este produto.');
      }

      const addresses = await manager.query(
        `SELECT * FROM delivery_addresses WHERE id=$1 AND "userId"=$2 AND active=true LIMIT 1`,
        [deliveryAddressId, uid],
      );
      const address = addresses[0];
      if (!address) throw new BadRequestException('Endereço de entrega inválido ou removido.');

      const quotes = await manager.query(
        `SELECT q.*,p.name AS "partnerName",p.type AS "partnerType"
         FROM delivery_quotes q
         LEFT JOIN delivery_partners p ON p.id=q."partnerId"
         WHERE q.id=$1 AND q."buyerUserId"=$2 AND q."companyId"=$3
           AND q."destinationAddressId"=$4 AND q.eligible=true
           AND q.status IN ('QUOTED','SELECTED') AND q."expiresAt">now()
         LIMIT 1 FOR UPDATE OF q`,
        [deliveryQuoteId, uid, listing.companyId, deliveryAddressId],
      );
      const quote = quotes[0];
      if (!quote || quote.mode !== 'DELIVERY') throw new BadRequestException('A cotação de frete expirou ou não corresponde a este endereço. Calcule novamente.');
      this.assertQuoteItems(quote, listingId, quantity);

      const origins = await manager.query(
        `SELECT * FROM company_fulfillment_locations WHERE id=$1 AND "companyId"=$2 AND active=true LIMIT 1`,
        [quote.originLocationId, listing.companyId],
      );
      const origin = origins[0];
      if (!origin) throw new BadRequestException('A origem desta entrega não está mais disponível. Calcule o frete novamente.');

      const pricing = this.deliverySales.effectivePricing(listing.price, listing.commerceConfig);
      const unitPrice = method === 'PIX' ? pricing.pixPrice : pricing.cardPrice;
      if (unitPrice == null || !Number.isFinite(Number(unitPrice)) || Number(unitPrice) <= 0) {
        throw new BadRequestException('Este produto está sem preço válido para a forma de pagamento selecionada.');
      }

      const stock = this.stockQuantity(listing.commerceConfig);
      if (stock != null && stock < quantity) throw new BadRequestException('Estoque insuficiente para esta quantidade.');
      if (stock != null) {
        await manager.query(
          `UPDATE classified_listings SET "commerceConfig"=$2::jsonb,"updatedAt"=now() WHERE id=$1`,
          [listing.id, JSON.stringify(this.withStock(listing.commerceConfig, stock - quantity))],
        );
      }

      const plan = await this.deliveryEntitlements.companyPlan(listing.companyId);
      const feeRule = await this.deliverySales.resolveFeeRule(listing.companyId, plan);
      if (!feeRule) throw new BadRequestException('A comissão de vendas online ainda não foi configurada para esta empresa.');

      const unitPriceCents = this.toCents(unitPrice);
      const itemSubtotalCents = unitPriceCents * quantity;
      const shippingCents = Math.max(0, Number(quote.amountCents || 0));
      const deliveryPartnerPayableCents = Math.max(0, Number(quote.partnerPayableCents || shippingCents));
      const buyerFeeCents = 0;
      const platformFeeCents = this.deliverySales.calculatePlatformFee(itemSubtotalCents, feeRule);
      const applicationFeeCents = platformFeeCents + shippingCents;
      const totalCents = itemSubtotalCents + shippingCents + buyerFeeCents;
      const sellerNetCents = Math.max(0, itemSubtotalCents - platformFeeCents);
      if (applicationFeeCents > totalCents) throw new BadRequestException('A composição financeira deste pedido é inválida.');
      const baseCurrent = pricing.currentPrice == null ? Number(unitPrice) : Number(pricing.currentPrice);
      const discountCents = Math.max(0, this.toCents(baseCurrent) * quantity - itemSubtotalCents);
      const expiresAt = new Date(Date.now() + (method === 'PIX' ? 35 * 60_000 : 24 * 60 * 60_000));
      const note = String(body?.fulfillmentData?.note || '').trim().slice(0, 500) || null;
      const deliveryAddressSnapshot = this.addressSnapshot(address);
      const fulfillmentLocationSnapshot = this.addressSnapshot(origin);
      const deliveryQuoteSnapshot = {
        id: quote.id,
        partnerId: quote.partnerId,
        partnerName: quote.partnerName || null,
        partnerType: quote.partnerType || null,
        rateTableId: quote.rateTableId,
        rateRuleId: quote.rateRuleId,
        amountCents: shippingCents,
        partnerPayableCents: deliveryPartnerPayableCents,
        estimatedMinutes: quote.estimatedMinutes == null ? null : Number(quote.estimatedMinutes),
        distanceMeters: quote.distanceMeters == null ? null : Number(quote.distanceMeters),
        mode: quote.mode,
        quoteSnapshot: quote.quoteSnapshot || null,
      };
      const paymentFinancialSnapshot = {
        currency: 'BRL',
        itemSubtotalCents,
        shippingCents,
        buyerFeeCents,
        totalCents,
        platformFeeCents,
        applicationFeeCents,
        sellerNetCents,
        deliveryPartnerPayableCents,
        feeRule: { ...feeRule, plan },
      };

      const orderRows = await manager.query(
        `INSERT INTO classified_orders(
          "companyId","listingId","buyerUserId",quantity,"unitPriceCents","discountCents","totalCents",
          "platformFeeCents","sellerNetCents","paymentProvider","paymentMethod","paymentStatus",status,
          "fulfillmentMode","fulfillmentData","idempotencyKey","termsVersion","stockReserved","expiresAt",metadata,
          "itemSubtotalCents","shippingCents","buyerFeeCents","applicationFeeCents","deliveryPartnerPayableCents",
          "paymentFinancialSnapshot","deliveryQuoteSnapshot","deliveryAddressSnapshot","fulfillmentLocationSnapshot"
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,'MERCADO_PAGO',$10,'PENDING','CREATED','DELIVERY',$11::jsonb,$12,$13,$14,$15,$16::jsonb,
          $17,$18,$19,$20,$21,$22::jsonb,$23::jsonb,$24::jsonb,$25::jsonb
        ) RETURNING *`,
        [
          listing.companyId, listing.id, uid, quantity, unitPriceCents, discountCents, totalCents,
          platformFeeCents, sellerNetCents, method,
          JSON.stringify({ address: this.addressText(address), note, deliveryAddressId, deliveryQuoteId }),
          idempotencyKey, CLASSIFIEDS_PAYMENT_TERMS_VERSION, stock != null, expiresAt,
          JSON.stringify({ pricingSnapshot: pricing, feeRule: { ...feeRule, plan } }),
          itemSubtotalCents, shippingCents, buyerFeeCents, applicationFeeCents, deliveryPartnerPayableCents,
          JSON.stringify(paymentFinancialSnapshot), JSON.stringify(deliveryQuoteSnapshot),
          JSON.stringify(deliveryAddressSnapshot), JSON.stringify(fulfillmentLocationSnapshot),
        ],
      );
      const order = orderRows[0];
      await manager.query(
        `INSERT INTO classified_order_items("orderId","listingId",quantity,"unitPriceCents","discountCents","totalCents","titleSnapshot","listingSnapshot","stockReserved")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
         ON CONFLICT ("orderId","listingId") DO NOTHING`,
        [order.id, listing.id, quantity, unitPriceCents, discountCents, itemSubtotalCents, listing.title, JSON.stringify({ listingId: listing.id, title: listing.title, image: listing.image || null, pricing }), stock != null],
      ).catch(() => undefined);
      await manager.query(
        `UPDATE delivery_quotes SET status='SELECTED' WHERE id=$1 AND status IN ('QUOTED','SELECTED')`,
        [quote.id],
      );
      await manager.query(
        `INSERT INTO classified_order_events("orderId",type,"toStatus","actorUserId",metadata)
         VALUES ($1,'CHECKOUT_CREATED','CREATED',$2,$3::jsonb)`,
        [order.id, uid, JSON.stringify({ method, quantity, fulfillmentMode: 'DELIVERY', deliveryQuoteId })],
      ).catch(() => undefined);
      return { order, listing };
    });

    const credentials = await this.deliveryMarketplacePayments.sellerMercadoPagoCredentials(prepared.order.companyId);
    const platform = await this.platformMercadoPagoConfig();
    const providerPayload = this.paymentPayload(prepared.order, prepared.listing, buyer, method, body, platform.publicApiBaseUrl);
    let providerResult: { ok: boolean; status: number; data: any } | null = null;
    try {
      providerResult = await this.callMercadoPagoPayment(credentials.accessToken, idempotencyKey, providerPayload);
    } catch (requestError: any) {
      await this.deliveryDataSource.query(
        `UPDATE classified_orders SET "paymentStatus"='IN_PROCESS',"providerStatusDetail"=$2,"updatedAt"=now() WHERE id=$1`,
        [prepared.order.id, String(requestError?.message || requestError || 'Falha temporária no provedor').slice(0, 160)],
      ).catch(() => undefined);
      return this.orderById(prepared.order.id, {
        processing: true,
        message: 'O Mercado Pago ainda está processando a criação do pagamento. Não tente pagar novamente; acompanhe em Minhas compras.',
      });
    }

    if (!providerResult.ok) {
      const ambiguous = providerResult.status >= 500;
      if (ambiguous) {
        await this.deliveryDataSource.query(
          `UPDATE classified_orders SET "paymentStatus"='IN_PROCESS',"providerStatusDetail"=$2,"updatedAt"=now() WHERE id=$1`,
          [prepared.order.id, String(providerResult.data?.message || providerResult.data?.error || `HTTP ${providerResult.status}`).slice(0, 160)],
        );
        return this.orderById(prepared.order.id, {
          processing: true,
          message: 'O provedor está processando a solicitação. Não tente pagar duas vezes.',
        });
      }
      await this.releaseStock(prepared.order.id, 'PAYMENT_REJECTED');
      await this.deliveryDataSource.query(
        `UPDATE classified_orders SET "paymentStatus"='REJECTED',"providerStatusDetail"=$2,"updatedAt"=now() WHERE id=$1`,
        [prepared.order.id, String(providerResult.data?.message || providerResult.data?.error || `HTTP ${providerResult.status}`).slice(0, 160)],
      );
      throw new BadRequestException(this.providerError(providerResult.data));
    }

    await this.applyInitialProviderPayment(prepared.order.id, providerResult.data || {});
    return this.orderById(prepared.order.id);
  }

  private async applyInitialProviderPayment(orderId: string, payment: any) {
    const beforeRows = await this.deliveryDataSource.query(`SELECT * FROM classified_orders WHERE id=$1 LIMIT 1`, [orderId]);
    const before = beforeRows[0];
    if (!before) return;
    const mapped = this.mapPaymentStatus(payment?.status);
    if (['REJECTED','CANCELED'].includes(mapped)) await this.releaseStock(orderId, `PROVIDER_${mapped}`);
    if (mapped === 'APPROVED') await this.deliveryDataSource.query(`UPDATE classified_orders SET "stockReserved"=false WHERE id=$1`, [orderId]);
    const pix = payment?.point_of_interaction?.transaction_data || {};
    const metadata = {
      mercadoPago: {
        status: payment?.status || null,
        statusDetail: payment?.status_detail || null,
        paymentTypeId: payment?.payment_type_id || null,
        paymentMethodId: payment?.payment_method_id || null,
        pixCopyPaste: pix.qr_code || null,
        pixQrCodeBase64: pix.qr_code_base64 || null,
        ticketUrl: pix.ticket_url || null,
      },
    };
    const nextOrderStatus = mapped === 'APPROVED' ? 'PAID' : before.status;
    await this.deliveryDataSource.query(
      `UPDATE classified_orders SET
        "providerPaymentId"=COALESCE($2,"providerPaymentId"),"paymentStatus"=$3,status=$4,
        "providerStatusDetail"=$5,"paidAt"=CASE WHEN $3='APPROVED' THEN COALESCE("paidAt",now()) ELSE "paidAt" END,
        metadata=COALESCE(metadata,'{}'::jsonb) || $6::jsonb,"updatedAt"=now()
       WHERE id=$1`,
      [orderId, payment?.id == null ? null : String(payment.id), mapped, nextOrderStatus, String(payment?.status_detail || '').slice(0, 160) || null, JSON.stringify(metadata)],
    );
    await this.deliveryDataSource.query(
      `INSERT INTO classified_order_events("orderId",type,"fromStatus","toStatus",metadata)
       VALUES ($1,'PAYMENT_RESPONSE',$2,$3,$4::jsonb)`,
      [orderId, before.paymentStatus, mapped, JSON.stringify({ providerId: payment?.id || null })],
    ).catch(() => undefined);
  }

  private async releaseStock(orderId: string, reason: string) {
    await this.deliveryDataSource.transaction(async (manager) => {
      const rows = await manager.query(`SELECT * FROM classified_orders WHERE id=$1 FOR UPDATE`, [orderId]);
      const order = rows[0];
      if (!order?.stockReserved) return;
      const listings = await manager.query(`SELECT * FROM classified_listings WHERE id=$1 FOR UPDATE`, [order.listingId]);
      const listing = listings[0];
      const stock = this.stockQuantity(listing?.commerceConfig);
      if (listing && stock != null) {
        await manager.query(
          `UPDATE classified_listings SET "commerceConfig"=$2::jsonb,"updatedAt"=now() WHERE id=$1`,
          [listing.id, JSON.stringify(this.withStock(listing.commerceConfig, stock + Number(order.quantity || 1)))],
        );
      }
      await manager.query(`UPDATE classified_orders SET "stockReserved"=false,"updatedAt"=now() WHERE id=$1`, [orderId]);
      await manager.query(`UPDATE classified_order_items SET "stockReserved"=false WHERE "orderId"=$1`, [orderId]).catch(() => undefined);
      await manager.query(
        `INSERT INTO classified_order_events("orderId",type,metadata) VALUES ($1,'STOCK_RELEASED',$2::jsonb)`,
        [orderId, JSON.stringify({ reason })],
      ).catch(() => undefined);
    });
  }

  private paymentPayload(order: any, listing: any, buyer: any, method: CheckoutMethod, input: Record<string, any>, configuredApiBase?: string) {
    const amount = Number(order.totalCents) / 100;
    const fee = Number(order.applicationFeeCents ?? order.platformFeeCents) / 100;
    const publicApiBase = String(configuredApiBase || process.env.PUBLIC_API_ORIGIN || process.env.PUBLIC_API_URL || 'https://piranegocios.com.br/api').replace(/\/$/, '');
    const common: Record<string, any> = {
      transaction_amount: amount,
      application_fee: fee,
      description: String(listing.title || 'Compra PiraNegócios').slice(0, 250),
      external_reference: order.id,
      notification_url: `${publicApiBase}/classifieds/payments/mercado-pago/webhook`,
      payer: { email: String(buyer.email) },
      metadata: { classified_order_id: order.id, listing_id: listing.id, platform: 'PIRANEGOCIOS', shipping_cents: Number(order.shippingCents || 0) },
    };
    if (method === 'PIX') return { ...common, payment_method_id: 'pix', date_of_expiration: new Date(Date.now() + 30 * 60_000).toISOString() };
    const token = String(input.token || input.formData?.token || '').trim();
    const paymentMethodId = String(input.paymentMethodId || input.formData?.payment_method_id || '').trim();
    const issuerId = String(input.issuerId || input.formData?.issuer_id || '').trim();
    const installments = Math.max(1, Math.min(24, Math.floor(Number(input.installments || input.formData?.installments || 1))));
    if (!token || !paymentMethodId) throw new BadRequestException('O Mercado Pago não retornou token/cartão válido. Tente novamente.');
    const identification = input.payer?.identification || input.formData?.payer?.identification;
    return {
      ...common, token, payment_method_id: paymentMethodId, ...(issuerId ? { issuer_id: issuerId } : {}), installments,
      payer: {
        email: String(buyer.email),
        ...(identification?.type && identification?.number ? { identification: { type: String(identification.type), number: String(identification.number).replace(/\D/g, '').slice(0, 32) } } : {}),
      },
    };
  }

  private async callMercadoPagoPayment(accessToken: string, idempotencyKey: string, payload: Record<string, any>) {
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', accept: 'application/json', 'X-Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25_000),
    });
    const text = await response.text();
    let data: any = {};
    try { data = JSON.parse(text || '{}'); } catch { data = { message: text.slice(0, 500) }; }
    return { ok: response.ok, status: response.status, data };
  }

  private async orderById(orderId: string, extra: Record<string, unknown> = {}) {
    const rows = await this.deliveryDataSource.query(
      `SELECT o.*,l.title,l.slug,i.url AS image,c.name AS "companyName"
       FROM classified_orders o JOIN classified_listings l ON l.id=o."listingId" JOIN companies c ON c.id=o."companyId"
       LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder","createdAt" LIMIT 1) i ON true
       WHERE o.id=$1 LIMIT 1`,
      [orderId],
    );
    if (!rows[0]) throw new NotFoundException('Pedido não encontrado.');
    return { ...this.presentOrder(rows[0]), ...extra };
  }

  private presentOrder(row: any) {
    const mp = row.metadata?.mercadoPago || {};
    return {
      id: row.id, listingId: row.listingId, title: row.title, slug: row.slug, image: row.image || null, companyName: row.companyName,
      quantity: Number(row.quantity || 1), unitPriceCents: Number(row.unitPriceCents || 0), discountCents: Number(row.discountCents || 0),
      itemSubtotalCents: Number(row.itemSubtotalCents ?? row.totalCents ?? 0), shippingCents: Number(row.shippingCents || 0), totalCents: Number(row.totalCents || 0),
      paymentProvider: row.paymentProvider, paymentMethod: row.paymentMethod, paymentStatus: row.paymentStatus, providerStatusDetail: row.providerStatusDetail || null,
      status: row.status, fulfillmentMode: row.fulfillmentMode, fulfillmentData: row.fulfillmentData || null,
      deliveryQuoteSnapshot: row.deliveryQuoteSnapshot || null, deliveryAddressSnapshot: row.deliveryAddressSnapshot || null,
      createdAt: row.createdAt, updatedAt: row.updatedAt, expiresAt: row.expiresAt || null,
      pix: row.paymentMethod === 'PIX' ? { copyPaste: mp.pixCopyPaste || null, qrCodeBase64: mp.pixQrCodeBase64 || null, ticketUrl: mp.ticketUrl || null } : null,
    };
  }

  private assertListing(uid: string, listing: any) {
    if (!listing || listing.status !== 'PUBLISHED') throw new NotFoundException('Produto não encontrado ou indisponível.');
    if (listing.listingType !== 'PRODUCT' || !listing.companyId) throw new BadRequestException('Compra online está disponível somente para produtos Business.');
    if (listing.commerceConfig?.onlineCheckout?.enabled !== true) throw new BadRequestException('Este produto não está habilitado para compra online.');
    if (listing.sellerUserId === uid) throw new BadRequestException('Você não pode comprar o próprio anúncio.');
  }

  private assertQuoteItems(quote: any, listingId: string, quantity: number) {
    const items = Array.isArray(quote?.inputSnapshot?.aggregate?.items) ? quote.inputSnapshot.aggregate.items : [];
    if (items.length !== 1 || String(items[0]?.listingId || '') !== listingId || Number(items[0]?.quantity || 0) !== quantity) {
      throw new BadRequestException('A quantidade mudou depois do cálculo do frete. Calcule novamente.');
    }
  }

  private fulfillmentModes(listing: any) {
    const declared = Array.isArray(listing.deliveryModes) ? listing.deliveryModes : [];
    const checkout = Array.isArray(listing.commerceConfig?.onlineCheckout?.fulfillmentModes) ? listing.commerceConfig.onlineCheckout.fulfillmentModes : [];
    const raw = checkout.length ? checkout : declared.length ? declared : ['ARRANGE'];
    return [...new Set(raw.map((item: unknown) => String(item).toUpperCase()).filter((item: string) => ['ARRANGE','PICKUP','DELIVERY'].includes(item)))];
  }

  private stockQuantity(config: any): number | null {
    const value = config?.onlineCheckout?.stockQuantity;
    if (value === null || value === undefined || value === '') return null;
    const number = Math.floor(Number(value));
    return Number.isFinite(number) ? Math.max(0, number) : null;
  }

  private withStock(configRaw: any, stockQuantity: number) {
    const config = configRaw && typeof configRaw === 'object' ? structuredClone(configRaw) : {};
    config.onlineCheckout = config.onlineCheckout && typeof config.onlineCheckout === 'object' ? config.onlineCheckout : {};
    config.onlineCheckout.stockQuantity = Math.max(0, Math.floor(stockQuantity));
    return config;
  }

  private addressSnapshot(row: any) {
    return { id: row.id || null, label: row.label || row.name || null, zipCode: row.zipCode || null, street: row.street || null, number: row.number || null, complement: row.complement || null, neighborhood: row.neighborhood || null, city: row.city || null, state: row.state || null, placeId: row.placeId || null, latitude: row.latitude == null ? null : Number(row.latitude), longitude: row.longitude == null ? null : Number(row.longitude) };
  }

  private addressText(row: any) {
    return `${row.street || ''}, ${row.number || ''}${row.complement ? ` · ${row.complement}` : ''} · ${row.neighborhood || ''} · ${row.city || ''}/${row.state || ''} · ${row.zipCode || ''}`.slice(0, 500);
  }

  private paymentMethod(value: unknown): CheckoutMethod {
    const method = String(value || '').trim().toUpperCase();
    if (!['PIX','CARD'].includes(method)) throw new BadRequestException('Forma de pagamento inválida.');
    return method as CheckoutMethod;
  }

  private quantity(value: unknown) {
    const valueNumber = Math.floor(Number(value || 1));
    if (!Number.isFinite(valueNumber) || valueNumber < 1 || valueNumber > 50) throw new BadRequestException('Quantidade inválida.');
    return valueNumber;
  }

  private idempotencyKey(value: unknown) {
    const key = String(value || '').trim();
    if (!/^[A-Za-z0-9_-]{16,120}$/.test(key)) throw new BadRequestException('Chave de idempotência inválida.');
    return key;
  }

  private uuid(value: unknown, message: string) {
    const id = String(value || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new BadRequestException(message);
    return id;
  }

  private toCents(value: unknown) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new BadRequestException('Preço inválido para checkout.');
    return Math.round(number * 100);
  }

  private mapPaymentStatus(value: unknown) {
    const status = String(value || '').toLowerCase();
    if (status === 'approved') return 'APPROVED';
    if (status === 'rejected') return 'REJECTED';
    if (status === 'cancelled' || status === 'canceled') return 'CANCELED';
    if (status === 'refunded') return 'REFUNDED';
    if (status === 'in_process' || status === 'in_mediation' || status === 'authorized') return 'IN_PROCESS';
    return 'PENDING';
  }

  private providerError(data: any) {
    const cause = Array.isArray(data?.cause) ? data.cause[0] : null;
    return String(cause?.description || data?.message || data?.error || 'O Mercado Pago recusou o pagamento.').slice(0, 500);
  }

  private async platformMercadoPagoConfig() {
    return this.deliveryProviderConfig.getSecretConfig<MercadoPagoProviderConfig>('MERCADO_PAGO');
  }
}
