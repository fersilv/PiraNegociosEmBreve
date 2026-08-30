import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsAddressResolutionService } from './classifieds-address-resolution.service';
import { ClassifiedsCommerceSettingsService } from './classifieds-commerce-settings.service';

@Controller('classifieds/commerce')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsCommerceSettingsController {
  constructor(
    private readonly settings: ClassifiedsCommerceSettingsService,
    private readonly addressResolution: ClassifiedsAddressResolutionService,
  ) {}

  @Get('features')
  features() {
    return this.settings.features();
  }

  @Get('addresses')
  addresses(@Req() req: any) {
    return this.settings.addresses(req.user.uid);
  }

  @Post('addresses')
  async createAddress(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.settings.saveAddress(req.user.uid, await this.enrichAddress(body));
  }

  @Put('addresses/:id')
  async updateAddress(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.settings.saveAddress(req.user.uid, await this.enrichAddress(body), id);
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
  async createLocation(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.settings.saveLocation(req.user.uid, await this.enrichAddress(body));
  }

  @Put('company/locations/:id')
  async updateLocation(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.settings.saveLocation(req.user.uid, await this.enrichAddress(body), id);
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

  private async enrichAddress(body: Record<string, unknown>) {
    const zipCode = String(body.zipCode || '').replace(/\D/g, '').slice(0, 8);
    if (!/^\d{8}$/.test(zipCode)) return body;
    const resolved = await this.addressResolution.byCep(zipCode).catch(() => null);
    if (!resolved) return body;
    const text = (value: unknown) => String(value || '').trim();
    return {
      ...body,
      zipCode,
      street: text(body.street) || resolved.street,
      neighborhood: text(body.neighborhood) || resolved.neighborhood,
      city: text(body.city) || resolved.city,
      state: text(body.state).toUpperCase() || resolved.state,
      latitude: body.latitude ?? resolved.latitude,
      longitude: body.longitude ?? resolved.longitude,
      placeId: text(body.placeId) || (resolved.ibgeCityId ? `IBGE:${resolved.ibgeCityId}` : null),
    };
  }
}
