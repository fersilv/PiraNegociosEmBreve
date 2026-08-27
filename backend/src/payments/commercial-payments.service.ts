import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BillingSupportService } from './billing-support.service';
import { PaymentCheckoutStatusService } from './payment-checkout-status.service';
import { PaymentProviderManagerService, type PaymentCheckoutPayer } from './payment-provider-manager.service';
import { PaymentsService } from './payments.service';

export type PurchaseMode = 'ONE_TIME' | 'SUBSCRIPTION';

@Injectable()
export class CommercialPaymentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly payments: PaymentsService,
    private readonly billingSupport: BillingSupportService,
    private readonly providers: PaymentProviderManagerService,
    private readonly checkoutStatus: PaymentCheckoutStatusService,
  ) {}

  private nullablePrice(value: unknown, current: unknown) {
    if (value === undefined) return current === null || current === undefined ? null : Number(current);
    if (value === null || value === '') return null;
    const parsed = Math.round(Number(value));
    if (!Number.isFinite(parsed) || parsed < 0) throw new BadRequestException('Preço inválido.');
    return parsed;
  }

  private normalizeMode(value: unknown): PurchaseMode | null {
    const mode = String(value || '').trim().toUpperCase();
    if (!mode) return null;
    if (!['ONE_TIME', 'SUBSCRIPTION'].includes(mode)) {
      throw new BadRequestException('Modalidade comercial inválida.');
    }
    return mode as PurchaseMode;
  }

  private promotionPrice(product: any, mode: PurchaseMode, basePrice: number) {
    if (String(product.preferredPurchaseMode || '') !== mode) return null;
    if (product.promotionalPriceCents === null || product.promotionalPriceCents === undefined) return null;
    const promotional = Number(product.promotionalPriceCents);
    if (!Number.isFinite(promotional) || promotional < 0 || promotional > basePrice) return null;
    const now = Date.now();
    const starts = product.promotionStartsAt ? new Date(product.promotionStartsAt).getTime() : Number.NEGATIVE_INFINITY;
    const ends = product.promotionEndsAt ? new Date(product.promotionEndsAt).getTime() : Number.POSITIVE_INFINITY;
    if (Number.isNaN(starts) || Number.isNaN(ends) || now < starts || now > ends) return null;
    return promotional;
  }

  private present(product: any) {
    const oneTimePriceCents = product.oneTimePriceCents === null || product.oneTimePriceCents === undefined
      ? (product.billingType === 'ONE_TIME' ? Number(product.priceCents || 0) : null)
      : Number(product.oneTimePriceCents);
    const subscriptionPriceCents = product.subscriptionPriceCents === null || product.subscriptionPriceCents === undefined
      ? (product.billingType === 'RECURRING' ? Number(product.priceCents || 0) : null)
      : Number(product.subscriptionPriceCents);
    let preferredPurchaseMode = this.normalizeMode(product.preferredPurchaseMode)
      || (subscriptionPriceCents !== null ? 'SUBSCRIPTION' : 'ONE_TIME');
    if (preferredPurchaseMode === 'SUBSCRIPTION' && subscriptionPriceCents === null) preferredPurchaseMode = 'ONE_TIME';
    if (preferredPurchaseMode === 'ONE_TIME' && oneTimePriceCents === null && subscriptionPriceCents !== null) preferredPurchaseMode = 'SUBSCRIPTION';
    return {
      ...product,
      oneTimePriceCents,
      subscriptionPriceCents,
      preferredPurchaseMode,
      oneTimeAvailable: oneTimePriceCents !== null,
      subscriptionAvailable: subscriptionPriceCents !== null,
    };
  }

  async listProducts(includeDisabled = false) {
    const rows = await this.dataSource.query(
      `SELECT * FROM payment_products ${includeDisabled ? '' : 'WHERE enabled = true'} ORDER BY "sortOrder" ASC, name ASC`,
    );
    return rows.map((row: any) => this.present(row));
  }

  async getProduct(code: string, includeDisabled = false) {
    const rows = await this.dataSource.query(
      `SELECT * FROM payment_products WHERE code = $1 ${includeDisabled ? '' : 'AND enabled = true'} LIMIT 1`,
      [String(code || '').trim()],
    );
    if (!rows[0]) throw new NotFoundException('Produto não encontrado ou indisponível.');
    return this.present(rows[0]);
  }

  async updateProduct(code: string, input: Record<string, unknown>) {
    const current = await this.getProduct(code, true);
    const oneTimePriceCents = this.nullablePrice(input.oneTimePriceCents, current.oneTimePriceCents);
    const subscriptionPriceCents = this.nullablePrice(input.subscriptionPriceCents, current.subscriptionPriceCents);
    if (oneTimePriceCents === null && subscriptionPriceCents === null) {
      throw new BadRequestException('O produto precisa ter pelo menos uma modalidade comercial disponível.');
    }

    let preferredPurchaseMode = this.normalizeMode(input.preferredPurchaseMode) || current.preferredPurchaseMode as PurchaseMode;
    if (preferredPurchaseMode === 'SUBSCRIPTION' && subscriptionPriceCents === null) preferredPurchaseMode = 'ONE_TIME';
    if (preferredPurchaseMode === 'ONE_TIME' && oneTimePriceCents === null) preferredPurchaseMode = 'SUBSCRIPTION';

    const legacyPrice = preferredPurchaseMode === 'SUBSCRIPTION'
      ? Number(subscriptionPriceCents)
      : Number(oneTimePriceCents);
    const legacyBillingType = preferredPurchaseMode === 'SUBSCRIPTION' ? 'RECURRING' : 'ONE_TIME';

    const rows = await this.dataSource.query(
      `UPDATE payment_products
       SET "oneTimePriceCents" = $2,
           "subscriptionPriceCents" = $3,
           "preferredPurchaseMode" = $4,
           "priceCents" = $5,
           "billingType" = $6,
           "updatedAt" = now()
       WHERE code = $1
       RETURNING *`,
      [code, oneTimePriceCents, subscriptionPriceCents, preferredPurchaseMode, legacyPrice, legacyBillingType],
    );
    return this.present(rows[0]);
  }

  private chooseMode(product: any, requested: unknown): PurchaseMode {
    const requestedMode = this.normalizeMode(requested);
    const mode = requestedMode || product.preferredPurchaseMode || (product.subscriptionAvailable ? 'SUBSCRIPTION' : 'ONE_TIME');
    if (mode === 'SUBSCRIPTION' && !product.subscriptionAvailable) {
      throw new BadRequestException('Este produto não possui oferta por assinatura.');
    }
    if (mode === 'ONE_TIME' && !product.oneTimeAvailable) {
      throw new BadRequestException('Este produto não possui oferta para compra avulsa.');
    }
    return mode;
  }

  async createCheckout(
    userId: string,
    productCode: string,
    purchaseModeInput: unknown,
    payer: PaymentCheckoutPayer = {},
  ) {
    const product = await this.getProduct(productCode, false);
    const purchaseMode = this.chooseMode(product, purchaseModeInput);

    const lifetimeActivation = await this.billingSupport.activateLifetimeProduct(userId, product.code);
    if (lifetimeActivation) {
      return {
        ...lifetimeActivation,
        purchaseMode,
        paymentRequired: false,
        checkoutReady: false,
        message: 'Conta vitalícia: este recurso não exige pagamento.',
      };
    }

    const basePrice = Number(purchaseMode === 'SUBSCRIPTION' ? product.subscriptionPriceCents : product.oneTimePriceCents);
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      throw new BadRequestException('Esta modalidade não possui um preço válido para cobrança.');
    }
    const promo = this.promotionPrice(product, purchaseMode, basePrice);
    const amountCents = promo ?? basePrice;
    const discountCents = Math.max(0, basePrice - amountCents);

    const inserted = await this.dataSource.query(
      `INSERT INTO payments
        ("userId", "productCode", method, status, "originalAmountCents", "amountCents", "discountCents", provider, "purchaseMode", metadata)
       VALUES ($1, $2, 'PIX', 'PENDING', $3, $4, $5, NULL, $6, $7::jsonb)
       RETURNING *`,
      [
        userId,
        product.code,
        basePrice,
        amountCents,
        discountCents,
        purchaseMode,
        JSON.stringify({
          purchaseMode,
          paymentType: purchaseMode === 'SUBSCRIPTION' ? 'PIX_AUTOMATICO' : 'PIX',
          promotionActive: promo !== null,
        }),
      ],
    );
    const payment = inserted[0];
    const paymentId = String(payment.id);

    const devMode = await this.payments.getDevMode();
    if (devMode.enabled) {
      const settled = await this.payments.simulatePayment(paymentId, userId);
      return {
        ...payment,
        ...settled,
        id: paymentId,
        paymentId,
        purchaseMode,
        product,
        paymentRequired: false,
        checkoutReady: false,
        devSimulation: true,
      };
    }

    try {
      // O adapter ainda recebe billingType por compatibilidade, mas ele é derivado
      // da escolha da transação. O cadastro do produto não decide mais a rota.
      const providerPayment = {
        ...payment,
        purchaseMode,
        product: {
          ...product,
          billingType: purchaseMode === 'SUBSCRIPTION' ? 'RECURRING' : 'ONE_TIME',
          priceCents: basePrice,
          effectivePriceCents: amountCents,
        },
      };
      const checkout = await this.providers.createCheckout(providerPayment, payer);
      const stored = await this.payments.attachProviderCheckout(paymentId, checkout);
      const metadata = typeof stored.metadata === 'object' && stored.metadata ? stored.metadata : {};
      const response = {
        ...stored,
        id: paymentId,
        paymentId,
        purchaseMode,
        billingType: purchaseMode === 'SUBSCRIPTION' ? 'RECURRING' : 'ONE_TIME',
        product: providerPayment.product,
        checkoutReady: Boolean(
          stored.pixCopyPaste
          || stored.qrCodeBase64
          || (metadata as any).ticketUrl
          || (metadata as any).subscriptionCheckoutUrl,
        ),
        providerConfigured: true,
        paymentRequired: true,
      };
      this.checkoutStatus.watchForUser(userId, paymentId);
      return response;
    } catch (error) {
      await this.payments.cancelProviderCheckout(paymentId, error).catch(() => undefined);
      throw error;
    }
  }
}
