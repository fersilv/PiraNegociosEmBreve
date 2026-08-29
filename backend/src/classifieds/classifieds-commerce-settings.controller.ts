import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsCommerceSettingsService } from './classifieds-commerce-settings.service';

@Controller('classifieds/commerce')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsCommerceSettingsController {
  constructor(private readonly settings: ClassifiedsCommerceSettingsService) {}

  @Get('features')
  features() {
    return this.settings.features();
  }

  @Get('addresses')
  addresses(@Req() req: any) {
    return this.settings.addresses(req.user.uid);
  }

  @Post('addresses')
  createAddress(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.settings.saveAddress(req.user.uid, body);
  }

  @Put('addresses/:id')
  updateAddress(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.settings.saveAddress(req.user.uid, body, id);
  }

  @Post('addresses/:id/default')
  setDefaultAddress(@Req() req: any, @Param('id') id: string) {
    return this.settings.setDefaultAddress(req.user.uid, id);
  }

  @Delete('addresses/:id')
  deactivateAddress(@Req() req: any, @Param('id') id: string) {
    return this.settings.deactivateAddress(req.user.uid, id);
  }

  @Get('company/settings')
  companySettings(@Req() req: any) {
    return this.settings.companySettings(req.user.uid);
  }

  @Patch('company/settings')
  saveCompanySettings(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.settings.saveCompanySettings(req.user.uid, body);
  }

  @Get('company/locations')
  locations(@Req() req: any) {
    return this.settings.locations(req.user.uid);
  }

  @Post('company/locations')
  createLocation(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.settings.saveLocation(req.user.uid, body);
  }

  @Put('company/locations/:id')
  updateLocation(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.settings.saveLocation(req.user.uid, body, id);
  }

  @Delete('company/locations/:id')
  deactivateLocation(@Req() req: any, @Param('id') id: string) {
    return this.settings.deactivateLocation(req.user.uid, id);
  }

  @Get('listings/:listingId/shipping')
  listingShipping(@Req() req: any, @Param('listingId') listingId: string) {
    return this.settings.listingShipping(req.user.uid, listingId);
  }

  @Patch('listings/:listingId/shipping')
  saveListingShipping(@Req() req: any, @Param('listingId') listingId: string, @Body() body: Record<string, unknown>) {
    return this.settings.saveListingShipping(req.user.uid, listingId, body);
  }
}
