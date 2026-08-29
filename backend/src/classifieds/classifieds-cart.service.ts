import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MercadoPagoProviderConfig, PaymentProviderConfigService } from '../payments/payment-provider-config.service';
import { classifiedsCommerceFeatureFlags } from './classifieds-commerce-feature-flags';
import { ClassifiedsCheckoutService } from './classifieds-checkout.service';
import { ClassifiedsMarketplacePaymentsService } from './classifieds-marketplace-payments.service';
import { CLASSIFIEDS_PAYMENT_TERMS_VERSION, ClassifiedsMarketplaceTermsService } from './classifieds-marketplace-terms.service';
import { ClassifiedsSalesService } from './classifieds-sales.service';

type CartPaymentMethod = 'PIX' | 'CARD';

@Injectable()
export class ClassifiedsCartService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly marketplacePayments: ClassifiedsMarketplacePaymentsService,
    private readonly providerConfig: PaymentProviderConfigService,
    private readonly sales: ClassifiedsSalesService,
    private readonly terms: ClassifiedsMarketplaceTermsService,
    private readonly checkout: ClassifiedsCheckoutService,
  ) {}

  async current(uid: string) {
    this.assertEnabled();
    const rows = await this.dataSource.query(`SELECT * FROM classified_carts WHERE "buyerUserId"=$1 AND status='ACTIVE' LIMIT 1`, [uid]);
    if (!rows[0]) return { cart: null, items: [], totals: { quantity: 0, subtotalCents: 0 } };
    return this.presentCart(rows[0]);
  }

  async add(uid: string, listingId: string, quantityRaw: unknown, replaceOtherCompany = false) {
    this.assertEnabled();
    const quantity = this.quantity(quantityRaw);
    const listingRows = await this.dataSource.query(
      `SELECT l.*,c.name AS "companyName" FROM classified_listings l JOIN companies c ON c.id=l."companyId" WHERE l.id=$1 LIMIT 1`,
      [listingId],
    );
    const listing = listingRows[0];
    this.assertCartListing(uid, listing);
    return this.dataSource.transaction(async (manager) => {
      const carts = await manager.query(`SELECT * FROM classified_carts WHERE "buyerUserId"=$1 AND status='ACTIVE' FOR UPDATE`, [uid]);
      let cart = carts[0];
      if (cart && cart.companyId !== listing.companyId) {
        if (!replaceOtherCompany) {
          throw new BadRequestException({ code: 'CART_OTHER_COMPANY', message: 'Seu carrinho já possui itens de outra empresa. Conclua o pedido atual ou substitua o carrinho.', currentCompanyId: cart.companyId, requestedCompanyId: listing.companyId });
        }
        await manager.query(`UPDATE classified_carts SET status='ABANDONED',"updatedAt"=now() WHERE id=$1`, [cart.id]);
        cart = null;
      }
      if (!cart) {
        const created = await manager.query(`INSERT INTO classified_carts("buyerUserId","companyId",status,"fulfillmentMode") VALUES ($1,$2,'ACTIVE','PICKUP') RETURNING *`, [uid, listing.companyId]);
        cart = created[0];
      }
      await manager.query(
        `INSERT INTO classified_cart_items("cartId","listingId",quantity) VALUES ($1,$2,$3) ON CONFLICT ("cartId","listingId") DO UPDATE SET quantity=LEAST(999,classified_cart_items.quantity+EXCLUDED.quantity),"updatedAt"=now()`,
        [cart.id, listingId, quantity],
      );
      await manager.query(`UPDATE classified_carts SET "updatedAt"=now() WHERE id=$1`, [cart.id]);
      return this.presentCart(cart, manager);
    });
  }

  async setQuantity(uid: string, itemId: string, quantityRaw: unknown) {
    this.assertEnabled();
    const quantity = this.quantity(quantityRaw);
    const rows = await this.dataSource.query(
      `UPDATE classified_cart_items i SET quantity=$3,"updatedAt"=now()
       FROM classified_carts c WHERE i.id=$1 AND i."cartId"=c.id AND c."buyerUserId"=$2 AND c.status='ACTIVE' RETURNING i.*`,
      [itemId, uid, quantity],
    );
    if (!rows[0]) throw new NotFoundException('Item do carrinho não encontrado.');
    return this.current(uid);
  }

  async remove(uid: string, itemId: string) {
    this.assertEnabled();
    const rows = await this.dataSource.query(
      `DELETE FROM classified_cart_items i USING classified_carts c WHERE i.id=$1 AND i."cartId"=c.id AND c."buyerUserId"=$2 AND c.status='ACTIVE' RETURNING i.id`,
      [itemId, uid],
    );
    if (!rows[0]) throw new NotFoundException('Item do carrinho não encontrado.');
    return this.current(uid);
  }

  async clear(uid: string) {
    this.assertEnabled();
    await this.dataSource.query(`UPDATE classified_carts SET status='ABANDONED',"updatedAt"=now() WHERE "buyerUserId"=$1 AND status='ACTIVE'`, [uid]);
    return { cleared: true };
  }

  async selectFulfillment(uid: string, raw: Record<string, unknown>) {
    this.assertEnabled();
    const cart = await this.activeCart(uid);
    const mode = String(raw.fulfillmentMode || '').trim().toUpperCase();
    if (!['PICKUP','DELIVERY','ROUND_TRIP'].includes(mode)) throw new BadRequestException('Forma de recebimento inválida.');
    const addressId = String(raw.addressId || '').trim() || null;
    const quoteId = String(raw.quoteId || '').trim() || null;
    if (mode !== 'PICKUP') {
      if (!addressId || !quoteId) throw new BadRequestException('Selecione endereço e cotação para entrega.');
      const address = await this.dataSource.query(`SELECT id FROM delivery_addresses WHERE id=$1 AND "userId"=$2 AND active=true LIMIT 1`, [addressId, uid]);
      if (!address[0]) throw new BadRequestException('Endereço de entrega inválido.');
      const quote = await this.dataSource.query(`SELECT * FROM delivery_quotes WHERE id=$1 AND "buyerUserId"=$2 AND "companyId"=$3 AND eligible=true AND status IN ('QUOTED','SELECTED') AND "expiresAt">now() LIMIT 1`, [quoteId, uid, cart.companyId]);
      if (!quote[0] || quote[0].mode !== mode) throw new BadRequestException('Cotação expirada ou incompatível.');
      await this.dataSource.query(`UPDATE delivery_quotes SET status='SELECTED' WHERE id=$1`, [quoteId]);
    }
    const rows = await this.dataSource.query(`UPDATE classified_carts SET "fulfillmentMode"=$2,"selectedAddressId"=$3,"selectedQuoteId"=$4,"updatedAt"=now() WHERE id=$1 RETURNING *`, [cart.id, mode, mode === 'PICKUP' ? null : addressId, mode === 'PICKUP' ? null : quoteId]);
    return this.presentCart(rows[0]);
  }

  async paymentConfig(uid: string) {
    const cart = await this.activeCart(uid);
    await this.marketplacePayments.sellerMercadoPagoCredentials(cart.companyId);
    const platform = await this.platformMercadoPagoConfig();
    if (!platform.publicKey) throw new ServiceUnavailableException('Public Key do Mercado Pago não configurada.');
    const buyerRows = await this.dataSource.query(`SELECT email,"displayName","fullName","socialName" FROM users WHERE id=$1 LIMIT 1`, [uid]);
    const terms = await this.terms.status(uid);
    return { publicKey: platform.publicKey, provider: 'MERCADO_PAGO', paymentMethods: ['PIX','CARD'], buyer: { email: buyerRows[0]?.email || '', name: buyerRows[0]?.socialName || buyerRows[0]?.displayName || buyerRows[0]?.fullName || '' }, terms: { version: CLASSIFIEDS_PAYMENT_TERMS_VERSION, accepted: terms.buyerAccepted, url: terms.termsUrl }, cart: await this.presentCart(cart) };
  }

  async createPayment(uid: string, raw: Record<string, any>) {
    this.assertEnabled();
    await this.terms.assertAccepted(uid, 'ONLINE_PAYMENT_BUYER');
    const method = this.paymentMethod(raw.paymentMethod);
    const idempotencyKey = this.idempotencyKey(raw.idempotencyKey);
    const previous = await this.dataSource.query(`SELECT id,"buyerUserId","cartId" FROM classified_orders WHERE "idempotencyKey"=$1 LIMIT 1`, [idempotencyKey]).catch(() => []);
    if (previous[0]) {
      if (previous[0].buyerUserId !== uid) throw new BadRequestException('Chave de idempotência já usada em outra compra.');
      return this.order(previous[0].id);
    }
    const buyerRows = await this.dataSource.query(`SELECT id,email,"displayName","fullName","socialName" FROM users WHERE id=$1 LIMIT 1`, [uid]);
    const buyer = buyerRows[0];
    if (!buyer?.email) throw new BadRequestException('Sua conta precisa ter e-mail válido para o pagamento online.');

    const prepared = await this.dataSource.transaction(async (manager) => {
      const carts = await manager.query(`SELECT * FROM classified_carts WHERE "buyerUserId"=$1 AND status='ACTIVE' FOR UPDATE`, [uid]);
      const cart = carts[0];
      if (!cart) throw new BadRequestException('Seu carrinho está vazio.');
      const itemRows = await manager.query(
        `SELECT i.id AS "cartItemId",i.quantity,l.*,c.name AS "companyName",img.url AS image
         FROM classified_cart_items i JOIN classified_listings l ON l.id=i."listingId" JOIN companies c ON c.id=l."companyId"
         LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder","createdAt" LIMIT 1) img ON true
         WHERE i."cartId"=$1 ORDER BY i."createdAt" FOR UPDATE OF i,l`,
        [cart.id],
      );
      if (!itemRows.length) throw new BadRequestException('Seu carrinho está vazio.');
      if (itemRows.some((item: any) => item.companyId !== cart.companyId)) throw new BadRequestException('O carrinho contém produtos de empresas diferentes.');
      for (const item of itemRows) this.assertCartListing(uid, item);

      const plan = await this.salesCompanyPlan(cart.companyId);
      const feeRule = await this.sales.resolveFeeRule(cart.companyId, plan);
      if (!feeRule) throw new BadRequestException('A comissão de vendas online ainda não foi configurada para esta empresa.');

      let itemSubtotalCents = 0;
      let discountCents = 0;
      let anyStockReserved = false;
      const items: any[] = [];
      for (const listing of itemRows) {
        const pricing = this.sales.effectivePricing(listing.price, listing.commerceConfig);
        const unitPrice = method === 'PIX' ? pricing.pixPrice : pricing.cardPrice;
        if (unitPrice == null || Number(unitPrice) <= 0) throw new BadRequestException(`Preço inválido para ${listing.title}.`);
        const unitPriceCents = this.toCents(unitPrice);
        const quantity = Number(listing.quantity);
        const totalCents = unitPriceCents * quantity;
        const base = pricing.currentPrice == null ? Number(unitPrice) : Number(pricing.currentPrice);
        const itemDiscountCents = Math.max(0, this.toCentsAllowZero(base) * quantity - totalCents);
        const stock = this.stockQuantity(listing.commerceConfig);
        if (stock != null && stock < quantity) throw new BadRequestException(`Estoque insuficiente para ${listing.title}.`);
        if (stock != null) {
          anyStockReserved = true;
          await manager.query(`UPDATE classified_listings SET "commerceConfig"=$2::jsonb,"updatedAt"=now() WHERE id=$1`, [listing.id, JSON.stringify(this.withStock(listing.commerceConfig, stock - quantity))]);
        }
        itemSubtotalCents += totalCents;
        discountCents += itemDiscountCents;
        items.push({ listing, quantity, unitPriceCents, totalCents, discountCents: itemDiscountCents, pricing, stockReserved: stock != null });
      }

      let shippingCents = 0;
      let deliveryPartnerPayableCents = 0;
      let deliveryQuoteSnapshot: any = null;
      let deliveryAddressSnapshot: any = null;
      let fulfillmentLocationSnapshot: any = null;
      if (cart.fulfillmentMode === 'PICKUP') {
        const locations = await manager.query(`SELECT * FROM company_fulfillment_locations WHERE "companyId"=$1 AND active=true AND "allowsPickup"=true ORDER BY "isDefaultPickup" DESC,"createdAt" LIMIT 1`, [cart.companyId]);
        if (!locations[0]) throw new BadRequestException('A empresa ainda não configurou local de retirada.');
        fulfillmentLocationSnapshot = this.addressSnapshot(locations[0]);
      } else {
        const quotes = await manager.query(`SELECT q.*,p.name AS "partnerName",p.type AS "partnerType" FROM delivery_quotes q LEFT JOIN delivery_partners p ON p.id=q."partnerId" WHERE q.id=$1 AND q."buyerUserId"=$2 AND q."companyId"=$3 AND q.status IN ('QUOTED','SELECTED') AND q."expiresAt">now() LIMIT 1`, [cart.selectedQuoteId, uid, cart.companyId]);
        const quote = quotes[0];
        if (!quote || quote.mode !== cart.fulfillmentMode) throw new BadRequestException('Sua cotação de entrega expirou. Calcule novamente.');
        const addressRows = await manager.query(`SELECT * FROM delivery_addresses WHERE id=$1 AND "userId"=$2 AND active=true LIMIT 1`, [cart.selectedAddressId, uid]);
        const originRows = await manager.query(`SELECT * FROM company_fulfillment_locations WHERE id=$1 AND "companyId"=$2 AND active=true LIMIT 1`, [quote.originLocationId, cart.companyId]);
        if (!addressRows[0] || !originRows[0]) throw new BadRequestException('Endereço ou origem da entrega não está mais disponível.');
        shippingCents = Number(quote.amountCents);
        deliveryPartnerPayableCents = Number(quote.partnerPayableCents);
        deliveryQuoteSnapshot = { id: quote.id, partnerId: quote.partnerId, partnerName: quote.partnerName || null, partnerType: quote.partnerType || null, rateTableId: quote.rateTableId, rateRuleId: quote.rateRuleId, amountCents: shippingCents, partnerPayableCents: deliveryPartnerPayableCents, estimatedMinutes: quote.estimatedMinutes, distanceMeters: quote.distanceMeters, mode: quote.mode, quoteSnapshot: quote.quoteSnapshot };
        deliveryAddressSnapshot = this.addressSnapshot(addressRows[0]);
        fulfillmentLocationSnapshot = this.addressSnapshot(originRows[0]);
      }

      const buyerFeeCents = 0;
      const platformFeeCents = this.sales.calculatePlatformFee(itemSubtotalCents, feeRule);
      const applicationFeeCents = platformFeeCents + shippingCents;
      const totalCents = itemSubtotalCents + shippingCents + buyerFeeCents;
      if (applicationFeeCents > totalCents) throw new BadRequestException('A composição financeira deste pedido é inválida.');
      const sellerNetCents = Math.max(0, itemSubtotalCents - platformFeeCents);
      const first = items[0];
      const expiresAt = new Date(Date.now() + (method === 'PIX' ? 35 * 60_000 : 24 * 60 * 60_000));
      const financialSnapshot = { itemSubtotalCents, shippingCents, buyerFeeCents, totalCents, platformCommissionCents: platformFeeCents, applicationFeeCents, sellerNetCents, deliveryPartnerPayableCents, feeRule: { ...feeRule, plan }, createdAt: new Date().toISOString() };

      const orderRows = await manager.query(
        `INSERT INTO classified_orders("companyId","listingId","buyerUserId",quantity,"unitPriceCents","discountCents","totalCents","platformFeeCents","sellerNetCents","paymentProvider","paymentMethod","paymentStatus",status,"fulfillmentMode","fulfillmentData","idempotencyKey","termsVersion","stockReserved","expiresAt",metadata,"cartId","itemSubtotalCents","shippingCents","buyerFeeCents","applicationFeeCents","deliveryPartnerPayableCents","paymentFinancialSnapshot","deliveryQuoteSnapshot","deliveryAddressSnapshot","fulfillmentLocationSnapshot") VALUES ($1,$2,$3,1,$4,$5,$6,$7,$8,'MERCADO_PAGO',$9,'PENDING','CREATED',$10,$11::jsonb,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,$20,$21,$22,$23::jsonb,$24::jsonb,$25::jsonb,$26::jsonb) RETURNING *`,
        [cart.companyId, first.listing.id, uid, itemSubtotalCents, discountCents, totalCents, platformFeeCents, sellerNetCents, method, cart.fulfillmentMode, JSON.stringify({ address: deliveryAddressSnapshot, pickup: fulfillmentLocationSnapshot }), idempotencyKey, CLASSIFIEDS_PAYMENT_TERMS_VERSION, anyStockReserved, expiresAt, JSON.stringify({ cartCheckout: true }), cart.id, itemSubtotalCents, shippingCents, buyerFeeCents, applicationFeeCents, deliveryPartnerPayableCents, JSON.stringify(financialSnapshot), JSON.stringify(deliveryQuoteSnapshot), JSON.stringify(deliveryAddressSnapshot), JSON.stringify(fulfillmentLocationSnapshot)],
      );
      const order = orderRows[0];
      for (const item of items) {
        await manager.query(`INSERT INTO classified_order_items("orderId","listingId",quantity,"unitPriceCents","discountCents","totalCents","titleSnapshot","listingSnapshot","stockReserved") VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`, [order.id, item.listing.id, item.quantity, item.unitPriceCents, item.discountCents, item.totalCents, item.listing.title, JSON.stringify({ id: item.listing.id, title: item.listing.title, slug: item.listing.slug, image: item.listing.image || null, pricing: item.pricing }), item.stockReserved]);
      }
      await manager.query(`INSERT INTO classified_order_events("orderId",type,"toStatus","actorUserId",metadata) VALUES ($1,'CART_CHECKOUT_CREATED','CREATED',$2,$3::jsonb)`, [order.id, uid, JSON.stringify({ cartId: cart.id, itemCount: items.length, fulfillmentMode: cart.fulfillmentMode })]);
      if (cart.selectedQuoteId) await manager.query(`UPDATE delivery_quotes SET status='SELECTED' WHERE id=$1`, [cart.selectedQuoteId]);
      await manager.query(`UPDATE classified_carts SET metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object('pendingOrderId',$2::text),"updatedAt"=now() WHERE id=$1`, [cart.id, order.id]);
      return { order, firstListing: first.listing, financialSnapshot };
    });

    const credentials = await this.marketplacePayments.sellerMercadoPagoCredentials(prepared.order.companyId);
    const platform = await this.platformMercadoPagoConfig();
    const payload = this.paymentPayload(prepared.order, buyer, method, raw, platform.publicApiBaseUrl);
    const response = await this.callMercadoPago(credentials.accessToken, idempotencyKey, payload).catch(() => null);
    if (!response) {
      await this.dataSource.query(`UPDATE classified_orders SET "paymentStatus"='IN_PROCESS',"providerStatusDetail"='mercado_pago_request_ambiguous',"updatedAt"=now() WHERE id=$1`, [prepared.order.id]).catch(() => undefined);
      return this.order(prepared.order.id, { processing: true });
    }
    if (!response.ok) {
      const ambiguous = response.status >= 500;
      if (!ambiguous) await this.checkout.releaseReservedStock(prepared.order.id, 'CART_PAYMENT_REJECTED');
      await this.dataSource.query(`UPDATE classified_orders SET "paymentStatus"=$2,"providerStatusDetail"=$3,"updatedAt"=now() WHERE id=$1`, [prepared.order.id, ambiguous ? 'IN_PROCESS' : 'REJECTED', String(response.data?.message || response.data?.error || `HTTP ${response.status}`).slice(0,160)]);
      if (!ambiguous) throw new BadRequestException(String(response.data?.message || response.data?.error || 'O Mercado Pago recusou o pagamento.').slice(0,500));
      return this.order(prepared.order.id, { processing: true });
    }
    await this.checkout.reconcilePayment(prepared.order.id, response.data || {}, 'CHECKOUT_RESPONSE');
    return this.order(prepared.order.id);
  }

  async order(orderId: string, extra: Record<string, unknown> = {}) {
    const rows = await this.dataSource.query(`SELECT o.*,c.name AS "companyName" FROM classified_orders o JOIN companies c ON c.id=o."companyId" WHERE o.id=$1 LIMIT 1`, [orderId]);
    if (!rows[0]) throw new NotFoundException('Pedido não encontrado.');
    const items = await this.dataSource.query(`SELECT * FROM classified_order_items WHERE "orderId"=$1 ORDER BY "createdAt",id`, [orderId]);
    return { ...rows[0], items, ...extra };
  }

  private async presentCart(cart: any, manager?: { query: (sql: string, params?: unknown[]) => Promise<any[]> }) {
    const query = manager?.query.bind(manager) || this.dataSource.query.bind(this.dataSource);
    const items = await query(
      `SELECT i.id AS "cartItemId",i.quantity,l.id AS "listingId",l.title,l.slug,l.price,l.status,l."companyId",l."commerceConfig",img.url AS image
       FROM classified_cart_items i JOIN classified_listings l ON l.id=i."listingId"
       LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder","createdAt" LIMIT 1) img ON true
       WHERE i."cartId"=$1 ORDER BY i."createdAt"`,
      [cart.id],
    );
    let subtotalCents = 0;
    let quantity = 0;
    const presented = items.map((item: any) => {
      const pricing = this.sales.effectivePricing(item.price, item.commerceConfig);
      const unitCents = pricing.currentPrice == null ? 0 : this.toCentsAllowZero(pricing.currentPrice);
      subtotalCents += unitCents * Number(item.quantity);
      quantity += Number(item.quantity);
      return { cartItemId: item.cartItemId, listingId: item.listingId, title: item.title, slug: item.slug, image: item.image || null, quantity: Number(item.quantity), available: item.status === 'PUBLISHED', pricing };
    });
    let selectedQuote: any = null;
    if (cart.selectedQuoteId) selectedQuote = (await query(`SELECT q.*,p.name AS "partnerName",p.type AS "partnerType" FROM delivery_quotes q LEFT JOIN delivery_partners p ON p.id=q."partnerId" WHERE q.id=$1 LIMIT 1`, [cart.selectedQuoteId]))[0] || null;
    return { cart, items: presented, selectedQuote, totals: { quantity, subtotalCents, shippingCents: Number(selectedQuote?.amountCents || 0), totalCents: subtotalCents + Number(selectedQuote?.amountCents || 0) } };
  }

  private async activeCart(uid: string) {
    const rows = await this.dataSource.query(`SELECT * FROM classified_carts WHERE "buyerUserId"=$1 AND status='ACTIVE' LIMIT 1`, [uid]);
    if (!rows[0]) throw new BadRequestException('Seu carrinho está vazio.');
    return rows[0];
  }

  private assertCartListing(uid: string, listing: any) {
    if (!listing || listing.status !== 'PUBLISHED' || listing.listingType !== 'PRODUCT' || !listing.companyId) throw new BadRequestException('Produto indisponível para carrinho.');
    if (listing.sellerUserId === uid) throw new BadRequestException('Você não pode comprar o próprio anúncio.');
    if (listing.commerceConfig?.onlineCheckout?.enabled !== true) throw new BadRequestException('Este produto não está habilitado para compra online.');
  }

  private async salesCompanyPlan(companyId: string): Promise<'FREE'|'PLUS'|'ELITE'> {
    const rows = await this.dataSource.query(`SELECT plan FROM company_subscriptions WHERE "companyId"=$1 AND status IN ('ACTIVE','TRIALING') ORDER BY "updatedAt" DESC LIMIT 1`, [companyId]).catch(() => []);
    const plan = String(rows[0]?.plan || 'FREE').toUpperCase();
    return ['FREE','PLUS','ELITE'].includes(plan) ? plan as 'FREE'|'PLUS'|'ELITE' : 'FREE';
  }

  private paymentPayload(order: any, buyer: any, method: CartPaymentMethod, input: Record<string, any>, configuredApiBase?: string) {
    const publicApiBase = String(configuredApiBase || process.env.PUBLIC_API_ORIGIN || process.env.PUBLIC_API_URL || 'https://piranegocios.com.br/api').replace(/\/$/, '');
    const common: Record<string, any> = { transaction_amount: Number(order.totalCents) / 100, application_fee: Number(order.applicationFeeCents || order.platformFeeCents || 0) / 100, description: 'Pedido PiraNegócios', external_reference: order.id, notification_url: `${publicApiBase}/classifieds/payments/mercado-pago/webhook`, payer: { email: String(buyer.email) }, metadata: { classified_order_id: order.id, cart_id: order.cartId, platform: 'PIRANEGOCIOS' } };
    if (method === 'PIX') return { ...common, payment_method_id: 'pix', date_of_expiration: new Date(Date.now() + 30 * 60_000).toISOString() };
    const token = String(input.token || input.formData?.token || '').trim();
    const paymentMethodId = String(input.paymentMethodId || input.formData?.payment_method_id || '').trim();
    const issuerId = String(input.issuerId || input.formData?.issuer_id || '').trim();
    const installments = Math.max(1, Math.min(24, Math.floor(Number(input.installments || input.formData?.installments || 1))));
    if (!token || !paymentMethodId) throw new BadRequestException('O Mercado Pago não retornou token/cartão válido.');
    const identification = input.payer?.identification || input.formData?.payer?.identification;
    return { ...common, token, payment_method_id: paymentMethodId, ...(issuerId ? { issuer_id: issuerId } : {}), installments, payer: { email: String(buyer.email), ...(identification?.type && identification?.number ? { identification: { type: String(identification.type), number: String(identification.number).replace(/\D/g,'').slice(0,32) } } : {}) } };
  }

  private async callMercadoPago(accessToken: string, idempotencyKey: string, payload: Record<string, unknown>) {
    const response = await fetch('https://api.mercadopago.com/v1/payments', { method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', accept: 'application/json', 'X-Idempotency-Key': idempotencyKey }, body: JSON.stringify(payload), signal: AbortSignal.timeout(25_000) });
    const text = await response.text();
    let data: any = {};
    try { data = JSON.parse(text || '{}'); } catch { data = { message: text.slice(0,500) }; }
    return { ok: response.ok, status: response.status, data };
  }

  private async platformMercadoPagoConfig() {
    return this.providerConfig.getSecretConfig<MercadoPagoProviderConfig>('MERCADO_PAGO');
  }

  private stockQuantity(config: any): number | null { const value = config?.onlineCheckout?.stockQuantity; if (value === null || value === undefined || value === '') return null; const n = Math.floor(Number(value)); return Number.isFinite(n) ? Math.max(0,n) : null; }
  private withStock(configRaw: any, stockQuantity: number) { const config = configRaw && typeof configRaw === 'object' ? structuredClone(configRaw) : {}; config.onlineCheckout = config.onlineCheckout && typeof config.onlineCheckout === 'object' ? config.onlineCheckout : {}; config.onlineCheckout.stockQuantity = Math.max(0,Math.floor(stockQuantity)); return config; }
  private addressSnapshot(row: any) { return { id: row.id || null, name: row.name || row.label || null, zipCode: row.zipCode || null, street: row.street || null, number: row.number || null, complement: row.complement || null, neighborhood: row.neighborhood || null, city: row.city || null, state: row.state || null, placeId: row.placeId || null, latitude: row.latitude == null ? null : Number(row.latitude), longitude: row.longitude == null ? null : Number(row.longitude), pickupInstructions: row.pickupInstructions || null }; }
  private quantity(value: unknown) { const n = Math.floor(Number(value || 1)); if (!Number.isFinite(n) || n < 1 || n > 999) throw new BadRequestException('Quantidade inválida.'); return n; }
  private paymentMethod(value: unknown): CartPaymentMethod { const method = String(value || '').trim().toUpperCase(); if (!['PIX','CARD'].includes(method)) throw new BadRequestException('Forma de pagamento inválida.'); return method as CartPaymentMethod; }
  private idempotencyKey(value: unknown) { const key = String(value || '').trim(); if (!/^[A-Za-z0-9_-]{16,120}$/.test(key)) throw new BadRequestException('Chave de idempotência inválida.'); return key; }
  private toCents(value: unknown) { const n = Number(value); if (!Number.isFinite(n) || n <= 0) throw new BadRequestException('Preço inválido.'); return Math.round(n * 100); }
  private toCentsAllowZero(value: unknown) { const n = Number(value); return Number.isFinite(n) ? Math.max(0,Math.round(n * 100)) : 0; }
  private assertEnabled() { if (!classifiedsCommerceFeatureFlags().cart) throw new BadRequestException('Carrinho ainda não está habilitado neste ambiente.'); }
}
