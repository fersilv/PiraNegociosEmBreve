import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { WhatsAppPhoneVerificationService } from './whatsapp-phone-verification.service';

@Controller('whatsapp/phone')
@UseGuards(FirebaseAuthGuard)
export class WhatsAppPhoneVerificationController {
  constructor(private readonly verification: WhatsAppPhoneVerificationService) {}

  @Get('status')
  status(@Req() req: any) {
    return this.verification.status(req.user.uid);
  }

  @Post('request-otp')
  requestOtp(@Req() req: any, @Body() body: { phone?: string }) {
    return this.verification.request(req.user.uid, String(body?.phone || ''));
  }

  @Post('verify-otp')
  verifyOtp(@Req() req: any, @Body() body: { phone?: string; code?: string }) {
    return this.verification.verify(req.user.uid, String(body?.phone || ''), String(body?.code || ''));
  }
}
