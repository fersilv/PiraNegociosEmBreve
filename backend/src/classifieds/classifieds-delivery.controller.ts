import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsDeliveryDistanceService } from './classifieds-delivery-distance.service';
import { ClassifiedsDeliveryService } from './classifieds-delivery.service';

@Controller('classifieds/delivery')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsDeliveryController {
  constructor(
    private readonly delivery: ClassifiedsDeliveryService,
    private readonly distance: ClassifiedsDeliveryDistanceService,
  ) {}

  @Get('company/partners')
  companyPartners(@Req() req: any) {
    return this.delivery.companyPreferences(req.user.uid);
  }

  @Patch('company/partners/:partnerId')
  saveCompanyPartner(@Req() req: any, @Param('partnerId') partnerId: string, @Body() body: Record<string, unknown>) {
    return this.delivery.saveCompanyPreference(req.user.uid, partnerId, body);
  }

  @Post('quotes')
  async quote(@Req() req: any, @Body() body: Record<string, unknown>) {
    const { distanceMeters: _ignoredDistance, ...safeBody } = body;
    const derived = await this.distance.derive(req.user.uid, safeBody);
    return this.delivery.quote(req.user.uid, {
      ...safeBody,
      distanceMeters: derived.distanceMeters,
      distanceSource: derived.source,
      routeDurationSeconds: 'durationSeconds' in derived ? derived.durationSeconds : null,
      routeResolution: 'routeResolution' in derived ? derived.routeResolution : null,
    });
  }

  @Get('company/jobs')
  jobs(@Req() req: any) {
    return this.delivery.companyJobs(req.user.uid);
  }

  @Post('orders/:orderId/call-partner')
  callPartner(@Req() req: any, @Param('orderId') orderId: string) {
    return this.delivery.callPartner(req.user.uid, orderId);
  }

  @Patch('jobs/:jobId/status')
  transitionJob(@Req() req: any, @Param('jobId') jobId: string, @Body() body: Record<string, unknown>) {
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata as Record<string, unknown> : {};
    return this.delivery.transitionJob(req.user.uid, jobId, body.status, metadata);
  }
}
