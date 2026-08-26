import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsAuctionEngagementService } from './classifieds-auction-engagement.service';
import { ClassifiedsAuctionSettlementService } from './classifieds-auction-settlement.service';

@Controller('classifieds/auctions')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsAuctionExtrasController {
  constructor(
    private readonly engagement: ClassifiedsAuctionEngagementService,
    private readonly settlement: ClassifiedsAuctionSettlementService,
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
    return this.settlement.buyerConfig(req.user.uid, auctionId);
  }

  @Post(':auctionId/settlement/checkout')
  checkout(@Req() req: any, @Param('auctionId') auctionId: string, @Body() body: Record<string, any>) {
    return this.settlement.createPayment(req.user.uid, auctionId, body || {});
  }

  @Get(':auctionId/seller-settlement')
  sellerSettlement(@Req() req: any, @Param('auctionId') auctionId: string) {
    return this.settlement.sellerConfig(req.user.uid, auctionId);
  }

  @Patch(':auctionId/seller-settlement')
  configureSeller(@Req() req: any, @Param('auctionId') auctionId: string, @Body() body: Record<string, unknown>) {
    return this.settlement.configureSeller(req.user.uid, auctionId, body || {});
  }
}
