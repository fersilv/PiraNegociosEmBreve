import { Body, Controller, Delete, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsLifecycleService } from './classifieds-lifecycle.service';

@Controller('classifieds/me/lifecycle')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsLifecycleController {
  constructor(private readonly lifecycle: ClassifiedsLifecycleService) {}

  @Post('listings/:id/archive')
  archiveListing(@Req() req: any, @Param('id') id: string) {
    return this.lifecycle.archiveListing(req.user.uid, id);
  }

  @Post('listings/:id/restore')
  restoreListing(@Req() req: any, @Param('id') id: string) {
    return this.lifecycle.restoreListing(req.user.uid, id);
  }

  @Post('listings/:id/republish')
  republishListing(@Req() req: any, @Param('id') id: string) {
    return this.lifecycle.republishListing(req.user.uid, id);
  }

  @Post('listings/:id/sold')
  markSold(@Req() req: any, @Param('id') id: string) {
    return this.lifecycle.markSold(req.user.uid, id);
  }

  @Patch('listings/:id/unique')
  setUniqueItem(@Req() req: any, @Param('id') id: string, @Body() body: { unique?: unknown }) {
    return this.lifecycle.setUniqueItem(req.user.uid, id, body?.unique);
  }

  @Delete('listings/:id')
  deleteListing(@Req() req: any, @Param('id') id: string) {
    return this.lifecycle.deleteListing(req.user.uid, id);
  }

  @Post('auctions/:id/archive')
  archiveAuction(@Req() req: any, @Param('id') id: string) {
    return this.lifecycle.archiveAuction(req.user.uid, id);
  }

  @Post('auctions/:id/restore')
  restoreAuction(@Req() req: any, @Param('id') id: string) {
    return this.lifecycle.restoreAuction(req.user.uid, id);
  }

  @Delete('auctions/:id')
  deleteAuction(@Req() req: any, @Param('id') id: string) {
    return this.lifecycle.deleteAuction(req.user.uid, id);
  }
}
