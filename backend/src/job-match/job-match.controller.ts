import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { JobMatchAdminService } from './job-match-admin.service';
import { JobMatchService } from './job-match.service';

@Controller('job-match')
@UseGuards(FirebaseAuthGuard)
export class JobMatchController {
  constructor(private readonly jobMatch: JobMatchService) {}

  @Get('status')
  status(@Req() req: any) {
    return this.jobMatch.getStatus(req.user.uid);
  }

  @Get('me')
  matches(@Req() req: any) {
    return this.jobMatch.getMatches(req.user.uid);
  }
}

@Controller('admin/job-match')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminJobMatchController {
  constructor(
    private readonly jobMatch: JobMatchService,
    private readonly adminMatch: JobMatchAdminService,
  ) {}

  @Get('overview')
  overview() {
    return this.adminMatch.overview();
  }

  @Patch('config')
  updateConfig(@Body() body: { durationDays?: unknown }) {
    return this.adminMatch.updateConfig(body || {});
  }

  @Post('backfill')
  backfill(@Query('limit') limit?: string) {
    return this.adminMatch.backfill(Number(limit || 25));
  }

  @Post('jobs/:id/reanalyze')
  reanalyze(@Param('id') id: string) {
    return this.jobMatch.reanalyzeJob(id);
  }
}
