import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsDeliveryService } from './classifieds-delivery.service';

@Controller('admin/classifieds-delivery')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class ClassifiedsDeliveryAdminController {
  constructor(
    private readonly delivery: ClassifiedsDeliveryService,
    private readonly dataSource: DataSource,
  ) {}

  @Get('partners')
  partners() {
    return this.delivery.adminPartners();
  }

  @Post('partners')
  createPartner(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.delivery.adminSavePartner(req.user.uid, body);
  }

  @Put('partners/:id')
  updatePartner(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.delivery.adminSavePartner(req.user.uid, body, id);
  }

  @Get('partners/:id/rate-tables')
  rateTables(@Param('id') id: string) {
    return this.delivery.adminRateTables(id);
  }

  @Post('partners/:id/rate-tables')
  createRateTable(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.delivery.adminCreateRateTable(req.user.uid, id, body);
  }

  @Post('rate-tables/:id/rules')
  createRateRule(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.delivery.adminCreateRateRule(id, body);
  }

  @Put('rate-rules/:id')
  async updateRateRule(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    const current = await this.dataSource.query(
      `SELECT id FROM delivery_partner_rate_rules WHERE id=$1 LIMIT 1`,
      [id],
    );
    if (!current[0]) throw new NotFoundException('Regra de frete não encontrada.');

    const rows = await this.dataSource.query(
      `UPDATE delivery_partner_rate_rules SET
         priority=$2,
         city=$3,
         state=$4,
         neighborhood=$5,
         "zipCodeStart"=$6,
         "zipCodeEnd"=$7,
         "minDistanceMeters"=$8,
         "maxDistanceMeters"=$9,
         "fixedPriceCents"=$10,
         "minimumPriceCents"=$11,
         "perKmCents"=$12,
         "roundTripAdditionalCents"=$13,
         "weightAdditionalPerKgCents"=$14,
         "maxWeightGrams"=$15,
         "maxLengthCm"=$16,
         "maxWidthCm"=$17,
         "maxHeightCm"=$18,
         "maxVolumeCm3"=$19,
         "estimatedMinutes"=$20
       WHERE id=$1 RETURNING *`,
      [
        id,
        this.int(body.priority, 0, 100000, 100),
        this.text(body.city, 120),
        this.text(body.state, 2)?.toUpperCase() || null,
        this.text(body.neighborhood, 140),
        this.digits(body.zipCodeStart),
        this.digits(body.zipCodeEnd),
        this.nullNonNegativeInt(body.minDistanceMeters),
        this.nullNonNegativeInt(body.maxDistanceMeters),
        this.nullNonNegativeInt(body.fixedPriceCents),
        this.int(body.minimumPriceCents, 0, 100_000_000, 0),
        this.int(body.perKmCents, 0, 100_000_000, 0),
        this.int(body.roundTripAdditionalCents, 0, 100_000_000, 0),
        this.int(body.weightAdditionalPerKgCents, 0, 100_000_000, 0),
        this.nullNonNegativeInt(body.maxWeightGrams),
        this.nullNumber(body.maxLengthCm),
        this.nullNumber(body.maxWidthCm),
        this.nullNumber(body.maxHeightCm),
        this.nullNumber(body.maxVolumeCm3),
        this.nullNonNegativeInt(body.estimatedMinutes),
      ],
    );
    return rows[0];
  }

  @Delete('rate-rules/:id')
  async deleteRateRule(@Param('id') id: string) {
    const rows = await this.dataSource.query(
      `SELECT r.id,
              EXISTS(SELECT 1 FROM delivery_quotes q WHERE q."rateRuleId"=r.id LIMIT 1) AS "hasQuotes"
       FROM delivery_partner_rate_rules r WHERE r.id=$1 LIMIT 1`,
      [id],
    );
    const rule = rows[0];
    if (!rule) throw new NotFoundException('Regra de frete não encontrada.');
    if (rule.hasQuotes === true) {
      throw new BadRequestException('Esta regra já foi usada em uma cotação e faz parte do histórico. Crie uma nova versão da tabela em vez de excluí-la.');
    }
    await this.dataSource.query(`DELETE FROM delivery_partner_rate_rules WHERE id=$1`, [id]);
    return { deleted: true, id };
  }

  @Get('dashboard')
  dashboard() {
    return this.delivery.adminDashboard();
  }

  @Post('companies/:companyId/wallet-credit')
  creditWallet(@Req() req: any, @Param('companyId') companyId: string, @Body() body: Record<string, unknown>) {
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata as Record<string, unknown> : {};
    return this.delivery.adminCreditWallet(req.user.uid, companyId, body.amountCents, metadata);
  }

  @Post('partners/:partnerId/payouts')
  createPayout(@Req() req: any, @Param('partnerId') partnerId: string, @Body() body: Record<string, unknown>) {
    return this.delivery.adminCreatePayout(req.user.uid, partnerId, body.amountCents);
  }

  @Patch('payouts/:id/paid')
  markPayoutPaid(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.delivery.adminMarkPayoutPaid(req.user.uid, id, body.providerTransferId);
  }

  private int(value: unknown, min: number, max: number, fallback: number) {
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
  }

  private nullNonNegativeInt(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  private nullNumber(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null;
  }

  private text(value: unknown, max: number) {
    return String(value || '').trim().slice(0, max) || null;
  }

  private digits(value: unknown) {
    return String(value || '').replace(/\D/g, '').slice(0, 8) || null;
  }
}
