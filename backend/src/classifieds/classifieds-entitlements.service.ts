import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
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
      return {
        photoLimit: 3,
        plan: 'FREE',
        paid: false,
        auctionCreation: false,
      };
    }

    const plan = await this.companyPlan(identity.company!.id);
    const paid = plan === 'PLUS' || plan === 'ELITE';
    return {
      photoLimit: 10,
      plan,
      paid,
      auctionCreation: plan === 'ELITE',
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

  async assertAuctionCreation(uid: string) {
    const identity = await this.identities.active(uid, true);
    if (identity.type !== 'COMPANY') {
      throw new ForbiddenException('Leilões são exclusivos para empresas no plano Elite.');
    }
    const plan = await this.companyPlan(identity.company!.id);
    if (plan !== 'ELITE') {
      throw new ForbiddenException('Leilões são um recurso exclusivo do plano PiraNegócios Empresa Elite.');
    }
    return { allowed: true, plan, companyId: identity.company!.id };
  }

  async assertAuctionParticipant(uid: string) {
    const identity = await this.identities.active(uid);
    const user = identity.user;
    const missing: string[] = [];
    if (!String(user.email || '').trim()) missing.push('e-mail');
    if (!user.whatsappVerifiedAt || !String(user.whatsappPhoneE164 || '').trim()) missing.push('WhatsApp verificado');
    if (!String(user.photoURL || '').trim()) missing.push('foto de perfil com o rosto');
    if (missing.length) {
      throw new ForbiddenException(
        `Para participar de leilões, complete seu perfil com ${missing.join(', ')}.`,
      );
    }
    return {
      allowed: true,
      userId: uid,
      email: user.email,
      whatsapp: user.whatsappPhoneE164,
      photoURL: user.photoURL,
    };
  }

  async companyPlan(companyId: string): Promise<'FREE' | 'PLUS' | 'ELITE'> {
    const rows = await this.dataSource.query(
      `SELECT plan FROM company_plan_subscriptions
       WHERE "companyId" = $1
         AND status IN ('ACTIVE','PAST_DUE')
         AND "currentPeriodEnd" > now()
         AND plan IN ('PLUS','ELITE')
       ORDER BY "currentPeriodEnd" DESC LIMIT 1`,
      [companyId],
    ).catch(() => []);
    const plan = String(rows[0]?.plan || 'FREE').toUpperCase();
    return plan === 'ELITE' ? 'ELITE' : plan === 'PLUS' ? 'PLUS' : 'FREE';
  }
}
