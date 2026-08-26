import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClassifiedsIdentityService } from './classifieds-identity.service';

export type AuctionFeePayer = 'SELLER' | 'BUYER';
export type ClassifiedPaymentMethod = 'PIX' | 'CARD';

@Injectable()
export class ClassifiedsReceiptPreferencesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: ClassifiedsIdentityService,
  ) {}

  async get(uid: string) {
    const identity = await this.assertCompany(uid);
    const companyId = identity.company!.id;
    const [rows, connections, companyRows] = await Promise.all([
      this.dataSource.query(`SELECT * FROM company_classified_receipt_preferences WHERE "companyId"=$1 LIMIT 1`, [companyId]).catch(() => []),
      this.dataSource.query(`SELECT provider,status,"externalUserId","connectedAt","updatedAt" FROM company_classified_payment_connections WHERE "companyId"=$1 ORDER BY provider`, [companyId]).catch(() => []),
      this.dataSource.query(`SELECT id,name,address,city,state,"isVerified","verificationStatus" FROM companies WHERE id=$1 LIMIT 1`, [companyId]),
    ]);
    const row = rows[0] || null;
    const company = companyRows[0] || identity.company;
    return {
      companyId,
      companyVerified: Boolean(company?.isVerified || company?.verificationStatus === 'VERIFIED'),
      companyAddress: this.companyAddress(company),
      provider: row?.provider || 'MERCADO_PAGO',
      pixEnabled: row ? row.pixEnabled !== false : true,
      cardEnabled: row ? row.cardEnabled !== false : true,
      cardMaxInstallments: this.installments(row?.cardMaxInstallments ?? 12),
      auctionFeePayerDefault: this.feePayer(row?.auctionFeePayerDefault),
      pickupEnabled: row ? row.pickupEnabled !== false : true,
      deliveryEnabled: row?.deliveryEnabled === true,
      arrangeEnabled: row ? row.arrangeEnabled !== false : true,
      paymentConnections: connections,
      mercadoPagoConnected: connections.some((item: any) => item.provider === 'MERCADO_PAGO' && item.status === 'CONNECTED'),
    };
  }

  async update(uid: string, body: Record<string, unknown>) {
    const identity = await this.assertCompany(uid);
    const companyId = identity.company!.id;
    const pixEnabled = body.pixEnabled !== false;
    const cardEnabled = body.cardEnabled !== false;
    if (!pixEnabled && !cardEnabled) throw new BadRequestException('Habilite pelo menos Pix ou cartão.');
    const cardMaxInstallments = this.installments(body.cardMaxInstallments ?? 12);
    const auctionFeePayerDefault = this.feePayer(body.auctionFeePayerDefault);
    const pickupEnabled = body.pickupEnabled !== false;
    const deliveryEnabled = body.deliveryEnabled === true;
    const arrangeEnabled = body.arrangeEnabled !== false;
    if (!pickupEnabled && !deliveryEnabled && !arrangeEnabled) {
      throw new BadRequestException('Habilite pelo menos uma forma de entrega ou retirada.');
    }

    await this.dataSource.query(
      `INSERT INTO company_classified_receipt_preferences
        ("companyId",provider,"pixEnabled","cardEnabled","cardMaxInstallments","auctionFeePayerDefault","pickupEnabled","deliveryEnabled","arrangeEnabled","updatedAt")
       VALUES ($1,'MERCADO_PAGO',$2,$3,$4,$5,$6,$7,$8,now())
       ON CONFLICT ("companyId") DO UPDATE SET
         provider='MERCADO_PAGO',"pixEnabled"=EXCLUDED."pixEnabled","cardEnabled"=EXCLUDED."cardEnabled",
         "cardMaxInstallments"=EXCLUDED."cardMaxInstallments","auctionFeePayerDefault"=EXCLUDED."auctionFeePayerDefault",
         "pickupEnabled"=EXCLUDED."pickupEnabled","deliveryEnabled"=EXCLUDED."deliveryEnabled",
         "arrangeEnabled"=EXCLUDED."arrangeEnabled","updatedAt"=now()`,
      [companyId, pixEnabled, cardEnabled, cardMaxInstallments, auctionFeePayerDefault, pickupEnabled, deliveryEnabled, arrangeEnabled],
    );
    return this.get(uid);
  }

  methodsFrom(body: Record<string, unknown>, fallback?: { pixEnabled?: boolean; cardEnabled?: boolean }) {
    const explicit = Array.isArray(body.paymentMethods)
      ? body.paymentMethods.map(String).map((value) => value.toUpperCase()).filter((value) => value === 'PIX' || value === 'CARD')
      : [];
    const unique = [...new Set(explicit)] as ClassifiedPaymentMethod[];
    if (unique.length) return unique;
    const defaults: ClassifiedPaymentMethod[] = [];
    if (fallback?.pixEnabled !== false) defaults.push('PIX');
    if (fallback?.cardEnabled !== false) defaults.push('CARD');
    return defaults.length ? defaults : ['PIX'];
  }

  fulfillmentFrom(body: Record<string, unknown>, fallback?: { pickupEnabled?: boolean; deliveryEnabled?: boolean; arrangeEnabled?: boolean }) {
    const explicit = Array.isArray(body.fulfillmentModes)
      ? body.fulfillmentModes.map(String).map((value) => value.toUpperCase()).filter((value) => ['ARRANGE','PICKUP','DELIVERY'].includes(value))
      : [];
    const unique = [...new Set(explicit)] as Array<'ARRANGE'|'PICKUP'|'DELIVERY'>;
    if (unique.length) return unique;
    const defaults: Array<'ARRANGE'|'PICKUP'|'DELIVERY'> = [];
    if (fallback?.arrangeEnabled !== false) defaults.push('ARRANGE');
    if (fallback?.pickupEnabled !== false) defaults.push('PICKUP');
    if (fallback?.deliveryEnabled === true) defaults.push('DELIVERY');
    return defaults.length ? defaults : ['ARRANGE'];
  }

  feePayer(value: unknown): AuctionFeePayer {
    return String(value || '').toUpperCase() === 'BUYER' ? 'BUYER' : 'SELLER';
  }

  installments(value: unknown) {
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed)) return 12;
    return Math.max(1, Math.min(24, parsed));
  }

  companyAddress(company: any) {
    const address = String(company?.address || '').trim();
    const city = String(company?.city || '').trim();
    const state = String(company?.state || '').trim().toUpperCase();
    if (!address) return [city, state].filter(Boolean).join('/');
    const cityState = [city, state].filter(Boolean).join('/');
    if (!cityState || address.toLowerCase().includes(city.toLowerCase())) return address;
    return `${address}, ${cityState}`;
  }

  private async assertCompany(uid: string) {
    const identity = await this.identities.active(uid);
    if (identity.type !== 'COMPANY') throw new ForbiddenException('As formas de recebimento pertencem ao workspace Business.');
    return identity;
  }
}
