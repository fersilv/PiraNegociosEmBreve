import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClassifiedsIdentityService } from './classifieds-identity.service';

export const CLASSIFIEDS_PAYMENT_TERMS_VERSION = '2026-08-26';
export type ClassifiedPaymentTermsScope = 'ONLINE_PAYMENT_BUYER' | 'ONLINE_PAYMENT_SELLER';

@Injectable()
export class ClassifiedsMarketplaceTermsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: ClassifiedsIdentityService,
  ) {}

  async status(uid: string) {
    const identity = await this.identities.active(uid);
    const buyerKey = this.buyerKey(uid);
    const sellerKey = identity.type === 'COMPANY' ? this.sellerKey(identity.company!.id) : null;
    const keys = [buyerKey, sellerKey].filter(Boolean) as string[];
    const rows = keys.length
      ? await this.dataSource.query(
          `SELECT scope,"identityKey","acceptedAt" FROM classified_marketplace_terms_acceptances
           WHERE version=$1 AND "identityKey" = ANY($2::varchar[])`,
          [CLASSIFIEDS_PAYMENT_TERMS_VERSION, keys],
        ).catch(() => [])
      : [];
    return {
      version: CLASSIFIEDS_PAYMENT_TERMS_VERSION,
      termsUrl: '/classificados/termos#pagamentos-online',
      buyerAccepted: rows.some((row: any) => row.scope === 'ONLINE_PAYMENT_BUYER' && row.identityKey === buyerKey),
      sellerAccepted: sellerKey
        ? rows.some((row: any) => row.scope === 'ONLINE_PAYMENT_SELLER' && row.identityKey === sellerKey)
        : false,
      sellerAvailable: Boolean(sellerKey),
    };
  }

  async accept(uid: string, rawScope: unknown, metadata: Record<string, unknown> = {}) {
    const scope = this.scope(rawScope);
    const identity = await this.identities.active(uid);
    let companyId: string | null = null;
    let identityKey = this.buyerKey(uid);

    if (scope === 'ONLINE_PAYMENT_SELLER') {
      if (identity.type !== 'COMPANY') {
        throw new ForbiddenException('O aceite de vendedor exige o workspace Business.');
      }
      companyId = identity.company!.id;
      identityKey = this.sellerKey(companyId);
    }

    await this.dataSource.query(
      `INSERT INTO classified_marketplace_terms_acceptances
       ("userId","companyId",scope,version,"identityKey",metadata,"acceptedAt")
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,now())
       ON CONFLICT ("identityKey",scope,version) DO UPDATE SET
         "userId"=EXCLUDED."userId", "companyId"=EXCLUDED."companyId",
         metadata=EXCLUDED.metadata, "acceptedAt"=now()`,
      [uid, companyId, scope, CLASSIFIEDS_PAYMENT_TERMS_VERSION, identityKey, JSON.stringify(this.safeMetadata(metadata))],
    );
    return { accepted: true, scope, version: CLASSIFIEDS_PAYMENT_TERMS_VERSION, acceptedAt: new Date().toISOString() };
  }

  async assertAccepted(uid: string, scope: ClassifiedPaymentTermsScope) {
    const identity = await this.identities.active(uid);
    const identityKey = scope === 'ONLINE_PAYMENT_SELLER'
      ? identity.type === 'COMPANY'
        ? this.sellerKey(identity.company!.id)
        : null
      : this.buyerKey(uid);
    if (!identityKey) throw new ForbiddenException('O aceite de vendedor exige o workspace Business.');
    const rows = await this.dataSource.query(
      `SELECT id FROM classified_marketplace_terms_acceptances
       WHERE "identityKey"=$1 AND scope=$2 AND version=$3 LIMIT 1`,
      [identityKey, scope, CLASSIFIEDS_PAYMENT_TERMS_VERSION],
    ).catch(() => []);
    if (!rows[0]) {
      throw new BadRequestException(
        scope === 'ONLINE_PAYMENT_SELLER'
          ? 'Leia e aceite os termos de vendas e pagamentos online antes de habilitar o checkout.'
          : 'Leia e aceite os termos do marketplace e pagamentos online antes de concluir a compra.',
      );
    }
    return true;
  }

  private scope(value: unknown): ClassifiedPaymentTermsScope {
    const scope = String(value || '').trim().toUpperCase();
    if (!['ONLINE_PAYMENT_BUYER', 'ONLINE_PAYMENT_SELLER'].includes(scope)) {
      throw new BadRequestException('Escopo de aceite inválido.');
    }
    return scope as ClassifiedPaymentTermsScope;
  }

  private buyerKey(uid: string) {
    return `USER:${uid}`;
  }

  private sellerKey(companyId: string) {
    return `COMPANY:${companyId}`;
  }

  private safeMetadata(input: Record<string, unknown>) {
    return {
      surface: String(input.surface || '').slice(0, 80) || null,
      userAgent: String(input.userAgent || '').slice(0, 500) || null,
    };
  }
}
