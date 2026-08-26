import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
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
    let rows: any[] = [];
    if (keys.length) {
      try {
        rows = await this.dataSource.query(
          `SELECT scope,"identityKey","acceptedAt" FROM classified_marketplace_terms_acceptances
           WHERE version=$1 AND "identityKey" = ANY($2::varchar[])`,
          [CLASSIFIEDS_PAYMENT_TERMS_VERSION, keys],
        );
      } catch (error) {
        if (!this.isTermsSchemaGap(error)) throw error;
        return {
          version: CLASSIFIEDS_PAYMENT_TERMS_VERSION,
          termsUrl: '/classificados/termos#pagamentos-online',
          buyerAccepted: false,
          sellerAccepted: false,
          sellerAvailable: Boolean(sellerKey),
          schemaReady: false,
          message: 'A estrutura de aceite dos termos de pagamento online ainda não foi migrada neste ambiente.',
        };
      }
    }
    return {
      version: CLASSIFIEDS_PAYMENT_TERMS_VERSION,
      termsUrl: '/classificados/termos#pagamentos-online',
      buyerAccepted: rows.some((row: any) => row.scope === 'ONLINE_PAYMENT_BUYER' && row.identityKey === buyerKey),
      sellerAccepted: sellerKey
        ? rows.some((row: any) => row.scope === 'ONLINE_PAYMENT_SELLER' && row.identityKey === sellerKey)
        : false,
      sellerAvailable: Boolean(sellerKey),
      schemaReady: true,
    };
  }

  async accept(uid: string, rawScope: unknown, metadata: Record<string, unknown> = {}) {
    const scope = this.scope(rawScope);
    const identity = await this.identities.active(uid);
    let companyId: string | null = null;
    let identityKey = this.buyerKey(uid);

    if (scope === 'ONLINE_PAYMENT_SELLER') {
      if (identity.type !== 'COMPANY') {
        throw new ForbiddenException('O aceite de vendedor exige o workspace Marketplace da empresa.');
      }
      companyId = identity.company!.id;
      identityKey = this.sellerKey(companyId);
    }

    try {
      await this.dataSource.query(
        `INSERT INTO classified_marketplace_terms_acceptances
         ("userId","companyId",scope,version,"identityKey",metadata,"acceptedAt")
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,now())
         ON CONFLICT ("identityKey",scope,version) DO UPDATE SET
           "userId"=EXCLUDED."userId", "companyId"=EXCLUDED."companyId",
           metadata=EXCLUDED.metadata, "acceptedAt"=now()`,
        [uid, companyId, scope, CLASSIFIEDS_PAYMENT_TERMS_VERSION, identityKey, JSON.stringify(this.safeMetadata(metadata))],
      );
    } catch (error) {
      if (!this.isTermsSchemaGap(error)) throw error;
      throw new ServiceUnavailableException({
        code: 'MARKETPLACE_TERMS_SCHEMA_PENDING',
        message: 'Os pagamentos online estão sendo atualizados. Aplique as migrations do Marketplace antes de registrar novos aceites.',
      });
    }
    return { accepted: true, scope, version: CLASSIFIEDS_PAYMENT_TERMS_VERSION, acceptedAt: new Date().toISOString() };
  }

  async assertAccepted(uid: string, scope: ClassifiedPaymentTermsScope) {
    const identity = await this.identities.active(uid);
    const identityKey = scope === 'ONLINE_PAYMENT_SELLER'
      ? identity.type === 'COMPANY'
        ? this.sellerKey(identity.company!.id)
        : null
      : this.buyerKey(uid);
    if (!identityKey) throw new ForbiddenException('O aceite de vendedor exige o workspace Marketplace da empresa.');
    let rows: any[] = [];
    try {
      rows = await this.dataSource.query(
        `SELECT id FROM classified_marketplace_terms_acceptances
         WHERE "identityKey"=$1 AND scope=$2 AND version=$3 LIMIT 1`,
        [identityKey, scope, CLASSIFIEDS_PAYMENT_TERMS_VERSION],
      );
    } catch (error) {
      if (!this.isTermsSchemaGap(error)) throw error;
      throw new ServiceUnavailableException({
        code: 'MARKETPLACE_TERMS_SCHEMA_PENDING',
        message: 'Os pagamentos online estão temporariamente indisponíveis porque a estrutura de termos ainda não foi migrada.',
      });
    }
    if (!rows[0]) {
      throw new BadRequestException(
        scope === 'ONLINE_PAYMENT_SELLER'
          ? 'Leia e aceite os termos de vendas e pagamentos online antes de habilitar o checkout.'
          : 'Leia e aceite os termos do Marketplace e pagamentos online antes de concluir a compra.',
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

  private isTermsSchemaGap(error: any) {
    const code = String(error?.code || error?.driverError?.code || '');
    if (code === '42P01') return true;
    const message = String(error?.message || error?.driverError?.message || '').toLowerCase();
    return message.includes('classified_marketplace_terms_acceptances') && message.includes('does not exist');
  }
}
