import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClassifiedsAuctionSettlementService } from './classifieds-auction-settlement.service';
import { ClassifiedsReceiptPreferencesService } from './classifieds-receipt-preferences.service';

@Injectable()
export class ClassifiedsAuctionPaymentPolicyService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly settlement: ClassifiedsAuctionSettlementService,
    private readonly receiptPreferences: ClassifiedsReceiptPreferencesService,
  ) {}

  async sellerConfig(uid: string, auctionId: string) {
    const base = await this.settlement.sellerConfig(uid, auctionId);
    const row = await this.policy(auctionId);
    const prefs = await this.receiptPreferences.get(uid);
    return {
      ...base,
      auctionFeePayer: this.receiptPreferences.feePayer(row?.auctionFeePayer || prefs.auctionFeePayerDefault),
      paymentMethods: this.methods(row?.paymentMethods, prefs),
      cardMaxInstallments: this.receiptPreferences.installments(row?.cardMaxInstallments || prefs.cardMaxInstallments),
      pickupAddress: row?.pickupAddressSnapshot || prefs.companyAddress || null,
      feeSnapshot: row?.auctionFeeRateBps == null ? base?.feeRule || null : {
        source: row.auctionFeeSource || null,
        rateBps: Number(row.auctionFeeRateBps),
        percentage: Number(row.auctionFeeRateBps) / 100,
        minimumFeeCents: Number(row.auctionFeeMinimumCents || 0),
        maximumFeeCents: row.auctionFeeMaximumCents == null ? null : Number(row.auctionFeeMaximumCents),
      },
    };
  }

  async configureSeller(uid: string, auctionId: string, body: Record<string, unknown>) {
    const prefs = await this.receiptPreferences.get(uid);
    const paymentMethods = this.receiptPreferences.methodsFrom(body, prefs);
    const fulfillmentModes = this.receiptPreferences.fulfillmentFrom(body, prefs);
    const cardMaxInstallments = this.receiptPreferences.installments(body.cardMaxInstallments ?? prefs.cardMaxInstallments);
    const auctionFeePayer = this.receiptPreferences.feePayer(body.auctionFeePayer ?? prefs.auctionFeePayerDefault);
    const base = await this.settlement.configureSeller(uid, auctionId, { ...body, fulfillmentModes });
    const fee = base?.feeRule || null;
    await this.dataSource.query(
      `UPDATE classified_auctions SET
        "auctionFeePayer"=$2,"paymentMethods"=$3::jsonb,"cardMaxInstallments"=$4,
        "pickupAddressSnapshot"=$5,
        "auctionFeeRateBps"=CASE WHEN $6 THEN $7 ELSE "auctionFeeRateBps" END,
        "auctionFeeMinimumCents"=CASE WHEN $6 THEN $8 ELSE "auctionFeeMinimumCents" END,
        "auctionFeeMaximumCents"=CASE WHEN $6 THEN $9 ELSE "auctionFeeMaximumCents" END,
        "auctionFeeSource"=CASE WHEN $6 THEN $10 ELSE "auctionFeeSource" END,
        "updatedAt"=now() WHERE id=$1`,
      [auctionId, auctionFeePayer, JSON.stringify(paymentMethods), cardMaxInstallments, prefs.companyAddress || null,
        base?.onlinePaymentEnabled === true && Boolean(fee), fee?.rateBps ?? null, fee?.minimumFeeCents ?? 0,
        fee?.maximumFeeCents ?? null, fee?.source ?? null],
    );
    return this.sellerConfig(uid, auctionId);
  }

  async buyerConfig(uid: string, auctionId: string) {
    const base = await this.settlement.buyerConfig(uid, auctionId);
    const row = await this.policy(auctionId);
    if (!row) return base;
    const feeCents = this.fee(Number(base.amountCents || 0), row);
    const feePayer = this.receiptPreferences.feePayer(row.auctionFeePayer);
    const buyerFeeCents = feePayer === 'BUYER' ? feeCents : 0;
    return {
      ...base,
      paymentMethods: this.methods(row.paymentMethods),
      cardMaxInstallments: this.receiptPreferences.installments(row.cardMaxInstallments || 12),
      pickupAddress: this.fulfillment(row.fulfillmentModes).includes('PICKUP') ? row.pickupAddressSnapshot || row.companyAddress || null : null,
      auctionFeePayer: feePayer,
      auctionFeeCents: feeCents,
      buyerAuctionFeeCents: buyerFeeCents,
      totalCents: Number(base.amountCents || 0) + Number(base.deliveryFeeCents || 0) + buyerFeeCents,
      feeDisclosure: this.disclosure(feePayer, row, feeCents),
    };
  }

  async createPayment(uid: string, auctionId: string, body: Record<string, any>) {
    const row = await this.policy(auctionId);
    if (!row) throw new BadRequestException('Configuração do leilão não encontrada.');
    const method = String(body.paymentMethod || '').toUpperCase();
    const allowed = this.methods(row.paymentMethods);
    if (!allowed.includes(method as 'PIX' | 'CARD')) throw new BadRequestException('A empresa não habilitou esta forma de pagamento para o arremate.');
    const next = { ...body };
    if (method === 'CARD') {
      const max = this.receiptPreferences.installments(row.cardMaxInstallments || 12);
      const installments = Math.max(1, Math.floor(Number(body.installments || body.formData?.installments || 1)));
      if (installments > max) throw new BadRequestException(`Este leilão aceita cartão em até ${max}x.`);
      next.installments = installments;
      next.formData = { ...(body.formData || {}), installments };
    }
    return this.settlement.createPayment(uid, auctionId, next);
  }

  private async policy(auctionId: string) {
    const rows = await this.dataSource.query(
      `SELECT a.*,c.address AS "companyAddress" FROM classified_auctions a JOIN companies c ON c.id=a."companyId" WHERE a.id=$1 LIMIT 1`,
      [auctionId],
    ).catch(() => []);
    return rows[0] || null;
  }

  private methods(value: unknown, fallback?: { pixEnabled?: boolean; cardEnabled?: boolean }) {
    const raw = Array.isArray(value) ? value.map(String).map(v => v.toUpperCase()) : [];
    const values = [...new Set(raw.filter(v => v === 'PIX' || v === 'CARD'))] as Array<'PIX'|'CARD'>;
    if (values.length) return values;
    const defaults: Array<'PIX'|'CARD'> = [];
    if (fallback?.pixEnabled !== false) defaults.push('PIX');
    if (fallback?.cardEnabled !== false) defaults.push('CARD');
    return defaults.length ? defaults : ['PIX','CARD'];
  }

  private fulfillment(value: unknown) {
    const raw = Array.isArray(value) ? value.map(String).map(v => v.toUpperCase()) : [];
    const values = [...new Set(raw.filter(v => ['ARRANGE','PICKUP','DELIVERY'].includes(v)))] as string[];
    return values.length ? values : ['ARRANGE'];
  }

  private fee(baseCents: number, row: any) {
    let value = Math.round(Math.max(0, baseCents) * Number(row.auctionFeeRateBps || 0) / 10000);
    value = Math.max(Number(row.auctionFeeMinimumCents || 0), value);
    if (row.auctionFeeMaximumCents != null) value = Math.min(Number(row.auctionFeeMaximumCents), value);
    return Math.max(0, Math.min(baseCents, value));
  }

  private disclosure(payer: 'SELLER'|'BUYER', row: any, feeCents: number) {
    if (payer === 'SELLER') return 'A empresa absorve a taxa de leilão. O arrematante paga o valor vencedor e eventual entrega.';
    const percentage = Number(row.auctionFeeRateBps || 0) / 100;
    return `Arremate + taxa de leilão de ${percentage.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% (${(feeCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} no valor final), além de eventual entrega.`;
  }
}
