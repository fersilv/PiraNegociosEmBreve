import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsDeliveryService } from './classifieds-delivery.service';

@Controller('classifieds/delivery-finance')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsDeliveryFinanceController {
  constructor(private readonly delivery: ClassifiedsDeliveryService) {}

  @Get('company')
  company(@Req() req: any) {
    return this.delivery.wallet(req.user.uid);
  }
}
