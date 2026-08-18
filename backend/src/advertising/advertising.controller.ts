import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
