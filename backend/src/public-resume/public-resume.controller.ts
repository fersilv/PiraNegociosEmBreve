import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { PublicResumeService } from './public-resume.service';

@Controller('public-resume')
export class PublicResumeController {
  constructor(private readonly publicResume: PublicResumeService) {}

  @Post('session')
  createSession(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.publicResume.createSession(body || {}, {
      userAgent: String(req.headers?.['user-agent'] || ''),
      referrer: String(req.headers?.referer || req.headers?.referrer || ''),
    });
  }

  @Get('catalog')
  catalog() {
    return this.publicResume.catalog();
  }

  @Get(':sessionId')
  getSession(
    @Param('sessionId') sessionId: string,
    @Headers('x-public-resume-token') token: string,
  ) {
    return this.publicResume.getSession(sessionId, token);
  }

  @Post(':sessionId/events')
  event(
    @Param('sessionId') sessionId: string,
    @Headers('x-public-resume-token') token: string,
    @Body() body: { type?: unknown; metadata?: unknown },
  ) {
    return this.publicResume.track(sessionId, token, body?.type, body?.metadata);
  }

  @Post(':sessionId/checkout')
  checkout(
    @Param('sessionId') sessionId: string,
    @Headers('x-public-resume-token') token: string,
    @Body() body: { productCode?: unknown; payer?: Record<string, string> },
  ) {
    return this.publicResume.createCheckout(sessionId, token, body || {});
  }

  @Get(':sessionId/orders/:orderId')
  order(
    @Param('sessionId') sessionId: string,
    @Param('orderId') orderId: string,
    @Headers('x-public-resume-token') token: string,
  ) {
    return this.publicResume.getOrder(sessionId, token, orderId);
  }

  @Post(':sessionId/orders/:orderId/unlock-watermark')
  unlockWatermark(
    @Param('sessionId') sessionId: string,
    @Param('orderId') orderId: string,
    @Headers('x-public-resume-token') token: string,
  ) {
    return this.publicResume.unlockWatermark(sessionId, token, orderId);
  }

  @Post(':sessionId/ai/review')
  review(
    @Param('sessionId') sessionId: string,
    @Headers('x-public-resume-token') token: string,
    @Body() body: { orderId?: string; profile?: unknown },
  ) {
    return this.publicResume.reviewWithAi(sessionId, token, String(body?.orderId || ''), body?.profile || {});
  }

  @Post(':sessionId/ai/improve')
  improve(
    @Param('sessionId') sessionId: string,
    @Headers('x-public-resume-token') token: string,
    @Body() body: { orderId?: string; profile?: unknown },
  ) {
    return this.publicResume.improveWithAi(sessionId, token, String(body?.orderId || ''), body?.profile || {});
  }
}

@Controller('public-resume-account')
@UseGuards(FirebaseAuthGuard)
export class PublicResumeAccountController {
  constructor(private readonly publicResume: PublicResumeService) {}

  @Post('link')
  link(
    @Req() req: any,
    @Body() body: { sessionId?: string; token?: string },
  ) {
    return this.publicResume.linkAccount(
      String(body?.sessionId || ''),
      String(body?.token || ''),
      req.user.uid,
    );
  }
}

@Controller('admin/public-resume')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminPublicResumeController {
  constructor(private readonly publicResume: PublicResumeService) {}

  @Get('summary')
  summary(@Query('days') days?: string) {
    return this.publicResume.adminSummary(Number(days || 30));
  }
}
