import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { PaymentsService, type FeatureCredit } from './payments.service';

@Controller('payments')
@UseGuards(FirebaseAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('catalog')
  getCatalog() {
    return this.payments.listCatalog(false);
  }

  @Get('me')
  getMine(@Req() req: any) {
    return this.payments.listUserPayments(req.user.uid);
  }

  @Get('me/credits')
  getMyCredits(@Req() req: any) {
    return this.payments.getCredits(req.user.uid);
  }

  @Post('pix')
  createPix(@Req() req: any, @Body() body: { productCode?: string }) {
    const productCode = String(body?.productCode || '').trim();
    if (!productCode) throw new BadRequestException('Informe o produto que deseja comprar.');
    return this.payments.createPixPayment(req.user.uid, productCode);
  }

  @Get('me/resume-history')
  async getResumeHistory(@Req() req: any) {
    const [analyses, improvements, publications] = await Promise.all([
      this.payments.listAnalysisHistory(req.user.uid),
      this.payments.listImprovementHistory(req.user.uid),
      this.payments.listPublicationHistory(req.user.uid),
    ]);
    return { analyses, improvements, publications };
  }
}

@Controller('admin/payments')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('products')
  getProducts() {
    return this.payments.listCatalog(true);
  }

  @Patch('products/:code')
  updateProduct(@Param('code') code: string, @Body() body: Record<string, unknown>) {
    return this.payments.updateProduct(code, body || {});
  }

  @Get()
  list(@Query('limit') limit?: string) {
    return this.payments.listAllPayments(Number(limit || 200));
  }

  @Get('summary')
  summary() {
    return this.payments.paymentSummary();
  }

  @Post(':id/confirm')
  confirm(@Req() req: any, @Param('id') id: string) {
    return this.payments.confirmPayment(id, {
      confirmedByAdmin: req.user.uid,
      confirmationMode: 'ADMIN_MANUAL',
    });
  }

  @Post(':id/simulate')
  simulate(@Req() req: any, @Param('id') id: string) {
    return this.payments.simulatePayment(id, req.user.uid);
  }

  @Post('credits/:userId')
  grantCredit(
    @Param('userId') userId: string,
    @Body() body: { feature?: FeatureCredit; quantity?: number },
  ) {
    const feature = String(body?.feature || '') as FeatureCredit;
    if (!['RESUME_REANALYSIS', 'RESUME_AI_IMPROVEMENT', 'RESUME_AI_IMPORT'].includes(feature)) {
      throw new BadRequestException('Recurso de crédito inválido.');
    }
    return this.payments.grantCredit(userId, feature, Number(body?.quantity || 1));
  }
}
