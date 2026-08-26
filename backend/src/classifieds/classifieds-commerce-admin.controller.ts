import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { FirebaseAuthGuard } from '../auth/auth.guard';

@Controller('admin/classifieds-commerce')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class ClassifiedsCommerceAdminController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('fee-rules')
  async feeRules() {
    const rows = await this.dataSource.query(
      `SELECT r.*, c.name AS "companyName"
       FROM classified_commerce_fee_rules r
       LEFT JOIN companies c ON c.id = r."companyId"
       ORDER BY CASE r.scope WHEN 'PLAN' THEN 0 ELSE 1 END,
                CASE r.plan WHEN 'FREE' THEN 0 WHEN 'PLUS' THEN 1 WHEN 'ELITE' THEN 2 ELSE 3 END,
                c.name NULLS LAST`,
    ).catch(() => []);
    return rows.map((row: any) => this.presentRule(row));
  }

  @Patch('fee-rules/plans/:plan')
  async savePlanRule(@Param('plan') planRaw: string, @Body() body: Record<string, unknown>) {
    const plan = this.plan(planRaw);
    const rule = this.cleanRule(body);
    const rows = await this.dataSource.query(
      `INSERT INTO classified_commerce_fee_rules
        (scope,plan,"companyId","rateBps","minimumFeeCents","maximumFeeCents",enabled,"updatedAt")
       VALUES ('PLAN',$1,NULL,$2,$3,$4,$5,now())
       ON CONFLICT (plan) WHERE scope = 'PLAN' DO UPDATE SET
         "rateBps"=EXCLUDED."rateBps",
         "minimumFeeCents"=EXCLUDED."minimumFeeCents",
         "maximumFeeCents"=EXCLUDED."maximumFeeCents",
         enabled=EXCLUDED.enabled,
         "updatedAt"=now()
       RETURNING *`,
      [plan, rule.rateBps, rule.minimumFeeCents, rule.maximumFeeCents, rule.enabled],
    );
    return this.presentRule(rows[0]);
  }

  @Patch('fee-rules/companies/:companyId')
  async saveCompanyRule(@Param('companyId') companyId: string, @Body() body: Record<string, unknown>) {
    const companies = await this.dataSource.query(`SELECT id,name FROM companies WHERE id=$1 LIMIT 1`, [companyId]);
    if (!companies[0]) throw new BadRequestException('Empresa não encontrada.');
    const rule = this.cleanRule(body);
    const rows = await this.dataSource.query(
      `INSERT INTO classified_commerce_fee_rules
        (scope,plan,"companyId","rateBps","minimumFeeCents","maximumFeeCents",enabled,"updatedAt")
       VALUES ('COMPANY',NULL,$1,$2,$3,$4,$5,now())
       ON CONFLICT ("companyId") WHERE scope = 'COMPANY' DO UPDATE SET
         "rateBps"=EXCLUDED."rateBps",
         "minimumFeeCents"=EXCLUDED."minimumFeeCents",
         "maximumFeeCents"=EXCLUDED."maximumFeeCents",
         enabled=EXCLUDED.enabled,
         "updatedAt"=now()
       RETURNING *`,
      [companyId, rule.rateBps, rule.minimumFeeCents, rule.maximumFeeCents, rule.enabled],
    );
    return this.presentRule({ ...rows[0], companyName: companies[0].name });
  }

  @Delete('fee-rules/companies/:companyId')
  async removeCompanyRule(@Param('companyId') companyId: string) {
    const result = await this.dataSource.query(
      `DELETE FROM classified_commerce_fee_rules
       WHERE scope='COMPANY' AND "companyId"=$1 RETURNING id`,
      [companyId],
    );
    return { removed: Boolean(result[0]?.id) };
  }

  @Get('companies')
  async companies(@Query('q') queryRaw?: string) {
    const q = String(queryRaw || '').trim();
    if (q.length < 2) return [];
    const like = `%${q.replace(/[%_]/g, '')}%`;
    return this.dataSource.query(
      `SELECT id,name,"verificationStatus","isVerified",city,state
       FROM companies
       WHERE name ILIKE $1 OR cnpj ILIKE $1 OR cpf ILIKE $1
       ORDER BY "isVerified" DESC, name ASC LIMIT 30`,
      [like],
    );
  }

  private cleanRule(body: Record<string, unknown>) {
    const percentage = Number(String(body.percentage ?? '').replace(',', '.'));
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new BadRequestException('A porcentagem deve ficar entre 0% e 100%.');
    }
    const minimumFeeCents = this.cents(body.minimumFeeCents, 'Taxa mínima inválida.');
    const maximumFeeCents = body.maximumFeeCents === null || body.maximumFeeCents === undefined || body.maximumFeeCents === ''
      ? null
      : this.cents(body.maximumFeeCents, 'Teto máximo inválido.');
    if (maximumFeeCents !== null && maximumFeeCents < minimumFeeCents) {
      throw new BadRequestException('O teto máximo não pode ser menor que a taxa mínima.');
    }
    return {
      rateBps: Math.round(percentage * 100),
      minimumFeeCents,
      maximumFeeCents,
      enabled: body.enabled !== false,
    };
  }

  private plan(value: string): 'FREE' | 'PLUS' | 'ELITE' {
    const plan = String(value || '').toUpperCase();
    if (!['FREE','PLUS','ELITE'].includes(plan)) throw new BadRequestException('Plano inválido.');
    return plan as 'FREE' | 'PLUS' | 'ELITE';
  }

  private cents(value: unknown, message: string) {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000) throw new BadRequestException(message);
    return Math.round(n);
  }

  private presentRule(row: any) {
    return {
      id: row.id,
      scope: row.scope,
      plan: row.plan || null,
      companyId: row.companyId || null,
      companyName: row.companyName || null,
      rateBps: row.rateBps == null ? null : Number(row.rateBps),
      percentage: row.rateBps == null ? null : Number(row.rateBps) / 100,
      minimumFeeCents: Number(row.minimumFeeCents || 0),
      maximumFeeCents: row.maximumFeeCents == null ? null : Number(row.maximumFeeCents),
      enabled: row.enabled !== false,
      updatedAt: row.updatedAt || null,
    };
  }
}
