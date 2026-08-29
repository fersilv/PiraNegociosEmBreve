import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsCatalogAdminService } from './classifieds-catalog-admin.service';

@Controller('admin/classifieds-catalog')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class ClassifiedsCatalogAdminController {
  constructor(private readonly catalog: ClassifiedsCatalogAdminService) {}

  @Get('summary')
  summary() {
    return this.catalog.summary();
  }

  @Get('listings')
  listings(@Query() query: Record<string, unknown>) {
    return this.catalog.listings(query || {});
  }

  @Get('listings/:id')
  listing(@Param('id') id: string) {
    return this.catalog.listing(id);
  }

  @Patch('listings/:id')
  updateListing(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.catalog.updateListing(id, req.user.uid, body || {});
  }

  @Post('listings/:id/archive')
  archiveListing(@Req() req: any, @Param('id') id: string) {
    return this.catalog.archiveListing(id, req.user.uid);
  }

  @Post('listings/:id/restore')
  restoreListing(@Param('id') id: string) {
    return this.catalog.restoreListing(id);
  }

  @Delete('listings/:id')
  deleteListing(@Req() req: any, @Param('id') id: string) {
    return this.catalog.deleteListing(id, req.user.uid);
  }

  @Get('auctions')
  auctions(@Query() query: Record<string, unknown>) {
    return this.catalog.auctions(query || {});
  }

  @Post('auctions/:id/archive')
  archiveAuction(@Req() req: any, @Param('id') id: string) {
    return this.catalog.archiveAuction(id, req.user.uid);
  }

  @Post('auctions/:id/restore')
  restoreAuction(@Param('id') id: string) {
    return this.catalog.restoreAuction(id);
  }

  @Post('auctions/:id/cancel')
  cancelAuction(@Param('id') id: string) {
    return this.catalog.cancelAuction(id);
  }

  @Delete('auctions/:id')
  deleteAuction(@Req() req: any, @Param('id') id: string) {
    return this.catalog.deleteAuction(id, req.user.uid);
  }
}
