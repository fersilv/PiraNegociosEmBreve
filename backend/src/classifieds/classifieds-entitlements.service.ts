import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClassifiedsIdentityService } from './classifieds-identity.service';

@Injectable()
export class ClassifiedsEntitlementsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: ClassifiedsIdentityService,
  ) {}

  async limits(uid: string) {
    const identity = await this.identities.active(uid);
    if (identity.type !== 'COMPANY') {
      return { photoLimit: 3, plan: 'FREE', paid: false };
    }

    const rows = await this.dataSource.query(
      `SELECT plan FROM company_plan_subscriptions
       WHERE "companyId" = $1
         AND status IN ('ACTIVE','PAST_DUE')
         AND "currentPeriodEnd" > now()
         AND plan IN ('PLUS','ELITE')
       ORDER BY "currentPeriodEnd" DESC LIMIT 1`,
      [identity.company!.id],
    ).catch(() => []);

    const plan = String(rows[0]?.plan || 'FREE').toUpperCase();
    const paid = plan === 'PLUS' || plan === 'ELITE';
    return {
      photoLimit: identity.type === 'COMPANY' ? 10 : 3,
      plan: paid ? plan : 'FREE',
      paid,
    };
  }

  async assertImageLimit(uid: string, rawImages: unknown) {
    if (!Array.isArray(rawImages)) return this.limits(uid);
    const limits = await this.limits(uid);
    if (rawImages.length > limits.photoLimit) {
      throw new BadRequestException(
        limits.photoLimit === 3
          ? 'O plano Free permite até 3 fotos por anúncio. Empresas podem usar até 10 fotos.'
          : `Este workspace permite até ${limits.photoLimit} fotos por anúncio.`,
      );
    }
    return limits;
  }
}
