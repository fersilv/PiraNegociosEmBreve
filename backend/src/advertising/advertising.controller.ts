import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Or,
  Repository,
  DataSource,
} from 'typeorm';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { Advertisement } from './entities/advertisement.entity';
import { AdvertisingConfig } from './entities/advertising-config.entity';
import { Company } from '../companies/entities/company.entity';
import { User } from '../users/entities/user.entity';

@Controller()
export class AdvertisingController {
  constructor(
    @InjectRepository(Advertisement)
    private readonly advertisements: Repository<Advertisement>,
    @InjectRepository(AdvertisingConfig)
    private readonly configs: Repository<AdvertisingConfig>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  private async normalizeOwner(
    data: Partial<Advertisement>,
    current?: Advertisement,
  ) {
    // Registros antigos podem não ter responsável. Uma simples alteração de
    // status não deve impedir a administração desses anúncios legados.
    if (
      current &&
      data.companyId === undefined &&
      data.contractedByUserId === undefined
    ) {
      return {
        companyId: current.companyId || null,
        contractedByUserId: current.contractedByUserId || null,
      };
    }
    const companyId =
      data.companyId === undefined
        ? current?.companyId || null
        : data.companyId || null;
    const contractedByUserId =
      data.contractedByUserId === undefined
        ? current?.contractedByUserId || null
        : data.contractedByUserId || null;
    if (companyId && contractedByUserId)
      throw new BadRequestException(
        'Selecione uma empresa ou um usuário, não ambos.',
      );
    if (!companyId && !contractedByUserId)
      throw new BadRequestException(
        'Selecione a empresa ou o usuário responsável pelo anúncio.',
      );
    if (
      companyId &&
      !(await this.companies.exists({ where: { id: companyId } }))
    )
      throw new BadRequestException('Empresa responsável não encontrada.');
    if (
      contractedByUserId &&
      !(await this.users.exists({ where: { id: contractedByUserId } }))
    )
      throw new BadRequestException('Usuário responsável não encontrado.');
    return { companyId, contractedByUserId };
  }

  // Public marketing placements: expose only fields needed by the frontend.
  // Billing rates and contracting users are deliberately never returned here.
  @Get('ads/active')
  async activeFeedAds() {
    const rows = await this.publicAds();
    const safeUrl = (value: unknown, allowRelative = false): string | null => {
      if (typeof value !== 'string' || value.length > 2048) return null;
      if (allowRelative && /^\/(?!\/)[A-Za-z0-9/_?=&.%-]+$/.test(value)) return value;
      try {
        const url = new URL(value);
        return url.protocol === 'https:' ? url.href : null;
      } catch { return null; }
    };
    return rows.map((ad) => ({
      id: ad.id,
      title: ad.title,
      description: ad.description,
      imageUrl: safeUrl(ad.imageURL, true),
      link: safeUrl(ad.link, true),
      buttonText: 'Saiba mais',
    })).filter((ad) => ad.link);
  }

  private async recordFeedEvent(
    id: string,
    body: Record<string, unknown> | undefined,
    kind: 'impression' | 'click',
  ) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      throw new BadRequestException('Anúncio inválido');
    const placement = String(body?.placement || '').trim();
    const slot = Number(body?.slot);
    if (!/^[a-z0-9_-]{1,100}$/.test(placement) || !Number.isInteger(slot) || slot < 0 || slot > 100)
      throw new BadRequestException('Evento de publicidade inválido');
    // Aggregate daily event counts only; no IP address, user ID, cookies or fingerprint.
    // These are raw interaction events, not verified billable impressions.
    await this.dataSource.query(
      `INSERT INTO ad_daily_stats(ad_id,event_day,placement,slot,impressions,clicks)
       SELECT $1::uuid,(now() AT TIME ZONE 'UTC')::date,$2::varchar,$3::integer,$4::bigint,$5::bigint
       FROM advertisements a
       WHERE a.id=$1::uuid AND a.active=true
         AND (a."startsAt" IS NULL OR a."startsAt"<=now())
         AND (a."endsAt" IS NULL OR a."endsAt">=now())
       ON CONFLICT(ad_id,event_day,placement,slot) DO UPDATE SET
         impressions=ad_daily_stats.impressions+EXCLUDED.impressions,
         clicks=ad_daily_stats.clicks+EXCLUDED.clicks`,
      [id,placement,slot,kind==='impression'?1:0,kind==='click'?1:0],
    );
  }

  @Post('ads/:id/impression')
  @HttpCode(204)
  async feedImpression(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    await this.recordFeedEvent(id,body,'impression');
  }

  @Post('ads/:id/click')
  @HttpCode(204)
  async feedClick(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    await this.recordFeedEvent(id,body,'click');
  }

  @Get('ads')
  async publicAds() {
    const now = new Date();
    return this.advertisements.find({
      where: {
        active: true,
        startsAt: Or(IsNull(), LessThanOrEqual(now)),
        endsAt: Or(IsNull(), MoreThanOrEqual(now)),
      },
      order: { createdAt: 'DESC' },
    });
  }

  @Get('configs/advertising')
  async publicConfig() {
    return (
      (await this.configs.findOne({ where: { id: 'default' } })) || {
        googleAdsEnabled: false,
        googleAdsClient: null,
        googleAdsSlotLeaderboard: null,
        googleAdsSlotRectangle: null,
      }
    );
  }

  @Get('admin/ads')
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  listAds() {
    return this.advertisements.find({ order: { createdAt: 'DESC' } });
  }

  @Post('admin/ads')
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  async createAd(@Body() data: Partial<Advertisement>) {
    const title = data.title?.trim();
    const imageURL = data.imageURL?.trim();
    const link = data.link?.trim();
    if (
      !title ||
      !imageURL ||
      !link ||
      !['leaderboard', 'rectangle', 'sidebar', 'carousel'].includes(
        data.type || '',
      )
    )
      throw new BadRequestException(
        'Título, imagem, link e espaço do anúncio são obrigatórios.',
      );
    const owner = await this.normalizeOwner(data);
    return this.advertisements.save(
      this.advertisements.create({
        ...data,
        ...owner,
        title,
        imageURL,
        link,
        active: data.active !== false,
      }),
    );
  }

  @Put('admin/ads/:id')
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  async updateAd(
    @Param('id') id: string,
    @Body() data: Partial<Advertisement>,
  ) {
    const ad = await this.advertisements.findOne({ where: { id } });
    if (!ad) throw new BadRequestException('Anúncio não encontrado.');
    const owner = await this.normalizeOwner(data, ad);
    Object.assign(ad, data, owner);
    return this.advertisements.save(ad);
  }

  @Put('admin/advertising-config')
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  async updateConfig(@Body() data: Partial<AdvertisingConfig>) {
    const config =
      (await this.configs.findOne({ where: { id: 'default' } })) ||
      this.configs.create({ id: 'default' });
    Object.assign(config, {
      googleAdsEnabled: Boolean(data.googleAdsEnabled),
      googleAdsClient:
        typeof data.googleAdsClient === 'string'
          ? data.googleAdsClient.trim() || null
          : null,
      googleAdsSlotLeaderboard:
        typeof data.googleAdsSlotLeaderboard === 'string'
          ? data.googleAdsSlotLeaderboard.trim() || null
          : null,
      googleAdsSlotRectangle:
        typeof data.googleAdsSlotRectangle === 'string'
          ? data.googleAdsSlotRectangle.trim() || null
          : null,
    });
    return this.configs.save(config);
  }
}