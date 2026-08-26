import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsAuctionManagementService } from './classifieds-auction-management.service';

@Controller('classifieds/me/auction-management')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsAuctionManagementController {
  constructor(private readonly management: ClassifiedsAuctionManagementService) {}

  @Get()
  list(@Req() req: any) {
    return this.management.list(req.user.uid);
  }

  @Get(':auctionId')
  detail(@Req() req: any, @Param('auctionId') auctionId: string) {
    return this.management.detail(req.user.uid, auctionId);
  }

  @Patch(':auctionId/settlement')
  updateSettlement(
    @Req() req: any,
    @Param('auctionId') auctionId: string,
    @Body() body: { status?: unknown },
  ) {
    return this.management.updateSettlement(req.user.uid, auctionId, body?.status);
  }
}
