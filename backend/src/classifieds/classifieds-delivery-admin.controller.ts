import { Body, Controller, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsDeliveryService } from './classifieds-delivery.service';

@Controller('admin/classifieds-delivery')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class ClassifiedsDeliveryAdminController {
  constructor(private readonly delivery: ClassifiedsDeliveryService) {}

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
}
