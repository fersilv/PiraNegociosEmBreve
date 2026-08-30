import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsServiceQuotesService } from './classifieds-service-quotes.service';

@Controller('classifieds/service-quotes')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsServiceQuotesController {
  constructor(private readonly quotes: ClassifiedsServiceQuotesService) {}

  @Post('listings/:listingId')
  request(@Req() req: any, @Param('listingId') listingId: string, @Body() body: Record<string, unknown>) {
    return this.quotes.request(req.user.uid, listingId, body);
  }

  @Get('mine')
  mine(@Req() req: any) {
    return this.quotes.myRequests(req.user.uid);
  }

  @Get('mine/:id')
  mineDetail(@Req() req: any, @Param('id') id: string) {
    return this.quotes.detailForUser(req.user.uid, id);
  }

  @Get('company')
  company(@Req() req: any) {
    return this.quotes.companyRequests(req.user.uid);
  }

  @Get('company/:id')
  companyDetail(@Req() req: any, @Param('id') id: string) {
    return this.quotes.detailForCompany(req.user.uid, id);
  }

  @Post('company/:id/versions')
  createVersion(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.quotes.createVersion(req.user.uid, id, body);
  }

  @Post('company/:id/send')
  send(@Req() req: any, @Param('id') id: string) {
    return this.quotes.send(req.user.uid, id);
  }

  @Post(':id/adjustment')
  adjustment(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.quotes.requestAdjustment(req.user.uid, id, body.note);
  }

  @Post(':id/accept')
  accept(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.quotes.accept(req.user.uid, id, body.versionId);
  }

  @Post(':id/decline')
  decline(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.quotes.decline(req.user.uid, id, body.reason);
  }

  @Patch('company/:id/cancel')
  cancel(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.quotes.cancelByCompany(req.user.uid, id, body.reason);
  }
}
