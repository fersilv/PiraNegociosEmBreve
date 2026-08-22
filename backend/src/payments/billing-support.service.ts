import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaymentsService, type FeatureCredit } from './payments.service';

export type TimedFeature = 'JOB_MATCH_PREMIUM' | 'RESUME_BOOST';

@Injectable()
export class BillingSupportService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly payments: PaymentsService,
  ) {}

  async isLifetimeFree(userId: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT "lifetimeFree" FROM user_billing_profiles WHERE "userId" = $1 LIMIT 1`,
      [userId],
    );
    return rows[0]?.lifetimeFree === true;
  }

  async getMyBillingStatus(userId: string) {
    const [profileRows, credits, entitlements, subscriptions] = await Promise.all([
      this.dataSource.query(`SELECT "lifetimeFree" FROM user_billing_profiles WHERE "userId" = $1 LIMIT 1`, [userId]),
      this.payments.getCredits(userId),
      this.dataSource.query(
        `SELECT feature, "startsAt", "expiresAt", source, ("expiresAt" > now()) AS active
         FROM user_feature_entitlements WHERE "userId" = $1 ORDER BY "expiresAt" DESC`,
        [userId],
      ),
      this.dataSource.query(
        `SELECT id, "productCode", status, "currentPeriodStart", "currentPeriodEnd", "cancelAtPeriodEnd", source
         FROM subscriptions WHERE "userId" = $1 ORDER BY "updatedAt" DESC`,
        [userId],
      ),
    ]);
    return {
      lifetimeFree: profileRows[0]?.lifetimeFree === true,
      credits,
      entitlements,
      subscriptions,
    };
  }

  async searchUsers(query = '', limit = 30) {
    const safeLimit = Math.min(100, Math.max(1, Math.round(limit || 30)));
    const term = String(query || '').trim();
    return this.dataSource.query(
      `SELECT
         u.id, u.email, u."fullName", u."displayName", u.type, u."resumeStatus",
         coalesce(bp."lifetimeFree", false) AS "lifetimeFree",
         EXISTS (
           SELECT 1 FROM subscriptions s
           WHERE s."userId" = u.id AND s.status = 'ACTIVE' AND s."currentPeriodEnd" > now()
         ) AS "subscriptionActive",
         coalesce((SELECT sum(c.credits) FROM user_feature_credits c WHERE c."userId" = u.id), 0)::int AS "totalCredits"
       FROM users u
       LEFT JOIN user_billing_profiles bp ON bp."userId" = u.id
       WHERE ($1 = '' OR lower(coalesce(u.email,'')) LIKE lower('%' || $1 || '%')
          OR lower(coalesce(u."fullName",'')) LIKE lower('%' || $1 || '%')
          OR lower(coalesce(u."displayName",'')) LIKE lower('%' || $1 || '%'))
       ORDER BY u."updatedAt" DESC
       LIMIT ${safeLimit}`,
      [term],
    );
  }

  async getUserSupport(userId: string) {
    const userRows = await this.dataSource.query(
      `SELECT id, email, "fullName", "displayName", type, "resumeStatus", "createdAt", "updatedAt"
       FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    if (!userRows[0]) throw new NotFoundException('Usuário não encontrado.');

    const [billingRows, credits, entitlements, subscriptions, payments, ledger] = await Promise.all([
      this.dataSource.query(`SELECT * FROM user_billing_profiles WHERE "userId" = $1 LIMIT 1`, [userId]),
      this.payments.getCredits(userId),
      this.dataSource.query(
        `SELECT feature, "startsAt", "expiresAt", source, note, "grantedBy", "paymentId",
                ("expiresAt" > now()) AS active
         FROM user_feature_entitlements WHERE "userId" = $1 ORDER BY "expiresAt" DESC`,
        [userId],
      ),
      this.dataSource.query(
        `SELECT s.*, pp.name AS "productName"
         FROM subscriptions s LEFT JOIN payment_products pp ON pp.code = s."productCode"
         WHERE s."userId" = $1 ORDER BY s."updatedAt" DESC`,
        [userId],
      ),
      this.dataSource.query(
        `SELECT p.*, pp.name AS "productName"
         FROM payments p LEFT JOIN payment_products pp ON pp.code = p."productCode"
         WHERE p."userId" = $1 ORDER BY p."createdAt" DESC LIMIT 50`,
        [userId],
      ),
      this.dataSource.query(
        `SELECT * FROM user_feature_credit_ledger WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 100`,
        [userId],
      ),
    ]);

    return {
      user: userRows[0],
      billing: billingRows[0] || { userId, lifetimeFree: false, note: null },
      credits,
      entitlements,
      subscriptions,
      payments,
      creditLedger: ledger,
    };
  }

  async setLifetimeFree(userId: string, enabled: boolean, adminUserId: string, note?: string) {
    const userRows = await this.dataSource.query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [userId]);
    if (!userRows[0]) throw new NotFoundException('Usuário não encontrado.');
    const rows = await this.dataSource.query(
      `INSERT INTO user_billing_profiles
        ("userId", "lifetimeFree", note, "updatedBy", "lifetimeGrantedAt", "updatedAt")
       VALUES ($1,$2,$3,$4,CASE WHEN $2 THEN now() ELSE NULL END,now())
       ON CONFLICT ("userId") DO UPDATE SET
         "lifetimeFree" = EXCLUDED."lifetimeFree",
         note = EXCLUDED.note,
         "updatedBy" = EXCLUDED."updatedBy",
         "lifetimeGrantedAt" = CASE WHEN EXCLUDED."lifetimeFree" THEN coalesce(user_billing_profiles."lifetimeGrantedAt", now()) ELSE NULL END,
         "updatedAt" = now()
       RETURNING *`,
      [userId, enabled, String(note || '').trim().slice(0, 1000) || null, adminUserId],
    );
    return rows[0];
  }

  async setCreditBalance(userId: string, feature: FeatureCredit, quantity: number, adminUserId: string, note?: string) {
    const allowed: FeatureCredit[] = ['RESUME_REANALYSIS','RESUME_AI_IMPROVEMENT','RESUME_AI_IMPORT'];
    if (!allowed.includes(feature)) throw new BadRequestException('Tipo de consulta/crédito inválido.');
    const target = Math.min(999, Math.max(0, Math.round(Number(quantity) || 0)));
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT credits FROM user_feature_credits WHERE "userId" = $1 AND feature = $2 FOR UPDATE`,
        [userId, feature],
      );
      const current = Number(rows[0]?.credits || 0);
      const delta = target - current;
      await manager.query(
        `INSERT INTO user_feature_credits ("userId", feature, credits)
         VALUES ($1,$2,$3)
         ON CONFLICT ("userId", feature) DO UPDATE SET credits = EXCLUDED.credits, "updatedAt" = now()`,
        [userId, feature, target],
      );
      if (delta !== 0) {
        await manager.query(
          `INSERT INTO user_feature_credit_ledger
            ("userId", feature, delta, reason, note, "adminUserId", metadata)
           VALUES ($1,$2,$3,'ADMIN_SET',$4,$5,$6::jsonb)`,
          [userId, feature, delta, String(note || '').trim().slice(0, 1000) || null, adminUserId, JSON.stringify({ previousBalance: current, newBalance: target })],
        );
      }
      return { feature, credits: target, previousCredits: current, delta };
    });
  }

  async grantTimedFeature(userId: string, feature: TimedFeature, durationDays: number, adminUserId: string, note?: string) {
    if (!['JOB_MATCH_PREMIUM','RESUME_BOOST'].includes(feature)) throw new BadRequestException('Benefício temporário inválido.');
    const days = Math.min(3650, Math.max(1, Math.round(Number(durationDays) || 1)));
    const rows = await this.dataSource.query(
      `SELECT extend_feature_entitlement($1,$2,$3,NULL,'ADMIN',$4,$5) AS "expiresAt"`,
      [userId, feature, days, adminUserId, String(note || '').trim().slice(0, 1000) || null],
    );
    return { feature, durationDays: days, expiresAt: rows[0]?.expiresAt };
  }

  async revokeTimedFeature(userId: string, feature: TimedFeature, adminUserId: string, note?: string) {
    if (!['JOB_MATCH_PREMIUM','RESUME_BOOST'].includes(feature)) throw new BadRequestException('Benefício temporário inválido.');
    const rows = await this.dataSource.query(
      `UPDATE user_feature_entitlements SET "expiresAt" = now(), source = 'ADMIN', "grantedBy" = $3,
          note = $4, "updatedAt" = now()
       WHERE "userId" = $1 AND feature = $2 RETURNING *`,
      [userId, feature, adminUserId, String(note || '').trim().slice(0, 1000) || null],
    );
    return rows[0] || { userId, feature, active: false };
  }

  private async applyProductEntitlements(userId: string, product: any, adminUserId: string, source: string, note?: string) {
    const durationDays = Math.min(3650, Math.max(1, Number(product.durationDays || 30)));
    const benefits = Array.isArray(product.benefits) ? product.benefits : [];
    const granted: any[] = [];
    for (const benefit of benefits) {
      if (benefit?.kind !== 'ENTITLEMENT' || !['JOB_MATCH_PREMIUM','RESUME_BOOST'].includes(String(benefit?.feature))) continue;
      const rows = await this.dataSource.query(
        `SELECT extend_feature_entitlement($1,$2,$3,NULL,$4,$5,$6) AS "expiresAt"`,
        [userId, String(benefit.feature), durationDays, source, adminUserId, String(note || '').trim().slice(0, 1000) || null],
      );
      granted.push({ feature: benefit.feature, expiresAt: rows[0]?.expiresAt });
    }
    return granted;
  }

  async activateSubscription(userId: string, productCode: string, adminUserId: string, durationDays?: number, note?: string) {
    const product = await this.payments.findProduct(productCode, true);
    if (product.billingType !== 'RECURRING') throw new BadRequestException('Este produto não é uma assinatura recorrente.');
    const days = Math.min(3650, Math.max(1, Math.round(Number(durationDays || product.durationDays || 30))));
    const existingRows = await this.dataSource.query(
      `SELECT * FROM subscriptions WHERE "userId" = $1 AND "productCode" = $2 AND status IN ('ACTIVE','PAST_DUE') LIMIT 1`,
      [userId, productCode],
    );
    const existing = existingRows[0];
    const base = existing?.currentPeriodEnd && new Date(existing.currentPeriodEnd).getTime() > Date.now()
      ? new Date(existing.currentPeriodEnd)
      : new Date();
    const expiresAt = new Date(base.getTime() + days * 86400000);
    const rows = existing
      ? await this.dataSource.query(
          `UPDATE subscriptions SET status = 'ACTIVE', "currentPeriodEnd" = $2, source = 'ADMIN', "createdBy" = $3,
             metadata = coalesce(metadata,'{}'::jsonb) || $4::jsonb, "updatedAt" = now()
           WHERE id = $1 RETURNING *`,
          [existing.id, expiresAt, adminUserId, JSON.stringify({ supportNote: note || null })],
        )
      : await this.dataSource.query(
          `INSERT INTO subscriptions
            ("userId","productCode",status,"currentPeriodStart","currentPeriodEnd",source,"createdBy",metadata)
           VALUES ($1,$2,'ACTIVE',now(),$3,'ADMIN',$4,$5::jsonb) RETURNING *`,
          [userId, productCode, expiresAt, adminUserId, JSON.stringify({ supportNote: note || null })],
        );
    await this.applyProductEntitlements(userId, { ...product, durationDays: days }, adminUserId, 'ADMIN_SUBSCRIPTION', note);
    return rows[0];
  }

  async setSubscriptionStatus(userId: string, subscriptionId: string, status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED', adminUserId: string) {
    if (!['ACTIVE','PAST_DUE','CANCELED','EXPIRED'].includes(status)) throw new BadRequestException('Status de assinatura inválido.');
    const rows = await this.dataSource.query(
      `UPDATE subscriptions SET status = $3, "createdBy" = $4, "updatedAt" = now()
       WHERE id = $1 AND "userId" = $2 RETURNING *`,
      [subscriptionId, userId, status, adminUserId],
    );
    if (!rows[0]) throw new NotFoundException('Assinatura não encontrada.');
    return rows[0];
  }

  async activateLifetimeProduct(userId: string, productCode: string) {
    if (!(await this.isLifetimeFree(userId))) return null;
    const product = await this.payments.findProduct(productCode, true);
    const benefits = Array.isArray(product.benefits) ? product.benefits : [];
    const entitlementBenefits = benefits.filter((benefit: any) => benefit?.kind === 'ENTITLEMENT');
    if (!entitlementBenefits.length) return { lifetimeFree: true, product, activated: false };
    const durationDays = Number(product.durationDays || 30);
    const activated: any[] = [];
    for (const benefit of entitlementBenefits) {
      if (!['JOB_MATCH_PREMIUM','RESUME_BOOST'].includes(String(benefit.feature))) continue;
      const rows = await this.dataSource.query(
        `SELECT extend_feature_entitlement($1,$2,$3,NULL,'LIFETIME_FREE',NULL,'Ativação sem cobrança para conta vitalícia') AS "expiresAt"`,
        [userId, String(benefit.feature), durationDays],
      );
      activated.push({ feature: benefit.feature, expiresAt: rows[0]?.expiresAt });
    }
    return { lifetimeFree: true, product, activated };
  }
}
