import { Controller, Get, Param, Query } from '@nestjs/common';
import { ClassifiedsService } from './classifieds.service';

@Controller('classifieds')
export class ClassifiedsPublicController {
  constructor(private readonly classifieds: ClassifiedsService) {}

  @Get('categories')
  categories() {
    return this.classifieds.categories();
  }

  @Get('listings')
  search(@Query() query: Record<string, unknown>) {
    return this.classifieds.search(query);
  }

  @Get('company/:companyId/listings')
  companyListings(@Param('companyId') companyId: string) {
    return this.classifieds.companyPageListings(companyId);
  }

  @Get('listings/:slug')
  detail(@Param('slug') slug: string) {
    return this.classifieds.getPublicBySlug(slug);
  }
}
