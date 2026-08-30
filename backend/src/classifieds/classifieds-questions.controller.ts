import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { ClassifiedsQuestionsService } from './classifieds-questions.service';

@Controller('classifieds')
export class ClassifiedsQuestionsPublicController {
  constructor(private readonly questions: ClassifiedsQuestionsService) {}

  @Get('listings/:listingId/questions')
  publicQuestions(@Param('listingId') listingId: string) {
    return this.questions.publicForListing(listingId);
  }

  @Post('listings/:listingId/questions/suggest')
  suggest(@Param('listingId') listingId: string, @Body() body: Record<string, unknown>) {
    return this.questions.suggest(listingId, body?.question);
  }
}

@Controller('classifieds')
@UseGuards(FirebaseAuthGuard)
export class ClassifiedsQuestionsController {
  constructor(private readonly questions: ClassifiedsQuestionsService) {}

  @Get('listings/:listingId/questions/mine')
  mine(@Req() req: any, @Param('listingId') listingId: string) {
    return this.questions.mine(req.user.uid, listingId);
  }

  @Post('listings/:listingId/questions')
  ask(@Req() req: any, @Param('listingId') listingId: string, @Body() body: Record<string, unknown>) {
    return this.questions.ask(req.user.uid, listingId, body || {});
  }

  @Post('questions/:questionId/helpful')
  helpful(@Req() req: any, @Param('questionId') questionId: string) {
    return this.questions.helpful(req.user.uid, questionId);
  }

  @Get('me/questions/summary')
  summary(@Req() req: any) {
    return this.questions.companySummary(req.user.uid);
  }

  @Get('me/questions')
  companyList(@Req() req: any, @Query('status') status?: string) {
    return this.questions.companyList(req.user.uid, status);
  }

  @Patch('me/questions/:questionId/answer')
  answer(@Req() req: any, @Param('questionId') questionId: string, @Body() body: Record<string, unknown>) {
    return this.questions.answer(req.user.uid, questionId, body || {});
  }

  @Patch('me/questions/:questionId/hide')
  hide(@Req() req: any, @Param('questionId') questionId: string) {
    return this.questions.hide(req.user.uid, questionId);
  }
}
