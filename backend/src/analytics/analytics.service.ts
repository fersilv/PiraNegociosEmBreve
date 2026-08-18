import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac } from 'crypto';
import { Repository } from 'typeorm';
import { AccountAccess } from './entities/account-access.entity';
import { VisitorEvent } from './entities/visitor-event.entity';

type ClientMeta = { deviceType: string; browser: string; operatingSystem: string };

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly eventRate = new Map<string, { count: number; resetAt: number }>();

  constructor(
    @InjectRepository(VisitorEvent) private readonly events: Repository<VisitorEvent>,
    @InjectRepository(AccountAccess) private readonly accountAccesses: Repository<AccountAccess>,
    private readonly config: ConfigService,
  ) {}

  private trim(value: unknown, max: number): string | null {
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
  }

  private meta(userAgent: string): ClientMeta {
    const value = userAgent.toLowerCase();
    return {
      deviceType: /ipad|tablet/.test(value) ? 'tablet' : /mobile|android|iphone/.test(value) ? 'mobile' : 'desktop',
      browser: value.includes('edg/') ? 'Edge' : value.includes('firefox/') ? 'Firefox' : value.includes('chrome/') ? 'Chrome' : value.includes('safari/') ? 'Safari' : 'Other',
      operatingSystem: value.includes('windows') ? 'Windows' : value.includes('android') ? 'Android' : /iphone|ipad|mac os/.test(value) ? 'Apple' : value.includes('linux') ? 'Linux' : 'Other',
    };
  }

  private hash(value: string): string | null {
    const secret = this.config.get<string>('ANALYTICS_HASH_SECRET');
    if (!secret) {
      this.logger.warn('ANALYTICS_HASH_SECRET não configurado: sinais de IP/dispositivo não serão persistidos.');
      return null;
    }
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  async recordEvent(input: Record<string, unknown>, clientIp = '') {
    const rateKey = clientIp || 'unknown';
    const now = Date.now();
    const window = this.eventRate.get(rateKey);
    if (!window || window.resetAt <= now) this.eventRate.set(rateKey, { count: 1, resetAt: now + 60_000 });
    else if (window.count >= 120) return { accepted: false };
    else window.count += 1;
    const visitorId = this.trim(input.visitorId, 128);
    const eventType = this.trim(input.eventType, 32);
    const path = this.trim(input.path, 512);
    if (!visitorId || !eventType || !path || !['PAGE_VIEW', 'ENGAGEMENT'].includes(eventType)) return { accepted: false };
    const duration = typeof input.durationSeconds === 'number' && Number.isInteger(input.durationSeconds)
      ? Math.max(0, Math.min(input.durationSeconds, 3600))
      : null;
    await this.events.save(this.events.create({
      visitorId, eventType, path, durationSeconds: duration,
      sessionId: this.trim(input.sessionId, 128), referrerOrigin: this.trim(input.referrerOrigin, 255),
      utmSource: this.trim(input.utmSource, 120), utmMedium: this.trim(input.utmMedium, 120), utmCampaign: this.trim(input.utmCampaign, 120),
      deviceType: this.trim(input.deviceType, 32), browser: this.trim(input.browser, 80), operatingSystem: this.trim(input.operatingSystem, 80),
    }));
    return { accepted: true };
  }

  async recordAccountAccess(userId: string, headers: Record<string, unknown>) {
    const forwarded = typeof headers['x-forwarded-for'] === 'string' ? headers['x-forwarded-for'].split(',')[0].trim() : '';
    const ip = forwarded || (typeof headers['x-real-ip'] === 'string' ? headers['x-real-ip'] : '');
    const userAgent = typeof headers['user-agent'] === 'string' ? headers['user-agent'].slice(0, 1000) : '';
    const ipHash = ip ? this.hash(ip) : null;
    const deviceHash = userAgent ? this.hash(userAgent) : null;
    const prior = deviceHash ? await this.accountAccesses.exists({ where: { userId, deviceHash } }) : false;
    const meta = this.meta(userAgent);
    await this.accountAccesses.save(this.accountAccesses.create({ userId, ipHash, deviceHash, isNewDevice: Boolean(deviceHash && !prior), ...meta }));
  }
}
