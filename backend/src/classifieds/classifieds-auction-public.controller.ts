import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ClassifiedsAuctionPublicService } from './classifieds-auction-public.service';

@Controller('classifieds/public/auctions')
export class ClassifiedsAuctionPublicController {
  constructor(private readonly auctions: ClassifiedsAuctionPublicService) {}

  @Get()
  list() {
    return this.auctions.list();
  }

  @Get(':auctionId')
  detail(@Param('auctionId') auctionId: string) {
    return this.auctions.detail(auctionId);
  }

  @Post('for-listings')
  forListings(@Body() body: { listingIds?: string[] }) {
    return this.auctions.forListings(Array.isArray(body?.listingIds) ? body.listingIds : []);
  }
}
