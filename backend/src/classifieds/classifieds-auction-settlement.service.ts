import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MercadoPagoProviderConfig, PaymentProviderConfigService } from '../payments/payment-provider-config.service';
import { ClassifiedsEntitlementsService } from './classifieds-entitlements.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedsMarketplacePaymentsService } from './classifieds-marketplace-payments.service';
import { CLASSIFIEDS_PAYMENT_TERMS_VERSION, ClassifiedsMarketplaceTermsService } from './classifieds-marketplace-terms.service';

@Injectable()
export class ClassifiedsAuctionSettlementService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: ClassifiedsIdentityService,
    private readonly entitlements: ClassifiedsEntitlementsService,
    private readonly marketplacePayments: ClassifiedsMarketplacePaymentsService,
    private readonly providerConfig: PaymentProviderConfigService,
    private readonly terms: ClassifiedsMarketplaceTermsService,
  ) {}

  async sellerConfig(uid: string, auctionId: string) {
    const auction = await this.assertSeller(uid, auctionId);
    const connected = await this.dataSource.query(
      `SELECT provider,status FROM company_classified_payment_connections
       WHERE "companyId"=$1 AND provider='MERCADO_PAGO' AND status='CONNECTED' LIMIT 1`,
      [auction.companyId],
    ).catch(() => []);
    const terms = await this.terms.status(uid);
    const plan = await this.entitlements.companyPlan(auction.companyId);
    const feeRule = await this.resolveAuctionFeeRule(auction.companyId, plan);
    return {
      auctionId,
      status: auction.status,
      onlinePaymentEnabled: auction.onlinePaymentEnabled === true,
      fulfillmentModes: this.fulfillmentModes(auction.fulfillmentModes),
      deliveryFeeCents: Number(auction.deliveryFeeCents || 0),
      deliveryNote: auction.deliveryNote || null,
      paymentConnected: Boolean(connected[0]),
      sellerTermsAccepted: terms.sellerAccepted === true,
      plan,
      feeRule,
      finalAmount: auction.finalAmount == null ? null : Number(auction.finalAmount),
      winnerUserId: auction.winnerUserId || null,
      paymentStatus: auction.settlementPaymentStatus || 'NOT_STARTED',
      orderId: auction.settlementOrderId || null,
    };
  }

  async configureSeller(uid: string, auctionId: string, body: Record<string, unknown>) {
    const auction = await this.assertSeller(uid, auctionId);
    const enabled = body.onlinePaymentEnabled === true;
    const modes = this.cleanModes(body.fulfillmentModes);
    const feeCents = this.cents(body.deliveryFeeCents, 2_000_000, 'Valor de entrega inválido.');
    const deliveryNote = String(body.deliveryNote || '').trim().slice(0, 1200) || null;

    if (auction.settlementOrderId && ['PENDING','IN_PROCESS','APPROVED'].includes(String(auction.settlementPaymentStatus))) {
      throw new BadRequestException('As condições do recebimento não podem ser alteradas depois que o pagamento foi iniciado.');
    }

    if (enabled) {
      await this.terms.assertAccepted(uid, 'ONLINE_PAYMENT_SELLER');
      const companyRows = await this.dataSource.query(
        `SELECT "isVerified","verificationStatus" FROM companies WHERE id=$1 LIMIT 1`,
        [auction.companyId],
      );
      const company = companyRows[0];
      if (!company || !(company.isVerified || company.verificationStatus === 'VERIFIED')) {
        throw new ForbiddenException('Somente empresas verificadas podem receber arremates online.');
      }
      await this.marketplacePayments.sellerMercadoPagoCredentials(auction.companyId);
      const plan = await this.entitlements.companyPlan(auction.companyId);
      const feeRule = await this.resolveAuctionFeeRule(auction.companyId, plan);
      if (!feeRule) throw new BadRequestException('A taxa de leilão ainda não foi configurada no Admin.');
    }

    await this.dataSource.query(
      `UPDATE classified_auctions SET
         "onlinePaymentEnabled"=$2,
         "fulfillmentModes"=$3::jsonb,
         "deliveryFeeCents"=$4,
         "deliveryNote"=$5,
         "paymentConfiguredAt"=CASE WHEN $2 THEN now() ELSE "paymentConfiguredAt" END,
         "updatedAt"=now()
       WHERE id=$1`,
      [auctionId, enabled, JSON.stringify(modes), feeCents, deliveryNote],
    );
    return this.sellerConfig(uid, auctionId);
  }

  async buyerConfig(uid: string, auctionId: string) {
    const auction = await this.assertWinner(uid, auctionId);
    if (!auction.onlinePaymentEnabled) throw new BadRequestException('O anunciante não habilitou pagamento online para este arremate.');
    const credentials = await this.marketplacePayments.sellerMercadoPagoCredentials(auction.companyId);
    if (!credentials.accessToken) throw new ServiceUnavailableException('A conexão Mercado Pago do anunciante está indisponível.');
    const platform = await this.providerConfig.getSecretConfig<MercadoPagoProviderConfig>('MERCADO_PAGO');
    if (!platform.publicKey) throw new ServiceUnavailableException('A Public Key Mercado Pago do PiraNegócios não está configurada.');
    const buyerRows = await this.dataSource.query(
      `SELECT email,"displayName","fullName","socialName",address,city,state FROM users WHERE id=$1 LIMIT 1`,
      [uid],
    );
    const terms = await this.terms.status(uid);
    const amountCents = this.moneyToCents(auction.finalAmount);
    const deliveryFeeCents = Number(auction.deliveryFeeCents || 0);
    const existing = await this.orderForAuction(auctionId);
    return {
      auctionId,
      listing: { id: auction.listingId, title: auction.title, slug: auction.slug, image: auction.image || null },
      seller: { companyId: auction.companyId, name: auction.companyName },
      publicKey: platform.publicKey,
      amountCents,
      deliveryFeeCents,
      totalCents: amountCents + deliveryFeeCents,
      fulfillmentModes: this.fulfillmentModes(auction.fulfillmentModes),
      deliveryNote: auction.deliveryNote || null,
      buyer: {
        email: buyerRows[0]?.email || '',
        name: buyerRows[0]?.socialName || buyerRows[0]?.displayName || buyerRows[0]?.fullName || '',
        deliveryAddress: buyerRows[0]?.address || '',
      },
      terms: { version: CLASSIFIEDS_PAYMENT_TERMS_VERSION, accepted: terms.buyerAccepted === true },
      payment: existing ? this.presentOrder(existing) : null,
    };
  }

  async createPayment(uid: string, auctionId: string, body: Record<string, any>) {
    await this.terms.assertAccepted(uid, 'ONLINE_PAYMENT_BUYER');
    const method = this.paymentMethod(body.paymentMethod);
    const idempotencyKey = this.idempotencyKey(body.idempotencyKey);
    const auction = await this.assertWinner(uid, auctionId);
    if (!auction.onlinePaymentEnabled) throw new BadRequestException('O anunciante não habilitou pagamento online para este arremate.');
    const allowedModes = this.fulfillmentModes(auction.fulfillmentModes);
    const fulfillmentMode = this.fulfillmentMode(body.fulfillmentMode, allowedModes);
    const fulfillmentData = this.fulfillmentData(body.fulfillmentData);
    if (fulfillmentMode === 'DELIVERY' && !fulfillmentData.address) {
      throw new BadRequestException('Informe o endereço de entrega.');
    }

    const buyerRows = await this.dataSource.query(`SELECT id,email FROM users WHERE id=$1 LIMIT 1`, [uid]);
    const buyer = buyerRows[0];
    if (!buyer?.email) throw new BadRequestException('Sua conta precisa ter e-mail válido para pagar online.');

    const plan = await this.entitlements.companyPlan(auction.companyId);
    const feeRule = await this.resolveAuctionFeeRule(auction.companyId, plan);
    if (!feeRule) throw new BadRequestException('A taxa de leilão ainda não foi configurada.');
    const auctionAmountCents = this.moneyToCents(auction.finalAmount);
    const deliveryFeeCents = Number(auction.deliveryFeeCents || 0);
    const totalCents = auctionAmountCents + deliveryFeeCents;
    const platformFeeCents = this.calculateFee(auctionAmountCents, feeRule);
    const sellerNetCents = totalCents - platformFeeCents;

    let order = await this.orderForAuction(auctionId);
    if (order?.paymentStatus === 'APPROVED') return this.presentOrder(order);
    if (order && !['REJECTED','CANCELED','NOT_STARTED'].includes(String(order.paymentStatus))) {
      if (String(order.idempotencyKey || '') === idempotencyKey) return this.presentOrder(order);
      throw new BadRequestException('Já existe um pagamento em andamento para este arremate. Aguarde a confirmação antes de tentar novamente.');
    }

    if (!order) {
      const rows = await this.dataSource.query(
        `INSERT INTO classified_orders
          ("companyId","listingId","buyerUserId","auctionId",quantity,"unitPriceCents","discountCents","totalCents",
           "platformFeeCents","sellerNetCents","paymentProvider","paymentMethod","paymentStatus",status,
           "fulfillmentMode","fulfillmentData","idempotencyKey","termsVersion","stockReserved","expiresAt",metadata)
         VALUES ($1,$2,$3,$4,1,$5,0,$6,$7,$8,'MERCADO_PAGO',$9,'PENDING','CREATED',$10,$11::jsonb,$12,$13,false,$14,$15::jsonb)
         RETURNING *`,
        [auction.companyId, auction.listingId, uid, auctionId, auctionAmountCents, totalCents, platformFeeCents, sellerNetCents,
          method, fulfillmentMode, JSON.stringify(fulfillmentData), idempotencyKey, CLASSIFIEDS_PAYMENT_TERMS_VERSION,
          new Date(Date.now() + (method === 'PIX' ? 35 * 60_000 : 24 * 60 * 60_000)),
          JSON.stringify({ kind: 'AUCTION_SETTLEMENT', auctionAmountCents, deliveryFeeCents, auctionFeeRule: { ...feeRule, plan } })],
      );
      order = rows[0];
    } else {
      const rows = await this.dataSource.query(
        `UPDATE classified_orders SET
           "paymentMethod"=$2,"paymentStatus"='PENDING',status='CREATED',"providerPaymentId"=NULL,
           "providerStatusDetail"=NULL,"fulfillmentMode"=$3,"fulfillmentData"=$4::jsonb,
           "idempotencyKey"=$5,"expiresAt"=$6,"updatedAt"=now()
         WHERE id=$1 RETURNING *`,
        [order.id, method, fulfillmentMode, JSON.stringify(fulfillmentData), idempotencyKey,
          new Date(Date.now() + (method === 'PIX' ? 35 * 60_000 : 24 * 60 * 60_000))],
      );
      order = rows[0];
    }

    await this.dataSource.query(
      `UPDATE classified_auctions SET "settlementOrderId"=$2,"settlementPaymentStatus"='PENDING',"updatedAt"=now() WHERE id=$1`,
      [auctionId, order.id],
    );

    const credentials = await this.marketplacePayments.sellerMercadoPagoCredentials(auction.companyId);
    const platform = await this.providerConfig.getSecretConfig<MercadoPagoProviderConfig>('MERCADO_PAGO');
    const payload = this.paymentPayload(order, auction, buyer, method, body, platform.publicApiBaseUrl);
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${credentials.accessToken}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25_000),
    }).catch(() => null);

    if (!response) {
      await this.markProcessing(order.id, auctionId, 'Falha de rede ao criar cobrança; aguardando reconciliação.');
      return { ...this.presentOrder(await this.orderForAuction(auctionId)), processing: true };
    }
    const text = await response.text();
    let payment: any = {};
    try { payment = JSON.parse(text || '{}'); } catch { payment = { message: text.slice(0, 500) }; }
    if (!response.ok) {
      const ambiguous = response.status >= 500;
      await this.dataSource.query(
        `UPDATE classified_orders SET "paymentStatus"=$2,"providerStatusDetail"=$3,"updatedAt"=now() WHERE id=$1`,
        [order.id, ambiguous ? 'IN_PROCESS' : 'REJECTED', String(payment?.message || payment?.error || `HTTP ${response.status}`).slice(0, 160)],
      );
      await this.dataSource.query(
        `UPDATE classified_auctions SET "settlementPaymentStatus"=$2,"updatedAt"=now() WHERE id=$1`,
        [auctionId, ambiguous ? 'IN_PROCESS' : 'REJECTED'],
      );
      if (!ambiguous) throw new BadRequestException(String(payment?.message || 'O Mercado Pago recusou o pagamento.').slice(0, 500));
      return { ...this.presentOrder(await this.orderForAuction(auctionId)), processing: true };
    }

    await this.applyPayment(order.id, auctionId, payment);
    return this.presentOrder(await this.orderForAuction(auctionId));
  }

  async resolveAuctionFeeRule(companyId: string, plan: 'FREE' | 'PLUS' | 'ELITE') {
    const custom = await this.dataSource.query(
      `SELECT * FROM classified_auction_fee_rules WHERE scope='COMPANY' AND "companyId"=$1 AND enabled=true LIMIT 1`,
      [companyId],
    ).catch(() => []);
    const rule = custom[0] || (await this.dataSource.query(
      `SELECT * FROM classified_auction_fee_rules WHERE scope='PLAN' AND plan=$1 AND enabled=true LIMIT 1`,
      [plan],
    ).catch(() => []))[0];
    if (!rule) return null;
    return {
      source: rule.scope === 'COMPANY' ? 'CUSTOM' : plan,
      rateBps: Number(rule.rateBps || 0),
      percentage: Number(rule.rateBps || 0) / 100,
      minimumFeeCents: Number(rule.minimumFeeCents || 0),
      maximumFeeCents: rule.maximumFeeCents == null ? null : Number(rule.maximumFeeCents),
    };
  }

  private calculateFee(baseCents: number, rule: { rateBps: number; minimumFeeCents: number; maximumFeeCents: number | null }) {
    let fee = Math.round(baseCents * rule.rateBps / 10_000);
    fee = Math.max(rule.minimumFeeCents || 0, fee);
    if (rule.maximumFeeCents != null) fee = Math.min(rule.maximumFeeCents, fee);
    return Math.max(0, Math.min(baseCents, fee));
  }

  private async assertSeller(uid: string, auctionId: string) {
    const identity = await this.identities.active(uid);
    if (identity.type !== 'COMPANY') throw new ForbiddenException('Somente a empresa anunciante pode configurar o recebimento do leilão.');
    const rows = await this.auctionRows(auctionId);
    const auction = rows[0];
    if (!auction) throw new NotFoundException('Leilão não encontrado.');
    if (auction.companyId !== identity.company!.id) throw new ForbiddenException('Este leilão pertence a outra empresa.');
    return auction;
  }

  private async assertWinner(uid: string, auctionId: string) {
    const rows = await this.auctionRows(auctionId);
    const auction = rows[0];
    if (!auction) throw new NotFoundException('Leilão não encontrado.');
    if (auction.status !== 'ENDED' || !auction.winnerUserId || auction.finalAmount == null) throw new BadRequestException('Este leilão ainda não possui um arremate válido.');
    if (auction.winnerUserId !== uid) throw new ForbiddenException('Somente quem arrematou pode pagar este leilão.');
    return auction;
  }

  private auctionRows(auctionId: string) {
    return this.dataSource.query(
      `SELECT a.*,l.title,l.slug,i.url AS image,c.name AS "companyName"
       FROM classified_auctions a
       JOIN classified_listings l ON l.id=a."listingId"
       JOIN companies c ON c.id=a."companyId"
       LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder" ASC LIMIT 1) i ON true
       WHERE a.id=$1 LIMIT 1`,
      [auctionId],
    );
  }

  private orderForAuction(auctionId: string) {
    return this.dataSource.query(`SELECT * FROM classified_orders WHERE "auctionId"=$1 LIMIT 1`, [auctionId])
      .then((rows) => rows[0] || null).catch(() => null);
  }

  private fulfillmentModes(value: unknown): Array<'ARRANGE' | 'PICKUP' | 'DELIVERY'> {
    const values = Array.isArray(value) ? value : ['ARRANGE'];
    const modes = values.map(String).map((v) => v.toUpperCase()).filter((v) => ['ARRANGE','PICKUP','DELIVERY'].includes(v)) as Array<'ARRANGE'|'PICKUP'|'DELIVERY'>;
    const fallback: Array<'ARRANGE' | 'PICKUP' | 'DELIVERY'> = ['ARRANGE'];
    return [
      ...new Set<'ARRANGE' | 'PICKUP' | 'DELIVERY'>(
        modes.length ? modes : fallback,
      ),
    ];
  }

  private cleanModes(value: unknown) {
    return this.fulfillmentModes(value);
  }

  private fulfillmentMode(value: unknown, allowed: Array<'ARRANGE'|'PICKUP'|'DELIVERY'>) {
    const mode = String(value || allowed[0] || 'ARRANGE').toUpperCase() as 'ARRANGE'|'PICKUP'|'DELIVERY';
    if (!allowed.includes(mode)) throw new BadRequestException('Forma de recebimento indisponível.');
    return mode;
  }

  private fulfillmentData(value: unknown) {
    const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return { address: String(source.address || '').trim().slice(0, 500) || null, note: String(source.note || '').trim().slice(0, 500) || null };
  }

  private paymentMethod(value: unknown): 'PIX' | 'CARD' {
    const method = String(value || '').toUpperCase();
    if (!['PIX','CARD'].includes(method)) throw new BadRequestException('Forma de pagamento inválida.');
    return method as 'PIX'|'CARD';
  }

  private idempotencyKey(value: unknown) {
    const key = String(value || '').trim();
    if (!/^[A-Za-z0-9_-]{16,120}$/.test(key)) throw new BadRequestException('Chave de idempotência inválida.');
    return key;
  }

  private cents(value: unknown, max: number, message: string) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n < 0 || n > max) throw new BadRequestException(message);
    return Math.round(n);
  }

  private moneyToCents(value: unknown) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) throw new BadRequestException('Valor do arremate inválido.');
    return Math.round(n * 100);
  }

  private paymentPayload(order: any, auction: any, buyer: any, method: 'PIX'|'CARD', input: Record<string, any>, configuredBase?: string) {
    const publicApiBase = String(configuredBase || process.env.PUBLIC_API_ORIGIN || process.env.PUBLIC_API_URL || 'https://piranegocios.com.br/api').replace(/\/$/, '');
    const common: Record<string, any> = {
      transaction_amount: Number(order.totalCents) / 100,
      application_fee: Number(order.platformFeeCents) / 100,
      description: `Arremate · ${String(auction.title || 'Leilão PiraNegócios').slice(0, 220)}`,
      external_reference: order.id,
      notification_url: `${publicApiBase}/classifieds/payments/mercado-pago/webhook`,
      payer: { email: String(buyer.email) },
      metadata: { classified_order_id: order.id, auction_id: auction.id, kind: 'AUCTION_SETTLEMENT' },
    };
    if (method === 'PIX') return { ...common, payment_method_id: 'pix', date_of_expiration: new Date(Date.now() + 30 * 60_000).toISOString() };
    const token = String(input.token || input.formData?.token || '').trim();
    const paymentMethodId = String(input.paymentMethodId || input.formData?.payment_method_id || '').trim();
    const issuerId = String(input.issuerId || input.formData?.issuer_id || '').trim();
    const installments = Math.max(1, Math.min(24, Math.floor(Number(input.installments || input.formData?.installments || 1))));
    if (!token || !paymentMethodId) throw new BadRequestException('O Mercado Pago não retornou um cartão tokenizado válido.');
    const identification = input.payer?.identification || input.formData?.payer?.identification;
    return {
      ...common, token, payment_method_id: paymentMethodId, ...(issuerId ? { issuer_id: issuerId } : {}), installments,
      payer: { email: String(buyer.email), ...(identification?.type && identification?.number ? { identification: { type: String(identification.type), number: String(identification.number).replace(/\D/g, '').slice(0, 32) } } : {}) },
    };
  }

  private async applyPayment(orderId: string, auctionId: string, payment: any) {
    const status = this.mapStatus(payment?.status);
    const pix = payment?.point_of_interaction?.transaction_data;
    const metadata = { mercadoPago: { status: payment?.status || null, statusDetail: payment?.status_detail || null, pixCopyPaste: pix?.qr_code || null, pixQrCodeBase64: pix?.qr_code_base64 || null, ticketUrl: pix?.ticket_url || null } };
    await this.dataSource.query(
      `UPDATE classified_orders SET "providerPaymentId"=$2,"paymentStatus"=$3,"providerStatusDetail"=$4,
         status=CASE WHEN $3='APPROVED' THEN 'PAID' WHEN $3='CANCELED' THEN 'CANCELED' ELSE status END,
         "paidAt"=CASE WHEN $3='APPROVED' THEN COALESCE("paidAt",now()) ELSE "paidAt" END,
         metadata=COALESCE(metadata,'{}'::jsonb) || $5::jsonb,"updatedAt"=now() WHERE id=$1`,
      [orderId, String(payment?.id || '') || null, status, String(payment?.status_detail || '').slice(0, 160) || null, JSON.stringify(metadata)],
    );
    await this.dataSource.query(
      `UPDATE classified_auctions SET "settlementPaymentStatus"=$2,"settlementOrderId"=$3,
         "settlementStatus"=CASE WHEN $2='APPROVED' THEN 'COMPLETED' ELSE "settlementStatus" END,"settlementUpdatedAt"=now(),"updatedAt"=now()
       WHERE id=$1`,
      [auctionId, status, orderId],
    );
  }

  private async markProcessing(orderId: string, auctionId: string, detail: string) {
    await this.dataSource.query(`UPDATE classified_orders SET "paymentStatus"='IN_PROCESS',"providerStatusDetail"=$2,"updatedAt"=now() WHERE id=$1`, [orderId, detail.slice(0, 160)]);
    await this.dataSource.query(`UPDATE classified_auctions SET "settlementPaymentStatus"='IN_PROCESS',"updatedAt"=now() WHERE id=$1`, [auctionId]);
  }

  private mapStatus(value: unknown) {
    const status = String(value || '').toLowerCase();
    if (status === 'approved') return 'APPROVED';
    if (status === 'rejected') return 'REJECTED';
    if (status === 'cancelled' || status === 'canceled') return 'CANCELED';
    if (status === 'refunded') return 'REFUNDED';
    if (['in_process','in_mediation','authorized'].includes(status)) return 'IN_PROCESS';
    return 'PENDING';
  }

  private presentOrder(order: any) {
    const mp = order?.metadata?.mercadoPago || {};
    return {
      id: order.id,
      auctionId: order.auctionId,
      totalCents: Number(order.totalCents || 0),
      platformFeeCents: Number(order.platformFeeCents || 0),
      sellerNetCents: Number(order.sellerNetCents || 0),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      status: order.status,
      fulfillmentMode: order.fulfillmentMode,
      fulfillmentData: order.fulfillmentData || null,
      providerStatusDetail: order.providerStatusDetail || null,
      expiresAt: order.expiresAt || null,
      pix: order.paymentMethod === 'PIX' ? { copyPaste: mp.pixCopyPaste || null, qrCodeBase64: mp.pixQrCodeBase64 || null, ticketUrl: mp.ticketUrl || null } : null,
    };
  }
}
