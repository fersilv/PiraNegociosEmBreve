import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsReviewsService } from './classifieds-reviews.service';

@Controller('classifieds/me/reviews')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsReviewsController {
  constructor(private readonly reviews: ClassifiedsReviewsService) {}

  @Get('eligible')
  eligible(@Req() req: any) {
    return this.reviews.eligible(req.user.uid);
  }

  @Get()
  mine(@Req() req: any) {
    return this.reviews.mine(req.user.uid);
  }

  @Post('orders/:orderId')
  submit(@Req() req: any, @Param('orderId') orderId: string, @Body() body: Record<string, unknown>) {
    return this.reviews.submit(req.user.uid, orderId, body || {});
  }
}

@Controller('classifieds/public/reviews')
export class ClassifiedsReviewsPublicController {
  constructor(private readonly reviews: ClassifiedsReviewsService) {}

  @Get('listings/:listingId')
  listing(@Param('listingId') listingId: string) {
    return this.reviews.publicListing(listingId);
  }

  @Get('companies/:companyId')
  company(@Param('companyId') companyId: string) {
    return this.reviews.publicCompany(companyId);
  }
}

@Controller('admin/classifieds-reviews')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class ClassifiedsReviewsAdminController {
  constructor(private readonly reviews: ClassifiedsReviewsService) {}

  @Get('pending')
  pending() {
    return this.reviews.pendingModeration();
  }

  @Patch(':reviewId')
  moderate(@Param('reviewId') reviewId: string, @Body() body: any) {
    return this.reviews.moderateManually(reviewId, body?.decision, body?.reason);
  }
}
