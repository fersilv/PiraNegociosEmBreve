import { Controller, Get, Param, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassifiedsService } from './classifieds.service';
import { CompanyClassifiedProfile } from './entities/company-classified-profile.entity';

@Controller('classifieds')
export class ClassifiedsPublicController {
  constructor(
    private readonly classifieds: ClassifiedsService,
    @InjectRepository(CompanyClassifiedProfile)
    private readonly companyProfiles: Repository<CompanyClassifiedProfile>,
  ) {}

  @Get('categories')
  categories() {
    return this.classifieds.categories();
  }

  @Get('listings')
  search(@Query() query: Record<string, unknown>) {
    return this.classifieds.search(query);
  }

  @Get('company/:companyId/listings')
  async companyListings(@Param('companyId') companyId: string) {
    const [items, profile] = await Promise.all([
      this.classifieds.companyPageListings(companyId),
      this.companyProfiles.findOne({ where: { companyId, status: 'ACTIVE' } }),
    ]);
    return {
      items,
      pageSectionLabel: profile?.pageSectionLabel || null,
    };
  }

  @Get('listings/:slug')
  detail(@Param('slug') slug: string) {
    return this.classifieds.getPublicBySlug(slug);
  }
}
