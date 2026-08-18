import { Body, Controller, Post, Req } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('events')
  recordEvent(@Req() req: any, @Body() input: Record<string, unknown>) {
    const forwarded = typeof req.headers?.['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',')[0].trim() : '';
    return this.analytics.recordEvent(input, forwarded || req.ip || '');
  }
}
