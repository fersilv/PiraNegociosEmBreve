import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { MobileUploadSessionsService } from './mobile-upload-sessions.service';

@Controller('uploads/mobile-sessions')
@UseGuards(FirebaseAuthGuard)
export class MobileUploadSessionsController {
  constructor(private readonly sessions: MobileUploadSessionsService) {}

  @Post()
  create(@Req() req: any, @Body() body: { purpose?: unknown; maxSizeKB?: unknown }) {
    return this.sessions.create(req.user.uid, body || {});
  }

  @Get(':id')
  status(@Req() req: any, @Param('id') id: string) {
    return this.sessions.statusForOwner(id, req.user.uid);
  }

  @Post(':id/consume')
  consume(@Req() req: any, @Param('id') id: string) {
    return this.sessions.consume(id, req.user.uid);
  }

  @Delete(':id')
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.sessions.cancel(id, req.user.uid);
  }
}
