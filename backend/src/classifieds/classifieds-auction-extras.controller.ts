import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsAuctionEngagementService } from './classifieds-auction-engagement.service';
import { ClassifiedsAuctionPaymentPolicyService } from './classifieds-auction-payment-policy.service';

@Controller('classifieds/auctions')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsAuctionExtrasController {
  constructor(
    private readonly engagement: ClassifiedsAuctionEngagementService,
    private readonly paymentPolicy: ClassifiedsAuctionPaymentPolicyService,
  ) {}

  @Get(':auctionId/reminder')
  reminderStatus(@Req() req: any, @Param('auctionId') auctionId: string) {
    return this.engagement.reminderStatus(req.user.uid, auctionId);
  }

  @Post(':auctionId/reminder')
  reminder(@Req() req: any, @Param('auctionId') auctionId: string, @Body() body: any) {
    return this.engagement.setReminder(req.user.uid, auctionId, body?.enabled);
  }

  @Post(':auctionId/presence')
  presence(@Req() req: any, @Param('auctionId') auctionId: string) {
    return this.engagement.presence(req.user.uid, auctionId);
  }

  @Get(':auctionId/settlement')
  buyerSettlement(@Req() req: any, @Param('auctionId') auctionId: string) {
    return this.paymentPolicy.buyerConfig(req.user.uid, auctionId);
  }

  @Post(':auctionId/settlement/checkout')
  checkout(@Req() req: any, @Param('auctionId') auctionId: string, @Body() body: Record<string, any>) {
    return this.paymentPolicy.createPayment(req.user.uid, auctionId, body || {});
  }

  @Get(':auctionId/seller-settlement')
  sellerSettlement(@Req() req: any, @Param('auctionId') auctionId: string) {
    return this.paymentPolicy.sellerConfig(req.user.uid, auctionId);
  }

  @Patch(':auctionId/seller-settlement')
  configureSeller(@Req() req: any, @Param('auctionId') auctionId: string, @Body() body: Record<string, unknown>) {
    return this.paymentPolicy.configureSeller(req.user.uid, auctionId, body || {});
  }
}
