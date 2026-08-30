import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassifiedsAddressResolutionService } from './classifieds-address-resolution.service';
import { ClassifiedsCategoryTaxonomyService } from './classifieds-category-taxonomy.service';
import { ClassifiedsCommerceService } from './classifieds-commerce.service';
import { ClassifiedsDeliveryPreviewService } from './classifieds-delivery-preview.service';
import { ClassifiedsService } from './classifieds.service';
import { CompanyClassifiedProfile } from './entities/company-classified-profile.entity';

@Controller('classifieds')
export class ClassifiedsPublicController {
  constructor(
    private readonly classifieds: ClassifiedsService,
    private readonly taxonomy: ClassifiedsCategoryTaxonomyService,
    private readonly commerce: ClassifiedsCommerceService,
    private readonly addressResolution: ClassifiedsAddressResolutionService,
    private readonly deliveryPreview: ClassifiedsDeliveryPreviewService,
    @InjectRepository(CompanyClassifiedProfile)
    private readonly companyProfiles: Repository<CompanyClassifiedProfile>,
  ) {}

  @Get('categories')
  categories() {
    return this.taxonomy.categories();
  }

  @Get('address/cep/:zipCode')
  resolveAddressByCep(@Param('zipCode') zipCode: string) {
    return this.addressResolution.byCep(zipCode);
  }

  @Get('address/search')
  searchAddress(@Query() query: Record<string, unknown>) {
    return this.addressResolution.search(query);
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

  @Post('listings/:id/shipping-quote')
  shippingQuote(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.deliveryPreview.listingQuote(id, body);
  }

  @Get('listings/:slug')
  async detail(@Param('slug') slug: string) {
    const listing = await this.classifieds.getPublicBySlug(slug);
    await this.commerce.trackEvent(listing.id, 'VIEW');
    return listing;
  }

  @Post('listings/:id/events')
  async event(@Param('id') id: string, @Body() body: any) {
    const type = String(body?.type || '').toUpperCase();
    if (type === 'CONTACT_CLICK') await this.commerce.trackEvent(id, 'CONTACT_CLICK', null, null, { channel: String(body?.channel || '').slice(0, 40) });
    return { ok: true };
  }
}
