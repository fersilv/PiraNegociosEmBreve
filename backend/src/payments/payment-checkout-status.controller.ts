import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { PaymentCheckoutStatusService } from './payment-checkout-status.service';

@Controller('payments')
@UseGuards(FirebaseAuthGuard)
export class PaymentCheckoutStatusController {
  constructor(private readonly statusService: PaymentCheckoutStatusService) {}

  @Get(':paymentId/status')
  status(@Req() req: any, @Param('paymentId') paymentId: string) {
    return this.statusService.getForUser(req.user.uid, paymentId);
  }
}
